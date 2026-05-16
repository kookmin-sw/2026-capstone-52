from typing import Literal, Optional

from pydantic import BaseModel


class ExplanationRequest(BaseModel):
    project_id: int
    node_id: Optional[str] = None
    question: str
    explanation_style: Optional[Literal["example", "concise", "step"]] = None
