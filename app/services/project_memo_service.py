from sqlalchemy.orm import Session
from app.models.project_memo import ProjectMemo


def get_or_create_project_memo(db: Session, project_id: int):
    memo = db.query(ProjectMemo).filter(ProjectMemo.project_id == project_id).first()

    if memo:
        return memo

    memo = ProjectMemo(project_id=project_id, content="")
    db.add(memo)
    db.commit()
    db.refresh(memo)

    return memo


def update_project_memo(db: Session, project_id: int, content: str):
    memo = get_or_create_project_memo(db, project_id)
    memo.content = content

    db.commit()
    db.refresh(memo)

    return memo
