from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"
    retrying = "retrying"


class PublishJobResponse(BaseModel):
    id: UUID
    post_id: UUID
    social_account_id: Optional[UUID]
    platform: str
    method: str
    status: JobStatus
    attempts: int
    last_error: Optional[str]
    executed_at: Optional[datetime]

    model_config = {"from_attributes": True}
