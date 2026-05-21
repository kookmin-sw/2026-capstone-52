BEGIN;

-- Existing databases need this column because SQLAlchemy create_all()
-- does not alter already-created tables.
ALTER TABLE project_memos
ADD COLUMN IF NOT EXISTS title VARCHAR NOT NULL DEFAULT 'Untitled';

-- The old single-memo schema made project_id unique. The multi-memo API
-- needs multiple rows per project, so drop any unique constraint that only
-- covers project_id.
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
            ON a.attrelid = c.conrelid
           AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'project_memos'::regclass
          AND c.contype = 'u'
        GROUP BY c.conname
        HAVING array_agg(a.attname::text ORDER BY a.attnum) = ARRAY['project_id']
    LOOP
        EXECUTE format('ALTER TABLE project_memos DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

COMMIT;
