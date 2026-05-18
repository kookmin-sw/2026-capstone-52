from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class MiniQuizAnswerItem(BaseModel):
    question_id: str
    selected_option_ids: Optional[list[str]] = None
    is_skipped: bool = False


class MiniQuizGroupAnswerRequest(BaseModel):
    question_ids: Optional[list[str]] = None
    answers: list[MiniQuizAnswerItem]


class MiniQuizAnswerRequest(BaseModel):
    # Legacy single-question submit fields.
    question_id: Optional[str] = None
    selected_option_ids: Optional[list[str]] = None
    is_skipped: bool = False

    # New grouped submit fields.
    answers: Optional[list[MiniQuizAnswerItem]] = None
    groups: Optional[list[MiniQuizGroupAnswerRequest]] = None


class MiniQuizDeferRequest(BaseModel):
    question_ids: Optional[list[str]] = None


class MiniQuizAnswerResponse(BaseModel):
    is_fully_correct: Optional[bool] = None
    partial_score: Optional[float] = None
    answer_score: Optional[float] = None
    answer_level: Optional[int] = None
    correct_option_ids: Optional[list[str]] = None
    selected_option_ids: Optional[list[str]] = None
    missed_correct_option_ids: Optional[list[str]] = None
    wrong_selected_option_ids: Optional[list[str]] = None
    invalid_selected_option_ids: Optional[list[str]] = None
    updated_node: Optional[dict] = None
    result_message: Optional[dict] = None
    question_results: Optional[list[dict]] = None
    group_score: Optional[float] = None
    group_result: Optional[dict] = None


class DeferredMiniQuizChoice(BaseModel):
    option_id: str
    text: str


class DeferredMiniQuizItem(BaseModel):
    deferred_id: int
    question_id: str
    node_id: str
    node_name: str
    question: str
    choices: list[DeferredMiniQuizChoice]
    deferred_at: datetime


class DeferredMiniQuizGroup(BaseModel):
    group_id: str
    node_id: str
    node_name: str
    question_ids: list[str]
    questions: list[DeferredMiniQuizItem]
    deferred_at: datetime
