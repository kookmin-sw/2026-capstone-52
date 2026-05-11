# 업로드 서비스 — S3 파일 저장 및 DB 메타데이터 관리

import logging
import uuid
import boto3
from sqlalchemy.orm import Session
from app.models.file import File
from app.models.project import Project
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.graph_service import save_graph_from_ai
from app.ai.graph_extractor import extract_graph
from app.ai.concept_normalizer import SUPPORTED_SUBJECT_IDS


logger = logging.getLogger(__name__)


def upload_pdf_to_s3(project_id: str, file, db: Session) -> File:
    """PDF를 S3에 업로드하고 files 테이블에 메타데이터 저장"""
    file_id = str(uuid.uuid4())
    s3_key = f"{project_id}/{file_id}/{file.filename}"
    if settings.use_s3:
        # EC2 IAM Role 환경에서는 boto3가 자동으로 인증 처리 (키 불필요)
        s3 = boto3.client("s3", region_name=settings.aws_region)
        s3.upload_fileobj(file.file, settings.s3_bucket_name, s3_key)

    db_file = File(
        file_id=file_id,
        project_id=project_id,
        file_name=file.filename,
        s3_key=s3_key,
        file_type="pdf",
        analysis_status="UPLOADED",
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


def run_analysis(file_id: str, project_id: str, s3_key: str):
    """백그라운드 분석 태스크 — S3에서 파일 읽어 AI 분석 후 그래프 저장"""
    db = SessionLocal()
    try:
        file_bytes = b""
        if settings.use_s3:
            s3 = boto3.client("s3", region_name=settings.aws_region)
            obj = s3.get_object(Bucket=settings.s3_bucket_name, Key=s3_key)
            file_bytes = obj["Body"].read()

        subject_id = _get_subject_id_for_project(project_id, db)
        ai_result = extract_graph(
            file_bytes,
            subject_id,
            use_llm_normalization=True,
            max_core_concepts=10,
        )
        save_graph_from_ai(project_id, file_id, ai_result, db)
        update_analysis_status(file_id, "DONE", db)
    except Exception as error:
        logger.exception(
            "upload_analysis_failed file_id=%s project_id=%s error=%s",
            file_id,
            project_id,
            str(error),
        )
        update_analysis_status(file_id, "FAILED", db)
    finally:
        db.close()


def get_files_by_project(project_id: str, db: Session) -> list[File]:
    return db.query(File).filter(File.project_id == project_id).all()


def get_file_by_id(file_id: str, db: Session) -> File | None:
    return db.query(File).filter(File.file_id == file_id).first()


def update_analysis_status(file_id: str, status: str, db: Session) -> File | None:
    db_file = db.query(File).filter(File.file_id == file_id).first()
    if db_file:
        db_file.analysis_status = status
        db.commit()
        db.refresh(db_file)
    return db_file


def _get_subject_id_for_project(project_id: str, db: Session) -> str:
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise ValueError(f"Project not found for project_id='{project_id}'.")

    subject_id = (project.project_domain or "").strip()
    if not subject_id:
        raise ValueError(f"Project.project_domain is empty for project_id='{project_id}'.")

    if subject_id not in SUPPORTED_SUBJECT_IDS:
        raise ValueError(
            f"Invalid subject_id/project_domain='{subject_id}' for project_id='{project_id}'."
        )

    return subject_id
