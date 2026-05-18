# Frontend API Integration TODO

## 전제

- 백엔드(`app/api/routes/*`, `app/schemas/*`)를 ground-truth로 본다.
- 백엔드 코드는 수정하지 않는다.
- `NEXT_PUBLIC_USE_BACKEND_API=true`일 때 프론트가 백엔드의 실제 요청/응답 계약에 맞도록 수정한다.
- 우선순위는 실제 기능이 깨질 가능성이 큰 항목부터 처리한다.

## 1. Mini Quiz 응답 배열 처리

**문제**

- 백엔드 `POST /mini-quiz/{project_id}/generate`와 `POST /mini-quiz/{project_id}/defer`는 `data`에 단일 객체가 아니라 문제 배열을 내려준다.
- 현재 프론트는 응답을 단일 question 객체로 취급한다.
- 그 결과 `question.question`, `question.question_id`, `choices` 접근이 깨질 수 있다.

**해결 접근**

- `frontend/features/mini-quiz/api-service.js`에서 generate/defer 응답을 항상 배열로 정규화한다.
- 배열 길이가 1이어도 동일하게 queue로 처리한다.
- `dashboard-page-view.jsx`에서 백엔드 응답 배열을 `conceptQueue` 형태로 변환해 `MiniQuizPopup`에 넘긴다.
- `MiniQuizPopup.jsx`는 가능한 한 `presetQuestion`/`conceptQueue` 경로를 중심으로 동작하게 정리한다.

**수정 대상**

- `features/mini-quiz/api-service.js`
- `components/dashboard/dashboard-page-view.jsx`
- `components/mini-quiz/MiniQuizPopup.jsx`

**보강 / 결정 필요**

- 코딩 시작 전 결정: 단건 submit을 N번 보낼지, `answers` 일괄 제출로 전환할지.
  - 백엔드 `POST /mini-quiz/{pid}/submit`은 `question_id`(단건), `answers`(여러 문항), `groups`(그룹) 세 가지를 받음.
  - 각 케이스의 정확한 동작:
    - 단건 N번 (`question_id`): `submit_mini_quiz_answer` N회 → 매 문항마다 `apply_evaluation_to_nodes(answer_score=evaluation["answer_score"])`로 노드 score를 문항별 점수 그대로 N번 갱신, `result_message` N개 생성.
    - `answers` 일괄: `submit_mini_quiz_group` 1회 → 두 문항을 모두 평가한 뒤 `group_score = sum / len`로 평균 산출(`mini_quiz_service.py:327-330`) → `apply_evaluation_to_nodes(answer_score=group_score)` **1번만** 호출, `result_message` 1개에 `group_score` 메타 포함.
    - `groups`: `submit_mini_quiz_groups` 내부에서 그룹 수만큼 `submit_mini_quiz_group` 호출 → 그룹 수만큼 `result_message`.
  - 즉 두 경로는 결과 메시지 개수만 다른 게 아니라 **노드 score 갱신값 자체가 다름**. 예: 만점 1개 + 0점 1개 케이스에서 단건은 "잘 풀었다가 못 풀었다"로 노드 두 번 갱신, 일괄은 "0.5점으로 한 번 갱신".
  - 변경 표면은 단건 N번이 더 작지만, 백엔드 group 의도("한 노드의 N문항을 같이 풀고 평균으로 평가")에는 `answers` 일괄이 더 가까움.
  - UX상 종료 메시지를 한 번만 보이거나 그룹 단위 채점 표시를 살리려면 `answers` 일괄 권장.
- 큐 모드와 `useMockMiniQuiz` 분기 호환성 회귀 확인.
  - `MiniQuizPopup.jsx`의 현재 분기 `isMiniQuizBackendApiEnabled && !shouldUseMockMiniQuiz`가 큐 안에 mock/backend 혼합 항목(특히 deferred)에서도 정상 동작하는지.
- generate 응답 배열은 호출한 `node_id` 하나에 속한 문제들임을 코드 주석으로 남길 것.
- 검증 시나리오: 채팅 진행 → "시험준비됨" → 시험보기 → 1번 문항 풀고 다음 문항 진입 → 마지막 답안 보기 정상 표시.

## 2. Mini Quiz `group` / `groups` 필드 보존

**문제**

- 현재 `apiRequest()`는 응답 객체에 `data`가 있으면 `payload.data`만 반환한다.
- 백엔드 mini quiz 응답은 `data` 옆에 `group` 또는 `groups`를 함께 내려준다.
- 지금 구조에서는 이 sibling 필드가 프론트에 도달하기 전에 버려진다.

