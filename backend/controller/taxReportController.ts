import express from "express";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { raw as envRaw } from "../utils/config";
import { Op } from "sequelize";
import { productOrderModel, userModel } from "../models";
import { successResponseHelper } from "../helper";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { apiLogger } from "../utils/loggers";
import { COUNTRY_NAMES, EU_COUNTRIES } from "../utils/taxData";
import { convertToFiat, getUserDisplayCurrency, getCurrencySymbol } from "../utils/currencyUtils";
import { computeNexusStatus, notifyNexusEscalations } from "../services/nexusService";

/**
 * Buyer-side / OSS destination tax report (backlog #6).
 *
 * The pre-existing `/api/invoices/tax-report` reports VAT on DynoPay's own
 * SERVICE-FEE invoices, grouped by the merchant's country — the wrong dataset
 * for a VAT/OSS return. This report reads the TAX ACTUALLY COLLECTED FROM
 * BUYERS off `tbl_product_order` (cents in the order's own currency, with the
 * destination country the rate was applied for) and groups it BY DESTINATION.
 *
 * Amounts are reported in each order's own currency (no cross-FX) grouped by
 * (destination country, currency) — which is what a VAT return actually needs.
 */

type GroupBy = "month" | "quarter" | "year";

interface Bucket {
  country: string;
  currency: string;
  tax_label: string | null;
  tax_rate: number;
  taxable_base: number;
  tax_collected: number;
  reverse_charge_base: number;
  orders: number;
  reverse_charge_orders: number;
}

const money = (cents: number) => Math.round(cents) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

const periodOf = (d: Date, groupBy: GroupBy): { key: string; label: string } => {
  const y = d.getUTCFullYear();
  if (groupBy === "year") return { key: `${y}`, label: `${y}` };
  if (groupBy === "quarter") {
    const q = Math.ceil((d.getUTCMonth() + 1) / 3);
    return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
  }
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return { key: `${y}-${m}`, label: `${names[d.getUTCMonth()]} ${y}` };
};

interface AggResult {
  by_country: Bucket[];
  by_period: Array<{ period: string; period_label: string; currency: string; taxable_base: number; tax_collected: number; orders: number }>;
  by_currency: Array<{ currency: string; taxable_base: number; tax_collected: number; reverse_charge_base: number; orders: number }>;
  oss_lines: Array<{ country: string; country_name: string; currency: string; tax_rate: number; taxable_base: number; tax_collected: number }>;
  total_orders: number;
}

