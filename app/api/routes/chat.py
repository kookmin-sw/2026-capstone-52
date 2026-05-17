# 채팅 라우터 — AI 응답 반환, 대화 기록 저장

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatSessionCreate, ChatSessionResponse
from app.models.chat import Chat
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.graph import ConceptNode, ConceptEdge
from app.models.project import Project
from app.models.user import User, UserProfile
from app.ai.chat_ai import process_chat
from app.services.chat_service import (
    save_chat,
    get_chats_by_project,
    create_chat_session,
    get_chat_sessions_by_project,
    get_chats_by_session,
    get_or_create_default_session,
)
from app.services.concept_quiz_counter_service import (
    TURN_CHECK_INTERVAL,
    get_project_turn_count,
    get_quiz_ready_concepts,
    record_ai_response_concept_counts,
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

    nodes = db.query(ConceptNode).filter(ConceptNode.project_id == project_id).all()
    allowed_concepts = [
        {
            "node_id": n.node_id,
            "concept_id": n.concept_id,
            "concept_name": n.name,
            "understanding_score": n.understanding_score,
            "understanding_level": n.understanding_level,
        }
        for n in nodes
    ]

    edges = db.query(ConceptEdge).filter(ConceptEdge.project_id == project_id).all()
    graph_context = {
        "related_concepts": [
            {"concept_id": n.concept_id or n.node_id, "concept_name": n.name}
            for n in nodes
        ],
        "relations": [
            {
                "source_concept_id": e.source_node_id,
                "target_concept_id": e.target_node_id,
                "relation_type": e.relation_type,
            }
            for e in edges
        ],
    }

    # session_id가 있으면 해당 세션 대화만, 없으면 project 전체 최근 10개
    chat_filter = [Chat.project_id == project_id]
    if session_id:
        chat_filter.append(Chat.session_id == session_id)
    recent_chats = (
        db.query(Chat)
        .filter(*chat_filter)
        .order_by(Chat.created_at.desc())
        .limit(10)
        .all()
    )
    conversation_context: list[dict] = []
    for chat_item in reversed(recent_chats):
        conversation_context.append({"role": "user", "content": chat_item.user_message})
        if chat_item.ai_response:
            conversation_context.append({"role": "assistant", "content": chat_item.ai_response})

    node_ids = [n.node_id for n in nodes]
    q_ids = [
        row.question_id
        for row in db.query(DiagnosisQuestion.question_id)
        .filter(DiagnosisQuestion.concept_id.in_(node_ids))
        .all()
    ]
    recent_answers = (
        db.query(DiagnosisAnswer)
        .filter(DiagnosisAnswer.question_id.in_(q_ids))
        .order_by(DiagnosisAnswer.created_at.desc())
        .limit(5)
        .all()
    ) if q_ids else []
    recent_diagnosis = [
        {
            "question_id": a.question_id,
            "answer_score": a.answer_score,
            "feedback_tags": json.loads(a.feedback_tags) if a.feedback_tags else [],
        }
        for a in recent_answers
    ]

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    user_state = {"preferred_explanation_style": profile.preferred_explanation_style} if profile else None

    try:
        result = process_chat(
            body.message,
            allowed_concepts=allowed_concepts,
            user_state=user_state,
            graph_context=graph_context,
            conversation_context=conversation_context,
            recent_diagnosis=recent_diagnosis,
        )
        ai_reply = result["reply"]
    except NotImplementedError:
        ai_reply = "AI 응답 생성 로직 연결 전입니다."

    # session_id 없으면 default 세션에 저장 (기존 API 호환)
    resolved_session_id = session_id or get_or_create_default_session(db, project_id).id
    chat_log = save_chat(
        db=db,
        project_id=project_id,
        chat_data=body,
        ai_response=ai_reply,
        user_id=user_id,
        session_id=resolved_session_id,
    )
    counted_concepts = record_ai_response_concept_counts(
        db=db,
        project_id=project_id,
        ai_response=ai_reply,
        chat_id=chat_log.chat_id,
    )
    turn_count = get_project_turn_count(db, project_id)
    should_check_quiz = turn_count > 0 and turn_count % TURN_CHECK_INTERVAL == 0
    quiz_ready_concepts = get_quiz_ready_concepts(db, project_id) if should_check_quiz else []

    data = {
        "chat_id": chat_log.chat_id,
        "user_id": chat_log.user_id,
        "project_id": chat_log.project_id,
        "user_message": chat_log.user_message,
        "ai_response": chat_log.ai_response,
        "response_type": chat_log.response_type,
        "concept_counting": {
            "turn_count": turn_count,
            "check_interval": TURN_CHECK_INTERVAL,
            "should_check_quiz": should_check_quiz,
            "counted_concepts": [
                {
                    "node_id": concept.node_id,
                    "name": concept.name,
                    "mention_count": concept.mention_count,
                }
                for concept in counted_concepts
            ],
            "quiz_ready_concepts": [
                {
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