**해결 접근**

- `frontend/features/api/client.js`의 `apiRequest()`에 `unwrap` 옵션을 추가한다.
- 기본값은 기존 호환을 위해 `unwrap: true`로 둔다.
- mini quiz API 호출만 `unwrap: false`를 사용해서 전체 payload를 받는다.
- mini quiz adapter에서 `{ data, group }`, `{ data, groups }`를 명시적으로 정규화한다.

**수정 대상**

- `features/api/client.js`
- `features/mini-quiz/api-service.js`
- mini quiz 호출부

**보강 / 결정 필요**

- `success: false` 가드는 unwrap 옵션과 무관하다는 점 코드 주석으로 명시.
  - `apiRequest`에서 `payload.success === false`면 `unwrap` 값과 상관없이 `ApiError` throw됨. 다음 사람이 헷갈리지 않도록.
- `unwrap: false`로 받는 페이로드 shape를 mini-quiz adapter에 JSDoc으로 기술.
  - generate/defer 응답: `{ success: true, data: DiagnosisQuestionResponse[], group: { node_id, node_name, question_ids }, message }`. (백엔드 `mini_quiz_service.py:174`의 generate group은 `group_id` 필드를 가지지 않음.)
  - deferred 응답: `{ success: true, data: DeferredMiniQuizItem[], groups: DeferredMiniQuizGroup[], message }`. (`group_id`는 `DeferredMiniQuizGroup`에만 존재.)

## 3. Profile PATCH 누락 필드 전송

**문제**

- 백엔드 `UserProfileUpdate`는 `major`, `learning_fields`, `current_level`, `learning_goal` 등을 받을 수 있다.
- 현재 프론트 `mapProfileToApiUpdate()`는 일부 필드만 보낸다.
- 마이페이지에서 전공/학습 분야/학습 목표를 수정해도 서버에 저장되지 않을 수 있다.

**해결 접근**

- `mapProfileToApiUpdate()`에 프론트 profile 값을 백엔드 필드명으로 추가 매핑한다.
- 기존 역방향 매핑과 맞춰 `profile.job`은 `learning_fields`로 보낸다.
- 프론트에 값이 없는 `current_level`은 무리해서 만들지 않고, 존재할 때만 보낸다.

**수정 대상**

- `features/api/session.js`

**보강 / 결정 필요**

- 코딩 시작 전 결정: 사용자가 비워둔 필드를 `null`로 전송할지, key 자체를 omit할지.
  - Pydantic `Optional` + 백엔드 `update_user_profile`이 `model_dump(exclude_unset=True)`를 쓰므로(`app/services/user_service.py:44`) **요청 본문에 포함된 필드만 갱신**된다. 본문에서 빠진 필드는 기존 값 유지.
  - 정확한 규칙:
    - **`profile_image`** — **touched 플래그 기반으로만 포함**. 항상 포함하면 위험.
      - 위험 시나리오: 사용자가 hydration 직전이나 사진이 없는 상태에서 텍스트만 바꿔 저장 → store의 `profileImage`가 `null` → `profile_image: null` 전송 → 서버의 기존 이미지가 의도치 않게 삭제됨.
      - 안전 규칙: 사진 업로드/삭제 액션이 발생했을 때만 `profile_image` 키 포함. 텍스트만 저장하면 키 omit.
    - **텍스트 필드** (`major`, `learning_fields`, `learning_goal` 등) — UX 결정 선행 필요.
      - 옵션 A (필수값): UI에서 빈 값 저장 차단(required + 검증). 저장 시 truthy일 때만 본문에 포함.
      - 옵션 B (비우기 허용): touched field 기준으로 빈 문자열 또는 `null`을 명시적으로 전송. truthy 규칙만 적용하면 "비우기 저장"이 silent하게 무시되어 사용자가 혼란.
