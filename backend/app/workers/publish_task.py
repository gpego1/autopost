import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


async def run_due_posts() -> dict:
    """Find every scheduled post whose scheduled_at <= now and publish it.
    Called by the Vercel Cron endpoint POST /api/jobs/process-due.
    """
    from app.database import AsyncSessionLocal
    from app.models.post import Post

    async with AsyncSessionLocal() as db:
        now = datetime.now(tz=timezone.utc)
        result = await db.execute(
            select(Post).where(
                Post.status == "scheduled",
                Post.scheduled_at <= now,
            )
        )
        due = list(result.scalars().all())

    results = []
    for post in due:
        try:
            outcome = await publish_post(str(post.id))
            results.append({"post_id": str(post.id), "ok": True, **outcome})
        except Exception as exc:
            logger.error("Cron: failed to publish post %s: %s", post.id, exc)
            results.append({"post_id": str(post.id), "ok": False, "error": str(exc)})

    return {"processed": len(results), "results": results}


async def publish_post(post_id: str) -> dict:
    """Publish a single post to all its target platforms."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            return await _publish(db, post_id)
        except Exception:
            await db.rollback()
            raise


async def _publish(db: AsyncSession, post_id: str) -> dict:
    """Core publish logic within an open session."""
    from app.core.security import decrypt_token
    from app.models.post import Post
    from app.models.publish_job import PublishJob
    from app.models.social_account import SocialAccount
    from app.services.facebook_service import FacebookService
    from app.services.instagram_service import InstagramService
    from app.services.linkedin_service import LinkedInService

    post_result = await db.execute(select(Post).where(Post.id == UUID(post_id)))
    post = post_result.scalar_one_or_none()

    if post is None:
        logger.error("Post %s not found", post_id)
        return {"error": "Post not found"}

    if post.status not in ("scheduled", "publishing"):
        return {"skipped": True, "status": post.status}

    post.status = "publishing"
    await db.commit()

    jobs_result = await db.execute(
        select(PublishJob).where(
            PublishJob.post_id == UUID(post_id),
            PublishJob.status.in_(["pending", "retrying"]),
        )
    )
    jobs = list(jobs_result.scalars().all())

    if not jobs:
        post.status = "done"
        await db.commit()
        return {"done": True, "jobs": 0}

    all_done = True
    any_failed = False
    results = {}

    for job in jobs:
        job.attempts += 1
        job.status = "running"
        job.executed_at = datetime.now(tz=timezone.utc)
        await db.flush()

        try:
            account_result = await db.execute(
                select(SocialAccount).where(
                    SocialAccount.user_id == post.user_id,
                    SocialAccount.platform == job.platform,
                    SocialAccount.is_active == True,
                )
            )
            account = account_result.scalar_one_or_none()
            if account is None:
                raise ValueError(f"No active {job.platform} account for user {post.user_id}")

            access_token = decrypt_token(account.access_token)

            if job.platform == "facebook":
                result = await FacebookService().publish_post(
                    access_token=access_token,
                    page_id=account.platform_user_id,
                    content=post.content,
                    media_urls=post.media_urls or [],
                )
            elif job.platform == "instagram":
                result = await InstagramService().publish_post(
                    access_token=access_token,
                    ig_user_id=account.platform_user_id,
                    content=post.content,
                    media_urls=post.media_urls or [],
                )
            elif job.platform == "linkedin":
                result = await LinkedInService().publish_post(
                    access_token=access_token,
                    person_urn=f"urn:li:person:{account.platform_user_id}",
                    content=post.content,
                    media_urls=post.media_urls or [],
                )
            else:
                raise ValueError(f"Unknown platform: {job.platform}")

            job.status = "done"
            job.last_error = None
            results[job.platform] = result
            logger.info("Published post %s to %s", post_id, job.platform)

        except Exception as exc:
            error_msg = str(exc)
            logger.error(
                "Failed post %s on %s (attempt %d): %s",
                post_id, job.platform, job.attempts, error_msg,
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

    if all_done and not any_failed:
        post.status = "done"
        post.published_at = datetime.now(tz=timezone.utc)
    elif any_failed and not any(j.status == "retrying" for j in jobs):
        post.status = "failed"
        post.error_log = "; ".join(
            j.last_error for j in jobs if j.status == "failed" and j.last_error
        )

    await db.commit()
    return {"results": results, "all_done": all_done, "any_failed": any_failed}
