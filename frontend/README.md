# eeum-frontend

`eeum-frontend`는 AI 튜터 서비스 `이음(eeum)`의 프론트엔드 프로토타입입니다.

사용자는 프로젝트 단위로 학습 자료를 업로드하고, 자료 분석과 개인 수준 진단을 거친 뒤, 프로젝트별 채팅과 지식 그래프를 통해 학습 흐름을 관리할 수 있습니다. 현재 레포는 프론트엔드 구현만 포함하며, 실제 인증, DB, 파일 저장, AI 추론 서버는 아직 연결되어 있지 않습니다.

향후 최종 서비스는 AWS의 S3, EC2, DB, Bedrock, Lambda를 이용해 개발 및 배포할 예정입니다. 기능별 백엔드/API/AWS 설계의 상세 로드맵은 [`TODO.md`](./TODO.md)에 정리되어 있습니다.

## 기술 스택

- Next.js 15
- React 19
- TypeScript 일부 적용
- JavaScript/JSX 컴포넌트 병행
- Tailwind CSS 3
- Framer Motion
- Zustand
- Font Awesome

## 실행 방법

```bash
npm install
npm run dev
```

프로덕션 빌드는 아래 명령으로 확인합니다.

```bash
npm run build
npm run start
```

작업 규칙상 개발 서버(`npm run dev`)는 직접 실행하지 않고, 변경 검증은 기본적으로 `npm run build`로 진행합니다.

## 백엔드 API 연동

백엔드 앱(`../backend`)은 FastAPI 서버이며 기본 API prefix는 `/api`입니다.
프론트는 기본적으로 mock 데이터를 사용하고, `.env.local`에서 실제 API 사용 여부를 켤 수 있습니다.

```bash
cp .env.local.example .env.local
```

EC2 FastAPI 서버를 사용할 때는 아래처럼 설정합니다.

```env
NEXT_PUBLIC_USE_BACKEND_API=true
NEXT_PUBLIC_API_BASE_URL=http://98.93.251.200:8000/api
BACKEND_API_URL=http://98.93.251.200:8000
```

이 설정에서는 브라우저가 FastAPI 서버를 직접 호출합니다. 예를 들어 프론트의 `/upload` 화면은 `http://98.93.251.200:8000/api/upload/{project_id}`로 요청합니다.

Next.js rewrite 프록시를 사용하려면 `NEXT_PUBLIC_API_BASE_URL=/api/backend`를 유지하고 `BACKEND_API_URL=http://98.93.251.200:8000`만 EC2 주소로 둡니다.

백엔드는 별도 터미널에서 실행합니다.

