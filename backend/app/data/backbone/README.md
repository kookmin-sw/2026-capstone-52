# Backbone Data

이 디렉터리는 subject backbone PDF를 전처리한 local JSON chunk 파일을 저장합니다.

현재 지원 subject IDs:
- `operating_system`
- `data_structure`
- `computer_network`
- `algorithm`

권장 파일명:
- `operating_system_chunks.json`
- `data_structure_chunks.json`
- `computer_network_chunks.json`
- `algorithm_chunks.json`

지원 JSON 구조:

```json
{
  "chunks": [
    {
      "chunk_id": "algorithm_algorithms_jeff_erickson_0001",
      "subject_id": "algorithm",
      "source_id": "algorithms_jeff_erickson",
      "source_title": "Algorithms",
      "chapter": "Recursion",
      "section": "Mergesort",
      "page_start": 44,
      "page_end": 46,
      "concept_ids": ["algo_sorting", "algo_divide_and_conquer"],
      "keywords": ["mergesort", "divide and conquer", "recurrence", "o(n log n)"],
      "text": "..."
    }
  ]
}
```

최소 필수 필드:
- `chunk_id`
- `text`

나머지 필드는 optional이며, retrieval 품질 향상을 위해 권장됩니다.

## Local PDF preprocessing

로컬 PDF를 backbone chunk JSON으로 만들려면:

```bash
python scripts/preprocess_backbone_pdf.py \
  --input /path/to/Algorithms-JeffE.pdf \
  --subject-id algorithm \
  --source-id algorithms_jeff_erickson \
  --source-title "Algorithms" \
  --output app/data/backbone/algorithm_chunks.json
```

이 스크립트는:
- PDF text layer를 추출하고
- 페이지 기반 chunk를 만들고
- keyword를 생성하고
- `{"chunks": ...}` JSON으로 저장합니다.

## Current limitation

- local JSON only
- no S3 integration
- no OCR
- no embeddings
- no vector DB
- no admin preprocessing UI

## Future plan

향후에는:
- developer backbone PDF를 S3에 업로드
- offline/admin preprocessing
- JSON 또는 DB/vector store 저장
- improved retrieval

으로 확장될 예정입니다.
