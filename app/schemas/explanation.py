from typing import Literal, Optional

from pydantic import BaseModel


class ExplanationRequest(BaseModel):
    project_id: int
    node_id: Optional[str] = None
    question: str
    explanation_style: Optional[Literal["example", "concise", "step"]] = None


class ExplanationPrerequisiteReview(BaseModel):
    concept_id: str
    concept_name: str
    reason: str
    review_text: str


class ExplanationMisconception(BaseModel):
    misconception: str
    correction: str


class ExplanationResponse(BaseModel):
    concept_id: str
    concept_name: str
    user_level: int
    explanation_level: str
    title: str
    summary: str
    explanation: str
    prerequisite_review: list[ExplanationPrerequisiteReview] = []
    common_misconceptions: list[ExplanationMisconception] = []
    example: str = ""
    connection_to_graph: str = ""
    next_steps: list[str] = []
    confidence_note: str = ""
