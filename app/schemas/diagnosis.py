from pydantic import BaseModel
from typing import Optional


# ── 세션 ──────────────────────────────────────────────────────────────────────

class DiagnosisSessionCreateResponse(BaseModel):
    """PDF 업로드 후 새 진단 세션 생성 시 반환 — 이후 모든 질문/답변에 session_id 첨부"""
    session_id: str


# ── 질문 ──────────────────────────────────────────────────────────────────────

class DiagnosisQuestionResponse(BaseModel):
    """진단 질문 응답 — correct_index는 포함하지 않음"""
    question_id: str
    concept_id: str
    difficulty: str           # easy / medium / hard — 프론트에서 난이도 표시용
    question_type: str        # concept_check / prerequisite_check
    affects: list[str]        # 정답/오답 시 동시에 score가 바뀔 node_id 목록
    question: str
    choices: list[str]        # 선택지 4개


# ── 답변 ──────────────────────────────────────────────────────────────────────

class DiagnosisAnswerRequest(BaseModel):
    """진단 답변 요청"""
    question_id: str
    session_id: str           # 몇 번째 진단(PDF 업로드 차수)인지 구분
    selected_index: int       # 사용자가 선택한 인덱스 (0~3), is_skipped=True면 무시
    is_skipped: bool = False  # 스킵 시 score 계산 없이 WEAK 처리


class DiagnosisAnswerResponse(BaseModel):
    """진단 답변 처리 결과 — affects 노드 전체의 업데이트 결과 포함"""
    is_correct: bool
    correct_index: int

    # affects 목록 각 노드의 갱신 결과 — 프론트에서 그래프 상태 즉시 반영에 사용
    updated_nodes: list[dict]
    # 예: [{"node_id": "...", "status": "FAMILIAR", "understanding_score": 0.65}, ...]


# ── 진단 개념 목록 ────────────────────────────────────────────────────────────

class DiagnosisNodeItem(BaseModel):
    """진단 개념 목록 항목 — 우측 패널 표시용"""
    node_id: str
    name: str
    diagnosis_label: str  # 미진단 / 진행 중 / 이해 / 추가 학습


# ── 진행 상태 ─────────────────────────────────────────────────────────────────

class DiagnosisStatusResponse(BaseModel):
    """진단 진행률 — session_id 기준 답변 수 / 12문제 고정"""
    session_id: str
    answered: int
    total_questions: int
    progress_percent: float
