/**
 * customerDirectoryService.ts — shared data layer for the re-imagined
 * "Customers" surface (see customerDirectoryController.ts for the routes).
 *
 * Extracted from the controller to keep every backend file within the R2
 * 500-line budget (strangler pattern, memory/ENGINEERING_STRATEGY_REVIEW_2026-08.md).
 *
 * Derives a CRM-lite directory from what actually happened: every payment in
 * tbl_user_transaction, unified by payer identity across
 *   - tbl_product_order.buyer_email / buyer_name  (store checkout)
 *   - tbl_customer.email                          (real, non-internal emails)
 *   - tbl_payment_link.email / customer_name      (payment requests / carts)
 * Payments with no captured identity collapse into ONE anonymous bucket per
 * channel (API / payment link / store / tip / donation / direct).
 *
 * READ-ONLY: no schema changes, no writes (safe against the live DB).
 */
import { QueryTypes } from "sequelize";
import { companyModel } from "../models";
import sequelize from "../utils/dbInstance";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import {
  resolveTransactionSource,
  isApiBuyerEmail,
  CanonicalTxSourceType,
} from "../utils/transactionSource";
import { PROCESSED_STATUSES, PROCESSED_USD_EXPR } from "../utils/processedVolume";
import { deriveTxDisplayStatus } from "../utils/transactionDisplayStatus";
import { add, sum, toNumber } from "../utils/money";

const PAID_SET = new Set<string>(PROCESSED_STATUSES as readonly string[]);

/** Placeholder display names minted by the backend — never treat as a real name. */
const PLACEHOLDER_NAMES = new Set([
  "recovered customer",
  "legacy api customer",
  "api customer",
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_WINDOW_DAYS = 30;
const DORMANT_AFTER_DAYS = 90;
const TX_SCAN_LIMIT = 20000;
const LINK_SCAN_LIMIT = 5000;
const CACHE_TTL_SECONDS = 60;

export type Segment = "prospect" | "new" | "active" | "repeat" | "dormant";

export interface DirectoryEntry {
  key: string;
  kind: "person" | "anonymous";
  name: string | null;
  email: string | null;
  mobile: string | null;
  channels: CanonicalTxSourceType[];
  payments_count: number;
  pending_count: number;
  links_count: number;
  ltv_usd: number;
  first_seen: string | null;
  last_payment: string | null;
  segment: Segment | "anonymous";
  has_wallet: boolean;
  wallet_balance: number;
  wallet_currency: string | null;
  customer_ids: number[];
}

export interface DirectoryData {
  persons: DirectoryEntry[];
  anonymous: DirectoryEntry[];
  aggregates: {
    total_customers: number;
    revenue_usd: number;
    identified_revenue_usd: number;
    repeat_rate: number;
    new_this_month: number;
    anonymous_payments: number;
    anonymous_revenue_usd: number;
  };
}

export interface TxRow {
  id: number;
  transaction_id: string | null;
  usd_display: number | string | null;
  base_amount: number | string | null;
  base_currency: string | null;
  crypto_amount: number | string | null;
  crypto_currency: string | null;
  status: string;
  createdAt: string;
  transaction_reference: string | null;
  c_customer_id: number | null;
  c_name: string | null;
  c_email: string | null;
  c_mobile: string | null;
  source_link_id: number | null;
  source_link_type: string | null;
  source_link_title: string | null;
  source_parent_link_id: number | null;
  source_parent_title: string | null;
  source_parent_is_tip_jar: boolean | null;
  pl_email: string | null;
  pl_customer_name: string | null;
  pl_donor_name: string | null;
  source_order_id: number | null;
  source_order_ref: string | null;
  po_email: string | null;
  po_name: string | null;
  po_phone: string | null;
}

const cleanEmail = (e?: string | null): string | null => {
  const v = (e || "").trim().toLowerCase();
  if (!v || !v.includes("@")) return null;
  if (isApiBuyerEmail(v)) return null; // synthetic @dynopay.internal placeholders
  return v;
};

const cleanName = (n?: string | null): string | null => {
  const v = (n || "").trim();
  if (!v) return null;
  if (PLACEHOLDER_NAMES.has(v.toLowerCase())) return null;
  return v;
};

/** Identity email for one transaction — order buyer > real customer > link recipient. */
export const identityEmailOf = (row: TxRow): string | null =>
  cleanEmail(row.po_email) || cleanEmail(row.c_email) || cleanEmail(row.pl_email);

const identityNameOf = (row: TxRow): string | null =>
  cleanName(row.po_name) ||
  (cleanEmail(row.c_email) ? cleanName(row.c_name) : null) ||
  cleanName(row.pl_customer_name) ||
  cleanName(row.pl_donor_name);

export const channelOf = (row: TxRow): CanonicalTxSourceType =>
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
  }).type;