- 사전 코드 확인 단계: ProfileEditModal의 현재 입력 정책(필드별 required 표시 / 빈 값 허용 여부)을 먼저 파악한 뒤 옵션 A/B 결정. 코드 확인 없이 정책부터 정하면 UI와 어긋남.
- 구현 위치 메모:
  - 이미지 입력 UI는 `ProfileEditModal`에 없고 `ProfileSummaryCard.tsx:26-35`(파일 input)에서 발생해 `MyPageView.tsx:59-71` → `profileStore.updateProfileImage`로 흐른다. 따라서 touched 플래그는 **`ProfileEditModal` 내부 state가 아니라 `profileStore`나 `MyPageView` state**에 둬야 한다.
  - 권장: `profileStore`에 `profileImageDirty` 추가. 이미지 변경 경로가 이미 store를 거치므로 자연스럽게 묶임.
  - **persist 처리 주의**: 현재 `profileStore`는 `persist` 미들웨어를 쓰며 `profileStore.ts:71-74`의 `partialize`가 `profile`과 `profileImage`만 localStorage에 저장한다. `profileImageDirty`는 다음 세 가지를 함께 적용해야 안전.
    - `partialize`에서 **의도적으로 제외**. 포함되면 새로고침 후에도 dirty=true가 살아남아, hydration이 옛 이미지로 store를 덮어쓴 뒤 모달 저장 시 옛 이미지를 다시 PATCH하는 잘못된 동작 발생.
    - store initial state에 `profileImageDirty: false`로 **명시적 정의**. 없으면 undefined로 시작해 type/일관성 문제.
    - `partialize` 위에 "dirty 플래그는 의도적으로 persist 제외 — 새로고침 후까지 살아남으면 위험" 한 줄 **주석** 권장. 다음 사람이 partialize 보고 "왜 빠졌지?" 헤매지 않음.
  - **hydration 쓰기와 사용자 쓰기 구분 필수**.
    - `MyPageView.tsx:44`의 `updateProfileImage(data.profileImage)`는 서버에서 가져온 값을 store에 채우는 hydration 호출. 이 경로까지 dirty true로 처리하면 무용지물.
    - 권장 구현 (옵션 B): `updateProfileImage`(서버 hydration용, dirty 손대지 않음)와 `setUserProfileImage`(사용자 액션용, dirty=true) 두 함수로 분리. 명시적이라 다음 사람이 헷갈리지 않음.
    - 차선 (옵션 A): `updateProfileImage(image, { fromUser = false })` 옵션 인자. `ProfileSummaryCard` 경로는 `{ fromUser: true }`로 호출.
  - **save 후 dirty 리셋**: `MyPageView.tsx:96-100`의 `onSave` 콜백에서 `await saveApiProfile(...)` 직후 `profileImageDirty = false`로 reset. 안 하면 다음 저장에서도 또 보냄.
  - `mapProfileToApiUpdate(profile, profileImage, options)` 같이 옵션 객체로 touched 정보를 받는 시그니처 권장.

- **이미지 저장 시점 결정 (UX) — 옵션 3 채택**
  - 현재 동작: `MyPageView.tsx:59-71`의 `handleImageChange`는 store만 업데이트하고, 서버 PATCH는 `MyPageView.tsx:96-100`의 ProfileEditModal `onSave`에서만 발생. 따라서 사용자가 이미지만 바꾸고 모달을 열지 않은 채 새로고침하면 hydration이 옛 이미지로 store를 덮어써 **새 이미지가 유실**된다.
  - 세 옵션 검토:
    - 옵션 1 (즉시 PATCH): `handleImageChange`에서 store 갱신 직후 서버 호출. 별도 mini-payload PATCH 헬퍼와 실패 처리 정책 필요. 작업량 증가.
    - 옵션 2 (모달 저장만): 현재 코드 그대로. 위험만 남고 보완 없음 → 비추.
    - 옵션 3 (임시 변경 + 명확한 저장 동선): 현재 코드 거의 그대로 두고 "저장되지 않은 변경사항이 있습니다" UI 인디케이터만 추가. 변경 표면이 가장 작고 모달 중심 저장 모델과 일관됨.
  - **채택: 옵션 3.**
  - 구현 가이드 (옵션 3):
    - `profileImageDirty === true`이고 모달이 열리지 않은 상태에서, `ProfileSummaryCard` 또는 헤더 영역에 작은 인디케이터/뱃지/토스트를 노출. 문구 예: "이미지 변경사항이 저장되지 않았습니다. 프로필 수정에서 저장하세요."
    - 인디케이터를 누르면 `setIsEditOpen(true)`로 모달을 바로 열어주는 동선 권장 (사용자가 어디서 저장하는지 헤매지 않도록).
    - 인디케이터 위치/문구/디자인은 디자이너 컨셉 결정 후 구현.
    - beforeunload 경고는 거슬리는 UX라 기본은 도입 안 함. 데이터 손실 리스크가 크다고 판단되면 추후 사용성 테스트 후 결정.
    - 모달 저장 성공 시 인디케이터 자동 사라짐 (위의 dirty 리셋과 자연스럽게 연결).
