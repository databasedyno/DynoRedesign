import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";

export interface CustomerRecord {
  id: string;
  customer_id: number;
  customer_name: string;
  email: string;
  company_id: number;
}

/**
 * Finds or creates a default customer for legacy API calls
 */
export const findOrCreateDefaultCustomer = async (
  companyId: number, 
  admId: number,
  baseCurrency: string
): Promise<CustomerRecord | null> => {
  try {
    // Look for existing default customer for this company
    const existingCustomer = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id 
       FROM tbl_customer 
       WHERE company_id = $1 AND email LIKE 'legacy-api-%'
       ORDER BY "createdAt" DESC LIMIT 1`,
      {
        bind: [companyId],
        type: QueryTypes.SELECT
      }
    );
    
    if (existingCustomer.length > 0) {
      apiLogger.info(`[LegacyAuth] Found existing default customer: ${existingCustomer[0].customer_id}`);
      return existingCustomer[0];
    }
    
    // Create a new default customer for legacy API calls
    const crypto = await import("crypto");
    const customerId = crypto.randomUUID();
    const defaultEmail = `legacy-api-${companyId}-${Date.now()}@dynopay.internal`;
    
    await sequelize.query(
      `INSERT INTO tbl_customer (id, customer_name, email, company_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      {
        bind: [customerId, 'Legacy API Customer', defaultEmail, companyId],
        type: QueryTypes.INSERT
      }
    );
    
    // Get the created customer with auto-generated customer_id
    const newCustomer = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id 
       FROM tbl_customer WHERE id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT
      }
    );
    
    if (newCustomer.length > 0) {
      // Create wallet for the customer
      const walletId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 0, NOW(), NOW())`,
        {
          bind: [walletId, newCustomer[0].customer_id, baseCurrency],
          type: QueryTypes.INSERT
        }
      );
      
      apiLogger.info(`[LegacyAuth] Created default customer: ${newCustomer[0].customer_id}`);
      return newCustomer[0];
    }
    
    return null;
  } catch (error) {
    apiLogger.error("[LegacyAuth] Error creating default customer:", error);
    return null;
  }
};

/**
 * Finds or creates a REAL customer for a payer email supplied by the merchant
 * (optional `customer_email` in the request body). Keyed by (company_id, email)
 * so repeat buyers reuse their row. This is what feeds referral marketing —
 * without it every legacy API payment lands on the shared synthetic customer
 * and the payer can never be auto-invited or emailed a receipt.
 */
export const findOrCreateEmailCustomer = async (
  companyId: number,
  email: string,
  customerName: string | null,
  baseCurrency: string
): Promise<CustomerRecord | null> => {
  try {
    const existing = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id
       FROM tbl_customer
       WHERE company_id = $1 AND LOWER(email) = $2
       ORDER BY "createdAt" DESC LIMIT 1`,
      { bind: [companyId, email], type: QueryTypes.SELECT }
    );
    if (existing.length > 0) return existing[0];

    const crypto = await import("crypto");
    const customerId = crypto.randomUUID();
    const name = (customerName || email.split("@")[0] || "Customer").slice(0, 120);
    await sequelize.query(
      `INSERT INTO tbl_customer (id, customer_name, email, company_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      { bind: [customerId, name, email, companyId], type: QueryTypes.INSERT }
    );
    const created = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id
       FROM tbl_customer WHERE id = $1`,
      { bind: [customerId], type: QueryTypes.SELECT }
    );
    if (created.length > 0) {
      const walletId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 0, NOW(), NOW())`,
        { bind: [walletId, created[0].customer_id, baseCurrency], type: QueryTypes.INSERT }
      );
      apiLogger.info(`[LegacyAuth] Created payer customer ${created[0].customer_id} for ${email} (company ${companyId})`);
      return created[0];
    }
    return null;
  } catch (error) {
    apiLogger.error("[LegacyAuth] Error creating payer customer:", error);
    return null;
  }
};
