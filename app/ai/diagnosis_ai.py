import json
import logging
from typing import Any

from app.ai.llm_client import LLMClientError, call_llm_json


# 진단 AI / 헬퍼 모듈
#
# 역할:
# - LLM으로 teacher-side multi-select 진단 문항을 생성한다.
# - 사용자 답안을 deterministic code로 채점한다.
# - DB, route, service에 의존하지 않고 standalone helper로 동작한다.
# - 기존 diagnosis_service.py의 import 안정성을 위해 legacy calculate_score 호환 함수도 제공한다.
logger = logging.getLogger(__name__)

QUESTION_TYPE_MULTI_SELECT = "multi_select"
OPTION_IDS = ["A", "B", "C", "D", "E"]
DEFAULT_AFFECTS_FALLBACK = "concept_check"
SUPPORTED_SUBJECT_IDS = {
    "operating_system",
    "data_structure",
    "computer_network",
    "algorithm",
}


class DiagnosisAIError(Exception):
    """Base exception for diagnosis AI failures."""


class QuestionGenerationError(DiagnosisAIError):
    """Raised when LLM-based question generation fails."""


class QuestionValidationError(DiagnosisAIError):
    """Raised when a generated or provided question payload is invalid."""


class AnswerEvaluationError(DiagnosisAIError):
    """Raised when a question cannot be evaluated safely."""


# 질문 생성 공개 함수
#
# 역할:
# - target concept를 기준으로 multi-select 진단 문항을 생성한다.
# - LLM은 문항 초안을 만들고, Python 쪽에서 구조 검증과 reuse_key 생성을 담당한다.
# - teacher-side payload를 반환하며 정답 정보는 포함한다.
# - old route의 generate_question(node_list) 호출은 fake fallback 없이 명시적 에러로 막는다.
def generate_question(
    target_concept: dict | list,
    graph_context: dict | None = None,
    *,
    subject_id: str | None = None,
    diagnosis_purpose: str = "concept_check",
    question_difficulty: str = "medium",
    previous_reuse_keys: list[str] | None = None,
    preferred_correct_count: int | None = None,
) -> dict[str, Any]:
    if isinstance(target_concept, list):
        raise QuestionGenerationError(
            "Legacy generate_question(node_list) 호출은 더 이상 지원되지 않습니다. "
            "Use generate_question(target_concept=..., subject_id=...) instead."
        )

    if not isinstance(target_concept, dict):
        raise QuestionGenerationError("target_concept must be a dict.")

    if not subject_id:
        raise QuestionGenerationError("subject_id is required for diagnosis question generation.")
    if subject_id not in SUPPORTED_SUBJECT_IDS:
        raise QuestionGenerationError(f"Unsupported subject_id: {subject_id}")

    concept_id = _require_non_empty_string(target_concept.get("concept_id"), "target_concept.concept_id")
    concept_name = _require_non_empty_string(
        target_concept.get("concept_name") or target_concept.get("name"),
        "target_concept.concept_name",
    )

    system_prompt = (
        "You are an expert CS diagnosis question generator. "
        "Create exactly one teacher-side multi-select question. "
        "Return JSON only. "
        "Create exactly 5 choices with option_id values A, B, C, D, E. "
        "At least 1 choice must be correct. Not all choices can be correct. "
        "Prefer 2 or 3 correct choices unless pedagogically inappropriate. "
        "Include explanation for every choice. "
        "Include diagnostic_tag for every choice. "
        "Include target_concept_id and misconception_type for every choice. "
        "Include diagnostic_tags, tag_group, affects, and llm_reason. "
        "Do not build reuse_key."
    )
    user_prompt = json.dumps(
        {
            "subject_id": subject_id,
            "target_concept": target_concept,
            "graph_context": graph_context,
            "diagnosis_purpose": diagnosis_purpose,
            "question_difficulty": question_difficulty,
            "preferred_correct_count": preferred_correct_count,
            "previous_reuse_keys": previous_reuse_keys or [],
            "required_output": {
                "question_text": "string",
                "choices": [
                    {
                        "option_id": "A",
                        "text": "string",
                        "is_correct": True,
                        "diagnostic_tag": "string",
                        "target_concept_id": concept_id,
                        "misconception_type": None,
                        "explanation": "string",
                    }
                ],
                "diagnostic_tags": ["string"],
                "tag_group": "string",
                "affects": [concept_id],
                "llm_reason": "string",
            },
        },
        ensure_ascii=False,
    )

    try:
        llm_result = call_llm_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            task_name="diagnosis_ai_generate_question",
            temperature=0.2,
            max_tokens=2500,
        )
    except LLMClientError as error:
        raise QuestionGenerationError(f"Diagnosis question generation failed: {error}") from error

    teacher_question = {
        "concept_id": concept_id,
        "concept_name": concept_name,
        "subject_id": subject_id,
        "question_type": QUESTION_TYPE_MULTI_SELECT,
        "diagnosis_purpose": diagnosis_purpose,
        "question_difficulty": question_difficulty,
        "question_text": llm_result.get("question_text"),
        "choices": llm_result.get("choices"),
        "correct_option_ids": llm_result.get("correct_option_ids"),
        "diagnostic_tags": llm_result.get("diagnostic_tags"),
        "tag_group": llm_result.get("tag_group"),
        "affects": llm_result.get("affects"),
        "llm_reason": llm_result.get("llm_reason"),
    }
