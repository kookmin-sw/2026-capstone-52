# DB 세션 설정 — SQLAlchemy 엔진 및 세션 팩토리 생성

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# DB 연결 엔진 생성
# check_same_thread=False: SQLite 사용 시 필요한 옵션 (FastAPI는 멀티스레드)
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI 의존성 주입용 DB 세션 제공 — 요청마다 세션을 열고 종료 후 닫음"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
