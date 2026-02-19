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
