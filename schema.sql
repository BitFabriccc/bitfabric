-- D1 Database Schema for BitFabric API Keys
DROP TABLE IF EXISTS api_keys;

CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL UNIQUE,
  key_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  value TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  permanent INTEGER DEFAULT 0,
  UNIQUE(account_id, key_id)
);

CREATE INDEX idx_account_id ON api_keys(account_id);
CREATE INDEX idx_key_value ON api_keys(value);
