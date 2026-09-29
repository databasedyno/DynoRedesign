# Dynopay — Whole-Platform Security Audit (read-only) — 2026-09-30

Scope: backend Express API (/app/backend), Next.js frontend (/app root), CI/Docker/env handling.
Method: security_audit_agent (read-only code + config review, non-mutating GET probes against localhost:8001 with NODE_ENV=production) + main-agent verification of the items the auditor left UNVERIFIED (admin 2FA, key custody, SafeDeal/refund authz, `yarn audit`). No files modified, no DB writes.

## 1. Executive verdict

**Status: CONDITIONAL PASS — above average, not yet OWASP ASVS Level 2.**

Dynopay's merchant-facing security is genuinely solid for a crypto payment processor: bcrypt(12) passwords, signed JWTs with server-side revocation (`tokens_valid_after`), TOTP/email/SMS step-up on every payout-wallet mutation and contact change, parameterized SQL throughout, SSRF-guarded outbound webhooks with HMAC v1/v2 signing, per-key CORS, CSRF double-submit, company-scoped merchant API, atomic wallet debits, on-chain verification gate before crediting deposits, KMS-backed key custody with an audited single decryption boundary, AML velocity limits on SafeDeal cashouts, test/debug routers 404'd in production, 0 frontend dependency vulnerabilities.

What keeps it short of "industry standard" (ASVS L2 / typical PSP control set):
1. **The admin console — the most privileged surface, with fund-moving actions — is protected by a password alone**: no 2FA, a 30-day bearer token, no revocation, no step-up. (HIGH)
2. **Inbound deposit webhooks without a signature are still accepted from any IP** (flagged, not rejected). (MEDIUM)
3. A hard-coded QA-console passcode is live because the env override is not set. (LOW)

No CONFIRMED critical funds-theft or merchant account-takeover path was found.

## 2. Scorecard

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | AuthN — merchants | OK | bcrypt(12), TOTP/email 2FA w/ trusted-browser skip, lockout service, revocation via tokens_valid_after, step-up on sensitive ops |
| 1b | AuthN — admin console | **GAP (HIGH)** | password-only login, 30d JWT, no 2FA, no revocation — see SEC-002 |
| 2 | AuthZ / IDOR | OK (spot-checked) | company scoping, team permissions, SafeDeal `resolveActor` role checks, refund ownership by merchant_user_id, admin routes behind adminAuthMiddleware |
| 3 | Test/debug surface in prod | OK / GAP (LOW) | testRouter/paymentTestHook/sandbox 404 under NODE_ENV=production (probed); qualityRouter mounted unconditionally w/ fallback passcode — SEC-003 |
| 4 | Injection (SQLi/XSS/SSRF/path) | OK / hardening | parameterized SQL; markdown escape-first; SSRF guard on webhook URLs; regex HTML sanitizer for admin-authored HTML is bypass-prone (H-1) |
| 5 | Money-movement integrity | OK / GAP (LOW) | idempotency + atomic debit on merchant paths; admin/API customer-wallet credit/debit is non-atomic — SEC-004; live refunds hard-gated behind REFUND_FORWARDING_WIRED |
| 6 | Webhooks & integrations | **GAP (MEDIUM)** | outbound signing OK; inbound Tatum unsigned-allow branch — SEC-001; key custody = Google Cloud KMS symmetric keys, single audited boundary (OK) |
| 7 | Transport & headers | OK / hardening | helmet, HSTS, per-key CORS, CSRF double-submit, trust proxy 1; CSP allows unsafe-inline/unsafe-eval (H-3) |
| 8 | Secrets & config | OK | no .env in git, encrypted env vault, pre-commit secrets hook, KMS for private keys, plaintext keys never logged |
| 9 | Dependencies & supply chain | OK / LOW | FE `yarn audit`: 0. BE: 1 moderate (nodemailer <10.0.2) — SEC-005; lockfiles present; frozen-lockfile installs in Docker/CI |
| 10 | Frontend | hardening | access token in localStorage (30d) — H-2; admin pages gated server-side by adminAuthMiddleware on every API call |
| 11 | Logging / monitoring | OK | securityEventService, Slack/security alerts, admin mixer alerts, incident-playbook.md present |
| 12 | AML / KYC / data lifecycle | OK | $200 single / $1k-24h SafeDeal cashout limits + zero-deal mixer alert, KYC volume enforcement, purge services admin-gated |

## 3. Findings (severity-ranked)

