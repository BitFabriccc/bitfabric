-- Create new table without the invalid REFERENCES constraint
CREATE TABLE app_ids_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  app_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  api_key_id TEXT,
  capabilities TEXT DEFAULT 'inherit',
  UNIQUE(account_id, app_id)
);

-- Copy existing data
INSERT INTO app_ids_new (id, account_id, app_id, name, created_at, api_key_id, capabilities)
SELECT id, account_id, app_id, name, created_at, api_key_id, capabilities FROM app_ids;

-- Replace old table
DROP TABLE app_ids;
ALTER TABLE app_ids_new RENAME TO app_ids;

-- Recreate indices
CREATE INDEX idx_app_ids_account_id ON app_ids(account_id);
CREATE INDEX idx_app_ids_app_id ON app_ids(app_id);
CREATE INDEX idx_app_ids_api_key_id ON app_ids(api_key_id);
