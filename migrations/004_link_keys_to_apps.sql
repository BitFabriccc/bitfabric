-- Migration: Link API Keys to App IDs

ALTER TABLE api_keys ADD COLUMN app_id TEXT REFERENCES app_ids(app_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_app_id ON api_keys(app_id);
