# Frontend-Backend API 연결 정리

이 문서는 Codex가 나중에 프론트엔드와 백엔드 연동 상태를 빠르게 판단하고 수정할 수 있도록, 현재 코드 기준의 API 연결 구조와 계약을 정리한 것이다.

## 2026-05-12 프론트 연동 수정 완료 내역

이번 수정은 `frontend/` 안의 코드만 변경했고, `app/` 백엔드 코드는 수정하지 않았다.

- 진단 API 프론트를 백엔드의 현재 계약에 맞췄다.
  - `POST /diagnosis/{project_id}/sessions`로 `session_id`를 먼저 발급받는다.
  - 질문 응답은 `diagnosis_id`가 아니라 `question_id`, `concept_id`를 사용한다.
  - 답변 제출 body는 `question_id`, `session_id`, `selected_index`, `is_skipped`로 보낸다.
  - 상태 조회는 `GET /diagnosis/{project_id}/status?session_id=...` 형식으로 호출한다.
- 프로필 수정 요청에서 백엔드 `UserProfileUpdate`가 받지 않는 필드를 제거했다.
  - 프론트가 API로 보내는 필드는 `nickname`, `profile_image`, `preferred_explanation_style`만이다.
  - `major`, `learning_fields`, `learning_goal`, `interest_field`는 현재 백엔드 PATCH 스키마가 받지 않으므로 API 요청에서 제외했다.
  - 마이페이지 저장 후에는 백엔드 응답으로 로컬 프로필을 덮어쓰지 않고, 사용자가 입력한 프론트 상태를 유지한다.
- 백엔드 모드 프로젝트 목록 정렬을 프론트에서 보완했다.
  - `/projects/user/{user_id}`의 `last_accessed_at`만 믿지 않고, 각 프로젝트의 `/chat/project/{project_id}` 로그를 조회한다.
  - 프로젝트 자체 시간과 최신 채팅 시간을 비교해 더 최신인 값으로 `updatedAt`을 계산하고 정렬한다.
  - 따라서 백엔드가 `last_accessed_at`을 아직 갱신하지 않아도 프론트 목록은 최근 채팅한 프로젝트를 위로 올린다.

## 전체 연결 구조

프론트엔드는 Next.js 앱이고, 백엔드는 FastAPI 앱이다.

프론트 API 호출은 대부분 `frontend/features/api/client.js`의 `apiRequest()`를 통한다.

```text
Frontend service function
-> apiRequest("/projects/user/1")
-> browser fetch("/api/backend/projects/user/1")
-> Next.js rewrite
-> BACKEND_API_URL + "/api/projects/user/1"
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

프론트 `apiRequest()`는 응답 JSON에 `data` 키가 있으면 `payload.data`만 반환한다. 따라서 프론트 서비스 함수들은 보통 백엔드 응답 전체가 아니라 `data`만 받는다고 보면 된다.

에러 처리:

- HTTP status가 `2xx`가 아니면 `ApiError`를 throw한다.
- HTTP status는 성공이지만 `{ success: false }`이면 `ApiError`를 throw한다.

## 현재 인증/세션 구조

현재는 완전한 JWT 인증 구조가 아니다.

프론트 세션 파일:

- `frontend/features/api/session.js`

localStorage 키:

- `eeum-current-api-user-id`
- `eeum-google-login-active`

현재 흐름:

```text
Google 로그인 성공
-> Google userinfo API에서 email/name/profile_image 조회
-> POST /api/backend/users/google
-> 백엔드가 user_id 반환해야 함
-> 프론트가 user_id를 localStorage에 저장
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
  "preferred_explanation_style": "example"
}
```

프론트 반영 상태:

- `loginWithGoogleProfile()`은 `POST /users/google`을 호출하고, 현재 백엔드에 해당 라우트가 있다.
- `mapProfileToApiUpdate()`는 백엔드 `UserProfileUpdate`가 받는 `nickname`, `profile_image`, `preferred_explanation_style`만 보낸다.
- `major`, `learning_fields`, `learning_goal`, `interest_field`는 현재 백엔드 PATCH 스키마가 받지 않으므로 프론트 API 요청에서 제외한다.

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
-> GET /projects/user/{user_id}

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
  "user_id": 1,
  "project_domain": "operating_system"
}
```

`project_domain`은 아래 값 중 하나만 사용할 수 있고, 백엔드는 해당 값에 맞는 교과목명을 `project_name`으로 저장합니다.

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
GET /api/projects/user/{user_id}
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
-> GET /chat/project/{project_id}

sendChatMessage(projectId, message, responseType)
-> POST /chat/{project_id}
```

백엔드 API:

```http
POST /api/chat/{project_id}
```

요청:

```json
{
  "user_id": 1,
  "message": "질문",
  "response_type": "default"
}
```

응답 data:

```json
{
  "chat_id": 1,
  "user_id": 1,
  "project_id": 1,
  "user_message": "질문",
  "ai_response": "응답",
  "response_type": "default",
  "updated_nodes": [],
  "created_at": "..."
}
```

```http
GET /api/chat/project/{project_id}
```

응답 data는 chat log 배열이다.

프론트는 chat log 배열을 하나의 thread로 합쳐서 화면에 보여준다.

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
```