<<<<<<< HEAD

    validated_question = validate_question_payload(
        teacher_question,
        expected_concept_id=concept_id,
        previous_reuse_keys=previous_reuse_keys,
    )
    logger.info(
        "diagnosis_question_generated subject_id=%s concept_id=%s difficulty=%s tag_group=%s",
        subject_id,
        concept_id,
        question_difficulty,
        validated_question["tag_group"],
    )
    return validated_question


# 답안 평가 공개 함수
#
# 역할:
# - multi-select 답안을 deterministic code로 채점한다.
# - LLM은 호출하지 않는다.
# - partial score, missed/wrong 선택지, feedback tag를 함께 반환한다.
def evaluate_answer(
    question: dict,
    selected_option_ids: list[str],
) -> dict[str, Any]:
    try:
        validated_question = validate_question_payload(question)
    except QuestionValidationError as error:
        raise AnswerEvaluationError(f"Cannot evaluate malformed question: {error}") from error

    all_option_ids = [choice["option_id"] for choice in validated_question["choices"]]
    valid_selected_option_ids, invalid_selected_option_ids = sanitize_selected_option_ids(
        selected_option_ids,
        all_option_ids,
    )

    correct_option_ids = validated_question["correct_option_ids"]
    correct_selected_option_ids = [option_id for option_id in valid_selected_option_ids if option_id in correct_option_ids]
    missed_correct_option_ids = [option_id for option_id in correct_option_ids if option_id not in valid_selected_option_ids]
    wrong_selected_option_ids = [option_id for option_id in valid_selected_option_ids if option_id not in correct_option_ids]

    partial_score = calculate_partial_score(
        valid_selected_option_ids,
        correct_option_ids,
        all_option_ids,
    )
    answer_score = partial_score
    is_fully_correct = set(valid_selected_option_ids) == set(correct_option_ids)
    answer_level = score_to_level(answer_score)

    return {
        "selected_option_ids": list(selected_option_ids),
        "valid_selected_option_ids": valid_selected_option_ids,
        "invalid_selected_option_ids": invalid_selected_option_ids,
        "correct_option_ids": correct_option_ids,
        "correct_selected_option_ids": correct_selected_option_ids,
        "missed_correct_option_ids": missed_correct_option_ids,
        "wrong_selected_option_ids": wrong_selected_option_ids,
        "partial_score": partial_score,
        "answer_score": answer_score,
        "is_fully_correct": is_fully_correct,
        "answer_level": answer_level,
        "selected_count": len(valid_selected_option_ids),
        "correct_count": len(correct_option_ids),
        "wrong_count": len(wrong_selected_option_ids),
        "feedback_tags": _build_feedback_tags(
            validated_question["choices"],
            missed_correct_option_ids,
            wrong_selected_option_ids,
        ),
    }


