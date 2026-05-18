from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.file import File
from app.models.graph import ConceptEdge, ConceptNode
from app.models.project import Project
from app.schemas.quiz_report import (
    ConceptScoreItem,
    QuizReport,
    RecommendationBasisItem,
    RecommendedLearningPathItem,
    WeakConceptItem,
)
from app.services.diagnosis_service import get_session_review


WEAK_STATUSES = {"WEAK", "PARTIAL"}

DOMAIN_LABELS = {
    "operating_system": "운영체제",
    "data_structure": "자료구조",
    "algorithm": "알고리즘",
    "computer_network": "컴퓨터 네트워크",
}


def build_quiz_report(db: Session, project_id: int, session_id: str) -> QuizReport:
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise ValueError("프로젝트를 찾을 수 없습니다.")

    nodes = _get_project_nodes(db, project_id)
    if not nodes:
        raise ValueError("리포트를 생성할 개념 노드가 없습니다.")

    answers = _get_session_answers(db, session_id)
    if not answers:
        raise ValueError("해당 session_id의 수준진단 답변이 없습니다.")

    questions = _get_questions_by_id(db, [answer.question_id for answer in answers])
    answered_node_ids = {
        question.concept_id
        for answer in answers
        if (question := questions.get(answer.question_id)) is not None
    }
    diagnosed_nodes = [node for node in nodes if node.node_id in answered_node_ids]
    weak_nodes = [
        node
        for node in diagnosed_nodes
        if (node.status or "UNSEEN") in WEAK_STATUSES or (node.understanding_score is not None and node.understanding_score < 0.5)
    ]
    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()

    question_reviews = get_session_review(session_id, db)

    return QuizReport(
        document_summary=_build_document_summary(db, project, nodes, diagnosed_nodes, weak_nodes),
        weak_concepts=[_build_weak_concept_item(node) for node in _order_learning_nodes(weak_nodes, edges)],
        concept_scores=[_build_concept_score_item(node) for node in diagnosed_nodes],
        recommended_learning_path=[
            _build_learning_path_item(index, node)
            for index, node in enumerate(_order_learning_nodes(weak_nodes or diagnosed_nodes, edges)[:5], start=1)
        ],
        recommendation_basis=_build_recommendation_basis(answers, weak_nodes, diagnosed_nodes),
        question_reviews=question_reviews,
    )


def _get_project_nodes(db: Session, project_id: int) -> list[ConceptNode]:
    return (
        db.query(ConceptNode)
        .filter(ConceptNode.project_id == project_id)
        .order_by(
            ConceptNode.group.asc(),
            ConceptNode.is_core.desc(),
            ConceptNode.core_score.desc().nullslast(),
            ConceptNode.name.asc(),
        )
        .all()
    )


def _get_session_answers(db: Session, session_id: str) -> list[DiagnosisAnswer]:
    return (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.session_id == session_id)
        .order_by(DiagnosisAnswer.created_at.asc())
        .all()
    )


def _get_questions_by_id(db: Session, question_ids: list[str]) -> dict[str, DiagnosisQuestion]:
    if not question_ids:
        return {}

    questions = db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id.in_(question_ids)).all()
    return {question.question_id: question for question in questions}


def _build_document_summary(
    db: Session,
    project: Project,
    nodes: list[ConceptNode],
    diagnosed_nodes: list[ConceptNode],
    weak_nodes: list[ConceptNode],
) -> str:
    latest_file = (
        db.query(File)
        .filter(File.project_id == project.project_id)
        .order_by(File.uploaded_at.desc())
        .first()
    )
    source_title = Path(latest_file.file_name).stem if latest_file and latest_file.file_name else project.project_name
    domain_label = DOMAIN_LABELS.get(project.project_domain or "", project.project_name or "학습 자료")
    groups = sorted({node.group for node in nodes if node.group})
    group_summary = ", ".join(groups[:4]) if groups else "핵심 개념"

    return (
        f"{source_title or domain_label} 자료는 {domain_label}의 {group_summary} 흐름을 중심으로 구성되어 있습니다. "
        f"이번 수준진단에서는 {len(diagnosed_nodes)}개 개념을 확인했고, "
        f"그중 {len(weak_nodes)}개 개념에서 보완이 필요합니다."
    )


def _build_weak_concept_item(node: ConceptNode) -> WeakConceptItem:
    return WeakConceptItem(
        node_id=node.node_id,
        concept_id=node.concept_id,
        name=node.name,
        group=node.group,
        status=node.status,
        understanding_score=node.understanding_score,
        reason=_build_weak_reason(node),
    )


def _build_concept_score_item(node: ConceptNode) -> ConceptScoreItem:
    return ConceptScoreItem(
        node_id=node.node_id,
        concept_id=node.concept_id,
        name=node.name,
        group=node.group,
        status=node.status,
        understanding_score=node.understanding_score,
        understanding_level=node.understanding_level,
        diagnosis_count=node.diagnosis_count,
    )


def _build_learning_path_item(order: int, node: ConceptNode) -> RecommendedLearningPathItem:
    return RecommendedLearningPathItem(
        order=order,
        node_id=node.node_id,
        concept_id=node.concept_id,
        name=node.name,
        reason=_build_node_hint(node),
    )


def _build_recommendation_basis(
    answers: list[DiagnosisAnswer],
    weak_nodes: list[ConceptNode],
    diagnosed_nodes: list[ConceptNode],
) -> list[RecommendationBasisItem]:
    basis = [
        RecommendationBasisItem(
            type="diagnosis_session",
            description=f"해당 수준진단 세션에서 제출된 {len(answers)}개 답변을 기준으로 분석했습니다.",
        ),
        RecommendationBasisItem(
            type="concept_status",
            description="문항 채점 결과가 반영된 노드별 이해 상태와 점수를 사용했습니다.",
        ),
    ]

    if weak_nodes:
        weak_names = ", ".join(node.name for node in weak_nodes[:3])
        basis.append(
            RecommendationBasisItem(
                type="weak_concepts",
                description=f"보완이 필요한 개념({weak_names})을 우선 학습 대상으로 배치했습니다.",
            )
        )
    elif diagnosed_nodes:
        basis.append(
            RecommendationBasisItem(
                type="review_strategy",
                description="취약 개념이 뚜렷하지 않아 핵심 개념을 중심으로 복습 경로를 구성했습니다.",
            )
        )

    return basis


def _order_learning_nodes(nodes: list[ConceptNode], edges: list[ConceptEdge]) -> list[ConceptNode]:
    node_map = {node.node_id: node for node in nodes}
    node_ids = set(node_map.keys())
    prerequisite_targets = {
        edge.target_node_id
        for edge in edges
        if edge.relation_type == "prerequisite" and edge.source_node_id in node_ids and edge.target_node_id in node_ids
    }

    return sorted(
        nodes,
        key=lambda node: (
            1 if node.node_id in prerequisite_targets else 0,
            node.understanding_level if node.understanding_level is not None else 3,
            node.understanding_score if node.understanding_score is not None else 0.5,
            node.name or "",
        ),
    )


def _build_weak_reason(node: ConceptNode) -> str:
    score = node.understanding_score
    if score is not None:
        return f"현재 이해 점수가 {score:.2f}로 낮아 우선 복습이 필요합니다."
    return "수준진단 결과 보완이 필요한 상태로 분류되었습니다."


def _build_node_hint(node: ConceptNode) -> str:
    if node.description:
        return node.description
    if node.group:
        return f"{node.group} 흐름 안에서 개념의 역할을 다시 확인하세요."
    return "정의, 예시, 관련 개념을 함께 다시 확인하세요."
