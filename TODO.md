# Dashboard Backend Integration Checklist

## 1. Feature Summary

- `프로젝트`는 과목/주제 단위의 최상위 컨테이너입니다.
- 각 프로젝트는 자신만의 채팅 목록을 가집니다.
- 대시보드의 `최근 채팅` 영역은 전체 채팅이 아니라, 현재 선택된 프로젝트에 속한 채팅만 보여줘야 합니다.
- 사용자는 프로젝트를 전환할 수 있어야 하고, 프로젝트 전환 시 최근 채팅 목록도 해당 프로젝트 기준으로 다시 로드되어야 합니다.

## 2. Frontend-Backend Connection Points

### 프로젝트 목록

- 좌측 사이드바의 프로젝트 selector는 서버에서 프로젝트 목록을 받아와야 합니다.
- 프로젝트 목록은 `updatedAt DESC` 기준으로 정렬된 결과를 사용해야 합니다.
- 현재 프론트는 mock service를 사용 중이며, 실제 연동 시 `getProjects()`를 API 호출로 교체하면 됩니다.

### 선택된 프로젝트

- 현재 선택된 프로젝트는 URL search params와 함께 복원됩니다.
- 새로고침 시 `projectId`가 유효하면 해당 프로젝트를 선택 상태로 복원해야 합니다.
- `projectId`가 없거나 유효하지 않으면 서버 응답 기준 첫 번째 프로젝트 또는 최근 접근 프로젝트로 fallback 해야 합니다.

### 선택된 프로젝트의 최근 채팅 목록

- `최근 채팅`은 선택된 프로젝트 ID를 기준으로 서버에서 다시 조회해야 합니다.
- 목록은 `updatedAt DESC` 기준으로 정렬된 결과여야 합니다.
- 다른 프로젝트를 선택하면 이전 프로젝트의 채팅 목록은 버리고, 새 프로젝트 기준 목록으로 교체해야 합니다.

### 프로젝트 생성

- `+ 새 학습 시작` 버튼은 새 프로젝트를 생성하는 API에 연결되어야 합니다.
- 생성 성공 후:
  - 프로젝트 목록을 다시 가져오거나
  - 생성 응답을 현재 프로젝트 목록에 반영하고
  - 새 프로젝트를 선택 상태로 전환해야 합니다.

### 채팅 생성

- `+ 새 대화` 버튼은 현재 선택된 프로젝트 안에 새 채팅을 생성해야 합니다.
- 생성 성공 후:
  - 선택된 프로젝트의 최근 채팅 목록을 다시 불러오고
  - 생성된 채팅을 선택 상태로 만들고
  - 메인 채팅 영역도 해당 채팅 내용을 기준으로 갱신해야 합니다.

### 선택된 채팅 상세 로딩

- 채팅 목록에서 항목을 클릭하면 해당 채팅의 상세 메시지 목록이 로드되어야 합니다.
- 현재는 sidebar list와 main content가 같은 mock 데이터를 공유하지만, 실제 연동 시에는 `chatId` 기준 상세 조회가 필요합니다.

## 3. API Contract Draft

### `GET /api/projects`

- 목적:
  - 로그인 사용자가 접근 가능한 프로젝트 목록 조회
- 책임:
  - 사용자 소유 프로젝트만 반환
  - `updatedAt DESC` 정렬 보장
  - 최소한 `id`, `title`, `updatedAt` 포함

### `GET /api/projects/:projectId/chats`

- 목적:
  - 특정 프로젝트에 속한 채팅 목록 조회
- 책임:
  - 해당 프로젝트가 현재 사용자 소유인지 검증
  - 프로젝트에 속한 채팅만 반환
  - `updatedAt DESC` 정렬 보장
  - sidebar recent chats 구성에 필요한 최소 필드 반환

### `GET /api/chats/:chatId`

- 목적:
  - 선택된 채팅 상세 조회
- 책임:
  - 해당 채팅이 현재 사용자 소유 프로젝트에 속하는지 검증
  - 채팅 메타데이터 + 메시지 목록 반환
  - 메인 영역 렌더링에 필요한 데이터 제공

### `POST /api/projects`

- 목적:
  - 새 프로젝트 생성
- 책임:
  - 제목 검증
  - 현재 사용자 기준 새 프로젝트 생성
  - 생성된 프로젝트 반환
  - 반환값에는 `id`, `title`, `updatedAt` 포함

### `POST /api/projects/:projectId/chats`

- 목적:
  - 특정 프로젝트 안에 새 채팅 생성
- 책임:
  - 프로젝트 소유권 검증
  - 빈 starter chat 또는 첫 메시지 기반 chat 생성
  - 생성된 chat 반환
  - 프로젝트의 `updatedAt`도 함께 갱신

### Sorting Expectations

- 프로젝트 목록은 항상 `updatedAt DESC`
- 프로젝트 내부 채팅 목록도 항상 `updatedAt DESC`

## 4. Data Shape Draft

### Project

```json
{
  "id": "os",
  "title": "운영체제 개념 정리",
  "updatedAt": "2026-04-12T04:20:00.000Z"
}
```

### Chat

```json
{
  "id": "os-chat-1",
  "projectId": "os",
  "title": "기아 현상이 왜 생기나요?",
  "updatedAt": "2026-04-12T04:20:00.000Z",
  "messages": [
    {
      "id": "os-chat-1-user-1",
      "role": "user",
      "text": "기아 현상이 왜 생기는지 예시와 함께 설명해줘."
    },
    {
      "id": "os-chat-1-assistant-1",
      "role": "assistant",
      "text": "높은 우선순위 작업이 계속 들어오면 낮은 우선순위 작업은 CPU를 받지 못합니다."
    }
  ]
}
```

### Suggested Split for List vs Detail

- 채팅 목록 API는 가볍게:
  - `id`
  - `projectId`
  - `title`
  - `updatedAt`
- 채팅 상세 API는 추가로:
  - `messages`
  - 필요한 경우 `summary`, `status`, `createdAt`

## 5. Ownership and Auth Notes

- 백엔드는 요청한 프로젝트가 현재 인증된 사용자 소유인지 반드시 검증해야 합니다.
- 백엔드는 요청한 채팅이 현재 인증된 사용자 소유 프로젝트에 속하는지도 반드시 검증해야 합니다.
- 프론트에서 `projectId`, `chatId`를 URL로 전달하더라도, 서버는 이를 신뢰하면 안 됩니다.
- 인증 실패 또는 권한 없음은 명확한 status code로 내려줘야 합니다.
  - 예: `401 Unauthorized`, `403 Forbidden`

## 6. Update Rules

- 프로젝트 `updatedAt` 갱신 규칙:
  - 프로젝트 제목 등 메타데이터가 바뀔 때 갱신
  - 프로젝트 안에서 새 채팅이 생성될 때 갱신
  - 프로젝트 내부 기존 채팅에서 새 메시지 추가 등 활동이 발생할 때 갱신

- 채팅 `updatedAt` 갱신 규칙:
  - 새 메시지가 추가될 때 갱신
  - 채팅 제목 등 메타데이터가 변경될 때 갱신

- 결과적으로:
  - 어떤 채팅이 최근에 활동했는지에 따라
  - 해당 프로젝트도 프로젝트 목록 상단으로 올라와야 합니다.

## 7. Frontend Integration Tasks

- mock service 대신 실제 API 호출 구현
- `getProjects()`를 `/api/projects` 연결로 교체
- `getProjectChats(projectId)`를 `/api/projects/:projectId/chats` 연결로 교체
- `createProject()`를 `POST /api/projects` 연결로 교체
- `createChat(projectId)`를 `POST /api/projects/:projectId/chats` 연결로 교체
- 선택된 `chatId` 기준 상세 조회 함수 추가
- 로딩 상태를 skeleton 또는 현재 문구 기반 UX로 유지
- API 실패 시 사용자 노출용 에러 메시지 정리
- search params 복원 로직이 실제 API 결과와 충돌 없는지 검증
- 프로젝트/채팅 생성 후 optimistic update를 쓸지, 재조회할지 정책 결정

## 8. Edge Cases

### 프로젝트가 없는 경우

- `GET /api/projects` 결과가 빈 배열이면:
  - 프로젝트 selector에 empty state 표시
  - 최근 채팅 영역도 빈 상태 유지
  - 메인 영역은 프로젝트 생성 유도 문구 표시 가능

### 선택된 프로젝트에 채팅이 없는 경우

- `GET /api/projects/:projectId/chats` 결과가 빈 배열이면:
  - 최근 채팅 영역에 empty state 표시
  - 메인 채팅 영역에는 `새 대화` 유도 상태 표시

### 잘못된 `projectId` 또는 `chatId`

- URL에 존재하지 않는 `projectId`, `chatId`가 들어오면:
  - 프론트는 fallback selection 처리
  - 또는 서버 에러를 받아 적절한 empty/error state 표시
- 권장:
  - 잘못된 `projectId`는 첫 프로젝트로 fallback
  - 잘못된 `chatId`는 해당 프로젝트의 첫 채팅 또는 empty state로 fallback

### 권한 없는 접근

- 사용자 소유가 아닌 `projectId`, `chatId` 요청 시:
  - 서버는 `403` 또는 `404` 정책을 명확히 정해야 함
  - 프론트는 에러 상태를 보여주고 안전한 fallback 이동 필요

### 삭제된 프로젝트 또는 삭제된 채팅

- 현재 보고 있던 프로젝트/채팅이 삭제된 상태로 새로고침될 수 있습니다.
- 이 경우:
  - 프로젝트가 삭제되면 프로젝트 목록 재조회 후 첫 번째 유효 프로젝트 선택
  - 채팅이 삭제되면 해당 프로젝트의 첫 채팅 또는 empty state 선택

