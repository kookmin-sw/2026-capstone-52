# 이음 프로젝트 정리

---

## 1. 서비스 개요

**서비스명** 이음
**한 줄 정의** AI가 질문-응답-설명 과정을 통해 사용자별 지식 그래프를 형성하고, 이를 기반으로 맞춤형 학습을 제공하는 서비스
**유형** 대학교 캡스톤 디자인 | 웹 서비스 | AWS 기반

### 핵심 작동 방식

1. **프로젝트 생성** — 비슷한 주제의 학습을 하나의 프로젝트로 묶어 관리
2. **강의자료 입력** — PDF 업로드 → AI가 핵심 개념 및 관계 추출
3. **최소 질문 기반 수준 진단** — 적은 질문으로 현재 이해도를 빠르게 파악
4. **지식 그래프 생성 및 업데이트** — 수준진단/미니퀴즈 결과로 사용자별 그래프 누적
5. **그래프 기반 맞춤 설명 제공** — 같은 자료도 사용자마다 다른 설명 제공

### 기존 서비스와의 차별점

- 설명 전에 사용자 수준을 먼저 진단
- 질문 수를 최소화하면서 빠르게 수준 추정
- 질문-응답-설명 과정이 누적되어 사용자별 지식 그래프 형성
- 지식 그래프를 기반으로 이후 설명과 학습 경로를 계속 개인화

---

## 2. 팀 구성 및 역할

| 역할 | 담당 범위 |
|------|---------|
| 프론트엔드 | 전체 화면 구현, API 연동, 그래프 시각화 (React) |
| 백엔드 1 | auth, users, user_profiles, projects, learning_logs, mypage, chat |
| **백엔드 2 (나)** | **upload, file 처리, ai, graph, explanation, diagnosis, mini_quiz / AWS 배포** |
| AI | PDF 분석, 개념 추출, 진단 질문 생성, 맞춤 설명 로직 |

> 백엔드 1 / 백엔드 2는 **서버 분리가 아니라 역할 분리** — 하나의 FastAPI 코드베이스에서 모듈 단위로 개발

---

## 3. 내 담당 (백엔드 2)

### 담당 모듈

| 모듈 | 설명 |
|------|------|
| `upload` | PDF 파일 수신, S3 저장, 메타데이터 DB 기록 |
| `file` | 파일 목록 조회, 분석 상태 관리 |
| `ai` | AI 모듈 호출, 분석 결과 수신 및 DB 저장 |
| `graph` | 지식 그래프 노드/엣지 저장, 조회 |
| `explanation` | LLM 기반 맞춤 설명 생성 및 기록 |
| `diagnosis` | 수준 진단 질문 생성, 답변 처리, 그래프 상태 갱신, 리뷰 |
| `mini_quiz` | 채팅 중 개념 카운트 조건 충족 시 팝업 퀴즈 생성/제출/리뷰 |

> 채팅을 통한 직접적인 그래프 노드 업데이트는 없음. 그래프 갱신은 수준진단 / 미니퀴즈 답변 제출 시에만 발생.

### 담당 AWS 인프라

| 서비스 | 역할 |
|--------|------|
| Amazon EC2 | FastAPI 백엔드 서버 배포 |
| Amazon S3 | PDF 파일 원본 저장 |
| Amazon RDS (PostgreSQL) | DB 연결 및 운영 |
| Amazon Bedrock | LLM API 호출 |

---

## 4. 기술 스택

| 항목 | 기술 |
|------|------|
| 백엔드 | FastAPI (Python) |
| ORM | SQLAlchemy |
| 프론트엔드 | React |
| DB | PostgreSQL (로컬 개발 시 SQLite 가능, 이후 Amazon RDS 이전) |
| 파일 저장 | Amazon S3 |
| LLM | Amazon Bedrock |
| 서버 | Amazon EC2 |
| AI 모듈 | Python (별도 모듈) |

---

## 5. 아키텍처

```
[사용자 (브라우저)]
        ↓
[Frontend — React · S3 + CloudFront]
        ↓
[EC2 (FastAPI) — 백엔드 서버 단일]
  ┌──────────────────────────────────────────────────────┐
  │  auth / users / user_profiles / projects             │
  │  learning_logs / mypage / chat                       │  ← 백엔드1 담당
  ├──────────────────────────────────────────────────────┤
  │  upload / graph / explanation                        │
  │  diagnosis / mini_quiz                               │  ← 백엔드2 담당 (나)
  └──────────────────────────────────────────────────────┘
        ↓              ↓ (양방향)     ↓ (양방향)    ↓ (양방향)
[RDS PostgreSQL]  [Amazon Bedrock]   [S3]    [AI 모듈 (Python)]
```