const minDate = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
};
const maxDate = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
};

const segmentOf = (e: {
  payments_count: number;
  last_payment: string | null;
  first_paid: string | null;
}): Segment => {
  if (e.payments_count === 0) return "prospect";
  const now = Date.now();
  const last = e.last_payment ? new Date(e.last_payment).getTime() : 0;
  if (now - last > DORMANT_AFTER_DAYS * DAY_MS) return "dormant";
  if (e.payments_count >= 2) return "repeat";
  const first = e.first_paid ? new Date(e.first_paid).getTime() : 0;
  if (now - first <= NEW_WINDOW_DAYS * DAY_MS) return "new";
  return "active";
};

/** Resolve the user's company scope; returns null if company_id is not theirs. */
export const resolveCompanyScope = async (
  userId: number,
  companyId?: string | number | null
): Promise<{ companyIds: number[]; companyId: number | null } | null> => {
  const userCompanies = await companyModel.findAll({
    attributes: ["company_id"],
    where: { user_id: userId },
  });
  const owned = userCompanies.map((c) => Number(c.dataValues.company_id));
  if (companyId != null && companyId !== "") {
    const cid = Number(companyId);
    if (!owned.includes(cid)) return null;
    return { companyIds: [cid], companyId: cid };
  }
  return { companyIds: owned, companyId: null };
};

/** The shared per-transaction SELECT (same joins as dashboard recent-transactions). */
export const TX_QUERY = (companyScoped: boolean) => `
  SELECT
    ut.id, ut.transaction_id,
    ${PROCESSED_USD_EXPR} AS usd_display,
    ut.base_amount, ut.base_currency, ut.crypto_amount, ut.crypto_currency,
    ut.status, ut."createdAt", ut.transaction_reference,
    c.customer_id AS c_customer_id, c.customer_name AS c_name, c.email AS c_email, c.mobile AS c_mobile,
    pl.link_id AS source_link_id, pl.link_type AS source_link_type, pl.title AS source_link_title,
    pl.parent_link_id AS source_parent_link_id,
    parent_pl.title AS source_parent_title, parent_pl.is_tip_jar AS source_parent_is_tip_jar,
    pl.email AS pl_email, pl.customer_name AS pl_customer_name, pl.donor_name AS pl_donor_name,
    po.order_id AS source_order_id, po.public_ref AS source_order_ref,
    po.buyer_email AS po_email, po.buyer_name AS po_name, po.buyer_phone AS po_phone
  FROM tbl_user_transaction ut
  LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
  LEFT JOIN (
    SELECT DISTINCT ON (transaction_reference)
      transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar,
      email, customer_name, donor_name
    FROM tbl_payment_link
    WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
    ORDER BY transaction_reference, link_id DESC
  ) pl ON pl.transaction_reference = ut.transaction_reference
    AND ut.transaction_reference IS NOT NULL AND ut.transaction_reference <> ''
  LEFT JOIN tbl_payment_link parent_pl ON parent_pl.link_id = pl.parent_link_id
  LEFT JOIN tbl_product_order po ON po.payment_link_id = pl.link_id
  WHERE ut.user_id = :userId
    ${companyScoped ? "AND (ut.company_id = :companyId OR c.company_id = :companyId)" : ""}
  ORDER BY ut."createdAt" DESC
  LIMIT ${TX_SCAN_LIMIT}`;