## Recommended Backend Handoff Note

- 프론트는 이미 `projectId`, `chatId`, 정렬, empty/loading/error 상태를 기준으로 구조를 분리해 두었습니다.
- 백엔드 연동 시에는 UI 컴포넌트가 아니라 `features/dashboard/service.ts` 계층만 교체하는 방향으로 작업하는 것이 가장 안전합니다.

---

# My Page Backend Integration Roadmap

## 1. Feature Summary

- `/mypage`는 로그인 사용자의 학습 상태를 요약해서 보여주는 페이지입니다.
- 현재 프론트는 `data/mockMyPageData.ts`의 mock 데이터를 사용하고 있습니다.
- 실제 서비스에서는 아래 값들을 모두 DB에서 가져와야 합니다.
  - 현재 프로젝트 수
  - 총 학습 횟수
  - 이해 개념 수
  - 최근 학습 기록
  - 사용자 프로필 정보
  - 추후 추가될 진단 횟수

## 2. Why DB Integration Is Required

- 최근 학습 기록은 정적인 문구가 아니라 사용자가 실제로 만든 지식 그래프 노드 기준으로 표시되어야 합니다.
- 예를 들어 사용자가 어떤 프로젝트에서 `기아 현상`이라는 개념 노드를 새로 만들면, 마이페이지의 최근 학습 기록 첫 번째 항목에 그 노드 이름과 생성 날짜가 떠야 합니다.
- 여러 페이지에서 사용자 이름, 전공, 직업, 선호 설명 방식 등을 동일하게 보여주려면 프로필 정보도 단일 DB source of truth가 필요합니다.
- 통계 값도 mock 숫자를 쓰면 실제 프로젝트/채팅/노드 개수와 불일치하므로 DB aggregate 또는 API aggregate로 계산해야 합니다.

## 3. Data Ownership

### User Profile

- 사용자 이름은 페이지마다 하드코딩하면 안 됩니다.
- 로그인한 사용자 ID를 기준으로 DB에서 프로필을 조회해야 합니다.
- 마이페이지, 대시보드, 업로드 페이지, 채팅 페이지 등 모든 화면은 같은 프로필 source를 사용해야 합니다.

필요 필드 예시:

```json
{
  "id": "user-1",
  "name": "이지안",
  "major": "컴퓨터공학과",
  "job": "대학생",
  "language": "한국어",
  "explanationStyle": "example",
  "learningType": "project",
  "profileImageUrl": "https://..."
}
```

### Projects

- `현재 프로젝트 수`는 로그인 사용자가 소유한 프로젝트 개수입니다.
- DB에서는 `projects` 테이블 또는 컬렉션에서 `userId` 기준으로 count 해야 합니다.

계산 규칙:

```sql
COUNT(projects.id)
WHERE projects.user_id = current_user_id
```

### Chats

- `총 학습 횟수`는 모든 프로젝트에 속한 모든 채팅 수의 합입니다.
- 프로젝트별 채팅 개수를 따로 더해도 되고, 채팅 테이블에서 사용자 소유 프로젝트와 join 해서 count 해도 됩니다.

계산 규칙:

```sql
COUNT(chats.id)
JOIN projects ON chats.project_id = projects.id
WHERE projects.user_id = current_user_id
```

### Knowledge Graph Nodes

- `이해 개념`은 사용자의 모든 지식 그래프 노드 개수입니다.
- 프로젝트별 그래프 노드를 모두 합친 값이어야 합니다.
- 현재 mock에서는 `mockGraphNodes.length`로 계산하지만, 실제 서비스에서는 DB의 graph node count를 사용해야 합니다.

계산 규칙:

```sql
COUNT(knowledge_graph_nodes.id)
JOIN projects ON knowledge_graph_nodes.project_id = projects.id
WHERE projects.user_id = current_user_id
```

### Diagnosis Sessions

- `진단 횟수`는 아직 구현 예정 기능입니다.
- 현재 프론트에서는 `??`로 표시합니다.
- 추후 자료 업로드 후 개인 수준 진단을 수행한 횟수를 저장하고, 그 count를 표시해야 합니다.

예상 계산 규칙:

```sql
COUNT(diagnosis_sessions.id)
WHERE diagnosis_sessions.user_id = current_user_id
```

## 4. Recent Learning Records

### 기준 정의

- 최근 학습 기록에는 가장 최근에 추가된 지식 그래프 노드가 표시되어야 합니다.
- 기준 날짜는 `createdAt`을 우선 사용합니다.
- 만약 "최근에 복습하거나 수정한 개념"을 보여주고 싶다면 `updatedAt` 기준으로 별도 정책을 정해야 합니다.

권장 정책:

- `createdAt DESC`: 최근 추가된 개념
- `updatedAt DESC`: 최근 수정 또는 학습한 개념
- 현재 요구사항은 "가장 최근에 추가된 노드 이름과 해당 날짜"이므로 `createdAt DESC`가 더 적절합니다.

### 필요한 필드

```json
{
  "id": "node-1",
  "projectId": "os",
  "projectTitle": "운영체제 시험 정리",
  "subject": "운영체제",
  "conceptName": "기아 현상",
  "accentColor": "#4ade80",
  "createdAt": "2026-04-25T10:30:00.000Z"
}
```

### DB Query Draft

```sql
SELECT
  nodes.id,
  nodes.project_id,
  projects.title AS project_title,
  nodes.category AS subject,
  nodes.name AS concept_name,
  nodes.color AS accent_color,
  nodes.created_at
FROM knowledge_graph_nodes AS nodes
JOIN projects ON nodes.project_id = projects.id
WHERE projects.user_id = current_user_id
ORDER BY nodes.created_at DESC
LIMIT 6;
```

## 5. API Contract Draft

### `GET /api/mypage`

- 목적:
  - 마이페이지 첫 렌더에 필요한 프로필, 통계, 최근 학습 기록을 한 번에 조회
- 장점:
  - 마이페이지가 여러 API를 병렬 호출하지 않아도 됨
  - 통계와 최근 기록을 같은 시점의 데이터로 맞추기 쉬움

응답 예시:

```json
{
  "profile": {
    "id": "user-1",
    "name": "이지안",
    "major": "컴퓨터공학과",
    "job": "대학생",
    "language": "한국어",
    "explanationStyle": "example",
    "learningType": "project",
    "profileImageUrl": null
  },
  "stats": {
    "projectCount": 4,
    "totalChats": 87,
    "diagnosisCount": null,
    "conceptCount": 12
  },
  "recentConcepts": [
    {
      "id": "node-1",
      "projectId": "os",
      "projectTitle": "운영체제 시험 정리",
      "subject": "운영체제",
      "conceptName": "기아 현상",
      "accentColor": "#4ade80",
      "createdAt": "2026-04-25T10:30:00.000Z"
    }
  ]
}
```

### `PATCH /api/users/me/profile`

- 목적:
  - 프로필 수정 팝업에서 변경한 사용자 설정 저장
- 책임:
  - 현재 로그인 사용자만 자신의 프로필을 수정 가능
  - 이름, 전공, 직업, 언어, 설명 방식, 학습 타입 검증
  - 저장된 최신 프로필 반환

요청 예시:

```json
{
  "name": "이지안",
  "major": "컴퓨터공학과",
  "job": "대학생",
  "language": "한국어",
  "explanationStyle": "example",
  "learningType": "project"
}
```

## 6. Frontend Integration Plan

### 현재 상태

- `/mypage`는 `components/mypage/MyPageView.tsx`에서 렌더링합니다.
- 통계와 최근 기록은 `data/mockMyPageData.ts`의 helper 함수에서 가져옵니다.
- 프로필은 `store/profileStore.ts`의 zustand store를 사용합니다.
- 지금은 브라우저 localStorage 기반이므로 DB와 동기화되지 않습니다.

### 1단계: 타입 정리

- `types/profile.ts`에 API 응답 타입을 추가합니다.
- mock 타입과 실제 API 타입이 너무 다르면 변환 함수를 둡니다.
- `diagnosisCount`는 아직 기능 전까지 `number | null`로 받는 것이 좋습니다.
- 화면에서는 `null`이면 `??`로 표시합니다.

### 2단계: service 계층 추가

- `features/mypage/service.ts`를 새로 만듭니다.
- 이 파일에서 `/api/mypage`를 호출합니다.
- 컴포넌트는 직접 `fetch`하지 않고 service 함수를 사용합니다.

예시:

```ts
export async function getMyPageSummary() {
  const response = await fetch("/api/mypage", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load my page summary");
  }

  return response.json();
}
```

### 3단계: MyPageView 데이터 로딩 교체

- `getMyPageStats()`와 `getRecentLearningRecordsLast30Days()` 사용을 제거합니다.
- `useEffect` 또는 프로젝트에서 사용하는 data fetching 패턴으로 `getMyPageSummary()`를 호출합니다.
- 로딩 중에는 카드 skeleton 또는 기존 레이아웃을 유지한 placeholder를 보여줍니다.
- 실패 시에는 간단한 에러 상태와 재시도 버튼을 제공합니다.

### 4단계: 프로필 source 통합

- 현재 `store/profileStore.ts`는 localStorage에 프로필을 저장합니다.
- 실제 서비스에서는 서버 프로필을 우선 source로 사용해야 합니다.
- localStorage는 임시 캐시 정도로만 사용하거나 제거하는 편이 안전합니다.
- 프로필 수정 저장 버튼은 `PATCH /api/users/me/profile` 호출 후 응답값으로 store를 갱신해야 합니다.

### 5단계: 통계 계산 책임 결정

