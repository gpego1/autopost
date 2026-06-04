import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from celery import Task

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 60  # seconds (60, 120, 240)


class PublishPostTask(Task):
    """Custom Task class that holds shared resources."""
    abstract = True
    _db_session = None


@celery_app.task(
    bind=True,
    base=PublishPostTask,
    name="app.workers.publish_task.publish_post_task",
    max_retries=MAX_RETRIES,
    default_retry_delay=RETRY_BACKOFF_BASE,
)
def publish_post_task(self: Task, post_id: str) -> dict:
    """
    Celery task that publishes a scheduled post to all target platforms.

    Flow:
    1. Fetch the post and its publish_jobs from the database
    2. For each pending publish_job:
       a. Fetch the connected social account for that platform
       b. Decrypt the access token
       c. Call the appropriate platform service
       d. Update publish_job status to 'done' or 'failed'
    3. Update post status to 'done' when all jobs succeed,
       or 'failed' if any job fails after all retries

    Retries up to MAX_RETRIES times with exponential backoff.
    """
    return asyncio.run(_run_publish_task(self, post_id))


async def _run_publish_task(task: Task, post_id: str) -> dict:
    """Async implementation of the publish task."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.core.config import settings
    from app.core.security import decrypt_token
    from app.models.post import Post
    from app.models.publish_job import PublishJob
    from app.models.social_account import SocialAccount
    from app.services.facebook_service import FacebookService
    from app.services.instagram_service import InstagramService
    from app.services.linkedin_service import LinkedInService

    engine = create_async_engine(settings.database_url, echo=False)
    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)

    results = {}
    all_done = True
    any_failed = False

    async with session_maker() as db:
        try:
            # Fetch post
            post_result = await db.execute(
                select(Post).where(Post.id == UUID(post_id))
            )
            post = post_result.scalar_one_or_none()

            if post is None:
                logger.error("Post %s not found — aborting task", post_id)
                return {"error": "Post not found"}

            if post.status not in ("scheduled", "publishing"):
                logger.info(
                    "Post %s has status '%s' — skipping publish", post_id, post.status
                )
                return {"skipped": True, "status": post.status}

            # Update post status to 'publishing'
            post.status = "publishing"
            await db.commit()

            # Fetch pending publish jobs
            jobs_result = await db.execute(
                select(PublishJob).where(
                    PublishJob.post_id == UUID(post_id),
                    PublishJob.status.in_(["pending", "retrying"]),
                )
            )
            jobs = list(jobs_result.scalars().all())

            if not jobs:
                logger.warning("No pending jobs found for post %s", post_id)
                post.status = "done"
                await db.commit()
                return {"done": True, "jobs": 0}

            for job in jobs:
                job.attempts += 1
                job.status = "running"
                job.executed_at = datetime.now(tz=timezone.utc)
                await db.flush()

                try:
                    # Fetch the connected account for this platform
                    account_result = await db.execute(
                        select(SocialAccount).where(
                            SocialAccount.user_id == post.user_id,
                            SocialAccount.platform == job.platform,
                            SocialAccount.is_active == True,
                        )
                    )
                    account = account_result.scalar_one_or_none()

                    if account is None:
                        raise ValueError(
                            f"No active {job.platform} account found for user {post.user_id}"
                        )

                    access_token = decrypt_token(account.access_token)

                    # Dispatch to the correct service
                    if job.platform == "facebook":
                        service = FacebookService()
                        result = await service.publish_post(
                            access_token=access_token,
                            page_id=account.platform_user_id,
                            content=post.content,
                            media_urls=post.media_urls or [],
                        )
                    elif job.platform == "instagram":
                        service = InstagramService()
                        result = await service.publish_post(
                            access_token=access_token,
                            ig_user_id=account.platform_user_id,
                            content=post.content,
                            media_urls=post.media_urls or [],
                        )
                    elif job.platform == "linkedin":
                        service = LinkedInService()
                        person_urn = f"urn:li:person:{account.platform_user_id}"
                        result = await service.publish_post(
                            access_token=access_token,
                            person_urn=person_urn,
                            content=post.content,
                            media_urls=post.media_urls or [],
                        )
                    else:
                        raise ValueError(f"Unknown platform: {job.platform}")

                    # Success
                    job.status = "done"
                    job.last_error = None
                    results[job.platform] = result
                    logger.info(
                        "Published post %s to %s — result: %s",
                        post_id,
                        job.platform,
                        result,
                    )

                except Exception as exc:
                    error_msg = str(exc)
                    logger.error(
                        "Failed to publish post %s to %s (attempt %d): %s",
                        post_id,
                        job.platform,
                        job.attempts,
                        error_msg,
                    )
                    job.last_error = error_msg

                    if job.attempts >= MAX_RETRIES:
                        job.status = "failed"
                        any_failed = True
                        all_done = False
                    else:
                        job.status = "retrying"
                        all_done = False

            await db.flush()

            # Update post status based on job results
            if all_done and not any_failed:
                post.status = "done"
                post.published_at = datetime.now(tz=timezone.utc)
            elif any_failed and not any(j.status == "retrying" for j in jobs):
                post.status = "failed"
                failed_errors = [j.last_error for j in jobs if j.status == "failed"]
                post.error_log = "; ".join(filter(None, failed_errors))
            # If some are retrying, keep status as 'publishing' and let Celery retry

            await db.commit()

            # Trigger retry if any jobs are still retrying
            retrying_jobs = [j for j in jobs if j.status == "retrying"]
            if retrying_jobs:
                retry_delay = RETRY_BACKOFF_BASE * (2 ** (min(j.attempts for j in retrying_jobs) - 1))
                logger.info(
                    "Scheduling retry for post %s in %ds (attempt %d/%d)",
                    post_id,
                    retry_delay,
                    retrying_jobs[0].attempts,
                    MAX_RETRIES,
                )
                raise task.retry(countdown=retry_delay)

        except Exception as exc:
            await db.rollback()
            if not isinstance(exc, task.MaxRetriesExceededError if hasattr(task, 'MaxRetriesExceededError') else type(None)):
                logger.error("Unexpected error in publish task for post %s: %s", post_id, exc)
            raise
        finally:
            await engine.dispose()

    return {"results": results, "all_done": all_done, "any_failed": any_failed}