- 동시 cleanup: `mapApiUserToProfile`의 `user?.interest_field` 폴백은 백엔드 스키마에 없는 필드라 제거 가능.
- 검증 시나리오:
  - 마이페이지 → 전공/학습분야/학습목표 각각 변경 → 저장 → 새로고침 후 값 유지.
  - 텍스트만 변경(사진 손대지 않음) → 저장 → 새로고침 후에도 기존 사진 유지 (사진이 무심코 삭제되지 않는지 확인).
  - 프로필 사진 업로드 → 저장 → 새로고침 후 표시.
  - (현재 UI에 사진 삭제 버튼이 없으므로) **사진 삭제 시나리오는 삭제 UI를 추가하는 경우에만 추가**: 삭제 → 저장 → 새로고침 후에도 삭제 상태 유지.
  - (옵션 B 선택 시) 전공 input을 비우고 저장 → 새로고침 후 빈 값 유지.
  - hydration 직후 텍스트만 한 번 더 저장 → 사진 의도치 않은 삭제가 발생하지 않는지 확인.
  - (옵션 3 UX) 이미지만 변경 후 모달 안 열고 머무름 → "저장되지 않은 변경사항" 인디케이터가 보이는지 확인.
  - (옵션 3 UX) 인디케이터 클릭 → 프로필 수정 모달 자동 오픈 → 저장 → 새로고침 후에도 새 이미지 유지.
  - (옵션 3 알려진 한계) 이미지만 변경 후 모달 안 열고 새로고침 → 새 이미지 유실됨. 이게 의도된 동작인지(현재 옵션 3 한계) 회귀 점검.

## 4. Explanation API에 `explanation_style` 전달

**문제**

- 백엔드 `POST /explanation`은 `explanation_style`을 받아 설명 스타일 개인화에 사용한다.
- 현재 프론트는 `project_id`, `node_id`, `question`만 보낸다.
- 사용자 프로필의 설명 스타일이 실제 설명 생성에 반영되지 않는다.

**해결 접근**

- `createExplanation()` 시그니처에 `explanationStyle`을 추가한다.
- 호출부에서 profile store의 `explanationStyle`을 넘긴다.
- 백엔드가 허용하는 값(`example`, `concise`, `step`)만 전송한다.
- `project_id`는 명시적으로 `Number(projectId)`로 변환해 보낸다.

**수정 대상**

- `features/dashboard/service.ts`
- `components/dashboard/dashboard-page-view.jsx`

**보강 / 결정 필요**

- 코딩 시작 전 결정: ProfileInfo의 `"deep"` 값 처리.
  - 프론트 enum은 `"example" | "step" | "concise" | "deep"`, 백엔드 Literal은 `"example" | "concise" | "step"`만 받음. `"deep"` 전송 시 422 에러.
  - 권장: `["example", "concise", "step"]`에 포함될 때만 전송, 아니면 omit.
- `Number(projectId)` NaN 방어.
  - mock 카탈로그 projectId(`"os"`, `"algorithm"` 등)는 NaN이 됨. 현재 `if (!isBackendApiEnabled) return ""` 가드로 막혀 있지만, 방어 코드 한 줄 추가 권장.
- 검증 시나리오: 프로필 설명 스타일 변경 → 노드 상세에서 맞춤 설명 생성 → 응답 톤이 스타일에 맞게 변하는지 확인.

## 5. Chat Session API 사용 여부 결정

**문제**

- 백엔드에는 프로젝트별 다중 채팅 세션 API가 있다.
- 기존 프론트는 `session_id` 없이 채팅을 보내 백엔드 default session으로 처리했다.
- 채팅방 이름은 백엔드 `ChatSession.title`을 source of truth로 사용하기로 했으므로, 프론트도 ChatSession 단위로 동작해야 한다.

**해결 접근**

- 결정: **다중 thread 정책으로 전환 완료**.
- 다음 API를 프론트에 연결한다.
  - `GET /projects/{project_id}/chat-sessions`
  - `POST /projects/{project_id}/chat-sessions`
  - `DELETE /projects/{project_id}/chat-sessions/{session_id}`
  - `GET /chat/{project_id}/sessions/{session_id}`
  - `POST /chat/{project_id}?session_id=...`
- 새 채팅방 생성 시 별도 title 입력 UI는 추가하지 않는다. 백엔드 기본값 `"새 채팅방"`을 사용한다.
- 사이드바 title은 `ChatSession.title`만 표시하고, 첫 사용자 메시지 fallback은 사용하지 않는다.
- 프로젝트 첫 진입 시 세션을 자동 생성하지 않는다. 사용자가 `새 채팅`을 누르거나 세션 0개 상태에서 메시지를 전송할 때 생성한다.
- 삭제는 기존 채팅 메뉴의 삭제 버튼에 연결하고, 삭제 전 `confirm`을 띄운다. 마지막 세션도 삭제 가능하다.

