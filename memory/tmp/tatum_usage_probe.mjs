// Read-only probe: Tatum credit usage (daily) + active subscription inventory.
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync("/app/backend/.env", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const key = env.TATUM_TESTNET === "true" ? env.TATUM_TESTNET_KEY : (env.TATUM_KEY || env.TATUM_SECRET_KEY);
const H = { "x-api-key": key };

const usage = await fetch("https://api.tatum.io/v3/tatum/usage", { headers: H }).then((r) => r.json());
console.log("USAGE (last days):");
for (const d of (Array.isArray(usage) ? usage : []).slice(-21)) console.log(`  ${d.day}  ${d.usage}`);

let offset = 0, all = [];
while (true) {
  const page = await fetch(`https://api.tatum.io/v4/subscription?pageSize=50&offset=${offset}`, { headers: H }).then((r) => r.json());
  if (!Array.isArray(page) || page.length === 0) break;
  all.push(...page); offset += 50;
  if (offset > 5000) break;
}
console.log(`\nSUBSCRIPTIONS total=${all.length}`);
const by = (fn) => Object.entries(all.reduce((a, s) => { const k = fn(s); a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
console.log("by type:", by((s) => s.type));
console.log("by chain:", by((s) => s.attr?.chain || "?"));
console.log("by url host:", by((s) => { try { return new URL(s.attr?.url || "").host; } catch { return "?"; } }));
fs.writeFileSync("/app/memory/tmp/tatum_subs_snapshot.json", JSON.stringify(all.map((s) => ({ id: s.id, type: s.type, chain: s.attr?.chain, address: s.attr?.address, url: s.attr?.url })), null, 0));