- 권장: 백엔드가 통계를 계산해서 내려줍니다.
- 이유:
  - 프론트가 프로젝트, 채팅, 노드 전체 데이터를 모두 받아 count 하는 것은 비효율적입니다.
  - 권한 검증과 집계 기준을 서버에서 일관되게 관리할 수 있습니다.

### 6단계: 최근 기록 정렬 정책 확정

- "최근 추가된 노드"는 `createdAt DESC`
- "최근 학습한 노드"는 별도 학습 이벤트 테이블 또는 `lastStudiedAt DESC`
- 지금 요구사항은 `createdAt DESC`로 시작하면 됩니다.

## 7. Suggested DB Tables

### `users`

- `id`
- `email`
- `name`
- `created_at`
- `updated_at`

### `user_profiles`

- `user_id`
- `major`
- `job`
- `language`
- `explanation_style`
- `learning_type`
- `profile_image_url`
- `updated_at`

### `projects`

- `id`
- `user_id`
- `title`
- `category`
- `created_at`
- `updated_at`

### `chats`

- `id`
- `project_id`
- `title`
- `created_at`
- `updated_at`

### `chat_messages`

- `id`
- `chat_id`
- `role`
- `content`
- `created_at`

### `knowledge_graph_nodes`

- `id`
- `project_id`
- `name`
- `category`
- `color`
- `created_at`
- `updated_at`

### `diagnosis_sessions`

- `id`
- `user_id`
- `upload_id`
- `status`
- `created_at`
- `completed_at`

## 8. Edge Cases

### 지식 그래프 노드가 없는 경우

- 최근 학습 기록은 empty state를 보여줘야 합니다.
- 예: `아직 추가된 개념이 없습니다.`
- 통계의 `이해 개념`은 `0`으로 표시합니다.

### 프로젝트는 있지만 채팅이 없는 경우

- `현재 프로젝트 수`는 프로젝트 개수 그대로 표시합니다.
- `총 학습 횟수`는 `0`으로 표시합니다.

### 진단 기능이 아직 없는 경우

- API 응답에서 `diagnosisCount: null`을 내려줍니다.
- 프론트는 `null`이면 `??`로 표시합니다.
- 나중에 진단 기능이 구현되면 숫자로 교체합니다.

### 사용자가 프로필을 수정한 직후

- `PATCH /api/users/me/profile` 응답값을 즉시 전역 프로필 상태에 반영해야 합니다.
- 대시보드, 마이페이지, 업로드 페이지 등에서 같은 이름이 보여야 합니다.

### 권한 없는 데이터 접근

- 사용자는 자신의 프로젝트, 채팅, 지식 그래프 노드만 볼 수 있어야 합니다.
- 서버는 `userId` 검증 없이 `projectId`만으로 데이터를 반환하면 안 됩니다.

## 9. Recommended Implementation Order

1. DB schema에 `users`, `user_profiles`, `projects`, `chats`, `knowledge_graph_nodes` 관계 확정
2. 로그인 사용자 식별 방식 확정
3. `GET /api/mypage` 구현
4. `PATCH /api/users/me/profile` 구현
5. 프론트에 `features/mypage/service.ts` 추가
6. `MyPageView.tsx`에서 mock helper 제거
7. 최근 학습 기록을 API의 `recentConcepts`로 렌더링
8. 통계를 API의 `stats`로 렌더링
9. 프로필 수정 저장 시 DB 업데이트 후 전역 프로필 상태 갱신
10. 지식 그래프 노드 생성 로직에서 `createdAt`, `updatedAt` 저장 보장
11. 지식 그래프 노드 추가 후 마이페이지 최근 기록에 반영되는지 통합 테스트

## Recommended Backend Handoff Note

- 마이페이지는 화면에서 보여줄 데이터를 조합해서 내려주는 `GET /api/mypage` API를 두는 것이 가장 단순합니다.
- 최근 학습 기록은 `knowledge_graph_nodes.created_at DESC LIMIT 6` 기준으로 시작하면 됩니다.
- `진단 횟수`는 진단 기능이 구현되기 전까지 API에서 `null`로 내려주고, 프론트는 `??`로 표시하면 됩니다.
- 사용자 이름은 하드코딩하지 말고 인증된 사용자 프로필에서 가져와야 합니다.

---

# My Page Integrated Knowledge Graph Panel Roadmap

## 1. Feature Summary

- `/mypage` 오른쪽 하단 패널에는 로그인 사용자의 모든 프로젝트에서 만들어진 지식 그래프가 통합되어 보여야 합니다.
- 현재 화면에서는 오른쪽 하단 패널을 blank로 비워둔 상태입니다.
- 실제 구현 시에는 각 프로젝트의 지식 그래프 노드와 엣지를 DB에서 가져와 하나의 통합 그래프로 렌더링해야 합니다.
- 목표는 Obsidian graph view처럼 여러 개념 노드가 연결된 전체 지식 구조를 보여주는 것입니다.

## 2. Core Decision

- 지식 그래프의 원본 데이터는 DB에 저장해야 합니다.
- Obsidian용 Markdown 또는 JSON 파일은 원본 저장소로 쓰지 않는 것을 권장합니다.
- Markdown/JSON export는 나중에 사용자가 내보내기, 백업, Obsidian 연동을 원할 때 보조 기능으로 제공하는 것이 좋습니다.

권장 구조:

```txt
DB
  projects
  knowledge_graph_nodes
  knowledge_graph_edges

→ API
  GET /api/mypage/knowledge-graph

→ Frontend graph renderer
  nodes + edges JSON
```

## 3. Why DB Should Be the Source of Truth

- 사용자별 권한 검증을 서버에서 안정적으로 할 수 있습니다.
- `현재 프로젝트 수`, `이해 개념 수`, `최근 학습 기록` 같은 통계와 같은 원본 데이터를 공유할 수 있습니다.
- 특정 사용자, 특정 프로젝트, 특정 개념 기준으로 검색/필터링/정렬이 쉽습니다.
- 그래프 노드와 엣지를 추가하거나 수정할 때 transaction 처리와 중복 검증이 가능합니다.
- 파일 파싱 없이 빠르게 graph API를 만들 수 있습니다.
- 여러 기기에서 같은 사용자가 접속해도 동일한 그래프 상태를 볼 수 있습니다.

Markdown/Obsidian 파일을 원본으로 쓰면 생기는 문제:

- 링크 파싱 규칙이 복잡해지고 예외가 많아집니다.
- 파일명 변경, 중복 제목, 특수문자, 폴더 이동 처리 비용이 커집니다.
- 사용자별 권한 검증과 DB 집계가 어려워집니다.
- 최근 추가된 개념, 전체 노드 수, 프로젝트별 노드 수 등을 계산하려면 매번 파일을 파싱해야 합니다.
- 엣지 타입, weight, 생성 출처 같은 메타데이터를 안정적으로 관리하기 어렵습니다.

## 4. Data Model Draft

### `knowledge_graph_nodes`

각 개념 하나를 하나의 노드로 저장합니다.

```json
{
  "id": "node-1",
  "userId": "user-1",
  "projectId": "project-os",
  "name": "기아 현상",
  "category": "운영체제",
  "description": "낮은 우선순위 프로세스가 CPU를 계속 할당받지 못하는 현상",
  "sourceType": "chat",
  "sourceId": "chat-message-1",
  "color": "#4ade80",
  "createdAt": "2026-04-25T10:30:00.000Z",
  "updatedAt": "2026-04-25T10:30:00.000Z"
}
```

필드 설명:

- `id`: 노드 고유 ID
- `userId`: 노드 소유 사용자 ID
- `projectId`: 노드가 속한 프로젝트 ID
- `name`: 화면에 표시할 개념명
- `category`: 운영체제, 자료구조, 알고리즘 같은 분류
- `description`: 선택 사항. 노드 상세보기에서 사용할 수 있음
- `sourceType`: 노드가 생성된 출처. 예: `chat`, `upload`, `manual`, `diagnosis`
- `sourceId`: 출처 데이터 ID
- `color`: 그래프에서 사용할 색상. 없으면 category/project 기준으로 프론트에서 계산 가능
- `createdAt`: 노드가 처음 추가된 시간
- `updatedAt`: 노드가 수정되거나 보강된 시간

### `knowledge_graph_edges`

개념 간 관계를 엣지로 저장합니다.

```json
{
  "id": "edge-1",
  "userId": "user-1",
  "projectId": "project-os",
  "sourceNodeId": "node-1",
  "targetNodeId": "node-2",
  "relationType": "related",
  "weight": 0.82,
  "sourceType": "ai",
  "createdAt": "2026-04-25T10:31:00.000Z"
}
```

필드 설명:

- `id`: 엣지 고유 ID
- `userId`: 엣지 소유 사용자 ID
- `projectId`: 관계가 만들어진 프로젝트 ID
- `sourceNodeId`: 시작 노드 ID
- `targetNodeId`: 도착 노드 ID
- `relationType`: 관계 종류. 예: `related`, `prerequisite`, `causes`, `part_of`
- `weight`: 관계 강도. AI가 계산하거나 사용자 행동 기반으로 조정 가능
- `sourceType`: 관계 생성 출처. 예: `ai`, `manual`, `chat`, `upload`
- `createdAt`: 관계가 만들어진 시간

## 5. Cross-Project Graph Policy

- 마이페이지는 모든 프로젝트의 노드와 엣지를 합쳐서 보여줍니다.
- 다만 프로젝트별 구분이 가능해야 합니다.
- 같은 개념명이 여러 프로젝트에 존재할 수 있으므로, 처음에는 프로젝트별 노드를 별도 노드로 유지하는 것이 안전합니다.

예:

- 운영체제 프로젝트의 `스케줄링`
- 컴퓨터구조 프로젝트의 `스케줄링`

