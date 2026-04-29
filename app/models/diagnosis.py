# diagnosis_sessions 테이블 — 수준 진단 질문/답변 기록

import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class DiagnosisSession(Base):
    __tablename__ = "diagnosis_sessions"

    diagnosis_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=True)
    question: Mapped[str] = mapped_column(Text, nullable=True)
    choices: Mapped[str] = mapped_column(Text, nullable=True)   # JSON 문자열로 저장 ["①..","②..","③..","④.."]
    correct_index: Mapped[int] = mapped_column(Integer, nullable=True)  # 정답 인덱스 (0~3), 프론트에 미노출
    selected_index: Mapped[int] = mapped_column(Integer, nullable=True) # 사용자가 선택한 인덱스
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
