# [AI팀 구현] PDF 분석 → 개념/관계 추출


def extract_graph(file_bytes: bytes) -> dict:
    """PDF 바이트를 받아 개념과 관계를 추출해 반환

    반환 형식:
    {
      "concepts": [{"name": str, "description": str, "group": str}],
      "relations": [{"source": str, "target": str, "relation_type": "prerequisite" | "part_of"}]
    }
    """
    raise NotImplementedError
