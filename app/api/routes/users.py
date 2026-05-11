from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserCreate, UserProfileUpdate, GoogleLoginRequest
from app.services.user_service import create_user, get_user_by_id, get_user_profile, update_user_profile, get_or_create_google_user
from app.utils.response import success_response, error_response

router = APIRouter()

@router.post("/google")
def google_login_api(login_data: GoogleLoginRequest, db: Session = Depends(get_db)):
    user_data = UserCreate(
        email=login_data.email,
        nickname=login_data.nickname,
        profile_image=login_data.profile_image,
    )

    user = get_or_create_google_user(db, user_data)
    profile = get_user_profile(db, user.user_id)

    data = {
        "user_id": user.user_id,
        "email": user.email,
        "nickname": user.nickname,
        "profile_image": user.profile_image,
        "major": profile.major if profile else None,
        "learning_fields": profile.learning_fields if profile else None,
        "current_level": profile.current_level if profile else None,
        "preferred_explanation_style": profile.preferred_explanation_style if profile else None,
        "learning_goal": profile.learning_goal if profile else None,
    }

    return success_response(data, "구글 로그인 성공")

@router.post("/")
def create_user_api(user_data: UserCreate, db: Session = Depends(get_db)):
    user = create_user(db, user_data)

    data = {
        "user_id": user.user_id,
        "email": user.email,
        "nickname": user.nickname,
        "profile_image": user.profile_image,
        "created_at": user.created_at,
    }

    return success_response(data, "사용자가 생성되었습니다.")


@router.get("/{user_id}")
def get_user_api(user_id: int, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    profile = get_user_profile(db, user_id)

    if not user:
        return error_response("사용자를 찾을 수 없습니다.")

    data = {
        "user_id": user.user_id,
        "email": user.email,
        "nickname": user.nickname,
        "profile_image": user.profile_image,
        "major": profile.major if profile else None,
        "learning_fields": profile.learning_fields if profile else None,
        "current_level": profile.current_level if profile else None,
        "preferred_explanation_style": profile.preferred_explanation_style if profile else None,
        "learning_goal": profile.learning_goal if profile else None,
    }

    return success_response(data, "사용자 정보 조회 성공")


@router.patch("/{user_id}")
def update_user_api(user_id: int, update_data: UserProfileUpdate, db: Session = Depends(get_db)):
    result = update_user_profile(db, user_id, update_data)

    if not result:
        return error_response("사용자를 찾을 수 없습니다.")

    user, profile = result

    data = {
        "user_id": user.user_id,
        "email": user.email,
        "nickname": user.nickname,
        "profile_image": user.profile_image,
        "preferred_explanation_style": profile.preferred_explanation_style,
    }

    return success_response(data, "사용자 정보가 수정되었습니다.")
