/**
 * customerDirectoryController.ts — the re-imagined "Customers" surface (routes).
 *
 * The old /userApi/customers endpoint lists raw tbl_customer rows + the
 * API-era customer-wallet balances, which for most merchants is a wall of
 * "@dynopay.internal" placeholder rows with $0 / 0 txns.
 *
 * These two endpoints instead expose a CRM-lite directory unified by payer
 * identity. All aggregation/query logic lives in customerDirectoryService.ts
 * (kept separate to stay within the R2 500-line-per-file budget).
 *
 * READ-ONLY: no schema changes, no writes (safe against the live DB).
 */
import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { IUserType } from "../utils/types";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";
import { resolveTransactionSource } from "../utils/transactionSource";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { deriveTxDisplayStatus } from "../utils/transactionDisplayStatus";
import {
  buildDirectory,
  resolveCompanyScope,
  TX_QUERY,
  identityEmailOf,
  channelOf,
  DirectoryEntry,
  TxRow,
} from "./customerDirectoryService";

/**
 * GET /api/userApi/customers/directory
 * Query: company_id?, search?, segment?(all|repeat|new|dormant|prospects|anonymous),
 *        sort?(recent|ltv|payments|name), page?, limit?
 */
const getCustomerDirectory = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      company_id,
      search,
      segment = "all",
      sort = "recent",
      page = 1,
      limit = 20,
    } = req.query as Record<string, string>;

    // RBAC: a member with manage_customers sees the OWNER's customer directory
    // for a granted company (no-op for owners). Company comes from ?company_id
    // or the X-Company-Id header.
    const companyIdParam = company_id || (req.headers["x-company-id"] as string) || undefined;
    let effectiveUserId = Number(userData.user_id);
    if (companyIdParam) {
      const companyData = await validateCompanyOwnership(res, companyIdParam, userData.user_id, "manage_customers");
      if (!companyData) return; // 403 already sent
      effectiveUserId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    const scope = await resolveCompanyScope(effectiveUserId, companyIdParam);
    if (!scope) return errorResponseHelper(res, 403, "Company does not belong to user");

    const dir = await buildDirectory(effectiveUserId, scope);

    let rows: DirectoryEntry[] = [...dir.persons, ...dir.anonymous];

    // Segment filter
    const seg = String(segment);
    if (seg === "anonymous") rows = rows.filter((r) => r.kind === "anonymous");
    else if (seg === "repeat") rows = rows.filter((r) => r.segment === "repeat");
    else if (seg === "new") rows = rows.filter((r) => r.segment === "new");
    else if (seg === "dormant") rows = rows.filter((r) => r.segment === "dormant");
    else if (seg === "prospects") rows = rows.filter((r) => r.segment === "prospect");

    // Search (name/email) — anonymous buckets are not searchable
    const q = (search || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.kind === "person" &&
          ((r.name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q))
      );
    }

    // Sort
    const time = (d: string | null) => (d ? new Date(d).getTime() : 0);
    const srt = String(sort);
    if (srt === "ltv") rows.sort((a, b) => b.ltv_usd - a.ltv_usd || time(b.last_payment) - time(a.last_payment));
    else if (srt === "payments") rows.sort((a, b) => b.payments_count - a.payments_count || b.ltv_usd - a.ltv_usd);
    else if (srt === "name") rows.sort((a, b) => (a.name || a.email || "\uffff").localeCompare(b.name || b.email || "\uffff"));
    else rows.sort((a, b) => time(b.last_payment || b.first_seen) - time(a.last_payment || a.first_seen));

    const total = rows.length;
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 1000);
    const pg = Math.max(Number(page) || 1, 1);
    const paged = rows.slice((pg - 1) * lim, pg * lim);

    successResponseHelper(res, 200, `Retrieved ${paged.length} customers`, {
      customers: paged,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(Math.ceil(total / lim), 1),
      aggregates: dir.aggregates,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * GET /api/userApi/customers/directory/detail
 * Query: key (email OR "anon:<channel>"), company_id?
 * Returns profile + real payment history + links sent + orders + wallet.
 */
const getCustomerDirectoryDetail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { key, company_id } = req.query as Record<string, string>;
    if (!key) return errorResponseHelper(res, 400, "key is required");

    // RBAC: remap to the OWNER for a granted team member (manage_customers).
    const companyIdParam = company_id || (req.headers["x-company-id"] as string) || undefined;
    let effectiveUserId = Number(userData.user_id);
    if (companyIdParam) {
      const companyData = await validateCompanyOwnership(res, companyIdParam, userData.user_id, "manage_customers");
      if (!companyData) return; // 403 already sent
      effectiveUserId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    const scope = await resolveCompanyScope(effectiveUserId, companyIdParam);
    if (!scope) return errorResponseHelper(res, 403, "Company does not belong to user");

    const dir = await buildDirectory(effectiveUserId, scope);
    const wantedKey = String(key).toLowerCase();
    const profile =
      dir.persons.find((p) => p.key === wantedKey) ||
      dir.anonymous.find((p) => p.key === wantedKey);
    if (!profile) return errorResponseHelper(res, 404, "Customer not found");

    const companyScoped = scope.companyId != null;
    const replacements: Record<string, unknown> = { userId: effectiveUserId, companyId: scope.companyId };
    const txRows = (await sequelize.query(TX_QUERY(companyScoped), {
      replacements,
      type: QueryTypes.SELECT,
    })) as unknown as TxRow[];

    const isAnon = wantedKey.startsWith("anon:");
    const anonChannel = isAnon ? wantedKey.slice(5) : null;
    const matches = txRows.filter((row) => {
      const email = identityEmailOf(row);
      if (isAnon) return !email && channelOf(row) === anonChannel;
      return email === wantedKey;
    });

    const payments = matches.slice(0, 50).map((row) => ({
      id: row.id,
      transaction_id: row.transaction_id,
      usd_value: Math.round(Number(row.usd_display || 0) * 100) / 100,
      base_amount: row.base_amount,
      base_currency: row.base_currency,
      crypto_amount: row.crypto_amount,
      crypto_currency: row.crypto_currency,
      status: deriveTxDisplayStatus(row.status, row.createdAt),
      channel: channelOf(row),
      title:
        resolveTransactionSource({
          source_order_id: row.source_order_id,
          source_order_ref: row.source_order_ref,
          source_link_id: row.source_link_id,
          source_link_type: row.source_link_type,
          source_link_title: row.source_link_title,
          source_parent_link_id: row.source_parent_link_id,
          source_parent_title: row.source_parent_title,
          source_parent_is_tip_jar: row.source_parent_is_tip_jar,
          customer_email: row.c_email,
        }).title,
      createdAt: row.createdAt,
      transaction_reference: row.transaction_reference,
    }));

    // Links sent to this person + their store orders (persons only)
    let links: Array<Record<string, unknown>> = [];
    let orders: Array<Record<string, unknown>> = [];
    if (!isAnon) {
      links = (await sequelize.query(
        `SELECT pl.link_id, pl.title, pl.link_type, pl.status, pl.base_amount, pl.base_currency,
                pl.payment_link, pl."createdAt"
         FROM tbl_payment_link pl
         WHERE pl.user_id = :userId AND LOWER(pl.email) = :email
           ${companyScoped ? "AND pl.company_id = :companyId" : ""}
         ORDER BY pl."createdAt" DESC LIMIT 20`,
        { replacements: { ...replacements, email: wantedKey }, type: QueryTypes.SELECT }
      )) as Array<Record<string, unknown>>;

      orders = (await sequelize.query(
        `SELECT po.order_id, po.public_ref, po.order_number, po.total_cents, po.currency,
                po.payment_status, po.fulfillment_status, po.paid_at, po."createdAt"
         FROM tbl_product_order po
         WHERE po.merchant_user_id = :userId AND LOWER(po.buyer_email) = :email
           ${companyScoped ? "AND po.company_id = :companyId" : ""}
         ORDER BY po."createdAt" DESC LIMIT 20`,
        { replacements: { ...replacements, email: wantedKey }, type: QueryTypes.SELECT }
      )) as Array<Record<string, unknown>>;
    }

    successResponseHelper(res, 200, "Customer detail retrieved", {
      profile,
      payments,
      payments_total: matches.length,
      links,
      orders,
      wallet: profile.has_wallet
        ? { amount: profile.wallet_balance, wallet_type: profile.wallet_currency }
        : null,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export default { getCustomerDirectory, getCustomerDirectoryDetail };