### SEC-002 · HIGH · Admin console: password-only login, 30-day non-revocable token, no step-up  (CONFIRMED)
- CWE-308 / CWE-613 · OWASP A07 (Identification & Authentication Failures) · ASVS 2.2, 3.3
- Evidence:
  - `backend/controller/adminController.ts:314-372` — `login`: email+password (bcrypt, legacy SHA-256 auto-migrate) → `jwt.sign({email, role:"ADMIN"}, ACCESS_TOKEN_SECRET, {expiresIn:"30d"})`. No second factor, no session record, no device binding.
  - `backend/routes/adminRouter.ts:12` — only `loginRateLimiter` in front of `/admin/login`; no account lockout (merchant login has `accountLockoutService`).
  - `backend/middleware/adminAuthMiddleware.ts:26-44` — verifies signature + `role==="ADMIN"` only. Unlike `authMiddleware.ts:139-159` it does NOT check `tokens_valid_after` / session revocation, so "sign out everywhere" and password change do not invalidate admin tokens.
  - `pages/admin/login.tsx:79` — the admin UI uses exactly this endpoint; token stored client-side for 30 days.
  - Fund-moving admin actions behind this token: manual customer-wallet CREDIT/DEBIT (`adminController.ts:1182-1211`, `1332-1372`), `server.ts:554 recover-payment`, `diagnosticsRouter.ts:451 binance-sell`, SafeDeal withdrawal approvals, dispute arbitration (`escrowRouter.ts`).
- Exploit: phished/keylogged/reused admin password → full console for 30 days; or any leak of an admin JWT (browser extension, log, XSS) → fund movement with no way to cut it off short of rotating `ACCESS_TOKEN_SECRET` (which also logs out every merchant).
- Fix (M): (1) mandatory TOTP for `tbl_admin` (add `totp_secret`, enroll on first login, verify on every login — reuse `twoFactorEnrollController` / `stepUpService`); (2) issue short-lived admin tokens (≤12h) and record them in the session store; make `adminAuthMiddleware` consult `isSessionRevoked` / a per-admin `tokens_valid_after`; (3) wrap fund-moving admin routes in `requireStepUp("security")`; (4) add `accountLockoutService` to admin login; (5) emit `securityEventService` events for admin login/failed login/credit/debit.
- Related minor: admin email-change confirms OTP with loose `storedOtp.otp != otp` and dereferences `storedOtp` without a null check (`adminController.ts:601-603`).

### SEC-001 · MEDIUM · Unsigned inbound Tatum deposit webhooks accepted from any IP  (LIKELY)
- CWE-345 · OWASP A08 (Software & Data Integrity) · ASVS 13.2
- Evidence: `backend/routes/index.ts:91-126` — when `x-payload-hash` is absent the request is "allowed but flagged" regardless of source IP; the allow-list uses exact string match so range entries such as `34.82.0.0` never match anything. `backend/webhooks/index.ts:643-683` — legacy `tatumWebHook` sets the Redis checkout status to PAYOUT_COMPLETE for any `amount > 0`.
- Boundary: the main crediting path (`tatumCryptoWebHook` → worker) is protected by the on-chain verification gate shipped 2026-09-27, so forged events cannot credit a wallet. Whether the legacy Redis status flip alone can mark a checkout tab "paid" (and e.g. trigger storefront fulfilment or a customer-visible success state) was not fully traced — treat as LIKELY.
- Fix (S/M): reject events without a valid signature (fail closed) once all Tatum subscriptions carry `TATUM_WEBHOOK_SECRET`; until then enforce a real CIDR allow-list; add a replay window (timestamp + seen-txId cache); retire or gate the legacy `tatumWebHook` handler.

### SEC-003 · LOW · Hard-coded QA console passcode live in production  (CONFIRMED)
- CWE-798 · OWASP A07
- Evidence: `backend/routes/qualityRouter.ts:15` `QA_PASSCODE = process.env.QA_PASSCODE || "<literal>"`; `QA_PASSCODE` is not set in `backend/.env` → the source literal is active. Router mounted unconditionally at `/api/quality` (`routes/index.ts:418`); passcode also accepted via query string (ends up in access logs).
- Impact: read/write/delete internal QA catalog & notes only — no funds/PII/credentials.
- Fix (S): fail closed when `QA_PASSCODE` is unset (or mount only when `NODE_ENV!=="production"`); header-only.

### SEC-004 · LOW · Non-atomic customer-wallet credit/debit on admin + merchant-API paths  (CONFIRMED)
- CWE-362 · OWASP A04
- Evidence: `backend/controller/adminController.ts:1182-1211` and `1332-1372` — balance SELECTed before `sequelize.transaction`, then `newBalance` written; no `FOR UPDATE` / conditional `UPDATE … SET amount = amount ± :delta`. (Merchant checkout/withdrawal paths were already fixed 2026-09-29.)
- Impact: concurrent adjustments → lost update / balance drift; scoped to the caller's own company customers.
- Fix (S): move the read inside the transaction with row lock, or use the delta-update pattern from `useWallet`.

