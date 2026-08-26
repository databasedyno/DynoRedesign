# ============================================================================
# 2026-08-25 BUGFIX SESSION — storefront / checkout / payments (VERIFIED)
# ----------------------------------------------------------------------------
# Test merchant: handle "devhub" (company_id=1, user_id=1, owner hostbay@moxx.co),
#   product #9 "Talk to a Developer" ($100 USD, slug talk-to-a-developer).
#
# ROOT CAUSE (issue 3, critical): STOREFRONT_PER_COMPANY=true puts the vanity
#   handle on tbl_company, but cart/checkout/tax/tip resolved it via tbl_user
#   (userModel.findOne{handle}) -> "Merchant handle or ID required" / "not
#   accepting tips". FIX: use resolveStorefrontByHandle() everywhere.
#   Files: backend/controller/product/cartController.ts (validateCartApi,
#   startCheckout, quoteTax) + backend/controller/payment/paymentLinkController.ts
#   (startTip). Crowdfunding/donation (startDonation) resolves via payment-link
#   ref, NOT handle -> was NOT affected.
#
# OTHER FIXES:
#   - Optional payer email everywhere (checkout/tip/donation) — validated only
#     if provided; buyer_email/email null-safe. checkout email no longer required.
#   - Product publish now create-then-publish for new products (ProductEditor) —
#     no "save the draft first" dead-end.
#   - Added Telegram + Facebook to social-link options (CreatorPageSettings +
#     CreatorProfile + CreatorLivePreview). Empty socials still hidden.
#   - ShopHero share tray now labelled "Share" (was unlabeled; looked like socials).
#   - Price $99.91 was stale CDN cache; product/shop edge cache tightened
#     15s/30s, creator 30s/60s.
#   - Pre-existing lint cleanup: empty catch (cartController) + LinkCard/Stat
#     nested components -> render functions. tsc --noEmit = 0 errors; real
#     next eslint = 0 errors.
#
# VERIFICATION: read-only + fail-before-write curl probes (cart/checkout/tax/tip
#   all resolve devhub now) + Playwright rendering (store Share label, product
#   $100, cart/checkout no error, checkout email optional + pay enabled w/o email,
#   creator page + support-widget email field). DID NOT run deep_testing agents /
#   submit any payment — app is wired to the LIVE prod DB (would create real rows).
# ============================================================================



# ============================================================================
# 2026-08-25 (new pod) RE-SETUP — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://dynopay-setup-4.preview.emergentagent.com
# - Branch: Improvement
# - Env files REBUILT from a fresh full cred paste (no vault passphrase; env.vault.enc
#   NOT used). /app/.env (41 lines) + /app/backend/.env (226 lines) written by hand,
#   then `bash scripts/pod-bootstrap.sh` -> POD READY in 25s (deps already present).
# - SAFE MODE (same as all prior sessions — preview talks to the LIVE prod DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (no sweeps/settlement/cron/payouts)
#     REDIS_PUBLIC_URL -> .../15794/1 (isolated Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email)
#     DATABASE_URL set explicitly (URL/SSL branch of dbInstance.ts; Railway)
#     Binance SOCKS proxy commented out (geo-blocked; FX -> Tatum/CoinGecko, 10 cached prices)
#     NEXTAUTH_SECRET freshly generated (paste had the literal placeholder "openssl rand -base64 32")
#     /app/.env NEXT_PUBLIC_BASE_URL left EMPTY (relative /api/ browser calls; SSR uses INTERNAL_API_URL=:8001)
# - VERIFIED this session (read-only):
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational CLOSED, binance geo-blocked)
#     GET /api/public/tickers -> live prices (BTC ~$78k, ETH ~$2.4k)
#     POST /api/user/login (hostbay@moxx.co / Katiekendra123@) -> 200 "Login Successful!" (user_id=1)
#     External /auth/login SSR renders full UI (Dynopay/Email/Password/Log in), console clean (only "url for base" + HMR)
# - Merchant login: hostbay@moxx.co / Katiekendra123@ (user_id=1, company_id=1)
# - Admin email on record: moxxcompany@gmail.com (password NOT provided)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================



