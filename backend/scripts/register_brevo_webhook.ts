/**
 * Register (or update) the Dynopay Brevo transactional webhook.
 *   cd backend && node_modules/.bin/ts-node --transpile-only scripts/register_brevo_webhook.ts [--base https://dynopay.com/api] [--dry]
 * Uses BREVO_API_KEY from backend/.env; the URL token is derived from the same key (see brevoEvents.ts).
 */
import "dotenv/config";
import axios from "axios";
import { brevoWebhookToken } from "../services/email/brevoEvents";

const EVENTS = ["delivered", "hardBounce", "softBounce", "blocked", "spam", "invalid", "deferred", "unsubscribed", "error"];
const DESCRIPTION = "Dynopay delivery + bounce tracking";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

(async () => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY missing");
  const base = (arg("--base") || "https://dynopay.com/api").replace(/\/$/, "");
  const url = `${base}/webhooks/brevo?token=${brevoWebhookToken()}`;
  const http = axios.create({ baseURL: "https://api.brevo.com/v3", headers: { "api-key": apiKey }, timeout: 15000 });

  const data = await http
    .get("/webhooks", { params: { type: "transactional" } })
    .then((r) => r.data)
    .catch((e) => (e?.response?.data?.code === "document_not_found" ? { webhooks: [] } : Promise.reject(e)));
  const existing = (data?.webhooks || []).find((w: { url: string; description?: string }) => w.url.split("?")[0] === url.split("?")[0] || w.description === DESCRIPTION);
  console.log(`Target URL: ${url.replace(/token=.*/, "token=<redacted>")}`);
  if (process.argv.includes("--dry")) {
    console.log(existing ? `Would UPDATE webhook #${existing.id}` : "Would CREATE webhook");
    return;
  }
  if (existing) {
    await http.put(`/webhooks/${existing.id}`, { url, events: EVENTS, description: DESCRIPTION });
    console.log(`Updated Brevo webhook #${existing.id}`);
  } else {
    const res = await http.post("/webhooks", { url, events: EVENTS, type: "transactional", description: DESCRIPTION });
    console.log(`Created Brevo webhook #${res.data?.id}`);
  }
})().catch((e) => {
  console.error("Brevo webhook registration failed:", e?.response?.data || e.message);
  process.exit(1);
});