---

## 6. 폴더 구조

```
app/
 ├── main.py
 ├── api/
 │    └── routes/
 │         ├── users.py              ← 백엔드1
 │         ├── projects.py           ← 백엔드1
 │         ├── chat.py               ← 백엔드1
 │         ├── upload.py             ← 백엔드2 (나)
 │         ├── graph.py              ← 백엔드2 (나)
 │         ├── explanation.py        ← 백엔드2 (나)
 │         ├── diagnosis.py          ← 백엔드2 (나)
 │         ├── mini_quiz.py          ← 백엔드2 (나)
 │         └── mypage.py             ← 백엔드1
 ├── ai/
 │    ├── llm_client.py              ← Bedrock 호출 공통 클라이언트
 │    ├── graph_extractor.py         ← PDF → 개념/관계 추출
 │    ├── concept_normalizer.py      ← 개념명 정규화
 │    ├── diagnosis_ai.py            ← 진단 질문 생성 및 답변 평가
 │    ├── explanation_ai.py          ← 맞춤 설명 생성
 │    └── chat_ai.py                 ← 채팅 응답 생성
 ├── models/
 │    ├── user.py
 │    ├── project.py
 │    ├── chat.py
 │    ├── diagnosis.py
 │    ├── file.py
 │    ├── graph.py
 │    ├── learning_log.py
 │    └── concept_quiz_counter.py
 ├── schemas/
 │    ├── user.py
 │    ├── project.py
 │    ├── chat.py
 │    ├── diagnosis.py
 │    ├── explanation.py
 │    ├── file.py
 │    ├── graph.py
 │    ├── mini_quiz.py
 │    ├── quiz_review.py
 │    └── mypage.py
 ├── services/
 │    ├── user_service.py
 │    ├── project_service.py
 │    ├── chat_service.py
 │    ├── diagnosis_service.py       ← 백엔드2 (나)
 │    ├── diagnosis_report_service.py← 백엔드2 (나)
 │    ├── mini_quiz_service.py       ← 백엔드2 (나)
 │    ├── upload_service.py          ← 백엔드2 (나)
 │    ├── graph_service.py           ← 백엔드2 (나)
 │    ├── explanation_service.py     ← 백엔드2 (나)
 │    ├── concept_quiz_counter_service.py ← 백엔드2 (나)
 │    └── mypage_service.py
 ├── db/
 │    ├── session.py
 │    └── base.py
 └── core/
      └── config.py
```

---

## 7. DB 설계

### 네이밍 규칙

- 테이블명: 복수형 소문자 (`users`, `projects`, `concept_nodes` ...)
- 컬럼명: `snake_case`
- ID 필드: `user_id`, `project_id`, `file_id`, `node_id`, `edge_id`, `question_id`, `answer_id`

### 백엔드2 담당 테이블

#### files

| 컬럼 | 타입 | 설명 |
|------|------|------|
| file_id | uuid PK | |
| project_id | uuid FK | |
| file_name | string | 원본 파일명 |
| s3_key | string | S3 저장 경로 |
| file_type | string | pdf 등 |
| uploaded_at | timestamp | |
| analysis_status | string | UPLOADED / PROCESSING / DONE / FAILED |

> 파일 원본은 S3 저장, DB에는 메타데이터만 저장

#### concept_nodes

| 컬럼 | 타입 | 설명 |
|------|------|------|
| node_id | uuid PK | |
| project_id | uuid FK | |
| file_id | uuid FK | |
| concept_id | string | 정규화된 stable 개념 ID (예: os_deadlock) |
| name | string | 개념명 |
| description | text | |
| group | string | 개념 그룹 (예: 운영체제) |
| status | string | UNSEEN / WEAK / PARTIAL / FAMILIAR / MASTERED |
| understanding_score | float | 이해도 0.0 ~ 1.0 |
| updated_at | timestamp | |

**status 기준:**

