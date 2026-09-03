// Counts SQL statements per endpoint by hooking Sequelize logging on a live in-process app instance.
require("dotenv").config({ path: "/app/backend/.env" });
// Usage: TOKEN=... npx ts-node --transpile-only scripts/audit/query_count.ts
process.env.PORT = "3399";
process.env.ENABLE_BACKGROUND_JOBS = "false";
process.env.WORKER_ROLE = "secondary";
import http from "http";
(async () => {
  let count = 0; const seen: string[] = [];
  const pg = require("pg");
  const origQuery = pg.Client.prototype.query;
  pg.Client.prototype.query = function (...args: any[]) { const q = typeof args[0] === "string" ? args[0] : (args[0]?.text || ""); if (q && !/^(BEGIN|COMMIT|ROLLBACK|SET |SHOW )/i.test(q)) { count++; seen.push(q.slice(0, 160).replace(/\s+/g, " ")); } return origQuery.apply(this, args); };
  await import("../../server");
  for (let i = 0; i < 90; i++) { const ok = await new Promise<boolean>((res) => http.get({ host: "127.0.0.1", port: 3399, path: "/health" }, (r) => { r.resume(); res(r.statusCode === 200); }).on("error", () => res(false))); if (ok) break; await new Promise(r => setTimeout(r, 1000)); }
  console.log("###READY");
  const token = process.env.TOKEN!;
  const eps = ["/api/company/getCompany","/api/wallet/getWallet?company_id=1","/api/user/profile","/api/dashboard?company_id=1","/api/dashboard/fee-tiers?company_id=1","/api/dashboard/recent-transactions?company_id=1","/api/userApi/customers/directory?company_id=1","/api/userApi/getApi?company_id=1","/api/kyc/status?company_id=1","/api/pay/getPaymentLinks?company_id=1"];
  for (const ep of eps) {
    count = 0; seen.length = 0;
    const t0 = Date.now(); let status = 0;
    await new Promise<void>((res) => http.get({ host: "127.0.0.1", port: 3399, path: ep, headers: { Authorization: `Bearer ${token}` } }, (r) => { r.resume(); r.on("end", () => { status = r.statusCode!; res(); }); }).on("error", () => res()));
    const ms = Date.now() - t0;
    const uniq = new Set(seen.map(s => s.replace(/\d+/g, "N")));
    console.log(`\n### ${ep} [${status}] -> ${count} queries (${uniq.size} distinct shapes) in ${ms}ms`);
    if (count > 6) for (const s of Array.from(uniq).slice(0, 14)) console.log("   ", s.slice(0, 130));
  }
  process.exit(0);
})();
