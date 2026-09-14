/**
 * REVERSIBLE integration harness for the additive webhook delivery redesign.
 *
 * Proves, against the REAL callMerchantWebhook + resolveWebhookTargets path:
 *   S1  company webhook DISABLED  → per-request URL STILL delivered (bug fix)
 *   S2  company + per-request set → BOTH delivered (additive)
 *   S3  per-request URL == company URL → delivered ONCE (dedupe)
 *   S4  per-URL 404 breaker on a per-request URL does NOT set the company-wide
 *       webhook_disabled flag (scoped circuit breaker)
 *
 * Mock endpoints bind to the pod LAN IP (never localhost/127.0.0.1, which the
 * delivery layer blocks). All company mutations on company_id=1 are captured
 * and RESTORED; test rows in tbl_webhook_delivery_log are deleted at the end.
 * No funds move.
 */
import http from "http";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const COMPANY_ID = 1;
const LAN_IP = process.env.HARNESS_IP || "10.208.131.234";
const PORT = 8931;

interface Hit { path: string; body: unknown; headers: http.IncomingHttpHeaders }
const hits: Hit[] = [];

function startServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let body: unknown = raw;
        try { body = JSON.parse(raw); } catch { /* keep raw */ }
        const path = req.url || "/";
        hits.push({ path, body, headers: req.headers });
        // /dead returns 404 to exercise the circuit breaker
        if (path.startsWith("/dead")) { res.statusCode = 404; res.end("not found"); return; }
        res.statusCode = 200; res.end("ok");
      });
    });
    server.listen(PORT, "0.0.0.0", () => resolve(server));
  });
}

const url = (p: string) => `http://${LAN_IP}:${PORT}${p}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hitsFor = (p: string) => hits.filter((h) => h.path.startsWith(p));

async function main() {
  const { callMerchantWebhook } = require("../webhooks");
  const server = await startServer();
  console.log(`[harness] mock server on ${url("")}`);

  // Capture original company_id=1 webhook state for restore.
  const [orig] = (await sequelize.query(
    `SELECT webhook_url, webhook_secret, webhook_disabled, webhook_disabled_at, webhook_disabled_reason
       FROM tbl_company WHERE company_id = :cid LIMIT 1`,
    { replacements: { cid: COMPANY_ID }, type: QueryTypes.SELECT },
  )) as any[];
  console.log("[harness] captured original company state:", JSON.stringify(orig));

  const results: Record<string, boolean> = {};
  const ev = (event: string) => ({ event, amount: 0, currency: "BTC", payment_id: "harness-" + Date.now(), status: "successful", payment_status: "confirmed" });

  try {
    // ── S1: company disabled → per-request URL still delivered ───────────────
    await sequelize.query(
      `UPDATE tbl_company SET webhook_disabled = TRUE, webhook_disabled_reason = 'harness disabled', webhook_url = NULL WHERE company_id = :cid`,
      { replacements: { cid: COMPANY_ID } },
    );
    hits.length = 0;
    await callMerchantWebhook({ company_id: COMPANY_ID, webhook_url: url("/s1_perreq") }, ev("payment.confirmed"));
    await wait(600);
    results.S1 = hitsFor("/s1_perreq").length === 1;
    console.log(`[S1] company-disabled → per-request delivered: ${results.S1} (hits=${hitsFor("/s1_perreq").length})`);

    // ── S2: company + per-request both set → both delivered (additive) ───────
    await sequelize.query(
      `UPDATE tbl_company SET webhook_disabled = FALSE, webhook_disabled_reason = NULL, webhook_url = :u WHERE company_id = :cid`,
      { replacements: { cid: COMPANY_ID, u: url("/s2_company") } },
    );
    hits.length = 0;
    await callMerchantWebhook({ company_id: COMPANY_ID, webhook_url: url("/s2_perreq") }, ev("payment.confirmed"));
    await wait(600);
    const s2p = hitsFor("/s2_perreq").length, s2c = hitsFor("/s2_company").length;
    results.S2 = s2p === 1 && s2c === 1;
    console.log(`[S2] additive both delivered: ${results.S2} (perreq=${s2p}, company=${s2c})`);

    // ── S3: identical per-request + company URL → delivered ONCE (dedupe) ────
    await sequelize.query(
      `UPDATE tbl_company SET webhook_disabled = FALSE, webhook_url = :u WHERE company_id = :cid`,
      { replacements: { cid: COMPANY_ID, u: url("/s3_same") } },
    );
    hits.length = 0;
    await callMerchantWebhook({ company_id: COMPANY_ID, webhook_url: url("/s3_same") }, ev("payment.confirmed"));
    await wait(600);
    results.S3 = hitsFor("/s3_same").length === 1;
    console.log(`[S3] dedupe same URL delivered once: ${results.S3} (hits=${hitsFor("/s3_same").length})`);

    // ── S4: 404s on a per-request URL do NOT set company webhook_disabled ────
    await sequelize.query(
      `UPDATE tbl_company SET webhook_disabled = FALSE, webhook_disabled_reason = NULL, webhook_url = NULL WHERE company_id = :cid`,
      { replacements: { cid: COMPANY_ID } },
    );
    for (let i = 0; i < 6; i++) {
      await callMerchantWebhook({ company_id: COMPANY_ID, webhook_url: url("/dead_perreq") }, ev("payment.confirmed"));
    }
    await wait(400);
    const [after] = (await sequelize.query(
      `SELECT webhook_disabled FROM tbl_company WHERE company_id = :cid LIMIT 1`,
      { replacements: { cid: COMPANY_ID }, type: QueryTypes.SELECT },
    )) as any[];
    results.S4 = after?.webhook_disabled === false;
    console.log(`[S4] company flag untouched by per-request 404s: ${results.S4} (webhook_disabled=${after?.webhook_disabled})`);

  } finally {
    // Restore original company state exactly.
    await sequelize.query(
      `UPDATE tbl_company SET webhook_url = :u, webhook_disabled = :d, webhook_disabled_at = :at, webhook_disabled_reason = :r WHERE company_id = :cid`,
      { replacements: {
          cid: COMPANY_ID,
          u: orig?.webhook_url ?? null,
          d: orig?.webhook_disabled ?? false,
          at: orig?.webhook_disabled_at ?? null,
          r: orig?.webhook_disabled_reason ?? null,
      } },
    );
    // Delete harness audit rows.
    await sequelize.query(
      `DELETE FROM tbl_webhook_delivery_log WHERE company_id = :cid AND webhook_url LIKE :p`,
      { replacements: { cid: COMPANY_ID, p: `http://${LAN_IP}:${PORT}%` } },
    );
    server.close();
    const [restored] = (await sequelize.query(
      `SELECT webhook_url, webhook_disabled, webhook_disabled_reason FROM tbl_company WHERE company_id = :cid LIMIT 1`,
      { replacements: { cid: COMPANY_ID }, type: QueryTypes.SELECT },
    )) as any[];
    console.log("[harness] restored company state:", JSON.stringify(restored));
  }

  const pass = Object.values(results).every(Boolean);
  console.log("\n=== RESULTS ===", JSON.stringify(results), pass ? "ALL PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error("[harness] error:", e); process.exit(1); });
