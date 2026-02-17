-- Migration: add email verification fields to accounts

ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN verification_token TEXT;
ALTER TABLE accounts ADD COLUMN verification_expires_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_accounts_verification_token ON accounts(verification_token);
