-- Add user_relays table to track burst relay deployments
CREATE TABLE IF NOT EXISTS user_relays (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  status TEXT NOT NULL, -- 'provisioning', 'active', 'failed'
  relay_url TEXT,
  aws_instance_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_relays_email ON user_relays(user_email);
