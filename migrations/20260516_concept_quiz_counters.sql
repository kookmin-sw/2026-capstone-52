BEGIN;

CREATE TABLE IF NOT EXISTS concept_quiz_counters (
    counter_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    node_id VARCHAR NOT NULL REFERENCES concept_nodes(node_id),
    mention_count INTEGER NOT NULL DEFAULT 0,
    last_counted_chat_id INTEGER NULL REFERENCES chats(chat_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT uq_concept_quiz_counters_project_node UNIQUE (project_id, node_id)
);

CREATE INDEX IF NOT EXISTS ix_concept_quiz_counters_project_id
    ON concept_quiz_counters(project_id);

CREATE INDEX IF NOT EXISTS ix_concept_quiz_counters_node_id
    ON concept_quiz_counters(node_id);

COMMIT;
