# Codex Conversation Notes

Last updated: 2026-05-10
Workspace: `/home/ec2-user/2026-capstone-52_front`

This file is a restart note for EC2 interruptions. It only contains the conversation context visible in the current Codex session.

## User Goal

- Analyze the frontend under `/home/ec2-user/2026-capstone-52_front/frontend`.
- Compare frontend API integration against the backend under `/home/ec2-user/2026-capstone-52/app`.
- Separate what is connected, partially connected, and not connected.
- Keep a local conversation summary file in the current working directory because the AWS EC2 instance sometimes stops.

## Environment

- Current working directory: `/home/ec2-user/2026-capstone-52_front`
- Frontend directory: `/home/ec2-user/2026-capstone-52_front/frontend`
- Backend app directory: `/home/ec2-user/2026-capstone-52/app`
- Frontend stack:
  - Next.js 15
  - React 19
  - TypeScript and JavaScript mixed
  - Tailwind CSS
  - Zustand
  - Framer Motion
  - Font Awesome
- Backend stack:
  - FastAPI
  - SQLAlchemy

## Frontend Structure Summary

- `frontend/app`: Next.js App Router routes.
  - `/`
  - `/login`
  - `/dashboard`
  - `/upload`
  - `/diagnosis`
  - `/mypage`
  - `/project/[projectId]`
- `frontend/components`: UI components grouped by page/domain.
  - `dashboard`
  - `upload`
  - `diagnosis`
  - `mypage`
  - `landing`
  - `graph`
  - `common`
  - `profile`
- `frontend/features`: domain logic and API adapters.
  - `api`: shared fetch client and temporary user session handling
  - `dashboard`: project/chat/graph/memo/explanation services
  - `upload`: upload API service and mock fallback
  - `diagnosis`: diagnosis API service and mock model
  - `mypage`: mypage aggregation service
  - `workspace`: localStorage fallback storage
  - `learning-log`: learning log API service
- `frontend/data`: mock data, especially mypage data.
- `frontend/store`: Zustand profile store.
- `frontend/types`: shared TypeScript types.
- `frontend/public/images`: static assets.

## API Configuration

Frontend common API wrapper:

- File: `frontend/features/api/client.js`
- Default API base URL: `/api/backend`
- Actual `.env.local` currently sets:
  - `NEXT_PUBLIC_USE_BACKEND_API=true`
  - `NEXT_PUBLIC_API_BASE_URL=http://54.198.199.167:8000/api`
  - `BACKEND_API_URL=http://54.198.199.167:8000`

Next.js rewrite:

- File: `frontend/next.config.mjs`
- `/api/backend/:path*` rewrites to `${BACKEND_API_URL || "http://localhost:8000"}/api/:path*`.

Backend router registration:

- File: `/home/ec2-user/2026-capstone-52/app/main.py`
- Registered prefixes:
  - `/api/users`
  - `/api/projects`
  - `/api/learning-logs`
  - `/api/mypage`
  - `/api/chat`
  - `/api/upload`
  - `/api/graph`
  - `/api/explanation`
  - `/api/diagnosis`

## Connected API Areas

These frontend calls have matching backend routes.

- Users
  - Frontend: `frontend/features/api/session.js`
  - Calls: `POST /users/`, `GET /users/{user_id}`, `PATCH /users/{user_id}`
  - Backend: `app/api/routes/users.py`
  - Status: connected, but uses temporary localStorage user creation instead of real auth.
- Projects
  - Frontend: `frontend/features/dashboard/service.ts`
  - Calls: `GET /projects/user/{user_id}`, `POST /projects/`
  - Backend: `app/api/routes/projects.py`
  - Status: connected.
- Project memos
  - Frontend: `frontend/features/dashboard/service.ts`
  - Calls: `GET /projects/{project_id}/memo`, `PATCH /projects/{project_id}/memo`
  - Backend: `app/api/routes/project_memos.py`
  - Status: connected.
- Learning logs
  - Frontend: `frontend/features/learning-log/service.js`, `frontend/features/mypage/service.ts`
  - Calls: `POST /learning-logs/`, `GET /learning-logs/user/{user_id}`
  - Backend: `app/api/routes/learning_logs.py`
  - Status: connected.
- Mypage
  - Frontend: `frontend/features/mypage/service.ts`
  - Calls: `GET /mypage/{user_id}`, plus projects/logs/graphs/chats aggregation.
  - Backend: `app/api/routes/mypage.py`
  - Status: connected.
