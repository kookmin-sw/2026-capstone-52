from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    user_id: int
    project_name: str
    project_description: Optional[str] = None
    project_domain: Optional[str] = None


class ProjectResponse(BaseModel):
    project_id: int
    user_id: int
    project_name: str
    project_description: Optional[str]
    project_domain: Optional[str]
    created_at: datetime | None

    class Config:
        from_attributes = True
