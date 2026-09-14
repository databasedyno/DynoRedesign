-- Phase 10: Add company_id to payment links for multi-tenant isolation
-- Migration Date: 2026-01-24

-- Add company_id column to tbl_payment_link
ALTER TABLE tbl_payment_link 
ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- Add foreign key constraint
ALTER TABLE tbl_payment_link 
ADD CONSTRAINT fk_payment_link_company 
  FOREIGN KEY (company_id) 
  REFERENCES tbl_company(company_id) 
  ON UPDATE CASCADE 
  ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_link_company_id 
ON tbl_payment_link(company_id);

-- Create composite index for user + company filtering
CREATE INDEX IF NOT EXISTS idx_payment_link_user_company 
ON tbl_payment_link(user_id, company_id);