위 두 개는 같은 이름이어도 `projectId`가 다르면 별도 노드로 둡니다.

추후 고도화:

- 같은 사용자 안에서 동일/유사 개념을 병합하는 `canonicalConceptId`를 둘 수 있습니다.
- 병합은 자동으로 하지 말고, AI 추천 + 사용자 확인 방식이 안전합니다.

추가 필드 예시:

```json
{
  "id": "node-1",
  "canonicalConceptId": "concept-scheduling",
  "projectId": "project-os",
  "name": "스케줄링"
}
```

## 6. API Contract Draft

### `GET /api/mypage/knowledge-graph`

- 목적:
  - 로그인 사용자의 모든 프로젝트에서 생성된 지식 그래프 노드와 엣지를 조회
- 책임:
  - 현재 사용자 소유 프로젝트에 속한 노드/엣지만 반환
  - 너무 많은 데이터가 있을 경우 제한 또는 샘플링 정책 적용
  - 프론트 그래프 렌더러가 바로 사용할 수 있는 shape로 변환

Query params 후보:

- `limitNodes`: 최대 노드 수
- `projectId`: 특정 프로젝트만 보고 싶을 때 사용
- `from`, `to`: 기간 필터
- `minWeight`: 약한 관계 제외
- `layout`: `overview`, `project`, `recent` 같은 표시 모드

응답 예시:

```json
{
  "nodes": [
    {
      "id": "node-1",
      "projectId": "project-os",
      "projectTitle": "운영체제 시험 정리",
      "label": "기아 현상",
      "category": "운영체제",
      "color": "#4ade80",
      "createdAt": "2026-04-25T10:30:00.000Z",
      "updatedAt": "2026-04-25T10:30:00.000Z"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "relationType": "related",
      "weight": 0.82
    }
  ],
  "meta": {
    "projectCount": 4,
    "nodeCount": 47,
    "edgeCount": 68,
    "generatedAt": "2026-04-25T11:00:00.000Z"
  }
}
```

### `GET /api/projects/:projectId/knowledge-graph`

- 목적:
  - 특정 프로젝트 상세 화면에서 해당 프로젝트의 지식 그래프만 조회
- 마이페이지 통합 그래프와 같은 node/edge shape를 쓰는 것이 좋습니다.
- 이렇게 하면 프로젝트 페이지 그래프와 마이페이지 통합 그래프가 같은 렌더러를 공유할 수 있습니다.

## 7. DB Query Draft

### 모든 프로젝트 노드 조회

```sql
SELECT
  nodes.id,
  nodes.project_id,
  projects.title AS project_title,
  nodes.name,
  nodes.category,
  nodes.color,
  nodes.created_at,
  nodes.updated_at
FROM knowledge_graph_nodes AS nodes
JOIN projects ON nodes.project_id = projects.id
WHERE projects.user_id = current_user_id
ORDER BY nodes.updated_at DESC;
```

### 모든 프로젝트 엣지 조회

```sql
SELECT
  edges.id,
  edges.source_node_id,
  edges.target_node_id,
  edges.relation_type,
  edges.weight,
  edges.project_id,
  edges.created_at
FROM knowledge_graph_edges AS edges
JOIN projects ON edges.project_id = projects.id
WHERE projects.user_id = current_user_id;
```

### 노드 제한 정책이 필요한 경우

그래프 노드가 너무 많으면 한 화면에 모두 그리기 어렵습니다.

초기 권장:

```sql
ORDER BY nodes.updated_at DESC
LIMIT 150;
```

또는 중요도 점수를 추가합니다.

```sql
ORDER BY nodes.importance_score DESC, nodes.updated_at DESC
LIMIT 150;
```

## 8. Frontend Rendering Plan

### Renderer Input Type

프론트에서는 DB row를 직접 사용하지 말고 그래프 렌더링 전용 타입으로 받습니다.

```ts
export interface KnowledgeGraphNode {
  id: string;
  projectId: string;
  projectTitle: string;
  label: string;
  category?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relationType?: string;
  weight?: number;
}

export interface KnowledgeGraphResponse {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  meta: {
    projectCount: number;
    nodeCount: number;
    edgeCount: number;
    generatedAt: string;
  };
}
```

### Rendering Options

1. SVG force graph

- 장점: DOM 기반이라 접근성과 디버깅이 쉬움
- 단점: 노드가 많아지면 느려질 수 있음
- 50개 이하 노드에 적합

2. Canvas force graph

- 장점: 노드가 많아도 상대적으로 빠름
- 단점: 텍스트/hover/접근성 처리가 더 복잡함
- 50~500개 노드에 적합

3. Three.js 3D graph

- 장점: 시각적으로 강함
- 단점: 구현/성능/모바일 대응 비용이 큼
- 초기 구현에는 과할 수 있음

초기 권장:

- 마이페이지 오른쪽 하단 작은 패널은 Canvas 또는 SVG 2D graph
- 클릭 시 전체 화면 모달에서 더 큰 그래프 표시
- 처음에는 노드 150개 이하 제한

## 9. Obsidian Export Policy

Obsidian과 비슷한 그래프를 만들 수는 있지만, Obsidian Markdown 파일을 원본 데이터로 삼지는 않습니다.

권장 역할 분리:

- DB: 서비스의 원본 데이터
- API JSON: 프론트 렌더링용 데이터
- Markdown export: 사용자가 Obsidian에서 열고 싶을 때 생성하는 내보내기 파일
- JSON export: 백업 또는 외부 도구 연동용 파일

### Markdown Export Example

노드 하나를 Markdown 파일 하나로 export할 수 있습니다.

파일명:

```txt
기아 현상.md
```

내용:

```md
---
project: 운영체제 시험 정리
category: 운영체제
createdAt: 2026-04-25T10:30:00.000Z
---

# 기아 현상

낮은 우선순위 프로세스가 CPU를 계속 할당받지 못하는 현상.

## Related

- [[스케줄링]]
- [[우선순위 스케줄링]]
```

### JSON Export Example

```json
{
  "nodes": [
    {
      "id": "node-1",
      "label": "기아 현상"
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

## 10. Graph Creation Flow

### 채팅에서 개념이 생성되는 경우

1. 사용자가 프로젝트 채팅에서 질문
2. AI 답변 생성
3. AI 또는 백엔드 파이프라인이 핵심 개념 추출
4. 기존 노드와 중복 여부 검사
5. 새 개념이면 `knowledge_graph_nodes`에 insert
6. 관련 개념이 있으면 `knowledge_graph_edges`에 insert
7. 프로젝트 `updatedAt` 갱신
8. 마이페이지 최근 학습 기록과 통합 그래프에 반영

### 자료 업로드에서 개념이 생성되는 경우

1. 사용자가 PDF/문서 업로드
2. 백엔드가 문서 파싱
3. AI가 핵심 개념과 관계 추출
4. 노드/엣지 후보 생성
5. 사용자 확인 또는 자동 반영 정책 적용
6. DB에 노드/엣지 저장
7. 마이페이지 그래프와 통계에 반영

## 11. Duplicate Handling

처음부터 완벽한 중복 병합을 시도하지 않는 것이 좋습니다.

초기 정책:

- 같은 프로젝트 안에서 같은 이름의 노드는 중복 생성하지 않음
- 다른 프로젝트에 같은 이름의 노드가 있으면 별도 노드로 유지

같은 프로젝트 중복 체크:

```sql
SELECT id
FROM knowledge_graph_nodes
WHERE project_id = current_project_id
  AND normalized_name = normalized_input_name;
