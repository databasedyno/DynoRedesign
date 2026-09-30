/* eslint-disable no-console */
/**
 * Brevo account migration + monitoring helper (operational CLI).
 *
 * Moves sender-domain authentication and senders from an OLD Brevo account to a
 * NEW one using the Brevo REST API, and reports remaining send credits so you
 * can see when an account is about to hit its monthly limit.
 *
 * Brevo cannot "transfer" a domain between accounts — each account authenticates
 * a domain with its OWN DNS records. So this tool: reads the old account, creates
 * the same domains + senders in the new account, and prints the NEW DNS records
 * you must add at your DNS host, then can trigger authentication once they're live.
 *
 * KEYS (never hardcoded):
 *   OLD key  <- process.env.OLD_BREVO_KEY, else BREVO_API_KEY from backend/.env
 *   NEW key  <- process.env.NEW_BREVO_KEY   (required for anything touching the new account)
 *
 * USAGE (run from /app/backend):
 *   ts-node --transpile-only scripts/brevo_migrate.ts report            # read-only diff (default)
 *   ts-node --transpile-only scripts/brevo_migrate.ts apply             # create missing domains+senders in NEW
 *   ts-node --transpile-only scripts/brevo_migrate.ts dns [domain]      # show NEW account DNS records + status
 *   ts-node --transpile-only scripts/brevo_migrate.ts authenticate <domain|all>
 *   ts-node --transpile-only scripts/brevo_migrate.ts credits           # remaining send credits (both accounts)
 */

import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://api.brevo.com/v3";

