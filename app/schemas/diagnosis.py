from pydantic import BaseModel
from typing import Optional


class DiagnosisQuestionResponse(BaseModel):
    diagnosis_id: str
    question: str
    node_id: Optional[str]


class DiagnosisAnswerRequest(BaseModel):
    diagnosis_id: str
    answer: str


class DiagnosisStatusResponse(BaseModel):
    total_nodes: int
    diagnosed_nodes: int
    progress_percent: float
