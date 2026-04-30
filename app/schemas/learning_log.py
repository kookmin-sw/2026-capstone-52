from pydantic import BaseModel
from typing import Optional


class LearningLogCreate(BaseModel):
    user_id: int
    project_id: Optional[int] = None
    activity_type: str
    activity_summary: str