function loadEnvKey(name: string): string | undefined {
  const envPath = path.join(__dirname, "..", ".env");
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      if (k === name) return t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const OLD_KEY = process.env.OLD_BREVO_KEY || loadEnvKey("BREVO_API_KEY");
const NEW_KEY = process.env.NEW_BREVO_KEY;

function mask(k?: string): string {
  if (!k) return "(missing)";
  return `${k.slice(0, 10)}…${k.slice(-4)} (${k.length} chars)`;
}

function client(key: string): AxiosInstance {
  return axios.create({
    baseURL: BASE,
    headers: { "api-key": key, accept: "application/json", "content-type": "application/json" },
    timeout: 20000,
    validateStatus: () => true, // we inspect status ourselves
  });
}

async function getAccount(c: AxiosInstance) {
  const r = await c.get("/account");
  return r;
}

function summariseCredits(account: any): string {
  if (!account || !Array.isArray(account.plan)) return "no plan array";
  const parts = account.plan.map((p: any) => {
    const bits = [`type=${p.type}`, `creditsType=${p.creditsType}`, `credits=${p.credits}`];
    if (p.startDate || p.endDate) bits.push(`period=${p.startDate || "?"}→${p.endDate || "?"}`);
    return `{ ${bits.join(", ")} }`;
  });
  const sendLimit = account.plan.find((p: any) => p.creditsType === "sendLimit");
  const head = sendLimit ? `SEND CREDITS REMAINING: ${sendLimit.credits}` : "no sendLimit plan entry";
  return `${head}\n     ${parts.join("\n     ")}`;
}

async function listDomains(c: AxiosInstance): Promise<any[]> {
  const r = await c.get("/senders/domains");
  if (r.status >= 400) throw new Error(`GET /senders/domains -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data?.domains || r.data || [];
}

async function listSenders(c: AxiosInstance): Promise<any[]> {
  const r = await c.get("/senders");
  if (r.status >= 400) throw new Error(`GET /senders -> ${r.status} ${JSON.stringify(r.data)}`);
  return r.data?.senders || [];
}

function domName(d: any): string {
  return (d?.domain_name || d?.domainName || d?.domain || d?.name || "").toLowerCase();
}

function printDnsRecords(records: any) {
  if (!records) {
    console.log("     (no dns_records in response)");
    return;
  }
  const keys = ["brevo_code", "dkim_record", "dkim1_record", "dkim2_record", "dmarc_record"];
  let printedAny = false;
  for (const k of keys) {
    const rec = records[k];
    if (!rec) continue;
    printedAny = true;
    console.log(
      `     • ${k.padEnd(13)} type=${rec.type || "TXT"}  host=${rec.host_name || rec.hostName || "@"}\n` +
        `       value=${rec.value}\n` +
        `       status=${rec.status === true ? "VERIFIED" : "pending"}`,
    );
  }
  if (!printedAny) console.log("     " + JSON.stringify(records));
}

async function cmdCredits() {
  console.log("── Brevo account credits ──────────────────────────────");
  const oc = client(OLD_KEY!);
  const oa = await getAccount(oc);
  console.log(`OLD account (${mask(OLD_KEY)}): HTTP ${oa.status}`);
  if (oa.status < 400) {
    console.log(`   email=${oa.data?.email}  company=${oa.data?.companyName || "-"}`);
    console.log("   " + summariseCredits(oa.data));
  } else {
    console.log("   " + JSON.stringify(oa.data));
  }
  if (NEW_KEY) {
    const na = await getAccount(client(NEW_KEY));
    console.log(`\nNEW account (${mask(NEW_KEY)}): HTTP ${na.status}`);
    if (na.status < 400) {
      console.log(`   email=${na.data?.email}  company=${na.data?.companyName || "-"}`);
      console.log("   " + summariseCredits(na.data));
    } else {
      console.log("   " + JSON.stringify(na.data));
    }
  } else {
    console.log("\nNEW account: (set NEW_BREVO_KEY to include it)");
  }
}

async function cmdReport() {
  await cmdCredits();
  console.log("\n── Domains ────────────────────────────────────────────");
  const oc = client(OLD_KEY!);
  const oldDomains = await listDomains(oc).catch((e) => {
    console.log("OLD domains error: " + e.message);
    return [] as any[];
  });
  console.log(`OLD account domains (${oldDomains.length}):`);
  for (const d of oldDomains) {
    console.log(`   - ${domName(d)}  authenticated=${d.authenticated}  verified=${d.verified}`);
  }

  const oldSenders = await listSenders(oc).catch((e) => {
    console.log("OLD senders error: " + e.message);
    return [] as any[];
  });
  console.log(`\nOLD account senders (${oldSenders.length}):`);
  for (const s of oldSenders) {
    console.log(`   - ${s.email}  name="${s.name}"  active=${s.active}`);
  }

  if (!NEW_KEY) {
    console.log("\n(no NEW_BREVO_KEY -> cannot diff against new account; showing old only)");
    return;
  }

  const nc = client(NEW_KEY);
  const newDomains = await listDomains(nc).catch(() => [] as any[]);
  const newSenders = await listSenders(nc).catch(() => [] as any[]);
  const newDomSet = new Set(newDomains.map(domName));
  const newSenderSet = new Set(newSenders.map((s: any) => String(s.email).toLowerCase()));

  const missingDomains = oldDomains.filter((d) => !newDomSet.has(domName(d)));
  const missingSenders = oldSenders.filter((s: any) => !newSenderSet.has(String(s.email).toLowerCase()));

  console.log("\n── Diff (present in OLD, missing in NEW) ──────────────");
  console.log(`Domains to create in NEW (${missingDomains.length}): ${missingDomains.map(domName).join(", ") || "none"}`);
  console.log(`Senders to create in NEW (${missingSenders.length}): ${missingSenders.map((s: any) => s.email).join(", ") || "none"}`);
  console.log("\nRun `apply` to create them in the NEW account and print the DNS records to add.");
}

async function cmdApply() {
  if (!NEW_KEY) throw new Error("NEW_BREVO_KEY is required for apply");
  const oc = client(OLD_KEY!);
  const nc = client(NEW_KEY);
  const oldDomains = await listDomains(oc);
  const oldSenders = await listSenders(oc);
  const newDomains = await listDomains(nc);
  const newSenders = await listSenders(nc);
  const newDomSet = new Set(newDomains.map(domName));
  const newSenderSet = new Set(newSenders.map((s: any) => String(s.email).toLowerCase()));

  console.log("── Creating domains in NEW account ─────────────────────");
  for (const d of oldDomains) {
    const name = domName(d);
    if (!name) continue;
    if (newDomSet.has(name)) {
      console.log(`\n= ${name}: already exists in NEW — fetching its DNS records`);
      const cfg = await nc.get(`/senders/domains/${encodeURIComponent(name)}`);
      printDnsRecords(cfg.data?.dns_records || cfg.data);
      continue;
    }
    const r = await nc.post("/senders/domains", { name });
    if (r.status >= 400) {
      console.log(`\n! ${name}: create failed HTTP ${r.status} ${JSON.stringify(r.data)}`);
      continue;
    }
    console.log(`\n+ ${name}: created in NEW account. Add these DNS records at your DNS host:`);
    printDnsRecords(r.data?.dns_records || r.data);
  }

  console.log("\n── Creating senders in NEW account ─────────────────────");
  for (const s of oldSenders) {
    const email = String(s.email || "").toLowerCase();
    if (!email) continue;
    if (newSenderSet.has(email)) {
      console.log(`= ${email}: already exists in NEW`);
      continue;
    }
    const r = await nc.post("/senders", { name: s.name || email, email });
    if (r.status >= 400) {
      console.log(`! ${email}: create failed HTTP ${r.status} ${JSON.stringify(r.data)}`);
    } else {
      console.log(`+ ${email}: created (Brevo will send a verification email unless the domain is already authenticated)`);
    }
  }
  console.log("\nNext: add the DNS records above, then run `authenticate all`.");
}

async function cmdDns(domain?: string) {
  if (!NEW_KEY) throw new Error("NEW_BREVO_KEY is required");
  const nc = client(NEW_KEY);
  const domains = domain ? [{ name: domain }] : await listDomains(nc);
  for (const d of domains) {
    const name = domName(d) || domain!;
    const cfg = await nc.get(`/senders/domains/${encodeURIComponent(name)}`);
    console.log(`\n── ${name} (HTTP ${cfg.status}) ──`);
    if (cfg.status >= 400) {
      console.log("   " + JSON.stringify(cfg.data));
      continue;
    }
    console.log(`   authenticated=${cfg.data?.authenticated}  verified=${cfg.data?.verified}`);
    printDnsRecords(cfg.data?.dns_records || cfg.data);
  }
}

async function cmdAuthenticate(target?: string) {
  if (!NEW_KEY) throw new Error("NEW_BREVO_KEY is required");
  if (!target) throw new Error("usage: authenticate <domain|all>");
  const nc = client(NEW_KEY);
  const domains =
    target === "all" ? (await listDomains(nc)).map(domName).filter(Boolean) : [target.toLowerCase()];
  for (const name of domains) {
    const r = await nc.put(`/senders/domains/${encodeURIComponent(name)}/authenticate`, {});
    console.log(`authenticate ${name} -> HTTP ${r.status} ${JSON.stringify(r.data)}`);
  }
}

async function main() {
  const cmd = (process.argv[2] || "report").toLowerCase();
  console.log(`Brevo migrate :: cmd=${cmd}`);
  console.log(`OLD key: ${mask(OLD_KEY)}   NEW key: ${mask(NEW_KEY)}\n`);
  if (!OLD_KEY) throw new Error("OLD key missing (BREVO_API_KEY not in backend/.env and OLD_BREVO_KEY unset)");

  switch (cmd) {
    case "report":
      await cmdReport();
      break;
    case "credits":
      await cmdCredits();
      break;
    case "apply":
      await cmdApply();
      break;
    case "dns":
      await cmdDns(process.argv[3]);
      break;
    case "authenticate":
      await cmdAuthenticate(process.argv[3]);
      break;
    default:
      console.log("unknown command. use: report | credits | apply | dns [domain] | authenticate <domain|all>");
      process.exit(2);
  }
}

main().catch((e) => {
  console.error("FATAL:", e?.message || e);
  process.exit(1);
});
