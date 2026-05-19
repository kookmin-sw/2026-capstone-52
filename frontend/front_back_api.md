# Frontend-Backend API 연결 정리

이 문서는 Codex가 나중에 프론트엔드와 백엔드 연동 상태를 빠르게 판단하고 수정할 수 있도록, 현재 코드 기준의 API 연결 구조와 계약을 정리한 것이다.

## 2026-05-18 ChatSession 정책 및 문서 갱신

이번 정리는 `frontend/` 안의 코드/문서만 변경했고, `app/` 백엔드 코드는 수정하지 않았다.

- Chat Session API를 프론트에 연결했고, 현재 프론트 정책은 **프로젝트당 다중 thread**다.
  - 프론트는 `GET/POST/DELETE /projects/{project_id}/chat-sessions`와 `GET /chat/{project_id}/sessions/{session_id}`를 사용한다.
  - `POST /chat/{project_id}`에는 선택된 ChatSession의 `session_id` query를 붙인다.
  - 대시보드는 ChatSession 1개를 Chat thread 1개로 렌더하고, thread title은 `ChatSession.title`을 그대로 사용한다.
- Mini-Quiz 트리거 정책은 현재 구조 유지다.
  - UI 트리거 기준은 계속 `concept_counting.quiz_ready_concepts`다.
  - `mini_quiz_trigger`와 `grounding`은 응답에 존재하지만, 별도 UI 기획 전까지 표시/판단 기준으로 쓰지 않는다.
- 문서의 stale 계약을 현재 백엔드/프론트 기준으로 갱신했다.
  - `UserProfileUpdate`는 7개 필드를 받을 수 있고, 프론트는 프로필 저장 시 상세 필드를 함께 보낸다.
  - `ProjectCreate` 요청 body에는 `user_id`가 없다. 백엔드는 인증된 `current_user`를 사용한다.
  - Mini-Quiz generate/defer 응답은 단일 객체가 아니라 `data: DiagnosisQuestionResponse[]` 배열이며, `group`/`groups` sibling 필드를 보존한다.

## 2026-05-16 프론트 연동 수정 완료 내역

이번 수정은 `frontend/` 안의 코드만 변경했고, `app/` 백엔드 코드는 수정하지 않았다. dev 브랜치에 머지된 mini-quiz / multi-select / report 변경에 맞춰 프론트를 갱신한다.

- 진단 답변 API를 multi-select 응답에 맞췄다.
  - `submitApiDiagnosisAnswer(projectId, sessionId, questionId, { selectedIndex, selectedOptionIds, isSkipped })` 시그니처로 변경.
  - 응답의 `correct_option_ids`, `selected_option_ids`, `missed_correct_option_ids`, `wrong_selected_option_ids`, `is_fully_correct`, `partial_score`, `answer_score`, `answer_level` 필드를 프론트에서 사용한다.
- 진단 완료 후 학습 플로우를 추가했다.
  - 12문제 답변 완료 시 결과 화면에서 `풀이보기` / `학습하기` 버튼을 노출한다.
  - `풀이보기`는 UI만 두고 동작은 추후 구현. (`GET /diagnosis/{project_id}/sessions/{session_id}/review`와 연결될 예정)
  - `학습하기` 누르면 `POST /diagnosis/{project_id}/report`로 리포트 채팅 메시지 2개와 ChatSession을 백엔드에 저장한 뒤, 해당 채팅방으로 이동한다.
- Mini-Quiz 플로우를 신규 연동했다.
  - `POST /chat/{project_id}` 응답의 `concept_counting.quiz_ready_concepts`가 비어있지 않으면 채팅 말풍선에 "시험 준비됨" + `시험보기` / `나중에보기` 버튼을 그린다.
  - `시험보기` 클릭 시 대시보드 위에 팝업 형태로 미니 퀴즈를 띄우고, 백엔드는 `POST /mini-quiz/{project_id}/generate?node_id=...` → `POST /mini-quiz/{project_id}/submit` 순서로 호출한다.
  - UI는 수준진단 퀴즈 컴포넌트와 동일한 형태를 재사용한다.
- 그래프 노드 상세에 풀이 이력 섹션을 추가했다.
  - 노드 상세 패널 하단에서 `GET /graph/nodes/{node_id}/quiz-history`를 호출해 해당 개념의 수준진단/미니퀴즈 풀이 이력을 표시한다.

## 2026-05-12 이전 변경 (요약)

- 백엔드 프로젝트 목록 정렬을 프론트에서 보완했다 — `/chat/project/{project_id}` 로그의 최신 시각도 함께 본다.

## 전체 연결 구조

프론트엔드는 Next.js 앱이고, 백엔드는 FastAPI 앱이다.

