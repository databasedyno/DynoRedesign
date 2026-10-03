/**
 * One-off diagnostic for the "SMADAV payment emails don't arrive" report.
 *
 * For each address it:
 *   1) reports our own deliverability flag (Redis: suppressed / unreachable),
 *   2) sends a REAL test email via Brevo and prints messageId or the exact error.
 *
 * Usage:
 *   cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/smadav_email_test.ts
 *   (optionally pass addresses:  ... smadav_email_test.ts a@b.com c@d.com)
 */
import "dotenv/config";
import { raw as envRaw } from "../utils/config";
import { getDeliveryBlock } from "../services/email/deliverability";
import { sendViaBrevo, EmailJobData } from "../services/email/emailQueue";

const ADDRS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["onarrival21@gmail.com", "smadav@dyno.pt"];

const senderEmail = envRaw("BREVO_SENDER_EMAIL") || "hi@dynopay.com";
const stamp = new Date().toISOString();

const body = (to: string) => `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif">
  <h2>Dynopay delivery test</h2>
  <p>This is a one-off delivery test sent at ${stamp}.</p>
  <p>Recipient under test: <strong>${to}</strong></p>
  <p>If you received this, Brevo can deliver to this mailbox from ${senderEmail}.</p>
</body></html>`;

(async () => {
  console.log(`\nBrevo sender: ${senderEmail}`);
  console.log(`BREVO_API_KEY present: ${!!envRaw("BREVO_API_KEY")}`);
  for (const to of ADDRS) {
    console.log(`\n===== ${to} =====`);
    try {
      const block = await getDeliveryBlock(to);
      console.log(`  our deliverability flag: ${block ? `${block.kind} (event=${block.event}, reason=${block.reason}, at=${block.at})` : "none (healthy)"}`);
    } catch (e) {
      console.log(`  deliverability check failed: ${(e as Error).message}`);
    }

    const job: EmailJobData = {
      to,
      name: to,
      subject: `Dynopay delivery test — ${to} — ${stamp}`,
      body: body(to),
      sender: { name: "Dynopay", email: senderEmail },
      lane: "default",
      logId: null,
    };
    try {
      const { messageId } = await sendViaBrevo(job);
      console.log(`  BREVO ACCEPTED ✅  messageId=${messageId}`);
    } catch (e) {
      const err = e as { status?: number; code?: string; message?: string };
      console.log(`  BREVO REJECTED ❌  status=${err.status} code=${err.code} message=${err.message}`);
    }
  }
  console.log("\nDone. 'ACCEPTED' = Brevo queued it for delivery (a later hard bounce can still occur and would show in Brevo → Transactional → Logs). 'REJECTED' = Brevo refused the API call outright (e.g. recipient blocklisted / sender blocked).");
  process.exit(0);
})();
