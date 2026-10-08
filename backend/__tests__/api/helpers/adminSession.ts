/**
 * Shared helpers for the live-server integration suite (__tests__/api).
 * ⚠️ The preview server is wired to the LIVE prod DB: anything that writes rows or pings
 * external channels runs only with INTEGRATION_ALLOW_WRITES=true (see `itWrites`).
 */
import { execFileSync } from "child_process";
import path from "path";
import supertest from "supertest";

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8001";
export const request = supertest(BASE_URL);
export const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "moxxcompany@gmail.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "Katiekendra123@";
const ADMIN_ID = process.env.TEST_ADMIN_ID || "1";

/** Tests with side effects (new users, persisted notifications, real Slack/Discord alerts). */
export const itWrites = process.env.INTEGRATION_ALLOW_WRITES === "true" ? it : it.skip;

const currentTotp = (): string =>
  execFileSync("node", [path.join(__dirname, "..", "..", "..", "scripts", "admin_2fa.cjs"), "totp", ADMIN_ID], { encoding: "utf8" }).trim();

/** Two-step admin login (password → TOTP, SEC-002). TEST_ADMIN_TOKEN skips the round-trip. */
export async function adminLogin(): Promise<string> {
  if (process.env.TEST_ADMIN_TOKEN) return process.env.TEST_ADMIN_TOKEN;
  const pw = await request.post("/api/admin/login/password").set("User-Agent", BROWSER_UA).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (pw.status !== 200) throw new Error(`admin password step → ${pw.status} ${pw.body?.message || ""}`);
  const step = pw.body.data || {};
  if (step.status === "OK" && step.accessToken) return step.accessToken;
  if (step.status !== "TOTP_REQUIRED" || !step.challengeToken) throw new Error(`admin login needs ${step.status} — enroll TOTP first`);
  const totp = await request
    .post("/api/admin/login/totp")
    .set("User-Agent", BROWSER_UA)
    .send({ challengeToken: step.challengeToken, code: currentTotp(), trustDevice: false });
  if (totp.status !== 200 || !totp.body.data?.accessToken) throw new Error(`admin TOTP step → ${totp.status} ${totp.body?.message || ""}`);
  return totp.body.data.accessToken;
}
