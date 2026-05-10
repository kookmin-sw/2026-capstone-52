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
    major: Optional[str] = None
    learning_fields: Optional[str] = None
    current_level: Optional[str] = None
    preferred_explanation_style: Optional[str] = None
    learning_goal: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    email: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None