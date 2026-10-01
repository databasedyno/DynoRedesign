<!-- 2026-10-01 (pod setup via vault) — CURRENT POD URL = https://passphrase-config-2.preview.emergentagent.com
     (= SERVER_URL in /app/backend/.env; all env URLs were migrated from the stale d6413bee/b3e8a0ae pods to this one).
     Frontend = PRODUCTION Next build (distDir=.next-prod, no hot reload → after FE edits rebuild & `sudo supervisorctl restart frontend`).
     Backend = ts-node via uvicorn proxy on 8001 → Node on 3300 (`sudo supervisorctl restart backend` to reload).
     Owner/merchant: onarrival21@gmail.com / Katiekendra123@ (TOTP: node /app/backend/scripts/print_totp.cjs 1).
     Admin: moxxcompany@gmail.com / Katiekendra123@. Always send a browser User-Agent (curl/python UAs get 403'd). -->


<!-- ADMIN CONSOLE 2FA (SEC-002, 2026-09-30) — admin login is now TWO-STEP + mandatory TOTP.
     Real admin (moxxcompany@gmail.com) password UNCHANGED, but on next /admin/login they must
     enroll TOTP (scan QR) once. Old 30d admin tokens are now invalid.
     To TEST admin console without touching the real admin: seed a throwaway tbl_admin row, then
     get live TOTP codes with:  cd /app/backend && node scripts/admin_2fa.cjs totp <admin_id>
     Recovery if locked out:     node scripts/admin_2fa.cjs reset <admin_id>   (re-enroll on next login)
     Endpoints: POST /api/admin/login/password -> {status:TOTP_REQUIRED|ENROLL_REQUIRED},
     /api/admin/login/totp, /api/admin/enroll/begin, /api/admin/enroll/complete. -->


## 2026-09-29 (fork, pt13) — READ FIRST (supersedes pod-URL lines below)
## - LIVE preview URL for THIS pod = SERVER_URL in /app/backend/.env = https://passphrase-config-2.preview.emergentagent.com . Frontend = PRODUCTION Next build (no hot reload). Backend = ts-node (no auto-reload → `sudo supervisorctl restart backend`). Always send a browser User-Agent; UA "node"/"python-requests"/curl-like + scanner-looking paths get 403'd by middleware/botProtection.ts (in-memory, cleared by backend restart).
## - Owner/merchant: onarrival21@gmail.com / Katiekendra123@ (user_id 1, company_id 1 "The Dev Store"). TOTP enrolled: `node /app/backend/scripts/print_totp.cjs 1`. API login: POST /api/user/login → data.challenge_token → POST /api/user/2fa/validate {challenge_token, token} → data.accessToken. Cached token: /app/memory/tmp/merchant_token.txt (30-day). Admin: moxxcompany@gmail.com / Katiekendra123@.
## - CHANGES THIS FORK (all on LIVE prod DB — read-only unless noted):
##   1. Flutterwave / fiat rails REMOVED end-to-end: no /api/webhook, /api/failed_webhook, /api/subscriptions, /api/userApi/{createPlan,getPlans,updatePlan,deletePlan}, /api/pay/{authStep,verifyPayment,confirmPayment}, /api/wallet/{authStep,verifyPayment,confirmPayment} (all 404 now). Checkout is crypto-only (pages/pay/index.tsx: no BankTransferCompo / CARD / GOOGLE_PAY / APPLE_PAY). paymentTypes enum FE = {CRYPTO}; BE = {WALLET, CRYPTO}. DB: tbl_subscription + tbl_plan DROPPED (approved, 0 rows).
##   2. 2FA step-up now enforced on contact changes: POST /api/user/addPhone, /verifyAddPhone, PUT/DELETE /api/user/phone, POST /addEmail, /verifyAddEmail → 403 {code:"STEPUP_REQUIRED",scope:"security"} whenever the account has ANY factor (authenticator, email or phone). Unlock: POST /api/stepup/security/verify {method:"totp",code}. PUT /api/user/updateUser now whitelists name/first_name/last_name/remove_photo (+image) — body email/mobile → 400. PUT /api/user/profile rejects mobile/email → 400.
##   3. Currency simplified (Stripe model): ONE brand currency = tbl_company.display_currency (Settings → "Brand currency" card, data-testid display-currency-select; PATCH /api/company/display-currency/:id). Per-user override REMOVED (PATCH /api/user/display-currency → 404; tbl_user.display_currency cleared). GET /api/user/display-currency?company_id=N returns {display_currency, brand_currency_set, rate}. API keys no longer take/require base_currency (CreateApiModel has no currency field; validateApiKey resolves the brand currency). Company 1 brand currency is currently NGN (owner's choice) → dashboard shows ₦.
##   4. Scanner hardening: pages/[handle]{,/shop,/p/[slug]} return 404 before any SSR fetch when the segment has dots/slashes (isPlausibleHandleSegment in helpers/ssrFetchHeaders.ts). botProtection SCANNER_PATH_PATTERNS extended (credentials, config.*, .s3cfg, appsettings*.json, docker-compose, phpinfo, *.bak …).

## 2026-09-29 (fork, pt12) — E2E gap audit notes (read first)
## - LIVE preview URL for THIS pod = https://passphrase-config-2.preview.emergentagent.com . Frontend runs in PRODUCTION mode: FE code edits are NOT live until `cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build` (≈2.5 min, run in background) → `mv .next-prod .next-prod-old && mv .next-prod-new .next-prod && sudo supervisorctl restart frontend`. Do NOT commit yarn.lock changes produced by tooling (git checkout -- yarn.lock).
## - Admin API login: POST /api/admin/login {email:moxxcompany@gmail.com,password:Katiekendra123@} → data.token (no 2FA). Fresh tokens cached in /app/memory/tmp/{admin,merchant}_token.txt (may expire).
## - Read-only route/contract tooling: `cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/dump_routes.ts | grep -o '\[{"method".*' > /tmp/routes_clean.json` then `python3 /app/scripts/qa/api_contract_xref.py`. Security/validation curl harnesses: backend/tests/audit_security_test.sh, backend/tests/iter243_validation_test.sh.
## - New guards to remember when testing: GET /api/referral/leaderboard, POST /api/referral/apply, POST /api/referral/referee/redeem, POST /api/status/check now require auth (merchant / merchant / merchant / admin). Live crypto refunds are refused unless REFUND_FORWARDING_WIRED=true (preview has ENABLE_CRYPTO_REFUNDS unset → /api/refunds/* = 404).

## 2026-09-28 (pt10b) — Donation page QA fixture: /pay?d=zEJtCe = throwaway campaign link 611 (The Dev Store, min $10, presets 25/50/100). Donate creates a pending child contribution link each time (expected) — ALWAYS mock **/api/pay/addPayment + **/api/pay/verifyCryptoPayment* before picking a coin. Prod-created campaigns (e.g. d=AGlM2I) show 'expired' on this pod (prod Redis ≠ pod Redis) — not a bug. Sandbox demo: /pay/donation-demo (toggles demo-scenario-campaign/endingsoon/nogoal/closed).

## 2026-09-28 (fork, pt10) — CURRENT POD URL (supersedes ALL lines below)
## - LIVE preview URL for THIS pod = https://passphrase-config-2.preview.emergentagent.com (= SERVER_URL in /app/backend/.env). Public pages: /devhub, /devhub/shop, /devhub/p/talk-to-a-developer. Inline tip QA: mock **/api/pay/addPayment → {success:true,data:{address:'LbnAP43Ty8vvzxzTwJcocfytbCrX6GrGx4',qr_code:'',remaining_minutes:30,transaction_id:'qa-mock'}} + **/api/pay/verifyCryptoPayment* → {success:true,data:{status:'waiting',remaining_seconds:1790}}; coin tiles inline-tip-currency-<CODE>, back = inline-tip-change-amount.


## 2026-09-28 (fork, pt9) — CURRENT POD URL (supersedes ALL lines below)
## - LIVE preview URL for THIS pod = https://passphrase-config-2.preview.emergentagent.com (read SERVER_URL in /app/backend/.env). The vault-auth-8 URL below is STALE.
## - Owner/merchant: onarrival21@gmail.com / Katiekendra123@ (user_id 1, company_id 1 "The Dev Store", TOTP: node /app/backend/scripts/print_totp.cjs 1). Admin: moxxcompany@gmail.com / Katiekendra123@.
## - CHANGE THIS FORK: removed the WalletConnect "Verify ownership by signing / Connect wallet & sign" action from the merchant /wallet Payout addresses page (Components/Page/Wallet/WalletOwnershipRow.tsx). The historical "Ownership verified" chip still renders for already-verified addresses.


## 2026-09-28 (fork, pt8) — CURRENT POD URL (supersedes the pt6 line below)
## - LIVE preview URL for THIS pod = https://passphrase-config-2.preview.emergentagent.com (read SERVER_URL in /app/backend/.env; there is NO /app/frontend/.env — Next.js app lives at repo root).
## - Owner/merchant: onarrival21@gmail.com / Katiekendra123@ (user_id 1, company_id 1 "The Dev Store", TOTP: node /app/backend/scripts/print_totp.cjs 1). Admin: moxxcompany@gmail.com / Katiekendra123@.
## - Payment-link-created-date fixtures (read-only): tx 1295 = payment_link (link 492 created 2026-09-19); tx 557 = tip (child link 173, parent tip jar 59 created 2026-07-13).

## 2026-09-28 (fork, pt6) — CURRENT POD URL (use this, others below are stale)
## - LIVE preview URL for THIS pod = https://passphrase-config-2.preview.emergentagent.com
## - Admin (SafeDeal / Dynopay) login: moxxcompany@gmail.com / Katiekendra123@ (also the vault passphrase)
## - SafeDeal customer sign-in: any *@example.com email → one-time code in UI (sd-signin-preview-code) and POST /api/safedeal/auth/send-code → data.preview_code.
## - Simulated funding is DISABLED on this pod (SAFEDEAL_ALLOW_SIMULATION unset) — cannot fund deals; test fee math via /api/safedeal/fee-preview and the create-deal quote UI.


## 2026-09-25 (fork) — POD PREVIEW URL + QA CENTER PASSCODE (read first)
## - LIVE preview URL for THIS pod = https://passphrase-config-2.preview.emergentagent.com (env `preview_endpoint`). The parent-job URL db6f1699-…preview.emergentagent.com is STALE → resolves to Cloudflare/Webflow prod → 404s all /api/*. Never use it.
## - Backend on this pod runs under uvicorn `--reload` (WatchFiles) → transient 502/503 "Backend starting" during reloads. Any fetch/curl/Playwright QA must send a browser User-Agent and retry on 5xx.
## - Quality Center (/quality) passcode: header `x-qa-passcode: Dynopay123@` (backend routes/qualityRouter.ts, env QA_PASSCODE overrides; not set here). Read QA notes: curl -s $URL/api/quality/data -H "x-qa-passcode: Dynopay123@". Statuses per item = latest comment.

## 2026-09-25 (fork) — DASHBOARD 2FA UI LOGIN FLOW (for testing agents) + QA delete testids
## - Owner login (2-step + TOTP): /auth/login → data-testid=login-email-input → click 'Continue' (get_by_role button name='Continue' EXACT — 'Continue with Google/GitHub' match without exact) → data-testid=password-input → data-testid=signin-submit-btn → [data-testid=login-2fa-dialog] first input → keyboard.type(TOTP). Set sessionStorage.mfa_interstitial_seen='1' BEFORE login to skip the interstitial. TOTP: `node /app/backend/scripts/print_totp.cjs 1` (rotates 30s — read immediately before typing). API login: POST /api/user/login → data.challenge_token → POST /api/user/2fa/validate {challenge_token, token} → data.accessToken (30-day). NOTE: /api/notifications/* enforces CSRF (curl needs cookie+header); /api/userApi/* accepts Bearer without CSRF.
## - QA #3 Customer delete testids: customers-add-btn → customers-add-dialog → customers-add-email/-name → customers-add-submit; detail drawer customer-detail-drawer → customer-detail-manual-badge + customer-detail-delete (2-click: 'Remove'→'Confirm remove'); Remove ONLY shows for c.manual (transaction-derived customers have no Remove). Backend DELETE /api/userApi/customers/manual {company_id,email}.
## - QA #4 Notification delete testid: notification-delete-<notification_id> (trash icon per inbox row). Backend DELETE /api/notifications/:id (user-scoped). Seed a disposable row: node backend/scripts/_pgq.js "INSERT INTO tbl_notification (user_id,company_id,type,title,message,data,is_read,created_at) VALUES (1,1,'system','QA','x','{}'::jsonb,false,now()) RETURNING notification_id". (⚠️ prod DB — only delete rows you seed.)


## 2026-09-24 — SafeDeal SECURITY HARDENING (read before any SafeDeal QA)
## - Sign-in `preview_code` is ONLY returned for reserved test domains (`*@example.com|.net|.org`, `*.test`, `*.invalid`, `*.localhost`) while DISABLE_OUTBOUND_EMAIL=true. Real mailboxes (gmail etc.) never get a code in the response — even on preview (shared prod DB).
## - Step-up codes: single use, 5 wrong attempts invalidate. Rate limits: send-code/verify-code 10 per 15 min per IP+email; step-up 10/15m per IP; telegram/address/withdraw/simulate 20/15m per IP (Redis keys ratelimit:otp:*, ratelimit:sd:*).
## - Simulated funding (deal action `fund`) and `POST /wallet/topup/:id/simulate` return 403 unless SAFEDEAL_ALLOW_SIMULATION=true AND live settlement is off. NEVER set that flag on this pod (it writes to the production DB). Balances can no longer be fabricated for QA — test cashout math with unit tests / mocks instead.
## - Cleanup helper for throwaway SafeDeal identities: node /app/backend/scripts/cleanup_r225.js (edit ids) ; RO SQL: node /app/backend/scripts/ro_query.js "<sql>".
## - Reown prod QA: checkout.dynopay.com is now allow-listed; 24h QA link /pay?d=Cf1ngm (link 536) self-expires 2026-09-25T06:36Z. Always mock **/api/pay/addPayment + **/api/pay/verifyCryptoPayment* (recipe below) — never reserve a real pool address.

## 2026-09-23 — Reown AppKit / WalletConnect (Pay with wallet + Verify ownership) — VERIFIED (BE smoke 20/20; FE iteration_222 SafeDeal T1/T2 pass; checkout + merchant /wallet verified via Playwright)
## - Reown Project ID lives in /app/.env.local NEXT_PUBLIC_REOWN_PROJECT_ID (public client id; allow-listed for dynopay.com + safedeal.sh only — preview shows the modal but WalletConnect relay may reject on preview).
## - Backend smoke (EVM + Tron sign/verify, nonce single-use, wrong signer 400, merchant owner guard): cd /app/backend && node -r dotenv/config scripts/wallet_ownership_smoke.js <baseUrl> <sd_token> [merchant_email] [merchant_password]
## - Endpoints: POST /api/wallet/ownership/nonce {wallet_id} ; POST /api/wallet/ownership/verify {wallet_id,nonce,signature,wallet_name} (Bearer, owner-only)
##              POST /api/safedeal/wallet/addresses/:id/verify-nonce ; POST .../:id/verify (x-safedeal-token + CSRF cookie/header)
##              POST /api/pay/walletTxSubmitted (checkout customer token) ; POST /api/safedeal/deals/:token/funding/wallet-tx — hints only (Redis 48h), never mark paid.
## - SafeDeal QA session (cid 956) WAS PURGED at end of session per workflow rule — re-mint: POST /api/safedeal/auth/send-code {email:"sd-wallet-smoke-<ts>@example.com"} → preview_code → verify-code, then add a USDT-POLYGON address via step-up (see backend/scripts/wallet_ownership_smoke.js which does all of this).
##   Overview page with Payout addresses card = /safedeal/deals (testids: sd-address-102, sd-address-verify-open-102, sd-address-verify-102-btn, sd-address-verified-102 once verified).
## - Merchant Wallets page /wallet: per card wallet-ownership-verify-open-<wallet_id> → wallet-ownership-verify-<wallet_id>-btn (opens AppKit modal <w3m-modal>) ; verified chip wallet-ownership-verified-<wallet_id>. ETH wallet_id=2 on company 1.
## - Hosted checkout: QA link /pay?d=jgQQzL "QA wallet pay (EVM+Tron)" $12, all coins, no expiry (company 1). (pTQPn4 is expired.) After picking an EVM/Tron/SOL coin the awaiting-payment step shows clean-checkout-wallet-pay-wrap + clean-checkout-pay-with-wallet-btn; QR/copy stay as fallback. BTC/LTC/XRP etc. show NO wallet button by design.

## 2026-09-22 — SafeDeal TELEGRAM ALERTS (link/test/unlink + cashout push) — VERIFIED (BE smoke 14/14, iteration_217 FE, iteration_218 deferred QA)
## - No new passwords. Bot @SafeDealAlert_bot; token in backend/.env SAFEDEAL_TELEGRAM_BOT_TOKEN (valid). Preview widget shows 'Bot domain invalid' (expected).
## - Endpoints (hdr x-safedeal-token): GET /api/safedeal/telegram ; POST /telegram/link {signed widget payload} ; POST /telegram/test ; POST /telegram/unlink.
## - Link a throwaway account WITHOUT the widget: cd /app/backend && node -r dotenv/config scripts/telegram_alerts_smoke.js <baseUrl> --link <sd_token>  (full smoke: omit --link).
## - UI: /safedeal/deals Overview → card sd-telegram-card (sd-telegram-state On/Off, sd-telegram-test, sd-telegram-unlink). Fake chat → 'Send test' shows 409 'press Start' toast (by design).
## - Admin fee reconciliation QA pytest: /app/backend/tests/test_iter218_fee_recon_and_crumb.py (crumb sweeper DRY RUN only — never POST consolidate-crumbs without dry_run:true).

## 2026-09-20 SESSION — cancellation-fee reversal + withdrawal resilience + brand-262 purge + telegram env
## - ADMIN (SafeDeal / Dynopay): moxxcompany@gmail.com / Katiekendra123@  (also the vault passphrase).
## - SafeDeal sign-in (customers): any email; one-time code shown in UI (data-testid=sd-signin-preview-code)
##   and returned by POST /api/safedeal/auth/send-code -> data.preview_code (outbound email OFF in preview).
## - TELEGRAM LOGIN: now wired. backend/.env SAFEDEAL_TELEGRAM_BOT_USERNAME=SafeDealAlert_bot,
##   SAFEDEAL_TELEGRAM_BOT_TOKEN=<REDACTED — real value only in gitignored backend/.env + encrypted env.vault.enc> (re-sealed).
##   Widget renders only on a BotFather /setdomain-registered host; on preview it shows "Bot domain invalid"
##   (expected). PRODUCTION must set these two env vars + register its domain in BotFather.
## - CANCELLATION FEE: mutually-agreed cancellation now CHARGES a fee (SAFEDEAL_CANCELLATION_FEE_PERCENT,
##   default 5% when unset) instead of waiving it. Config GET /api/safedeal/config -> cancellation_fee_percent.
## - BRAND 262 PURGED to only the real account moxxcompany@gmail.com (customer_id 696, wallet $50).
##   Backup: /tmp/safedeal_262_backup_1789948530136.json. Deleted 110 test customers + all deals/children.


## 2026-06 fork — SafeDeal rebrand-finish + email receipts + guest-deal + fees column (VERIFIED iteration_210 FE 100%)
## - No new passwords. SafeDeal sign-in = any email; one-time code shown in UI (data-testid=sd-signin-preview-code) AND API POST /api/safedeal/auth/send-code -> data.preview_code (outbound email OFF in preview).
## - Signin code input = segmented: first box data-testid=sd-signin-code, rest sd-signin-code-2..6; verify btn sd-signin-verify.
## - GUEST DEAL: /safedeal landing "Start a deal" (sd-start-deal) now goes straight to /safedeal/deals/new for guests (no auth). Fill sd-new-title/-amount/-email, Continue (sd-new-continue) x2, Send invite (sd-new-submit). Guest → redirected to signin?next=/safedeal/deals/new?resume=1; draft saved in sessionStorage 'sd_deal_draft'; after signin auto-creates → /safedeal/deal/<token>?created=1.
## - FEES COLUMN: /safedeal/wallet Statement table has Date/Deal/Type/Amount/FEES/Balance; fee cell testid sd-statement-fee-<kind> (e.g. sd-statement-fee-topup shows $2.24 for a USDT-TRC20 $50 top-up). CSV export also has a "Fees (USD)" column.
## - EMAIL RECEIPTS (Brevo, suppressed+dumped in preview to /app/memory/email_outbox): a credited top-up emails DEP-<id> receipt PDF; a settled deal emails SD-<id> invoice PDF to both parties. Verify via log lines "[Email] SUPPRESSED ... subject=Your SafeDeal deposit receipt — DEP-<id> | attachments=1" / "... SafeDeal invoice SD-<id> ...". Backend smoke: bash /app/backend/scripts/safedeal_smoke.sh (create→accept→fund(sim)→deliver→release, + cancel/refund).
## - Top-up via API for a quick funded wallet: send-code -> verify-code (data.token) -> POST /api/safedeal/wallet/topup {amount:50,coin:'USDT-TRC20'} (hdr x-safedeal-token) -> data.topup.topup_id -> POST /api/safedeal/wallet/topup/<id>/simulate. Inject localStorage sd_token=<jwt>, sd_user={"email":..,"customer_id":..} to view /safedeal/wallet in a browser.
## - Rebrand: SafeDeal "Invited"/"Delivered" status chip was Dynopay indigo (shared escrow StatusChip "brand" tone) — now gold via StatusChip colorsOverride prop set by SdStatusChip. Dynopay admin escrow UI unchanged.


## SafeDeal top-up fees / orphan fix / branded invoices — VERIFIED 2026-06 (iteration_209: 7/7 pytest, FE 100%)
## - Sign-in unchanged: POST /api/safedeal/auth/send-code {email} → data.preview_code → POST verify-code → data.token → header x-safedeal-token. customer_id = GET /api/safedeal/me → data.user.customer_id.
## - NEW branded deposit-receipt PDF: GET /api/safedeal/wallet/topup/:id/receipt.pdf (SafeDeal logo + You sent/Network fee/Credited).
## - Invoices list GET /api/safedeal/invoices returns a UNIFIED array: type:'deposit' (DEP-<id>) + type:'deal' (SD-<id>, funding_label). data is a plain array (NOT data.invoices).
## - Network fees now realistic per coin (USDT-TRC20 ~2.24 live / 2 floor; ERC20 3; POLYGON 0.1) with a Math.max floor so live never under-quotes. Top-up credits the FULL requested amount; fee added on top (send amount+fee).
## - Self-heal test helper: from /app/backend → `node -r dotenv/config scripts/topup_selfheal_test.js seed <customer_id>` → GET the topup (auto-credits) → `... cleanup <topup_id> <payment_id> <customer_id>`.
## - Pytest: /app/backend/tests/test_safedeal_iter209_topup_orphan_fees.py (7 pass, 3 skip: reserve-vs-autowithdraw needs a payout address which CSRF-blocks curl; deal-funding orphan needs LIVE_SETTLEMENT; both covered by code+top-up path).
## - Preview URL (this pod): https://passphrase-config-2.preview.emergentagent.com (older memory-safe-12 URL is STALE).


## Telegram Login (SafeDeal) — added & VERIFIED (2026-06). Bot @SafeDealAlert_bot, token in backend/.env SAFEDEAL_TELEGRAM_BOT_TOKEN.
##   Backend endpoint POST /api/safedeal/auth/telegram verifies HMAC-SHA256(secret=SHA256(bot_token)) + auth_date<24h, then mints the
##   normal SafeDeal JWT. To TEST without the widget: build a payload {id,first_name,...,auth_date=now}, compute hash with the bot token
##   (see /tmp/tg_test2.py pattern: dcs = sorted "k=v" joined by \n; secret=sha256(token).digest(); hmac-sha256 hex), POST it.
##   IMPORTANT: Cloudflare blocks urllib default UA (403 err 1010) — send a browser User-Agent header. Widget renders ONLY after the
##   owner runs @BotFather /setdomain for the login domain (preview host, or safedeal.sh in prod); until then it shows "Bot domain invalid".
##   Telegram-created customers get a non-routable synthetic email tg<telegram_id>@telegram.safedeal + telegram_id on tbl_customer (migration 0043).

## SafeDeal E2E — VERIFIED (2026-09-20) — buyer<->seller fund->deliver->release PASSED (frontend testing agent). Deal e79888ff… now COMPLETED/consumed; mint a fresh deal to re-run.
## NEXT AGENT (2026-09-20): 2 backend refinements IMPLEMENTED but NOT TESTED — auto-withdraw sweep-on-enable + cancellation escrow-fee waiver. Run deep_testing_backend_v2 first. Full test plan at the TOP of memory/SAFEDEAL_NOTES.md (Scenarios A & B) and test_result.md top block. tsc clean, backend healthy.
- SAFEDEAL_API_KEY in backend/.env was STALE and has been UPDATED to the current active
  company-262 key (dpk_live_oA0S…, verified active in live DB) and RE-SEALED into env.vault.enc.
  Funding (POST /api/safedeal/deals/<token>/funding) now works (was "Invalid API key").
- Test deal (status awaiting_payment; buyer already accepted; a funding address is already created):
  deal_token = e79888ff5e7e15c0657539d6c83f4242006f90db8846daa0  ($250, service, buyer pays fee)
- SafeDeal sessions (localStorage keys: sd_token = the JWT, sd_user = {"email":..,"customer_id":..}).
  Valid ~until 2026-09-26; if expired re-mint via send-code/verify-code preview_code flow.
  SELLER (cid 607, sd-audit-1789847049@example.com):
    sd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJraW5kIjoic2FmZWRlYWwiLCJjaWQiOjYwNywiY29pZCI6MjYyLCJlbWFpbCI6InNkLWF1ZGl0LTE3ODk4NDcwNDlAZXhhbXBsZS5jb20iLCJpYXQiOjE3ODk4NDcwNTAsImV4cCI6MTc5MDQ1MTg1MH0.3RURGdsW0jHJf2KsyyEBZsfM5PWoEXgNHC7s3NxkGKM
  BUYER (cid 608, sd-buyer-e2e-1789849169@example.com):
    sd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJraW5kIjoic2FmZWRlYWwiLCJjaWQiOjYwOCwiY29pZCI6MjYyLCJlbWFpbCI6InNkLWJ1eWVyLWUyZS0xNzg5ODQ5MTY5QGV4YW1wbGUuY29tIiwiaWF0IjoxNzg5ODQ5MTcxLCJleHAiOjE3OTA0NTM5NzF9.JqKYx8QYVzcNgPyO9S97slXgxV2KMf7QIafa7pjv5Ao
- Remaining E2E steps (frontend): BUYER simulate-fund (sd-act-fund) -> SELLER deliver
  (sd-act-deliver-open/sd-act-deliver) -> BUYER release (sd-act-release-open/sd-act-release)
  -> completed + seller wallet credited. Full detail in test_result.md top HANDOFF block.


# Test credentials (current pod)

Preview URL (THIS pod): https://passphrase-config-2.preview.emergentagent.com  (source of truth: APP_URL in /etc/supervisor/conf.d/*.conf; frontend env = /app/.env.local, NOT /app/.env)
# NOTE (2026-09): Next DEV heap raised to 8192 in scripts/start-frontend.sh to cut the memory-recycle 502s that intermittently hit the edge. If E2E hits a 502, it's a ~5s dev-server recycle — retry after ~15s.

## Brands on the owner account (company selector: data-testid=company-option-<id>)
- 1 The Dev Store — populated (458+ payments) → normal dashboard
- 165 Nameword — 13 wallets, 2 successful payments (Sep 2026) + 1 failing webhook → normal dashboard
- 71 SMADAV — 13 wallets, 2 links, 2 payments → normal dashboard
- 228 QA HashKeys Brand / 219 QA BuyerEmail Test — empty → new-merchant Getting-started state
- (179 QA Throwaway Brand 2 no longer belongs to user 1 — deleted)
- Dashboard (Wave 1 Command Centre) root: data-testid=dash2026-root; range buttons UPPERCASE (7D/30D/90D/1Y/Custom);
  skip MFA interstitial with sessionStorage.mfa_interstitial_seen='1'. API: GET /api/dashboard/overview?company_id=&period=

## Merchant (owner test account)
- Email: onarrival21@gmail.com
- Password: Katiekendra123@
- user_id=1, company_id=1
- TOTP 2FA is enrolled on this account. Get the current 6-digit code: `node /app/backend/scripts/print_totp.cjs 1` (rotates every 30s — read it right before typing). API login: POST /api/user/login → data.challenge_token → POST /api/user/2fa/validate {challenge_token, token} → data.accessToken.
- 2-step login: /auth/login -> data-testid=login-email-input -> button "Continue" (exact) -> password-input -> signin-submit-btn

## Phase 1b QA throwaway (min_order_usd persistence) — created 2026-06
- Email: qa_minorder_p1b@example.com
- Password: QaMinOrder123@
- user_id=221, company_id=231 (brand "QA MinOrder"), no wallets/links/payments
- min_order_usd set to 25.00 via API (round-trip verified). Field UI: Settings → Payments → "Payment tolerance" accordion → input data-testid=settings-min-order-input; Save = settings-save-changes-btn
- Login is 2-step in UI: /auth/login → login-email-input → "Continue" → password-input → signin-submit-btn

## Super-admin
- Email: moxxcompany@gmail.com
- Password: Katiekendra123@
- Login page: /admin/login

## Account/Brand deletion QA (helpers — SAFE MODE, prod DB)
- Both delete send-otp endpoints return `data.preview_otp` in the response while DISABLE_OUTBOUND_EMAIL=true.
  - Account: POST /api/user/account/send-otp ; DELETE /api/user/account {otp}
  - Brand:   POST /api/company/deleteCompany/:id/send-otp ; DELETE /api/company/deleteCompany/:id {otp}
- OTP helpers: `node /app/backend/scripts/read_delete_otp.cjs <email>` (account delete code by email),
  `node /app/backend/scripts/read_redis_key.cjs "otp:<email>"` (signup/login/reset OTP JSON).
- Throwaway signup recipe (passwordless): POST /api/user/registerEmail {email} -> read OTP -> POST /api/user/registerEmail/verify-otp {email,otp,first_name,last_name}. Set a password via forgot-password -> /forgot-password/verify-otp (resetToken) -> /reset-password {token,email,newPassword}. Add a 2nd brand: POST /api/company/addCompany {company_name,email} (needed to test brand delete — only-brand deletion is blocked).
- Admin lifecycle: GET /api/admin/deleted-accounts ; POST /api/admin/deleted-accounts/:id/{restore,purge} ; same for /deleted-brands/:companyId/{restore,purge}.
- Cleanup: soft-delete then admin purge fully hard-removes the account + brands (verified: users 208 & 209 purged, 0 leftovers). Only use emails prefixed qa_acctdel_ for these throwaways.

## Handy read-only fixtures (The Dev Store)
- Live $15 payment link for checkout UI tests: /pay?d=rNtQRX (mock POST /api/pay/addPayment before clicking Continue — it reserves a real pool address)
- Auto-converted payments: tx 944 (ETH $50.42, conversion 7, off-chain ref 410062742674), tx 941 (BTC $27.73, conversion 5); non-converted: tx 937
- Read-only SQL: `node backend/scripts/ro_query.js "select ..."` (RO_JSON=1 for JSON)
- Public shareable receipt (read-only): /receipt/oN7U2knyNnaQ3NBrfNXL3F (tx 591b67d4…, $20 ETH, The Dev Store) — also /api/pay/receipt/<token>{,/pdf}
- No live customer-pays (fee_payer='customer') link exists on prod — all 46 are expired; create a throwaway one if the "Processing fee" row must be seen in a browser

## Notes
- SAFE MODE, wired to PRODUCTION DB -> prefer READ-ONLY. Do NOT mutate live merchant data.
- Outbound email OFF. Background jobs OFF.
- Vault passphrase == Katiekendra123@ (restore env: bash scripts/pod-bootstrap.sh --pass 'Katiekendra123@')
- Hydration guard (post-deploy gate + local): PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell node scripts/qa/hydration_guard.mjs --base=<url> --pages=/,/fees,/pay/demo
- Social login redirect_uri_mismatch on preview; email/password works fine.

## UI/UX overhaul QA helpers (2026-06)
- Hosted checkout awaiting-phase without reserving a real address: page.route('**/api/pay/addPayment') → {success:true,data:{address:'0x…',qr_code:'<base64 png>',remaining_minutes:30,amount:0.0061,merchant_amount:0.006,fees:0.0001,fee_payer:'company'}} + route '**/api/pay/verifyCryptoPayment*' → {status:'waiting',remaining_seconds:1790}; then currency-select → clean-checkout-coin-ETH → clean-checkout-continue-btn.
- Storefront checkout with items (no purchase): localStorage dynopay_cart_v1 = {"devhub":{"items":[{"product_id":9,"variant_id":null,"quantity":1,"added_at":0}]}} then reload /devhub/checkout. Never click "Pay with crypto".
- Drag-and-drop probe (all 7 dropzones, uploads aborted): PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell node scripts/qa/dnd_probe.mjs --base=<url> --email=onarrival21@gmail.com --password='Katiekendra123@' [--only=bcdef]
- Landing full-page shots: node scripts/qa/landing_shots.mjs --base=<url> --widths=390,768,1440 [--dark=1] --out=/tmp/landing
- In-app dark mode: localStorage theme-mode-inapp=dark; public/checkout dark: theme-mode-public=dark.

## Email dark-mode QA (2026-06)
- Guard: node backend/scripts/check-email-dark-mode.mjs (also runs in pre-commit)
- Render real senders to HTML (nothing sent): cd backend && EMAIL_DUMP_DIR=/tmp/email_dark/html DISABLE_OUTBOUND_EMAIL=true node_modules/.bin/ts-node --transpile-only scripts/render_dark_mode_fixes.ts
- Screenshot light/dark/gmail-inversion: PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell node scripts/qa/email_dark_shots.mjs --in=/tmp/email_dark/html --out=/tmp/email_dark/shots [--assets=http://localhost:8001]
- Real historical dumps of every template: /app/memory/email_outbox/*.html (EMAIL_DUMP_DIR)


## Mandatory 2FA + trusted devices + 30-day sessions (2026-09)
- Sessions: access/refresh tokens = 30 days; the 15-min idle sign-out and the "Keep me signed in" checkbox are GONE.
- Login 2nd factor is only asked on a browser WITHOUT the HttpOnly `dp_device` cookie (Path=/api/user, 90 rolling days). Enrolling (any method) or passing /2fa/validate sets the cookie.
- Login challenge payload: `data.requires_2fa=true, method:'totp'|'email', challenge_token, masked_email?, preview_otp?` (preview_otp only for method=email while DISABLE_OUTBOUND_EMAIL=true). Finish with POST /api/user/2fa/validate {challenge_token, token}. Resend: POST /api/user/2fa/resend {challenge_token} (30s cooldown).
- Enrolment (authed): TOTP = POST /2fa/setup → /2fa/verify-setup {token}; EMAIL = POST /api/user/2fa/email/start (returns data.preview_otp) → POST /api/user/2fa/email/verify {code} (returns backup_codes).
- Enforcement: GET /api/user/2fa/enforcement → {enrolled, method, deadline_at, days_left, hard_wall}. Deadline (now+14d) is set on the first login of an un-enrolled user. Hard wall ⇒ every requireStepUp route answers 403 MFA_ENROLLMENT_REQUIRED and the app shows data-testid=mfa-hard-wall. Soft wall UI: data-testid=mfa-soft-banner (+ once-per-session data-testid=mfa-interstitial, sessionStorage key mfa_interstitial_seen).
- Force a hard wall for QA: `cd /app/backend && node scripts/_pgq.js "update tbl_user_2fa set is_enabled=false where user_id=221; update tbl_user set mfa_deadline_at=now()-interval '1 day' where user_id=221"` (write helper — QA users only!). Restore by enrolling again.
- Reset flow (public): POST /api/user/2fa/reset/request {challenge_token} → data.preview_token (email off) → page /auth/reset-2fa?token=… → POST /api/user/2fa/reset/confirm {token}. Effects: method→email, all sessions + trusted devices revoked, wallet changes frozen 24h (GET /api/wallet/security/status → frozen/until), tbl_security_event row, ADMIN_EMAIL notified.
- Admin: GET /api/admin/security/events, POST /api/admin/security/users/:userId/unfreeze; UI panel on /admin (Overview) data-testid=admin-security-events, unfreeze button admin-security-unfreeze-<eventId>.
- Trusted devices: GET/DELETE /api/user/trusted-devices[/:id]; UI card on Settings → Profile & Security (data-testid=trusted-devices-list, trusted-device-forget-<id>, trusted-devices-forget-all).
- Wizard /get-started now has 5 steps; step 1 = "secure" (data-testid=gs-step-secure, twofa-method-totp / twofa-method-email). Payouts+ are unreachable until enrolled.
- Current states: user 221 (qa_minorder_p1b) = enrolled, method=email (login on a fresh browser ⇒ email challenge). user 1 (onarrival21) = NOT enrolled, deadline set 2026-09-28 ⇒ soft banner + wizard step 1.

## SafeDeal (standalone escrow product, added 2026-09) — no passwords
- URL: <preview>/safedeal  (landing), /safedeal/signin, /safedeal/deals, /safedeal/deals/new, /safedeal/deal/<deal_token>, /safedeal/wallet
- Sign-in = email + one-time code. Outbound email is OFF in preview, so the code is shown in the UI (data-testid=sd-signin-preview-code → <b>) and returned by the API as data.preview_code.
- Any email works (first sign-in creates the customer + wallet under brand company_id=262 "SafeDeal"). Use two emails for buyer/seller (e.g. sd-buyer-x@example.com / sd-seller-x@example.com).
- API: POST /api/safedeal/auth/send-code {email} → POST /api/safedeal/auth/verify-code {email, code} → data.token; send as header x-safedeal-token.
- Step-up (add payout address / withdraw): POST /api/safedeal/auth/step-up → data.preview_code; UI shows it at data-testid=<dialog>-preview-code.
- Money is SIMULATED (ESCROW_LIVE_SETTLEMENT off): "Pay with crypto (simulated)" funds instantly.
- Dynopay admin side: Admin → Escrow → tab "Withdrawals" (super-admin login). Brand owner side: Customers page with brand 262 selected shows escrow totals + per-customer statement.
- Smoke script (backend, all flows): bash /app/backend/scripts/safedeal_smoke.sh
- Pytest: /app/backend/tests/test_safedeal_api.py (11) + test_safedeal_iter203.py (12) — `cd /app/backend && python3 -m pytest tests/test_safedeal_*.py -q`
- Admin (super-admin): /admin/login (UI) or POST /api/admin/login → data.accessToken; localStorage key `admin_token`. Admin → Escrow tabs: escrow-admin-tab-{disputes,all,withdrawals,safedeal}. Withdrawals > $1000 → pending_approval → approve/reject there.
- Owner view of brand 262: inject owner token (TOTP recipe above) + localStorage last_company_id=262 → /customers shows brand-escrow-totals; open a customer → customer-escrow-statement.
- Rendered SafeDeal email previews: `cd /app/backend && EMAIL_DUMP_DIR=/tmp/safedeal_emails node_modules/.bin/ts-node --transpile-only scripts/render_safedeal_emails.ts`

## SafeDeal auto-withdraw = deal-proceeds-only + brand scrub (2026-06 fork) — VERIFIED via 2-party curl + wallet screenshots
## - No new passwords. SafeDeal sign-in = any email; preview_code from POST /api/safedeal/auth/send-code. Header x-safedeal-token=<jwt from verify-code>.
## - CSRF-exempt prefixes now include /api/safedeal/{auth/,fee-preview,deals,wallet,profile} → the whole auto-withdraw flow is curl-testable.
## - Auto-withdraw test recipe (proves top-ups are NEVER swept, only deal proceeds):
##   1) seller: send-code/verify-code -> token; 2) POST /wallet/topup {amount:50,coin:USDT-TRC20} -> /wallet/topup/<id>/simulate;
##   3) POST /auth/step-up -> preview_code; POST /wallet/addresses {payout_key:'USDT-TRON',address:'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',code};
##   4) POST /profile {auto_withdraw:true,auto_withdraw_address_id:<id>}; 5) GET /wallet -> expect available 50, parked 0, 0 withdrawals (top-up NOT swept).
##   Then run a full deal (seller creates my_role:seller, buyer accepts+fund(sim)+seller deliver+buyer release) -> GET /wallet expect parked = deal-proceeds ONLY (e.g. 60), available = 50+60.
## - Wallet UI: data-testid sd-wallet-held (Held in escrow), sd-parked-payout (banner shows deal-proceeds only), sd-deposit-reserved.
## - Brand scrub: ONLY remaining "Dynopay" allowed = the footer/PDF/email legal-entity line "Operated by Dynopay Payments Ltd." (EMAIL_LEGAL_NAME). No "Binance" anywhere user-facing. No "held by Dynopay/Binance".


## 2026-09-21 — SafeDeal Telegram-friendly invitations + invite-by-link + add-email (BACKEND VERIFIED 14/14)
## - Vault/admin pass = Katiekendra123@ ; admin (Dynopay) = moxxcompany@gmail.com / Katiekendra123@.
## - SafeDeal sign-in unchanged: POST /api/safedeal/auth/send-code {email} -> data.preview_code (SAFE MODE) ->
##   POST /api/safedeal/auth/verify-code {email,code} -> data.token ; header x-safedeal-token=<token>.
## - NEW endpoints (all CSRF-exempt under /api/safedeal/account/ and /deals/:token/claim):
##   * POST /api/safedeal/deals {..., invite_by_link:true}  -> open-seat LINK deal (counterparty_email null, invite_kind='link', invite_url set).
##   * GET  /api/safedeal/deals/:token/preview              -> invite_kind, open_seat, claimed, counterparty_email_hint(null for link).
##   * POST /api/safedeal/deals/:token/claim                -> first signed-in non-creator claims the counterparty seat (409 if taken, 400 if creator).
##   * POST /api/safedeal/deals/:token/action {action:'regenerate-link'} -> creator-only, pre-funding; new deal_token, old dies.
##   * POST /api/safedeal/account/email/start {email} + /verify {code} -> add a real email to a (Telegram) account; 409 on collision (BLOCK, no merge);
##       verify re-issues token + connects pending email invites (returns connected_deals). me().user.email_is_placeholder tells UI if a real email is missing.
## - Migration 0045_safedeal_invite_link applied on live DB (invite_kind, counterparty_claimed_at, counterparty_email now nullable).
## - Frontend UI built (AddEmailDialog, shell "Add email" for Telegram users, DealsList banner, NewDeal invite-method choice,
##   DealPage claim/open-seat + creator link card + regenerate, Landing inline "Start a deal" quick form). FE testing NOT yet run.
- Throwaway brand 345 'QA Audit Empty Brand' created on user 1 for the E2E audit (2026-09-28) — DELETE after audit (POST /api/company/deleteCompany/345/send-otp → DELETE /api/company/deleteCompany/345 {otp})


## 2026-09-29 (fork, pt14) — SafeDeal account-takeover + AML hardening (SHIPPED, verified on LIVE prod DB)
- Migration 0054_safedeal_session_security (APPLIED to prod): tbl_safedeal_profile.tokens_valid_after + cashout_hold_until; tbl_customer_withdrawal.approval_reason.
- EMAIL CHANGE now needs step-up to the CURRENT mailbox (backend controller/safedealController.ts addEmailStart requires requireStepUp when email is not placeholder). On change: sessions invalidated (tokens_valid_after=NOW, enforced in async safedealAuth via isTokenIssuedBeforeCutoff, Redis-cached 5min key safedeal:tva:<cid>), 24h cashout hold, alert to OLD email (sendSafeDealEmailChangedAlertEmail). Verified e2e via curl + UI.
- VELOCITY: services/safedeal/safedealWithdrawals.ts requestWithdrawal now routes to pending_approval when (a) single manual/auto >= APPROVAL_THRESHOLD_USD ($200 in prod env), OR (b) cashout_hold active (ALL sources incl settlement), OR (c) rolling 24h sum + amount > VELOCITY_CAP_USD ($1000 default). approval_reason persisted + shown in admin panel. USER CONFIRMED: keep $200 single + $1000 rolling (USD).
- AML: flagNoDealCashout() logs + emails ADMIN_EMAIL (moxxcompany@gmail.com) when a manual/auto cashout happens with ZERO funded deals; throttled 1/24h/customer via redis safedeal:aml:nodeal:<cid>.
- BINANCE read-only diagnostic: binanceService.getApiKeyPermissions() (GET /sapi/v1/account/apiRestrictions) surfaced in /api/safedeal/admin/readiness check key=binance_key (only runs when live settlement ON). NOTE: preview pod is GEO-BLOCKED by Binance (HTTP 451 even via proxy) so live key values can only be read from the prod droplet.
- Admin cashouts panel (Components/Page/Admin/Escrow/AdminWithdrawals.tsx) shows "Held: <reason>" + a "deal payout" chip for settlement source. Approve & send / Reject & refund already existed.
- Test scripts (throwaway, self-cleanup): backend/scripts/sd_sectest_email.sh, sd_sectest_aml.sh + sd_sectest_withdraw.ts, sd_sectest_db.cjs, sd_sectest_seed_wd.cjs. Reserved test domain @example.com yields preview OTP codes (DISABLE_OUTBOUND_EMAIL=true).
- Admin API login: POST /api/admin/login {moxxcompany@gmail.com/Katiekendra123@} -> data.accessToken (NOT data.token). Admin FE token: localStorage.admin_token.