# 부분점수 계산 공개 함수
#
# 역할:
# - multi-select 채점 공식을 분리해 service나 테스트에서 독립적으로 재사용할 수 있게 한다.
def calculate_partial_score(
    selected_option_ids: list[str],
    correct_option_ids: list[str],
    all_option_ids: list[str],
) -> float:
    correct_set = set(correct_option_ids)
    all_option_set = set(all_option_ids)

    if not correct_set:
        raise QuestionValidationError("Question must contain at least one correct option.")
    if correct_set == all_option_set:
        raise QuestionValidationError("Question cannot have all options marked as correct.")

    selected_set = set(selected_option_ids) & all_option_set
    wrong_option_set = all_option_set - correct_set

    correct_selected = len(selected_set & correct_set)
    wrong_selected = len(selected_set - correct_set)
    total_correct = len(correct_set)
    total_wrong = len(wrong_option_set)

    recall = correct_selected / total_correct
    penalty = 0.0 if total_wrong == 0 else wrong_selected / total_wrong
    return round(_clamp(recall - 0.5 * penalty, 0.0, 1.0), 4)


# duplicate 방지 key 생성 공개 함수
#
# 역할:
# - subject/concept/purpose/difficulty/tag_group 조합으로 reuse_key를 deterministic하게 만든다.
def build_reuse_key(
    subject_id: str,
    concept_id: str,
    diagnosis_purpose: str,
    question_difficulty: str,
    tag_group: str,
) -> str:
    return ":".join(
        [
            (subject_id or "").strip(),
            (concept_id or "").strip(),
            (diagnosis_purpose or "").strip(),
            (question_difficulty or "").strip(),
            (tag_group or "").strip(),
        ]
    )


# score -> level 변환 공개 함수
#
# 역할:
# - 0.0~1.0 점수를 1~5 이해도 단계로 변환한다.
def score_to_level(score: float) -> int:
    clamped_score = _clamp(float(score), 0.0, 1.0)
    if clamped_score < 0.2:
        return 1
    if clamped_score < 0.4:
        return 2
    if clamped_score < 0.6:
        return 3
    if clamped_score < 0.8:
        return 4
    return 5


# legacy 호환 점수 함수
#
# 역할:
# - 기존 diagnosis_service.py의 calculate_score import/호출을 최대한 안 깨기 위한 호환 함수다.
# - 신규 multi-select 로직은 evaluate_answer()와 calculate_partial_score()를 사용해야 한다.
# - old service가 dict를 기대하는 호출 패턴이면 score/status dict를 반환한다.
# - 단순 호환 용도이며 향후 diagnosis_service 리팩터링 이후 제거 후보다.
def calculate_score(
    is_correct: bool,
    is_skipped: bool = False,
    **kwargs: Any,
) -> float | dict[str, Any]:
    if is_skipped:
        score = 0.0
    elif is_correct:
        score = 1.0
    else:
        score = 0.0

    if kwargs:
        return {
            "score": score,
            "status": _legacy_score_to_status(score),
        }
    return score


