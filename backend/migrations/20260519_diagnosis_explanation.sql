BEGIN;

-- diagnosis_questions 테이블에 explanation 컬럼 추가
ALTER TABLE diagnosis_questions
    ADD COLUMN IF NOT EXISTS explanation TEXT;

COMMIT;