| score 범위 | status |
|-----------|--------|
| 0.0 | UNSEEN |
| 0.0 초과 ~ 0.4 미만 | WEAK / PARTIAL |
| 0.4 이상 ~ 0.8 미만 | FAMILIAR |
| 0.8 이상 | MASTERED |

#### concept_edges

| 컬럼 | 타입 | 설명 |
|------|------|------|
| edge_id | uuid PK | |
| project_id | uuid FK | |
| source_node_id | uuid FK | |
| target_node_id | uuid FK | |
| relation_type | string | prerequisite / part_of |
| weight | float | 0.0 ~ 1.0 |

> MVP: `prerequisite`, `part_of` 만 사용

#### diagnosis_questions

| 컬럼 | 타입 | 설명 |
|------|------|------|
| question_id | uuid PK | |
| concept_id | string FK | 주 측정 개념 node_id |
| difficulty | string | easy / medium / hard |
| question_type | string | multi_select |
| diagnosis_purpose | string | concept_check / prerequisite_check |
| question | text | 질문 본문 |
| choices | text | 선택지 JSON (option_id, text, is_correct, diagnostic_tag, explanation 포함) |
| correct_index | string | legacy non-null (multi_select에서는 correct_option_ids 사용) |
| correct_option_ids | text | 정답 option_id 목록 JSON 배열 |
| diagnostic_tags | text | 진단 태그 목록 JSON 배열 |
| tag_group | string | 태그 그룹 |
| reuse_key | string | 중복 출제 방지 키 |
| diagnosis_purpose | string | concept_check |
| explanation | text | 문제 단위 통합 해설 (nullable, AI 업데이트 시 채워짐) |
| created_at | timestamp | |

> `affects` 컬럼 없음 — 퀴즈 1문제당 concept_id 노드 1개만 score 반영

#### diagnosis_answers

| 컬럼 | 타입 | 설명 |
|------|------|------|
| answer_id | uuid PK | |
| question_id | uuid FK | |
| session_id | string | 수준진단: 세션 UUID / 미니퀴즈: "mini_quiz" |
| is_correct | bool | 완전 정답 여부 |
| is_skipped | bool | 스킵 여부 |
| selected_option_ids | text | 사용자가 선택한 option_id 목록 JSON 배열 |
| partial_score | float | 부분 점수 0.0 ~ 1.0 |
| answer_score | float | 최종 반영 점수 |
| is_fully_correct | bool | |
| missed_correct_option_ids | text | JSON 배열 |
| wrong_selected_option_ids | text | JSON 배열 |
| invalid_selected_option_ids | text | JSON 배열 |
| created_at | timestamp | |

#### concept_quiz_counters

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | PK | |
| project_id | int FK | |
| node_id | string FK | |
| mention_count | int | AI 응답에서 해당 개념이 언급된 횟수 누적 |
| last_counted_chat_id | int | 마지막으로 카운트된 chat_id |
| created_at | timestamp | |
| updated_at | timestamp | |

> 5턴마다 확인, `mention_count >= 5` 이면 미니퀴즈 후보. 미니퀴즈 제출 후 카운트 초기화.

---

## 8. API 명세 (백엔드2 담당)

> **Base URL** `http://{ec2-host}/api`
> **인증** JWT Bearer 토큰 (`Authorization: Bearer <access_token>`) — 모든 백엔드2 엔드포인트 필수
> **네이밍** Python `snake_case`, API 경로 소문자

### 응답 형식 (공통)