```bash
cd ../backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

로컬에서 S3 없이 업로드 흐름만 확인하려면 백엔드 `.env`에 아래 값을 둡니다.

```env
use_s3=false
```

프록시 방식을 사용할 경우 프론트는 `/api/backend/*` 요청을 `BACKEND_API_URL/api/*`로 rewrite합니다. 직접 호출 방식을 사용할 경우 EC2 Security Group inbound rule에서 TCP `8000` 포트가 열려 있어야 합니다.

현재 연결된 화면:

- `/upload`: `GET /api/upload/{project_id}`, `POST /api/upload/{project_id}`, `POST /api/upload/{file_id}/analyze`

연동 코드 위치:

- `features/api/client.js`: 공통 fetch wrapper
- `features/upload/api-service.js`: 백엔드 업로드 API adapter
- `features/upload/service.js`: mock/API 전환 wrapper

## 현재 라우트

- `/`: 랜딩 페이지
- `/login`: 로그인 페이지 UI
- `/dashboard`: 프로젝트/채팅/그래프 중심 워크스페이스
- `/upload`: 프로젝트 자료 업로드 및 mock 분석 화면
- `/diagnosis?projectId=...`: 개인 수준 진단 플로우
- `/project/[projectId]`: 이전 버전의 프로젝트 상세 워크스페이스
- `/mypage`: 프로필, 학습 통계, 최근 학습 기록, 통합 지식 그래프

## 프로젝트 구조

```text
app/
components/
data/
features/
public/
store/
types/
```

- `app`: Next.js App Router 라우트 진입점
- `components`: 화면/도메인별 UI 컴포넌트
- `data`: 마이페이지 등에서 사용하는 mock 데이터
- `features`: dashboard, upload, diagnosis, graph, workspace 관련 상태/서비스/model
- `public`: 정적 이미지 asset
- `store`: 전역 프로필 상태
- `types`: 공통 타입

## 현재 데이터 저장 방식

현재는 백엔드가 없기 때문에 다음 localStorage/mock 데이터가 실제 API를 대신합니다.

- `eeum-workspace-v1`: 프로젝트 목록, 자료 목록, 진단 결과, 프로젝트 메모, 마지막 선택 프로젝트
- `eeum-dashboard-chats-v1`: 프로젝트별 채팅 목록과 메시지
- `eeum-upload-mock-v1`: 업로드 파일 metadata와 mock 분석 상태
- `eeum-profile-store`: 사용자 프로필과 프로필 이미지
- `data/mockMyPageData.ts`: 마이페이지 통계/최근 학습 기록 mock 데이터

최종 서비스에서는 위 데이터들을 모두 DB/API 기반으로 교체해야 합니다.

## 기능별 설명

### 1. 랜딩 페이지

구현 파일:

- `app/page.tsx`
- `components/landing/*`

현재 구현:

- 서비스 소개용 hero, intro, core feature, usage section을 제공합니다.
- `LandingGraphLayer`를 이용해 배경형 그래프 비주얼을 보여줍니다.
- hero mock 이미지는 `public/images/hero-workspace-mock.png`를 사용합니다.

현재 데이터:

- 정적 텍스트
- 정적 이미지 asset
- 정적 그래프 레이아웃 데이터

추후 개발:

- 로그인 여부에 따라 CTA 이동 경로를 분기해야 합니다.
- 로그인된 사용자는 `/dashboard`, 비로그인 사용자는 `/login`으로 보내는 방식이 적절합니다.
- 랜딩의 공개 asset은 S3 또는 EC2 static serving으로 배포할 수 있습니다.

### 2. 로그인 페이지

구현 파일:

- `app/login/page.tsx`

현재 구현:

- Google 로그인 버튼 UI만 존재합니다.
- 버튼 클릭 시 실제 OAuth가 아니라 `console.log`만 실행됩니다.

현재 데이터:

- 없음

추후 개발:

- Google OAuth 또는 Amazon Cognito 기반 인증을 연결해야 합니다.
- 로그인 성공 시 `users`, `user_profiles` 레코드를 생성하거나 조회해야 합니다.
- 모든 API는 인증된 사용자 ID를 기준으로 데이터를 조회해야 합니다.
- 필요한 API 후보:
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
  - `GET /api/users/me`

### 3. 대시보드 / 프로젝트 워크스페이스

구현 파일:

- `app/dashboard/page.jsx`
- `components/dashboard/dashboard-page-view.jsx`
- `components/dashboard/WorkspaceProfileCard.tsx`
- `features/dashboard/service.ts`
- `features/dashboard/graph.ts`
- `features/dashboard/types.ts`
- `features/workspace/storage.js`
- `features/project/model.js`

현재 구현:

- 프로젝트 목록을 보여줍니다.
- 프로젝트를 선택하면 해당 프로젝트의 최근 채팅 목록을 보여줍니다.
- 새 프로젝트를 생성할 수 있습니다.
- 새 대화를 생성할 수 있습니다.
- 선택된 채팅 메시지를 메인 영역에 표시합니다.
- `채팅` 탭과 `그래프` 탭을 전환할 수 있습니다.
- 그래프 탭에서는 프로젝트별 지식 그래프를 표시합니다.
- 그래프는 휠 확대/축소, 드래그 이동, 노드 선택, 노드 검색, 뷰 초기화를 지원합니다.
- 하단 프로필 카드를 통해 마이페이지로 이동할 수 있습니다.

현재 데이터:

- 프로젝트 목록: `eeum-workspace-v1`
- 채팅 목록/메시지: `eeum-dashboard-chats-v1`
- 프로젝트 preset: `features/project/model.js`
- 프로젝트별 그래프 preset 및 생성 로직: `features/dashboard/graph.ts`
- 사용자 프로필: `eeum-profile-store`

추후 개발:

- 프로젝트, 채팅, 메시지는 DB에서 가져와야 합니다.
- 채팅 입력은 Bedrock 기반 AI 응답 생성 API와 연결해야 합니다.
- AI 답변 이후 핵심 개념과 관계를 추출해 지식 그래프 DB에 반영해야 합니다.
- 대시보드 그래프는 프론트 preset이 아니라 `knowledge_graph_nodes`, `knowledge_graph_edges` API 응답으로 렌더링해야 합니다.
- 필요한 API 후보:
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/projects/:projectId/chats`
  - `POST /api/projects/:projectId/chats`
  - `GET /api/chats/:chatId/messages`
  - `POST /api/chats/:chatId/messages`
  - `GET /api/projects/:projectId/knowledge-graph`
- 연결될 DB 후보:
  - `projects`
  - `chats`
  - `chat_messages`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `user_profiles`

### 4. 자료 업로드

구현 파일:

- `app/upload/page.jsx`
- `components/upload/upload-page-view.jsx`
- `features/upload/mock-service.js`

현재 구현:

- 프로젝트를 기준으로 자료 업로드 화면을 표시합니다.
- PDF/TXT 파일을 drag and drop 또는 파일 선택으로 대기 목록에 추가합니다.
- `자료 분석 시작하기`를 누르면 mock 업로드와 mock 분석 상태가 생성됩니다.
- 분석 상태는 `대기 중`, `분석 중`, `분석 완료`로 표시됩니다.
- 일정 시간이 지나면 mock 분석이 완료된 것처럼 보입니다.
- 분석 완료 자료가 있으면 `학습 상태 체크하기` 버튼으로 진단 화면으로 이동할 수 있습니다.

현재 데이터:

- 업로드 파일 metadata: `eeum-upload-mock-v1`
- 실제 파일 binary는 저장하지 않습니다.
- 분석 상태는 localStorage와 timer로 시뮬레이션합니다.

추후 개발:

- 실제 파일은 S3에 저장해야 합니다.
- 프론트는 EC2 backend에서 presigned URL을 받아 S3에 직접 업로드해야 합니다.
- 업로드 완료 후 DB에 파일 metadata를 저장해야 합니다.
- S3 object created event 또는 API 호출을 통해 Lambda 분석 작업을 시작해야 합니다.
- Lambda는 파일을 파싱하고 Bedrock을 호출해 요약, chunk, 개념, 관계를 추출해야 합니다.
- 필요한 API 후보:
  - `GET /api/projects/:projectId/files`
  - `POST /api/projects/:projectId/files/presign`
  - `POST /api/projects/:projectId/files/complete`
  - `POST /api/files/:fileId/analysis/start`
  - `GET /api/files/:fileId/analysis`
- 연결될 DB/AWS 후보:
  - S3 object
  - `project_files`
  - `file_analysis_jobs`
  - `file_chunks`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - Lambda
  - Bedrock

### 5. 개인 수준 진단

구현 파일:

- `app/diagnosis/page.jsx`
- `components/diagnosis/diagnosis-page-view.jsx`
- `features/diagnosis/model.js`
- `features/workspace/storage.js`

현재 구현:

- `intro -> quiz -> analyzing -> ready` 흐름으로 진행됩니다.
- 프로젝트별 preset 문항을 보여줍니다.
- 객관식/단답형 문항을 지원합니다.
- 사용자의 답변을 기반으로 mock 평가 결과를 생성합니다.
- 진단 결과는 localStorage에 저장되고 대시보드로 돌아갑니다.

현재 데이터:

- 진단 문항 template: `features/diagnosis/model.js`
- 진단 답변/결과: `eeum-workspace-v1`
- 프로젝트/자료 metadata: `features/project/model.js`, `features/workspace/storage.js`

추후 개발:

- 진단 session과 문항, 답변, 결과를 DB에 저장해야 합니다.
- 문항은 업로드 자료 chunk, 기존 지식 그래프, 사용자 프로필을 기반으로 Bedrock이 생성하는 방향이 적절합니다.
- 사용자의 답변은 Bedrock 또는 backend 평가 로직으로 채점하고, 부족 개념과 추천 학습 경로를 생성해야 합니다.
- 진단 횟수는 마이페이지 통계의 `진단 횟수`로 연결되어야 합니다.
- 필요한 API 후보:
  - `POST /api/projects/:projectId/diagnosis-sessions`
  - `GET /api/diagnosis-sessions/:sessionId`
  - `POST /api/diagnosis-sessions/:sessionId/answers`
  - `POST /api/diagnosis-sessions/:sessionId/complete`
- 연결될 DB 후보:
  - `diagnosis_sessions`
  - `diagnosis_questions`
  - `diagnosis_answers`
  - `diagnosis_results`
  - `file_chunks`
  - `knowledge_graph_nodes`

### 6. 마이페이지

구현 파일:

- `app/mypage/page.tsx`
- `components/mypage/*`
- `data/mockMyPageData.ts`
- `store/profileStore.ts`

현재 구현:

- 프로필 요약 카드를 보여줍니다.
- 프로필 이미지를 변경할 수 있습니다.
- 프로필 수정 모달에서 언어, 직업, 전공, 선호 설명 방식, 목표 학습 유형을 수정할 수 있습니다.
- 프로필 수정 모달은 커스텀 dropdown UI를 사용합니다.
- 현재 프로젝트 수, 총 학습 횟수, 진단 횟수, 이해 개념을 보여줍니다.
- 진단 횟수는 아직 실제 기능 전이라 `??`로 표시합니다.
- 최근 학습 기록을 보여줍니다.
- 오른쪽 하단에 통합 지식 그래프 패널을 보여줍니다.
- 패널을 클릭하면 전체 화면 오버레이로 확장됩니다.
- 전체 화면 그래프는 휠 확대/축소, 드래그 이동, ESC 닫기를 지원합니다.
- 전체 화면 왼쪽에는 과목 필터 패널이 있고, 특정 과목을 선택하면 해당 과목 그래프만 밝게 유지됩니다.

현재 데이터:

- 프로필: `eeum-profile-store`
- 통계/최근 학습 기록: `data/mockMyPageData.ts`
- 통합 그래프: `features/dashboard/service.ts`와 `features/dashboard/graph.ts`를 조합해 생성

추후 개발:

- 사용자 프로필은 DB의 `users`, `user_profiles`에서 가져와야 합니다.
- 프로필 수정은 `PATCH /api/users/me/profile`로 저장해야 합니다.
- 프로필 이미지는 S3 presigned URL 기반으로 업로드해야 합니다.
- 마이페이지 통계는 DB aggregate로 계산해야 합니다.
- 최근 학습 기록은 `knowledge_graph_nodes.created_at DESC LIMIT 6` 기준으로 가져와야 합니다.
- 통합 지식 그래프는 모든 프로젝트의 `knowledge_graph_nodes`, `knowledge_graph_edges`를 API로 받아 렌더링해야 합니다.
- 필요한 API 후보:
  - `GET /api/mypage`
  - `GET /api/mypage/recent-concepts?limit=6`
  - `GET /api/mypage/knowledge-graph`
  - `GET /api/users/me/profile`
  - `PATCH /api/users/me/profile`
  - `POST /api/users/me/profile-image/presign`
- 연결될 DB 후보:
  - `users`
  - `user_profiles`
  - `projects`
  - `chats`
  - `diagnosis_sessions`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`

### 7. 통합 지식 그래프

구현 파일:

- `components/graph/knowledge-graph-scene.tsx`
- `components/mypage/GalaxyGraphPanel.tsx`
- `features/dashboard/graph.ts`
- `features/graph/layout.ts`

현재 구현:

- 대시보드의 프로젝트별 그래프 생성 로직을 재사용합니다.
- 마이페이지에서는 모든 프로젝트의 그래프를 합쳐 하나의 통합 그래프로 표시합니다.
- `buildIntegratedKnowledgeGraph()`가 프로젝트별 그래프를 cluster처럼 재배치합니다.
- canvas 기반 그래프 렌더러가 노드, 엣지, 라벨, hover, selected, dimmed 상태를 처리합니다.
- `dimmedNodeIds`를 이용해 필터 선택 시 선택되지 않은 노드의 불빛이 꺼진 것처럼 표현합니다.

현재 데이터:

- 프로젝트/채팅 localStorage
- graph preset
- frontend layout coordinates

추후 개발:

- 그래프 원본은 DB의 node/edge가 되어야 합니다.
- Obsidian Markdown/JSON 파일은 원본 저장소가 아니라 export/import 보조 기능으로 분리하는 것이 적절합니다.
- 마이페이지 통합 그래프 API는 모든 프로젝트의 node/edge와 filter metadata를 내려줘야 합니다.
- 노드가 많아지면 초기에는 최근/중요 노드 150개 정도로 제한하고, 전체 화면에서 추가 로딩/필터를 제공하는 방식이 적절합니다.
- 필요한 API 후보:
  - `GET /api/projects/:projectId/knowledge-graph`
  - `GET /api/mypage/knowledge-graph`
  - `POST /api/projects/:projectId/knowledge-graph/nodes`
  - `POST /api/projects/:projectId/knowledge-graph/edges`
- 연결될 DB 후보:
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `projects`
  - `chat_messages`
  - `project_files`

## AWS 기반 최종 구현 방향

### EC2

- Next.js 앱과 backend API를 배포하는 기본 서버로 사용합니다.
- 초기에는 EC2 한 대에서 Next.js build와 API를 함께 운영하는 방식이 단순합니다.
- EC2 backend는 인증, DB 접근, S3 presigned URL 발급, Bedrock 호출 orchestration을 담당합니다.

### DB

- RDS PostgreSQL을 권장합니다.
- 사용자, 프로필, 프로젝트, 파일 metadata, 채팅, 메시지, 진단, 지식 그래프 node/edge는 관계형 데이터에 가깝습니다.
- 주요 테이블 후보:
  - `users`
  - `user_profiles`
  - `projects`
  - `project_files`
  - `file_analysis_jobs`
  - `file_chunks`
  - `chats`
  - `chat_messages`
  - `diagnosis_sessions`
  - `diagnosis_questions`
  - `diagnosis_answers`
  - `diagnosis_results`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `project_notes`

### S3

- 업로드 원본 파일 저장소로 사용합니다.
- 프로필 이미지 저장소로 사용할 수 있습니다.
- Bedrock Knowledge Bases의 data source로 활용할 수 있습니다.
- 프론트는 EC2 backend에서 presigned URL을 받아 S3에 직접 업로드합니다.

권장 S3 key 예시:

```text
users/{userId}/projects/{projectId}/files/{fileId}/{originalFilename}
users/{userId}/profile/{imageId}
analysis/{analysisJobId}/result.json
```

### Lambda

- S3 업로드 이후 비동기 파일 분석에 사용합니다.
- Lambda는 S3 object created event를 받아 파일을 파싱하고, chunk를 만들고, Bedrock을 호출해 요약/개념/관계를 추출합니다.
- 분석 결과는 DB의 `file_chunks`, `knowledge_graph_nodes`, `knowledge_graph_edges`, `file_analysis_jobs`에 저장합니다.
- 입력 prefix와 출력 prefix를 분리해 S3 이벤트 무한 루프를 방지해야 합니다.

### Bedrock

- 채팅 답변 생성
- 자료 요약
- 핵심 개념 추출
- 개념 관계 추출
- 개인 수준 진단 문항 생성
- 진단 답변 평가
- 사용자 수준과 선호 설명 방식에 맞춘 설명 생성
- RAG가 필요할 경우 Bedrock Knowledge Bases를 사용하거나, 초기에는 DB의 `file_chunks`를 검색해 prompt context로 넣는 방식으로 시작할 수 있습니다.

## 권장 개발 순서

1. 인증/session과 `users`, `user_profiles` 구현
2. 프로젝트 CRUD와 `projects` API 구현
3. 채팅/메시지 저장과 Bedrock 기본 채팅 연결
4. S3 presigned URL 기반 파일 업로드 구현
5. Lambda 기반 파일 분석 job 구현
6. Bedrock 기반 자료 요약/개념 추출/관계 추출 구현
7. 수준 진단 session/questions/answers/results 구현
8. 프로젝트별 지식 그래프 API 구현
9. 마이페이지 통계/최근 기록/통합 그래프 API 구현
10. 프로필 이미지 업로드와 프로필 수정 API 구현
11. AWS IAM, S3 private bucket, DB backup, CloudWatch logging, rate limit 등 운영 보강

## 참고 문서

- 전체 기능별 백엔드 연동 체크리스트: [`TODO.md`](./TODO.md)
- 오늘 작업 기록: [`2026-04-25.md`](./2026-04-25.md)

AWS 공식 문서:

- S3 presigned URL: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- S3 presigned upload: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- S3 event notifications with Lambda: https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html
- Amazon Bedrock InvokeModel: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html
- Bedrock Knowledge Bases: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
- RDS PostgreSQL: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html
- EC2 concepts: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html

## 현재 한계

- 실제 로그인은 구현되어 있지 않습니다.
- 실제 파일 업로드는 구현되어 있지 않습니다.
- 실제 DB 저장은 구현되어 있지 않습니다.
- 실제 Bedrock 호출은 구현되어 있지 않습니다.
- 업로드 분석과 수준 진단은 mock/localStorage 기반입니다.
- 지식 그래프는 현재 프론트 preset/localStorage 데이터를 기반으로 생성됩니다.
- 최종 서비스 전에는 모든 사용자별 데이터 접근에 서버 측 권한 검증을 추가해야 합니다.
