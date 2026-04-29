from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ExplanationRequest(BaseModel):
    project_id: str
    user_id: str
    node_id: Optional[str] = None
    question: str


class ExplanationResponse(BaseModel):
    explanation_id: str
    response: str
    created_at: datetime

    model_config = {"from_attributes": True}
