-- Account soft-delete (7-day recovery grace + admin restore), mirrors brand
-- soft-delete (migration 012). Explicit columns — userModel is deliberately NOT
-- made paranoid (login/auth gating is done with explicit deleted_at checks).
-- Idempotent: safe to run more than once.

ALTER TABLE tbl_user
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_user_deleted_at ON tbl_user (deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_scheduled_purge_at
  ON tbl_user (scheduled_purge_at) WHERE deleted_at IS NOT NULL;
