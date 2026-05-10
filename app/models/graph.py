# 지식 그래프 테이블 — AI가 추출한 개념(노드)과 개념 간 관계(엣지)를 저장

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


# 노드 상태 5단계 — 수준 진단 결과로 결정되며 understanding_score 기반으로 자동 산출
# UNSEEN   : 아직 진단 안 됨 (기본값)
# WEAK     : 모를 가능성 높음
# PARTIAL  : 부분적으로 이해
# FAMILIAR : 알 가능성 높음
# MASTERED : 확실히 이해
NODE_STATUS_UNSEEN   = "UNSEEN"
NODE_STATUS_WEAK     = "WEAK"
NODE_STATUS_PARTIAL  = "PARTIAL"
NODE_STATUS_FAMILIAR = "FAMILIAR"
NODE_STATUS_MASTERED = "MASTERED"


class ConceptNode(Base):
    """개념 노드 — AI가 PDF에서 추출한 핵심 개념 하나"""
    __tablename__ = "concept_nodes"

    node_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    file_id: Mapped[str] = mapped_column(String, ForeignKey("files.file_id"), nullable=True)  # 어떤 파일에서 추출했는지
    name: Mapped[str] = mapped_column(String, nullable=False)         # 개념명 (예: "극한")
    description: Mapped[str] = mapped_column(String, nullable=True)   # 개념 설명
    group: Mapped[str] = mapped_column(String, nullable=True)         # 상위 주제 (예: "미적분")

    # 수준 진단 결과 — score에서 파생되는 표시용 상태
    status: Mapped[str] = mapped_column(String, default=NODE_STATUS_UNSEEN)

    # 내부 점수 — 0.0 ~ 1.0, 서비스 레이어에서 계산 후 반영 (답변 저장 시점이 아님)
    # UNSEEN 상태에서는 None으로 두고 첫 진단 후 초기 점수로 채움
    understanding_score: Mapped[float] = mapped_column(Float, nullable=True, default=None)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ConceptEdge(Base):
    """개념 엣지 — 두 개념 사이의 관계"""
    __tablename__ = "concept_edges"

    edge_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    source_node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    target_node_id: Mapped[str] = mapped_column(String, ForeignKey("concept_nodes.node_id"), nullable=False)
    relation_type: Mapped[str] = mapped_column(String, nullable=False)
    # MVP 관계 타입: prerequisite(선수 개념) / part_of(포함 관계)
    weight: Mapped[float] = mapped_column(Float, default=1.0)         # 관계 강도 0.0 ~ 1.0
