from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.mypage_service import get_mypage_data
from app.utils.response import success_response, error_response

router = APIRouter()


def _build_mypage_response(result):
    user = result["user"]
    profile = result["profile"]

    if not user:
        return None

    return {
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "nickname": user.nickname,
            "profile_image": user.profile_image,
            "major": profile.major if profile else None,
            "learning_fields": profile.learning_fields if profile else None,
            "current_level": profile.current_level if profile else None,
            "preferred_explanation_style": profile.preferred_explanation_style if profile else None,
            "learning_goal": profile.learning_goal if profile else None,
        },
        "summary": {
            "project_count": result["project_count"],
            "recent_learning_count": len(result["recent_logs"])
        },
        "recent_projects": [
            {
                "project_id": p.project_id,
                "project_name": p.project_name,
                "project_domain": p.project_domain,
                "created_at": p.created_at,
            }
            for p in result["recent_projects"]
        ],
        "recent_logs": [
            {
                "activity_id": l.activity_id,
                "project_id": l.project_id,
                "activity_type": l.activity_type,
                "activity_summary": l.activity_summary,
                "created_at": l.created_at,
            }
            for l in result["recent_logs"]
        ]
    }


@router.get("/me")
def get_my_mypage_api(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = get_mypage_data(db, current_user.user_id)
    data = _build_mypage_response(result)

    if not data:
        return error_response("사용자를 찾을 수 없습니다.")

    return success_response(data, "마이페이지 조회 성공")


@router.get("/{user_id}")
def get_mypage_api(user_id: int, db: Session = Depends(get_db)):
    result = get_mypage_data(db, user_id)
    data = _build_mypage_response(result)

    if not data:
        return error_response("사용자를 찾을 수 없습니다.")

    return success_response(data, "마이페이지 조회 성공")
