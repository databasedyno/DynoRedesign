#!/usr/bin/env node
/* QA: step-up factor policy (authenticator-only when TOTP enrolled; email code otherwise).
 * Read-mostly: only opens a 10-min step-up session for scope "apikey" on the owner test account.
 * Usage: BASE=<preview url> node scripts/qa_stepup_policy.cjs */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const { generateSync } = require("otplib");

const BASE = (process.env.BASE || process.env.APP_URL || "").replace(/\/+$/, "");
if (!BASE) { console.error("BASE required"); process.exit(2); }
const j = async (path, opts = {}) => {
  const r = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* ignore */ }
  return { status: r.status, data };
};
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

const totpSecret = async (userId) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const r = await client.query("select secret from tbl_user_2fa where user_id=$1", [userId]);
  await client.end();
  return r.rows[0]?.secret;
};

const login = async (email, password, totpFor) => {
  const first = await j("/user/login", { method: "POST", body: { email, password } });
  const d = first.data?.data || first.data || {};
  if (d.token || d.accessToken) return d.token || d.accessToken;
  if (d.requires_2fa || d.challenge_token) {
    let code;
    if (d.method === "email") {
      code = d.preview_otp || (first.data?.preview_otp);
    } else {
      code = generateSync({ secret: await totpSecret(totpFor), strategy: "totp" });
    }
    const v = await j("/user/2fa/validate", { method: "POST", body: { challenge_token: d.challenge_token, token: String(code) } });
    const vd = v.data?.data || {};
    if (!vd.token && !vd.accessToken) throw new Error("2fa validate failed: " + JSON.stringify(v.data).slice(0, 300));
    return vd.token || vd.accessToken;
  }
  throw new Error("login shape unknown: " + JSON.stringify(first.data).slice(0, 300));
};

(async () => {
  // ---- TOTP account (owner, user 1) ----
  const t1 = await login("onarrival21@gmail.com", "Katiekendra123@", 1);
  const H = { Authorization: `Bearer ${t1}` };
  const st = await j("/stepup/apikey/status", { headers: H });
  const m = st.data?.data?.methods || {};
  check("totp user: status methods authenticator-only", st.status === 200 && m.totp === true && m.backup === true && m.email === false && m.sms === false, JSON.stringify(m));
  check("totp user: status.factor = authenticator", st.data?.data?.factor === "authenticator", String(st.data?.data?.factor));
  const rc = await j("/stepup/apikey/request-code", { method: "POST", headers: H });
  check("totp user: request-code refused (403)", rc.status === 403, `${rc.status} ${rc.data?.message}`);
  const ve = await j("/stepup/apikey/verify", { method: "POST", headers: H, body: { method: "email", code: "123456" } });
  check("totp user: email verify refused (403)", ve.status === 403, `${ve.status} ${ve.data?.message}`);
  // Sensitive routes challenge BEFORE unlock (no mutation happens)
  const tg = await j("/userApi/toggleStatus/92", { method: "PUT", headers: H, body: { status: "active" } });
  check("API key toggleStatus challenges (403 STEPUP_REQUIRED apikey)", tg.status === 403 && tg.data?.code === "STEPUP_REQUIRED" && tg.data?.scope === "apikey", `${tg.status} ${tg.data?.code} ${tg.data?.scope}`);
  const pk = await j("/publishable-keys/6", { method: "PATCH", headers: H, body: { status: "active" } });
  check("publishable key PATCH challenges (403 apikey)", pk.status === 403 && pk.data?.code === "STEPUP_REQUIRED", `${pk.status} ${pk.data?.code} ${pk.data?.scope}`);
  const pkd = await j("/publishable-keys/6", { method: "DELETE", headers: H });
  check("publishable key DELETE challenges (403 apikey)", pkd.status === 403 && pkd.data?.code === "STEPUP_REQUIRED", `${pkd.status} ${pkd.data?.code}`);
  const del = await j("/user/account", { method: "DELETE", headers: H });
  check("DELETE /user/account challenges (403 account_delete)", del.status === 403 && del.data?.code === "STEPUP_REQUIRED" && del.data?.scope === "account_delete", `${del.status} ${del.data?.code} ${del.data?.scope}`);
  const so = await j("/user/account/send-otp", { method: "POST", headers: H });
  check("legacy /user/account/send-otp removed (404)", so.status === 404, String(so.status));
  const stad = await j("/stepup/account_delete/status", { headers: H });
  check("account_delete is a valid scope", stad.status === 200 && stad.data?.data?.active === false, `${stad.status} active=${stad.data?.data?.active}`);
  // Real TOTP unlocks the apikey scope
  const code = generateSync({ secret: await totpSecret(1), strategy: "totp" });
  const vt = await j("/stepup/apikey/verify", { method: "POST", headers: H, body: { method: "totp", code } });
  check("totp user: authenticator code unlocks scope", vt.status === 200 && vt.data?.data?.active === true, `${vt.status} ${vt.data?.message}`);
  const st2 = await j("/stepup/apikey/status", { headers: H });
  check("totp user: session active after verify", st2.data?.data?.active === true);
  await j("/stepup/apikey/revoke", { method: "POST", headers: H });
  const st3 = await j("/stepup/apikey/status", { headers: H });
  check("totp user: revoke locks again", st3.data?.data?.active === false);

  // ---- Email-factor account (user 221) ----
  try {
    const t2 = await login("qa_minorder_p1b@example.com", "QaMinOrder123@", 221);
    const H2 = { Authorization: `Bearer ${t2}` };
    const s2 = await j("/stepup/security/status", { headers: H2 });
    const m2 = s2.data?.data?.methods || {};
    check("email user: status methods email-only", m2.email === true && m2.totp === false && m2.backup === false, JSON.stringify(m2));
    const vt2 = await j("/stepup/security/verify", { method: "POST", headers: H2, body: { method: "totp", code: "000000" } });
    check("email user: totp verify refused (400)", vt2.status === 400, `${vt2.status} ${vt2.data?.message}`);
    const rc2 = await j("/stepup/security/request-code", { method: "POST", headers: H2 });
    check("email user: request-code works (200) + preview_otp", rc2.status === 200 && !!rc2.data?.data?.preview_otp, `${rc2.status}`);
    const ok2 = await j("/stepup/security/verify", { method: "POST", headers: H2, body: { method: "email", code: rc2.data?.data?.preview_otp } });
    check("email user: email code unlocks", ok2.status === 200 && ok2.data?.data?.active === true, `${ok2.status} ${ok2.data?.message}`);
    await j("/stepup/security/revoke", { method: "POST", headers: H2 });
  } catch (e) {
    check("email user flow", false, e.message);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