프론트 API 호출은 대부분 `frontend/features/api/client.js`의 `apiRequest()`를 통한다.

```text
Frontend service function
-> apiRequest("/projects/me")
-> browser fetch("/api/backend/projects/me")
-> Next.js rewrite
-> BACKEND_API_URL + "/api/projects/me"
-> FastAPI route in app/api/routes/*.py
```

Next rewrite는 `frontend/next.config.mjs`에 있다.

```js
source: "/api/backend/:path*"
destination: `${process.env.BACKEND_API_URL || "http://localhost:8000"}/api/:path*`
```

즉, 프론트 코드에서 `apiRequest("/users/1")`를 호출하면 실제 브라우저 요청은 `/api/backend/users/1`이고, Next 서버가 이를 `http://localhost:8000/api/users/1`로 프록시한다.

## 프론트 환경변수

로컬에서 백엔드까지 붙일 때 `frontend/.env.local`에 필요한 값:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=google-oauth-client-id.apps.googleusercontent.com
NEXT_PUBLIC_USE_BACKEND_API=true
BACKEND_API_URL=http://localhost:8000
```

각 값의 의미:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: 브라우저에서 Google Identity Services를 초기화할 때 쓰는 OAuth Client ID.
- `NEXT_PUBLIC_USE_BACKEND_API`: `"true"`일 때 mock/localStorage 대신 실제 백엔드 API를 쓰는 서비스들이 있다.
- `BACKEND_API_URL`: Next.js rewrite가 FastAPI로 넘길 때 사용하는 서버 주소. 브라우저에 직접 노출되는 값은 아니고 Next 서버 런타임에서 사용한다.
- `NEXT_PUBLIC_API_BASE_URL`: 설정하면 `apiRequest()`의 기본 base URL인 `/api/backend`를 대체한다. 일반 로컬 개발에서는 보통 설정하지 않는다.
- `NEXT_PUBLIC_EEUM_USER_ID`: 개발용으로 특정 user_id를 강제할 수 있는 fallback 값이다.

주의:

- Google OAuth Client Secret, JWT Secret은 프론트 `.env.local`에 넣으면 안 된다.
- `.env.local` 변경 후에는 Next dev server를 재시작해야 한다.

## 공통 응답 처리

백엔드는 대체로 `app/utils/response.py`의 형태로 응답한다.

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

프론트 `apiRequest()`는 기본적으로 응답 JSON에 `data` 키가 있으면 `payload.data`만 반환한다. 따라서 프론트 서비스 함수들은 보통 백엔드 응답 전체가 아니라 `data`만 받는다고 보면 된다.

예외적으로 `data` 옆 sibling 필드가 필요한 API는 `apiRequest(path, { unwrap: false })`를 사용해 전체 payload를 받는다. 현재 대표 사례는 Mini-Quiz의 `group`/`groups` 보존이다.

에러 처리:

- HTTP status가 `2xx`가 아니면 `ApiError`를 throw한다.
- HTTP status는 성공이지만 `{ success: false }`이면 `unwrap` 값과 무관하게 `ApiError`를 throw한다.

## 현재 인증/세션 구조

현재는 완전한 JWT 인증 구조가 아니다.

프론트 세션 파일:

- `frontend/features/api/session.js`

localStorage 키:

- `eeum-api-access-token`
- `eeum-current-api-user-id`
- `eeum-google-login-active`

현재 흐름:

```text
Google 로그인 성공
-> Google userinfo API에서 email/name/profile_image 조회
-> POST /api/backend/users/google
-> 백엔드가 user_id와 access_token 반환
-> 프론트가 access_token과 user_id를 localStorage에 저장
-> apiRequest()가 Authorization 헤더 주입
-> /dashboard 이동
```

현재 백엔드에는 `POST /api/users/google` 라우트가 있으며, 프론트 `loginWithGoogleProfile()`과 연결되어 있다.

현재 `ensureCurrentUser()`는 저장된 user_id가 없으면 임시 로컬 사용자를 생성한다.

```text
POST /api/users/
PATCH /api/users/{user_id}
```

이 fallback은 Google 계정과 연결된 사용자가 아니라 `local-dev-...@eeum.local` 형태의 임시 사용자다.

## Google OAuth 프론트 흐름

파일:

- `frontend/app/login/page.tsx`

사용 방식:

- Google Identity Services script 로드: `https://accounts.google.com/gsi/client`
- `google.accounts.oauth2.initTokenClient()` 사용
- scope: `openid email profile`
- access token을 받은 뒤 `https://www.googleapis.com/oauth2/v3/userinfo` 호출
- userinfo에서 `email`, `name`, `picture`를 읽어 `loginWithGoogleProfile()` 호출