# question payload 검증 함수
#
# 역할:
# - LLM이 만든 문항이나 외부에서 들어온 teacher-side question dict를 강하게 검증한다.
# - 구조, 정답 수, option_id, reuse_key 중복 여부를 체크한다.
def validate_question_payload(
    question: dict,
    *,
    expected_concept_id: str | None = None,
    previous_reuse_keys: list[str] | None = None,
) -> dict[str, Any]:
    if not isinstance(question, dict):
        raise QuestionValidationError("Question payload must be a dict.")

    concept_id = _require_non_empty_string(question.get("concept_id"), "concept_id")
    concept_name = _require_non_empty_string(question.get("concept_name"), "concept_name")
    subject_id = _require_non_empty_string(question.get("subject_id"), "subject_id")
    question_text = _require_non_empty_string(question.get("question_text"), "question_text")
    diagnosis_purpose = _require_non_empty_string(question.get("diagnosis_purpose"), "diagnosis_purpose")
    question_difficulty = _require_non_empty_string(question.get("question_difficulty"), "question_difficulty")
    tag_group = _require_non_empty_string(question.get("tag_group"), "tag_group")

    if expected_concept_id and concept_id != expected_concept_id:
        raise QuestionValidationError("Generated question concept_id does not match target concept_id.")

    choices = question.get("choices")
    if not isinstance(choices, list) or len(choices) != 5:
        raise QuestionValidationError("Question must contain exactly 5 choices.")

    validated_choices: list[dict[str, Any]] = []
    observed_option_ids: list[str] = []
    for choice in choices:
        if not isinstance(choice, dict):
            raise QuestionValidationError("Each choice must be a dict.")

        option_id = _require_non_empty_string(choice.get("option_id"), "choice.option_id")
        if option_id not in OPTION_IDS:
            raise QuestionValidationError("option_id must be one of A, B, C, D, E.")
        if option_id in observed_option_ids:
            raise QuestionValidationError("Duplicate option_id detected in choices.")
        observed_option_ids.append(option_id)

        text = _require_non_empty_string(choice.get("text"), "choice.text")
        explanation_value = choice.get("explanation")
        if explanation_value is None:
            explanation = ""
        else:
            explanation = str(explanation_value).strip()
        diagnostic_tag = _require_non_empty_string(choice.get("diagnostic_tag"), "choice.diagnostic_tag")

        is_correct = choice.get("is_correct")
        if not isinstance(is_correct, bool):
            raise QuestionValidationError("choice.is_correct must be a boolean.")

        target_concept_id = choice.get("target_concept_id") or concept_id
        misconception_type = choice.get("misconception_type")
        if misconception_type is not None and not isinstance(misconception_type, str):
            misconception_type = None

        validated_choices.append(
            {
                "option_id": option_id,
                "text": text,
                "is_correct": is_correct,
                "diagnostic_tag": diagnostic_tag,
                "target_concept_id": target_concept_id,
                "misconception_type": misconception_type,
                "explanation": explanation,
            }
        )

    if observed_option_ids != OPTION_IDS:
        raise QuestionValidationError("Choices must use option_id values exactly in A-E order.")

    extracted_correct_option_ids = _extract_correct_option_ids(validated_choices)
    if not extracted_correct_option_ids:
        raise QuestionValidationError("Question must contain at least one correct option.")
    if len(extracted_correct_option_ids) == len(validated_choices):
        raise QuestionValidationError("Question cannot have all choices marked as correct.")

    provided_correct_option_ids = question.get("correct_option_ids")
    if provided_correct_option_ids is None:
        correct_option_ids = extracted_correct_option_ids
    else:
        if not isinstance(provided_correct_option_ids, list):
            raise QuestionValidationError("correct_option_ids must be a list.")
        correct_option_ids = sorted({str(option_id) for option_id in provided_correct_option_ids})
        if correct_option_ids != extracted_correct_option_ids:
            raise QuestionValidationError("correct_option_ids must match choices where is_correct=true.")

    diagnostic_tags = question.get("diagnostic_tags")
    if not isinstance(diagnostic_tags, list) or not diagnostic_tags:
        raise QuestionValidationError("diagnostic_tags must be a non-empty list.")
    normalized_diagnostic_tags = [str(tag).strip() for tag in diagnostic_tags if str(tag).strip()]
    if not normalized_diagnostic_tags:
        raise QuestionValidationError("diagnostic_tags must contain non-empty values.")

    affects = question.get("affects")
    if not isinstance(affects, list) or not affects:
        affects = [concept_id]
    normalized_affects = sorted({str(item).strip() for item in affects if str(item).strip()})
    if concept_id not in normalized_affects:
        normalized_affects.append(concept_id)
        normalized_affects = sorted(set(normalized_affects))

    reuse_key = build_reuse_key(
        subject_id=subject_id,
        concept_id=concept_id,
        diagnosis_purpose=diagnosis_purpose,
        question_difficulty=question_difficulty,
        tag_group=tag_group,
    )
    if previous_reuse_keys and reuse_key in set(previous_reuse_keys):
        raise QuestionValidationError(f"Duplicate reuse_key generated: {reuse_key}")

    return {
        "concept_id": concept_id,
        "concept_name": concept_name,
        "subject_id": subject_id,
        "question_type": QUESTION_TYPE_MULTI_SELECT,
        "diagnosis_purpose": diagnosis_purpose,
        "question_difficulty": question_difficulty,
        "question_text": question_text,
        "choices": validated_choices,
        "correct_option_ids": correct_option_ids,
        "diagnostic_tags": normalized_diagnostic_tags,
        "tag_group": tag_group,
        "reuse_key": reuse_key,
        "affects": normalized_affects,
        "llm_reason": str(question.get("llm_reason", "")).strip(),
    }


