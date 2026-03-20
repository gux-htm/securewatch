-- Add file integrity hash columns to resources table
-- baseline_hash: SHA-256 of file at registration time (tamper reference)
-- last_hash:     SHA-256 of file at last observed write
-- last_hash_at:  timestamp of last hash update

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS baseline_hash  VARCHAR(64)  NULL AFTER ownership_status,
  ADD COLUMN IF NOT EXISTS last_hash      VARCHAR(64)  NULL AFTER baseline_hash,
  ADD COLUMN IF NOT EXISTS last_hash_at   DATETIME     NULL AFTER last_hash;
