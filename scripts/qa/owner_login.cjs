/**
 * QA helper: mint a valid access token for the owner test account (user 1,
 * onarrival21@gmail.com, company_id=1) which is TOTP-2FA enrolled. We own this
 * test account, so we read its TOTP secret (read-only) and compute the current
 * code with otplib (the same lib the server verifies with), then complete the
 * login + /2fa/validate handshake.
 *
 * Run from anywhere:  node /app/scripts/qa/owner_login.cjs [BASE_URL]
 * Prints ONLY the access token on stdout (so it can be captured in a var).
 *
 * Then inject it in the browser before navigating:
 *   localStorage.setItem("token", "<token>")
 *   sessionStorage.setItem("mfa_interstitial_seen", "1")
 *   goto  <BASE>/pay-links
 */
const { execFileSync } = require("child_process");
const { generateSync } = require("/app/backend/node_modules/otplib");

const BASE = process.argv[2] || "https://secure-passphrase-6.preview.emergentagent.com";
const EMAIL = "onarrival21@gmail.com";
const PASSWORD = "Katiekendra123@";

const readSecret = () => {
  const out = execFileSync(
    "node",
    ["/app/backend/scripts/ro_query.js", "select secret from tbl_user_2fa where user_id=1"],
    { env: { ...process.env, RO_JSON: "1" }, encoding: "utf8" }
  );
  return JSON.parse(out)[0].secret;
};

const main = async () => {
  const secret = readSecret();
  const login = await fetch(`${BASE}/api/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());

  const data = login.data || {};
  if (!data.requires_2fa) {
    // Already logged in without a challenge (device cookie present server-side).
    if (data.accessToken) return process.stdout.write(data.accessToken);
    throw new Error("Unexpected login response: " + JSON.stringify(login));
  }
  const token = generateSync({ secret, strategy: "totp" });
  const val = await fetch(`${BASE}/api/user/2fa/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_token: data.challenge_token, token }),
  }).then((r) => r.json());

  const at = (val.data || {}).accessToken;
  if (!at) throw new Error("2fa/validate failed: " + JSON.stringify(val));
  process.stdout.write(at);
};

main().catch((e) => {
  console.error("owner_login error:", e.message);
  process.exit(1);
});