# selected option 정리 함수
#
# 역할:
# - 사용자가 보낸 선택지 ID에서 중복을 제거하고 유효/무효 값을 분리한다.
def sanitize_selected_option_ids(
    selected_option_ids: list[str],
    all_option_ids: list[str],
) -> tuple[list[str], list[str]]:
    if not isinstance(selected_option_ids, list):
        raise AnswerEvaluationError("selected_option_ids must be a list.")

    allowed = set(all_option_ids)
    valid_selected_option_ids: list[str] = []
    invalid_selected_option_ids: list[str] = []
    seen: set[str] = set()

    for raw_option_id in selected_option_ids:
        option_id = str(raw_option_id).strip()
        if not option_id or option_id in seen:
            continue
        seen.add(option_id)
        if option_id in allowed:
            valid_selected_option_ids.append(option_id)
        else:
            invalid_selected_option_ids.append(option_id)

    return valid_selected_option_ids, invalid_selected_option_ids


# 정답 option_id 추출 함수
#
# 역할:
# - validated choices에서 is_correct=True인 option_id를 일관되게 추출한다.
def _extract_correct_option_ids(choices: list[dict[str, Any]]) -> list[str]:
    return [choice["option_id"] for choice in choices if choice["is_correct"]]


# feedback tag 생성 함수
#
# 역할:
# - missed/wrong 선택지에서 diagnostic_tag 또는 misconception_type을 읽어 feedback tag를 만든다.
def _build_feedback_tags(
    choices: list[dict[str, Any]],
    missed_correct_option_ids: list[str],
    wrong_selected_option_ids: list[str],
) -> list[str]:
    choice_map = {choice["option_id"]: choice for choice in choices}
    feedback_tags: list[str] = []

    for option_id in missed_correct_option_ids:
        choice = choice_map.get(option_id, {})
        diagnostic_tag = choice.get("diagnostic_tag")
        if diagnostic_tag:
            feedback_tags.append(f"missed:{diagnostic_tag}")
        else:
            feedback_tags.append(f"missed:{option_id}")

    for option_id in wrong_selected_option_ids:
        choice = choice_map.get(option_id, {})
        wrong_tag = choice.get("misconception_type") or choice.get("diagnostic_tag") or option_id
        feedback_tags.append(f"wrong:{wrong_tag}")

    return feedback_tags


# 범위 제한 함수
#
# 역할:
# - 점수 계산 결과를 지정 범위로 제한한다.
def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


# 필수 문자열 검증 함수
#
# 역할:
# - 필수 문자열 필드를 공통 방식으로 검증한다.
def _require_non_empty_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise QuestionValidationError(f"{field_name} must be a non-empty string.")
    return value.strip()


# legacy status 변환 함수
#
# 역할:
# - 기존 diagnosis_service.py가 기대하는 5단계 status 문자열을 간단 호환용으로 만든다.
def _legacy_score_to_status(score: float) -> str:
    if score <= 0.0:
        return "WEAK"
    if score < 0.4:
        return "PARTIAL"
    if score < 0.8:
        return "FAMILIAR"
    return "MASTERED"
=======
    """
    raise NotImplementedError


def calculate_score(
    node_id: str,
    node_name: str,
    current_score: float,
    difficulty: str,
    question_type: str,
    is_correct: bool,
    is_skipped: bool,
    is_primary: bool,
) -> dict:
    """정답 여부에 따라 이해도 score와 status 계산

    반환 형식:
    {
      "score": float,   # 0.0 ~ 1.0
      "status": str     # MASTERED / WEAK / UNSEEN
    }
    """
    raise NotImplementedError
>>>>>>> origin/dev
