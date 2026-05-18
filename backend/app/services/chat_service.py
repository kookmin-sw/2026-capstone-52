import json
import re

from sqlalchemy.orm import Session

from app.models.chat import Chat, ChatSession
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.file import File
from app.models.graph import ConceptEdge, ConceptNode
from app.models.learning_log import LearningLog
from app.models.project import Project
from app.models.user import UserProfile
from app.schemas.chat import ChatRequest
from app.services.backbone_service import get_backbone_context


DEFAULT_CHAT_SESSION_TITLES = {
    "",
    "새 채팅",
    "새 채팅방",
    "기본 채팅방",
    "new chat",
    "untitled",
}
CHAT_SESSION_TITLE_MAX_LENGTH = 25


def save_chat(
    db: Session,
    project_id: int,
    chat_data: ChatRequest,
    ai_response: str,
    user_id: int | None = None,
    session_id: int | None = None,
):
    resolved_user_id = user_id if user_id is not None else chat_data.user_id

    if resolved_user_id is None:
        raise ValueError("user_id가 필요합니다.")

    chat = Chat(
        user_id=resolved_user_id,
        project_id=project_id,
        session_id=session_id,
        user_message=chat_data.message,
        ai_response=ai_response,
        response_type=chat_data.response_type,
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    log = LearningLog(
        user_id=resolved_user_id,
        project_id=project_id,
        activity_type="explanation_requested",
        activity_summary="맞춤 설명을 요청했습니다."
    )

    db.add(log)
    db.commit()

    return chat


def get_chats_by_project(db: Session, project_id: int):
    return (
        db.query(Chat)
        .filter(Chat.project_id == project_id)
        .order_by(Chat.created_at.asc())
        .all()
    )


def create_chat_session(db: Session, project_id: int, title: str = "새 채팅방") -> ChatSession:
    session = ChatSession(project_id=project_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_chat_sessions_by_project(db: Session, project_id: int) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.project_id == project_id)
        .order_by(ChatSession.created_at.asc())
        .all()
    )


def get_chats_by_session(db: Session, project_id: int, session_id: int) -> list[Chat]:
    return (
        db.query(Chat)
        .filter(Chat.project_id == project_id, Chat.session_id == session_id)
        .order_by(Chat.created_at.asc())
        .all()
    )


def get_chat_count_by_session(db: Session, project_id: int, session_id: int) -> int:
    return (
        db.query(Chat)
        .filter(Chat.project_id == project_id, Chat.session_id == session_id)
        .count()
    )


def get_or_create_default_session(db: Session, project_id: int) -> ChatSession:
    """기존 POST /api/chat/{project_id} 호환용 — default session이 없으면 생성"""
    existing = (
        db.query(ChatSession)
        .filter(ChatSession.project_id == project_id, ChatSession.title == "기본 채팅방")
        .first()
    )
    if existing:
        return existing
    return create_chat_session(db, project_id, title="기본 채팅방")


def get_chat_session(db: Session, project_id: int, session_id: int) -> ChatSession | None:
    return (
        db.query(ChatSession)
        .filter(ChatSession.project_id == project_id, ChatSession.id == session_id)
        .first()
    )


def delete_chat_session(db: Session, session: ChatSession) -> None:
    db.query(Chat).filter(Chat.session_id == session.id).delete(synchronize_session=False)
    db.query(File).filter(File.chat_session_id == session.id).update(
        {File.chat_session_id: None},
        synchronize_session=False,
    )
    db.delete(session)
    db.commit()


def maybe_update_chat_session_title_from_message(
    db: Session,
    session: ChatSession,
    message: str,
    *,
    existing_chat_count: int | None = None,
) -> bool:
    """첫 사용자 메시지로 기본 채팅방 제목을 짧게 갱신한다."""
    if not session:
        return False
    if existing_chat_count is None:
        existing_chat_count = get_chat_count_by_session(db, session.project_id, session.id)
    if existing_chat_count > 0:
        return False
    if not _is_default_chat_session_title(session.title):
        return False

    title = generate_chat_session_title(message)
    if not title or title == session.title:
        return False

    session.title = title
    db.commit()
    db.refresh(session)
    return True


