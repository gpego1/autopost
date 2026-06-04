import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id, get_db
from app.models.profile import Profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class ProfileUpsertRequest(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


class ProfileResponse(BaseModel):
    id: UUID
    full_name: str | None
    avatar_url: str | None
    plan: str

    model_config = {"from_attributes": True}


@router.post("/profile", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
async def upsert_profile(
    payload: ProfileUpsertRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    """Create or update the authenticated user's profile."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = Profile(id=user_id)
        db.add(profile)
        logger.info("Creating new profile for user %s", user_id)

    if payload.full_name is not None:
        profile.full_name = payload.full_name
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url

    await db.flush()
    await db.refresh(profile)
    return profile


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    """Get the authenticated user's profile."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Call POST /auth/profile to create it.",
        )

    return profile
