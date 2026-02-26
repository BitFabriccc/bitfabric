-- BitFabric D1 schema
-- Goal: ONE account can have MANY API keys.
--
-- Key rules:
-- - (account_id, key_id) uniquely identifies a key row
-- - value is globally unique (used as the public API key string)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS api_keys (
  account_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  permanent INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (account_id, key_id),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_value ON api_keys(value);
-- Migration: Add app_ids table for public subscription identifiers

CREATE TABLE IF NOT EXISTS app_ids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  app_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(account_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_app_ids_account_id ON app_ids(account_id);
CREATE INDEX IF NOT EXISTS idx_app_ids_app_id ON app_ids(app_id);
