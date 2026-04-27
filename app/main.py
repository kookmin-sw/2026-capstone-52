from fastapi import FastAPI
from app.api.routes import upload, graph, explanation, diagnosis

app = FastAPI(title="이음 API")

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(explanation.router, prefix="/api/explanation", tags=["explanation"])
app.include_router(diagnosis.router, prefix="/api/diagnosis", tags=["diagnosis"])


@app.get("/")
def root():
    return {"message": "이음 API 서버 실행 중"}