**수정 대상**

- `features/dashboard/service.ts`
- `components/dashboard/dashboard-page-view.jsx`
- 채팅 sidebar 관련 컴포넌트

**완료 / 남은 TODO**

- `getProjectChats()`는 ChatSession 목록을 가져온 뒤 세션별 chat log를 조회해 `Chat[]`로 변환한다.
- `createChat()`는 backend mode에서 실제 ChatSession을 생성한다.
- `sendChatMessage()`는 `?session_id=...`를 붙여 선택된 세션에 메시지를 저장한다.
- `removeChat()`는 backend mode에서 ChatSession DELETE API를 호출한다.
- 남은 TODO: 채팅방 rename UX는 백엔드 PATCH 라우트가 필요하므로 항목 F로 분리한다.

## 6. Projects 목록 N+1 호출 정리

**문제**

- `/projects/me` 응답이 이미 `last_accessed_at`/`updated_at` 계열 시간을 제공한다.
- 현재 프론트는 프로젝트마다 추가로 `/chat/project/{id}`를 호출해 updated time을 보정한다.
- 프로젝트 수가 늘면 dashboard 초기 로딩이 느려진다.

**해결 접근**

- `normalizeApiProject()`가 백엔드의 시간 필드를 신뢰하도록 정리한다.
- `applyApiChatUpdatedAt()` 호출을 제거한다.
- 단, 백엔드가 채팅 저장 시 `last_accessed_at` 또는 `updated_at`을 실제 갱신하는지 동작 확인 후 제거한다.

**수정 대상**

- `features/dashboard/service.ts`

**보강 / 결정 필요**

- 백엔드 갱신 동작 확인 절차:
  1. `curl /api/projects/me`로 `last_accessed_at` 기록.
  2. 해당 프로젝트에 채팅 1번 전송.
  3. 다시 `/api/projects/me` 호출해서 `last_accessed_at` 또는 `updated_at`이 변했는지 확인.
- 갱신이 확인되면 `applyApiChatUpdatedAt` 함수 본체도 동시 삭제 (dead code 방지).
- 갱신되지 않는다면 워크어라운드 유지 + 장기 TODO로 백엔드 보강 요청.

## 7. My Page N+1 호출 완화

**문제**

- 마이페이지 통계 계산을 위해 프로젝트마다 graph/chat API를 추가 호출한다.
- 프로젝트가 많아질수록 로딩 비용이 선형으로 증가한다.

**해결 접근**

- 이미 `/mypage/me`에서 받을 수 있는 값은 우선 그 값을 사용한다.
- `diagnosisCount`는 learning log 기반 계산으로 대체 가능한지 확인한다.
- `conceptCount`, `totalChats`가 반드시 필요하면 프론트 단독으로 완전 해결하기 어렵다.
- 백엔드 수정이 금지된 현재 조건에서는 호출 개수 cap 또는 progressive loading으로 UX를 완화한다.

**수정 대상**

- `features/mypage/service.ts`
- 마이페이지 통계 표시부

**보강 / 결정 필요**

- 단계화 권장:
  - 1단계: `conceptCount` / `totalChats` 표시가 정말 마이페이지에 필요한 정보인지 기획 재확인. 빼도 되면 N+1 자체가 사라짐.
  - 2단계: 그래도 필요하면 호출 cap 도입 (예: 최근 5개 프로젝트만).
  - 3단계: 백엔드 보강 (이번 작업 범위 밖).
- progressive loading은 작업량이 크므로 1·2단계 후에도 부족할 때 검토.

## 8. Diagnosis dead reference 제거

**문제**

- 프론트 두 위치에서 백엔드 `DiagnosisStatusResponse`에 없는 필드들을 폴백 체인으로 참조한다.
  - `diagnosis-page-view.jsx:241, 515` (질문 difficulty 폴백 부분): `status?.estimated_level`.
  - `diagnosis-page-view.jsx:548-552` (최종 assessment 계산 부분): `status?.measured_level`, `status?.result_level`, `status?.estimated_level`, `status?.level`.
- 백엔드 `DiagnosisStatusResponse`는 `session_id / answered / total_questions / progress_percent`만 반환하므로 폴백들이 전부 dead.
- 런타임 에러는 아니지만 의미 없는 코드 + 다음 사람에게 잘못된 신호.

**해결 접근**

