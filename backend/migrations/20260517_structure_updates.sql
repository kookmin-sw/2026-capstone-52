BEGIN;

-- 2.1 Project unique constraint (user_id + project_domain)
-- 2.1 Project unique constraint (user_id + project_domain)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'projects'::regclass
          AND conname = 'uq_project_user_domain'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT uq_project_user_domain UNIQUE (user_id, project_domain);
    END IF;
END $$;

-- 2.2 ChatSession 테이블 추가
CREATE TABLE IF NOT EXISTS chat_sessions (
    id         SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    title      VARCHAR NOT NULL DEFAULT '새 채팅방',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_chat_sessions_project_id ON chat_sessions(project_id);

-- 2.2 Chat 테이블에 session_id 컬럼 추가
ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES chat_sessions(id);

CREATE INDEX IF NOT EXISTS ix_chats_session_id ON chats(session_id);

-- 2.3 File 테이블에 chat_session_id, relevance_status 추가
ALTER TABLE files
    ADD COLUMN IF NOT EXISTS chat_session_id INTEGER REFERENCES chat_sessions(id),
    ADD COLUMN IF NOT EXISTS relevance_status VARCHAR NOT NULL DEFAULT 'UNCHECKED';

COMMIT;
