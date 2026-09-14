# DigitalOcean Environment Variables Audit

**Date:** 2026-02-XX  
**Scope:** Cross-reference of backend codebase `process.env.*` usage vs DO App Spec (`app.yaml`)

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Variables added to DO spec | 8 | CORS, TELNYX_PHONE_NUMBER, VAPID x3, SLACK, DISCORD |
| Variables in code but NOT in .env or DO (optional) | 13 | See "Low Priority" below |
| Variables in DO spec not directly referenced in code | ~47 | Most are accessed dynamically (FEE_TIER, SWEEP, etc.) - KEEP |

---

## CRITICAL - Added to DO App Spec

### `CORS_ALLOWED_ORIGINS` (P0)
- **Impact:** Without this, CORS falls back to auto-building from `FRONTEND_URL` + `CHECKOUT_URL`. Explicit config is safer for production with custom domains.
- **Current .env value:** `https://dynopay.com,https://checkout.dynopay.com`
- **DO Action:** Set to your actual domains (e.g., `https://dynopay.com,https://checkout.dynopay.com`)

### `TELNYX_PHONE_NUMBER` (P1)
- **Impact:** Phone verification will fail without this.
- **DO Action:** Set to your Telnyx phone number.

### `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (P2)
- **Impact:** Web push notifications will be disabled without these. App runs fine otherwise.
- **DO Action:** Generate VAPID keys with `npx web-push generate-vapid-keys` and set them.

### `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` (P3 - Optional)
- **Impact:** Alert notifications to Slack/Discord channels disabled. No runtime errors.
- **DO Action:** Set if you have alert channels configured. Leave empty to skip.

---

## MEDIUM PRIORITY - In Code but Missing from BOTH .env and DO

These variables are referenced in the codebase but have **graceful fallbacks** or are only used in **scripts** (not runtime services):

| Variable | Where Used | Fallback | Action |
|----------|-----------|----------|--------|
| `USDT_TRC20_ADMIN_WALLET` | `merchantPoolConfig.ts` | Falls back to `USDT_TRC20` | Safe to skip |
| `USDT_ERC20_ADMIN_WALLET` | `merchantPoolConfig.ts` | Falls back to `USDT_ERC20` | Safe to skip |
| `ETH_ADMIN_WALLET` | Archived recovery script only | Hardcoded fallback | Safe to skip |
| `TRX_FEE_WALLET_ADDRESS` | Recovery script only | N/A (script-only) | Safe to skip |
| `TRX_FEE_WALLET_PRIVATE_KEY` | Recovery script only | N/A (script-only) | Safe to skip |
| `USDT_TRC20_ENCRYPTED_KEY` | Sweep encryption | N/A | Add if using TRC20 sweep encryption |
| `VERIFY_ENCRYPTED_KEY` | Encryption service | N/A | Add if using verification encryption |
| `WEBHOOK_SECRET` | Generic webhook handler | N/A | Add if using custom webhook verification |
| `WEBHOOK_URL` | Webhook dispatch | N/A | Add if using outbound webhooks |
| `DYNOPAY_WEBHOOK_SECRET` | Webhook verification | N/A | Add if verifying DynoPay webhooks |
| `SMTP_USER` | Email fallback | Brevo handles email | Safe to skip |
| `SSH_TUNNEL_PORT` | SSH tunnel config | Defaults to 22 | Safe to skip |
| `GCP_PROJECT_ID` | GCP integration | `PROJECT_ID` is used instead | Safe to skip |
| `ALERT_CHANNEL` | Alert routing | N/A | Safe to skip |

---

## Variables in DO Spec That Appear "Unused" (But ARE Used)

These are accessed via **dynamic key construction** (`process.env[\`${...}_SWEEP\`]`, `process.env[\`FEE_TIER_${n}_MIN\`]`, etc.):

- `ETH_SWEEP`, `POLYGON_SWEEP`, `TRX_SWEEP`, `SOL_SWEEP`, `XRP_SWEEP` — Used by `merchantPoolConfig.ts:parseSweepConfig()`
- `*_THRESHOLD` — Used by threshold test controller and sweep logic
- `*_SWEEP` — All token sweep configs accessed dynamically
- `FEE_TIER_*` — Accessed via `feeConfigUtils.ts` loop
- `TRIAL_*` — Used by fee-free service
- `NEXT_PUBLIC_*`, `NEXTAUTH_*` — Inlined at Next.js build time (frontend)
- `BINANCE_SECRET_KEY` — Alias for `BINANCE_API_SECRET`, used in recommended check
- `INFOBIP_API_KEY` — SMS provider
- `BLOCK_BEE_API_KEY`, `CRYPTO_PUBLIC_KEY`, `CUSTOMER_ID`, `PROFILE_ID` — Various integrations

**Verdict:** KEEP ALL of these in the DO spec.

---

## Checklist for DO Dashboard Setup

After deploying, go to **DO Dashboard > Apps > dynopay-onboarding > Settings > App-Level Env Vars** and ensure:

- [ ] All `REPLACE_ME` values are filled with actual secrets
- [ ] `CORS_ALLOWED_ORIGINS` matches your production domains
- [ ] `NEXT_PUBLIC_BASE_URL` has trailing slash: `https://dynopay.com/`
- [ ] `NEXTAUTH_URL` matches your root domain (no trailing slash)
- [ ] `NEXTAUTH_SECRET` is a strong random string (min 32 chars)
- [ ] `SERVER_URL` / `FRONTEND_URL` / `CHECKOUT_URL` point to correct DO/custom domains
- [ ] `HOST` / `DB_PORT` / `DB_NAME` / `USER_NAME` / `PASSWORD` match your Railway PostgreSQL
- [ ] `REDIS_PUBLIC_URL` matches your Railway Redis
- [ ] `GOOGLE_CLIENT_KEY` PEM is pasted with `\n` line breaks intact
- [ ] VAPID keys are generated and set (if push notifications needed)

---

## Required Variables for Backend Startup

The backend `envValidator.ts` checks these on boot — app will **crash without them**:

```
DB_NAME, USER_NAME, PASSWORD, HOST, DB_PORT,
REDIS_PUBLIC_URL, ACCESS_TOKEN_SECRET, API_SECRET,
TATUM_KEY, SERVER_URL, FRONTEND_URL
```

**Recommended (warns but doesn't crash):**
```
ADMIN_EMAIL, BREVO_API_KEY, TATUM_WEBHOOK_SECRET,
BINANCE_API_KEY, BINANCE_SECRET_KEY
```