const aggregate = async (
  userId: number,
  start?: string,
  end?: string,
  groupBy: GroupBy = "quarter"
): Promise<AggResult> => {
  const where: Record<string, unknown> = {
    merchant_user_id: userId,
    payment_status: "paid",
  };
  if (start || end) {
    const range: Record<symbol, Date> = {};
    if (start) range[Op.gte] = new Date(start);
    if (end) range[Op.lte] = new Date(end);
    where.paid_at = range;
  }

  const rows = (await productOrderModel.findAll({
    where,
    order: [["paid_at", "DESC"]],
  })) as Array<{ dataValues: Record<string, unknown> }>;

  const countryMap = new Map<string, Bucket>();
  const periodMap = new Map<string, { period: string; period_label: string; currency: string; taxable_base: number; tax_collected: number; orders: number }>();
  const currencyMap = new Map<string, { currency: string; taxable_base: number; tax_collected: number; reverse_charge_base: number; orders: number }>();

  for (const r of rows) {
    const o = r.dataValues;
    const country = String(o.tax_country_code || "Unknown").toUpperCase();
    const currency = String(o.currency || "USD").toUpperCase();
    const base = money(Number(o.subtotal_cents || 0));
    const tax = money(Number(o.tax_cents || 0));
    const rc = !!o.reverse_charge;
    const rate = o.tax_rate != null ? Number(o.tax_rate) : 0;
    const label = (o.tax_label as string) || null;

    const cKey = `${country}|${currency}`;
    const cb = countryMap.get(cKey) || {
      country, currency, tax_label: label, tax_rate: rate,
      taxable_base: 0, tax_collected: 0, reverse_charge_base: 0, orders: 0, reverse_charge_orders: 0,
    };
    if (rc) {
      cb.reverse_charge_base += base;
      cb.reverse_charge_orders += 1;
    } else {
      cb.taxable_base += base;
      cb.tax_collected += tax;
      if (rate > 0) cb.tax_rate = rate;
      if (label) cb.tax_label = label;
    }
    cb.orders += 1;
    countryMap.set(cKey, cb);

    const paid = o.paid_at ? new Date(o.paid_at as string) : new Date(o.createdAt as string);
    const p = periodOf(paid, groupBy);
    const pKey = `${p.key}|${currency}`;
    const pb = periodMap.get(pKey) || { period: p.key, period_label: p.label, currency, taxable_base: 0, tax_collected: 0, orders: 0 };
    if (!rc) { pb.taxable_base += base; pb.tax_collected += tax; }
    pb.orders += 1;
    periodMap.set(pKey, pb);

    const cur = currencyMap.get(currency) || { currency, taxable_base: 0, tax_collected: 0, reverse_charge_base: 0, orders: 0 };
    if (rc) cur.reverse_charge_base += base; else { cur.taxable_base += base; cur.tax_collected += tax; }
    cur.orders += 1;
    currencyMap.set(currency, cur);
  }

  const clean = (b: Bucket): Bucket => ({
    ...b,
    taxable_base: round2(b.taxable_base),
    tax_collected: round2(b.tax_collected),
    reverse_charge_base: round2(b.reverse_charge_base),
  });

  const by_country = Array.from(countryMap.values()).map(clean).sort((a, b) => b.tax_collected - a.tax_collected);
  const oss_lines = by_country
    .filter((b) => EU_COUNTRIES.includes(b.country) && b.tax_collected > 0)
    .map((b) => ({
      country: b.country,
      country_name: COUNTRY_NAMES[b.country] || b.country,
      currency: b.currency,
      tax_rate: b.tax_rate,
      taxable_base: b.taxable_base,
      tax_collected: b.tax_collected,
    }));

  return {
    by_country,
    by_period: Array.from(periodMap.values())
      .map((p) => ({ ...p, taxable_base: round2(p.taxable_base), tax_collected: round2(p.tax_collected) }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    by_currency: Array.from(currencyMap.values()).map((c) => ({
      ...c,
      taxable_base: round2(c.taxable_base),
      tax_collected: round2(c.tax_collected),
      reverse_charge_base: round2(c.reverse_charge_base),
    })),
    oss_lines,
    total_orders: rows.length,
  };
};

/**
 * Convert the per-currency collected-tax totals into ONE figure in the
 * merchant's display currency (Settings → Payments), reusing the same cached
 * FX path as the invoice tax report. Amounts stay per-currency in the tables;
 * this adds a single converted grand-total + a per-currency rate map so the
 * merchant sees "how much VAT/GST did I collect overall". FX failure → rate 1
 * (amount passes through unconverted) rather than throwing.
 */
interface ConversionResult {
  display_currency: string;
  currency_symbol: string;
  rates: Record<string, number>;
  totals: { tax_collected: number; taxable_base: number; reverse_charge_base: number };
}

const resolveConversion = async (
  userId: number,
  companyId: number | null | undefined,
  byCurrency: AggResult["by_currency"]
): Promise<ConversionResult> => {
  const display = await getUserDisplayCurrency(userId, companyId ?? null);
  const rates: Record<string, number> = {};
  const totals = { tax_collected: 0, taxable_base: 0, reverse_charge_base: 0 };
  for (const c of byCurrency) {
    let rate = 1;
    if (c.currency !== display) {
      try {
        const r = await convertToFiat(c.currency, display, 1);
        rate = Number(r.amount) || Number(r.rate) || 1;
      } catch {
        rate = 1;
      }
    }
    rates[c.currency] = rate;
    totals.tax_collected += c.tax_collected * rate;
    totals.taxable_base += c.taxable_base * rate;
    totals.reverse_charge_base += c.reverse_charge_base * rate;
  }
  return {
    display_currency: display,
    currency_symbol: getCurrencySymbol(display),
    rates,
    totals: {
      tax_collected: round2(totals.tax_collected),
      taxable_base: round2(totals.taxable_base),
      reverse_charge_base: round2(totals.reverse_charge_base),
    },
  };
};

/** GET /api/tax/collected-report?start_date&end_date&group_by */
const getCollectedTaxReport = async (req: express.Request, res: express.Response) => {
  try {
    const user = jwt.decode(res.locals.token) as { user_id: number };
    const { start_date, end_date, group_by = "quarter", company_id } = req.query;
    const agg = await aggregate(
      user.user_id,
      start_date as string,
      end_date as string,
      (group_by as GroupBy) || "quarter"
    );
    const conv = await resolveConversion(
      user.user_id,
      company_id ? Number(company_id) : null,
      agg.by_currency
    );
    return successResponseHelper(res, 200, "Collected tax report generated", {
      summary: {
        by_currency: agg.by_currency,
        total_orders: agg.total_orders,
        period: { start: start_date || "all time", end: end_date || "present" },
        group_by,
        display_currency: conv.display_currency,
        currency_symbol: conv.currency_symbol,
        converted_totals: conv.totals,
      },
      by_period: agg.by_period,
      by_country: agg.by_country.map((b) => ({
        ...b,
        country_name: COUNTRY_NAMES[b.country] || b.country,
        is_eu: EU_COUNTRIES.includes(b.country),
        tax_collected_display: round2(b.tax_collected * (conv.rates[b.currency] || 1)),
      })),
      oss_lines: agg.oss_lines.map((l) => ({
        ...l,
        tax_collected_display: round2(l.tax_collected * (conv.rates[l.currency] || 1)),
      })),
    });
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/** GET /api/tax/collected-report/csv */
const exportCollectedTaxCsv = async (req: express.Request, res: express.Response) => {
  try {
    const user = jwt.decode(res.locals.token) as { user_id: number };
    const { start_date, end_date, group_by = "quarter", company_id } = req.query;
    const agg = await aggregate(user.user_id, start_date as string, end_date as string, (group_by as GroupBy) || "quarter");
    const conv = await resolveConversion(
      user.user_id,
      company_id ? Number(company_id) : null,
      agg.by_currency
    );
    const disp = conv.display_currency;

    const header = [
      "Country Code", "Country", "Currency", "Tax Label", "Tax Rate %",
      "Taxable Base", "Tax Collected", `Tax Collected (${disp})`,
      "Orders", "Reverse-charge Base", "Reverse-charge Orders", "EU/OSS",
    ];
    const lines = [header.join(",")];
    for (const b of agg.by_country) {
      const name = (COUNTRY_NAMES[b.country] || b.country).replace(/,/g, " ");
      const taxDisplay = round2(b.tax_collected * (conv.rates[b.currency] || 1));
      lines.push([
        b.country, name, b.currency, b.tax_label || "",
        b.tax_rate, b.taxable_base, b.tax_collected, taxDisplay, b.orders,
        b.reverse_charge_base, b.reverse_charge_orders,
        EU_COUNTRIES.includes(b.country) ? "yes" : "no",
      ].join(","));
    }
    // Grand total row in the merchant's display currency.
    lines.push("");
    lines.push([`TOTAL (${disp})`, "", "", "", "", conv.totals.taxable_base, "", conv.totals.tax_collected, "", conv.totals.reverse_charge_base, "", ""].join(","));

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="collected-tax-report-${new Date().toISOString().split("T")[0]}.csv"`
    );
    return res.status(200).send(lines.join("\n"));
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * POST /api/tax/suggest-treatment  (backlog #5 AI assist)
 * Body: { title, description }. Uses the merchant's configured OPENAI_API_KEY
 * (same client pattern as support chat) to suggest a VAT treatment + reduced
 * category. Degrades gracefully — a failure returns 200 with { error } so the
 * merchant just picks manually.
 */
let taxOpenaiClient: OpenAI | null = null;
const getTaxOpenAI = (): OpenAI | null => {
  if (!envRaw("OPENAI_API_KEY")) return null;
  if (!taxOpenaiClient) {
    taxOpenaiClient = new OpenAI({ apiKey: envRaw("OPENAI_API_KEY"), timeout: 30000, maxRetries: 1 });
  }
  return taxOpenaiClient;
};

const AI_TAX_CATEGORIES = [
  "ebooks", "books", "foodstuffs", "medical",
  "children", "passenger_transport", "accommodation", "general",
];

const suggestTaxTreatment = async (req: express.Request, res: express.Response) => {
  try {
    const { title, description } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return successResponseHelper(res, 200, "Nothing to classify", { error: "missing_title" });
    }
    const openai = getTaxOpenAI();
    if (!openai) {
      return successResponseHelper(res, 200, "AI unavailable", { error: "missing_key" });
    }
    const model = envRaw("TAX_AI_MODEL") || envRaw("SUPPORT_CHAT_MODEL") || "gpt-5.4-mini";
    const system =
      "You classify a merchant's product for EU/UK VAT. Return STRICT JSON only. " +
      'Schema: {"treatment": "standard"|"reduced"|"zero", "reduced_category": one of ' +
      JSON.stringify(AI_TAX_CATEGORIES) +
      ' or null, "confidence": 0..1, "reason": short string}. ' +
      "Most products are standard. Use reduced for goods that commonly get a reduced VAT band " +
      "(e-books/digital publications->ebooks, printed books/news->books, food/groceries->foodstuffs, " +
      "medicines/medical->medical, children's clothing/nappies->children, passenger transport->passenger_transport, " +
      "hotels/accommodation->accommodation, otherwise->general). Use zero only when clearly zero-rated. " +
      "reduced_category must be null unless treatment is reduced. If unsure, choose standard.";
    const userContent = `Product title: ${String(title).slice(0, 300)}\nDescription: ${String(description || "").slice(0, 2000) || "(none)"}\n\nReturn the JSON now.`;

    let parsed: Record<string, unknown> = {};
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 300,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      });
      const raw = completion.choices?.[0]?.message?.content?.trim() || "";
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      parsed = s !== -1 && e !== -1 ? JSON.parse(raw.slice(s, e + 1)) : {};
    } catch (err) {
      apiLogger.info(`[Tax] suggest-treatment LLM failed: ${(err as Error)?.message?.slice(0, 200)}`);
      return successResponseHelper(res, 200, "AI failed", { error: "llm_failed" });
    }

    let treatment = String(parsed.treatment || "");
    if (!["standard", "reduced", "zero"].includes(treatment)) treatment = "standard";
    let cat = parsed.reduced_category ? String(parsed.reduced_category) : null;
    if (treatment !== "reduced" || !cat || !AI_TAX_CATEGORIES.includes(cat)) cat = null;
    const confNum = Number(parsed.confidence);
    return successResponseHelper(res, 200, "Tax treatment suggestion", {
      treatment,
      reduced_category: cat,
      confidence: Number.isFinite(confNum) ? Math.round(confNum * 100) / 100 : null,
      reason: String(parsed.reason || "").slice(0, 280),
    });
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * GET /api/tax/nexus-status (backlog #4) — registration-threshold monitor.
 * Computes the merchant's current-year exposure vs EU OSS / UK / GST thresholds
 * and fires a one-off email on any new escalation (deduped, suppressed on pod).
 */
const getNexusStatus = async (req: express.Request, res: express.Response) => {
  try {
    const user = jwt.decode(res.locals.token) as { user_id: number };
    const u = (await userModel.findByPk(user.user_id)) as { dataValues?: { merchant_country_code?: string | null } } | null;
    const merchantCountry = u?.dataValues?.merchant_country_code || null;
    const { year, rows } = await computeNexusStatus(user.user_id, merchantCountry);
    notifyNexusEscalations(user.user_id, rows).catch(() => {});
    return successResponseHelper(res, 200, "Nexus status generated", {
      year,
      merchant_country: merchantCountry,
      thresholds: rows,
    });
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default { getCollectedTaxReport, exportCollectedTaxCsv, suggestTaxTreatment, getNexusStatus };
