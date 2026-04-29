# FastAPI 앱 진입점 — 라우터 등록 및 DB 초기화

from fastapi import FastAPI
from app.api.routes import upload, graph, explanation, diagnosis, chat
from app.db.session import engine
from app.db.base import Base

# 모델 파일을 import해야 Base.metadata에 테이블 정보가 등록됨
import app.models

# 서버 시작 시 DB 테이블 자동 생성 (없는 경우에만 생성)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="이음 API")

# 백엔드2 담당 라우터 등록
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(explanation.router, prefix="/api/explanation", tags=["explanation"])
app.include_router(diagnosis.router, prefix="/api/diagnosis", tags=["diagnosis"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.get("/")
def root():
    return {"message": "이음 API 서버 실행 중"}
