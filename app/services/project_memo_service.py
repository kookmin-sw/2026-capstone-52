from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.project_memo import ProjectMemo


def get_project_by_id(db: Session, project_id: int):
    return db.query(Project).filter(Project.project_id == project_id).first()


def get_project_memos(db: Session, project_id: int):
    return (
        db.query(ProjectMemo)
        .filter(ProjectMemo.project_id == project_id)
        .order_by(ProjectMemo.updated_at.desc(), ProjectMemo.created_at.desc())
        .all()
    )


def create_project_memo(db: Session, project_id: int, title: str, content: str = ""):
    memo = ProjectMemo(
        project_id=project_id,
        title=title,
        content=content,
    )
    db.add(memo)
    db.commit()
    db.refresh(memo)

    return memo


def get_project_memo(db: Session, project_id: int, memo_id: int):
    return (
        db.query(ProjectMemo)
        .filter(ProjectMemo.project_id == project_id, ProjectMemo.memo_id == memo_id)
        .first()
    )


def update_project_memo(db: Session, memo: ProjectMemo, title: str | None = None, content: str | None = None):
    if title is not None:
        memo.title = title

    if content is not None:
        memo.content = content

    db.commit()
    db.refresh(memo)

    return memo


def delete_project_memo(db: Session, memo: ProjectMemo):
    db.delete(memo)
    db.commit()