현재 주의점:

- `GET /api/graph/me`는 미구현이며 현재 query parameter `user_id`를 직접 받는 형태다.
- 코드 TODO에 JWT에서 user_id를 파싱하도록 변경 예정이라고 적혀 있다.

### Diagnosis

프론트:

- `frontend/features/diagnosis/api-service.js`

백엔드:

- `app/api/routes/diagnosis.py`
- `app/schemas/diagnosis.py`

프론트 호출:

```text
createApiDiagnosisSession(projectId)
-> POST /diagnosis/{project_id}/sessions

createApiDiagnosisQuestion(projectId)
-> POST /diagnosis/{project_id}/questions

submitApiDiagnosisAnswer(projectId, sessionId, questionId, selectedIndex, isSkipped)
-> POST /diagnosis/{project_id}/answers

getApiDiagnosisStatus(projectId, sessionId)
-> GET /diagnosis/{project_id}/status?session_id=...
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
POST /api/diagnosis/{project_id}/questions
```

응답 data:

```json
{
  "question_id": "...",
  "concept_id": "...",
  "difficulty": "easy",
  "question_type": "concept_check",
  "affects": ["node-id"],
  "question": "...",
  "choices": ["...", "...", "...", "..."]
}
```

```http
POST /api/diagnosis/{project_id}/answers
```

요청:

```json
{
  "question_id": "...",
  "session_id": "uuid",
  "selected_index": 0,
  "is_skipped": false
}
```

응답 data:

```json
{
  "is_correct": true,
  "correct_index": 0,
  "updated_nodes": [
    {
      "node_id": "...",
      "status": "MASTERED",
      "understanding_score": 0.8
    }
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

### Explanation

프론트:

- `frontend/features/dashboard/service.ts`

백엔드:

- `app/api/routes/explanation.py`
- `app/schemas/explanation.py`

프론트 호출:

```text
createExplanation({ projectId, nodeId, question })
-> POST /explanation
```

백엔드 API:

```http
POST /api/explanation
```

요청:

```json
{
  "project_id": "1",
  "user_id": "1",
  "node_id": "optional-node-id",
  "question": "질문"
}
```

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
-> GET /learning-logs/user/{user_id}
```

백엔드 API:

```http
POST /api/learning-logs/
```

요청:

```json
{
  "user_id": 1,
  "project_id": 1,
  "activity_type": "diagnosis_completed",
  "activity_summary": "..."
}
```

```http
GET /api/learning-logs/user/{user_id}
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
-> GET /mypage/{user_id}
-> GET /projects/user/{user_id}
-> GET /learning-logs/user/{user_id}
-> GET /graph/{project_id} for each project
-> GET /chat/project/{project_id} for each project
```

백엔드 API:

```http
GET /api/mypage/{user_id}
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

프론트는 마이페이지 통계 계산을 위해 별도 API들을 추가로 호출한다.

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

1. JWT 인증 미적용
   - 현재 프론트는 user_id를 localStorage에 저장하고 API body/path에 직접 사용한다.
   - 사용자가 localStorage 값을 바꾸면 다른 user_id로 요청할 수 있다.
   - EC2 배포 전에는 인증 방식 합의가 필요하다.

2. 프로필 상세 필드 PATCH 미지원
   - 현재 백엔드 `UserProfileUpdate`는 `nickname`, `profile_image`, `preferred_explanation_style`만 받는다.
   - 프론트는 이에 맞춰 API 요청 필드를 제한했다.
   - `major`, `learning_fields`, `learning_goal`까지 서버 저장이 필요하면 백엔드 스키마 확장이 필요하다.

3. 백엔드 프로젝트 최신 접근 시간 미갱신
   - 채팅 저장 시 `projects.last_accessed_at`을 백엔드에서 갱신하지 않는다.
   - 프론트는 임시로 각 프로젝트의 채팅 로그를 조회해 최신 채팅 기준으로 정렬하도록 보완했다.
   - 장기적으로는 백엔드 `save_chat()`에서 프로젝트 접근 시간을 갱신하는 편이 효율적이다.

4. S3/AWS 설정
   - 업로드 API는 S3 업로드를 기본으로 한다.
   - 로컬 테스트에서 AWS credential, bucket, region 설정이 없으면 실패할 수 있다.

5. CORS
   - 현재 FastAPI는 `allow_origins=["*"]`이다.
   - Next rewrite를 통하면 브라우저 기준 same-origin이라 CORS 문제가 줄어든다.
   - 배포 시 직접 API 도메인을 호출하는 구조로 바꾸면 CORS origin 제한을 재검토해야 한다.

## Codex 수정 우선순위 제안

프론트-백 연동을 안정화하려면 다음 순서가 가장 작고 명확하다.

1. 백엔드 프로필 PATCH 스키마 확장 여부 결정
   - 마이페이지에서 전공/학습 분야/학습 목표를 서버에 저장하려면 `UserProfileUpdate`에 해당 필드가 필요하다.
   - 지금 프론트는 백엔드가 받는 필드만 보내도록 정리되어 있다.

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
