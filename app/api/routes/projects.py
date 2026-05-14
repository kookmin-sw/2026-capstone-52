from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.project import ProjectCreate
from app.services.project_service import create_project, get_projects_by_user
from app.utils.response import success_response

router = APIRouter()


@router.post("/")
def create_project_api(
    project_data: ProjectCreate,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.user_id if current_user else project_data.user_id

    if user_id is None:
        raise HTTPException(status_code=400, detail="user_id 또는 인증 토큰이 필요합니다.")

    project = create_project(db, project_data, user_id=user_id)

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
