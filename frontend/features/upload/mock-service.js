const UPLOAD_STORAGE_KEY = "eeum-upload-mock-v1";

const defaultUploadState = {
  os: [
    {
      id: "os-seed-1",
      name: "11월11일.txt",
      subject: "운영체제",
      uploadedAt: "2026.04.01 09:10",
      status: "분석 완료",
      statusTone: "done",
      analyzeRequestedAt: null,
      completedAt: "2026.04.01 09:14"
    },
    {
      id: "os-seed-2",
      name: "11월13일.txt",
      subject: "운영체제",
      uploadedAt: "2026.04.02 11:40",
      status: "분석 완료",
      statusTone: "done",
      analyzeRequestedAt: null,
      completedAt: "2026.04.02 11:45"
    },
    {
      id: "os-seed-3",
      name: "11월18일.txt",
      subject: "운영체제",
      uploadedAt: "2026.04.03 14:30",
      status: "대기 중",
      statusTone: "idle",
      analyzeRequestedAt: null,
      completedAt: null
    },
    {
      id: "os-seed-4",
      name: "11월20일.txt",
      subject: "운영체제",
      uploadedAt: "2026.04.03 16:20",
      status: "분석 중",
      statusTone: "working",
      analyzeRequestedAt: Date.now() - 60_000,
      completedAt: null
    },
    {
      id: "os-seed-5",
      name: "11월25일.txt",
      subject: "운영체제",
      uploadedAt: "2026.04.05 10:05",
      status: "분석 완료",
      statusTone: "done",
      analyzeRequestedAt: null,
      completedAt: "2026.04.05 10:08"
    },
    {
      id: "os-seed-6",
      name: "11월27일.txt",
      subject: "운영체제",
      uploadedAt: "2026.04.07 13:45",
      status: "분석 완료",
      statusTone: "done",
      analyzeRequestedAt: null,
      completedAt: "2026.04.07 13:51"
    }
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function formatMockDate(timestamp) {
  const date = new Date(timestamp);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

function getStoredUploadState() {
  if (!canUseStorage()) {
    return clone(defaultUploadState);
  }

  try {
    const raw = window.localStorage.getItem(UPLOAD_STORAGE_KEY);

    if (!raw) {
      return clone(defaultUploadState);
    }

    return { ...clone(defaultUploadState), ...JSON.parse(raw) };
  } catch {
    return clone(defaultUploadState);
  }
}

function saveStoredUploadState(state) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(state));
}

function normalizeAnalysisState(files) {
  const now = Date.now();
  let hasChanged = false;

  const nextFiles = files.map((file) => {
    if (!file.analyzeRequestedAt || file.statusTone !== "working") {
      return file;
    }

    if (now - file.analyzeRequestedAt < 3500) {
      return file;
    }

    hasChanged = true;

    return {
      ...file,
      status: "분석 완료",
      statusTone: "done",
      completedAt: formatMockDate(now)
    };
  });

  return { nextFiles, hasChanged };
}

function ensureProjectFiles(projectId) {
  const stored = getStoredUploadState();
  const currentFiles = Array.isArray(stored[projectId]) ? stored[projectId] : [];
  const { nextFiles, hasChanged } = normalizeAnalysisState(currentFiles);

  if (!stored[projectId] || hasChanged) {
    const nextState = { ...stored, [projectId]: nextFiles };
    saveStoredUploadState(nextState);

    return nextFiles;
  }

  return currentFiles;
}

/**
 * 업로드 모달의 "업로드된 자료" 영역과 "업로드된 파일 목록" 테이블이 공통으로 사용할
 * mock 파일 목록 조회 함수입니다.
 *
 * 현재 단계:
 * - 백엔드가 아직 없기 때문에 localStorage 기반 mock 데이터만 읽습니다.
 * - 이 함수는 실제 API를 대신하는 read-only 진입점입니다.
 *
 * 나중에 실제 연동 시:
 * - `GET /projects/:projectId/files` 같은 API 호출로 교체하면 됩니다.
 * - 페이지는 여기서 파일 메타데이터 목록을 받아 렌더링하게 됩니다.
 *
 * 프론트가 이 함수에서 기대하는 데이터:
 * - `id`: 파일 식별자
 * - `name`: 파일명
 * - `subject`: 과목/프로젝트명
 * - `uploadedAt`: 업로드 시각 문자열
 * - `status`: 사용자에게 보여줄 상태 텍스트
 * - `statusTone`: 상태 뱃지 색상용 값
 */
export function listMockProjectFiles(projectId) {
  return clone(ensureProjectFiles(projectId));
}

/**
 * 드래그앤드롭 또는 파일 선택 이후, "AI 분석 시작" 버튼을 눌렀을 때
 * 프론트가 업로드 요청을 보냈다고 가정하는 mock 함수입니다.
 *
 * 현재 단계:
 * - 실제 파일 바이너리를 서버로 보내지 않습니다.
 * - 선택된 `File` 객체에서 화면 렌더링에 필요한 메타데이터만 추출하여 localStorage에 저장합니다.
 *
 * 나중에 실제 연동 시:
 * - 이 자리는 `multipart/form-data` 업로드 API 호출로 바뀝니다.
 * - 예: `POST /projects/:projectId/files/upload`
 *
 * 프론트가 백엔드로 보내고 싶은 데이터:
 * - 프로젝트 id
 * - 파일 배열(File / Blob)
 * - 파일명, MIME 타입, 파일 크기
 *
 * 프론트가 백엔드에서 받고 싶은 데이터:
 * - 저장된 파일 id
 * - 업로드 시각
 * - 초기 상태(`uploaded`, `queued` 등)
 */
export function uploadMockFiles(projectId, subject, files) {
  const stored = getStoredUploadState();
  const currentFiles = Array.isArray(stored[projectId]) ? stored[projectId] : [];
  const now = Date.now();

  const uploadedFiles = files.map((file, index) => ({
    id: `mock-upload-${now}-${index}`,
    name: file.name,
    subject,
    uploadedAt: formatMockDate(now + index * 1000),
    status: "대기 중",
    statusTone: "idle",
    analyzeRequestedAt: null,
    completedAt: null
  }));

  const nextState = { ...stored, [projectId]: [...uploadedFiles, ...currentFiles] };
  saveStoredUploadState(nextState);

  return clone(uploadedFiles);
}

/**
 * "AI 분석 시작" 버튼 클릭 시 호출되는 mock 분석 시작 함수입니다.
 *
 * 현재 단계:
 * - 실제 AWS Bedrock 호출은 하지 않습니다.
 * - 선택된 파일들의 상태를 `분석 중`으로 변경하고, 이후 조회 함수에서 일정 시간이 지나면
 *   `분석 완료`로 보이도록 시뮬레이션합니다.
 *
 * 나중에 실제 연동 시:
 * - 이 자리는 분석 작업 생성 API로 교체됩니다.
 * - 예: `POST /analysis/start`
 *
 * 프론트가 백엔드로 보내고 싶은 데이터:
 * - 프로젝트 id
 * - 분석 대상 file id 목록
 *
 * 프론트가 백엔드에서 받고 싶은 데이터:
 * - analysisJobId
 * - 초기 상태(`queued` / `running`)
 * - 추후 polling 또는 SSE에 사용할 식별자
 */
export function startMockAnalysis(projectId, fileIds) {
  const stored = getStoredUploadState();
  const currentFiles = Array.isArray(stored[projectId]) ? stored[projectId] : [];
  const now = Date.now();

  const nextFiles = currentFiles.map((file) =>
    fileIds.includes(file.id)
      ? {
          ...file,
          status: "분석 중",
          statusTone: "working",
          analyzeRequestedAt: now
        }
      : file
  );

  const nextState = { ...stored, [projectId]: nextFiles };
  saveStoredUploadState(nextState);

  return clone(nextFiles);
}

/**
 * 업로드 모달에서 "수준 진단 시작" 버튼을 활성화할 수 있는지 판단하기 위한 helper입니다.
 *
 * 현재 단계:
 * - 분석이 하나라도 완료된 파일이 있으면 true를 반환합니다.
 *
 * 나중에 실제 연동 시:
 * - 이 로직은 백엔드가 내려주는 프로젝트 상태 또는 분석 결과 readiness 필드로
 *   대체하는 편이 더 안전합니다.
 */
export function hasMockCompletedAnalysis(projectId) {
  return ensureProjectFiles(projectId).some((file) => file.statusTone === "done");
}
