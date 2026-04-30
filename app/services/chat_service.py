from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.learning_log import LearningLog
from app.schemas.chat import ChatRequest


def save_chat(
    db: Session,
    project_id: int,
    chat_data: ChatRequest,
    ai_response: str,
):
    chat = Chat(
        user_id=chat_data.user_id,
        project_id=project_id,
        user_message=chat_data.message,
        ai_response=ai_response,
        response_type=chat_data.response_type,
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    log = LearningLog(
        user_id=chat_data.user_id,
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
