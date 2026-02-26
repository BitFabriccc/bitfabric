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
