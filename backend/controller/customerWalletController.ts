/**
 * In-app customer wallet (store credit) management for merchants.
 *   GET  /api/userApi/customers/wallet/ledger?company_id=&key=|customer_id=
 *   POST /api/userApi/customers/wallet/adjust  { company_id, key|customer_id, direction, amount, description }
 * Scoped to ONE brand; owner or a team member with manage_customers.
 */
import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { IUserType } from "../utils/types";
import { apiLogger } from "../utils/loggers";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import {
  CustomerWalletError,
  adjustCustomerWallet,
  getCustomerWallet,
  getCustomerWalletLedger,
  resolveCustomerForBrand,
  validateAdjustment,
} from "../services/customerWalletService";
import { invalidateDirectoryCache } from "./customerDirectoryService";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const customerIdsForIdentity = async (companyId: number, key: string): Promise<number[]> => {
  const rows = await sequelize.query<{ customer_id: number }>(
    `SELECT customer_id FROM tbl_customer WHERE company_id = :companyId AND LOWER(email) = :email ORDER BY customer_id ASC`,
    { replacements: { companyId, email: key.trim().toLowerCase() }, type: QueryTypes.SELECT }
  );
  return rows.map((r) => Number(r.customer_id));
};

const scope = async (res: express.Response, companyId: unknown, userId: number): Promise<{ companyId: number; ownerUserId: number } | null> => {
  if (!companyId) {
    errorResponseHelper(res, 400, "Select a brand (company_id) to manage customer balances");
    return null;
  }
  const company = await validateCompanyOwnership(res, String(companyId), userId, "manage_customers");
  if (!company) return null;
  return { companyId: Number(companyId), ownerUserId: Number((company as unknown as { user_id: number }).user_id) };
};

const getLedger = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, key, customer_id } = req.query as Record<string, string>;
    const s = await scope(res, company_id, userData.user_id);
    if (!s) return;
    const { companyId } = s;
    let ids: number[] = [];
    if (customer_id) {
      const c = await resolveCustomerForBrand({ companyId, customerId: Number(customer_id) });
      ids = [c.customer_id];
    } else if (key && !key.startsWith("anon:")) {
      ids = await customerIdsForIdentity(companyId, key);
    } else {
      return errorResponseHelper(res, 400, "key or customer_id is required");
    }
    const [wallet, entries] = await Promise.all([getCustomerWallet(ids), getCustomerWalletLedger(ids)]);
    successResponseHelper(res, 200, "Customer wallet ledger", {
      customer_ids: ids,
      wallet: wallet || { amount: 0, wallet_type: "USD" },
      has_wallet: !!wallet,
      entries,
    });
  } catch (e) {
    if (e instanceof CustomerWalletError) return errorResponseHelper(res, e.statusCode, e.message);
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const adjust = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, key, customer_id, name, direction, amount, description } = req.body || {};
    const s = await scope(res, company_id, userData.user_id);
    if (!s) return;
    const { companyId, ownerUserId } = s;
    if (direction !== "credit" && direction !== "debit") {
      return errorResponseHelper(res, 400, "direction must be credit or debit");
    }
    if (typeof key === "string" && key.startsWith("anon:")) {
      return errorResponseHelper(res, 400, "Anonymous payers have no wallet — pick an identified customer");
    }
    const valid = validateAdjustment(amount, description);
    const customer = await resolveCustomerForBrand({
      companyId,
      customerId: customer_id ? Number(customer_id) : null,
      email: key,
      name,
      createIfMissing: direction === "credit",
    });
    const result = await adjustCustomerWallet({
      customer,
      direction,
      amount: valid.amount,
      description: valid.description,
      actor: `user ${userData.user_id}`,
    });
    await invalidateDirectoryCache(ownerUserId, companyId);
    successResponseHelper(res, 200, direction === "credit" ? "Balance credited" : "Balance debited", result);
  } catch (e) {
    if (e instanceof CustomerWalletError) return errorResponseHelper(res, e.statusCode, e.message);
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export default { getLedger, adjust };