현재 로그인 API 기대 계약:

```http
POST /api/users/google
Content-Type: application/json
```

요청:

```json
{
  "email": "user@gmail.com",
  "nickname": "User Name",
  "profile_image": "https://..."
}
```

프론트가 기대하는 응답 data:

```json
{
  "user_id": 1,
  "email": "user@gmail.com",
  "nickname": "User Name",
  "profile_image": "https://..."
}
```

보안상 더 나은 장기 구조:

```text
Frontend receives Google ID token
-> Backend verifies Google ID token
-> Backend upserts user
-> Backend issues service JWT
-> Frontend sends Authorization: Bearer <jwt> for protected APIs
```

현재 코드는 아직 이 구조가 아니며, API 요청에 `Authorization` 헤더를 붙이지 않는다.

## 백엔드 라우터 등록

파일:

- `app/main.py`

등록된 prefix:

```text
/api/users          -> app/api/routes/users.py
/api/projects       -> app/api/routes/projects.py
/api/learning-logs  -> app/api/routes/learning_logs.py
/api/mypage         -> app/api/routes/mypage.py
/api/chat           -> app/api/routes/chat.py
/api/projects       -> app/api/routes/project_memos.py
/api/upload         -> app/api/routes/upload.py
/api/graph          -> app/api/routes/graph.py
/api/explanation    -> app/api/routes/explanation.py
/api/diagnosis      -> app/api/routes/diagnosis.py
/api/mini-quiz      -> app/api/routes/mini_quiz.py
```

## API 매핑

### Users

프론트:

- `frontend/features/api/session.js`

백엔드:

- `app/api/routes/users.py`
- `app/services/user_service.py`
- `app/schemas/user.py`

현재 구현된 백엔드 API:

```http
POST /api/users/
```

요청:

```json
{
  "email": "local-dev@example.com",
  "nickname": "이지안",
  "profile_image": null
}
```

응답 data:

```json
{
  "user_id": 1,
  "email": "...",
  "nickname": "...",
  "profile_image": null,
  "created_at": "..."
}
```

```http
GET /api/users/{user_id}
```

응답 data:

```json
{
  "user_id": 1,
  "email": "...",
  "nickname": "...",
  "profile_image": null,
  "major": "...",
  "learning_fields": "...",
  "current_level": "...",
  "preferred_explanation_style": "...",
  "learning_goal": "..."
}
```

```http
PATCH /api/users/{user_id}
```

요청 가능한 필드:

```json
{
  "nickname": "...",
  "profile_image": "...",
  "major": "...",
  "learning_fields": "...",
  "current_level": "...",
  "preferred_explanation_style": "example",
  "learning_goal": "..."
}
```

프론트 반영 상태:

- `loginWithGoogleProfile()`은 `POST /users/google`을 호출하고, 현재 백엔드에 해당 라우트가 있다.
- `mapProfileToApiUpdate()`는 `nickname`, `preferred_explanation_style`, `major`, `learning_fields`, `learning_goal`을 보낸다.
- `profile_image`는 사용자가 프로필 이미지를 실제로 변경한 경우에만 보낸다. 텍스트만 저장할 때 기존 서버 이미지를 `null`로 덮어쓰지 않기 위한 정책이다.
- `current_level`은 백엔드 스키마가 받지만 현재 프론트 `ProfileInfo`에 독립 입력값이 없어 임의 생성하지 않는다.

### Projects

프론트:

- `frontend/features/dashboard/service.ts`

백엔드:

- `app/api/routes/projects.py`
- `app/services/project_service.py`
- `app/schemas/project.py`

프론트 호출:

```text
getProjects()
-> GET /projects/me

selectProjectFromCatalog()
-> POST /projects/
```

백엔드 API:

```http
POST /api/projects/
```

요청:

```json
{
  "project_domain": "operating_system",
  "project_description": "선택"
}
```

`user_id`는 body에 넣지 않는다. 백엔드는 인증된 `current_user`를 사용한다.

`project_description`은 백엔드가 optional로 받지만, 현재 프론트 카탈로그 생성 흐름은 `project_domain`만 보낸다.

`project_domain`은 아래 값 중 하나만 사용할 수 있고, 백엔드는 해당 값에 맞는 교과목명을 `project_name`으로 저장한다.

- `operating_system` -> `운영체제`
- `data_structure` -> `자료구조`
- `algorithm` -> `알고리즘`
- `computer_network` -> `컴퓨터 네트워크`

응답 data:

```json
{
  "project_id": 1,
  "user_id": 1,
  "project_name": "운영체제",
  "project_description": "...",
  "project_domain": "operating_system",
  "created_at": "..."
}
```

