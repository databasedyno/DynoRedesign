/* SafeDeal Telegram alerts smoke: link (signed payload) → test → tamper → unlink. Throwaway account only.
   usage: node -r dotenv/config scripts/telegram_alerts_smoke.js [baseUrl]   (run from /app/backend) */
const crypto = require("crypto");

const BASE = process.argv[2] || "http://localhost:3300";
const TOKEN = (process.env.SAFEDEAL_TELEGRAM_BOT_TOKEN || "").trim();
if (!TOKEN) { console.error("SAFEDEAL_TELEGRAM_BOT_TOKEN missing"); process.exit(1); }
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

const call = async (path, method = "GET", body, sd) => {
  const r = await fetch(`${BASE}/api/safedeal${path}`, {
    method,
    headers: { "content-type": "application/json", "user-agent": UA, ...(sd ? { "x-safedeal-token": sd } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch { /* html */ }
  return { status: r.status, body: j };
};

const sign = (fields) => {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = crypto.createHash("sha256").update(TOKEN).digest();
  return { ...fields, hash: crypto.createHmac("sha256", secret).update(dcs).digest("hex") };
};

const expect = (label, cond, extra) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`); if (!cond) process.exitCode = 1; };

(async () => {
  // helper for UI tests: `node -r dotenv/config scripts/telegram_alerts_smoke.js <baseUrl> --link <sd_token>` links a fake Telegram id and exits
  if (process.argv[3] === "--link" && process.argv[4]) {
    const payload = sign({ id: 990000000 + Math.floor(Math.random() * 9999999), first_name: "Smoke", auth_date: Math.floor(Date.now() / 1000) });
    const r = await call("/telegram/link", "POST", payload, process.argv[4]);
    console.log(r.status, JSON.stringify(r.body?.data || r.body?.message));
    return;
  }
  const email = `sd-tg-smoke-${Date.now()}@example.com`;
  const sc = await call("/auth/send-code", "POST", { email });
  const code = sc.body?.data?.preview_code;
  expect("send-code returns preview_code", Boolean(code), `status ${sc.status}`);
  const vc = await call("/auth/verify-code", "POST", { email, code });
  const sd = vc.body?.data?.token;
  expect("verify-code returns token", Boolean(sd));

  const s0 = await call("/telegram", "GET", undefined, sd);
  expect("GET /telegram unlinked", s0.status === 200 && s0.body.data.linked === false && s0.body.data.configured === true && Boolean(s0.body.data.bot), JSON.stringify(s0.body?.data));

  const tgId = 990000000 + Math.floor(Math.random() * 9999999);
  const payload = sign({ id: tgId, first_name: "Smoke", username: "sd_smoke", auth_date: Math.floor(Date.now() / 1000) });
  const bad = await call("/telegram/link", "POST", { ...payload, hash: "0".repeat(64) }, sd);
  expect("link with tampered hash → 401", bad.status === 401, `status ${bad.status}`);
  const stale = await call("/telegram/link", "POST", sign({ id: tgId, first_name: "Smoke", auth_date: Math.floor(Date.now() / 1000) - 90000 }), sd);
  expect("link with expired auth_date → 401", stale.status === 401, `status ${stale.status}`);
  const noauth = await call("/telegram/link", "POST", payload);
  expect("link without session → 401", noauth.status === 401, `status ${noauth.status}`);

  const link = await call("/telegram/link", "POST", payload, sd);
  expect("link valid payload → 200 linked", link.status === 200 && link.body.data.linked === true, JSON.stringify(link.body?.data));
  expect("hello message NOT delivered to a fake chat (message_sent=false)", link.body?.data?.message_sent === false);

  const s1 = await call("/telegram", "GET", undefined, sd);
  expect("GET /telegram linked", s1.status === 200 && s1.body.data.linked === true);

  const t = await call("/telegram/test", "POST", {}, sd);
  expect("POST /telegram/test on unreachable chat → 409 with Start-the-bot hint", t.status === 409 && /press Start/i.test(t.body?.message || ""), `${t.status} ${t.body?.message}`);

  // second account can't claim the same Telegram id
  const email2 = `sd-tg-smoke2-${Date.now()}@example.com`;
  const sc2 = await call("/auth/send-code", "POST", { email: email2 });
  const vc2 = await call("/auth/verify-code", "POST", { email: email2, code: sc2.body?.data?.preview_code });
  const dup = await call("/telegram/link", "POST", payload, vc2.body?.data?.token);
  expect("same Telegram id on another account → 409", dup.status === 409, `status ${dup.status}`);

  const un = await call("/telegram/unlink", "POST", {}, sd);
  expect("unlink → 200 linked=false", un.status === 200 && un.body.data.linked === false);
  const s2 = await call("/telegram", "GET", undefined, sd);
  expect("GET /telegram after unlink", s2.body?.data?.linked === false);
  const t2 = await call("/telegram/test", "POST", {}, sd);
  expect("test when unlinked → 400", t2.status === 400, `status ${t2.status}`);
  console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE OK");
})().catch((e) => { console.error(e); process.exit(1); });