def generate_chat_session_title(message: str) -> str:
    """외부 LLM 호출 없이 첫 메시지에서 채팅방 제목을 만든다."""
    if not isinstance(message, str):
        return "새 채팅"

    title = message.replace("\r", " ").replace("\n", " ")
    title = re.sub(r"[\"'`“”‘’]", "", title)
    title = re.sub(r"https?://\S+", "", title)
    title = re.sub(r"[!?.,;:，。？！…~]+", " ", title)
    title = re.sub(r"\s+", " ", title).strip()
    title = title.strip("-_()[]{}<>")

    if not title:
        return "새 채팅"
    if len(title) <= CHAT_SESSION_TITLE_MAX_LENGTH:
        return title

    words = title.split()
    shortened = ""
    for word in words:
        candidate = f"{shortened} {word}".strip()
        if len(candidate) > CHAT_SESSION_TITLE_MAX_LENGTH:
            break
        shortened = candidate

    if len(shortened) >= 8:
        return shortened
    return title[:CHAT_SESSION_TITLE_MAX_LENGTH].rstrip()


def _is_default_chat_session_title(title: str | None) -> bool:
    normalized = (title or "").strip()
    return normalized in DEFAULT_CHAT_SESSION_TITLES or normalized.casefold() in DEFAULT_CHAT_SESSION_TITLES


