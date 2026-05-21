from pydantic import BaseModel
from typing import Optional


class LearningLogCreate(BaseModel):
    user_id: Optional[int] = None
    project_id: Optional[int] = None
    activity_type: str
    activity_summary: str
