// READ-ONLY: log into the PROD admin API (TOTP) and tail the live log console (SSE) for N seconds.
// Usage: node prod_admin_logtail.cjs <seconds>
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const BASE = process.env.PROD_API || "https://dynopay.com/api";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const creds = { email: "moxxcompany@gmail.com", password: "Katiekendra123@" };
const secs = Number(process.argv[2] || 90);

(async () => {
  const H = { "Content-Type": "application/json", "User-Agent": UA, Accept: "application/json" };
  let token = null;
  try { token = fs.readFileSync("/app/memory/tmp/prod_admin_token.txt", "utf8").trim() || null; } catch {}
  const ok = token && (await fetch(`${BASE}/admin/logs/health`, { headers: { ...H, Authorization: `Bearer ${token}` } })).status === 200;
  if (!ok) {
    const r1 = await fetch(`${BASE}/admin/login/password`, { method: "POST", headers: H, body: JSON.stringify(creds) });
    const j1 = await r1.json();
    const challengeToken = j1?.data?.challengeToken;
    if (!challengeToken) { console.error("password step failed", r1.status, JSON.stringify(j1).slice(0, 200)); process.exit(1); }
    const code = execSync("cd /app/backend && node scripts/admin_2fa.cjs totp 1", { encoding: "utf8" }).trim().split(/\s+/).pop();
    const r2 = await fetch(`${BASE}/admin/login/totp`, { method: "POST", headers: H, body: JSON.stringify({ challengeToken, code }) });
    const j2 = await r2.json();
    token = j2?.data?.accessToken;
    if (!token) { console.error("totp step failed", r2.status, JSON.stringify(j2).slice(0, 200)); process.exit(1); }
    fs.writeFileSync("/app/memory/tmp/prod_admin_token.txt", token);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), secs * 1000);
  const out = fs.createWriteStream("/app/memory/tmp/prod_log_tail.ndjson", { flags: "a" });
  let n = 0;
  try {
    const res = await fetch(`${BASE}/admin/logs/stream`, { headers: { "User-Agent": UA, Authorization: `Bearer ${token}`, Accept: "text/event-stream" }, signal: ctrl.signal });
    console.log("stream status", res.status);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const ev = (chunk.match(/^event: (.*)$/m) || [])[1]; const data = (chunk.match(/^data: (.*)$/m) || [])[1];
        if (!ev || !data) continue;
        if (ev === "backfill") { const logs = JSON.parse(data).logs || []; for (const l of logs) { out.write(JSON.stringify({ src: "backfill", ...l }) + "\n"); n++; } }
        else if (ev === "log") { out.write(JSON.stringify({ src: "live", ...JSON.parse(data) }) + "\n"); n++; }
        else if (ev === "health") { const h = JSON.parse(data); console.log("health:", JSON.stringify(h).slice(0, 300)); }
      }
    }
  } catch (e) { if (e.name !== "AbortError") console.error("stream error", e.message); }
  out.end();
  console.log("captured log lines:", n);
})();
