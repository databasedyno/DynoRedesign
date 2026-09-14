-- Migration 014: Track underpayment amounts on tbl_user_transaction
-- Adds the crypto amount actually received and the crypto amount still owed
-- so getPaymentStatus can expose amount_received / amount_remaining / paid_amount
-- (and their base-currency equivalents) for underpaid payments. Additive and
-- nullable — safe for older code that never sets them.

-- received_amount: crypto amount received so far (partial/underpaid payments)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tbl_user_transaction' AND column_name = 'received_amount'
    ) THEN
        ALTER TABLE tbl_user_transaction ADD COLUMN received_amount DOUBLE PRECISION;
        RAISE NOTICE 'Added received_amount column to tbl_user_transaction';
    ELSE
        RAISE NOTICE 'received_amount column already exists in tbl_user_transaction';
    END IF;
END $$;

-- remaining_amount: crypto amount still owed (expected - received) for underpayments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tbl_user_transaction' AND column_name = 'remaining_amount'
    ) THEN
        ALTER TABLE tbl_user_transaction ADD COLUMN remaining_amount DOUBLE PRECISION;
        RAISE NOTICE 'Added remaining_amount column to tbl_user_transaction';
    ELSE
        RAISE NOTICE 'remaining_amount column already exists in tbl_user_transaction';
    END IF;
END $$;

COMMENT ON COLUMN tbl_user_transaction.received_amount IS 'Crypto amount received so far (set on underpayment)';
COMMENT ON COLUMN tbl_user_transaction.remaining_amount IS 'Crypto amount still owed = expected - received (set on underpayment)';
