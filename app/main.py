from fastapi import FastAPI

from app.db.base import Base
from app.db.session import engine
from app.models import user, project, learning_log
from app.api.routes import users, projects, learning_logs, mypage

app = FastAPI(title="EEUM Backend")

Base.metadata.create_all(bind=engine)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(learning_logs.router, prefix="/api/learning-logs", tags=["learning_logs"])
app.include_router(mypage.router, prefix="/api/mypage", tags=["mypage"])


@app.get("/")
def root():
    return {
        "success": True,
        "data": "EEUM backend is running",
        "message": "Server connected successfully"
    }
