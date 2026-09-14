-- Add company_id to user transactions for better performance and data integrity
-- Migration Date: 2026-01-24

-- Add company_id column to tbl_user_transaction
ALTER TABLE tbl_user_transaction 
ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- Add foreign key constraint
ALTER TABLE tbl_user_transaction 
ADD CONSTRAINT fk_user_transaction_company 
  FOREIGN KEY (company_id) 
  REFERENCES tbl_company(company_id) 
  ON UPDATE CASCADE 
  ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_transaction_company_id 
ON tbl_user_transaction(company_id);

-- Create composite index for user + company filtering
CREATE INDEX IF NOT EXISTS idx_user_transaction_user_company 
ON tbl_user_transaction(user_id, company_id);

-- Populate company_id from existing customer relationships
UPDATE tbl_user_transaction ut
SET company_id = c.company_id
FROM tbl_customer c
WHERE ut.customer_id = c.customer_id
AND ut.company_id IS NULL;
