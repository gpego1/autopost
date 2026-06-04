import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.post import Post
from app.models.publish_job import PublishJob
from app.schemas.job import PublishJobResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=list[PublishJobResponse])
async def list_jobs(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[PublishJob]:
    """List all publish jobs for the authenticated user's posts."""
    result = await db.execute(
        select(PublishJob)
        .join(Post, PublishJob.post_id == Post.id)
        .where(Post.user_id == user_id)
        .order_by(PublishJob.executed_at.desc().nullslast())
    )
    return list(result.scalars().all())


@router.get("/{job_id}", response_model=PublishJobResponse)
async def get_job(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PublishJob:
    """Get details of a specific publish job."""
    result = await db.execute(
        select(PublishJob)
        .join(Post, PublishJob.post_id == Post.id)
        .where(PublishJob.id == job_id, Post.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Publish job not found",
        )
    return job