- 질문 difficulty 폴백 부분: `status?.estimated_level` 제거. `question.difficulty` 기반 폴백만 유지.
- assessment 계산 부분: `status?.measured_level / result_level / estimated_level / level` 4개 모두 제거. `(passedDiagnosis ? "상급" : "초급")` 폴백만 남김.

**수정 대상**

- `components/diagnosis/diagnosis-page-view.jsx`

**보강 / 결정 필요**

- 같은 라인의 difficulty 폴백 체인(`question.difficulty_level`, `question.difficultyValue`, `question.level`)도 모두 dead. `difficulty`만 백엔드가 제공.
- 일관성 정리 차원에서 함께 제거 권장.
- assessment의 폴백 4개를 모두 제거하면 `measuredLevel`이 항상 `"상급" | "초급"` 두 값만 남음. 이게 의도된 최종 동작이 맞는지 확인 필요.
  - 만약 더 세밀한 레벨 표시가 기획상 필요하면, 백엔드 추가 없이 프론트가 점수(`correctAnswerCount / total`) 기준으로 구간 분기하는 방식으로 대체.
- 검증 시나리오: 진단 12문제 완료 → 최종 화면의 measuredLevel 표시가 의도대로 나오는지.

## 9. Chat 응답의 `mini_quiz_trigger` / `grounding` 사용 정책 정리

**문제**

- 백엔드 `POST /chat/{project_id}` 응답에는 `mini_quiz_trigger`, `grounding` 정보가 포함된다.
- 현재 프론트는 주로 `concept_counting.quiz_ready_concepts`를 기준으로 mini quiz 트리거를 판단한다.
- 트리거 출처가 여러 개라 이후 백엔드 응답 구조 변경 시 취약할 수 있다.

**해결 접근**

- mini quiz 트리거 판단을 `mini_quiz_trigger` 중심으로 통일할지 결정한다.
- 기존 응답과의 호환을 위해 fallback으로 `concept_counting.quiz_ready_concepts`를 남긴다.
- `grounding`은 UI에 표시할 기획이 있을 때만 연결한다.

**수정 대상**

- `features/dashboard/service.ts`
- `components/dashboard/dashboard-page-view.jsx`

**보강 / 결정 필요**

- "결정 필요" 항목이 영구 미결로 남지 않도록 종결 조건 명시.
  - 권장 기본 결정: 현재 구조 유지(`concept_counting.quiz_ready_concepts` 기준), 백엔드 응답 구조가 다시 바뀔 때 재검토.
- `grounding` 표시 UI는 별도 기획 확정 시까지 보류.

## 10. Diagnosis Report 응답 재사용

**문제**

- `POST /diagnosis/{project_id}/report` 응답의 `messages`를 프론트가 사용하지 않고 dashboard로 이동한다.
- dashboard 진입 후 다시 `/chat/project/{id}`를 호출해 같은 데이터를 가져올 수 있다.

**해결 접근**

- report 생성 응답을 받아 dashboard 초기 렌더 seed로 전달한다.
- 전달 방식은 `sessionStorage`를 우선 고려한다.
- dashboard는 seed를 먼저 렌더링하고 이후 실제 chat fetch 결과와 reconcile한다.

**수정 대상**

- `components/diagnosis/diagnosis-page-view.jsx`
- `components/dashboard/dashboard-page-view.jsx`

**보강 / 결정 필요**

- reconcile 정책 명시 필요:
  - 매칭 키: 백엔드 `chat_id`.
  - seed의 chat_id가 fetch 결과에 있으면 fetch 우선 (서버 데이터가 정답).
  - seed는 한 번 사용 후 sessionStorage 키 즉시 삭제.
  - fetch가 seed보다 먼저 끝나면 seed는 그냥 무시.
- 이 항목은 functional bug가 아닌 1회 round-trip 절약. 시간 없으면 skip 가능.

## 11. `front_back_api.md` 갱신

**문제**

- 문서 일부가 현재 백엔드 스키마와 다르다.
- 프론트 개발자가 문서만 보고 작업하면 잘못된 요청/응답 형태를 기준으로 구현할 수 있다.

**해결 접근**

- User profile update 필드 목록을 현재 백엔드 기준으로 갱신한다.
- Project create body에서 `user_id`가 필요하지 않음을 명시한다.
- Mini quiz generate/defer 응답이 배열이라는 점과 `group`/`groups` sibling 필드를 문서화한다.
- Chat session API 사용 여부를 현재 프론트 정책에 맞게 명시한다.

**수정 대상**

- `front_back_api.md`

**보강 / 결정 필요**

