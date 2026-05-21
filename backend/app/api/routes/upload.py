# 파일 업로드 라우터 — PDF를 S3에 저장하고 메타데이터를 DB에 기록

from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.services import upload_service
from app.schemas.file import FileResponse

router = APIRouter()


def _get_project_or_403(project_id: int, current_user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if project.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="프로젝트 접근 권한이 없습니다.")
    return project


@router.post("/{project_id}")
async def upload_pdf(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """PDF 파일을 S3에 업로드하고 메타데이터를 DB에 저장"""
    _get_project_or_403(project_id, current_user, db)

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")
    db_file = upload_service.upload_pdf_to_s3(project_id, file, db)
    return {"success": True, "data": FileResponse.model_validate(db_file), "message": "업로드 완료"}


@router.get("/{project_id}")
def get_file_list(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """프로젝트에 업로드된 파일 목록과 분석 상태 반환"""
    _get_project_or_403(project_id, current_user, db)

    files = upload_service.get_files_by_project(project_id, db)
    return {"success": True, "data": [FileResponse.model_validate(f) for f in files], "message": ""}


@router.post("/{file_id}/analyze")
def trigger_analysis(
    file_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 분석 트리거 — 상태를 PROCESSING으로 변경하고 백그라운드에서 AI 분석 실행"""
    db_file = upload_service.get_file_by_id(file_id, db)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    _get_project_or_403(db_file.project_id, current_user, db)

    upload_service.update_analysis_status(file_id, "PROCESSING", db)
    background_tasks.add_task(upload_service.run_analysis, file_id, db_file.project_id, db_file.s3_key)
    return {"success": True, "data": None, "message": "분석 시작"}


@router.get("/{file_id}/status")
def get_analysis_status(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """분석 진행 상태 반환 (프론트 polling용) — UPLOADED / PROCESSING / DONE / FAILED"""
    db_file = upload_service.get_file_by_id(file_id, db)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    _get_project_or_403(db_file.project_id, current_user, db)

    return {"success": True, "data": {"status": db_file.analysis_status}, "message": ""}
