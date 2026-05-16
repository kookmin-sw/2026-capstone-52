# 수준 진단 테이블 — 질문(diagnosis_questions)과 답변(diagnosis_answers)을 분리해서 저장
# 기존 DiagnosisSession(질문+답변 혼합) → 두 테이블로 분리
#
# 분리 이유:
#   - 질문 메타데이터(난이도, 영향 노드 목록)는 생성 시점에 고정
#   - 답변은 session_id를 통해 몇 번째 진단(PDF 업로드 차수)인지 구분
#   - score는 답변 저장 후 서비스 레이어에서 계산 → concept_nodes에 반영 (여기엔 없음)

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class DiagnosisQuestion(Base):
    """진단 질문 — 생성 시점에 메타데이터 포함해서 저장"""
    __tablename__ = "diagnosis_questions"

    question_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 이 질문이 주로 측정하는 개념 — score 업데이트의 기준 노드
    concept_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)

    # 난이도 — score 계산 시 가중치로 사용 (easy/medium/hard)
    difficulty: Mapped[str] = mapped_column(String, nullable=False, default="medium")

    # 질문 목적 — 오답 처리 방식 결정
    #   concept_check      → 해당 노드 score 하락
    #   prerequisite_check → 선수 노드 score 하락 + 추가 진단 트리거
    question_type: Mapped[str] = mapped_column(String, nullable=False, default="concept_check")

    question: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[str] = mapped_column(Text, nullable=False)       # JSON 배열 ["①..","②..","③..","④..","⑤.."]
    correct_index: Mapped[str] = mapped_column(String, nullable=False)  # 정답 인덱스 (0~4), 프론트에 미노출
    correct_option_ids: Mapped[str] = mapped_column(Text, nullable=True)  # JSON 배열 ["A","C"]
    diagnostic_tags: Mapped[str] = mapped_column(Text, nullable=True)     # JSON 배열 ["deadlock_condition"]
    tag_group: Mapped[str] = mapped_column(String, nullable=True)
    reuse_key: Mapped[str] = mapped_column(String, nullable=True)
    diagnosis_purpose: Mapped[str] = mapped_column(String, nullable=True, default="concept_check")
    explanation: Mapped[str] = mapped_column(Text, nullable=True)  # 문제 단위 해설 — 정답 이유 설명

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class DiagnosisAnswer(Base):
    """진단 답변 — 사용자가 질문에 제출한 답변 기록"""
    __tablename__ = "diagnosis_answers"

    answer_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # FK → diagnosis_questions: 어떤 질문에 대한 답변인지
    question_id: Mapped[str] = mapped_column(String, ForeignKey("diagnosis_questions.question_id"), nullable=False)

    # PDF 업로드마다 새로 발급되는 진단 세션 식별자
    # 같은 프로젝트에 PDF를 2번 올리면 session_id가 달라 1차/2차 진단을 구분 가능
    session_id: Mapped[str] = mapped_column(String, nullable=False)

    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # 스킵 여부 — True면 score 계산 없이 WEAK으로 처리
    is_skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    selected_option_ids: Mapped[str] = mapped_column(Text, nullable=True)          # JSON 배열 ["A","D"]
    partial_score: Mapped[float] = mapped_column(Float, nullable=True)
    answer_score: Mapped[float] = mapped_column(Float, nullable=True)
    is_fully_correct: Mapped[bool] = mapped_column(Boolean, nullable=True, default=False)
    invalid_selected_option_ids: Mapped[str] = mapped_column(Text, nullable=True)  # JSON 배열 ["Z"]
    missed_correct_option_ids: Mapped[str] = mapped_column(Text, nullable=True)    # JSON 배열 ["C"]
    wrong_selected_option_ids: Mapped[str] = mapped_column(Text, nullable=True)    # JSON 배열 ["D"]

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
