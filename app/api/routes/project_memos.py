from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.project_memo import ProjectMemoUpdate
from app.services.project_memo_service import get_or_create_project_memo, update_project_memo
from app.utils.response import success_response

router = APIRouter()


@router.get("/{project_id}/memo")
def get_project_memo_api(project_id: int, db: Session = Depends(get_db)):
    memo = get_or_create_project_memo(db, project_id)

    data = {
        "memo_id": memo.memo_id,
        "project_id": memo.project_id,
        "content": memo.content,
        "created_at": memo.created_at,
        "updated_at": memo.updated_at,
    }

    return success_response(data, "프로젝트 메모 조회 성공")


@router.patch("/{project_id}/memo")
def update_project_memo_api(
    project_id: int,
    memo_data: ProjectMemoUpdate,
    db: Session = Depends(get_db),
):
    memo = update_project_memo(db, project_id, memo_data.content or "")

    data = {
        "memo_id": memo.memo_id,
        "project_id": memo.project_id,
        "content": memo.content,
        "created_at": memo.created_at,
        "updated_at": memo.updated_at,
    }

    return success_response(data, "프로젝트 메모 저장 성공")