**성공**
```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

**실패**
```json
{
  "success": false,
  "data": null,
  "message": "에러 메시지"
}
```

### HTTP 상태 코드

| 코드 | 의미 |
|------|------|
| 401 | 토큰 없음 / 유효하지 않은 토큰 |
| 403 | 다른 사용자의 리소스 접근 시도 |
| 404 | 리소스 없음 |

### 상태 범례

| 아이콘 | 의미 |
|--------|------|
| 🔴 | 미구현 |
| 🟡 | 개발중 |
| 🟢 | 완료 |

---

## 파일 업로드

| 기능 | Method | URL | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| PDF 업로드 | `POST` | `/api/upload/{project_id}` | PDF를 S3에 저장하고 메타데이터 DB 기록 | 🟢 |
| 업로드 목록 조회 | `GET` | `/api/upload/{project_id}` | 프로젝트 내 파일 목록, 업로드 시간, 분석 상태 반환 | 🟢 |
| AI 분석 트리거 | `POST` | `/api/upload/{file_id}/analyze` | PDF 텍스트 추출 → AI 모듈 호출 → 개념/관계 추출 → 그래프 저장 | 🟢 |
| 분석 상태 조회 | `GET` | `/api/upload/{file_id}/status` | 분석 진행 상태 polling용 (UPLOADED / PROCESSING / DONE / FAILED) | 🟢 |

---

## 지식 그래프

| 기능 | Method | URL | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| 프로젝트 그래프 조회 | `GET` | `/api/graph/{project_id}` | 특정 프로젝트의 노드 + 엣지 전체 반환 | 🟢 |
| 전체 그래프 조회 | `GET` | `/api/graph/me?project_id={id}` | 사용자의 전체 프로젝트 통합 그래프 반환 (project_id 있으면 해당 프로젝트만 필터) | 🟢 |
| 최근 업데이트 개념 조회 | `GET` | `/api/graph/{project_id}/recent` | 최근 갱신된 노드 목록 반환 (채팅 화면 우측 패널) | 🟢 |
| 노드 상세 조회 | `GET` | `/api/graph/nodes/{node_id}` | 노드 설명, 관련 개념, 관련 학습 기록 반환 | 🟢 |
| 노드별 퀴즈 이력 조회 | `GET` | `/api/graph/nodes/{node_id}/quiz-history` | 해당 노드의 수준진단/미니퀴즈 이력 전체 반환 | 🟢 |

---

## 수준 진단

| 기능 | Method | URL | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| 진단 세션 생성 | `POST` | `/api/diagnosis/{project_id}/sessions` | PDF 업로드 차수마다 새 세션 UUID 발급 | 🟢 |
| 진단 질문 생성 | `POST` | `/api/diagnosis/{project_id}/questions` | 현재 그래프 기반 다음 진단 질문 생성 | 🟢 |
| 진단 답변 제출 | `POST` | `/api/diagnosis/{project_id}/answers` | 사용자 답변 저장 후 이해도 추정 및 그래프 상태 갱신 | 🟢 |
| 진단 리포트 생성 | `POST` | `/api/diagnosis/{project_id}/report` | 수준진단 결과 채팅 리포트 메시지 2개 생성 | 🟢 |
| 진단 진행 상태 조회 | `GET` | `/api/diagnosis/{project_id}/status` | 답변 수 / 12문제 기준 진행률 반환 (session_id 쿼리 파라미터 필수) | 🟢 |
| 진단 개념 목록 조회 | `GET` | `/api/diagnosis/{project_id}/nodes` | 전체 노드의 진단 상태 반환 (question_id 선택) | 🟢 |
| 진단 리뷰 조회 | `GET` | `/api/diagnosis/{project_id}/sessions/{session_id}/review` | 세션 전체 문제 정답/사용자 답/해설 반환 | 🟢 |

---

## 미니 퀴즈

> 채팅 중 AI 응답에서 특정 개념이 5턴 내 5회 이상 언급되면 팝업 퀴즈 출제. 수준진단과 동일한 multi-select 방식. 2문제 출제.

| 기능 | Method | URL | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| 미니 퀴즈 생성 | `POST` | `/api/mini-quiz/{project_id}/generate?node_id=...` | 해당 노드 개념 퀴즈 문제 생성 | 🟢 |
| 미니 퀴즈 제출 | `POST` | `/api/mini-quiz/{project_id}/submit` | 답변 제출 → 노드 score 갱신 + 개념 카운트 초기화 | 🟢 |
| 미니 퀴즈 리뷰 | `GET` | `/api/mini-quiz/{project_id}/review?question_ids=uuid1,uuid2` | 2문제 정답/사용자 답/해설 반환 | 🟢 |

---

## 맞춤 설명

| 기능 | Method | URL | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| 맞춤 설명 생성 | `POST` | `/api/explanation` | 사용자 질문과 그래프 상태 기반 LLM 맞춤 설명 반환 | 🟢 |

---

## 9. 주요 응답 형식

### 진단 진행 상태 (`GET /api/diagnosis/{project_id}/status?session_id=...`)
```json
{
  "session_id": "uuid-...",
  "answered": 3,
  "total_questions": 12,
  "progress_percent": 25.0
}
```

### 진단 질문 (`POST /api/diagnosis/{project_id}/questions`)
```json
{
  "question_id": "uuid-...",
  "concept_id": "uuid-...",
  "difficulty": "medium",
  "question_type": "multi_select",
  "diagnosis_purpose": "concept_check",
  "question": "질문 본문",
  "choices": [
    { "option_id": "A", "text": "선택지 텍스트" },
    { "option_id": "B", "text": "선택지 텍스트" }
  ]
}
```

### 진단 답변 제출 (`POST /api/diagnosis/{project_id}/answers`)
```json
{
  "is_correct": false,
  "is_fully_correct": false,
  "partial_score": 0.5,
  "answer_score": 0.5,
  "answer_level": 2,
  "correct_option_ids": ["A", "C"],
  "selected_option_ids": ["A", "B"],
  "missed_correct_option_ids": ["C"],
  "wrong_selected_option_ids": ["B"],
  "invalid_selected_option_ids": [],
  "updated_nodes": [
    { "node_id": "uuid-...", "status": "FAMILIAR", "understanding_score": 0.65 }
  ]
}
```

### 퀴즈 리뷰 (`GET /api/diagnosis/.../review` 또는 `GET /api/mini-quiz/.../review`)
```json
[
  {
    "question_id": "uuid-...",
    "concept_id": "uuid-...",
    "question": "질문 본문",
    "choices": [
      { "option_id": "A", "text": "...", "is_correct": true,  "is_selected": true },
      { "option_id": "B", "text": "...", "is_correct": false, "is_selected": true },
      { "option_id": "C", "text": "...", "is_correct": true,  "is_selected": false }
    ],
    "correct_option_ids": ["A", "C"],
    "selected_option_ids": ["A", "B"],
    "is_fully_correct": false,
    "partial_score": 0.5,
    "answer_score": 0.5,
    "explanation": null
  }
]
```
> `explanation`은 현재 null — AI 모듈 업데이트 후 문제 단위 해설 채워질 예정

### 미니 퀴즈 제출 (`POST /api/mini-quiz/{project_id}/submit`)
```json
{
  "is_fully_correct": false,
  "partial_score": 0.5,
  "answer_score": 0.5,
  "answer_level": 2,
  "correct_option_ids": ["A", "C"],
  "selected_option_ids": ["A", "B"],
  "missed_correct_option_ids": ["C"],
  "wrong_selected_option_ids": ["B"],
  "invalid_selected_option_ids": [],
  "updated_node": { "node_id": "uuid-...", "status": "FAMILIAR", "understanding_score": 0.65 }
}
```

### 채팅 (`POST /api/chat/{project_id}`)
```json
{
  "chat_id": 1,
  "user_message": "메시지",
  "ai_response": "AI 응답",
  "response_type": "default",
  "concept_counting": {
    "turn_count": 5,
    "check_interval": 5,
    "should_check_quiz": true,
    "counted_concepts": [
      { "node_id": "uuid-...", "name": "교착 상태", "mention_count": 3 }
    ],
    "quiz_ready_concepts": [
      { "node_id": "uuid-...", "name": "세마포어", "mention_count": 5 }
    ]
  },
  "created_at": "..."
}
```
> `quiz_ready_concepts`가 비어있지 않으면 프론트에서 미니퀴즈 팝업 표시

### 맞춤 설명 (`POST /api/explanation`)
```json
{
  "concept_id": "os_deadlock",
  "concept_name": "교착 상태",
  "user_level": 3,
  "explanation_level": "intermediate",
  "title": "교착 상태 이해하기",
  "summary": "개념 요약",
  "explanation": "맞춤 설명 본문",
  "prerequisite_review": [
    { "concept_id": "...", "concept_name": "...", "reason": "...", "review_text": "..." }
  ],
  "common_misconceptions": [
    { "misconception": "...", "correction": "..." }
  ],
  "example": "예시",
  "connection_to_graph": "그래프 연결 설명",
  "next_steps": ["다음 학습 단계"],
  "confidence_note": ""
}
```

---

## 10. AI 모듈 결과 형식 (AI → 백엔드2)

> AI 모듈은 DB/라우터에 의존하지 않는 standalone 함수로 동작. 실제 DB 반영은 서비스/라우터 레이어에서 처리.

### PDF 분석 (`graph_extractor.extract_graph`)
```json
{
  "subject_id": "operating_system",
  "concepts": [
    {
      "concept_id": "os_deadlock",
      "concept_name": "교착 상태",
      "korean_name": "교착 상태",
      "description": "개념 설명",
      "group": "운영체제"
    }
  ],
  "relations": [
    {
      "source_concept_id": "os_deadlock",
      "target_concept_id": "os_mutex",
      "relation_type": "prerequisite",
      "weight": 0.8
    }
  ]
}
```

### 진단 질문 생성 (`diagnosis_ai.generate_question`)
```json
{
  "concept_id": "os_deadlock",
  "concept_name": "교착 상태",
  "subject_id": "operating_system",
  "question_type": "multi_select",
  "diagnosis_purpose": "concept_check",
  "question_difficulty": "medium",
  "question_text": "질문 본문",
  "choices": [
    {
      "option_id": "A",
      "text": "선택지 텍스트",
      "is_correct": true,
      "diagnostic_tag": "deadlock_condition",
      "target_concept_id": "os_deadlock",
      "misconception_type": null,
      "explanation": "선택지별 설명"
    }
  ],
  "correct_option_ids": ["A", "C"],
  "diagnostic_tags": ["deadlock_condition"],
  "tag_group": "concept_understanding",
  "reuse_key": "operating_system:os_deadlock:concept_check:medium:concept_understanding"
}
```
> `affects` 필드 없음 — 퀴즈 1개당 `concept_id` 노드 1개만 score 반영

### 진단 답변 평가 (`diagnosis_ai.evaluate_answer`)
```json
{
  "selected_option_ids": ["A", "B"],
  "valid_selected_option_ids": ["A", "B"],
  "correct_option_ids": ["A", "C"],
  "correct_selected_option_ids": ["A"],
  "missed_correct_option_ids": ["C"],
  "wrong_selected_option_ids": ["B"],
  "invalid_selected_option_ids": [],
  "partial_score": 0.5,
  "answer_score": 0.5,
  "is_fully_correct": false,
  "answer_level": 2
}
```

### 채팅 응답 (`chat_ai.process_chat`)
```json
{
  "reply": "AI 응답 텍스트",
  "mentioned_concepts": [
    { "concept_id": "...", "concept_name": "...", "node_id": "...", "match_reason": "..." }
  ],
  "understanding_signals": [...],
  "needs_graph_update": false,
  "suggested_next_actions": ["ask_followup_question"],
  "followup_question": "...",
  "safety_note": ""
}
```
> `understanding_signals`는 AI 모듈이 반환하지만 백엔드에서 사용하지 않음. 채팅을 통한 그래프 직접 업데이트 없음.

### 맞춤 설명 생성 (`explanation_ai.generate_explanation`)

> 응답 형식은 위 **9. 주요 응답 형식 > 맞춤 설명** 과 동일

---

## 11. 개발 규칙 요약

| 항목 | 규칙 |
|------|------|
| 언어 스타일 | Python `snake_case` |
| API 경로 | 소문자 (`/api/upload`, `/api/graph`) |
| 응답 형식 | `{ success, data, message }` 통일 |
| 인증 | JWT Bearer 토큰 — 모든 백엔드2 엔드포인트 필수. 401(미인증) / 403(권한없음) / 404(없음) |
| DB | PostgreSQL / SQLAlchemy ORM |
| 파일 저장 | S3 원본, DB는 메타데이터만 |
| 그래프 관계 | MVP: `prerequisite`, `part_of` 만 사용 |
| AI 모듈 | standalone 함수, DB/라우터 미의존. 실제 반영은 서비스/라우터에서 처리 |
| 그래프 갱신 | 수준진단/미니퀴즈 답변 제출 시에만 발생. 채팅에서는 그래프 직접 갱신 없음 |
| score 갱신 공식 | `new_score = 0.7 * previous_score + 0.3 * answer_score` (가중평균) |

---

## 12. 개발 환경

| 항목 | 내용 |
|------|------|
| 에디터 | VS Code |
| 주요 플러그인 | Python, Pylance, Ruff, Thunder Client, GitLens |
| 서버 실행 | `uvicorn main:app --reload` |
| API 문서 | `http://localhost:8000/docs` (Swagger 자동 생성) |
| 가상환경 | `python -m venv venv` |
