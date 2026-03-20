-- Adds file integrity tracking to resources.
-- baseline_hash: SHA-256 of the file at registration time (hex string)
-- last_hash:     SHA-256 of the file at last known-good check
-- last_hash_at:  when the last hash was recorded
-- hash_algorithm: always SHA256 for now

ALTER TABLE resources
  ADD COLUMN baseline_hash  VARCHAR(64)  NULL AFTER resource_path,
  ADD COLUMN last_hash      VARCHAR(64)  NULL AFTER baseline_hash,
  ADD COLUMN last_hash_at   DATETIME     NULL AFTER last_hash,
  ADD COLUMN hash_algorithm VARCHAR(20)  NOT NULL DEFAULT 'SHA256' AFTER last_hash_at;