- Graph by project
  - Frontend: `frontend/features/dashboard/service.ts`
  - Calls: `GET /graph/{project_id}`, `GET /graph/{project_id}/recent`, `GET /graph/nodes/{node_id}`
  - Backend: `app/api/routes/graph.py`
  - Status: connected for project graph endpoints.

## Partially Connected API Areas

These have matching routes, but some implementation is incomplete or only partly modeled.

- Chat
  - Frontend: `frontend/features/dashboard/service.ts`
  - Calls:
    - `GET /chat/project/{project_id}`
    - `POST /chat/{project_id}`
  - Backend: `app/api/routes/chat.py`
  - Status:
    - Chat save/read route exists.
    - AI function `app/ai/chat_ai.py::process_chat` raises `NotImplementedError`.
    - Backend catches this and returns fallback text: "AI 응답 생성 로직 연결 전입니다."
    - Frontend `createChat()` does not create a backend chat room; it builds an empty frontend thread. Actual persistence happens only after message send.
- Upload and analysis
  - Frontend: `frontend/features/upload/api-service.js`
  - Calls:
    - `GET /upload/{project_id}`
    - `POST /upload/{project_id}`
    - `POST /upload/{file_id}/analyze`
    - `GET /upload/{file_id}/status`
  - Backend: `app/api/routes/upload.py`
  - Status:
    - Upload and DB metadata routes exist.
    - Analysis calls `app/ai/graph_extractor.py::extract_graph`, which raises `NotImplementedError`.
    - Analysis may move to `FAILED`.
- Diagnosis
  - Frontend: `frontend/features/diagnosis/api-service.js`
  - Calls:
    - `POST /diagnosis/{project_id}/questions`
    - `POST /diagnosis/{project_id}/answers`
    - `GET /diagnosis/{project_id}/status`
  - Backend: `app/api/routes/diagnosis.py`
  - Status:
    - Routes exist.
    - Question generation calls `app/ai/diagnosis_ai.py::generate_question`, which raises `NotImplementedError`.
- Explanation
  - Frontend: `frontend/features/dashboard/service.ts`
  - Calls: `POST /explanation`
  - Backend: `app/api/routes/explanation.py`
  - Status:
    - Route exists.
    - Explanation generation calls `app/ai/explanation_ai.py::generate_explanation`, which raises `NotImplementedError`.

## Not Connected / Mock / Local Only

- Login
  - File: `frontend/app/login/page.tsx`
  - Current behavior: Google sign-in button only logs `Google sign-in clicked`.
  - No backend `/api/auth/*` routes found.
- Auth/session/JWT
  - Current user identity is localStorage based.
  - Key: `eeum-current-api-user-id`
  - `ensureCurrentUser()` auto-creates a local dev user when no stored user exists.
  - No real OAuth, JWT, cookie session, or ownership validation in frontend integration.
- Project catalog
  - File: `frontend/features/dashboard/service.ts`
  - `MOCK_PROJECT_CATALOG` supplies "운영체제", "자료구조", "컴퓨터 네트워크", "알고리즘".
  - No backend catalog API is used.
- Landing page
  - Static UI and image assets.
  - No API integration.
- `/api/graph/me`
  - Backend route exists in `app/api/routes/graph.py`.
  - Returns `{"success": true, "data": null, "message": "미구현"}`.
  - Frontend does not directly use it.
- localStorage fallback paths
  - `frontend/features/workspace/storage.js`
  - `frontend/features/upload/mock-service.js`
  - `frontend/store/profileStore.ts`
  - `frontend/data/mockMyPageData.ts`

## Main Risks / Next Integration Work

- Implement real auth:
  - Google OAuth or Cognito.
  - `/api/auth/session`, login callback, logout.
  - Replace localStorage user identity with authenticated user.
- Add authorization checks in backend:
  - Verify project ownership for project, chat, upload, graph, memo, diagnosis, and explanation endpoints.
- Implement AI backend functions:
  - `app/ai/chat_ai.py`
  - `app/ai/graph_extractor.py`
  - `app/ai/explanation_ai.py`
  - `app/ai/diagnosis_ai.py`
- Decide chat model:
  - Current backend stores message logs, not separate chat room threads.
  - Frontend UI models a thread, so either backend should add chat sessions or frontend should align to project-level message log.
