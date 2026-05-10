# files 테이블 — PDF 파일 메타데이터 저장 (파일 원본은 S3에 저장)

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class File(Base):
    __tablename__ = "files"

    file_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)   # 원본 파일명
    s3_key: Mapped[str] = mapped_column(String, nullable=False)       # S3 저장 경로
    file_type: Mapped[str] = mapped_column(String, default="pdf")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    analysis_status: Mapped[str] = mapped_column(String, default="UPLOADED")
    # 분석 상태: UPLOADED → PROCESSING → DONE / FAILED
