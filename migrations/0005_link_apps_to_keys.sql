-- Migration: Link App IDs to API Keys

ALTER TABLE app_ids ADD COLUMN api_key_id TEXT REFERENCES api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_app_ids_api_key_id ON app_ids(api_key_id);

-- Note: SQLite doesn't support DROP COLUMN in ALTER TABLE easily, so we leave api_keys.app_id as a dead column for now to avoid table recreation complexity.

