import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const q = async (sql: string) => (await sequelize.query(sql, { type: QueryTypes.SELECT })) as any[];
const line = (s = "") => console.log(s);
const hr = (t: string) => { line("\n" + "=".repeat(70)); line(t); line("=".repeat(70)); };

// Real external signups (owner QA/test accounts excluded), last 30 days.
const REAL = `u."createdAt" > now() - interval '30 days'
  AND u.email NOT ILIKE 'onarrival21+%' AND u.email NOT ILIKE '%@dynopaytest.com'
  AND u.email NOT ILIKE '%@dynopay-qa.com' AND u.email NOT ILIKE '%@example.com'
  AND u.email NOT ILIKE 'dyno-rbac%'`;

(async () => {
  hr("DEEPER 'why no payment' funnel — REAL external signups (30d)");
  const f = (await q(`
    WITH s AS (SELECT u.* FROM tbl_user u WHERE ${REAL})
    SELECT
      (SELECT COUNT(*)::int FROM s) signups,
      (SELECT COUNT(DISTINCT c.user_id)::int FROM tbl_company c JOIN s ON s.user_id=c.user_id) company,
      (SELECT COUNT(DISTINCT a.user_id)::int FROM tbl_api a JOIN s ON s.user_id=a.user_id) has_api_key,
      (SELECT COUNT(DISTINCT w.user_id)::int FROM tbl_user_wallet w JOIN s ON s.user_id=w.user_id) has_user_wallet,
      (SELECT COUNT(DISTINCT mw.user_id)::int FROM tbl_merchant_wallet mw JOIN s ON s.user_id=mw.user_id) merchant_wallet,
      (SELECT COUNT(DISTINCT pl.user_id)::int FROM tbl_payment_link pl JOIN s ON s.user_id=pl.user_id) made_payment_link,
      (SELECT COUNT(DISTINCT p.merchant_user_id)::int FROM tbl_product p JOIN s ON s.user_id=p.merchant_user_id) made_product,
      (SELECT COUNT(DISTINCT c.user_id)::int FROM tbl_company c JOIN s ON s.user_id=c.user_id WHERE c.settlement_wallet_address IS NOT NULL AND c.settlement_wallet_address<>'') settlement_wallet,
      (SELECT COUNT(DISTINCT t.user_id)::int FROM tbl_user_transaction t JOIN s ON s.user_id=t.user_id) any_txn,
      (SELECT COUNT(DISTINCT t.user_id)::int FROM tbl_user_transaction t JOIN s ON s.user_id=t.user_id WHERE lower(t.status) IN ('paid','completed','confirmed','settled','success')) paid
  `))[0];
  const p = (n: number) => f.signups ? `${((n / f.signups) * 100).toFixed(0)}%` : "-";
  line(`  signups .......................... ${f.signups}`);
  line(`  created company .................. ${f.company} (${p(f.company)})`);
  line(`  minted an API key ................ ${f.has_api_key} (${p(f.has_api_key)})`);
  line(`  got a deposit user_wallet ........ ${f.has_user_wallet} (${p(f.has_user_wallet)})`);
  line(`  has merchant_wallet (xpub) ....... ${f.merchant_wallet} (${p(f.merchant_wallet)})`);
  line(`  created a payment link ........... ${f.made_payment_link} (${p(f.made_payment_link)})`);
  line(`  created a product ................ ${f.made_product} (${p(f.made_product)})`);
  line(`  set settlement/payout wallet ..... ${f.settlement_wallet} (${p(f.settlement_wallet)})  <= needed to KEEP the money`);
  line(`  ANY transaction row .............. ${f.any_txn} (${p(f.any_txn)})`);
  line(`  PAID transaction ................. ${f.paid} (${p(f.paid)})`);

  hr("STATUS of every txn row from real recent signups");
  (await q(`SELECT lower(t.status) status, COUNT(*)::int rows, COUNT(DISTINCT t.user_id)::int users
    FROM tbl_user_transaction t JOIN tbl_user u ON u.user_id=t.user_id WHERE ${REAL}
    GROUP BY 1 ORDER BY rows DESC`))
    .forEach((r) => line(`  ${String(r.status).padEnd(15)} rows:${r.rows}  users:${r.users}`));

  hr("RAW login locations of real recent signups (top 30)");
  (await q(`SELECT COALESCE(NULLIF(lh.location,''),'(null)') loc, COUNT(DISTINCT lh.user_id)::int users
    FROM tbl_login_history lh JOIN tbl_user u ON u.user_id=lh.user_id WHERE ${REAL}
    GROUP BY 1 ORDER BY users DESC LIMIT 30`))
    .forEach((r) => line(`  ${String(r.loc).padEnd(40)} ${r.users}`));

  hr("purpose_vertical chosen at signup (real recent)");
  (await q(`SELECT COALESCE(u.purpose_vertical,'(none)') v, COUNT(*)::int c FROM tbl_user u WHERE ${REAL} GROUP BY 1 ORDER BY c DESC`))
    .forEach((r) => line(`  ${String(r.v).padEnd(14)} ${r.c}`));

  process.exit(0);
})().catch((e) => { console.error(String((e as any)?.stack || e)); process.exit(1); });
