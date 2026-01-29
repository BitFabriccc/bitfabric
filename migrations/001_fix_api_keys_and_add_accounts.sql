-- Migration: allow multiple keys per account + add accounts table for password auth
-- Safe, non-destructive: copies existing api_keys rows.

-- 1) Accounts table (password-authenticated)
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  account_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_account_id ON accounts(account_id);

-- 2) Fix api_keys schema: remove UNIQUE(account_id) while keeping UNIQUE(account_id,key_id)
CREATE TABLE IF NOT EXISTS api_keys_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  value TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  permanent INTEGER DEFAULT 0,
  UNIQUE(account_id, key_id)
);

-- Copy existing data if the old table exists
INSERT INTO api_keys_new (id, account_id, key_id, name, description, value, created_at, permanent)
SELECT id, account_id, key_id, name, description, value, created_at, permanent
FROM api_keys;

DROP TABLE api_keys;
ALTER TABLE api_keys_new RENAME TO api_keys;

CREATE INDEX IF NOT EXISTS idx_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_key_value ON api_keys(value);
