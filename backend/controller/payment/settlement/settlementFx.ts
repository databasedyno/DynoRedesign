/**
 * Settlement FX — how a RECEIVED crypto amount is valued during settlement
 * (FIAT/CRYPTO audit 2026-06, user decision: "use the last known rate if it is
 * under ~30 min old, otherwise put settlement on hold and retry").
 *
 * Resolution order for 1 unit of the paid asset in `to` (USD or base currency):
 *   1. live rate, or a last-known rate ≤30 min old   (currencyConvert strict)
 *   2. the checkout's own quote snapshot ≤30 min old  (rate the payer was quoted)
 *   3. throw "DEFERRED: …" — the existing deferral path (webhookProcessor marks
 *      the session gas_pending, BullMQ + the 10-min reconciliation sweep retry
 *      it for up to 7 days). NOTHING is written or routed before this throws.
 *
 * Before this, an all-provider outage made receivedUSD = 0 → "UNDER THRESHOLD —
 * all to admin": the merchant's whole payment would have gone to the platform.
 */
import currencyConvert, {
  isRateUnavailableError,
  MONEY_RATE_MAX_AGE_MS,
  amountDecimalsFor,
} from "../../../helper/currencyConvert";
import { PAYMENT_TIMING } from "../paymentConfig";
import { cronLogger } from "../../../utils/loggers";
import { mul, toNumber } from "../../../utils/money";

export type SettlementFxSource = "live" | "last_known" | "quote";

export interface SettlementFx {
  /** value of ONE unit of the paid asset in the target currency */
  rate: number;
  source: SettlementFxSource;
  /** epoch ms the rate was observed */
  asOf: number;
}

type QuoteSession = Record<string, unknown> | null | undefined;

/** Age (ms) of the checkout quote, or null when the session doesn't say. */
export const quoteAgeMs = (session: QuoteSession, now: number = Date.now()): number | null => {
  const quotedAt = Number(session?.quoted_at);
  if (quotedAt > 0) return now - quotedAt;
  const expires = Date.parse(String(session?.crypto_invoice_expires_at || ""));
  if (Number.isFinite(expires)) return now - (expires - PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES * 60_000);
  return null;
};

/**
 * Quote-implied value of 1 unit of the paid asset in `target` (USD or the
 * session's base currency). Uses the explicit snapshot written at quote time;
 * legacy sessions derive it from the quoted totals — but only if the session was
 * never partially paid (a partial payment overwrites `amount` with the remainder).
 */
export const quoteImpliedRate = (session: QuoteSession, target: string): number | null => {
  const T = String(target || "").toUpperCase();
  const base = String(session?.base_currency || "").toUpperCase();
  if (T === "USD") {
    const q = Number(session?.quote_usd_per_unit);
    if (q > 0) return q;
  }
  if (base && T === base) {
    const r = Number(session?.quote_rate); // 1 base unit = r crypto
    if (r > 0) return 1 / r;
  }
  if (Number(session?.previousAmount) > 0) return null;
  const quotedCrypto = Number(session?.fee_payer === "customer" ? session?.merchant_amount : session?.amount);
  if (!(quotedCrypto > 0)) return null;
  if (T === "USD") {
    const usd = Number(session?.total_amount_usd);
    return usd > 0 ? usd / quotedCrypto : null;
  }
  if (base && T === base) {
    const orig = Number(session?.total_amount_original);
    return orig > 0 ? orig / quotedCrypto : null;
  }
  return null;
};

/** Rate for settlement — never 0, never a made-up 1; throws "DEFERRED: …" instead. */
export const settlementRate = async (
  from: string,
  to: string,
  session: QuoteSession,
  label: string,
): Promise<SettlementFx> => {
  if (!from || !to) {
    throw new Error(`DEFERRED: settlement FX (${label}) is missing a currency (${from}→${to}) — will retry.`);
  }
  try {
    const [r] = await currencyConvert({ sourceCurrency: from, currency: [to], amount: 1, fixedDecimal: false, strict: true });
    const rate = Number(r?.transferRate);
    if (rate > 0) {
      return { rate, source: r?.stale ? "last_known" : "live", asOf: Number(r?.rateAsOf) || Date.now() };
    }
  } catch (e) {
    if (!isRateUnavailableError(e)) throw e;
  }

  const age = quoteAgeMs(session);
  const q = quoteImpliedRate(session, to);
  if (q && q > 0 && age !== null && age >= 0 && age <= MONEY_RATE_MAX_AGE_MS) {
    cronLogger.warn(
      `[settlementFx] ${label}: live rates unavailable — using the checkout quote snapshot ${from}→${to}=${q} (${Math.round(age / 60000)} min old)`,
    );
    return { rate: q, source: "quote", asOf: Date.now() - age };
  }

  cronLogger.error(
    `[settlementFx] ${label}: NO usable ${from}→${to} rate (no live, no last-known ≤30 min, quote ${age === null ? "age unknown" : `${Math.round(age / 60000)} min old`}) — DEFERRING settlement`,
  );
  throw new Error(
    `DEFERRED: Exchange rate ${from}→${to} unavailable for settlement (${label}) — no live rate and nothing newer than 30 min. Will retry automatically.`,
  );
};

/** Value `amount` of `from` in `to` with settlementRate (dp defaults to the target's precision). */
export const settlementConvert = async (
  from: string,
  to: string,
  amount: number,
  session: QuoteSession,
  label: string,
  dp?: number,
): Promise<SettlementFx & { amount: number }> => {
  const fx = await settlementRate(from, to, session, label);
  const raw = mul(Number(amount) || 0, fx.rate).toNumber();
  const places = dp ?? amountDecimalsFor(to, raw, false);
  return { ...fx, amount: toNumber(raw, places) };
};