```http
GET /api/projects/me
```

응답 data는 project 배열이다.

프로젝트 메모:

프론트는 백엔드의 다중 메모 CRUD API를 사용한다.

```text
GET /api/projects/{project_id}/memos
POST /api/projects/{project_id}/memos
GET /api/projects/{project_id}/memos/{memo_id}
PATCH /api/projects/{project_id}/memos/{memo_id}
DELETE /api/projects/{project_id}/memos/{memo_id}
```

현재 백엔드에는 `app/api/routes/project_memos.py`가 `/api/projects` prefix로 등록되어 있어 위 API와 연결된다.

### Chat

프론트:

- `frontend/features/dashboard/service.ts`

백엔드:

- `app/api/routes/chat.py`
- `app/schemas/chat.py`

프론트 호출:

```text
getProjectChats(projectId)
-> GET /projects/{project_id}/chat-sessions
-> GET /chat/{project_id}/sessions/{session_id} for each session

createChat(projectId)
-> POST /projects/{project_id}/chat-sessions

removeChat(projectId, chatId)
-> DELETE /projects/{project_id}/chat-sessions/{session_id}

sendChatMessage(projectId, chatId, message, responseType)
-> POST /chat/{project_id}?session_id=...
```

현재 프론트 정책:

- 프로젝트당 다중 thread를 사용한다.
- thread id는 `${projectId}-session-${session.id}` 형식의 문자열이다. URL `chatId`도 이 값을 사용한다.
- 새 채팅방 생성 시 title 입력 UI는 추가하지 않고, 백엔드 기본값 `"새 채팅방"`을 사용한다.
- 사이드바 title은 백엔드 `ChatSession.title`을 그대로 표시한다. 첫 사용자 메시지 fallback은 사용하지 않는다.
- 프로젝트 첫 진입 시 세션을 자동 생성하지 않는다. 사용자가 `새 채팅`을 누르거나 세션 0개 상태에서 메시지를 전송할 때 생성한다.
- 삭제는 기존 채팅 메뉴의 삭제 버튼에 연결되어 있으며, 삭제 전 `confirm`을 띄운다. 마지막 세션도 삭제할 수 있다.

백엔드 API:

```http
POST /api/chat/{project_id}?session_id={session_id}
```

요청:

```json
{
  "message": "질문",
  "response_type": "default"
}
```

인증 토큰이 없는 fallback 상황에서는 백엔드 `ChatRequest.user_id`를 받을 수 있지만, 현재 프론트의 정상 백엔드 모드 요청은 access token 기반이라 body에 `user_id`를 넣지 않는다.

응답 data:

```json
{
  "chat_id": 1,
  "session_id": 10,
  "user_id": 1,
  "project_id": 1,
  "user_message": "질문",
  "ai_response": "응답",
  "response_type": "default",
  "mini_quiz_trigger": {
    "needed": true,
    "concepts": [
      { "concept_id": 1, "node_id": "uuid", "name": "프로세스", "mention_count": 4 }
    ]
  },
  "grounding": {
    "grounding_source": "uploaded",
    "grounding_level": "project",
    "confidence_note": "...",
    "used_uploaded_context": true,
    "used_backbone": false
  },
  "concept_counting": {
    "turn_count": 6,
    "check_interval": 3,
    "window_size": 3,
    "should_check_quiz": true,
    "counted_concepts": [
      { "concept_id": 1, "node_id": "uuid", "name": "프로세스", "mention_count": 4 }
    ],
    "quiz_ready_concepts": [
      { "concept_id": 1, "node_id": "uuid", "name": "프로세스", "mention_count": 4 }
    ]
  },
  "created_at": "..."
}
```

Mini-Quiz 트리거 정책:

- 현재 프론트는 `concept_counting.quiz_ready_concepts`가 비어있지 않을 때 해당 채팅 말풍선에 미니퀴즈 트리거 UI를 렌더한다 (`시험보기` / `나중에보기`).
- `mini_quiz_trigger`는 같은 의미의 간결 응답이지만, 프론트의 판단 기준은 아직 바꾸지 않는다.
- `grounding`은 응답에 포함되지만, 현재 표시 UI가 없어 사용하지 않는다.

```http
GET /api/projects/{project_id}/chat-sessions
```

응답 data:

