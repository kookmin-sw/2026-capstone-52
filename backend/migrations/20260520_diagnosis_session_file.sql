BEGIN;

-- files 테이블에 diagnosis_status 컬럼 추가
ALTER TABLE files
    ADD COLUMN IF NOT EXISTS diagnosis_status VARCHAR DEFAULT 'NOT_DIAGNOSED';

-- 진단 세션 - 파일 연결 테이블 생성
CREATE TABLE IF NOT EXISTS diagnosis_sessions (
    session_id  VARCHAR PRIMARY KEY,
    project_id  INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    file_id     VARCHAR REFERENCES files(file_id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

COMMIT;
