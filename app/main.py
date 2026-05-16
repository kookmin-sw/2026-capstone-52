# FastAPI 앱 진입점 — 라우터 등록 및 DB 초기화

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.base import Base
from app.db.session import engine

# 모델 파일을 import해야 Base.metadata에 테이블 정보가 등록됨
from app.models import user, project, learning_log, chat, diagnosis, file, graph, project_memo, concept_quiz_counter, deferred_mini_quiz

# 백엔드1 담당 라우터
from app.api.routes import users, projects, learning_logs, mypage, chat as chat_router, project_memos

# 백엔드2 담당 라우터
from app.api.routes import upload, graph as graph_router, explanation, diagnosis as diagnosis_router, mini_quiz as mini_quiz_router

app = FastAPI(title="EEUM Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 서버 시작 시 DB 테이블 자동 생성
Base.metadata.create_all(bind=engine)

# 백엔드1 담당 라우터 등록
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(learning_logs.router, prefix="/api/learning-logs", tags=["learning_logs"])
app.include_router(mypage.router, prefix="/api/mypage", tags=["mypage"])
app.include_router(chat_router.router, prefix="/api/chat", tags=["chat"])
app.include_router(project_memos.router, prefix="/api/projects", tags=["project_memos"])

# 백엔드2 담당 라우터 등록
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(graph_router.router, prefix="/api/graph", tags=["graph"])
app.include_router(explanation.router, prefix="/api/explanation", tags=["explanation"])
app.include_router(diagnosis_router.router, prefix="/api/diagnosis", tags=["diagnosis"])
app.include_router(mini_quiz_router.router, prefix="/api/mini-quiz", tags=["mini_quiz"])


@app.get("/")
def root():
    return {
        "success": True,
        "data": "EEUM backend is running",
        "message": "Server connected successfully"
    }
