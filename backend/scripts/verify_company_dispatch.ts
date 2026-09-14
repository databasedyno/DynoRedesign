/**
 * REVERSIBLE read-only harness for the company-email dedup/RBAC rewiring.
 *
 * Proves, against the REAL resolveCompanyRecipients + dispatchCompanyEmail path
 * for company_id=1 (Hostbay, LIVE prod DB):
 *   1. Each operational category resolves to a valid, DEDUPED recipient list
 *      (company primary + permitted team members, collapsed case-insensitively).
 *   2. dispatchCompanyEmail invokes the send callback exactly ONCE per unique
 *      recipient — no duplicate blasts. NO real email is sent: the callback is a
 *      stub that only records (email, category); outbound email is also OFF.
 *   3. When a category is EXPLICITLY disabled (notification_prefs.categories.X=
 *      false) the dispatcher SUPPRESSES it; any other empty result falls back to
 *      the owner. This branch is exercised by a captured + RESTORED prefs toggle.
 *
 * Strictly reversible: the only write is a temporary notification_prefs update on
 * company_id=1 that is restored to its exact original value in a finally block.
 */
import "dotenv/config";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { companyModel } from "../models";
import {
  resolveCompanyRecipients,
  NotificationCategory,
} from "../utils/notificationRecipients";
import { dispatchCompanyEmail } from "../services/email/companyDispatch";

const COMPANY_ID = 1;
const CATEGORIES: NotificationCategory[] = ["payments", "payouts", "orders", "config", "digests"];

async function dispatchAndCollect(
  companyId: number,
  category: NotificationCategory,
): Promise<string[]> {
  const sends: string[] = [];
  await dispatchCompanyEmail(
    companyId,
    category,
    { email: "fallback-should-not-be-used@example.com", name: "Fallback" },
    async (email) => { sends.push(email.trim().toLowerCase()); },
  );
  return sends;
}

async function main() {
  const results: Record<string, boolean> = {};

  // Snapshot original prefs for restore.
  const orig = (await sequelize.query(
    `SELECT notification_email, notification_prefs FROM tbl_company WHERE company_id = :cid LIMIT 1`,
    { replacements: { cid: COMPANY_ID }, type: QueryTypes.SELECT },
  )) as Array<{ notification_email: string | null; notification_prefs: unknown }>;
  const originalPrefs = orig[0]?.notification_prefs ?? null;
  console.log(`[harness] company_id=${COMPANY_ID} notification_email=${orig[0]?.notification_email ?? "(null)"}`);
  console.log(`[harness] original notification_prefs=${JSON.stringify(originalPrefs)}`);

  try {
    // --- 1 + 2: per-category resolution + single-send-per-recipient + dedupe ---
    for (const cat of CATEGORIES) {
      const recipients = await resolveCompanyRecipients(COMPANY_ID, cat);
      const resolvedEmails = recipients.map((r) => `${r.email} [${r.source}]`);
      const sends = await dispatchAndCollect(COMPANY_ID, cat);

      const uniqueSends = new Set(sends);
      const noDupes = uniqueSends.size === sends.length;
      const matchesResolver = sends.length === recipients.length;
      const noFallbackLeak = !sends.includes("fallback-should-not-be-used@example.com");

      const ok = noDupes && matchesResolver && (recipients.length === 0 ? true : noFallbackLeak);
      results[`resolve_${cat}`] = ok;
      console.log(
        `[${cat}] resolver=${JSON.stringify(resolvedEmails)} | dispatched=${JSON.stringify(sends)} | ` +
        `dedupe=${noDupes} matches=${matchesResolver} -> ${ok ? "PASS" : "FAIL"}`,
      );
    }

    // --- 3a: explicit disable => suppressed (0 sends, no fallback) ---
    const disabledPrefs = { ...(originalPrefs && typeof originalPrefs === "object" ? originalPrefs as object : {}), categories: { payouts: false } };
    await companyModel.update(
      { notification_prefs: disabledPrefs } as any,
      { where: { company_id: COMPANY_ID } },
    );
    const suppressedSends = await dispatchAndCollect(COMPANY_ID, "payouts");
    const suppressed = suppressedSends.length === 0;
    results["suppress_disabled_category"] = suppressed;
    console.log(`[suppress] payouts disabled -> dispatched=${JSON.stringify(suppressedSends)} -> ${suppressed ? "PASS (suppressed)" : "FAIL"}`);

    // --- 3b: a DIFFERENT category still delivers while payouts is disabled ---
    const stillSends = await dispatchAndCollect(COMPANY_ID, "payments");
    const stillDelivers = stillSends.length > 0;
    results["other_category_unaffected"] = stillDelivers;
    console.log(`[suppress] payments still delivers -> ${JSON.stringify(stillSends)} -> ${stillDelivers ? "PASS" : "FAIL"}`);
  } finally {
    // RESTORE exact original prefs.
    await companyModel.update(
      { notification_prefs: originalPrefs } as any,
      { where: { company_id: COMPANY_ID } },
    );
    const [restored] = (await sequelize.query(
      `SELECT notification_prefs FROM tbl_company WHERE company_id = :cid LIMIT 1`,
      { replacements: { cid: COMPANY_ID }, type: QueryTypes.SELECT },
    )) as Array<{ notification_prefs: unknown }>;
    console.log(`[harness] RESTORED notification_prefs=${JSON.stringify(restored?.notification_prefs)}`);
  }

  const pass = Object.values(results).every(Boolean);
  console.log("\n=== RESULTS ===", JSON.stringify(results), pass ? "ALL PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error("[harness] error:", e); process.exit(1); });