- 다음 사람이 다른 API에서도 sibling 필드 손실 이슈를 만났을 때 어떻게 해야 하는지 (`apiRequest`의 `unwrap: false` 패턴)를 문서 한 단락으로 남길 것.

## A. 진단 결과 "풀이보기" 미구현

**문제**

- `features/diagnosis/api-service.js`에 `getApiDiagnosisReview`가 정의됐지만 호출 사이트가 없다.
- `components/diagnosis/diagnosis-page-view.jsx:399-402`의 `handleViewReview`는 placeholder다.

**해결 접근**

- 기획상 필요한 기능이면 별도 작업으로 분리.
- 불필요하면 함수와 버튼 둘 다 dead code로 제거.

**수정 대상**

- `features/diagnosis/api-service.js`
- `components/diagnosis/diagnosis-page-view.jsx`

## B. Upload `subject` 파라미터 silent drop

**문제**

- `uploadProjectFiles(projectId, subject, files)`의 `subject`가 백엔드 모드에서 무시된다.
- 정확한 동작: `upload-page-view.jsx:268`에서 `projectTitle`을 subject 인자로 넘기고, mock mode에서는 표시용 subject로 사용되지만 `features/upload/service.js:25` 백엔드 분기에서는 그냥 버려진다. (사용자 직접 입력이 아니라 projectTitle pass-through 구조)

**해결 접근**

- 의도된 동작이라면 코드에 주석으로 silent drop 명시 + 함수 시그니처에서 backend mode 무시임을 JSDoc으로 표기.
- 백엔드에 별도 subject가 의미 있는 정보라면 별도 TODO로 분리 (현재 백엔드 수정 금지 조건).
- 작업량 매우 작음. 표면적 영향 없음.

**수정 대상**

- `features/upload/service.js`

## C. `createChat` backend mode 동작 불일치

**문제**

- `features/dashboard/service.ts:687-715`의 `createChat`가 backend mode에서 빈 thread 객체만 로컬 생성한다.
- 새 대화 버튼을 눌러도 백엔드에 새 세션이 생성되지 않고, 이후 메시지는 default session에 누적된다.
- 항목 5 (Chat Session API 사용 여부)와 연동된 이슈다.

**해결 접근**

- 항목 5의 다중 thread 전환으로 해결 완료.
- backend mode `createChat()`는 `POST /projects/{pid}/chat-sessions`를 호출해 실제 세션을 생성한다.

**수정 대상**

- `features/dashboard/service.ts`
- `components/dashboard/dashboard-page-view.jsx`

## F. 채팅방 rename UX

**문제**

- 백엔드 ChatSession API에는 rename용 `PATCH /projects/{project_id}/chat-sessions/{session_id}` 라우트가 없다.
- 프론트 사이드바에는 이름 수정 메뉴가 있지만, 현재는 기능을 연결하지 않는다.

**해결 접근**

- 백엔드 PATCH 라우트 추가 동의가 있으면 별도 작업으로 분리한다.
- 그 전까지 새 채팅방 title은 백엔드 기본값 `"새 채팅방"`을 사용하고, 사이드바도 `ChatSession.title`을 그대로 표시한다.

## D. Project 생성 시 `project_description` 미전송

**문제**

- 백엔드 `ProjectCreate`는 `project_description: Optional[str]`을 받는다.
- 프론트 카탈로그(`MOCK_PROJECT_CATALOG`)에 description 텍스트가 있지만 `selectProjectFromCatalog` 호출에서 보내지 않는다.

**해결 접근**

- 카탈로그 description을 그대로 보내거나, 사용자가 직접 입력하게 할지 기획 확인.
- 우선순위 낮음. 백엔드에 저장된 description은 현재 어디에도 표시되지 않으므로 표시 화면이 정해진 뒤 함께 작업해도 됨.

**수정 대상**

- `features/dashboard/service.ts`

## E. Upload accept 확장자 affordance 불일치

**문제**

- 프론트 `components/upload/upload-page-view.jsx:405`의 input은 `accept=".pdf,.txt"`로 .txt도 선택 가능하게 노출한다.
- 같은 파일 `upload-page-view.jsx:212-221`의 `normalizeIncomingFiles`는 backend mode에서 .pdf만 통과시키고 .txt는 토스트("PDF 파일만 업로드할 수 있어 N개 파일을 제외했습니다")로 거절한다.
- 결과적으로 백엔드 400 에러가 발생하지는 않지만, 사용자는 파일 선택 다이얼로그에서 .txt를 고를 수 있는데 선택 직후 거절당하는 어색한 UX를 본다.
- 실제 사용자 에러가 아닌 **affordance 불일치**(선택 가능성과 처리 가능성이 어긋남).

