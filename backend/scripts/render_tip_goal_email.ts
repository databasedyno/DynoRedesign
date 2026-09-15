/**
 * Render the creator tip-goal milestone emails (50% + 100%) in all 6 languages to HTML
 * files (nothing is sent — DISABLE_OUTBOUND_EMAIL + EMAIL_DUMP_DIR are forced) and fail
 * on any raw i18n key leaking into subject/body. Also unit-checks the milestone maths.
 * Run: cd backend && node_modules/.bin/ts-node --transpile-only scripts/render_tip_goal_email.ts
 */
import * as fs from "fs";
import * as path from "path";

process.env.DISABLE_OUTBOUND_EMAIL = "true";
const OUT = process.env.EMAIL_DUMP_DIR || "/tmp/email_tip_goal/html";
process.env.EMAIL_DUMP_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const LANGS = ["en", "de", "es", "fr", "pt", "nl"];
const RAW_KEY = /\b(tipGoal|labels|common)\.[A-Za-z]+(\.[A-Za-z]+)?\b/;

const main = async () => {
  const { sendTipGoalMilestoneEmail } = await import("../services/email/tipGoalEmails");
  const { reachedMilestones, monthKeyOf } = await import("../services/tipGoalMilestoneService");

  // Milestone maths
  const cases: Array<[number, number, number[]]> = [
    [0, 500, []], [249.99, 500, []], [250, 500, [50]], [499.99, 500, [50]], [500, 500, [50, 100]], [900, 500, [50, 100]], [100, 0, []],
  ];
  let mathBad = 0;
  for (const [raised, goal, want] of cases) {
    const got = reachedMilestones(raised, goal);
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) mathBad++;
    console.log(`${ok ? "ok  " : "FAIL"} reachedMilestones(${raised}, ${goal}) = [${got}] (want [${want}])`);
  }
  const mk = monthKeyOf(new Date(Date.UTC(2026, 5, 3)));
  console.log(`${mk === "2026-06" ? "ok  " : "FAIL"} monthKeyOf → ${mk}`);
  if (mk !== "2026-06") mathBad++;

  const monthStart = new Date(Date.UTC(2026, 5, 1));
  for (const L of LANGS) {
    const to = `creator-${L}@example.com`;
    await sendTipGoalMilestoneEmail(to, "Katie Kendra", "The Dev Store", { milestone: 50, goal: 500, raised: 262.5, currency: "USD", supporters: 7, monthStart, pageUrl: "https://dynopay.com/devhub" }, L);
    await sendTipGoalMilestoneEmail(to, "", "The Dev Store", { milestone: 100, goal: 500, raised: 540, currency: "USD", supporters: 1, monthStart, pageUrl: "https://dynopay.com/devhub" }, L);
  }

  const files = fs.readdirSync(OUT).sort();
  let bad = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(OUT, f), "utf8");
    const subject = (html.match(/subject: (.*?) -->/) || [])[1] || "";
    const leak = html.match(RAW_KEY);
    if (leak) { bad++; console.log(`RAW KEY in ${f}: ${leak[0]}`); }
    const hasBar = html.includes('class="track"');
    const hasCta = html.includes("https://dynopay.com/devhub");
    if (!hasBar || !hasCta) { bad++; console.log(`MISSING ${!hasBar ? "progress bar" : "CTA"} in ${f}`); }
    console.log(`${leak || !hasBar || !hasCta ? "FAIL" : "ok  "} ${subject}`);
  }
  console.log(`\nrendered ${files.length} emails (${LANGS.length} langs × 2), raw-key/structure failures: ${bad}, maths failures: ${mathBad}`);
  process.exit(bad || mathBad ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