```json
[
  {
    "id": 10,
    "project_id": 1,
    "title": "새 채팅방",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

```http
POST /api/projects/{project_id}/chat-sessions
```

요청 body는 비워둘 수 있다. 백엔드는 기본 title `"새 채팅방"`을 사용한다.

```json
{}
```

```http
DELETE /api/projects/{project_id}/chat-sessions/{session_id}
```

```http
GET /api/chat/{project_id}/sessions/{session_id}
```

응답 data는 해당 세션의 chat log 배열이다. 저장된 chat log에는 `concept_counting`, `mini_quiz_trigger`, `grounding`이 포함되지 않으므로, 미니퀴즈 트리거 표시는 현재 POST 응답에서 받은 값을 프론트 state에 보존해 사용한다.

참고로 아래 프로젝트 전체 chat log API는 마이페이지 통계 등 전체 합산이 필요한 곳에서만 유지한다.

```text
GET /api/chat/project/{project_id}
```

### Upload

프론트:

- `frontend/features/upload/service.js`
- `frontend/features/upload/api-service.js`

백엔드:

- `app/api/routes/upload.py`
- `app/schemas/file.py`

프론트 호출:

```text
listProjectFiles(projectId)
-> GET /upload/{project_id}

uploadProjectFiles(projectId, subject, files)
-> POST /upload/{project_id}

startAnalysis(projectId, fileIds)
-> POST /upload/{file_id}/analyze

refreshAnalysisStatuses(files)
-> GET /upload/{file_id}/status
```

백엔드 API:

```http
POST /api/upload/{project_id}
Content-Type: multipart/form-data
```

form-data:

```text
file=<PDF file>
```

응답 data:

```json
{
  "file_id": "...",
  "project_id": "...",
  "file_name": "...",
  "s3_key": "...",
  "file_type": "...",
  "uploaded_at": "...",
  "analysis_status": "UPLOADED"
}
```

```http
GET /api/upload/{project_id}
POST /api/upload/{file_id}/analyze
GET /api/upload/{file_id}/status
```

분석 상태 값:

```text
UPLOADED | PROCESSING | DONE | FAILED
```

주의:

- `POST /upload/{project_id}`와 `POST /upload/{file_id}/analyze`가 같은 prefix 아래에 있어 path shape가 비슷하다. HTTP method와 suffix로 구분된다.
- `use_s3=True`가 기본이라 로컬에서 S3 권한/설정이 없으면 업로드가 실패할 수 있다. 백엔드 `.env`의 `USE_S3=false` 또는 관련 서비스 구현 확인이 필요하다.

### Graph

프론트:

- `frontend/features/dashboard/service.ts`
- `frontend/features/diagnosis/api-service.js`
- `frontend/features/mypage/service.ts`

백엔드:

- `app/api/routes/graph.py`

프론트 호출:

```text
getProjectGraphData(projectId)
-> GET /graph/{project_id}

getRecentGraphNodes(projectId)
-> GET /graph/{project_id}/recent

getGraphNodeDetail(nodeId)
-> GET /graph/nodes/{node_id}
```

백엔드 API:

```http
GET /api/graph/{project_id}
```

응답 data:

```json
{
  "nodes": [],
  "edges": []
}
```

```http
GET /api/graph/{project_id}/recent
GET /api/graph/nodes/{node_id}
GET /api/graph/nodes/{node_id}/quiz-history
```

`quiz-history` 응답 data는 `QuizQuestionReview` 배열이다:

```json
[
  {
    "question_id": "uuid",
    "concept_id": "uuid",
    "question": "...",
    "choices": [
      { "option_id": "A", "text": "...", "is_correct": true, "is_selected": true }
    ],
    "correct_option_ids": ["A"],
    "selected_option_ids": ["A"],
    "is_fully_correct": true,
    "partial_score": 1.0,
    "answer_score": 1.0,
    "explanation": "..."
  }
]
```

현재 주의점:

- `GET /api/graph/me`는 미구현이다 (백엔드가 `null` 반환).

### Diagnosis

프론트:

- `frontend/features/diagnosis/api-service.js`

백엔드:

- `app/api/routes/diagnosis.py`
- `app/schemas/diagnosis.py`
- `app/schemas/quiz_review.py`

프론트 호출:

```text
createApiDiagnosisSession(projectId)
-> POST /diagnosis/{project_id}/sessions

createApiDiagnosisQuestion(projectId, sessionId?)
-> POST /diagnosis/{project_id}/questions?session_id=...

submitApiDiagnosisAnswer(projectId, sessionId, questionId, { selectedIndex, selectedOptionIds, isSkipped })
-> POST /diagnosis/{project_id}/answers

getApiDiagnosisStatus(projectId, sessionId)
-> GET /diagnosis/{project_id}/status?session_id=...

createApiDiagnosisReport(projectId, sessionId)
-> POST /diagnosis/{project_id}/report

getApiDiagnosisNodes(projectId, questionId?)
-> GET /diagnosis/{project_id}/nodes?question_id=...

