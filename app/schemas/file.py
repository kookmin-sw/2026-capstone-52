from pydantic import BaseModel
from datetime import datetime


class FileResponse(BaseModel):
    file_id: str
    project_id: str
    file_name: str
    s3_key: str
    file_type: str
    uploaded_at: datetime
    analysis_status: str

    class Config:
        from_attributes = True
