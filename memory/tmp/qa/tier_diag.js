// QA diagnostic — create a reward tier on campaign 723 via the real API, list, then
// (optionally) delete. Run from /app/backend with: node -r dotenv/config /app/memory/tmp/qa/tier_diag.js <action>
const fs = require("fs");
const action = process.argv[2] || "create";
const raw = fs.readFileSync("/app/memory/tmp/merchant_token.txt", "utf8");
const JWT = (raw.match(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/) || [])[0];
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const base = "http://localhost:8001/api";

(async () => {
  const h = { Authorization: "Bearer " + JWT, "User-Agent": UA, "Content-Type": "application/json" };
  if (action === "create") {
    const r = await fetch(base + "/pay/campaign/723/tiers", {
      method: "POST", headers: h,
      body: JSON.stringify({ title: "QA Tier A", min_amount: 25, description: "QA diagnostic tier" }),
    });
    const j = await r.json().catch(() => ({}));
    console.log("POST createTier status", r.status, JSON.stringify(j).slice(0, 400));
  }
  const r2 = await fetch(base + "/pay/campaign/723/tiers", { headers: { "User-Agent": UA } });
  const j2 = await r2.json().catch(() => ({}));
  const data = j2.data || [];
  console.log("GET listTiers status", r2.status, "count:", data.length, JSON.stringify(data).slice(0, 500));
  if (action === "delete") {
    for (const t of data) {
      if (t.title === "QA Tier A") {
        const rd = await fetch(base + "/pay/tier/" + t.tier_id, { method: "DELETE", headers: h });
        console.log("DELETE tier", t.tier_id, "status", rd.status);
      }
    }
  }
})().catch((e) => console.log("ERR", e.message));
