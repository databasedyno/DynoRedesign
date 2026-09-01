import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const q = async (sql: string) => (await sequelize.query(sql, { type: QueryTypes.SELECT })) as any[];
const line = (s = "") => console.log(s);
const hr = (t: string) => { line("\n" + "=".repeat(70)); line(t); line("=".repeat(70)); };

(async () => {
  // ---------- 0. related tables for the "can they even receive money" funnel ----------
  const extra = await q(`SELECT table_name AS tn FROM information_schema.tables WHERE table_schema='public'
     AND (table_name ILIKE '%api%' OR table_name ILIKE '%payment_link%' OR table_name ILIKE '%paylink%'
          OR table_name ILIKE '%wallet%' OR table_name ILIKE '%invoice%' OR table_name ILIKE '%product%'
          OR table_name ILIKE '%buy_button%') ORDER BY 1`);
  hr("FUNNEL-RELATED TABLES");
  line(extra.map((r) => r.tn).join(", "));

  // ---------- 1. signups per day (last 45d) ----------
  hr("SIGNUPS PER DAY (last 45 days)");
  (await q(`SELECT to_char("createdAt",'YYYY-MM-DD') d, COUNT(*)::int c
            FROM tbl_user WHERE "createdAt" > now() - interval '45 days' GROUP BY 1 ORDER BY 1`))
    .forEach((r) => line(`  ${r.d}  ${"#".repeat(Math.min(r.c, 60))} ${r.c}`));

  const tot = await q(`SELECT COUNT(*)::int c FROM tbl_user`);
  const rec = await q(`SELECT COUNT(*)::int c FROM tbl_user WHERE "createdAt" > now() - interval '30 days'`);
  line(`\nTOTAL users all-time: ${tot[0].c}   |   last 30 days: ${rec[0].c}`);

  // ---------- 2. conversion funnel for last-30d signups ----------
  hr("CONVERSION FUNNEL — signups in the last 30 days");
  const funnel = await q(`
    WITH s AS (SELECT * FROM tbl_user WHERE "createdAt" > now() - interval '30 days')
    SELECT
      (SELECT COUNT(*)::int FROM s) AS signups,
      (SELECT COUNT(*)::int FROM s WHERE email_verified) AS email_verified,
      (SELECT COUNT(*)::int FROM s WHERE login_type='GOOGLE') AS via_google,
      (SELECT COUNT(*)::int FROM s WHERE login_type='EMAIL') AS via_email,
      (SELECT COUNT(DISTINCT c.user_id)::int FROM tbl_company c JOIN s ON s.user_id=c.user_id) AS created_company,
      (SELECT COUNT(DISTINCT c.user_id)::int FROM tbl_company c JOIN s ON s.user_id=c.user_id
         WHERE c.settlement_wallet_address IS NOT NULL AND c.settlement_wallet_address <> '') AS set_settlement_wallet,
      (SELECT COUNT(DISTINCT c.user_id)::int FROM tbl_company c JOIN s ON s.user_id=c.user_id
         WHERE c.webhook_url IS NOT NULL AND c.webhook_url <> '') AS set_webhook,
      (SELECT COUNT(DISTINCT t.user_id)::int FROM tbl_user_transaction t JOIN s ON s.user_id=t.user_id) AS any_txn_row,
      (SELECT COUNT(DISTINCT t.user_id)::int FROM tbl_user_transaction t JOIN s ON s.user_id=t.user_id
         WHERE lower(t.status) IN ('paid','completed','confirmed','settled','success')) AS paid_txn,
      (SELECT COUNT(DISTINCT o.user_id)::int FROM tbl_onboarding_event o JOIN s ON s.user_id=o.user_id) AS engaged_onboarding,
      (SELECT COUNT(*)::int FROM s WHERE cumulative_volume_usd > 0) AS volume_gt0
  `);
  const f = funnel[0];
  const pct = (n: number) => f.signups ? `${((n / f.signups) * 100).toFixed(1)}%` : "-";
  line(`  signups .................. ${f.signups}`);
  line(`  ├─ email verified ........ ${f.email_verified}  (${pct(f.email_verified)})`);
  line(`  │    via GOOGLE .......... ${f.via_google}   via EMAIL ${f.via_email}`);
  line(`  ├─ engaged onboarding .... ${f.engaged_onboarding}  (${pct(f.engaged_onboarding)})`);
  line(`  ├─ created a company ..... ${f.created_company}  (${pct(f.created_company)})`);
  line(`  ├─ set settlement wallet . ${f.set_settlement_wallet}  (${pct(f.set_settlement_wallet)})  <= REQUIRED to get paid`);
  line(`  ├─ set webhook ........... ${f.set_webhook}`);
  line(`  ├─ any transaction row ... ${f.any_txn_row}`);
  line(`  └─ PAID transaction ...... ${f.paid_txn}  (${pct(f.paid_txn)})   volume>0: ${f.volume_gt0}`);

  // ---------- 3. BOT SIGNAL: shared IPs across signups (first login IP) ----------
  hr("BOT SIGNAL — IPs shared by multiple recent signups (via login history, 30d)");
  (await q(`
    SELECT lh.ip_address, COUNT(DISTINCT lh.user_id)::int users, MIN(lh.location) location,
           string_agg(DISTINCT left(lh.user_agent,0),'') AS _
    FROM tbl_login_history lh JOIN tbl_user u ON u.user_id=lh.user_id
    WHERE u."createdAt" > now() - interval '30 days'
    GROUP BY lh.ip_address HAVING COUNT(DISTINCT lh.user_id) > 1
    ORDER BY users DESC LIMIT 20`))
    .forEach((r) => line(`  ${String(r.ip_address).padEnd(28)} ${String(r.users).padStart(3)} users  ${r.location || ""}`));

  // ---------- 4. BOT SIGNAL: identical user agents ----------
  hr("BOT SIGNAL — user-agents shared by multiple recent signups (30d)");
  (await q(`
    SELECT COUNT(DISTINCT lh.user_id)::int users, left(lh.user_agent,90) ua
    FROM tbl_login_history lh JOIN tbl_user u ON u.user_id=lh.user_id
    WHERE u."createdAt" > now() - interval '30 days' AND lh.user_agent IS NOT NULL
    GROUP BY left(lh.user_agent,90) ORDER BY users DESC LIMIT 12`))
    .forEach((r) => line(`  ${String(r.users).padStart(3)}  ${r.ua}`));

  // ---------- 5. location spread (the "various locations") ----------
  hr("LOCATION SPREAD of recent signups (30d, from login history)");
  (await q(`
    SELECT COALESCE(NULLIF(split_part(lh.location, ',', -1),''),'?') AS loc, COUNT(DISTINCT lh.user_id)::int users
    FROM tbl_login_history lh JOIN tbl_user u ON u.user_id=lh.user_id
    WHERE u."createdAt" > now() - interval '30 days'
    GROUP BY 1 ORDER BY users DESC LIMIT 25`))
    .forEach((r) => line(`  ${String(r.loc).trim().padEnd(30)} ${r.users}`));

  // ---------- 6. email domain distribution ----------
  hr("EMAIL DOMAIN distribution of recent signups (30d)");
  (await q(`
    SELECT lower(split_part(email,'@',2)) domain, COUNT(*)::int c,
           SUM(CASE WHEN email_verified THEN 1 ELSE 0 END)::int verified
    FROM tbl_user WHERE "createdAt" > now() - interval '30 days'
    GROUP BY 1 ORDER BY c DESC LIMIT 25`))
    .forEach((r) => line(`  ${String(r.domain).padEnd(30)} ${String(r.c).padStart(4)}  verified:${r.verified}`));

  // ---------- 7. sample of recent signups w/ status ----------
  hr("SAMPLE — 40 most recent signups");
  (await q(`
    SELECT u.user_id, left(u.email,34) email, u.login_type lt, u.email_verified ev,
           to_char(u."createdAt",'MM-DD HH24:MI') created,
           (SELECT COUNT(*)::int FROM tbl_company c WHERE c.user_id=u.user_id) comp,
           (SELECT COUNT(*)::int FROM tbl_user_transaction t WHERE t.user_id=u.user_id) txn,
           u.cumulative_volume_usd vol, COALESCE(u.purpose_vertical,'-') vert,
           (SELECT lh.location FROM tbl_login_history lh WHERE lh.user_id=u.user_id ORDER BY lh.login_at ASC LIMIT 1) first_loc
    FROM tbl_user u ORDER BY u."createdAt" DESC LIMIT 40`))
    .forEach((r) => line(
      `  #${String(r.user_id).padStart(5)} ${r.created}  ${String(r.email).padEnd(35)} ${String(r.lt).padEnd(7)} ev:${r.ev ? "Y" : "n"} comp:${r.comp} txn:${r.txn} vol:${r.vol} ${String(r.vert).padEnd(11)} ${r.first_loc || ""}`));

  process.exit(0);
})().catch((e) => { console.error(String(e && (e as any).stack || e)); process.exit(1); });
