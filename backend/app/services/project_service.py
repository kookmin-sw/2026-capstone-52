import boto3
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat import Chat, ChatSession
from app.models.concept_quiz_counter import ConceptQuizCounter
from app.models.deferred_mini_quiz import DeferredMiniQuiz
from app.models.diagnosis import DiagnosisAnswer, DiagnosisQuestion
from app.models.file import File
from app.models.graph import ConceptEdge, ConceptNode
from app.models.project_memo import ProjectMemo
from app.models.project import Project
from app.models.learning_log import LearningLog
from app.schemas.project import ProjectCreate


SUBJECT_NAME_MAP = {
    "operating_system": "운영체제",
    "data_structure": "자료구조",
    "algorithm": "알고리즘",
    "computer_network": "컴퓨터 네트워크",
}


def create_project(db: Session, project_data: ProjectCreate, user_id: int):
    project_name = SUBJECT_NAME_MAP[project_data.project_domain]

    # 같은 user + domain 조합이 있으면 기존 project 반환 (중복 생성 방지)
    existing = db.query(Project).filter(
        Project.user_id == user_id,
        Project.project_domain == project_data.project_domain,
    ).first()
    if existing:
        return existing

    new_project = Project(
        user_id=user_id,
        project_name=project_name,
        project_description=project_data.project_description,
        project_domain=project_data.project_domain,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    log = LearningLog(
        user_id=user_id,
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


def delete_project(db: Session, project: Project) -> None:
    s3_keys = [
        row.s3_key
        for row in db.query(File.s3_key).filter(File.project_id == project.project_id).all()
        if row.s3_key
    ]
    node_ids = [
        row.node_id
        for row in db.query(ConceptNode.node_id).filter(ConceptNode.project_id == project.project_id).all()
    ]
    question_ids = []
    if node_ids:
        question_ids = [
            row.question_id
            for row in db.query(DiagnosisQuestion.question_id)
            .filter(DiagnosisQuestion.concept_id.in_(node_ids))
            .all()
        ]

    _delete_s3_objects(s3_keys)

    db.query(ProjectMemo).filter(ProjectMemo.project_id == project.project_id).delete(synchronize_session=False)
    db.query(ConceptQuizCounter).filter(ConceptQuizCounter.project_id == project.project_id).delete(synchronize_session=False)
    db.query(DeferredMiniQuiz).filter(DeferredMiniQuiz.project_id == project.project_id).delete(synchronize_session=False)

    if question_ids:
        db.query(DiagnosisAnswer).filter(DiagnosisAnswer.question_id.in_(question_ids)).delete(synchronize_session=False)
        db.query(DiagnosisQuestion).filter(DiagnosisQuestion.question_id.in_(question_ids)).delete(synchronize_session=False)

    db.query(ConceptEdge).filter(ConceptEdge.project_id == project.project_id).delete(synchronize_session=False)
    db.query(ConceptNode).filter(ConceptNode.project_id == project.project_id).delete(synchronize_session=False)
    db.query(File).filter(File.project_id == project.project_id).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.project_id == project.project_id).delete(synchronize_session=False)
    db.query(ChatSession).filter(ChatSession.project_id == project.project_id).delete(synchronize_session=False)
    db.query(LearningLog).filter(LearningLog.project_id == project.project_id).delete(synchronize_session=False)
    db.delete(project)
    db.commit()


def _delete_s3_objects(s3_keys: list[str]) -> None:
    if not settings.use_s3 or not s3_keys:
        return

    s3 = boto3.client("s3", region_name=settings.aws_region)
    for index in range(0, len(s3_keys), 1000):
        batch = s3_keys[index:index + 1000]
        s3.delete_objects(
            Bucket=settings.s3_bucket_name,
            Delete={
                "Objects": [{"Key": key} for key in batch],
                "Quiet": True,
            },
        )
