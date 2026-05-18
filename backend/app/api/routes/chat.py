# 채팅 라우터 — AI 응답 반환, 대화 기록 저장

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatSessionCreate, ChatSessionResponse
from app.models.project import Project
from app.models.user import User
from app.ai.chat_ai import process_chat
from app.services.chat_service import (
    build_chat_context,
    save_chat,
    get_chats_by_project,
    create_chat_session,
    get_chat_sessions_by_project,
    get_chats_by_session,
    get_chat_session,
    get_or_create_default_session,
)
from app.services.concept_quiz_counter_service import (
    TURN_CHECK_INTERVAL,
    SLIDING_WINDOW_ASSISTANT_MESSAGES,
    get_recent_assistant_messages,
    get_project_turn_count,
    get_sliding_window_quiz_ready_concepts,
)
from app.utils.response import success_response

router = APIRouter()


@router.post("/{project_id}")
def chat(
    project_id: int,
    body: ChatRequest,
    session_id: int | None = None,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    채팅 메시지 처리
    - AI 응답 생성
    - 질문/답변 대화 기록 저장
    - learning_logs 자동 기록
    """
    user_id = current_user.user_id if current_user else body.user_id

    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id 또는 인증 토큰이 필요합니다.")

    if current_user:
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
        if project.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    if session_id:
        chat_session = get_chat_session(db, project_id, session_id)
        if not chat_session:
            raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    else:
        # 기존 API 호환: session_id 없이 호출하면 기본 채팅방 기준으로 처리
        chat_session = get_or_create_default_session(db, project_id)
    resolved_session_id = chat_session.id

    chat_context = build_chat_context(
        db=db,
        project_id=project_id,
        user_id=user_id,
        session_id=resolved_session_id,
        message=body.message,
    )

    try:
        result = process_chat(
            body.message,
            allowed_concepts=chat_context["allowed_concepts"],
            user_state=chat_context["user_state"],
            graph_context=chat_context["graph_context"],
            conversation_context=chat_context["conversation_context"],
            recent_diagnosis=chat_context["recent_diagnosis"],
            uploaded_context=chat_context["uploaded_context"],
            backbone_context=chat_context["backbone_context"],
            grounding_metadata=chat_context["grounding_metadata"],
        )
        ai_reply = result["reply"]
    except NotImplementedError:
        ai_reply = "AI 응답 생성 로직 연결 전입니다."
        result = {
            "grounding_source": chat_context["grounding_metadata"]["grounding_source"],
            "grounding_level": chat_context["grounding_metadata"]["grounding_level"],
            "confidence_note": chat_context["grounding_metadata"]["confidence_note"],
            "used_uploaded_context": chat_context["grounding_metadata"]["used_uploaded_context"],
            "used_backbone": chat_context["grounding_metadata"]["used_backbone"],
        }

    chat_log = save_chat(
        db=db,
        project_id=project_id,
        chat_data=body,
        ai_response=ai_reply,
        user_id=user_id,
        session_id=resolved_session_id,
    )
    turn_count = get_project_turn_count(db, project_id)
    recent_assistant_messages = get_recent_assistant_messages(
        db=db,
        project_id=project_id,
        session_id=resolved_session_id,
        limit=SLIDING_WINDOW_ASSISTANT_MESSAGES,
    )
    should_check_quiz = len(recent_assistant_messages) >= SLIDING_WINDOW_ASSISTANT_MESSAGES
    quiz_ready_concepts = get_sliding_window_quiz_ready_concepts(
        db=db,
        project_id=project_id,
        session_id=resolved_session_id,
    )
    mini_quiz_trigger_concepts = [
        {
            "concept_id": concept.concept_id,
            "node_id": concept.node_id,
            "name": concept.name,
            "mention_count": concept.mention_count,
        }
        for concept in quiz_ready_concepts
    ]

    data = {
        "chat_id": chat_log.chat_id,
        "session_id": resolved_session_id,
        "user_id": chat_log.user_id,
        "project_id": chat_log.project_id,
        "user_message": chat_log.user_message,
        "ai_response": chat_log.ai_response,
        "response_type": chat_log.response_type,
        "mini_quiz_trigger": {
            "needed": bool(mini_quiz_trigger_concepts),
            "concepts": mini_quiz_trigger_concepts,
        },
        "grounding": {
            "grounding_source": result.get("grounding_source", chat_context["grounding_metadata"]["grounding_source"]),
            "grounding_level": result.get("grounding_level", chat_context["grounding_metadata"]["grounding_level"]),
            "confidence_note": result.get("confidence_note", chat_context["grounding_metadata"]["confidence_note"]),
            "used_uploaded_context": result.get("used_uploaded_context", chat_context["grounding_metadata"]["used_uploaded_context"]),
            "used_backbone": result.get("used_backbone", chat_context["grounding_metadata"]["used_backbone"]),
        },
        "concept_counting": {
            "turn_count": turn_count,
            "check_interval": TURN_CHECK_INTERVAL,
            "window_size": SLIDING_WINDOW_ASSISTANT_MESSAGES,
            "should_check_quiz": should_check_quiz,
            "counted_concepts": mini_quiz_trigger_concepts,
            "quiz_ready_concepts": [
                {
                    "concept_id": concept.concept_id,
                    "node_id": concept.node_id,
                    "name": concept.name,
                    "mention_count": concept.mention_count,
                }
                for concept in quiz_ready_concepts
            ],
        },
        "created_at": chat_log.created_at,
    }

    return success_response(data, "채팅 응답 및 기록 저장 성공")


@router.get("/{project_id}/sessions/{session_id}")
def get_session_chats(
    project_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """특정 세션의 채팅 기록 조회"""
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    chats = get_chats_by_session(db, project_id, session_id)
    data = [
        {
            "chat_id": chat.chat_id,
            "session_id": chat.session_id,
            "user_message": chat.user_message,
            "ai_response": chat.ai_response,
            "response_type": chat.response_type,
            "created_at": chat.created_at,
        }
        for chat in chats
    ]
    return success_response(data, "세션 채팅 기록 조회 성공")


@router.get("/project/{project_id}")
def get_project_chats(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    chats = get_chats_by_project(db, project_id)

    data = [
        {
            "chat_id": chat.chat_id,
            "user_id": chat.user_id,
            "project_id": chat.project_id,
            "user_message": chat.user_message,
            "ai_response": chat.ai_response,
            "response_type": chat.response_type,
            "created_at": chat.created_at,
        }
        for chat in chats
    ]

    return success_response(data, "프로젝트 대화 기록 조회 성공")
