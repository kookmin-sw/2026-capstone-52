from pydantic import BaseModel
from typing import Optional


class QuizChoiceReview(BaseModel):
    option_id: str
    text: str
    is_correct: bool
    is_selected: bool


class QuizQuestionReview(BaseModel):
    question_id: str
    concept_id: str
    question: str
    choices: list[QuizChoiceReview]
    correct_option_ids: list[str]
    selected_option_ids: list[str]
    is_fully_correct: Optional[bool] = None
    partial_score: Optional[float] = None
    answer_score: Optional[float] = None
    explanation: Optional[str] = None
