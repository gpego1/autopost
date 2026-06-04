import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.post import Post
from app.models.publish_job import PublishJob
from app.schemas.post import PostCreate, PostResponse, PostStatus, PostUpdate, SchedulePostRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("/", response_model=list[PostResponse])
async def list_posts(
    status_filter: Optional[PostStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Post]:
    """List all posts for the authenticated user, optionally filtered by status."""
    stmt = select(Post).where(Post.user_id == user_id).order_by(Post.created_at.desc())
    if status_filter:
        stmt = stmt.where(Post.status == status_filter.value)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Create a new post draft."""
    post = Post(
        user_id=user_id,
        title=payload.title,
        content=payload.content,
        media_urls=payload.media_urls,
        platforms=payload.platforms,
        scheduled_at=payload.scheduled_at,
        status="scheduled" if payload.scheduled_at else "draft",
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)
    logger.info("Created post %s for user %s", post.id, user_id)
    return post


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Get a specific post by ID."""
    post = await _get_owned_post(post_id, user_id, db)
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: UUID,
    payload: PostUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Update an existing post."""
    post = await _get_owned_post(post_id, user_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert enum to value if needed
        if hasattr(value, "value"):
            value = value.value
        setattr(post, field, value)

    await db.flush()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a post and all its associated publish jobs."""
    post = await _get_owned_post(post_id, user_id, db)
    await db.delete(post)


@router.post("/{post_id}/schedule", response_model=PostResponse)
async def schedule_post(
    post_id: UUID,
    payload: SchedulePostRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """
    Schedule a post for publishing.
    Sets scheduled_at, changes status to 'scheduled', creates publish jobs,
    and enqueues a Celery task.
    """
    post = await _get_owned_post(post_id, user_id, db)

    if post.status in ("publishing", "done"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot schedule a post with status '{post.status}'",
        )

    post.scheduled_at = payload.scheduled_at
    post.status = "scheduled"

    # Create/reset publish jobs for each platform
    # Remove existing pending jobs first
    existing_result = await db.execute(
        select(PublishJob).where(
            PublishJob.post_id == post_id,
            PublishJob.status.in_(["pending", "retrying", "failed"]),
        )
    )
    for job in existing_result.scalars().all():
        await db.delete(job)

    for platform in post.platforms:
        job = PublishJob(
            post_id=post.id,
            platform=platform,
            method="graph_api",
            status="pending",
        )
        db.add(job)

    await db.flush()
    await db.refresh(post)

    logger.info("Scheduled post %s for %s", post.id, payload.scheduled_at)

    return post


async def _get_owned_post(
    post_id: UUID, user_id: UUID, db: AsyncSession
) -> Post:
    """Helper: fetch a post and verify ownership."""
    result = await db.execute(
        select(Post).where(Post.id == post_id, Post.user_id == user_id)
    )
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )
    return post
