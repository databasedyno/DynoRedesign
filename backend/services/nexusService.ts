/**
 * Nexus / registration-threshold monitoring (backlog #4).
 * Reads the merchant's PAID product orders in the current calendar year, sums
 * the taxable base per threshold scope (converting each order's currency into
 * the threshold currency), and reports ok / approaching / crossed. Also emits a
 * one-off email when a threshold newly reaches approaching/crossed (deduped in
 * tbl_nexus_alert; suppressed on this pod via DISABLE_OUTBOUND_EMAIL).
 */
import { Op } from "sequelize";
import { productOrderModel, nexusAlertModel, userModel } from "../models";
import { convertToFiat } from "../utils/currencyUtils";
import { EU_COUNTRIES, COUNTRY_NAMES } from "../utils/taxData";
import { NEXUS_THRESHOLDS, NEXUS_APPROACHING_RATIO, NexusThreshold } from "../utils/nexusThresholds";
import mailTransporter from "../utils/mailTransporter";
import { apiLogger } from "../utils/loggers";

export interface NexusStatusRow {
  key: string;
  label: string;
  country: string | null;
  currency: string;
  threshold: number;
  current: number;
  pct: number;
  status: "ok" | "approaching" | "crossed";
  note: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function computeNexusStatus(
  merchantUserId: number,
  merchantCountry: string | null | undefined
): Promise<{ year: number; rows: NexusStatusRow[] }> {
  const year = new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const mc = String(merchantCountry || "").toUpperCase();

  const orders = (await productOrderModel.findAll({
    where: { merchant_user_id: merchantUserId, payment_status: "paid", paid_at: { [Op.gte]: start } },
  })) as Array<{ dataValues: Record<string, unknown> }>;

  // Convert an order's subtotal (its own currency) into a target currency,
  // caching per (fromCur→target) rate to limit FX calls.
  const rateCache = new Map<string, number>();
  const toTarget = async (amount: number, from: string, target: string): Promise<number> => {
    const f = String(from || "USD").toUpperCase();
    if (f === target) return amount;
    const k = `${f}:${target}`;
    let rate = rateCache.get(k);
    if (rate == null) {
      try {
        const r = await convertToFiat(f, target, 1);
        rate = Number(r.amount) || Number(r.rate) || 1;
      } catch {
        rate = 1;
      }
      rateCache.set(k, rate);
    }
    return amount * rate;
  };

  const rows: NexusStatusRow[] = [];
  for (const th of NEXUS_THRESHOLDS) {
    let current = 0;
    for (const o of orders) {
      const d = o.dataValues;
      const dest = String(d.tax_country_code || "").toUpperCase();
      const base = Number(d.subtotal_cents || 0) / 100;
      const cur = String(d.currency || "USD").toUpperCase();
      if (base <= 0) continue;
      if (th.scope === "eu_oss") {
        if (d.reverse_charge) continue; // B2B reverse-charge is out of the B2C threshold
        if (EU_COUNTRIES.includes(dest) && dest !== mc) current += await toTarget(base, cur, th.currency);
      } else if (th.scope === "country" && th.country) {
        if (dest === th.country) current += await toTarget(base, cur, th.currency);
      }
    }
    current = round2(current);
    const pct = th.amount > 0 ? round2((current / th.amount) * 100) : 0;
    const status: NexusStatusRow["status"] =
      current >= th.amount ? "crossed" : pct >= NEXUS_APPROACHING_RATIO * 100 ? "approaching" : "ok";
    rows.push({
      key: th.key,
      label: th.label,
      country: th.country || null,
      currency: th.currency,
      threshold: th.amount,
      current,
      pct,
      status,
      note: th.note,
    });
  }
  return { year, rows };
}

/** Fire-and-forget: email the merchant once per (threshold, level) escalation. */
export async function notifyNexusEscalations(
  merchantUserId: number,
  rows: NexusStatusRow[]
): Promise<void> {
  try {
    const escalated = rows.filter((r) => r.status !== "ok");
    if (escalated.length === 0) return;
    for (const r of escalated) {
      const existing = (await nexusAlertModel.findOne({
        where: { merchant_user_id: merchantUserId, threshold_key: r.key },
      })) as { dataValues: { level?: string } } | null;
      const prev = existing?.dataValues?.level;
      // Only email on a NEW escalation: nothing before, or approaching→crossed.
      if (prev === r.status || (prev === "crossed" && r.status === "approaching")) continue;
      const user = (await userModel.findByPk(merchantUserId)) as { dataValues: { email?: string; first_name?: string; name?: string } } | null;
      const to = user?.dataValues?.email;
      if (to) {
        const th = NEXUS_THRESHOLDS.find((t) => t.key === r.key) as NexusThreshold;
        const verb = r.status === "crossed" ? "crossed" : "is approaching";
        const subject = `Tax registration alert: you ${verb} the ${r.label} threshold`;
        const body = `
          <p>Hi ${user?.dataValues?.first_name || user?.dataValues?.name || "there"},</p>
          <p>Your sales this year ${verb} the <strong>${r.label}</strong> registration threshold.</p>
          <p><strong>${r.currency} ${r.current.toLocaleString()}</strong> of <strong>${r.currency} ${r.threshold.toLocaleString()}</strong> (${r.pct}%).</p>
          <p>${th?.note || ""}</p>
          <p>You may need to register and start charging tax in this jurisdiction. This is an automated heads-up, not tax advice — please confirm with your tax adviser.</p>
          <p>— DynoPay</p>`;
        await mailTransporter({ to, name: user?.dataValues?.first_name || to, subject, body }).catch(() => {});
      }
      await nexusAlertModel
        .upsert({ merchant_user_id: merchantUserId, threshold_key: r.key, level: r.status, notified_at: new Date() })
        .catch(() => {});
    }
  } catch (e) {
    apiLogger.info(`[Nexus] notify failed for user ${merchantUserId}: ${(e as Error)?.message}`);
  }
}

export { COUNTRY_NAMES };
