#!/usr/bin/env node
// Extra QA for iteration 194: cleanup verify + brand_delete regression
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { generateSync } = require("otplib");
const { Client } = require("pg");

const BASE = (process.env.BASE || "").replace(/\/+$/, "");
if (!BASE) { console.error("BASE required"); process.exit(2); }

const j = async (p, o = {}) => {
  const r = await fetch(`${BASE}/api${p}`, { ...o, headers: { "Content-Type": "application/json", ...(o.headers || {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, data: d };
};

const totpSecret = async (uid) => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("select secret from tbl_user_2fa where user_id=$1", [uid]);
  await c.end();
  return r.rows[0]?.secret;
};

const login = async (email, pw, totpFor) => {
  const first = await j("/user/login", { method: "POST", body: { email, password: pw } });
  const d = first.data?.data || first.data || {};
  if (d.token) return d.token;
  if (d.requires_2fa || d.challenge_token) {
    const code = d.method === "email" ? (d.preview_otp || first.data?.preview_otp) : generateSync({ secret: await totpSecret(totpFor), strategy: "totp" });
    const v = await j("/user/2fa/validate", { method: "POST", body: { challenge_token: d.challenge_token, token: String(code) } });
    return v.data?.data?.token || v.data?.data?.accessToken;
  }
  throw new Error("login shape unknown");
};

const results = [];
const check = (n, ok, det) => { results.push({ n, ok, det }); console.log(`${ok ? "PASS" : "FAIL"} ${n}${det ? " — " + det : ""}`); };

(async () => {
  const t1 = await login("onarrival21@gmail.com", "Katiekendra123@", 1);
  const H = { Authorization: `Bearer ${t1}` };

  // Cleanup: publishable keys for company 1
  const pk = await j("/publishable-keys?company_id=1", { headers: H });
  const pkList = pk.data?.data || pk.data || [];
  const arr = Array.isArray(pkList) ? pkList : (pkList.keys || pkList.rows || []);
  check("publishable keys company_id=1 has exactly 1 key", arr.length === 1, `count=${arr.length} names=${arr.map(k => k.name || k.key_name).join(",")}`);
  check("publishable key is 'Live Buy Button' active", arr[0] && (arr[0].name === "Live Buy Button" || arr[0].key_name === "Live Buy Button") && (arr[0].status === "active" || arr[0].is_active), JSON.stringify(arr[0]).slice(0, 200));

  // API keys for company 1
  const api = await j("/userApi/getApi?company_id=1", { headers: H });
  console.log("API raw:", JSON.stringify(api.data).slice(0, 500));
  const apiArr = api.data?.data || api.data || {};
  const apiList = Array.isArray(apiArr) ? apiArr : (apiArr.all || apiArr.keys || apiArr.rows || []);
  check("api keys company_id=1 has exactly 1 key", apiList.length === 1, `count=${apiList.length} names=${apiList.map(k => k.name || k.api_name).join(",")}`);
  check("api key is 'Pulse-26'", apiList[0] && (apiList[0].name === "Pulse-26" || apiList[0].api_name === "Pulse-26"), JSON.stringify(apiList[0]).slice(0, 200));

  // Regression: brand_delete scope challenges
  // Find a non-primary company id for user 1
  const cs = await j("/company/getCompanyList", { headers: H });
  const clist = cs.data?.data || cs.data || [];
  const companies = Array.isArray(clist) ? clist : [];
  // pick one NOT the primary (id 1)
  const target = companies.find(c => (c.id || c.company_id) !== 1 && (c.id || c.company_id) !== "1");
  const targetId = target ? (target.id || target.company_id) : 165;
  const brandDel = await j(`/company/deleteCompany/${targetId}`, { method: "DELETE", headers: H });
  check(`brand delete /${targetId} challenges 403 brand_delete`, brandDel.status === 403 && brandDel.data?.code === "STEPUP_REQUIRED" && brandDel.data?.scope === "brand_delete", `${brandDel.status} ${brandDel.data?.code} ${brandDel.data?.scope}`);

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
