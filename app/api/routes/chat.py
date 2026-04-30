from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.chat import ChatRequest
from app.services.chat_service import save_chat, get_chats_by_project
from app.utils.response import success_response

router = APIRouter()


@router.post("/{project_id}")
def chat(project_id: int, body: ChatRequest, db: Session = Depends(get_db)):
    """
    채팅 메시지 처리
    - 현재는 대화 기록 저장 중심
    - 추후 백엔드2/AI 로직과 연결하여 AI 응답 및 그래프 업데이트 처리
    """

    # TODO: 백엔드2 AI 응답 생성 로직과 연결 예정
    ai_reply = "AI 응답 생성 로직 연결 전입니다."

    chat_log = save_chat(
        db=db,
        project_id=project_id,
        chat_data=body,
        ai_response=ai_reply,
    )

    data = {
        "chat_id": chat_log.chat_id,
        "user_id": chat_log.user_id,
        "project_id": chat_log.project_id,
        "user_message": chat_log.user_message,
        "ai_response": chat_log.ai_response,
        "response_type": chat_log.response_type,
        "updated_nodes": [],
        "created_at": chat_log.created_at,
    }

    return success_response(data, "대화 기록이 저장되었습니다.")


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
