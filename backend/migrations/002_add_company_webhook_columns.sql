-- Migration 002: Add webhook columns to tbl_company
-- This adds support for merchant webhook notifications

-- Add webhook_url column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_company' AND column_name = 'webhook_url'
    ) THEN
        ALTER TABLE tbl_company ADD COLUMN webhook_url VARCHAR(500);
        RAISE NOTICE 'Added webhook_url column to tbl_company';
    ELSE
        RAISE NOTICE 'webhook_url column already exists in tbl_company';
    END IF;
END $$;

-- Add webhook_secret column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tbl_company' AND column_name = 'webhook_secret'
    ) THEN
        ALTER TABLE tbl_company ADD COLUMN webhook_secret VARCHAR(100);
        RAISE NOTICE 'Added webhook_secret column to tbl_company';
    ELSE
        RAISE NOTICE 'webhook_secret column already exists in tbl_company';
    END IF;
END $$;

-- Add comment to webhook_url
COMMENT ON COLUMN tbl_company.webhook_url IS 'URL to receive payment webhook notifications';
COMMENT ON COLUMN tbl_company.webhook_secret IS 'Secret key for webhook signature verification';