getApiDiagnosisReview(projectId, sessionId)
-> GET /diagnosis/{project_id}/sessions/{session_id}/review
```

백엔드 API:

```http
POST /api/diagnosis/{project_id}/sessions
```

응답 data:

```json
{
  "session_id": "uuid"
}
```

```http
POST /api/diagnosis/{project_id}/questions?session_id=uuid
```

응답 data:

```json
{
  "question_id": "...",
  "concept_id": "...",
  "difficulty": "easy",
  "question_type": "concept_check",
  "diagnosis_purpose": "...",
  "question": "...",
  "choices": [
    { "option_id": "A", "text": "..." },
    { "option_id": "B", "text": "..." }
  ]
}
```

`choices`는 객체 배열(`option_id`, `text`) 또는 legacy 문자열 배열일 수 있다. multi-select 문제(`question_type === "multi_select"`)는 객체 배열 형태로 내려온다.

```http
POST /api/diagnosis/{project_id}/answers
```

요청:

```json
{
  "question_id": "...",
  "session_id": "uuid",
  "selected_index": 0,
  "selected_option_ids": ["A", "C"],
  "is_skipped": false
}
```

`selected_index`(legacy 단일 선택) 또는 `selected_option_ids`(복수 선택) 중 하나를 보낸다. multi-select 문제는 `selected_option_ids`만 보내면 된다.

응답 data:

```json
{
  "is_correct": true,
  "correct_index": 0,
  "is_fully_correct": true,
  "partial_score": 1.0,
  "answer_score": 1.0,
  "answer_level": 3,
  "correct_option_ids": ["A", "C"],
  "selected_option_ids": ["A", "C"],
  "missed_correct_option_ids": [],
  "wrong_selected_option_ids": [],
  "invalid_selected_option_ids": [],
  "updated_nodes": [
    { "node_id": "...", "status": "MASTERED", "understanding_score": 0.8 }
  ]
}
```

```http
GET /api/diagnosis/{project_id}/status?session_id=uuid
```

응답 data:

```json
{
  "session_id": "uuid",
  "answered": 1,
  "total_questions": 12,
  "progress_percent": 0
}
```

```http
POST /api/diagnosis/{project_id}/report
```

요청:

```json
{ "session_id": "uuid", "chat_session_id": 12 }
```

응답 data: 채팅 메시지 2개와 연결된 `chat_session`. `chat_session_id`를 요청에 넘기면 해당 ChatSession에 저장하고, 생략하면 백엔드가 `"수준진단 리포트"` ChatSession을 생성한 뒤 리포트 채팅을 연결한다.

```json
{
  "messages": [
    {
      "chat_id": 1,
      "session_id": 12,
      "project_id": 1,
      "user_message": null,
      "ai_response": "...",
      "response_type": "diagnosis_report",
      "created_at": "..."
    }
  ],
  "chat_session": {
    "id": 12,
    "project_id": 1,
    "title": "수준진단 리포트",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

```http
GET /api/diagnosis/{project_id}/nodes?question_id=...
```

응답 data:

```json
[
  { "node_id": "...", "name": "프로세스", "diagnosis_label": "진행 중" }
]
```

```http
GET /api/diagnosis/{project_id}/sessions/{session_id}/review
```

응답 data: `QuizQuestionReview` 배열. 현재 프론트의 `풀이보기` 버튼은 UI만 만들어 두었고 이 API 연결은 다음 작업으로 미뤘다.

### Mini-Quiz

프론트:

- `frontend/features/mini-quiz/api-service.js`
- `frontend/components/mini-quiz/MiniQuizPopup.jsx` (대시보드 위에 띄우는 팝업)
- `frontend/components/dashboard/dashboard-page-view.jsx` 채팅 메시지 안의 트리거 버튼

백엔드:

- `app/api/routes/mini_quiz.py`
- `app/schemas/mini_quiz.py`
- `app/schemas/quiz_review.py`

프론트 호출:

```text
generateApiMiniQuizQuestion(projectId, nodeId)
-> POST /mini-quiz/{project_id}/generate?node_id=...

submitApiMiniQuizAnswer(projectId, questionId, { selectedOptionIds, isSkipped })
submitApiMiniQuizAnswers(projectId, answers[])
-> POST /mini-quiz/{project_id}/submit

deferApiMiniQuizQuestion(projectId, nodeId)
-> POST /mini-quiz/{project_id}/defer?node_id=...

getApiDeferredMiniQuizzes(projectId)
-> GET /mini-quiz/{project_id}/deferred

getApiMiniQuizReview(projectId, questionIds[])
-> GET /mini-quiz/{project_id}/review?question_ids=q1,q2
```

백엔드 API:

```http
POST /api/mini-quiz/{project_id}/generate?node_id=...
```

응답 payload:

```json
{
  "success": true,
  "data": [
    { "question_id": "...", "question": "...", "choices": [] }
  ],
  "group": {
    "node_id": "...",
    "node_name": "...",
    "question_ids": ["..."]
  },
  "message": ""
}
```

주의:

- `data`는 단일 객체가 아니라 `DiagnosisQuestionResponse[]` 배열이다.
- `group`은 `data`의 sibling 필드다. 프론트는 `apiRequest(..., { unwrap: false })`로 전체 payload를 받아 보존한다.
- generate 응답의 `group`에는 `group_id`가 없다.

```http
POST /api/mini-quiz/{project_id}/submit
```

요청:

```json
{
  "question_id": "...",
  "selected_option_ids": ["A"],
  "is_skipped": false
}
```

여러 문항을 한 번에 제출할 때는 `answers` 배열을 사용한다.

```json
{
  "answers": [
    {
      "question_id": "...",
      "selected_option_ids": ["A"],
      "is_skipped": false
    }
  ]
}
```

응답 data:

```json
{
  "is_fully_correct": true,
  "partial_score": 1.0,
  "answer_score": 1.0,
  "answer_level": 3,
  "correct_option_ids": ["A"],
  "selected_option_ids": ["A"],
  "missed_correct_option_ids": [],
  "wrong_selected_option_ids": [],
  "invalid_selected_option_ids": [],
  "updated_node": { "node_id": "...", "status": "MASTERED", "understanding_score": 0.85 }
}
```

```http
POST /api/mini-quiz/{project_id}/defer?node_id=...
```

응답 payload는 generate와 동일하게 `data: DiagnosisQuestionResponse[]` 배열과 sibling `group`을 포함한다.

```http
GET /api/mini-quiz/{project_id}/deferred
```

응답 payload:

```json
{
  "success": true,
  "data": [
    { "question_id": "...", "node_id": "...", "question": "..." }
  ],
  "groups": [
    {
      "group_id": "...",
      "node_id": "...",
      "node_name": "...",
      "questions": []
    }
  ],
  "message": ""
}
```

`groups` 역시 `data`의 sibling 필드라 `unwrap: false`로 보존한다.

```http
GET /api/mini-quiz/{project_id}/review?question_ids=q1,q2
```

응답 data: `QuizQuestionReview` 배열.

트리거 조건:
- `POST /chat/{project_id}` 응답의 `concept_counting.quiz_ready_concepts`가 비어있지 않은 경우.
- 프론트는 채팅 말풍선 안에 "시험 준비됨" + `시험보기` / `나중에보기` 버튼을 그린다.
- `시험보기` 클릭 → `quiz_ready_concept.node_id`로 `generate` 호출 → 응답 배열을 `conceptQueue`로 변환해 팝업 표시.

### Explanation

프론트:

- `frontend/features/dashboard/service.ts`

백엔드:

- `app/api/routes/explanation.py`
- `app/schemas/explanation.py`

프론트 호출:

```text
createExplanation({ projectId, nodeId, question, explanationStyle })
-> POST /explanation
```

백엔드 API:

```http
POST /api/explanation
```

요청:

```json
{
  "project_id": 1,
  "node_id": "optional-node-id",
  "question": "질문",
  "explanation_style": "example"
}
```

`explanation_style`은 백엔드가 허용하는 `"example" | "concise" | "step"`일 때만 보낸다. 프론트 프로필 값 `"deep"`은 백엔드 Literal에 없으므로 omit한다.

응답 data:

```json
{
  "explanation": "AI 설명"
}
```

### Learning Logs

프론트:

- `frontend/features/learning-log/service.js`
- `frontend/features/mypage/service.ts`

백엔드:

- `app/api/routes/learning_logs.py`

프론트 호출:

```text
createLearningLog()
-> POST /learning-logs/

getApiMyPageViewData()
-> GET /learning-logs/me
```

백엔드 API:

```http
POST /api/learning-logs/
```

요청:

```json
{
  "project_id": 1,
  "activity_type": "diagnosis_completed",
  "activity_summary": "..."
}
```

정상 백엔드 모드에서는 Authorization token의 `current_user`를 사용하므로 `user_id`를 body에 넣지 않는다.

```http
GET /api/learning-logs/me
```

응답 data는 learning log 배열이다.

### MyPage

프론트:

- `frontend/features/mypage/service.ts`

백엔드:

- `app/api/routes/mypage.py`

프론트 호출:

```text
getApiMyPageViewData()
-> GET /mypage/me
-> GET /projects/me
-> GET /learning-logs/me
-> GET /graph/{project_id} for recent projects only
-> GET /chat/project/{project_id} for recent projects only
```

백엔드 API:

```http
GET /api/mypage/me
```

응답 data:

```json
{
  "user": {
    "user_id": 1,
    "email": "...",
    "nickname": "...",
    "profile_image": null,
    "major": "...",
    "learning_fields": "...",
    "current_level": "...",
    "preferred_explanation_style": "...",
    "learning_goal": "..."
  },
  "summary": {
    "project_count": 0,
    "recent_learning_count": 0
  },
  "recent_projects": [],
  "recent_logs": []
}
```

프론트는 마이페이지 통계 계산을 위해 별도 API들을 추가로 호출한다. 다만 백엔드에 전체 `concept_count`/`chat_count` 집계 필드가 없으므로, 현재는 최근 5개 프로젝트만 graph/chat detail API를 조회해 N+1 비용을 제한한다. 제한 계산일 때 UI 라벨은 `최근 학습 횟수`, `최근 이해 개념`으로 표시한다.

## Mock/API 전환 상태

`NEXT_PUBLIC_USE_BACKEND_API === "true"`일 때 실제 백엔드 API를 쓰는 주요 영역:

- Dashboard projects/chats/graph/explanation/memo
- Upload files/analysis
- Diagnosis
- Learning logs
- MyPage
- Landing CTA의 로그인 분기

하지만 로그인 페이지의 Google 로그인은 `NEXT_PUBLIC_USE_BACKEND_API` 값과 무관하게 `loginWithGoogleProfile()`을 호출하고, 이 함수는 항상 `/users/google` 백엔드 API를 호출한다.

## 현재 주요 TODO와 위험 지점

1. 인증/세션 정리 필요
   - Google 로그인 후 access token을 localStorage에 저장하고 `apiRequest()`가 Authorization 헤더를 중앙 주입한다.
   - 동시에 user_id fallback/localStorage 경로도 일부 남아 있어, 배포 전에는 token 기반 경로와 로컬 fallback 경계를 명확히 정리해야 한다.

2. 채팅방 rename 미지원
   - 백엔드 ChatSession API에는 rename용 PATCH 라우트가 없다.
   - 프론트의 이름 수정 메뉴는 아직 기능 연결하지 않는다.
   - rename UX가 필요하면 백엔드 PATCH 라우트 추가 후 별도 작업으로 연결한다.

3. 백엔드 프로젝트 최신 접근 시간 미갱신
   - 채팅 저장 시 `projects.last_accessed_at`을 백엔드에서 갱신하지 않는다.
   - 프론트는 `last_accessed_at`이 없는 프로젝트에 한해 채팅 로그를 조회해 최신 채팅 기준으로 정렬하도록 보완했다.
   - 장기적으로는 백엔드 `save_chat()`에서 프로젝트 접근 시간을 갱신하는 편이 효율적이다.

4. Mini-Quiz trigger source
   - 현재 UI 기준은 `concept_counting.quiz_ready_concepts`다.
   - `mini_quiz_trigger`와 `grounding`은 백엔드 응답에 있으나, 별도 UI/정책이 생기기 전까지 사용하지 않는다.

5. S3/AWS 설정
   - 업로드 API는 S3 업로드를 기본으로 한다.
   - 로컬 테스트에서 AWS credential, bucket, region 설정이 없으면 실패할 수 있다.

6. CORS
   - 현재 FastAPI는 `allow_origins=["*"]`이다.
   - Next rewrite를 통하면 브라우저 기준 same-origin이라 CORS 문제가 줄어든다.
   - 배포 시 직접 API 도메인을 호출하는 구조로 바꾸면 CORS origin 제한을 재검토해야 한다.

## Codex 수정 우선순위 제안

프론트-백 연동을 안정화하려면 다음 순서가 가장 작고 명확하다.

1. 채팅방 rename API 협의
   - 현재는 백엔드 `ChatSession.title`을 그대로 표시한다.
   - 이름 수정 UX가 필요하면 PATCH 라우트와 프론트 메뉴 동작을 함께 설계한다.

2. 로그인 성공 후 `/dashboard` 이동 확인
   - `frontend/app/login/page.tsx`는 이미 `router.push("/dashboard")`를 호출한다.
   - API만 성공하면 이동한다.

3. `NEXT_PUBLIC_USE_BACKEND_API=true`로 켜고 기본 flow 확인
   - `/dashboard`
   - 프로젝트 생성/조회
   - 업로드
   - 채팅
   - 진단
   - 마이페이지

4. JWT 인증 도입 여부 결정
   - 도입한다면 `apiRequest()`에서 Authorization 헤더를 중앙 주입하는 방식이 가장 자연스럽다.
