from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PostStatus(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    publishing = "publishing"
    done = "done"
    failed = "failed"


class PostCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=512)
    content: str = Field(..., min_length=1)
    media_urls: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(..., min_length=1)
    scheduled_at: Optional[datetime] = None

    model_config = {"str_strip_whitespace": True}


class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=512)
    content: Optional[str] = Field(None, min_length=1)
    media_urls: Optional[list[str]] = None
    platforms: Optional[list[str]] = None
    status: Optional[PostStatus] = None
    scheduled_at: Optional[datetime] = None

    model_config = {"str_strip_whitespace": True}


class PostResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: Optional[str]
    content: str
    media_urls: list[str]
    platforms: list[str]
    status: PostStatus
    scheduled_at: Optional[datetime]
    published_at: Optional[datetime]
    error_log: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SchedulePostRequest(BaseModel):
    scheduled_at: datetime = Field(..., description="UTC datetime to publish the post")