**해결 접근**

- 1순위 (가장 단순): backend mode일 때 input의 `accept`도 `.pdf`로 좁힘. 동적 분기 한 줄.
- 2순위: 양쪽 모드 모두 `accept=".pdf"`로 통일. 분기 자체 제거. mock mode도 PDF 전용으로 정렬.
- 권장: 2순위. mock-service가 .txt를 가정한 동작이 있는지 확인 후 결정.

**수정 대상**

- `components/upload/upload-page-view.jsx`
- (필요 시) `features/upload/mock-service.js` — .txt 가정 코드 확인

**보강 / 결정 필요**

- 우선순위: 낮음. UX 폴리시 수준이며 functional bug는 아님. cleanup 그룹과 함께 처리.
- 결정 사항: mock mode도 PDF 전용으로 좁힐 것인지, mock만 .txt 허용을 유지할 것인지.
- 검증 시나리오: `NEXT_PUBLIC_USE_BACKEND_API=true` 환경에서 파일 선택 다이얼로그에 .pdf만 노출되는지 확인.

## 권장 작업 순서

1. `apiRequest()`에 `unwrap` 옵션 추가 (항목 2)
2. Mini Quiz generate/defer 배열 및 queue 처리 (항목 1)
3. Profile PATCH 누락 필드 추가 (항목 3) — touched 규칙 결정 선행
4. Explanation API에 `explanation_style` 전달 (항목 4)
5. Projects/My Page N+1 정리 (항목 6, 7)
6. Diagnosis dead reference 제거 (항목 8)
7. Upload accept 확장자 affordance 불일치 (항목 E) — UX 폴리시, cleanup 그룹과 함께
8. Chat session API 연결 (항목 5, C) — 다중 thread 전환 완료, rename은 항목 F로 분리
9. Diagnosis report seed 재사용 (항목 10) — 시간 여유 시
10. mini_quiz_trigger 정책 정리 (항목 9) — 결정 기록만
11. 진단 풀이보기/Upload subject/project_description (항목 A, B, D) — 기획 확정 후 일괄
12. `front_back_api.md` 갱신 (항목 11) — 위 모든 변경 반영 후 마지막

### 순서 변경 이유

- 문서 갱신을 마지막으로 이동: 코드 변경의 결과를 반영하는 작업이므로 마지막이 자연스럽다.
- 1~4를 한 PR로 묶기 좋음 (실제 깨진 기능 / 누락 필드 위주).
- 5~7을 한 PR로 묶기 좋음 (단순 cleanup / UX 폴리시).
- 8은 다중 thread 정책으로 정리 완료. rename만 별도 백엔드 협의 필요.
- 항목 E는 처음에 "실제 사용자 에러"로 잡았지만, 실제로는 프론트가 backend mode에서 .txt를 이미 거절하므로 affordance 불일치 수준. cleanup 그룹으로 하향 조정.

### 코딩 시작 전 결정해야 하는 항목

다음 4가지는 작업 시작 전에 정하고 들어가는 게 효율적이다.

1. 항목 1: mini quiz 단건 submit N번 vs `answers` 일괄 제출.
   - 둘은 결과 메시지 개수뿐 아니라 노드 score 갱신값까지 다름 (단건은 문항별, 일괄은 평균). 백엔드 group 의도에는 일괄이 더 가까움.
2. 항목 3: profile PATCH 빈 값 처리 규칙. ProfileEditModal의 현재 입력 정책 확인 선행.
   - `profile_image`: touched 플래그 기반으로만 포함. touched 플래그는 `profileStore`(권장) 또는 `MyPageView` state에 둠 — 이미지 입력 UI가 `ProfileEditModal`에 없으므로 모달 내부 state는 적절치 않음.
   - 텍스트 필드: UX 결정 필요. (A) 필수값으로 UI에서 빈 값 차단 + truthy일 때만 전송, 또는 (B) 비우기 허용 + touched 시 빈 문자열/null 명시 전송.
   - 이미지 저장 시점: **옵션 3 채택** (임시 변경 + 명확한 저장 동선). 현재 모달 저장 경로 유지하고 dirty 인디케이터만 추가. 디자이너 컨셉 결정 후 구현.
3. 항목 4: ProfileInfo `"deep"` 스타일 처리 (omit 권장).
4. 항목 E: mock mode도 PDF 전용으로 좁힐지, mock만 .txt 허용을 유지할지 (일관성 위해 PDF 전용 권장).