# ============================================================================
# 2026-08-25 (later) RE-SETUP (current pod) — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://dynopay-setup-4.preview.emergentagent.com
# - Branch: Improvement (latest, contains all other branches)
# - Env files REBUILT from a fresh full cred paste (no vault passphrase; env.vault.enc
#   NOT used). /app/.env + /app/backend/.env written by hand, then
#   `bash scripts/pod-bootstrap.sh` -> POD READY in 26s (deps were already present).
# - SAFE MODE (same as all prior sessions):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (no sweeps/settlement/cron)
#     REDIS_PUBLIC_URL -> .../15794/1 (isolated Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email)
#     DATABASE_URL set explicitly (URL branch of dbInstance.ts = SSL; Railway)
#     Binance SOCKS proxy + SSH tunnel commented out (geo-blocked; FX -> Tatum/CoinGecko)
#     NEXTAUTH_SECRET freshly generated (paste contained the literal placeholder)
#     /app/.env NEXT_PUBLIC_BASE_URL left EMPTY (relative browser calls; SSR uses INTERNAL_API_URL)
# - VERIFIED this session:
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational, binance geo-blocked)
#     GET /api/public/tickers -> live prices (BTC ~$79k)
#     POST /api/user/login (hostbay@moxx.co / Katiekendra123@) -> 200 "Login Successful!" (user_id=1)
#     External / and /auth/login render full UI (screenshot-verified)
# - Merchant login: hostbay@moxx.co / Katiekendra123@ (user_id=1, company_id=1)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# ============================================================================
# 2026-08-25 RE-SETUP (prior pod) — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://dynopay-setup-4.preview.emergentagent.com
# - Env files REBUILT from a fresh full cred paste by the user (no vault passphrase
#   this session; env.vault.enc NOT used). /app/.env + /app/backend/.env written by
#   hand, then `bash scripts/pod-bootstrap.sh` synced URLs + enforced SAFE MODE.
# - SAFE MODE (same as prior sessions, per user's earlier "option 1a" choice):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary  (no sweeps/settlement/
#       payouts/webhook worker/cron — no on-chain money movement)
#     REDIS_PUBLIC_URL -> .../15794/1  (isolated Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true     (no Brevo email to real merchants)
#     DATABASE_URL set explicitly (URL branch of dbInstance.ts = SSL; Railway)
#     Binance SOCKS proxy + SSH tunnel commented out (geo-blocked; FX -> Tatum/CoinGecko)
#     NEXTAUTH_SECRET freshly generated (paste contained a placeholder)
# - VERIFIED this session:
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational, binance geo-blocked)
#     GET /api/public/tickers -> live prices (BTC ~$79k)
#     POST /api/user/login (hostbay@moxx.co / Katiekendra123@) -> 200 "Login Successful!"
#       (user_id=1, company_id=1)
#     External /auth/login renders full UI (screenshot-verified)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# ============================================================================
# 2026-08-24 RE-SETUP (this session) — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://dynopay-setup-4.preview.emergentagent.com
# - Env files were REBUILT DIRECTLY from a fresh full cred paste by the user
#   (NOT restored from env.vault.enc — no passphrase was provided this session).
# - /app/backend/.env and /app/.env written by hand; SAFE MODE enforced:
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary  (no sweeps/settlement/
#     payouts/webhook worker/cron — no on-chain money movement)
#     REDIS_PUBLIC_URL -> .../15794/1   (isolated to Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true       (no Brevo email to real merchants)
#     DATABASE_URL set explicitly (URL branch of dbInstance.ts = SSL on; Railway needs it)
#     Binance SOCKS proxy + SSH tunnel commented out (geo-blocked here; FX -> Tatum/CoinGecko)
#     All public URLs rewritten to this preview host; CORS appended with it.
# - VERIFIED this session:
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational, binance geo-blocked).
#     external /  -> 200; external /api/public/tickers -> live prices.
#     POST /api/user/login (hostbay@moxx.co) -> 200 "Login Successful!" (user_id=1, company_id=1).
#     Boot migrations: "0 applied, 4 present" => NO schema changes to prod.
# - Login (verified 200 this session): hostbay@moxx.co / Katiekendra123@
# - Admin email on record: moxxcompany@gmail.com (password NOT provided).
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# DynoPay — Emergent Preview Setup Notes (prod-connected, SAFE MODE)

## Status: RUNNING — connected to the user's LIVE Railway PostgreSQL + Redis
- Preview URL: https://dynopay-setup-4.preview.emergentagent.com
- Architecture: Next.js (`:3000`) + Node/Express backend (`server.ts` on `:3300`) behind a
  Python/uvicorn proxy (`server.py` on `:8001`, the `/api/*` ingress target). Proxy forwards
  `/api/*` to Node and stubs `/api/auth/*` (NextAuth) with empty JSON.

## SAFETY CONSTRAINTS (user chose option 1a: real prod DB, jobs OFF)
- Connected to PRODUCTION Railway PG (real merchant/payment data, 71 tables). Verified boot:
  migrations "0 applied, 3 present" => NO schema changes made to prod.
- Background jobs DISABLED: `ENABLE_BACKGROUND_JOBS=false` + `WORKER_ROLE=secondary`
  => no crypto sweeps, settlement, reconciliation, BullMQ webhook worker, or cron
  (confirmed by boot log "Skipping ... (background jobs disabled)" + health eligible=false).
- Redis ISOLATED to DB index /1 (`REDIS_PUBLIC_URL=...:15794/1`) so the preview can never
  touch/delete production's DB-0 cron locks or pollute its cache (protects `cleanupStaleLocks`).
