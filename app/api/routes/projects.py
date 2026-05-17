from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.project import ProjectCreate
from app.models.project import Project
from app.schemas.chat import ChatSessionCreate, ChatSessionResponse
from app.services.project_service import create_project, delete_project, get_projects_by_user
from app.services.chat_service import create_chat_session, get_chat_sessions_by_project
from app.utils.response import success_response

router = APIRouter()


@router.post("/")
def create_project_api(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = create_project(db, project_data, user_id=current_user.user_id)

    data = {
        "project_id": project.project_id,
        "user_id": project.user_id,
        "project_name": project.project_name,
        "project_description": project.project_description,
        "project_domain": project.project_domain,
        "created_at": project.created_at,
    }

    return success_response(data, "프로젝트가 생성되었습니다.")


@router.get("/me")
def get_my_projects_api(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = get_projects_by_user(db, current_user.user_id)

    data = [
        {
            "project_id": project.project_id,
            "user_id": project.user_id,
            "project_name": project.project_name,
            "project_description": project.project_description,
            "project_domain": project.project_domain,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "last_accessed_at": project.last_accessed_at,
        }
        for project in projects
    ]

    return success_response(data, "프로젝트 목록 조회 성공")


@router.delete("/{project_id}")
def delete_project_api(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    delete_project(db, project)
    return success_response({"project_id": project_id}, "프로젝트가 삭제되었습니다.")


@router.post("/{project_id}/chat-sessions", response_model=None)
def create_session_api(
    project_id: int,
    body: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """프로젝트에 새 채팅 세션(채팅방) 생성"""
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    session = create_chat_session(db, project_id, title=body.title or "새 채팅방")
    return success_response(ChatSessionResponse.model_validate(session), "채팅 세션 생성 성공")


@router.get("/{project_id}/chat-sessions", response_model=None)
def list_sessions_api(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """프로젝트의 채팅 세션 목록 조회"""
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")

    sessions = get_chat_sessions_by_project(db, project_id)
    return success_response(
        [ChatSessionResponse.model_validate(s) for s in sessions],
        "채팅 세션 목록 조회 성공",
    )


@router.get("/user/{user_id}")
def get_projects_api(user_id: int, db: Session = Depends(get_db)):
    projects = get_projects_by_user(db, user_id)

    data = [
        {
            "project_id": project.project_id,
            "user_id": project.user_id,
            "project_name": project.project_name,
            "project_description": project.project_description,
            "project_domain": project.project_domain,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "last_accessed_at": project.last_accessed_at,
        }
        for project in projects
    ]

    return success_response(data, "프로젝트 목록 조회 성공")
