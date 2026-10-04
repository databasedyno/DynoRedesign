# DynoPay — Agent Handoff (last session)

## 2026-10-04 session (pod 0b940d6a) — merchant complaint RCA + gas-alert unification + error-digest fixes (UNCOMMITTED)
- Full write-up at the top of `memory/PRD.md` (2026-10-04 block). Code: `pages/pay/index.tsx` (activeRef), `Components/Page/Pay3Components/CleanCheckoutV2.tsx` (amount<=0 message), `backend/services/feeWalletMonitor.ts` (consolidated email + Redis alert state), `backend/controller/paymentController.ts` (checkFeeBalance = DB refresh only), `backend/services/email/brandWelcomeScheduler.ts` (jobId), `backend/middleware/botProtection.ts` (no captureError), new `backend/__tests__/feeWalletMonitorDigest.test.ts`, `backend/scripts/render_gas_alert_digest.ts`.
- **Preview Redis is NOT prod Redis** (prod checkout refs 404 on preview). Seed QA sessions with `node ../memory/tmp/qa/seed_preview_donation_sessions.js` (from /app/backend; 6h TTL) → `/pay?d=QAPAR1` (campaign) / `QACHD1` ($50 child). Mock `POST /api/pay/startDonation` + abort `addPayment` in browser tests so nothing is written to the LIVE prod DB.
- Read-only prod DB: `node /app/memory/tmp/qa/ro_query.js "<SELECT …>"` (uses DATABASE_URL, forces read-only txn).
- Droplet SSH key generated but NOT yet authorized by the owner: pub `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOBNLNT0Zp6LQL7OD8D0wR54fUKcCsuni25a8YpRDVMa emergent-agent-dynopay-prodlogs-2026-10-04` (private `/root/.ssh/dynopay_prod_ed25519`). Logs on droplet: `/opt/dynopay/logs/*.log`.
- OPEN QUESTIONS for owner: (a) did they move 0.031 ETH from the ETH fee wallet to 0x18e1d668…b867 → 0xe2f727dd…4e20 on 2026-10-03 15:14Z? If not → rotate the fee-wallet key. (b) Reply to Emmanuel (session 30d585d1): bug on our side, fixed after deploy; his campaign link pf6KZI is fine; also his brand-welcome email never went out (BullMQ jobId bug).
- Follow-up candidates: per-brand breakdown in the Sunday payout digest (currently sums all brands silently); re-send Emmanuel's welcome email post-deploy.

## 2026-10-04 session (pod 0b940d6a, setup via vault) — SETUP ONLY, no code changes
- `pod-bootstrap.sh` run with the vault passphrase → env restored, SAFE MODE on (bg jobs off, outbound email off), prod build served.
- Live preview = **https://vault-auth-setup.preview.emergentagent.com** (re-synced with `--url` + rebuilt; supervisor APP_URL is the UUID host 0b940d6a — see POD_SETUP.md "Preview hostname gotcha").
- Verified: backend /health (db+redis connected, background_jobs.eligible=false), landing 0 CORS errors, merchant dashboard (company 1) loads live data via cached token, 0 console errors. No prod DB writes.

