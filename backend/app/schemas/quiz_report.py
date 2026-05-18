from pydantic import BaseModel
from typing import Optional

from app.schemas.quiz_review import QuizQuestionReview


class WeakConceptItem(BaseModel):
    node_id: str
    concept_id: Optional[str] = None
    name: str
    group: Optional[str] = None
    status: Optional[str] = None
    understanding_score: Optional[float] = None
    reason: str


class ConceptScoreItem(BaseModel):
    node_id: str
    concept_id: Optional[str] = None
    name: str
    group: Optional[str] = None
    status: Optional[str] = None
    understanding_score: Optional[float] = None
    understanding_level: Optional[int] = None
    diagnosis_count: Optional[int] = None


class RecommendedLearningPathItem(BaseModel):
    order: int
    node_id: str
    concept_id: Optional[str] = None
    name: str
    reason: str


class RecommendationBasisItem(BaseModel):
    type: str
    description: str


class QuizReport(BaseModel):
    document_summary: str
    weak_concepts: list[WeakConceptItem]
    concept_scores: list[ConceptScoreItem]
    recommended_learning_path: list[RecommendedLearningPathItem]
    recommendation_basis: list[RecommendationBasisItem]
    question_reviews: list[QuizQuestionReview]
