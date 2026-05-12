# 파일 업로드 라우터 — PDF를 S3에 저장하고 메타데이터를 DB에 기록

from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import upload_service, graph_service
from app.schemas.file import FileResponse

router = APIRouter()


@router.post("/{project_id}")
async def upload_pdf(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """PDF 파일을 S3에 업로드하고 메타데이터를 DB에 저장"""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")
    db_file = upload_service.upload_pdf_to_s3(project_id, file, db)
    return {"success": True, "data": FileResponse.model_validate(db_file), "message": "업로드 완료"}


@router.get("/{project_id}")
def get_file_list(project_id: int, db: Session = Depends(get_db)):
    """프로젝트에 업로드된 파일 목록과 분석 상태 반환"""
    files = upload_service.get_files_by_project(project_id, db)
    return {"success": True, "data": [FileResponse.model_validate(f) for f in files], "message": ""}


@router.post("/{file_id}/analyze")
def trigger_analysis(file_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """AI 분석 트리거 — 상태를 PROCESSING으로 변경하고 백그라운드에서 AI 분석 실행"""
    db_file = upload_service.get_file_by_id(file_id, db)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    upload_service.update_analysis_status(file_id, "PROCESSING", db)
    background_tasks.add_task(upload_service.run_analysis, file_id, db_file.project_id, db_file.s3_key)
    return {"success": True, "data": None, "message": "분석 시작"}


@router.get("/{file_id}/status")
def get_analysis_status(file_id: str, db: Session = Depends(get_db)):
    """분석 진행 상태 반환 (프론트 polling용) — UPLOADED / PROCESSING / DONE / FAILED"""
    db_file = upload_service.get_file_by_id(file_id, db)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return {"success": True, "data": {"status": db_file.analysis_status}, "message": ""}
