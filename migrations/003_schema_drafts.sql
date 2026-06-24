-- Phase B: the editable, persisted draft genome schema. A singleton row
-- (id = 'draft') holds the working schema the editor saves and the API serves
-- via GET /schema. No data is seeded here (the JSON is large); the app lazily
-- falls back to the file schema when no draft row exists. Idempotent.

CREATE TABLE IF NOT EXISTS schema_drafts (
    id          text PRIMARY KEY,
    body        jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
