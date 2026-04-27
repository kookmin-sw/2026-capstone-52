from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import upload_service, graph_service
from app.schemas.file import FileResponse

router = APIRouter()


@router.post("/{project_id}")
async def upload_pdf(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")
    db_file = upload_service.upload_pdf_to_s3(project_id, file, db)
    return {"success": True, "data": FileResponse.from_orm(db_file), "message": "업로드 완료"}


@router.get("/{project_id}")
def get_file_list(project_id: str, db: Session = Depends(get_db)):
    files = upload_service.get_files_by_project(project_id, db)
    return {"success": True, "data": [FileResponse.from_orm(f) for f in files], "message": ""}


@router.post("/{file_id}/analyze")
def trigger_analysis(file_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_file = upload_service.get_file_by_id(file_id, db)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    upload_service.update_analysis_status(file_id, "PROCESSING", db)
    # TODO: background_tasks.add_task(ai_analyze_task, file_id, db)
    return {"success": True, "data": None, "message": "분석 시작"}


@router.get("/{file_id}/status")
def get_analysis_status(file_id: str, db: Session = Depends(get_db)):
    db_file = upload_service.get_file_by_id(file_id, db)
    if not db_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return {"success": True, "data": {"status": db_file.analysis_status}, "message": ""}
