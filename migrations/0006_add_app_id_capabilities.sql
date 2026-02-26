-- Added capabilities column to app_ids to allow granular overrides of parent api_key capabilities.
ALTER TABLE app_ids ADD COLUMN capabilities TEXT DEFAULT 'inherit';
