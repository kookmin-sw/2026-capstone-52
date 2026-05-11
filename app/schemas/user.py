from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None


class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    profile_image: Optional[str] = None
    preferred_explanation_style: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    email: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None