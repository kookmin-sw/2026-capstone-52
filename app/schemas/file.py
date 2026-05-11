from pydantic import BaseModel, ConfigDict
from datetime import datetime


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: str
    project_id: str
    file_name: str
    s3_key: str
    file_type: str
    uploaded_at: datetime
    analysis_status: str
