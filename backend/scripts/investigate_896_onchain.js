/* READ-ONLY: (1) payment context + custody for Armin's ERC20 temp addresses,
 * (2) on-chain USDT + ETH balance of each via public RPC. No writes anywhere. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");
const https = require("https");

const UID = 139;
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // ERC20 USDT (6 decimals)
const RPCS = ["https://eth.llamarpc.com", "https://cloudflare-eth.com", "https://rpc.ankr.com/eth"];

function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const tryOne = (url) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => {
        try { const j = JSON.parse(d); if (j.error) return reject(new Error(j.error.message)); resolve(j.result); }
        catch (e) { reject(e); } }); });
    req.on("error", reject); req.setTimeout(12000, () => req.destroy(new Error("timeout"))); req.write(body); req.end();
  });
  return (async () => { let last; for (const u of RPCS) { try { return await tryOne(u); } catch (e) { last = e; } } throw last; })();
}
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
async function usdtBalance(addr) { const r = await rpc("eth_call", [{ to: USDT, data: "0x70a08231" + pad(addr) }, "latest"]); return Number(BigInt(r)) / 1e6; }
async function ethBalance(addr) { const r = await rpc("eth_getBalance", [addr, "latest"]); return Number(BigInt(r)) / 1e18; }
async function txCount(addr) { const r = await rpc("eth_getTransactionCount", [addr, "latest"]); return Number(BigInt(r)); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `SELECT temp_address_id, wallet_address, status,
            (private_key IS NOT NULL AND private_key<>'') AS has_pk,
            last_payment_context, last_used_at, last_swept_at
       FROM tbl_merchant_temp_address
      WHERE owner_user_id=$1 AND wallet_type='USDT-ERC20' ORDER BY temp_address_id`, [UID]);
  await c.end();

  console.log("Checking " + r.rows.length + " ERC20 deposit addresses on-chain...\n");
  for (const row of r.rows) {
    const a = row.wallet_address;
    let usdt = "?", eth = "?", nonce = "?";
    try { usdt = (await usdtBalance(a)).toString(); } catch (e) { usdt = "ERR:" + e.message; }
    try { eth = (await ethBalance(a)).toString(); } catch (e) {}
    try { nonce = (await txCount(a)).toString(); } catch (e) {}
    let ctx = row.last_payment_context;
    if (ctx && typeof ctx === "object") ctx = JSON.stringify(ctx).slice(0, 120);
    console.log(`#${row.temp_address_id} ${a}`);
    console.log(`   status=${row.status} has_pk=${row.has_pk} nonce=${nonce}`);
    console.log(`   ON-CHAIN: USDT=${usdt}  ETH=${eth}`);
    console.log(`   last_used=${row.last_used_at} last_swept=${row.last_swept_at}`);
    console.log(`   ctx=${ctx || "null"}\n`);
  }
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