def build_chat_context(
    *,
    db: Session,
    project_id: int,
    user_id: int,
    session_id: int,
    message: str,
) -> dict:
    """자유 채팅용 grounding context를 DB에서 조합한다.

    원문 업로드 텍스트 저장소가 없으므로 uploaded material context는
    project graph/source metadata와 file metadata를 evidence fallback으로 사용한다.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()
    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()
    files = (
        db.query(File)
        .filter(File.project_id == project_id)
        .order_by(File.uploaded_at.desc())
        .limit(5)
        .all()
    )
    related_concepts = _select_related_concepts(message, nodes)

    uploaded_context = _build_uploaded_context(
        project=project,
        files=files,
        nodes=nodes,
        related_concepts=related_concepts,
    )
    subject_id = project.project_domain if project else None
    backbone_context = ""
    if not _has_sufficient_project_context(related_concepts, nodes):
        backbone_context = get_backbone_context(
            subject_id=subject_id,
            user_question=message,
            related_concepts=related_concepts,
            top_k=3,
            max_chars=3000,
        )

    grounding_metadata = _build_grounding_metadata(
        uploaded_context=uploaded_context,
        backbone_context=backbone_context,
        related_concepts=related_concepts,
    )

    return {
        "allowed_concepts": _build_allowed_concepts(nodes),
        "graph_context": _build_graph_context(nodes, edges),
        "conversation_context": _build_conversation_context(db, project_id, session_id),
        "recent_diagnosis": _build_recent_diagnosis(db, nodes),
        "user_state": _build_user_state(db, user_id),
        "uploaded_context": uploaded_context,
        "backbone_context": backbone_context,
        "grounding_metadata": grounding_metadata,
    }


def _build_allowed_concepts(nodes: list[ConceptNode]) -> list[dict]:
    return [
        {
            "node_id": node.node_id,
            "concept_id": node.concept_id,
            "concept_name": node.name,
            "understanding_score": node.understanding_score,
            "understanding_level": node.understanding_level,
        }
        for node in nodes
    ]


def _build_graph_context(nodes: list[ConceptNode], edges: list[ConceptEdge]) -> dict:
    return {
        "related_concepts": [
            {
                "concept_id": node.concept_id or node.node_id,
                "concept_name": node.name,
                "node_id": node.node_id,
                "description": node.description,
                "group": node.group,
                "understanding_score": node.understanding_score,
                "understanding_level": node.understanding_level,
                "is_core": node.is_core,
                "node_source": node.node_source,
            }
            for node in nodes
        ],
        "relations": [
            {
                "source_concept_id": edge.source_node_id,
                "target_concept_id": edge.target_node_id,
                "relation_type": edge.relation_type,
            }
            for edge in edges
        ],
    }


def _build_conversation_context(
    db: Session,
    project_id: int,
    session_id: int,
    limit: int = 10,
) -> list[dict]:
    recent_chats = (
        db.query(Chat)
        .filter(Chat.project_id == project_id, Chat.session_id == session_id)
        .order_by(Chat.created_at.desc())
        .limit(limit)
        .all()
    )
    conversation_context: list[dict] = []
    for chat_item in reversed(recent_chats):
        conversation_context.append({"role": "user", "content": chat_item.user_message})
        if chat_item.ai_response:
            conversation_context.append({"role": "assistant", "content": chat_item.ai_response})
    return conversation_context


def _build_recent_diagnosis(db: Session, nodes: list[ConceptNode]) -> list[dict]:
    node_ids = [node.node_id for node in nodes]
    if not node_ids:
        return []

    question_ids = [
        row.question_id
        for row in db.query(DiagnosisQuestion.question_id)
        .filter(DiagnosisQuestion.concept_id.in_(node_ids))
        .all()
    ]
    if not question_ids:
        return []

    answers = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.question_id.in_(question_ids))
        .order_by(DiagnosisAnswer.created_at.desc())
        .limit(5)
        .all()
    )
    return [
        {
            "question_id": answer.question_id,
            "answer_score": answer.answer_score,
            "feedback_tags": json.loads(answer.feedback_tags) if answer.feedback_tags else [],
        }
        for answer in answers
    ]


def _build_user_state(db: Session, user_id: int) -> dict:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        return {}

    return {
        "major": profile.major,
        "learning_fields": profile.learning_fields,
        "current_level": profile.current_level,
        "preferred_explanation_style": profile.preferred_explanation_style,
        "learning_goal": profile.learning_goal,
    }


def _select_related_concepts(message: str, nodes: list[ConceptNode], limit: int = 8) -> list[dict]:
    normalized_message = (message or "").casefold()
    matched_nodes = [
        node
        for node in nodes
        if node.name and node.name.casefold() in normalized_message
    ]
    if not matched_nodes:
        matched_nodes = sorted(
            nodes,
            key=lambda node: (
                -(1 if node.is_core else 0),
                -(node.core_score or 0.0),
                node.name or "",
            ),
        )[:limit]

    return [
        {
            "node_id": node.node_id,
            "concept_id": node.concept_id or node.node_id,
            "concept_name": node.name,
            "description": node.description,
            "group": node.group,
            "understanding_score": node.understanding_score,
            "understanding_level": node.understanding_level,
            "is_core": node.is_core,
            "node_source": node.node_source,
        }
        for node in matched_nodes[:limit]
    ]


def _build_uploaded_context(
    *,
    project: Project | None,
    files: list[File],
    nodes: list[ConceptNode],
    related_concepts: list[dict],
) -> str:
    if not nodes and not files:
        return ""

    file_names = [file.file_name for file in files if file.file_name]
    concept_lines = []
    for concept in related_concepts:
        description = f": {concept['description']}" if concept.get("description") else ""
        group = f" / group={concept['group']}" if concept.get("group") else ""
        score = (
            f" / understanding_score={concept['understanding_score']:.2f}"
            if isinstance(concept.get("understanding_score"), (int, float))
            else ""
        )
        concept_lines.append(f"- {concept['concept_name']}{description}{group}{score}")

    return "\n".join(
        [
            "[Project Uploaded Material Context]",
            f"project_domain={project.project_domain if project else ''}",
            f"recent_files={', '.join(file_names[:5]) if file_names else 'none'}",
            "Raw uploaded text is not available; use extracted graph/source metadata as evidence.",
            "related_project_concepts:",
            "\n".join(concept_lines) if concept_lines else "- none",
        ]
    ).strip()


def _has_sufficient_project_context(related_concepts: list[dict], nodes: list[ConceptNode]) -> bool:
    if len(related_concepts) >= 3:
        return True
    return len(nodes) >= 5 and any(concept.get("description") for concept in related_concepts)


def _build_grounding_metadata(
    *,
    uploaded_context: str,
    backbone_context: str,
    related_concepts: list[dict],
) -> dict:
    used_uploaded_context = bool(uploaded_context)
    used_backbone = bool(backbone_context)

    if used_uploaded_context and used_backbone:
        grounding_source = "project_graph+backbone"
    elif used_uploaded_context:
        grounding_source = "project_graph"
    elif used_backbone:
        grounding_source = "backbone"
    else:
        grounding_source = "general"

    if used_uploaded_context and related_concepts:
        grounding_level = "high"
        confidence_note = "프로젝트 그래프와 업로드 자료 기반 메타데이터를 우선 사용했습니다."
    elif used_uploaded_context or used_backbone:
        grounding_level = "medium"
        confidence_note = "프로젝트/백본 컨텍스트를 일부 사용했지만 직접 원문 근거는 제한적입니다."
    else:
        grounding_level = "low"
        confidence_note = "사용 가능한 프로젝트/백본 컨텍스트가 부족해 일반 설명에 가깝습니다."

    return {
        "grounding_source": grounding_source,
        "grounding_level": grounding_level,
        "confidence_note": confidence_note,
        "used_uploaded_context": used_uploaded_context,
        "used_backbone": used_backbone,
    }