- Replace static project catalog with backend-driven catalog or user-custom project creation.
- Improve error UI for API failures, especially upload analysis and diagnosis AI failures.

## Important Files Checked

- `frontend/features/api/client.js`
- `frontend/features/api/session.js`
- `frontend/features/dashboard/service.ts`
- `frontend/features/upload/api-service.js`
- `frontend/features/upload/service.js`
- `frontend/features/diagnosis/api-service.js`
- `frontend/features/mypage/service.ts`
- `frontend/features/learning-log/service.js`
- `frontend/app/login/page.tsx`
- `frontend/next.config.mjs`
- `frontend/.env.local`
- `/home/ec2-user/2026-capstone-52/app/main.py`
- `/home/ec2-user/2026-capstone-52/app/api/routes/*.py`
- `/home/ec2-user/2026-capstone-52/app/ai/*.py`

## Conversation Notes

- User asked in Korean to analyze the frontend and classify API integration against backend.
- Codex inspected frontend directory structure and backend FastAPI routes.
- Final summary was given in Korean with connected, partially connected, and not connected sections.
- User then requested a local MD or TXT file summarizing all conversations because AWS EC2 sometimes stops.
- This file was created in the current working directory for continuity.
- User pasted the intended API contract for upload/AI/graph/diagnosis/explanation/chat/users/projects/learning logs/mypage and asked to compare it against the implemented backend and frontend-backend integration.
- Key follow-up findings:
  - Most listed route URLs exist in backend.
  - `GET /api/graph/me` exists but returns `data: null`, `message: "미구현"`.
  - AI functions for graph extraction, chat, explanation, and diagnosis still raise `NotImplementedError`.
  - Chat route stores messages and creates `explanation_requested` learning logs, but does not have a separate chat session/thread model.
  - Diagnosis status currently returns only `total_nodes`, `diagnosed_nodes`, `progress_percent`, not current level or concept-level diagnosis status.
  - Node detail returns only the node record, not related concepts or related learning logs.
  - Mypage route returns user, project count, recent projects, recent logs; frontend computes extra stats by calling projects/logs/graphs/chats separately.
  - Frontend still uses localStorage/temp user identity and mock project catalog.
- User later asked whether `/home/ec2-user/2026-capstone-52/app` had recently changed and whether backend API additions exist.
- Current check result:
  - `git status --short --untracked-files=all` in `/home/ec2-user/2026-capstone-52` returned clean output.
  - No new route files or route registrations were found beyond the previously inspected set.
  - Source files under `app/api/routes`, `app/schemas`, `app/services`, `app/models`, `app/ai` show modification time `2026-05-09 04:07`.
  - Newer files around `2026-05-09 04:40` are `__pycache__` only, likely produced by running/importing the backend.
  - API source additions since the previous inspection were not detected.
- User then reported that a backend teammate said the Google login API implementation and testing were complete and only the frontend login button needs wiring.
- Follow-up check found local backend branch is `dev` at `584dbe3`, while `origin/dev` is 2 commits ahead.
- `origin/backend_cmj_integration` / `origin/dev` includes commit `13c9e63 feat: 구글 로그인 사용자 연동 API 추가`.
- That remote commit adds:
  - `POST /api/users/google`
  - `GoogleLoginRequest` with `email`, `nickname`, `profile_image`
  - `get_user_by_email()` and `get_or_create_google_user()`
  - frontend dependency `@react-oauth/google`
- Important nuance: this is a Google user upsert/link API under `/api/users/google`, not a full backend OAuth redirect/callback/JWT/session implementation.
- Local working copy must be updated from `origin/dev` before frontend wiring against that endpoint.
- User pulled backend latest and asked whether only frontend API wiring is needed.
- Confirmed backend now has `POST /api/users/google` locally.
- Frontend-only changes made:
  - `frontend/features/api/session.js`: added `loginWithGoogleProfile()` that calls `/users/google` and stores returned `user_id` in `eeum-current-api-user-id`.
  - `frontend/app/login/page.tsx`: replaced `console.log` click handler with Google Identity Services OAuth token flow, fetches Google userinfo, posts email/name/picture to backend, then routes to `/dashboard`.
  - No backend source files were modified.
- Verification:
  - `npm run build` in `/home/ec2-user/2026-capstone-52_front/frontend` passed.
  - Required runtime env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