```

추후 고도화:

- `normalizedName` 필드 추가
- 임베딩 기반 유사 개념 탐지
- `canonicalConceptId`로 여러 노드를 묶기
- 사용자에게 병합 여부 확인

## 12. Performance Notes

- 마이페이지는 첫 화면에서 너무 많은 노드를 한 번에 그리면 느려질 수 있습니다.
- 초기에는 `LIMIT 150` 정도를 권장합니다.
- 전체 그래프가 필요한 경우 별도 전체 화면 모달에서 추가 로딩합니다.
- 노드 수가 많아지면 project/category/recent 필터를 추가합니다.
- edge는 weight가 낮은 관계를 숨기는 옵션이 필요할 수 있습니다.
- API 응답은 캐싱할 수 있지만, 새 노드 생성 후에는 invalidate 해야 합니다.

## 13. Empty and Loading States

### 노드가 없는 경우

- 오른쪽 하단 패널에는 빈 어두운 패널만 두지 말고, 실제 연동 후에는 empty state를 표시합니다.
- 예: `아직 생성된 지식 그래프가 없습니다.`

### 로딩 중

- 패널 배경은 유지하고 skeleton 점 또는 흐릿한 placeholder를 보여줍니다.

### 에러 발생

- 그래프 API 실패 시 마이페이지 전체를 깨지게 하지 않습니다.
- 오른쪽 패널 안에만 `그래프를 불러오지 못했습니다.` 정도의 메시지와 재시도 버튼을 표시합니다.

## 14. Recommended Implementation Order

1. `knowledge_graph_nodes`, `knowledge_graph_edges` DB schema 확정
2. 프로젝트별 노드/엣지 생성 로직 구현
3. 같은 프로젝트 내 중복 노드 방지 로직 추가
4. `GET /api/projects/:projectId/knowledge-graph` 구현
5. `GET /api/mypage/knowledge-graph` 구현
6. 프론트에 `features/graph/service.ts` 또는 `features/mypage/service.ts` API 함수 추가
7. 오른쪽 하단 blank 패널을 graph renderer로 교체
8. 노드/엣지 hover, click, tooltip 구현
9. 전체 화면 모달에서 큰 그래프 보기 구현
10. 성능 기준에 따라 노드 제한, 필터, edge weight cutoff 추가
11. 필요 시 Markdown/JSON export 기능 별도 구현

## Recommended Backend Handoff Note

- Obsidian 스타일 그래프를 만들더라도 원본 데이터는 DB의 `knowledge_graph_nodes`와 `knowledge_graph_edges`로 관리해야 합니다.
- `/mypage` 오른쪽 하단 패널은 `GET /api/mypage/knowledge-graph` 응답의 `nodes`, `edges`를 렌더링하면 됩니다.
- Markdown/JSON 파일은 원본 저장소가 아니라 export/import 보조 기능으로 분리하는 것이 안전합니다.
- 초기 구현은 모든 프로젝트의 최근/중요 노드 최대 150개만 내려주고, 전체 그래프는 전체 화면 모달에서 확장하는 방향을 권장합니다.

---

# Full Frontend Repository Analysis and AWS Implementation Plan

## 1. Repository Scope

- 이 레포는 `eeum` 서비스의 프론트엔드 프로토타입입니다.
- 현재 백엔드 서버, 실제 인증, 실제 DB, 실제 파일 저장소, 실제 AI 호출은 포함되어 있지 않습니다.
- 대부분의 기능은 다음 세 가지 방식으로 데이터를 흉내 내고 있습니다.
  - static mock data
  - browser `localStorage`
  - 프론트 내부 helper/service 함수
- 최종 서비스에서는 AWS의 S3, EC2, DB, Bedrock, Lambda를 이용해 이 mock/localStorage 계층을 실제 백엔드 데이터 계층으로 교체해야 합니다.

## 2. Current Routes and Feature Ownership

### `/`

- 구현 파일:
  - `app/page.tsx`
  - `components/landing/*`
- 현재 역할:
  - 랜딩 페이지 렌더링
  - 서비스 소개, hero mock 이미지, feature section, graph-like visual layer 표시
- 현재 데이터:
  - 정적 UI 텍스트
  - `public/images/hero-workspace-mock.png`
- 실제 연동 필요성:
  - 핵심 서비스 데이터 연동은 없음
  - 나중에 로그인 상태에 따라 CTA 이동 경로를 바꿀 수 있음
- 연결될 데이터:
  - auth session
  - public asset metadata

### `/login`

- 구현 파일:
  - `app/login/page.tsx`
- 현재 역할:
  - Google 로그인 버튼 UI
  - 실제 OAuth 흐름은 아직 없음
- 현재 데이터:
  - 없음
  - 버튼 클릭 시 `console.log`
- 실제 연동 필요성:
  - Google OAuth 또는 Cognito 기반 인증 필요
  - 로그인 성공 후 사용자 프로필 생성 또는 조회 필요
- 연결될 데이터:
  - `users`
  - `user_profiles`
  - auth session / JWT / cookie

### `/dashboard`

- 구현 파일:
  - `app/dashboard/page.jsx`
  - `components/dashboard/dashboard-page-view.jsx`
  - `components/dashboard/WorkspaceProfileCard.tsx`
  - `features/dashboard/service.ts`
  - `features/dashboard/graph.ts`
  - `features/dashboard/types.ts`
  - `features/workspace/storage.js`
  - `features/project/model.js`
- 현재 역할:
  - 프로젝트 선택
  - 프로젝트별 최근 채팅 표시
  - 새 프로젝트 생성
  - 새 대화 생성
  - 채팅 탭 표시
  - 그래프 탭 표시
  - 프로젝트별 knowledge graph 표시
  - 최근 업데이트된 개념 표시
  - 사용자 프로필 카드 표시
- 현재 데이터:
  - 프로젝트 목록: `features/workspace/storage.js`의 `eeum-workspace-v1`
  - 채팅 목록: `features/dashboard/service.ts`의 `eeum-dashboard-chats-v1`
  - 프로젝트 metadata: `features/project/model.js`
  - 그래프 preset: `features/dashboard/graph.ts`
  - 사용자 프로필: `store/profileStore.ts`의 `eeum-profile-store`
- 실제 연동 필요성:
  - 프로젝트, 채팅, 메시지, 그래프, 프로필을 모두 DB/API에서 가져와야 함
  - 채팅 입력은 Bedrock 호출과 연결되어야 함
  - AI 답변 후 knowledge graph node/edge 업데이트가 필요함
- 연결될 데이터:
  - `projects`
  - `chats`
  - `chat_messages`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `diagnosis_sessions`
  - `user_profiles`

### `/upload`

- 구현 파일:
  - `app/upload/page.jsx`
  - `components/upload/upload-page-view.jsx`
  - `features/upload/mock-service.js`
- 현재 역할:
  - 프로젝트 자료 업로드 UI
  - drag and drop / file picker
  - 업로드 대기 파일 표시
  - 업로드된 파일 목록 표시
  - mock 분석 시작
  - mock 분석 완료 상태 시뮬레이션
  - 분석 완료 파일이 있으면 수준 진단 시작 가능
- 현재 데이터:
  - 업로드 파일 metadata: `eeum-upload-mock-v1`
  - 실제 파일 binary는 저장하지 않음
  - 분석 상태는 localStorage에서 시간 경과로 시뮬레이션
- 실제 연동 필요성:
  - 파일 binary는 S3에 저장해야 함
  - 파일 metadata와 분석 상태는 DB에 저장해야 함
  - 분석은 Lambda 또는 EC2 worker에서 수행해야 함
  - 분석 결과는 Bedrock을 이용해 개념 추출, 요약, 진단 문항 생성에 사용해야 함
- 연결될 데이터:
  - `project_files`
  - `file_analysis_jobs`
  - `file_chunks`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - S3 object key

### `/diagnosis`

- 구현 파일:
  - `app/diagnosis/page.jsx`
  - `components/diagnosis/diagnosis-page-view.jsx`
  - `features/diagnosis/model.js`
  - `features/workspace/storage.js`
- 현재 역할:
  - 수준 진단 intro
  - quiz 진행
  - analyzing 상태
  - ready 상태
  - 진단 결과 저장
  - 진단 완료 후 대시보드로 이동
- 현재 데이터:
  - 진단 문항 preset: `features/diagnosis/model.js`
  - 답변/결과 저장: `eeum-workspace-v1`의 `diagnosisByProject`
  - 프로젝트별 자료 상태도 localStorage에서 수정
- 실제 연동 필요성:
  - 진단 session은 DB에 저장해야 함
  - 문항은 프로젝트/업로드 자료/사용자 수준 기반으로 Bedrock이 생성하거나 DB template에서 가져와야 함
  - 답변은 DB에 저장하고 AI 평가를 거쳐 개념별 이해도와 추천 학습 경로를 생성해야 함
- 연결될 데이터:
  - `diagnosis_sessions`
  - `diagnosis_questions`
  - `diagnosis_answers`
  - `diagnosis_results`
  - `project_files`
  - `knowledge_graph_nodes`

### `/project/[projectId]`

- 구현 파일:
  - `app/project/[projectId]/page.jsx`
  - `components/project/project-page-view.jsx`
  - `features/project/model.js`
  - `features/workspace/storage.js`
- 현재 역할:
  - 이전 버전의 프로젝트 상세/워크스페이스 UI
  - 자료 목록 표시
  - mock 자료 추가
  - 채팅/그래프 탭 표시
- 현재 데이터:
  - `projectCatalog`
  - `eeum-workspace-v1`
- 실제 연동 필요성:
  - 현재 주요 워크스페이스는 `/dashboard` 쪽으로 통합된 상태에 가까움
  - 최종 서비스에서는 `/project/[projectId]`를 유지할지, `/dashboard?projectId=...`로 통일할지 결정 필요
- 연결될 데이터:
  - `projects`
  - `project_files`
  - `chats`
  - `knowledge_graph_nodes`

### `/mypage`

- 구현 파일:
  - `app/mypage/page.tsx`
  - `components/mypage/*`
  - `data/mockMyPageData.ts`
  - `store/profileStore.ts`
  - `components/graph/knowledge-graph-scene.tsx`
  - `features/dashboard/graph.ts`
  - `features/dashboard/service.ts`
- 현재 역할:
  - 프로필 요약
  - 프로필 수정 모달
  - 현재 프로젝트 수 / 총 학습 횟수 / 진단 횟수 / 이해 개념 표시
  - 최근 학습 기록 표시
  - 모든 프로젝트의 통합 지식 그래프 표시
  - 통합 그래프 전체 화면 확장
  - 전체 화면 그래프 필터링
- 현재 데이터:
  - 프로필: `eeum-profile-store`
  - 마이페이지 통계/최근 기록: `data/mockMyPageData.ts`
  - 오른쪽 그래프: `features/dashboard/service.ts`에서 프로젝트/채팅을 읽고 `features/dashboard/graph.ts`로 그래프 구성
- 실제 연동 필요성:
  - 마이페이지 요약은 DB aggregate API가 필요함
  - 최근 학습 기록은 `knowledge_graph_nodes.created_at DESC` 기준으로 조회해야 함
  - 통합 그래프는 모든 프로젝트의 `knowledge_graph_nodes`와 `knowledge_graph_edges`를 조회해야 함
  - 프로필 수정은 DB update API로 연결해야 함
- 연결될 데이터:
  - `users`
  - `user_profiles`
  - `projects`
  - `chats`
  - `chat_messages`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `diagnosis_sessions`

## 3. Current Local Storage Keys

### `eeum-workspace-v1`

- 사용 파일:
  - `features/workspace/storage.js`
  - `components/dashboard/dashboard-page-view.jsx`
  - `components/diagnosis/diagnosis-page-view.jsx`
  - `components/project/project-page-view.jsx`
  - `components/upload/upload-page-view.jsx`
- 저장 데이터:
  - `projects`
  - `materialsByProject`
  - `diagnosisByProject`
  - `notesByProject`
  - `lastOpenedProjectId`
- DB 전환 대상:
  - `projects`
  - `project_files`
  - `diagnosis_sessions`
  - `diagnosis_results`
  - `project_notes`

### `eeum-dashboard-chats-v1`

- 사용 파일:
  - `features/dashboard/service.ts`
- 저장 데이터:
  - `chatsByProject`
- DB 전환 대상:
  - `chats`
  - `chat_messages`

### `eeum-upload-mock-v1`

- 사용 파일:
  - `features/upload/mock-service.js`
- 저장 데이터:
  - 프로젝트별 파일 metadata
  - mock 분석 상태
- DB/S3 전환 대상:
  - S3 object
  - `project_files`
  - `file_analysis_jobs`

### `eeum-profile-store`

- 사용 파일:
  - `store/profileStore.ts`
  - `components/dashboard/WorkspaceProfileCard.tsx`
  - `components/mypage/*`
- 저장 데이터:
  - `profile`
  - `profileImage`
- DB/S3 전환 대상:
  - `users`
  - `user_profiles`
  - profile image S3 object

## 4. Required Backend Data Model

### `users`

- 목적:
  - 인증된 사용자 기본 정보
- 주요 필드:
  - `id`
  - `email`
  - `name`
  - `auth_provider`
  - `provider_user_id`
  - `created_at`
  - `updated_at`

### `user_profiles`

- 목적:
  - 마이페이지와 대시보드에서 공통으로 사용하는 사용자 설정
- 주요 필드:
  - `user_id`
  - `major`
  - `job`
  - `language`
  - `explanation_style`
  - `learning_type`
  - `profile_image_s3_key`
  - `updated_at`

### `projects`

- 목적:
  - 사용자의 학습 단위
- 주요 필드:
  - `id`
  - `user_id`
  - `title`
  - `subject`
  - `created_at`
  - `updated_at`
  - `last_opened_at`

### `project_files`

- 목적:
  - 프로젝트에 업로드된 자료 metadata
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `original_filename`
  - `mime_type`
  - `size_bytes`
  - `s3_bucket`
  - `s3_key`
  - `status`
  - `uploaded_at`
  - `analysis_completed_at`

### `file_analysis_jobs`

- 목적:
  - 업로드 자료 분석 작업 상태 추적
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `file_id`
  - `status`
  - `lambda_request_id`
  - `error_message`
  - `created_at`
  - `started_at`
  - `completed_at`

### `file_chunks`

- 목적:
  - 자료 분석 후 생성된 텍스트 chunk 저장
- 주요 필드:
  - `id`
  - `file_id`
  - `project_id`
  - `chunk_index`
  - `text`
  - `page_number`
  - `token_count`
  - `created_at`

### `chats`

- 목적:
  - 프로젝트별 대화 thread
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `title`
  - `created_at`
  - `updated_at`

### `chat_messages`

- 목적:
  - 채팅 메시지 저장
- 주요 필드:
  - `id`
  - `chat_id`
  - `user_id`
  - `role`
  - `content`
  - `model_id`
  - `bedrock_request_id`
  - `created_at`

### `knowledge_graph_nodes`

- 목적:
  - 프로젝트별 개념 노드 저장
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `name`
  - `normalized_name`
  - `category`
  - `description`
  - `source_type`
  - `source_id`
  - `color`
  - `importance_score`
  - `created_at`
  - `updated_at`

### `knowledge_graph_edges`

- 목적:
  - 개념 간 관계 저장
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `source_node_id`
  - `target_node_id`
  - `relation_type`
  - `weight`
  - `source_type`
  - `created_at`

### `diagnosis_sessions`

- 목적:
  - 개인 수준 진단 실행 단위 저장
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `file_id`
  - `status`
  - `started_at`
  - `completed_at`

### `diagnosis_questions`

- 목적:
  - 진단 세션의 문항 저장
- 주요 필드:
  - `id`
  - `session_id`
  - `order_index`
  - `type`
  - `prompt`
  - `choices_json`
  - `expected_keywords_json`
  - `concept_ids_json`

### `diagnosis_answers`

- 목적:
  - 사용자의 진단 답변 저장
- 주요 필드:
  - `id`
  - `session_id`
  - `question_id`
  - `answer`
  - `created_at`

### `diagnosis_results`

- 목적:
  - 진단 결과, 부족 개념, 추천 경로 저장
- 주요 필드:
  - `id`
  - `session_id`
  - `level_title`
  - `summary`
  - `concept_statuses_json`
  - `missing_concepts_json`
  - `recommended_actions_json`
  - `created_at`

### `project_notes`

- 목적:
  - 대시보드에서 프로젝트별 메모 저장
- 주요 필드:
  - `id`
  - `user_id`
  - `project_id`
  - `content`
  - `updated_at`

## 5. Feature-to-Data Connection Map

### Landing

- 현재:
  - static UI
- 필요한 데이터:
  - 로그인 여부
  - CTA destination
- API:
  - `GET /api/auth/session`
- AWS:
  - EC2 또는 Lambda/API Gateway에서 session 확인
  - 정적 asset은 S3 또는 EC2 static serving 가능

### Login

- 현재:
  - Google login UI만 존재
- 필요한 데이터:
  - OAuth 사용자 식별자
  - user record
  - profile record
- API:
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
  - `POST /api/auth/logout`
  - `GET /api/users/me`
- AWS:
  - EC2 backend에서 OAuth callback 처리
  - DB에 `users`, `user_profiles` 저장
  - session cookie 발급

### Dashboard Project Selector

- 현재:
  - `getProjects()`가 localStorage에서 프로젝트 조회
- 필요한 데이터:
  - 로그인 사용자 프로젝트 목록
  - 프로젝트별 최신 활동 시간
- API:
  - `GET /api/projects`
  - `POST /api/projects`
  - `PATCH /api/projects/:projectId`
  - `DELETE /api/projects/:projectId`
- DB:
  - `projects`
  - `chats`
  - `project_files`
  - `knowledge_graph_nodes`
- AWS:
  - EC2 backend가 RDS PostgreSQL 조회

### Dashboard Recent Chats

- 현재:
  - `getProjectChats(projectId)`가 localStorage에서 채팅 조회
- 필요한 데이터:
  - 프로젝트별 채팅 목록
  - 채팅별 최신 메시지 시간
- API:
  - `GET /api/projects/:projectId/chats`
  - `POST /api/projects/:projectId/chats`
  - `GET /api/chats/:chatId`
- DB:
  - `chats`
  - `chat_messages`
- AWS:
  - EC2 backend가 DB 조회
  - AI 응답 생성 시 Bedrock 호출

### Dashboard Chat

- 현재:
  - 채팅 메시지 표시 UI만 있고 실제 입력 전송 로직은 연결 전 단계
- 필요한 데이터:
  - 채팅 message history
  - 사용자의 새 질문
  - 프로젝트 자료 chunk
  - 사용자 프로필/설명 선호도
  - 진단 결과
- API:
  - `GET /api/chats/:chatId/messages`
  - `POST /api/chats/:chatId/messages`
- DB:
  - `chat_messages`
  - `file_chunks`
  - `diagnosis_results`
  - `user_profiles`
- AWS:
  - EC2 backend가 요청 수신
  - Bedrock으로 답변 생성
  - 필요 시 Bedrock Knowledge Bases 또는 DB/vector search로 자료 context retrieval
  - 응답 후 graph extraction Lambda 또는 EC2 job 실행

### Dashboard Project Graph

- 현재:
  - `features/dashboard/graph.ts` preset과 채팅 내용을 이용해 프론트에서 그래프 생성
- 필요한 데이터:
  - 프로젝트별 graph nodes
  - 프로젝트별 graph edges
  - 노드와 관련된 학습 이벤트
- API:
  - `GET /api/projects/:projectId/knowledge-graph`
  - `POST /api/projects/:projectId/knowledge-graph/nodes`
  - `POST /api/projects/:projectId/knowledge-graph/edges`
- DB:
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `chat_messages`
  - `project_files`
- AWS:
  - Bedrock이 채팅/자료에서 개념과 관계를 추출
  - Lambda 또는 EC2 worker가 DB에 node/edge upsert

### Upload

- 현재:
  - `uploadMockFiles()`, `startMockAnalysis()`가 localStorage 상태만 변경
- 필요한 데이터:
  - 실제 file binary
  - file metadata
  - 분석 job status
  - 분석 결과 chunk/summary/concept
- API:
  - `POST /api/projects/:projectId/files/presign`
  - `POST /api/projects/:projectId/files/complete`
  - `GET /api/projects/:projectId/files`
  - `POST /api/files/:fileId/analysis/start`
  - `GET /api/files/:fileId/analysis`
- DB:
  - `project_files`
  - `file_analysis_jobs`
  - `file_chunks`
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
- AWS:
  - S3에 원본 파일 저장
  - EC2 backend가 presigned upload URL 생성
  - S3 object created event 또는 API-triggered Lambda로 분석 시작
  - Lambda가 파일 파싱 후 Bedrock 호출
  - 결과를 DB에 저장

### Diagnosis

- 현재:
  - `features/diagnosis/model.js`의 static template으로 문항 생성
  - 결과는 localStorage에 저장
- 필요한 데이터:
  - 분석 완료 파일
  - 사용자 프로필
  - 업로드 자료 chunk
  - 기존 knowledge graph
  - 진단 문항
  - 답변
  - 평가 결과
- API:
  - `POST /api/projects/:projectId/diagnosis-sessions`
  - `GET /api/diagnosis-sessions/:sessionId`
  - `POST /api/diagnosis-sessions/:sessionId/answers`
  - `POST /api/diagnosis-sessions/:sessionId/complete`
- DB:
  - `diagnosis_sessions`
  - `diagnosis_questions`
  - `diagnosis_answers`
  - `diagnosis_results`
  - `file_chunks`
  - `knowledge_graph_nodes`
- AWS:
  - EC2 backend가 session 생성
  - Bedrock이 문항 생성/평가/추천 경로 생성
  - 결과 저장 후 dashboard/mypage 통계에 반영

### My Page Profile

- 현재:
  - zustand + localStorage profile store
- 필요한 데이터:
  - 사용자 이름
  - 전공
  - 직업
  - 언어
  - 선호 설명 방식
  - 목표 학습 유형
  - 프로필 이미지
- API:
  - `GET /api/users/me/profile`
  - `PATCH /api/users/me/profile`
  - `POST /api/users/me/profile-image/presign`
- DB/S3:
  - `users`
  - `user_profiles`
  - profile image S3 object
- AWS:
  - EC2 backend가 profile CRUD 처리
  - S3 presigned URL로 이미지 업로드

### My Page Stats

- 현재:
  - `data/mockMyPageData.ts`에서 mock count 반환
- 필요한 데이터:
  - 현재 프로젝트 수
  - 모든 프로젝트 채팅 수
  - 진단 수행 횟수
  - 모든 지식 그래프 노드 수
- API:
  - `GET /api/mypage`
- DB:
  - `projects`
  - `chats`
  - `diagnosis_sessions`
  - `knowledge_graph_nodes`
- AWS:
  - EC2 backend가 RDS aggregate query 실행

### My Page Recent Learning Records

- 현재:
  - `mockGraphNodes`에서 최근 기록 생성
- 필요한 데이터:
  - 최근 추가된 graph node
  - node category
  - created date
  - project id/title
- API:
  - `GET /api/mypage/recent-concepts?limit=6`
- DB:
  - `knowledge_graph_nodes`
  - `projects`
- AWS:
  - EC2 backend가 `created_at DESC LIMIT 6` 조회

### My Page Integrated Knowledge Graph

- 현재:
  - 대시보드 local graph를 모든 프로젝트 기준으로 합쳐 렌더링
- 필요한 데이터:
  - 모든 프로젝트의 graph nodes
  - 모든 프로젝트의 graph edges
  - project/category filter metadata
- API:
  - `GET /api/mypage/knowledge-graph`
- DB:
  - `knowledge_graph_nodes`
  - `knowledge_graph_edges`
  - `projects`
- AWS:
  - EC2 backend가 RDS에서 통합 그래프 조회
  - 프론트는 API JSON을 canvas renderer로 표시

## 6. Recommended AWS Architecture

### High-Level Architecture

```txt
Browser
  ↓
EC2-hosted Next.js frontend / backend API
  ↓
RDS PostgreSQL
S3
Bedrock
Lambda workers
```

권장 역할 분리:

- EC2:
  - Next.js 앱 배포
  - API server 역할
  - 인증/session 처리
  - DB read/write
  - presigned URL 발급
  - Bedrock synchronous chat 호출
- S3:
  - 업로드 원본 파일 저장
  - profile image 저장
  - 필요 시 분석 결과 artifact 저장
- DB:
  - RDS PostgreSQL 권장
  - 사용자, 프로젝트, 채팅, 파일 metadata, 진단, 그래프 node/edge 저장
- Bedrock:
  - 채팅 답변 생성
  - 업로드 자료 요약
  - 수준 진단 문항 생성
  - 진단 답변 평가
  - 지식 그래프 노드/엣지 추출
  - 필요 시 Knowledge Bases로 RAG 구성
- Lambda:
  - S3 업로드 후 비동기 분석
  - 파일 파싱
  - chunk 생성
  - Bedrock batch-style processing
  - graph node/edge extraction
  - 실패/재시도 가능한 background job

### Why EC2 for This Project

- 이 프론트엔드는 Next.js 앱입니다.
- SSR/API/backend를 한 서버에서 시작하려면 EC2가 단순합니다.
- 초기 서비스에서는 EC2 한 대에 Next.js app + backend API를 올리고, DB/S3/Bedrock/Lambda를 붙이는 방식이 가장 이해하기 쉽습니다.
- 사용량이 커지면 API 서버를 별도 EC2 또는 ECS로 분리할 수 있습니다.

## 7. AWS Service Usage by Feature

### S3

사용 위치:

- 자료 업로드 원본 파일
- 프로필 이미지
- Bedrock Knowledge Bases data source 후보
- 분석 결과 JSON artifact 저장 후보

구현 방식:

1. 프론트가 `POST /api/projects/:projectId/files/presign` 호출
2. EC2 backend가 user/project 권한 검증
3. EC2 backend가 S3 object key 생성
4. EC2 backend가 presigned PUT/POST URL 발급
5. 프론트가 파일을 S3에 직접 업로드
6. 프론트가 `POST /api/projects/:projectId/files/complete` 호출
7. EC2 backend가 `project_files` row 생성 또는 status 갱신

권장 S3 key:

```txt
users/{userId}/projects/{projectId}/files/{fileId}/{originalFilename}
users/{userId}/profile/{imageId}
analysis/{analysisJobId}/result.json
```

공식 근거:

- S3 presigned URL은 AWS 자격 증명 없는 클라이언트에 제한 시간 동안 upload/download 권한을 줄 수 있음.
- 공식 문서:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html

### Lambda

사용 위치:

- S3 업로드 후 분석 job 실행
- 파일 파싱
- chunk 생성
- Bedrock 호출을 통한 요약/개념 추출
- knowledge graph node/edge 생성

구현 방식:

1. S3 object created event 발생
2. Lambda가 이벤트 수신
3. Lambda가 `project_files`에서 file metadata 조회
4. Lambda가 S3 object 다운로드
5. Lambda가 txt/pdf 파싱
6. Lambda가 chunk 생성
7. Lambda가 Bedrock 호출 또는 Bedrock Knowledge Bases ingestion trigger
8. Lambda가 `file_chunks`, `knowledge_graph_nodes`, `knowledge_graph_edges`, `file_analysis_jobs` 갱신

주의:

- 같은 bucket에 결과를 다시 쓰면서 같은 trigger prefix를 사용하면 무한 루프가 생길 수 있음.
- 입력 prefix와 출력 prefix를 분리해야 함.

공식 근거:

- S3는 object created event를 Lambda로 보낼 수 있음.
- Lambda는 이벤트 기반 compute로 S3 변경 같은 이벤트에 반응할 수 있음.
- 공식 문서:
  - https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html

### DB

권장:

- Amazon RDS for PostgreSQL

이유:

- 프로젝트, 채팅, 메시지, 파일, 진단, 그래프 노드/엣지는 관계형 데이터에 가깝습니다.
- user ownership과 join query가 많습니다.
- RDS PostgreSQL은 managed PostgreSQL로 백업, Multi-AZ, read replica 같은 운영 기능을 사용할 수 있습니다.

공식 근거:

- RDS for PostgreSQL은 PostgreSQL DB instance, snapshot, point-in-time restore, backup, Multi-AZ, read replica 등을 지원합니다.
- 공식 문서:
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html
  - https://aws.amazon.com/rds/postgresql

### Bedrock

사용 위치:

- 채팅 답변 생성
- 사용자 수준에 맞춘 설명 생성
- 업로드 자료 요약
- 핵심 개념 추출
- 개념 관계 추출
- 수준 진단 문항 생성
- 진단 답변 평가
- 학습 추천 생성

구현 방식:

- synchronous chat:
  - EC2 backend가 `POST /api/chats/:chatId/messages` 처리 중 Bedrock 호출
  - 응답을 `chat_messages`에 저장
  - 필요 시 graph extraction job을 Lambda로 비동기 요청
- asynchronous file analysis:
  - Lambda가 S3 파일을 읽고 Bedrock 호출
  - 결과를 DB에 저장
- RAG:
  - 초기에는 DB에 저장된 `file_chunks`를 검색해 prompt context로 넣을 수 있음
  - 고도화 시 Bedrock Knowledge Bases를 사용해 S3 자료 기반 RAG를 구성할 수 있음

공식 근거:

- Bedrock은 foundation model을 단일 API로 사용할 수 있는 managed service이며, InvokeModel API로 prompt/inference parameter를 전달해 추론을 실행할 수 있음.
- Bedrock Knowledge Bases는 RAG를 위한 managed 기능으로 data source를 기반으로 retrieval과 prompt augmentation을 제공함.
- 공식 문서:
  - https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html
  - https://aws.amazon.com/documentation-overview/bedrock/
  - https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
  - https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html

### EC2

사용 위치:

- Next.js frontend hosting
- backend API
- auth/session
- DB connection
- Bedrock request orchestration
- S3 presigned URL 발급

구현 방식:

1. EC2에 Node.js runtime 구성
2. Next.js app build
3. `npm run start` 또는 별도 process manager로 실행
4. Nginx reverse proxy 설정
5. HTTPS는 ALB 또는 Nginx + certificate 방식 결정
6. environment variables로 DB/S3/Bedrock 설정 주입

공식 근거:

- EC2는 AWS Cloud에서 on-demand scalable compute capacity를 제공하고, 사용자가 필요한 virtual server를 실행할 수 있음.
- 공식 문서:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html
  - https://aws.amazon.com/documentation-overview/ec2/

## 8. Proposed API Surface

### Auth and User

- `GET /api/auth/session`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `GET /api/users/me/profile`
- `PATCH /api/users/me/profile`
- `POST /api/users/me/profile-image/presign`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/open`

### Uploads and Files

- `GET /api/projects/:projectId/files`
- `POST /api/projects/:projectId/files/presign`
- `POST /api/projects/:projectId/files/complete`
- `POST /api/files/:fileId/analysis/start`
- `GET /api/files/:fileId/analysis`

### Chats

- `GET /api/projects/:projectId/chats`
- `POST /api/projects/:projectId/chats`
- `GET /api/chats/:chatId`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`

### Diagnosis

- `POST /api/projects/:projectId/diagnosis-sessions`
- `GET /api/diagnosis-sessions/:sessionId`
- `POST /api/diagnosis-sessions/:sessionId/answers`
- `POST /api/diagnosis-sessions/:sessionId/complete`

### Knowledge Graph

- `GET /api/projects/:projectId/knowledge-graph`
- `GET /api/mypage/knowledge-graph`
- `POST /api/projects/:projectId/knowledge-graph/nodes`
- `POST /api/projects/:projectId/knowledge-graph/edges`
- `PATCH /api/knowledge-graph/nodes/:nodeId`
- `DELETE /api/knowledge-graph/nodes/:nodeId`

### My Page

- `GET /api/mypage`
- `GET /api/mypage/recent-concepts?limit=6`
- `GET /api/mypage/knowledge-graph`

## 9. End-to-End Flows

### New User Login Flow

1. 사용자가 `/login`에서 Google 로그인 클릭
2. EC2 backend가 OAuth 시작
3. callback에서 provider user 정보 수신
4. `users` upsert
5. `user_profiles` 없으면 기본값 생성
6. session cookie 발급
7. `/dashboard`로 이동
8. 프론트가 `GET /api/users/me/profile` 호출

### Project Creation Flow

1. 사용자가 대시보드에서 새 프로젝트 생성
2. 프론트가 `POST /api/projects` 호출
3. DB에 project 저장
4. 응답으로 project 반환
5. 프론트는 프로젝트 목록 갱신
6. 새 프로젝트를 선택 상태로 변경

### File Upload and Analysis Flow

1. 사용자가 `/upload`에서 파일 선택
2. 프론트가 `POST /api/projects/:projectId/files/presign` 호출
3. EC2 backend가 S3 presigned URL 발급
4. 프론트가 S3로 파일 직접 업로드
5. 프론트가 `POST /api/projects/:projectId/files/complete` 호출
6. DB에 `project_files` 생성 또는 status 갱신
7. S3 event 또는 API 호출로 Lambda 분석 시작
8. Lambda가 파일 파싱
9. Lambda가 Bedrock으로 요약/개념/관계 추출
10. DB에 `file_chunks`, `knowledge_graph_nodes`, `knowledge_graph_edges` 저장
11. 파일 status를 `analysis_completed`로 변경
12. 프론트는 polling으로 status 갱신

### Chat Flow

1. 사용자가 대시보드 채팅 입력
2. 프론트가 `POST /api/chats/:chatId/messages` 호출
3. DB에 user message 저장
4. EC2 backend가 관련 project file chunks와 diagnosis result 조회
5. Bedrock에 prompt 전송
6. assistant response 저장
7. 응답 반환
8. 백그라운드로 concept extraction 실행
9. 새 개념이 있으면 `knowledge_graph_nodes` upsert
10. 관계가 있으면 `knowledge_graph_edges` upsert
11. 대시보드 그래프와 마이페이지 그래프에 반영

### Diagnosis Flow

1. 사용자가 분석 완료 자료가 있는 프로젝트에서 수준 진단 시작
2. 프론트가 `POST /api/projects/:projectId/diagnosis-sessions` 호출
3. EC2 backend가 파일 chunk, 기존 graph, profile 조회
4. Bedrock이 진단 문항 생성
5. DB에 session/questions 저장
6. 프론트가 문항을 표시
7. 사용자가 답변 제출
8. 답변은 `diagnosis_answers`에 저장
9. 완료 시 Bedrock이 결과 평가
10. `diagnosis_results` 저장
11. 부족 개념은 graph node와 연결
12. dashboard/mypage 통계에 반영

### My Page Summary Flow

1. 프론트가 `/mypage` 진입
2. `GET /api/mypage` 호출
3. EC2 backend가 profile, aggregate stats, recent concepts 조회
4. 프론트가 profile card, stats, recent learning records 렌더링
5. 오른쪽 그래프 패널은 `GET /api/mypage/knowledge-graph` 호출
6. 프론트가 전체 프로젝트 graph를 canvas로 렌더링

## 10. Frontend Refactor Plan for Backend Integration

### 1단계: API service layer 정리

- 현재:
  - `features/dashboard/service.ts`
  - `features/upload/mock-service.js`
  - `features/workspace/storage.js`
  - `data/mockMyPageData.ts`
- 목표:
  - `features/*/service.ts`에서 API 호출만 담당
  - mock/localStorage helper는 `mock-*` 또는 `dev-*` 파일로 분리

권장 파일:

```txt
features/auth/service.ts
features/projects/service.ts
features/dashboard/service.ts
features/upload/service.ts
features/diagnosis/service.ts
features/mypage/service.ts
features/graph/service.ts
```

### 2단계: 데이터 타입을 API 기준으로 정리

- 현재 타입은 일부만 `types/profile.ts`, `features/dashboard/types.ts`에 있음
- 공통 API 타입을 추가해야 함

권장 파일:

```txt
types/api.ts
types/project.ts
types/chat.ts
types/file.ts
types/diagnosis.ts
types/graph.ts
types/profile.ts
```

### 3단계: localStorage fallback 정책 결정

- 개발 편의를 위해 mock mode를 유지할 수 있음
- 하지만 실제 서비스 모드에서는 DB/API를 source of truth로 사용해야 함

권장:

```txt
NEXT_PUBLIC_DATA_MODE=mock | api
```

### 4단계: 화면별 API 전환

전환 순서 권장:

1. Auth/profile
2. Projects
3. Chats
4. Upload files
5. Analysis jobs
6. Diagnosis
7. Knowledge graph
8. Mypage summary

## 11. Backend Implementation Milestones

### Milestone 1: Minimum Backend Foundation

- EC2에 API server 배포
- RDS PostgreSQL 생성
- DB migration 도입
- `users`, `user_profiles`, `projects` 구현
- session/auth 구현
- 프론트의 profile/project를 API로 전환

### Milestone 2: Chat and Dashboard Persistence

- `chats`, `chat_messages` 구현
- 대시보드 recent chats API 구현
- 새 대화 생성 API 구현
- 메시지 전송 API 구현
- Bedrock basic chat 연결

### Milestone 3: S3 Upload and Analysis

- S3 bucket 생성
- presigned URL API 구현
- `project_files`, `file_analysis_jobs` 구현
- S3 upload complete flow 구현
- Lambda 분석 worker 구현
- 분석 status polling 구현

### Milestone 4: Bedrock-Based Learning Intelligence

- 자료 요약
- 개념 추출
- 관계 추출
- 진단 문항 생성
- 진단 답변 평가
- 사용자 선호 설명 방식 반영

### Milestone 5: Knowledge Graph

- `knowledge_graph_nodes`, `knowledge_graph_edges` 구현
- 프로젝트별 graph API 구현
- 마이페이지 통합 graph API 구현
- graph node duplicate handling
- graph filter metadata 제공

### Milestone 6: My Page Completion

- `GET /api/mypage`
- `GET /api/mypage/recent-concepts`
- `GET /api/mypage/knowledge-graph`
- profile update API
- profile image upload
- diagnosis count 실제 수치 연결

### Milestone 7: Production Hardening

- AWS IAM least privilege
- S3 bucket private 설정
- presigned URL expiration 제한
- DB backup
- CloudWatch logging
- Lambda retry/dead-letter policy
- Bedrock request logging policy
- rate limit
- file size/type validation
- user ownership 검증

## 12. Security and Ownership Rules

- 모든 API는 현재 인증된 `userId`를 기준으로 데이터를 조회해야 합니다.
- 프론트에서 전달한 `projectId`, `chatId`, `fileId`, `nodeId`는 신뢰하면 안 됩니다.
- 서버는 항상 해당 resource가 현재 사용자 소유인지 확인해야 합니다.
- S3 object key에는 user/project scope를 포함합니다.
- S3 bucket은 public access를 차단합니다.
- 파일 다운로드도 presigned URL 또는 backend proxy를 통해 제공합니다.
- Bedrock prompt에는 다른 사용자의 데이터가 섞이지 않도록 retrieval query에서 user scope를 강제해야 합니다.

## 13. Important Technical Decisions Still Needed

- 인증:
  - Google OAuth 직접 구현
  - Amazon Cognito 사용
  - NextAuth/Auth.js 사용
- DB:
  - RDS PostgreSQL 단독
  - RDS PostgreSQL + vector extension
  - Bedrock Knowledge Bases managed vector store
- Backend runtime:
  - Next.js API routes on EC2
  - 별도 Express/Fastify API server on EC2
  - Lambda + API Gateway hybrid
- AI retrieval:
  - DB chunk search 직접 구현
  - Bedrock Knowledge Bases 사용
- Graph extraction:
  - 채팅 응답 직후 synchronous
  - Lambda background job
  - nightly/batch recompute
- 배포:
  - EC2 단일 인스턴스
  - EC2 + ALB
  - 이후 ECS 또는 managed service 전환

## 14. AWS References Used for This Plan

- Amazon S3 presigned URLs:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- S3 event notifications and Lambda:
  - https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html
- Amazon Bedrock:
  - https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html
  - https://aws.amazon.com/documentation-overview/bedrock/
  - https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
  - https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html
- Amazon RDS for PostgreSQL:
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html
  - https://aws.amazon.com/rds/postgresql
- Amazon EC2:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html
  - https://aws.amazon.com/documentation-overview/ec2/