### SEC-005 · LOW · Vulnerable dependency: nodemailer < 10.0.2  (CONFIRMED via `yarn audit`)
- Advisory: process-global DNS cache reuses TLS `servername` across transports → cross-tenant SMTP credential disclosure. Dynopay uses one SMTP tenant, so practical impact is low.
- Fix (S): `cd backend && yarn upgrade nodemailer@^10.0.2` (check `services/emailService.ts` API compatibility). Frontend `yarn audit`: 0 vulnerabilities.

### Hardening (INFO / P3)
- H-1 `backend/utils/sanitizeHtml.ts` regex sanitizer keeps `style`/`src` and is bypass-prone; used only for admin-authored blog/help HTML. Product/donation markdown is escape-first (safe). → swap to DOMPurify (server-side via jsdom) or sanitize-html with a strict allow-list.
- H-2 Merchant access tokens live in `localStorage` with 30-day expiry (`axiosConfig.ts`); XSS = token exfiltration. Revocation exists, but consider httpOnly cookie refresh + short (≤1h) access tokens.
- H-3 CSP allows `'unsafe-inline'` + `'unsafe-eval'` (`backend/server.ts:257`) → nonce-based CSP for the Next app.
- H-4 Redis checkout-session keys without TTL (already on the owner's backlog).
- H-5 Refund creation is owner-only (team members cannot refund) and has no step-up — acceptable while live refunds are hard-gated behind `REFUND_FORWARDING_WIRED`; add `requireStepUp` before enabling live refunds.

## 4. Already solid (keep)
- Merchant auth: bcrypt(12), TOTP/email second factor with trusted-browser skip, account lockout, `tokens_valid_after` revocation, "sign out everywhere".
- Step-up (`requireStepUp`) + owner-only guards on payout-wallet add/edit/delete, contact changes, SafeDeal email change (+ session kill + 24h cashout hold).
- Key custody: private keys encrypted with Google Cloud KMS symmetric keys (`apis/tatumApi.ts:117-175`); `services/keyCustody/keyCustodyService.ts` is the single decryption boundary with an audit row per decrypt (sha256 of ciphertext only, plaintext never logged) and `withPrivateKey` scrubbing.
- Deposits: on-chain verification gate before any credit/webhook; settlement idempotency + auto-recovery; atomic conditional wallet debit.
- Outbound webhooks: HMAC v1/v2 with timestamp, SSRF guard (loopback/link-local/mapped-IPv6), per-target retry via outbox.
- Merchant API: publishable vs secret key separation, company-scoped, per-key CORS, usage logging.
- Input: parameterized SQL everywhere sampled; Joi/validateRequest; xss() on stored markdown; handle-segment regex before SSR fetches.
- Edge: helmet, HSTS, trust proxy = 1 with rate limiters keyed on the real client IP, bot/scanner path blocking, CSRF double-submit, body limits.
- Prod hygiene: test/sandbox/hook routers 404 under NODE_ENV=production (probed), no `.env` in git, encrypted vault, pre-commit secrets scan, frozen-lockfile Docker builds, canary→swap deploys with rollback workflow.
- AML/KYC: $200 single-cashout admin approval, $1k/24h rolling limit with hold reason, zero-deal mixer alert, KYC volume enforcement.

## 5. Top-5 remediation plan
1. **Admin 2FA + short-lived, revocable admin sessions + step-up on fund-moving admin routes** (SEC-002) — effort M — closes the only HIGH.
2. **Fail-closed inbound webhook auth** (SEC-001) — effort S/M — verify every Tatum subscription sends the secret, then delete the allow-unsigned branch; fix CIDR matching; retire legacy handler.
3. **QA passcode fail-closed / dev-only mount** (SEC-003) — effort S.
4. **Atomic admin/API customer-wallet adjustments** (SEC-004) — effort S.
5. **nodemailer upgrade + DOMPurify for admin HTML + nonce CSP** (SEC-005, H-1, H-3) — effort S/M.

After 1–2 are shipped Dynopay would credibly meet OWASP ASVS L2 for its money and identity paths.

## 6. Coverage & limits
Reviewed: server bootstrap, all auth middlewares, step-up, wallet/customer-wallet/payout/refund money paths, SafeDeal controller authz (spot-check), inbound/outbound webhooks, key custody, test/quality/sandbox/diagnostics routers, frontend token storage & XSS sinks, .env/git hygiene, CI workflows, `yarn audit` (FE + BE).
Not exhaustively traced: every SafeDeal state transition (release/dispute/cancel per party — `resolveActor` pattern looked correct in the sampled handlers), escrow admin arbitration flows, Binance cashout controls beyond velocity limits, Dockerfile user/privileges, GitHub Actions pinning by SHA. Items above are evidence-based; anything not listed was not verified.