- OUTBOUND EMAIL KILL-SWITCH: `DISABLE_OUTBOUND_EMAIL=true` — added a guard in
  `backend/utils/mailTransporter.ts` that suppresses ALL Brevo email from this pod
  (prevents "New Visitor" admin spam + any accidental real merchant/customer emails).
- SSH tunnel + Binance SOCKS proxy DISABLED (Binance geo-blocked 451 here). FX rates fall
  back to Tatum/CoinGecko — working (40 rates refreshed, real BTC/ETH/etc prices).
- NODE_ENV=production (idempotent versioned migrations, SSL to Railway; NOT alter:true).

## ⚠️ FOR TESTING AGENTS
- This is wired to the user's PRODUCTION database. DO NOT run write-heavy automated tests
  that create users / payments / wallets / payment-links. Prefer READ-ONLY verification.
- Do NOT call deep_testing agents against this without the main agent's explicit scoping.

## Login / test credentials (verified against prod DB in a prior session)
- Merchant login: `hostbay@moxx.co` / `Katiekendra123@`
  (user_id=1, company_id=1 — main QA merchant with real data, ~$18k volume).
  POST /api/user/login -> 200 (note: login may update last_login).
- Admin email on record: moxxcompany@gmail.com (password NOT provided).

## Env files (created this session; gitignored)
- /app/backend/.env — all provided prod creds + DATABASE_URL (SSL, rejectUnauthorized=false);
  URLs -> preview; SAFE MODE gates; Redis /1; DISABLE_OUTBOUND_EMAIL; SSH/Binance-proxy commented.
- /app/.env — Next.js: NEXT_PUBLIC_BASE_URL=preview, INTERNAL_API_URL=http://localhost:3300,
  NEXTAUTH_*, NEXT_PUBLIC feature flags. FRONTEND_MODE=dev (hot reload).

## Verified this session (read-only)
- GET /health -> healthy (database=connected, redis=connected, background_jobs.eligible=false,
  tatum operational, binance_websocket geo-blocked as expected).
- GET /api/public/tickers, /api/public/fx-rates -> 200 with live rates.
- Frontend /, /auth/login, /dashboard, /pay -> 200; login page renders full UI, no console errors.


# ============================================================================
# 2026-08-26 — 9-ISSUE STOREFRONT/CHECKOUT FIX BATCH (this session)
# ----------------------------------------------------------------------------
# Preview URL (CORRECT): https://dynopay-setup-4.preview.emergentagent.com
#   (bootstrap auto-detected a STALE url d6d663a8-... from a read-only supervisor
#    APP_URL — it is DEAD/502. All env URL keys were re-pointed to dynopay-setup-4.)
# Merchant login (owns @devhub): hostbay@moxx.co / Katiekendra123@  (user_id=1, company_id=1)
# Test creator handle: devhub | product #9 "Talk to a Developer" ($100, slug talk-to-a-developer)
# STILL SAFE MODE + LIVE PROD DB: DISABLE_OUTBOUND_EMAIL=true (emails only logged as
#   "[Email] SUPPRESSED"), background jobs OFF. Prefer non-destructive tests.
# ⚠️ NEVER change the merchant's handle in tests (would break devhub's live URL).
#
# Fixes in this batch:
#  #1 CartContext.tsx — product/variant id coerced to Number (string-vs-number === bug
#     silently no-op'd qty +/- and remove).
#  #2 MiniCart.tsx (new) — floating cart pill (bottom-left) + drawer on shop & product
#     pages; email now REQUIRED on store checkout (backend cartController.startCheckout);
#     buyer emails fall back to email when no name (orderEmails.ts).
#  #2c product "one-off service (hide quantity)" toggle — new tbl_product.hide_quantity
#     column (migration addProductHideQuantity.ts, applied to prod), ProductEditor toggle
#     data-testid=product-hide-quantity-toggle, product page hides qty stepper.
#  #3 InlineTipCheckout refund-address field (data-testid inline-refund-toggle/-input)
#     -> POST /pay/setRefundAddress (backend already supported it).
#  #4 store checkout "Change amount" -> /{handle}/cart (was /shop); cart cleared only on
#     confirmed payment (onConfirmed); order number persists on refresh (sessionStorage).
#  #5 store checkout + inline pay strings now i18n (checkout.store.* + creator.inline.*
#     added to all 6 langs en/es/pt/fr/de/nl).
#  #6 SupportChatWidget desktop occlusion for data-dyno-anchor="cta"; publish row marked.
#  #7 backend social allowlist now includes telegram+facebook (was stripping them);
#     creator contact socials row now labelled "Find {name} on".
#  #8 $10 floor on tip/support/store (SupportWidget, CreatorPageSettings, backend
#     creatorProfile min>=10, store checkout min total 1000c).
#  #9 sendCreatorHandleUpdatedEmail (accountEmails.ts) fired on handle reserve/change
#     (email suppressed in preview; do NOT trigger by changing the live handle).
# ============================================================================
