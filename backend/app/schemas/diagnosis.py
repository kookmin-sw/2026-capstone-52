from pydantic import BaseModel
from typing import Optional


# ── 세션 ──────────────────────────────────────────────────────────────────────

class DiagnosisSessionCreateResponse(BaseModel):
    """PDF 업로드 후 새 진단 세션 생성 시 반환 — 이후 모든 질문/답변에 session_id 첨부"""
    session_id: str


# ── 질문 ──────────────────────────────────────────────────────────────────────

class DiagnosisChoiceResponse(BaseModel):
    """학생 응답용 선택지 — 정답 여부나 해설은 포함하지 않음"""
    id: str        # option_id와 동일 — 프론트 normalizeApiChoice 호환용
    option_id: str
    text: str

class DiagnosisQuestionResponse(BaseModel):
    """진단 질문 응답 — correct_index는 포함하지 않음"""
    question_id: str
    concept_id: str
    concept_name: Optional[str] = None         # 개념 노드 이름 — 프론트 표시용
    difficulty: Optional[str] = None           # easy / medium / hard — 프론트에서 난이도 표시용
    question_type: str                         # concept_check / prerequisite_check / multi_select
    diagnosis_purpose: Optional[str] = None
    question: str
    choices: list[str] | list[DiagnosisChoiceResponse]  # legacy 문자열 또는 학생용 선택지 객체


# ── 답변 ──────────────────────────────────────────────────────────────────────

class DiagnosisAnswerRequest(BaseModel):
    """진단 답변 요청"""
    question_id: str
    session_id: str           # 몇 번째 진단(PDF 업로드 차수)인지 구분
    selected_index: Optional[int] = None       # legacy single-select 인덱스
    selected_option_ids: Optional[list[str]] = None
    is_skipped: bool = False  # 스킵 시 score 계산 없이 WEAK 처리


class DiagnosisReportRequest(BaseModel):
    """수준진단 완료 후 채팅 리포트 생성 요청"""
    session_id: str


class DiagnosisAnswerResponse(BaseModel):
    """진단 답변 처리 결과"""
    is_correct: Optional[bool] = None
    correct_index: Optional[int] = None
    is_fully_correct: Optional[bool] = None
    partial_score: Optional[float] = None
    answer_score: Optional[float] = None
    answer_level: Optional[int] = None
    correct_option_ids: Optional[list[str]] = None
    selected_option_ids: Optional[list[str]] = None
    missed_correct_option_ids: Optional[list[str]] = None
    wrong_selected_option_ids: Optional[list[str]] = None
    invalid_selected_option_ids: Optional[list[str]] = None

    # affects 목록 각 노드의 갱신 결과 — 프론트에서 그래프 상태 즉시 반영에 사용
    updated_nodes: Optional[list[dict]] = None
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
