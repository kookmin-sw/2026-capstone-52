from sqlalchemy.orm import Session
from app.models.user import User, UserProfile
from app.schemas.user import UserCreate, UserProfileUpdate


def create_user(db: Session, user_data: UserCreate):
    user = User(
        email=user_data.email,
        nickname=user_data.nickname,
        profile_image=user_data.profile_image,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = UserProfile(user_id=user.user_id)
    db.add(profile)
    db.commit()

    return user


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_profile(db: Session, user_id: int):
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()


def update_user_profile(db: Session, user_id: int, update_data: UserProfileUpdate):
    user = get_user_by_id(db, user_id)
    profile = get_user_profile(db, user_id)

    if not user:
        return None

    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    data = update_data.model_dump(exclude_unset=True)

    for key, value in data.items():
        if hasattr(user, key):
            setattr(user, key, value)
        elif hasattr(profile, key):
            setattr(profile, key, value)

    db.commit()
    db.refresh(user)
    db.refresh(profile)

    return user, profile

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_or_create_google_user(db: Session, user_data: UserCreate):
    user = get_user_by_email(db, user_data.email)

    if user:
        profile = get_user_profile(db, user.user_id)
        if not profile:
            profile = UserProfile(user_id=user.user_id)
            db.add(profile)
            db.commit()
        return user

    return create_user(db, user_data)