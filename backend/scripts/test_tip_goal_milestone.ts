/**
 * End-to-end check of the tip-goal milestone service against the REAL tip jar of
 * The Dev Store (link 59, company 1). Nothing is sent (DISABLE_OUTBOUND_EMAIL) — the
 * emails are dumped to EMAIL_DUMP_DIR. Writes are confined to: a TEMPORARY goal on
 * company 1 (restored in `finally`) and rows in tbl_tip_goal_milestone (deleted).
 * Run: cd backend && node_modules/.bin/ts-node --transpile-only scripts/test_tip_goal_milestone.ts
 */
import "dotenv/config";
import * as fs from "fs";
import { QueryTypes } from "sequelize";

process.env.DISABLE_OUTBOUND_EMAIL = "true";
const OUT = "/tmp/email_tip_goal/e2e";
process.env.EMAIL_DUMP_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(`${OUT}/${f}`);

const JAR = 59;
const COMPANY = 1;
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) failures++; };

const main = async () => {
  const sequelize = (await import("../utils/dbInstance")).default;
  const { checkTipGoalMilestone } = await import("../services/tipGoalMilestoneService");
  const { tipGoalMilestoneModel } = await import("../models");
  const setGoal = (g: number | null) =>
    sequelize.query(`UPDATE tbl_company SET support_widget_monthly_goal = :g WHERE company_id = :c`, { replacements: { g, c: COMPANY } });
  const [before] = (await sequelize.query(`SELECT support_widget_monthly_goal AS g, support_widget_enabled AS e FROM tbl_company WHERE company_id = :c`, { replacements: { c: COMPANY }, type: QueryTypes.SELECT })) as Array<{ g: string | null; e: boolean }>;
  console.log("company 1 before:", before);
  const scope = `company:${COMPANY}`;
  const cleanup = () => tipGoalMilestoneModel.destroy({ where: { scope, month_key: ["2026-07", "2026-08"] } });

  try {
    await cleanup();
    // 0) guards
    check((await checkTipGoalMilestone(null)).skipped === "no_parent", "null parent → skipped no_parent");
    check((await checkTipGoalMilestone(1)).skipped === "not_tip_jar", "non-jar link → skipped not_tip_jar");
    if (before.g == null) check((await checkTipGoalMilestone(JAR)).skipped === "no_goal", "goal unset → skipped no_goal");

    // 1) goal $20, confirmed tips since July 1 2026 = $40 → 200%: records 50+100, emails ONLY the 100%
    await setGoal(20);
    const jul = new Date(Date.UTC(2026, 6, 15));
    const r1 = await checkTipGoalMilestone(JAR, { now: jul });
    console.log("r1", r1);
    // aggregates are "since month start" (no upper bound — `now` is always the real now in prod), so Jul+Aug = $40
    check(r1.raised === 40 && r1.goal === 20 && r1.pct === 200, "july: raised 40 (since Jul 1) / goal 20 → 200%");
    check(JSON.stringify(r1.recorded) === "[50,100]" && r1.emailed === 100, "july: recorded [50,100], emailed 100 only");
    const r1b = await checkTipGoalMilestone(JAR, { now: jul });
    check(r1b.recorded?.length === 0 && r1b.emailed === null, "july again: deduped (nothing recorded, nothing emailed)");

    // 2) August 2026 had $10 → exactly 50%: records + emails the 50%
    const aug = new Date(Date.UTC(2026, 7, 20));
    const r2 = await checkTipGoalMilestone(JAR, { now: aug });
    console.log("r2", r2);
    check(r2.raised === 10 && r2.pct === 50 && JSON.stringify(r2.recorded) === "[50]" && r2.emailed === 50, "august: 50% → recorded [50], emailed 50");

    // 3) dedupe rows persisted with emailed flags
    const rows = (await tipGoalMilestoneModel.findAll({ where: { scope, month_key: ["2026-07", "2026-08"] }, raw: true, order: [["month_key", "ASC"], ["milestone", "ASC"]] })) as unknown as Array<{ month_key: string; milestone: number; emailed: boolean }>;
    console.log("rows", rows.map((r) => `${r.month_key}:${r.milestone}:${r.emailed ? "emailed" : "silent"}`).join(" "));
    check(rows.length === 3, "3 milestone rows persisted");
    check(rows.find((r) => r.month_key === "2026-07" && r.milestone === 50)?.emailed === false, "july 50% row recorded but NOT emailed (skipped past)");
    check(rows.find((r) => r.month_key === "2026-07" && r.milestone === 100)?.emailed === true, "july 100% row emailed");
    check(rows.find((r) => r.month_key === "2026-08" && r.milestone === 50)?.emailed === true, "august 50% row emailed");

    // 4) emails dumped (suppressed) — 2 files, right subjects, CTA to the creator page
    const files = fs.readdirSync(OUT);
    const subjects = files.map((f) => (fs.readFileSync(`${OUT}/${f}`, "utf8").match(/subject: (.*?) -->/) || [])[1] || "");
    console.log("dumped:", subjects);
    check(files.length === 2, "exactly 2 emails rendered");
    check(subjects.some((s) => /hit your monthly tip goal/.test(s)) && subjects.some((s) => /halfway/.test(s)), "one 100% + one 50% subject");
    check(files.every((f) => /\/devhub"/.test(fs.readFileSync(`${OUT}/${f}`, "utf8"))), "CTA links to the creator page /devhub");
  } finally {
    await setGoal(before.g == null ? null : Number(before.g));
    await cleanup();
    const [after] = (await sequelize.query(`SELECT support_widget_monthly_goal AS g FROM tbl_company WHERE company_id = :c`, { replacements: { c: COMPANY }, type: QueryTypes.SELECT })) as Array<{ g: string | null }>;
    const left = await tipGoalMilestoneModel.count({ where: { scope } });
    console.log("restored goal:", after.g, "| milestone rows left for scope:", left);
    check(String(after.g) === String(before.g) && left === 0, "cleanup: goal restored + milestone rows removed");
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
