# [AI팀 구현] 수준 진단 질문 생성


def generate_question(node_list: list) -> dict:
    """UNKNOWN/PARTIAL 노드 중 하나를 골라 객관식 진단 질문 생성

    node_list 형식: [{"node_id": str, "name": str, "status": str}]

    반환 형식:
    {
      "node_id": str,
      "question": str,
      "choices": ["① ...", "② ...", "③ ...", "④ ..."],
      "correct_index": int  # 정답 인덱스 (0~3)
    }
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
