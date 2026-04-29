from pydantic import BaseModel
from typing import Optional


class DiagnosisQuestionResponse(BaseModel):
    diagnosis_id: str
    node_id: Optional[str]
    question: str
    choices: list[str]  # 4개 선택지, 정답 인덱스는 포함 안 함


class DiagnosisAnswerRequest(BaseModel):
    diagnosis_id: str
    selected_index: int  # 사용자가 선택한 인덱스 (0~3)


class DiagnosisAnswerResponse(BaseModel):
    is_correct: bool
    correct_index: int
    node_status: str   # 업데이트된 노드 상태


class DiagnosisStatusResponse(BaseModel):
    total_nodes: int
    diagnosed_nodes: int
    progress_percent: float
