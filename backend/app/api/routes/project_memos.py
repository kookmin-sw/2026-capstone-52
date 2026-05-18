from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.project_memo import ProjectMemoCreate, ProjectMemoUpdate
from app.services.project_memo_service import (
    create_project_memo,
    delete_project_memo,
    get_project_by_id,
    get_project_memo,
    get_project_memos,
    update_project_memo,
)
from app.utils.response import success_response

router = APIRouter()


def _serialize_memo(memo):
    return {
        "memo_id": memo.memo_id,
        "project_id": memo.project_id,
        "title": memo.title,
        "content": memo.content,
        "created_at": memo.created_at,
        "updated_at": memo.updated_at,
    }


def _ensure_project_exists(db: Session, project_id: int):
    project = get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    return project


def _get_memo_or_404(db: Session, project_id: int, memo_id: int):
    memo = get_project_memo(db, project_id, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="프로젝트 메모를 찾을 수 없습니다.")

    return memo


@router.get("/{project_id}/memos")
def get_project_memos_api(project_id: int, db: Session = Depends(get_db)):
    _ensure_project_exists(db, project_id)
    memos = get_project_memos(db, project_id)

    return success_response([_serialize_memo(memo) for memo in memos], "Memos fetched successfully")


@router.post("/{project_id}/memos")
def create_project_memo_api(
    project_id: int,
    memo_data: ProjectMemoCreate,
    db: Session = Depends(get_db),
):
    _ensure_project_exists(db, project_id)
    memo = create_project_memo(
        db,
        project_id=project_id,
        title=memo_data.title,
        content=memo_data.content or "",
    )

    return success_response(_serialize_memo(memo), "Memo saved successfully")


@router.get("/{project_id}/memos/{memo_id}")
def get_project_memo_api(project_id: int, memo_id: int, db: Session = Depends(get_db)):
    _ensure_project_exists(db, project_id)
    memo = _get_memo_or_404(db, project_id, memo_id)

    return success_response(_serialize_memo(memo), "Memo fetched successfully")


@router.patch("/{project_id}/memos/{memo_id}")
def update_project_memo_api(
    project_id: int,
    memo_id: int,
    memo_data: ProjectMemoUpdate,
    db: Session = Depends(get_db),
):
    _ensure_project_exists(db, project_id)
    memo = _get_memo_or_404(db, project_id, memo_id)
    memo = update_project_memo(
        db,
        memo,
        title=memo_data.title,
        content=memo_data.content,
    )

    return success_response(_serialize_memo(memo), "Memo saved successfully")


@router.delete("/{project_id}/memos/{memo_id}")
def delete_project_memo_api(project_id: int, memo_id: int, db: Session = Depends(get_db)):
    _ensure_project_exists(db, project_id)
    memo = _get_memo_or_404(db, project_id, memo_id)
    delete_project_memo(db, memo)

    return success_response({"memo_id": memo_id, "project_id": project_id}, "Memo deleted successfully")