/** Drop the cached directory for an owner after a customer/wallet mutation. */
export const invalidateDirectoryCache = async (ownerUserId: number, companyId: number | null): Promise<void> => {
  const keys = [`custDir:${ownerUserId}:all`];
  if (companyId != null) keys.push(`custDir:${ownerUserId}:${companyId}`);
  await Promise.all(keys.map((k) => deleteRedisItem(k).catch(() => undefined)));
};

/** Build (or read from cache) the full unified directory for a user/company scope. */
export const buildDirectory = async (
  userId: number,
  scope: { companyIds: number[]; companyId: number | null }
): Promise<DirectoryData> => {
  const cacheKey = `custDir:${userId}:${scope.companyId ?? "all"}`;
  const cached = await getRedisItem(cacheKey);
  if (cached && (cached as DirectoryData).persons) return cached as DirectoryData;

  const companyScoped = scope.companyId != null;
  const replacements: Record<string, unknown> = { userId, companyId: scope.companyId };

  const txRows = (await sequelize.query(TX_QUERY(companyScoped), {
    replacements,
    type: QueryTypes.SELECT,
  })) as unknown as TxRow[];

  // Registered customers with a REAL email (skip internal placeholders) + wallet.
  const customerRows = (scope.companyIds.length
    ? ((await sequelize.query(
        `SELECT c.customer_id, c.customer_name, c.email, c.mobile, c."createdAt",
                COALESCE(cw.amount, 0) AS wallet_balance, cw.wallet_type AS wallet_currency
         FROM tbl_customer c
         LEFT JOIN tbl_customer_wallet cw ON cw.customer_id = c.customer_id
         WHERE c.company_id IN (:companyIds)`,
        { replacements: { companyIds: scope.companyIds }, type: QueryTypes.SELECT }
      )) as Array<Record<string, unknown>>)
    : []) as Array<Record<string, unknown>>;

  // Links addressed to a specific email (payment requests / carts) — prospects.
  const linkRows = (await sequelize.query(
    `SELECT pl.link_id, pl.link_type, pl.status, pl.email, pl.customer_name,
            pl.is_tip_jar, pl."createdAt"
     FROM tbl_payment_link pl
     WHERE pl.user_id = :userId AND pl.email IS NOT NULL AND pl.email <> ''
       ${companyScoped ? "AND pl.company_id = :companyId" : ""}
     ORDER BY pl."createdAt" DESC
     LIMIT ${LINK_SCAN_LIMIT}`,
    { replacements, type: QueryTypes.SELECT }
  )) as Array<Record<string, unknown>>;

  type Accum = DirectoryEntry & { first_paid: string | null; _channels: Set<CanonicalTxSourceType> };
  const persons = new Map<string, Accum>();
  const anon = new Map<string, Accum>();

  const blank = (key: string, kind: "person" | "anonymous"): Accum => ({
    key,
    kind,
    name: null,
    email: kind === "person" ? key : null,
    mobile: null,
    channels: [],
    payments_count: 0,
    pending_count: 0,
    links_count: 0,
    ltv_usd: 0,
    first_seen: null,
    last_payment: null,
    segment: kind === "person" ? "prospect" : "anonymous",
    has_wallet: false,
    wallet_balance: 0,
    wallet_currency: null,
    customer_ids: [],
    first_paid: null,
    _channels: new Set<CanonicalTxSourceType>(),
  });

  // 1) Fold every transaction into a person (by email) or an anonymous channel bucket.
  for (const row of txRows) {
    const email = identityEmailOf(row);
    const channel = channelOf(row);
    const entry = email
      ? persons.get(email) || persons.set(email, blank(email, "person")).get(email)!
      : anon.get(`anon:${channel}`) ||
        anon.set(`anon:${channel}`, blank(`anon:${channel}`, "anonymous")).get(`anon:${channel}`)!;

    entry._channels.add(channel);
    entry.first_seen = minDate(entry.first_seen, row.createdAt);
    if (email) {
      entry.name = entry.name || identityNameOf(row);
      entry.mobile = entry.mobile || cleanName(row.po_phone) || (cleanEmail(row.c_email) ? cleanName(row.c_mobile) : null);
      if (row.c_customer_id && !entry.customer_ids.includes(row.c_customer_id)) {
        entry.customer_ids.push(row.c_customer_id);
      }
    }

    const status = String(row.status || "").toLowerCase();
    if (PAID_SET.has(status)) {
      entry.payments_count += 1;
      entry.ltv_usd = add(entry.ltv_usd, row.usd_display).toNumber();
      entry.last_payment = maxDate(entry.last_payment, row.createdAt);
      entry.first_paid = minDate(entry.first_paid, row.createdAt);
    } else if (deriveTxDisplayStatus(status, row.createdAt) === "pending") {
      entry.pending_count += 1;
    }
  }

  // 2) Merge registered customers (real email) — enrich or add as prospects.
  for (const c of customerRows) {
    const email = cleanEmail(c.email as string);
    if (!email) continue;
    const entry = persons.get(email) || persons.set(email, blank(email, "person")).get(email)!;
    entry.name = entry.name || cleanName(c.customer_name as string);
    entry.mobile = entry.mobile || cleanName(c.mobile as string);
    entry.first_seen = minDate(entry.first_seen, c.createdAt as string);
    const cid = Number(c.customer_id);
    if (cid && !entry.customer_ids.includes(cid)) entry.customer_ids.push(cid);
    const bal = Number(c.wallet_balance || 0);
    if (c.wallet_currency != null || bal > 0) {
      entry.has_wallet = true;
      entry.wallet_balance += bal;
      entry.wallet_currency = (c.wallet_currency as string) || entry.wallet_currency || "USD";
    }
  }

  // 3) Merge link recipients (payment requests sent) — prospects if never paid.
  for (const l of linkRows) {
    const email = cleanEmail(l.email as string);
    if (!email) continue;
    const entry = persons.get(email) || persons.set(email, blank(email, "person")).get(email)!;
    entry.links_count += 1;
    entry.name = entry.name || cleanName(l.customer_name as string);
    entry.first_seen = minDate(entry.first_seen, l.createdAt as string);
    const lt = String(l.link_type || "");
    const ch: CanonicalTxSourceType =
      lt === "cart" ? "product" : lt === "contribution" ? (l.is_tip_jar ? "tip" : "contribution") : "payment_link";
    entry._channels.add(ch);
  }

  // Finalize
  const finalize = (e: Accum): DirectoryEntry => {
    const { _channels, first_paid, ...rest } = e;
    return {
      ...rest,
      ltv_usd: toNumber(e.ltv_usd, 2),
      channels: Array.from(_channels),
      segment: e.kind === "anonymous" ? "anonymous" : segmentOf({ ...e, first_paid }),
    };
  };

  const personList = Array.from(persons.values()).map(finalize);
  // Anonymous buckets with nothing actionable (no settled payments, no fresh
  // pending) are pure noise — e.g. a "Direct" bucket of long-expired attempts.
  const anonList = Array.from(anon.values())
    .map(finalize)
    .filter((a) => a.payments_count > 0 || a.pending_count > 0);

  const paidPersons = personList.filter((p) => p.payments_count > 0);
  const repeatPersons = paidPersons.filter((p) => p.payments_count >= 2);
  const now = Date.now();
  const newThisMonth = personList.filter(
    (p) => p.first_seen && now - new Date(p.first_seen).getTime() <= NEW_WINDOW_DAYS * DAY_MS
  ).length;
  const identifiedRevenue = sum(personList.map((p) => p.ltv_usd)).toNumber();
  const anonRevenue = sum(anonList.map((p) => p.ltv_usd)).toNumber();

  const data: DirectoryData = {
    persons: personList,
    anonymous: anonList,
    aggregates: {
      total_customers: personList.length,
      revenue_usd: toNumber((identifiedRevenue + anonRevenue), 2),
      identified_revenue_usd: toNumber(identifiedRevenue, 2),
      repeat_rate: paidPersons.length ? toNumber((repeatPersons.length / paidPersons.length), 2) : 0,
      new_this_month: newThisMonth,
      anonymous_payments: anonList.reduce((s, p) => s + p.payments_count, 0),
      anonymous_revenue_usd: toNumber(anonRevenue, 2),
    },
  };

  await setRedisItemWithTTL(cacheKey, data, CACHE_TTL_SECONDS);
  return data;
};
