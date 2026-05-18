import json

from sqlalchemy.orm import Session

from app.ai.explanation_ai import generate_explanation
from app.services.backbone_service import get_backbone_context
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.graph import ConceptEdge, ConceptNode
from app.models.user import UserProfile


SUPPORTED_EXPLANATION_STYLES = {"example", "concise", "step"}


# 설명 서비스
#
# 역할:
# - explanation_ai.py가 요구하는 target/user/graph/diagnosis context를 DB에서 조합한다.
# - route가 직접 DB 조회나 AI 호출을 하지 않도록 중간 orchestration 계층을 담당한다.
# - 실제 설명 생성은 explanation_ai.generate_explanation(...)에 위임한다.
def generate_personalized_explanation(
    *,
    project_id: int,
    user_id: int,
    node_id: str | None,
    question: str,
    db: Session,
    explanation_style: str | None = None,
) -> dict:
    target_node = _select_target_node(project_id=project_id, node_id=node_id, db=db)
    final_explanation_style = _resolve_explanation_style(
        user_id=user_id,
        request_style=explanation_style,
        db=db,
    )

    target_concept = {
        "concept_id": target_node.concept_id or target_node.node_id,
        "concept_name": target_node.name,
        "korean_name": "",
        "description": target_node.description or "",
        "group": target_node.group or "",
    }
    user_state = {
        "understanding_score": target_node.understanding_score,
        "understanding_level": target_node.understanding_level,
        "confidence": target_node.confidence,
        "diagnosis_count": target_node.diagnosis_count,
        "status": target_node.status,
    }
    prerequisite_concepts = _build_prerequisite_concepts(
        project_id=project_id,
        node=target_node,
        db=db,
    )
    recent_diagnosis = _build_recent_diagnosis(node=target_node, db=db)
    graph_context = _build_graph_context(
        project_id=project_id,
        node=target_node,
        question=question,
        db=db,
    )
    backbone_context = get_backbone_context(
        subject_id=target_node.subject_id,
        concept_id=target_node.concept_id,
        concept_name=target_node.name,
        user_question=question,
        related_concepts=graph_context.get("related_concepts", []),
        top_k=3,
        max_chars=4000,
    )

    return generate_explanation(
        target_concept=target_concept,
        user_state=user_state,
        prerequisite_concepts=prerequisite_concepts,
        recent_diagnosis=recent_diagnosis,
        graph_context=graph_context,
        backbone_context=backbone_context,
        explanation_style=final_explanation_style,
    )


def _select_target_node(*, project_id: int, node_id: str | None, db: Session) -> ConceptNode:
    if node_id:
        node = (
            db.query(ConceptNode)
            .filter(ConceptNode.project_id == project_id, ConceptNode.node_id == node_id)
            .first()
        )
        if not node:
            raise ValueError("해당 project에서 explanation 대상 ConceptNode를 찾을 수 없습니다.")
        return node

    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    if not nodes:
        raise ValueError("설명 가능한 개념이 없습니다.")

    return sorted(
        nodes,
        key=lambda item: (
            -(1 if item.is_core else 0),
            -(item.core_score or 0.0),
            item.understanding_score if item.understanding_score is not None else 0.5,
        ),
    )[0]


def _resolve_explanation_style(*, user_id: int, request_style: str | None, db: Session) -> str:
    if request_style is not None:
        normalized_request_style = request_style.strip()
        if normalized_request_style not in SUPPORTED_EXPLANATION_STYLES:
            raise ValueError(f"지원하지 않는 explanation_style입니다: {request_style}")
        return normalized_request_style

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    profile_style = None
    if profile and isinstance(profile.preferred_explanation_style, str):
        profile_style = profile.preferred_explanation_style.strip()
    if profile_style in SUPPORTED_EXPLANATION_STYLES:
        return profile_style
    return "step"


def _build_prerequisite_concepts(*, project_id: int, node: ConceptNode, db: Session) -> list[dict]:
    edges = (
        db.query(ConceptEdge)
        .filter(
            ConceptEdge.project_id == project_id,
            ConceptEdge.relation_type == "prerequisite",
            ConceptEdge.edge_source_scope == "uploaded_material",
            ConceptEdge.target_node_id == node.node_id,
        )
        .all()
    )

    prerequisite_nodes = {
        prereq.node_id: prereq
        for prereq in db.query(ConceptNode)
        .filter(ConceptNode.node_id.in_([edge.source_node_id for edge in edges]))
        .all()
    }

    result = []
    for edge in edges:
        prereq = prerequisite_nodes.get(edge.source_node_id)
        if not prereq:
            continue
        result.append(
            {
                "concept_id": prereq.concept_id or prereq.node_id,
                "concept_name": prereq.name,
                "understanding_score": prereq.understanding_score,
                "understanding_level": prereq.understanding_level,
                "relation_type": "prerequisite",
            }
        )
    return result


def _build_recent_diagnosis(*, node: ConceptNode, db: Session) -> list[dict]:
    questions = (
        db.query(DiagnosisQuestion)
        .filter(DiagnosisQuestion.concept_id == node.node_id)
        .order_by(DiagnosisQuestion.created_at.desc())
        .limit(10)
        .all()
    )
    question_ids = [question.question_id for question in questions]
    if not question_ids:
        return []

    answers = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.question_id.in_(question_ids))
        .order_by(DiagnosisAnswer.created_at.desc())
        .limit(3)
        .all()
    )

    result = []
    for answer in answers:
        result.append(
            {
                "question_id": answer.question_id,
                "answer_score": answer.answer_score if answer.answer_score is not None else answer.partial_score,
                "missed_correct_option_ids": _json_loads_list(answer.missed_correct_option_ids),
                "wrong_selected_option_ids": _json_loads_list(answer.wrong_selected_option_ids),
                "feedback_tags": _json_loads_list(answer.feedback_tags),
            }
        )
    return result


def _build_graph_context(*, project_id: int, node: ConceptNode, question: str, db: Session) -> dict:
    edges = (
        db.query(ConceptEdge)
        .filter(
            ConceptEdge.project_id == project_id,
            (ConceptEdge.source_node_id == node.node_id) | (ConceptEdge.target_node_id == node.node_id),
        )
        .all()
    )

    related_node_ids = set()
    for edge in edges:
        if edge.source_node_id == node.node_id:
            related_node_ids.add(edge.target_node_id)
        if edge.target_node_id == node.node_id:
            related_node_ids.add(edge.source_node_id)

    related_nodes = {
        related.node_id: related
        for related in db.query(ConceptNode).filter(ConceptNode.node_id.in_(related_node_ids)).all()
    }

    relations = []
    for edge in edges:
        source_node = related_nodes.get(edge.source_node_id) if edge.source_node_id != node.node_id else node
        target_node = related_nodes.get(edge.target_node_id) if edge.target_node_id != node.node_id else node
        if not source_node or not target_node:
            continue
        relations.append(
            {
                "source_concept_id": source_node.concept_id or source_node.node_id,
                "target_concept_id": target_node.concept_id or target_node.node_id,
                "relation_type": edge.relation_type,
            }
        )

    return {
        "user_question": question,
        "related_concepts": [
            {
                "concept_id": related.concept_id or related.node_id,
                "concept_name": related.name,
            }
            for related in related_nodes.values()
        ],
        "relations": relations,
    }


def _json_loads_list(value: str | None) -> list:
    if not value:
        return []
    try:
        loaded = json.loads(value)
    except json.JSONDecodeError:
        return []
    return loaded if isinstance(loaded, list) else []
