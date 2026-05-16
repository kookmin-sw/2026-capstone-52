# 채팅 라우터 — AI 응답 반환, 대화 기록 저장

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_optional_current_user
from app.db.session import get_db
from app.schemas.chat import ChatRequest
from app.models.graph import ConceptNode
from app.models.project import Project
from app.models.user import User, UserProfile
from app.ai.chat_ai import process_chat
from app.services.chat_service import save_chat, get_chats_by_project
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
        {"node_id": n.node_id, "concept_id": n.concept_id, "concept_name": n.name,
         "understanding_score": n.understanding_score}
        for n in nodes
    ]

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    user_state = {"preferred_explanation_style": profile.preferred_explanation_style} if profile else None

    try:
        result = process_chat(
            body.message,
            allowed_concepts=allowed_concepts,
            user_state=user_state,
        )
        ai_reply = result["reply"]
    except NotImplementedError:
        ai_reply = "AI 응답 생성 로직 연결 전입니다."

    chat_log = save_chat(
        db=db,
        project_id=project_id,
        chat_data=body,
        ai_response=ai_reply,
        user_id=user_id,
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


@router.get("/project/{project_id}")
def get_project_chats(project_id: int, db: Session = Depends(get_db)):
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
