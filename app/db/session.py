# DB 세션 설정 — SQLAlchemy 엔진 및 세션 팩토리 생성

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# SQLite는 FastAPI처럼 여러 요청을 처리하는 환경에서
# 같은 DB 연결을 다른 스레드에서도 사용할 수 있도록
# check_same_thread=False 옵션이 필요하다.
#
# 하지만 PostgreSQL/RDS로 이전할 때는 이 옵션이 필요하지 않으므로,
# database_url이 sqlite로 시작할 때만 connect_args를 적용한다.
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.database_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI 의존성 주입용 DB 세션 제공 — 요청마다 세션을 열고 종료 후 닫음"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
