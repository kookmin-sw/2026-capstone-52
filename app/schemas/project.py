from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class ProjectCreate(BaseModel):
    project_domain: Literal[
        "operating_system",
        "data_structure",
        "algorithm",
        "computer_network"
    ]
    project_description: Optional[str] = None


class ProjectResponse(BaseModel):
    project_id: int
    user_id: int
    project_name: str
    project_description: Optional[str]
    project_domain: Optional[str]
    created_at: datetime | None

    class Config:
        from_attributes = True