## 2026-10-02 session (pod setup via vault) — SHIPPED (code-complete, NOT yet deployed)
- **ahzraelsound@gmail.com / user 257** unblock DONE (live prod write, verified): the 4 stuck sandbox txns (1136/1137/1138/1141, company 269) were `environment=NULL` → stamped `environment='development'` (status still `pending`) so the Developers "Simulate payment" card accepts them. Guarded UPDATE, committed only because exactly 4 matched.
- **Email brand names**: `sendPaymentLinkCreatedEmail` + `sendWeeklyConversionSummaryEmail` subjects now wrapped in `brandSubject(...)` (old weekly-summary email is retired; conversion summary is the live weekly merchant email). Verified via audit render harness.
- **Page-title localization**: `pages/pay/demo.tsx` → existing `payDemo_title`; `pages/products.tsx` → NEW `products_title` added to all 6 locales (langs/locales/*/pageTitles.json, now 128 keys each). `_error.tsx` was already localized. Verified by frontend testing agent (titles correct on /products, /pay/demo).
- **SafeDeal Reply-To**: `mailTransporter` now resolves `replyTo` (explicit wins, else SafeDeal mail → `SAFEDEAL_REPLY_TO` env or default `support@safedeal.sh`); threaded through `EmailJobData` + `brevoPayload`. Dynopay mail unchanged. Verified via brevoPayload unit check.
- **SafeDeal Telegram lifecycle + reminders**: new `notifyDealStage(deal, stage, email, dealUrl)` in `safedealTelegram.ts` (18 stages, HTML-escaped, no-ops when bot unconfigured / not SafeDeal / recipient not linked). Wired at every transition in `escrowController.ts` (invited/accepted/declined/cancelled/funded seller+buyer×3 paths/delivered/released/refunded/changes/dispute opened+proposal+resolved+escalated) and at all 4 stall reminders in `safedealReminders.ts`. Telegram tokens already in env. Reminders run in the hourly maintenance cron (OFF in preview) → verify post-deploy with a real linked chat. tsc=0; all 18 messages verified.
- **Email redesign Part 2** was already DONE+VERIFIED (A1 KYC threshold from KYC_THRESHOLD_USD, A2 crypto-native, preheaders: 92 keys ×6 locales) — the "not started" note was stale. No action needed.
- **Mobile/PWA**: rebuilt `.next-prod`; fixed a REAL PWA bug — Chrome fires `beforeinstallprompt` before the hook mounts, so it was lost. Added an early capture in `pages/_document.tsx` (window.__bipEvent) + `usePwaInstall` seeds from it. Verified via polling repro (Android Install button visible ~30ms). Hardened `mobile_pwa_check.mjs` to auto-wait (was flaky fixed-500ms). Frontend testing agent on phones: 7/9 pass (the PWA-Android "fail" was a precondition artifact — the dynopay prompt only mounts in the authed dashboard shell). NOTE: a SafeDeal QA check (sd-nav/tabs) is intermittently flaky/env — pre-existing, unrelated.
- Cleanup: purged 8 throwaway `sd-pwa-check-*@example.com` test customers (backup in memory/backups/). No .env changed → no vault re-seal needed.
- Preview host for THIS pod = 0dbd9c5d-2277-40e6-8155-b565e1c05c39 (vault-sealed NEXT_PUBLIC_SERVER_URL=d6413bee is stale but harmless — frontend uses same-origin /api since NEXT_PUBLIC_BASE_URL is empty).


## App shape (NOT the standard template)
- **Next.js frontend at `/app` root** + **Node/TS Express backend at `/app/backend`** (run via `server.py` → ts-node `server.ts`, proxied :8001→:3300) + **remote Railway Postgres & Redis**.
- Frontend supervisor = `/app/frontend` "bridge" → `scripts/start-frontend.sh` builds/starts the Next.js app on :3000.
- Secrets are sealed in an **encrypted vault**. Env files are git-ignored.

## Setup / secrets
- **Vault passphrase: `Katiekendra123@`**
- Decrypt env: `bash scripts/env-vault.sh open 'Katiekendra123@'` → writes `/app/.env.local` + `/app/backend/.env`.
- Full pod setup: `bash scripts/pod-bootstrap.sh --pass 'Katiekendra123@'` (rewrites URLs to THIS pod, installs deps, restarts, enforces SAFE MODE = background jobs OFF). **This was PAUSED / never run this session.**
- **DB access note:** the app's `dbInstance` connects to `127.0.0.1:5432` via an SSH tunnel that pod-bootstrap starts. In a fresh preview that tunnel is DOWN. For quick **read-only forensics**, connect directly with `DATABASE_URL` (Railway public proxy `roundhouse.proxy.rlwy.net:23599`) using the `pg` client — that works without the tunnel.

## ⚠️ CRITICAL SAFETY
- **The preview pod talks to the LIVE PRODUCTION DB.** Do NOT enable background jobs; do NOT run write-heavy tests against it. Read-only SELECTs only unless the user explicitly authorizes writes.
- Production app is deployed on a **DigitalOcean droplet (`root@134.209.94.115`, Docker-based)** — NOT Emergent. `emergent__send_to_deployer` does NOT apply. Code reaches prod via **Save to GitHub → deploy**.

## Work completed this session (in codebase/preview only — NOT deployed to prod yet)
All backend TS typechecks clean (`cd /app/backend && npx tsc --noEmit` → exit 0).

1. **Fix #2 — SSRF on test-webhook** (`controller/companyController.ts`, `utils/outboundUrlGuard.ts`)
   - `testWebhook` now runs `assertSafeOutboundUrl` pre-send + uses `postWithSafeRedirects` (validates every redirect hop).
   - Hardened `outboundUrlGuard.isPrivateIp` to block **IPv4-mapped IPv6 in any form** (`[0:0:0:0:0:ffff:7f00:1]`=127.0.0.1, `...:a9fe:a9fe`=169.254.169.254) — the exact bypass seen in prod `webhook.test` logs. Verified by standalone unit test (15/15).

2. **Fix #3 — signed webhooks by default for API-only merchants** (`controller/apiController.ts`)
   - `createApiKey` auto-mints a `whsec_…` secret (revealed once) + accepts optional url/secret (url SSRF-guarded).
   - `updateApi` gains `webhook_secret:'generate'` (reveal once) so existing keys can opt in; SSRF-guards `webhook_url`.
   - `getApi`/`getApiById`/`updateApi` now **mask** the stored secret on read (`***last8` + `webhook_secret_set`) — was leaking plaintext before.

3. **NEW: Sandbox "Simulate payment"** (test-mode only)
   - New: `controller/payment/simulateSandboxPayment.ts` → `POST /api/user/simulatePayment/:payment_id` (wired in `routes/merchantApiRouter.ts`).
   - Drives pending→confirmed→settled + fires signed `payment.pending/confirmed/settled` webhooks via the outbox emitter. NO crypto/KMS/broadcast.
   - **3 hard gates (fail-closed):** (1) caller key `environment='development'`; (2) TARGET tx stamped `environment='development'` (live/legacy-null refused); (3) idempotent if already settled.
   - Added nullable `environment` column to `tbl_user_transaction` — **model** (`models/userModels/userTransactionModel.ts`) + **migration `0053_txn_environment`** (`migrations/bootMigrations.ts`, idempotent `ADD COLUMN IF NOT EXISTS`). Stamped at creation in `controller/payment/cryptoCheckout.ts` (userPayload) + `routes/merchantApiRouter.ts` (session payload). Default `'production'` → mis-stamp can only fail closed.

4. **Docs** (`pages/documentation.tsx`)
   - Added `simulate-payment` endpoint entry + a **"Testing (Sandbox)"** nav section.
   - Signing/verification (`X-Dynopay-Signature-V2`, `whsec_`, `verifyWebhookV2`) was ALREADY documented; updated one line so it also mentions API-key creation returns a `whsec_`.
   - NOTE: pre-existing lint warning at line ~1348 (`react/no-unstable-nested-components`) is NOT mine.

## Verification status
- tsc clean; SSRF guard unit test 15/15; simulator **Gate-1 verified live** (live key → 403 before DB).
- **NOT E2E-tested:** simulator Gates 2/3 + webhook delivery (no DB tunnel/staging in preview; all existing `tbl_user_transaction` rows have `environment=null`, so nothing simulatable until deployed). createApiKey/updateApi/testWebhook not E2E-tested (would write to LIVE prod DB).

## Investigation findings
- **The Dev Store = company_id 1** (owner_user_id 1). Its bogus company `webhook_url='https://example.com/wh'` was **removed by the user** (verified `null`). It was NOT a platform default (no DB default; only company 1 had it).
- The flood of `webhook.test` deliveries to loopback/metadata was **DynoPay's own SSRF security test suite** — but it exposed the real mapped-IPv6 guard bypass (now fixed in #2).
- **Dropped 125 USDT-TRC20 Dev Store deposit** (see `backend/scripts/recover_devstore_125usdt.ts`): TRC-20 landed on a pool slot registered as native `TRX` → USDT-TRC20 detector never watched it → no ingest, no webhook. **Root cause pending PROD-LOG confirmation** (this is issue #1).
- Prod flags confirmed: `NODE_ENV=production`, `TATUM_TESTNET=false`, `ENABLE_TEST_ENDPOINTS` unset, `PAYMENT_TEST_HOOK_SECRET` unset → sandbox is NOT wired to a testnet/simulator (that's why the new simulator was built).

## PENDING / NEXT STEPS
0. **(2026-10-01) Context-aware onboarding for creators + fundraisers** — full spec in `memory/TASK_CONTEXT_AWARE_ONBOARDING_ALL_VERTICALS.md`; its Step 0 = run testing_agent on the 3 previously shipped fixes (settings chunk fallback, notification ordering, developer wizard track).
1. **#1 dropped-deposit RCA** needs prod logs via SSH. **SSH keypair already generated:** public `/root/.ssh/dynopay_prod_ed25519.pub` (`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDe6kG3dVHGWgXU9IG4SGcX1E8uI2Yo8wxKqlFoyXfVZ emergent-agent-dynopay-logs`), private `/root/.ssh/dynopay_prod_ed25519`. User was installing the public key on `root@134.209.94.115` — **not yet confirmed working.** Once in: `docker ps` / `docker logs` (read-only), grep company_id 1 deposit + webhook flow.
2. **#2 one-off unblock** for customer **ahzraelsound@gmail.com**: their stuck sandbox checkout predates the `environment` stamp (`null`) → the new simulator REFUSES it → needs a manual DB drive or one-off. New sandbox checkouts (post-deploy) simulate cleanly via the endpoint.
3. **E2E test the simulator** — controlled `dpk_test_` run + cleanup, or staging, or post-deploy smoke test.
4. **Optional:** dashboard "Simulate payment" button (endpoint already covers ahzraelsound's API-only case).
   - ✅ DONE (2026-09-27 pt2): shipped as a "Simulate a sandbox payment" card on Developers → API keys
     (Components/Page/API/SandboxSimulatorCard.tsx in ApiKeysPage keys tab, shown when an active dpk_test_
     key exists). New session-authed wrapper POST /api/userApi/transactions/:id/simulate
     (apiController.simulateTransaction + apiRouter) reuses runSandboxSimulation with Gate 2 as the guard.
     Verified read-only/fail-closed: BE tsc 0, FE tsc 0, ESLint 0, next build OK; endpoint 404/400/403(Gate2)/
     403(owner) all correct; frontend UI+wiring confirmed by testing agent. Happy path still needs a real
     sandbox txn (prod write) → verify post-deploy. NOT yet deployed to the droplet.
5. **Deploy** via Save to GitHub → droplet; migration `0053` runs on boot.

## Git / rules
- Do NOT run git write commands or touch `.git`/`.emergent`. User deploys via "Save to Github".
- `yarn.lock` / `.emergent/cron` show as modified from pod boot (yarn install) — environment noise, not code changes.

## Webhook signature verification — merchant integration (from Fix #3)

**How the auto-minted secret works:**
- `createApiKey` response returns `webhook_secret: "whsec_…"` ONCE (`webhook_secret_auto_generated: true`, `webhook_note`). Reads are masked to `***last8` afterward.
- Existing key with no secret → call update-API-key with `{"webhook_secret": "generate"}` (reveals once).
- Store server-side, e.g. `DYNOPAY_WEBHOOK_SECRET=whsec_…`.

**Headers DynoPay sends (only when a secret is configured)** — see `backend/webhooks/index.ts:347-387`:
- `X-Dynopay-Signature-V2: t=<unix>,v1=<hmac>` ← recommended. `v1 = HMAC_SHA256(secret, "<t>.<rawBody>")` hex over the EXACT bytes on the wire. Multiple `v1=` during rotation (current + `webhook_secret_previous`) — match any.
- `X-DynoPay-Timestamp: <unix seconds>`
- `X-DynoPay-Signature: <hmac>` (legacy v1 — HMAC over re-serialised body; being deprecated).

**Node / Express verifier (verify RAW body, not parsed JSON):**
```js
const express = require("express");
const crypto = require("crypto");
const app = express();
const SECRET = process.env.DYNOPAY_WEBHOOK_SECRET; // whsec_…

function verifyV2(rawBody, header, secret, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map(kv => kv.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false; // replay guard
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return header.split(",").filter(p => p.startsWith("v1=")).some(p => {
    const got = Buffer.from(p.slice(3), "hex");
    const exp = Buffer.from(expected, "hex");
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

// IMPORTANT: raw body, not express.json()
app.post("/webhooks/dynopay", express.raw({ type: "*/*" }), (req, res) => {
  const rawBody = req.body.toString("utf8");
  if (!verifyV2(rawBody, req.get("X-Dynopay-Signature-V2"), SECRET)) {
    return res.status(400).send("bad signature");
  }
  const event = JSON.parse(rawBody);
  res.sendStatus(200); // ack fast, then process async
  // event.event = payment.pending | payment.confirmed | payment.settled | payment.underpaid …
  // Fulfil only on "settled"; re-verify via GET /api/user/getPaymentStatus/{event.payment_id}
});
```

**Python (Flask):** read `request.get_data()` (raw bytes); `hmac.new(secret.encode(), f"{t}.{raw}".encode(), hashlib.sha256).hexdigest()`; compare with `hmac.compare_digest`.

**Integration checklist:**
1. Create API key → store the `whsec_` (or `{"webhook_secret":"generate"}` on an existing key).
2. Set webhook URL (per API key, per company, or `webhook_url` on each `/cryptoPayment`).
3. Raw-body route → verify `X-Dynopay-Signature-V2` → reject on mismatch / stale timestamp.
4. Ack 200 fast, process async, re-verify amount/status via `GET /getPaymentStatus/:payment_id` (don't trust body amount blindly).
5. Be idempotent — dedupe on `webhook_id`/`payment_id` (retries redeliver).

NOTE: the docs page (`pages/documentation.tsx` ~line 2096, `verifyWebhookV2`) already has the verify helper; the "get your secret / raw-body / re-verify" walkthrough above could still be added there if the user wants.
