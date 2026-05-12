from pydantic import BaseModel
from typing import Optional


class ExplanationRequest(BaseModel):
    project_id: int
    user_id: int
    node_id: Optional[str] = None
    question: str
