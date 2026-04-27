import uuid
import boto3
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.models.file import File
from app.core.config import settings


def upload_pdf_to_s3(project_id: str, file: UploadFile, db: Session) -> File:
    s3 = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    file_id = str(uuid.uuid4())
    s3_key = f"{project_id}/{file_id}/{file.filename}"
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
