import re


KOREAN_RESPONSE_LANGUAGE = "Korean"
ENGLISH_RESPONSE_LANGUAGE = "English"
JAPANESE_RESPONSE_LANGUAGE = "Japanese"
CHINESE_RESPONSE_LANGUAGE = "Chinese"


def detect_user_response_language(text: str | None) -> str:
    """Default to Korean; return another language only when user text is clear."""
    if not isinstance(text, str):
        return KOREAN_RESPONSE_LANGUAGE

    normalized = text.strip()
    if not normalized:
        return KOREAN_RESPONSE_LANGUAGE

    hangul_count = len(re.findall(r"[가-힣]", normalized))
    japanese_count = len(re.findall(r"[\u3040-\u30ff]", normalized))
    chinese_count = len(re.findall(r"[\u4e00-\u9fff]", normalized))
    english_words = re.findall(r"[A-Za-z]{2,}", normalized)

    if hangul_count > 0:
        return KOREAN_RESPONSE_LANGUAGE
    if japanese_count > 0:
        return JAPANESE_RESPONSE_LANGUAGE
    if chinese_count >= 4:
        return CHINESE_RESPONSE_LANGUAGE
    if len(english_words) >= 3:
        return ENGLISH_RESPONSE_LANGUAGE
    return KOREAN_RESPONSE_LANGUAGE


def response_language_instruction(response_language: str) -> str:
    if response_language == ENGLISH_RESPONSE_LANGUAGE:
        return (
            "Write all user-facing text in English. "
            "Keep JSON keys, schema fields, concept_id, node_id, and internal identifiers unchanged."
        )
    if response_language == JAPANESE_RESPONSE_LANGUAGE:
        return (
            "Write all user-facing text in Japanese. "
            "Keep JSON keys, schema fields, concept_id, node_id, and internal identifiers unchanged."
        )
    if response_language == CHINESE_RESPONSE_LANGUAGE:
        return (
            "Write all user-facing text in Chinese. "
            "Keep JSON keys, schema fields, concept_id, node_id, and internal identifiers unchanged."
        )
    return korean_default_instruction()


def korean_default_instruction() -> str:
    return (
        "Write all user-facing text in Korean by default. "
        "English CS terms may be included in parentheses when helpful, for example 큐(queue) or 스택(stack). "
        "Keep JSON keys, schema fields, concept_id, node_id, and internal identifiers unchanged."
    )
