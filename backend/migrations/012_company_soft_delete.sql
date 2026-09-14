-- Brand soft-delete (7-day grace period + admin restore).
-- Adds the columns the paranoid companyModel + brandPurgeService rely on.
-- Idempotent: safe to run more than once.

ALTER TABLE tbl_company
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMP WITH TIME ZONE NULL;

-- Fast lookups: paranoid scope filters on deleted_at; the purge cron scans
-- scheduled_purge_at for rows past their grace window.
CREATE INDEX IF NOT EXISTS idx_company_deleted_at ON tbl_company (deleted_at);
CREATE INDEX IF NOT EXISTS idx_company_scheduled_purge_at
  ON tbl_company (scheduled_purge_at) WHERE deleted_at IS NOT NULL;
