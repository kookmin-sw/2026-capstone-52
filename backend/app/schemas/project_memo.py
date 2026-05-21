from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProjectMemoCreate(BaseModel):
    title: str = Field(min_length=1)
    content: Optional[str] = ""


class ProjectMemoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    content: Optional[str] = None


class ProjectMemoResponse(BaseModel):
    memo_id: int
    project_id: int
    title: str
    content: Optional[str] = ""
    created_at: datetime | None
    updated_at: datetime | None

    class Config:
        from_attributes = True
