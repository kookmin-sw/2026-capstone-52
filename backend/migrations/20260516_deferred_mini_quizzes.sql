BEGIN;

-- Existing databases need this column because SQLAlchemy create_all()
-- does not alter already-created tables.
ALTER TABLE diagnosis_answers
ADD COLUMN IF NOT EXISTS feedback_tags TEXT;

CREATE TABLE IF NOT EXISTS deferred_mini_quizzes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    node_id VARCHAR NOT NULL REFERENCES concept_nodes(node_id),
    question_id VARCHAR NOT NULL REFERENCES diagnosis_questions(question_id),
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITHOUT TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS ix_deferred_mini_quizzes_project_id
    ON deferred_mini_quizzes(project_id);

CREATE INDEX IF NOT EXISTS ix_deferred_mini_quizzes_node_id
    ON deferred_mini_quizzes(node_id);

CREATE INDEX IF NOT EXISTS ix_deferred_mini_quizzes_question_id
    ON deferred_mini_quizzes(question_id);

COMMIT;
