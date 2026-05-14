from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.learning_log import LearningLog
from app.schemas.project import ProjectCreate


SUBJECT_NAME_MAP = {
    "operating_system": "운영체제",
    "data_structure": "자료구조",
    "algorithm": "알고리즘",
    "computer_network": "컴퓨터 네트워크",
}


def create_project(db: Session, project_data: ProjectCreate, user_id: int | None = None):
    project_name = SUBJECT_NAME_MAP[project_data.project_domain]
    resolved_user_id = user_id if user_id is not None else project_data.user_id

    if resolved_user_id is None:
        raise ValueError("user_id가 필요합니다.")

    new_project = Project(
        user_id=resolved_user_id,
        project_name=project_name,
        project_description=project_data.project_description,
        project_domain=project_data.project_domain,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    log = LearningLog(
        user_id=resolved_user_id,
        project_id=new_project.project_id,
        activity_type="project_created",
        activity_summary=f"{new_project.project_name} 프로젝트를 생성했습니다."
    )

    db.add(log)
    db.commit()

    return new_project


def get_projects_by_user(db: Session, user_id: int):
    return db.query(Project).filter(Project.user_id == user_id).all()


def get_project_by_id(db: Session, project_id: int):
    return db.query(Project).filter(Project.project_id == project_id).first()


def is_project_owned_by_user(db: Session, project_id: int, user_id: int):
    return (
        db.query(Project)
        .filter(Project.project_id == project_id, Project.user_id == user_id)
        .first()
        is not None
    )
