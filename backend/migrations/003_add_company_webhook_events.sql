-- Migration 003: Opt-in webhook event subscriptions (Tier-1 audit item #2)
--
-- NULL  = merchant receives only the legacy events (payment.pending/.confirmed/
--         .underpaid/.settled/.settlement_failed) — i.e. unchanged behavior.
-- Array = merchant additionally receives the listed opt-in events
--         (payment.created, payment.expired, payment.overpaid).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tbl_company' AND column_name = 'webhook_events'
    ) THEN
        ALTER TABLE tbl_company ADD COLUMN webhook_events JSONB;
        RAISE NOTICE 'Added webhook_events column to tbl_company';
    ELSE
        RAISE NOTICE 'webhook_events column already exists in tbl_company';
    END IF;
END $$;

COMMENT ON COLUMN tbl_company.webhook_events IS
  'Opt-in webhook event types (payment.created, payment.expired, payment.overpaid). NULL = legacy events only.';
