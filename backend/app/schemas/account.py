from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class Platform(str, Enum):
    instagram = "instagram"
    facebook = "facebook"
    linkedin = "linkedin"


class SocialAccountCreate(BaseModel):
    platform: Platform
    account_name: str
    platform_user_id: str
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None

    model_config = {"str_strip_whitespace": True}


class SocialAccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    platform: str
    account_name: str
    platform_user_id: str
    token_expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None
