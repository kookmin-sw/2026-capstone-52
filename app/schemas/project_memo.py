from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectMemoUpdate(BaseModel):
    content: Optional[str] = ""


class ProjectMemoResponse(BaseModel):
    memo_id: int
    project_id: int
    content: Optional[str]
    created_at: datetime | None
    updated_at: datetime | None

    class Config:
        from_attributes = True
