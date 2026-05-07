from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.learning_log import LearningLog
from app.schemas.project import ProjectCreate


def create_project(db: Session, project_data: ProjectCreate):
    new_project = Project(
        user_id=project_data.user_id,
        project_name=project_data.project_name,
        project_description=project_data.project_description,
        project_domain=project_data.project_domain,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    # 프로젝트 생성 시 학습 기록 자동 저장
    log = LearningLog(
        user_id=project_data.user_id,
        project_id=new_project.project_id,
        activity_type="project_created",
        activity_summary=f"{new_project.project_name} 프로젝트를 생성했습니다."
    )

    db.add(log)
    db.commit()

    return new_project


def get_projects_by_user(db: Session, user_id: int):
    return db.query(Project).filter(Project.user_id == user_id).all()
