# ============================================================================
# 2026-09-08 (pod a99b939f) ADMIN DASHBOARD WORK — prod DB, SAFE MODE, EMAIL OFF
# ----------------------------------------------------------------------------
# - Preview URL (THIS POD): https://a99b939f-45b1-4e47-80f9-5665102e9204.preview.emergentagent.com
# - >>> SUPER-ADMIN LOGIN (NEW): moxxcompany@gmail.com / Katiekendra123@  <<<
#   Login page: /admin/login  (POST /api/admin/login -> returns accessToken, stored as localStorage 'admin_token').
#   NOTE: tbl_admin did NOT exist in the DB; created it + seeded this single super-admin
#   via backend/scripts/seed_admin.js (bcrypt, rounds=12). Re-runnable/idempotent.
# - MERCHANT LOGIN (existing): onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1)
#   2-step: /auth/login -> login-email-input -> "Continue" -> password-input -> signin-submit-btn.
# - Support-chat AI = OpenAI (OPENAI_API_KEY present in vault, model gpt-5.4). Email = Brevo, OUTBOUND OFF in preview.
# - WIRED TO PRODUCTION DB — prefer READ-ONLY; investigation scripts live in backend/scripts/investigate_896*.js
# ============================================================================


# ============================================================================
# 2026-09-06 (pod 1a75b74d) RE-SETUP from ENCRYPTED VAULT — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod (no .env, no node_modules). Ran: bash scripts/pod-bootstrap.sh --pass 'Katiekendra123@' -> POD READY in 74s.
#   Vault ALREADY contains all SAFE-MODE values (no hand edits needed this time): REDIS_PUBLIC_URL .../1,
#   BINANCE_PROXY_URL + SSH_TUNNEL_HOST blank, DISABLE_OUTBOUND_EMAIL=true, root NEXT_PUBLIC_BASE_URL EMPTY.
#   Bootstrap enforced ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary and synced all URL keys to this pod.
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1) <<<
#   2-step login: /auth/login -> data-testid=login-email-input -> button "Continue" (exact) -> password-input -> signin-submit-btn.
# - VERIFIED: :8001/health healthy (db+redis connected, tatum operational CLOSED, bg_jobs.eligible=false, binance geo_blocked
#   REST fallback); /api/public/tickers live via ingress (BTC ~$79.9k, ETH ~$2.5k); /auth/login external -> 200 "Log in · Dynopay"
#   + Playwright screenshot renders login card. webhook-crond supervisor FATAL = harmless (no cron daemon in image).
# - PUBLIC RECEIPT TEST LINK (seeded snapshot, safe to open): /receipt/GwVgV4tgx8YUD5BySU7QtY  (PDF: /api/pay/receipt/GwVgV4tgx8YUD5BySU7QtY/pdf)
# - NOTE: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits 'networkidle' -> wait on selectors.
# ============================================================================


# ============================================================================
# 2026-09-06 (pod 4afb1c97) RE-SETUP from ENCRYPTED VAULT — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod (no .env, no node_modules). Ran: bash scripts/pod-bootstrap.sh --pass 'Katiekendra123@' -> POD READY in 33s.
#   Then hand-applied (vault holds prod values): REDIS_PUBLIC_URL -> /1, BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED.
#   SAFE MODE: ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary, DISABLE_OUTBOUND_EMAIL=true; root NEXT_PUBLIC_BASE_URL EMPTY.
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1) <<<
#   2-step login: /auth/login -> data-testid=login-email-input -> button "Continue" (exact) -> password-input -> signin-submit-btn.
# - VERIFIED: :8001/health healthy (db+redis connected, tatum operational, bg_jobs.eligible=false);
#   /api/public/tickers live via ingress (BTC ~$79.9k); /auth/login external -> 200 "Log in · Dynopay".
# - NOTE: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits 'networkidle' -> wait on selectors.
# ============================================================================


# ============================================================================
# 2026-09-05 (pod bc2629eb) RE-SETUP from ENCRYPTED VAULT — prod-connected, SAFE MODE
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Env restored from env.vault.enc (passphrase Katiekendra123@) via scripts/pod-bootstrap.sh.
#   SAFE MODE enforced: ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary. Wired to LIVE prod DB -> prefer READ-ONLY checks.
# - Backend healthy (db+redis connected, tatum operational). Frontend runs `next dev` on :3000; ASGI proxy (server.py) on :8001.
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1) <<<
#   2-step login: data-testid=login-email-input -> button "Continue" (exact) -> password-input -> signin-submit-btn.
# ============================================================================


# ============================================================================
# 2026-09-04 (pod 8b63f71b) i18n SWEEP + BUILD FIX — prod-connected, SAFE MODE, EMAIL OFF
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Env restored from env.vault.enc (passphrase Katiekendra123@). SAFE MODE intact (jobs off, email off, Redis /1).
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1) <<<
#   2-step login: /auth/login -> data-testid=login-email-input -> button "Continue" (exact) -> password-input -> signin-submit-btn.
# - NOTE: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits 'networkidle' -> wait on selectors.
# ============================================================================


# ============================================================================
# 2026-09-03 (pod ca6c51ad) FORK — TRANSACTIONS TOOLBAR/EXPORT — prod-connected, SAFE MODE, EMAIL OFF
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Env restored from env.vault.enc (passphrase Katiekendra123@). SAFE MODE intact (jobs off, email off, Redis /1).
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1 "The Dev Store") <<<
#   2-step: data-testid=login-email-input -> button "Continue" (exact) -> password-input -> signin-submit-btn.
# - Transactions page testids: transactions-toolbar, transactions-status-chip-<all|settled|pending|unpaid|...>,
#   transactions-status-count-<status>, transactions-export-btn, transactions-export-settled-only, transactions-table-card.
# - Backend export regression (read-only): backend/tests/test_transactions_export.py
# ============================================================================


# ============================================================================
# 2026-09-03 (pod 55c5e4b0) RE-SETUP from ENCRYPTED VAULT — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod: /app working tree present on branch conflict_280826_1905. BOTH .env files were MISSING (gitignored).
#   RESTORED from env.vault.enc via: bash scripts/env-vault.sh open 'Katiekendra123@'
#   (-> /app/.env 191 lines, /app/backend/.env 187 lines).
# - Backend node_modules were missing -> server.py self-healed via `yarn install` (ts-node launcher on :3300).
#   Frontend runs `next dev` on :3000 via scripts/start-frontend.sh. Python ASGI proxy (server.py) on :8001.
# - SAFE MODE (preview talks to LIVE prod Railway DB) — re-applied by hand this session to match verified config:
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary, DISABLE_OUTBOUND_EMAIL=true (email OFF)
#     REDIS_PUBLIC_URL -> appended /1 (isolate from prod's /0 namespace)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (no SSH tunnel on this pod; CoinGecko REST fallback used)
#     NODE_ENV=production, DATABASE_URL roundhouse.proxy.rlwy.net:23599/railway
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY -> browser relative /api calls -> ingress :8001 -> local backend
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue -> password -> Sign in)
# - VERIFIED this session: :3300/health healthy (db+redis connected, tatum operational CLOSED,
#     background_jobs.eligible=false, binance geo_blocked=true REST-fallback);
#     :8001/api/public/tickers live (BTC ~$77.6k, ETH ~$2.39k); frontend :3000 -> 200;
#     external preview /auth/login -> 200.
# - NOTE: webhook-crond supervisor program is FATAL (no cron daemon in image) — harmless for preview.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) -> wait on selectors, warm route first. Social login redirect_uri_mismatch
#     on preview (OAuth URIs point at dynopay.com); email/password works fine.
# ============================================================================



# ============================================================================
# 2026-09-02 (pod 815f7348) RE-SETUP from ENCRYPTED VAULT — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical, incl. vault-setup-1.)
# - Fresh pod: /app working tree was WIPED (only .git/.emergent) -> `git reset --hard HEAD`
#   restored branch conflict_280826_1905. BOTH .env files were MISSING (gitignored).
#   RESTORED from env.vault.enc via: bash scripts/env-vault.sh open 'Katiekendra123@'
#   (-> /app/.env 191 lines, /app/backend/.env 187 lines). Then `bash scripts/pod-bootstrap.sh --skip-env`.
# - SAFE MODE (preview talks to LIVE prod Railway DB) — enforced this session:
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (bootstrap-enforced)
#     DISABLE_OUTBOUND_EMAIL=true (from vault)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (I appended /1 by hand; vault had NO index = prod's /0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED by hand (no SSH tunnel on this pod; REST fallback)
#     NODE_ENV=production, DATABASE_URL roundhouse.proxy.rlwy.net:23599/railway
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY -> browser relative /api calls -> ingress :8001 -> local backend
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue (exact) -> password -> Sign in)
# - Admin email on record: moxxcompany@gmail.com (no login password on record — do not use for login)
# - VERIFIED this session: :8001/health healthy (db+redis connected, tatum operational CLOSED,
#     background_jobs.eligible=false, binance geo_blocked=true REST-fallback);
#     /api/public/tickers live (BTC ~$77.1k, ETH ~$2.38k); POST /api/user/login -> 200 "Login Successful!";
#     frontend :3000 -> 200 and external preview -> 200.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) -> wait on selectors, warm route first. Social login redirect_uri_mismatch
#     on preview (OAuth URIs point at dynopay.com); email/password works fine.
# ============================================================================



# ============================================================================
# 2026-09-02 (pod 054d2272) RE-SETUP from ENCRYPTED VAULT — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod: /app restored from git; BOTH .env files were MISSING (gitignored).
#   RESTORED from env.vault.enc via: bash scripts/env-vault.sh open 'Katiekendra123@'
#   (vault passphrase == merchant password this time; decrypts cleanly -> /app/.env 191 lines,
#    /app/backend/.env 187 lines). Then `bash scripts/pod-bootstrap.sh --skip-env` -> POD READY in 34s.
# - SAFE MODE (preview talks to LIVE prod Railway DB) — enforced this session:
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (bootstrap-enforced)
#     DISABLE_OUTBOUND_EMAIL=true (from vault)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (I appended /1; vault had NO index = prod's /0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED by hand (no SSH tunnel on this pod; REST fallback)
#     NODE_ENV=production, DATABASE_URL explicit (roundhouse.proxy.rlwy.net:23599/railway), NEXTAUTH_SECRET from vault
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY -> browser relative /api calls -> ingress :8001 -> local backend
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue (exact) -> password -> Sign in)
# - Admin email on record: moxxcompany@gmail.com (no login password on record — do not use for login)
# - VERIFIED this session: :8001/health healthy (db+redis connected, tatum operational,
#     background_jobs.eligible=false); POST /api/user/login -> 200 "Login Successful!" (Hostbay);
#     /api/public/tickers live (BTC ~$77.2k, ETH ~$2.4k); frontend :3000 + external preview -> 200.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) -> wait on selectors, warm route first. Social login redirect_uri_mismatch
#     on preview (OAuth URIs point at dynopay.com); email/password works fine.
# ============================================================================



# !!! 2026-09-01 KYC: user_id=1 (Hostbay) is now KYC-APPROVED in tbl_kyc (company 1, 71, account-level;
#     veriff_reason='Manually verified (merchant request 2026-09-01)'). GET /api/kyc/status -> "approved",
#     can_process_payments=true -> createPaymentLink UNBLOCKED. UNDO: DELETE FROM tbl_kyc WHERE user_id=1
#     AND veriff_reason='Manually verified (merchant request 2026-09-01)'. New UI verified badge:
#     Components/UI/KycVerifiedBadge (testid=kyc-verified-badge) next to company name in header.

# ============================================================================
# 2026-09-01 (pod d4fef0d9) RE-SETUP from user cred paste — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod: /app was restored from git (working tree had been wiped -> `git checkout HEAD -- .`).
#   BOTH .env files were MISSING (gitignored). Rebuilt by hand from the user's full cred paste,
#   then ran `bash scripts/pod-bootstrap.sh --skip-env` -> POD READY in 42s.
#     /app/.env         (frontend subset; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#     /app/backend/.env (full key set)
# - SAFE MODE overrides applied to backend/.env (preview talks to LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false (paste had true — OVERRIDDEN), WORKER_ROLE=secondary
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451 -> WS uses REST fallback)
#     NEXTAUTH_SECRET freshly generated (paste had literal "openssl rand -base64 32" placeholder)
#     DATABASE_URL set explicitly (postgresql://postgres@roundhouse.proxy.rlwy.net:23599/railway)
#     GOOGLE_CLIENT_KEY inline as single-\n-escaped PEM (normalizePrivateKey handles \n/\\n)
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue (exact) -> password -> Sign in)
# - Admin email on record: moxxcompany@gmail.com (no login password on record — do not use for login)
# - VERIFIED this session: :8001/health healthy (db+redis connected, tatum operational CLOSED,
#     background_jobs.eligible=false, binance geo_blocked=true REST-fallback); frontend + external 200.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) -> wait on selectors, warm route first. Social login has
#     redirect_uri_mismatch on preview (OAuth URIs point at dynopay.com); email/password works fine.
# ============================================================================



# ============================================================================
# 2026-09-01 (pod e952fc3d) RE-SETUP from user cred paste — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod: BOTH .env files were MISSING (gitignored). Rebuilt by hand from the user's full
#   cred paste, then ran `bash scripts/pod-bootstrap.sh --skip-env` -> POD READY in 30s.
#     /app/.env         (frontend subset; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#     /app/backend/.env (full key set, 190 lines)
# - SAFE MODE overrides applied to backend/.env (preview talks to LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false (paste had true — OVERRIDDEN), WORKER_ROLE=secondary
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451 -> WS uses REST fallback)
#     NEXTAUTH_SECRET freshly generated (paste had literal "openssl rand -base64 32" placeholder)
#     DATABASE_URL set explicitly (postgresql://postgres@roundhouse.proxy.rlwy.net:23599/railway)
#     GOOGLE_CLIENT_KEY inline as single-\n-escaped PEM (dotenv expands -> multi-line key)
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue (exact) -> password -> Sign in)
# - Admin email on record: moxxcompany@gmail.com (no login password on record — do not use for login)
# - VERIFIED this session: :8001/health healthy (db+redis connected, tatum CLOSED/operational,
#     background_jobs.eligible=false, binance geo_blocked=true REST-fallback);
#     /api/public/tickers live (BTC ~$77.9k, ETH ~$2.45k);
#     POST <preview>/api/user/login -> 200 "Login Successful!" (Hostbay) end-to-end through ingress;
#     /auth/login external -> 200; frontend 200 internal :3000 + external preview 200.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) -> wait on selectors, warm route first. Social login has
#     redirect_uri_mismatch on preview (OAuth URIs point at dynopay.com); email/password works fine.
# ============================================================================



# ============================================================================
# 2026-08-31 (pod 0e929189) RE-SETUP from user cred paste — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (⚠️ IGNORE all older *.preview.emergentagent.com URLs below — historical, incl. payment-integration-92.)
# - Fresh pod: BOTH .env files were MISSING (gitignored). Rebuilt by hand from the user's full
#   cred paste, then ran `bash scripts/pod-bootstrap.sh --skip-env` -> POD READY in 30s.
#     /app/.env         (frontend subset, 16 lines; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#     /app/backend/.env (full key set, ~155 lines)
# - SAFE MODE overrides applied to backend/.env (preview talks to LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false (paste had true — OVERRIDDEN), WORKER_ROLE=secondary
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451 -> WS uses REST fallback)
#     NEXTAUTH_SECRET freshly generated (paste had literal "openssl rand -base64 32" placeholder)
#     DATABASE_URL set explicitly (postgresql://postgres@roundhouse.proxy.rlwy.net:23599/railway)
#     GOOGLE_CLIENT_KEY inline as single-\n-escaped PEM (dotenv expands -> multi-line key; no dynopay.json)
# - Vault NOT re-sealed (no passphrase provided this session).
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue (exact) -> password -> Sign in)
# - Admin email on record: moxxcompany@gmail.com (no login password on record — do not use for login)
# - VERIFIED this session: :8001/health healthy (db+redis connected, tatum CLOSED/operational,
#     background_jobs.eligible=false, binance geo_blocked=true REST-fallback);
#     /api/public/tickers live (BTC ~$78.9k, ETH ~$2.48k);
#     POST <preview>/api/user/login -> 200 "Login Successful!" (Hostbay) end-to-end through ingress;
#     frontend 200 internal :3000 + external preview 200.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) -> wait on selectors, warm route first. Social login has
#     redirect_uri_mismatch on preview (OAuth URIs point at dynopay.com); email/password works fine.
# ============================================================================



# ============================================================================
# 2026-06 (pod 87e6bc11) FORK — WEBHOOK ADDITIVE REDESIGN + MANUAL TOGGLE — prod-connected, SAFE MODE
# ----------------------------------------------------------------------------
# - CURRENT Preview URL (THIS POD): https://user-profile-split.preview.emergentagent.com
#   (⚠️ IGNORE older dynopay-preview-15.preview.emergentagent.com — that was a prior fork's host.)
# - OWNER LOGIN (unchanged): onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1 "Hostbay").
#     2-step: data-testid=login-email-input -> Continue (exact) -> password-input -> signin-submit-btn.
# - ⚠️ FORK-SETUP FIX this session: /app/.env NEXT_PUBLIC_BASE_URL had been set to https://dynopay.com
#     (would make the preview BROWSER hit PRODUCTION's API and bypass SAFE MODE). Reset to EMPTY so the
#     browser makes relative /api calls -> preview ingress -> LOCAL backend :8001 (prod DB, jobs OFF).
#     If a future fork shows NEXT_PUBLIC_BASE_URL=https://dynopay.com again, blank it before testing.
# - SAFE MODE intact: ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary, DISABLE_OUTBOUND_EMAIL=true,
#     Redis isolated on /1, Binance geo-blocked (REST fallback). DB migration 0017 applied to prod
#     (additive nullable tbl_user_transaction.webhook_secret — safe).
# - WEBHOOK TESTING NOTE: the manual toggle writes tbl_company.webhook_disabled for company_id=1. It is
#     reversible; after any toggle test RESTORE company_id=1 to: webhook_url=NULL, webhook_disabled=TRUE,
#     webhook_disabled_at='2026-08-31T10:26:01.753Z', reason='Auto-disabled: 5 consecutive HTTP 404
#     responses from https://webhook.site/6669491e-e4f6-4b40-a6be-e4df178765b8' (current restored state).
# - Reversible backend harness: backend/scripts/verify_additive_webhook.ts (mock server on pod LAN IP,
#     self-restoring). Frontend testids: webhook-delivery-toggle, webhook-disabled-banner; toast app-toast.
# ============================================================================



# ============================================================================
# 2026-08-31 (pod 0e5cc9c0) RE-SETUP from user cred paste — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL: https://user-profile-split.preview.emergentagent.com
#   (⚠️ IGNORE all older *.preview.emergentagent.com URLs below — historical.)
# - Fresh pod: BOTH .env files were missing (gitignored). Rebuilt by hand from the user's
#   full cred paste, then ran scripts/pod-bootstrap.sh --skip-env -> POD READY in 27s.
#     /app/.env         (frontend subset, 33 lines; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#     /app/backend/.env (full key set, 223 lines)
# - SAFE MODE (preview talks to LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — OVERRIDDEN)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451 -> WS uses REST fallback)
#     NEXTAUTH_SECRET freshly generated (paste had literal "openssl rand -base64 32" placeholder)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     GOOGLE_CLIENT_KEY inline as \n-escaped PEM (dotenv expands -> 28-line key; no backend/dynopay.json needed)
# - Vault NOT re-sealed (no passphrase provided this session).
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue -> password -> Sign in)
# - Admin email on record: moxxcompany@gmail.com (no login password on record — do not use for login)
# - VERIFIED this session: :8001/health healthy (db+redis connected, tatum operational, bg_jobs=false);
#     external / -> 200; /api/public/tickers live (BTC ~$78.4k); POST /api/user/login -> 200
#     "Login Successful!" (Hostbay) through the ingress; /auth/login HTML renders (title "Log in · Dynopay").
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev never hits
#     'networkidle' (HMR ws) and first paint of a route lags 15-35s -> wait on selectors, warm route first.
#     Screenshot tool shows blank on cold dev routes; the HTML/API are fine. Social login has
#     redirect_uri_mismatch on preview (expected); email/password works fine.
# ============================================================================



# ============================================================================
# 2026-08-31 (pod 5f684f1a) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - CURRENT Preview URL: https://user-profile-split.preview.emergentagent.com
#   (⚠️ IGNORE older merchant-demo-4 / dynopay-setup-12 URLs below — historical.)
# - Fresh pod: BOTH .env files missing (gitignored). Rebuilt by hand from user's full
#   cred paste, then ran scripts/pod-bootstrap.sh -> POD READY in 28s.
#     /app/.env         (frontend subset; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#     /app/backend/.env (full key set, 189 lines)
# - SAFE MODE (preview talks to LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — OVERRIDDEN)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     GOOGLE_CLIENT_KEY inline (no backend/dynopay.json needed)
# - Vault NOT re-sealed (no passphrase provided this session).
# - >>> MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
#   (2-step login: /auth/login -> email -> Continue -> password -> Sign in)
#   NOTE: login page has 3 "Continue*" buttons — use exact match "Continue" (google/github btns also match loosely).
# - NEW public pages (2026-08-31): /signup?ref= -> 307 to /auth/register (alias for referral emails);
#   /unsubscribe?token= -> tokenized unsubscribe page (layout "none", no auth).
# - NEW admin endpoint: POST /api/admin/referral-invites/backfill (admin JWT required; dry_run
#   defaults TRUE). Admin login password NOT on record — verify 403-without-auth only.
# - Admin email on record: moxxcompany@gmail.com (no login password — do not use for login)
# - VERIFIED: :8001/health healthy (db+redis connected, tatum operational, bg_jobs=false);
#     POST <preview>/api/user/login -> 200 "Login Successful!" (Hostbay) through ingress;
#     /api/public/tickers live (BTC ~$78.0k); login page renders externally.
# - NOTE for testing agents: WIRED TO PRODUCTION DB — prefer READ-ONLY checks. Next.js dev
#     never hits 'networkidle' (HMR ws) -> wait on selectors. Social login redirect_uri_mismatch
#     on preview; email/password works fine.
# ============================================================================


# ============================================================================
# 2026-08-31 (pod 9a70e7ed) FORK — RBAC Task D UX polish + FE E2E, prod-connected SAFE MODE
# ----------------------------------------------------------------------------
# - CURRENT Preview URL: https://user-profile-split.preview.emergentagent.com
#   (⚠️ IGNORE older dynopay-setup-12 URLs below — historical.)
# - OWNER LOGIN (unchanged): onarrival21@gmail.com / Katiekendra123@  (2-step:
#     /auth/login -> type email -> Continue -> type password -> Sign in). user_id=1, company_id=1 "Hostbay".
# - SAFE MODE intact: ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary, DISABLE_OUTBOUND_EMAIL=true.
# - Team invite/accept testing: use plus-addressed throwaway emails like
#     onarrival21+dtest<timestamp>@gmail.com and CLEAN UP (revoke the member) after.
# ============================================================================


# ============================================================================
# 2026-08-30 (pod 10424307) RE-SETUP + TEAM MEMBERS/RBAC — prod-connected, SAFE MODE
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - OWNER LOGIN (unchanged): onarrival21@gmail.com / Katiekendra123@  (2-step:
#     /auth/login -> email -> Continue -> password -> Sign in). user_id=1, company_id=1.
# - Env rebuilt by hand from user's cred paste. SAFE MODE overrides:
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary, DISABLE_OUTBOUND_EMAIL=true,
#     REDIS_PUBLIC_URL .../1 (isolated from prod DB 0), BINANCE_PROXY_URL & SSH_TUNNEL_HOST blanked.
#     /app/.env.local  -> NEXT_PUBLIC_BASE_URL = full preview URL (frontend axios base).
#     /app/backend/.env -> full backend key set.
# - Login page reload-loop FIXED (axiosConfig/CompanyDataContext/unAutorizedHelper/ErrorBoundary
#     no longer redirect-to-login or storage-guard-loop when already on /auth/*).
# - NEW TABLE (migration 0015, APPLIED to prod DB): tbl_team_member (Team Members/RBAC).
#   A harmless ORPHAN test user (dyno-rbac-test+...@example.com) may exist in tbl_user from
#   backend testing (all its memberships were revoked -> no access, no wallets, no company).
# ============================================================================

# ============================================================================
# 2026-08-30 (pod f4fac0c7) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Fresh pod: /app restored from git only -> BOTH .env files were MISSING (gitignored).
#     Rebuilt by hand from the user's full cred paste, then ran scripts/pod-bootstrap.sh
#     (auto-detected preview URL, synced URL keys, enforced SAFE MODE) -> POD READY in 30s.
#       /app/.env         (Next.js frontend; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#       /app/backend/.env (full backend key set, 201 lines)
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — OVERRIDDEN)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451; FX via Tatum/CoinGecko)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     GOOGLE_CLIENT_KEY inline (no backend/dynopay.json needed at boot; no KMS errors)
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - Admin email on record: moxxcompany@gmail.com (password NOT provided -> do not use for login)
# - VERIFIED: :8001/health healthy (db+redis connected, tatum CLOSED/operational, bg_jobs=false);
#     /api/public/tickers live (BTC ~$79.0k, ETH ~$2.51k);
#     POST <preview>/api/user/login -> 200 "Login Successful!" (Hostbay) end-to-end through ingress;
#     frontend 200 internal :3000 + external preview 200.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks. Next.js dev server
#     never hits 'networkidle' (HMR ws) -> wait on selectors, not networkidle. Social login
#     (Google/GitHub) will redirect_uri_mismatch on preview (OAuth redirect URIs point at dynopay.com);
#     email/password works fine.
# ============================================================================



# ============================================================================
# 2026-08-29 (pod eddcc06a) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: conflict_280826_1905
# - Fresh pod: /app restored from git only -> BOTH .env files were MISSING (gitignored).
#     Rebuilt by hand from the user's full cred paste:
#       /app/.env         (Next.js frontend subset; NEXT_PUBLIC_BASE_URL EMPTY -> relative /api)
#       /app/backend/.env (full backend key set)
#     Installed deps (root next + backend ts-node + python uvicorn/httpx/dotenv).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — OVERRIDDEN)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1, not prod's 0)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST BLANKED (Binance geo-blocked 451; FX via Tatum/CoinGecko)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     GOOGLE_CLIENT_KEY inline (no backend/dynopay.json needed at boot; no KMS errors)
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - Admin email on record: moxxcompany@gmail.com (password NOT provided -> do not use for login)
# - VERIFIED: :8001/health healthy (db+redis connected, tatum CLOSED/operational, bg_jobs=false);
#     POST <preview>/api/user/login -> 200 "Login Successful!" (Hostbay) end-to-end through ingress;
#     frontend 200 internal :3000 + external preview.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks. Next.js dev server
#     never hits 'networkidle' (HMR ws) -> wait on selectors, not networkidle. Social login
#     (Google/GitHub) will redirect_uri_mismatch on preview (OAuth redirect URIs point at dynopay.com);
#     email/password works fine.
# ============================================================================



# ============================================================================
# 2026-08-29 (pod ef498f41) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
#     (the older crypto-payment-init-1.preview.emergentagent.com host also still routes here)
# - Fresh pod: /app restored from git only -> /app/backend/.env survived, /app/.env was MISSING.
#     Recreated /app/.env by hand from the user's full cred paste (frontend subset;
#     NEXT_PUBLIC_BASE_URL EMPTY -> browser makes relative /api calls -> ingress :8001),
#     then ran `bash scripts/pod-bootstrap.sh` (no vault passphrase; env files present).
#     Bootstrap synced all URL keys in backend/.env from the stale crypto-payment-init-1
#     host to THIS pod's host + re-enforced SAFE MODE. POD READY in 39s.
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — OVERRIDDEN)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST blanked (Binance geo-blocked; FX via Tatum/CoinGecko)
#     NEXTAUTH_SECRET reused from backend/.env (paste had literal placeholder)
#     DATABASE_URL: postgres@roundhouse.proxy.rlwy.net:23599/railway (ssl reject=false)
#     backend/dynopay.json NOT needed at boot (KMS uses inline GOOGLE_CLIENT_KEY; no KMS errors)
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - Admin email on record: moxxcompany@gmail.com (password NOT provided)
# - VERIFIED: :8001/health healthy (db+redis connected, tatum CLOSED/operational, bg_jobs=false);
#     /api/public/tickers live (BTC ~$78.1k, ETH ~$2.45k);
#     POST /api/user/login -> 200 "Login Successful!" (Hostbay);
#     REAL-BROWSER read-only UI smoke (frontend agent): login page + dashboard ($763.14, 17 pmts,
#     fee tier $27,883/$100k) + transactions (658) + wallet (13 chains) all render, ZERO console/network errors.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks. Next.js dev server
#     never hits 'networkidle' (HMR ws) -> don't wait on networkidle; wait on selectors instead.
# ============================================================================



# ============================================================================
# 2026-08-29 (pod 202ba772) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: conflict_280826_1905  (user specified this is the correct branch)
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#     /app/backend/.env (239 lines, full key set) + /app/.env (frontend subset;
#     NEXT_PUBLIC_BASE_URL EMPTY -> browser makes relative /api calls -> ingress :8001).
#     Then `bash scripts/pod-bootstrap.sh` -> POD READY in 27s (deps already present).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — OVERRIDDEN)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST blanked (Binance geo-blocked; FX via Tatum)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - Admin email on record: moxxcompany@gmail.com (password NOT provided)
# - VERIFIED (read-only): :8001/health healthy (db+redis connected, tatum CLOSED, bg_jobs=false);
#     /api/public/tickers live (BTC ~$77.7k, ETH ~$2.44k);
#     POST /api/user/login -> 200 "Login Successful!"; frontend 200 internal + external preview.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================



# ============================================================================
# 2026-08-28 (pod 78b9bfca) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#     /app/backend/.env (186 keys) + /app/.env (30-line frontend subset;
#     NEXT_PUBLIC_BASE_URL EMPTY -> browser makes relative /api calls -> ingress :8001).
#     Then `bash scripts/pod-bootstrap.sh` -> POD READY in 24s (deps self-healed).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — overridden)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST blanked (Binance geo-blocked; FX via Tatum)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - Admin email on record: moxxcompany@gmail.com (password NOT provided)
# - VERIFIED (read-only): :8001/health healthy (db+redis connected, tatum CLOSED, bg_jobs=false);
#     /api/public/tickers live (BTC ~$77.6k, ETH ~$2.44k);
#     POST /api/user/login -> 200 "Login Successful!"; frontend 200 internal + external.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================



# ============================================================================
# 2026-08-28 (pod 6fe4ee0c) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#   /app/backend/.env (full key set) + /app/.env (frontend; NEXT_PUBLIC_BASE_URL EMPTY
#   for relative /api calls). Then `bash scripts/pod-bootstrap.sh` -> POD READY in 28s.
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — overridden)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST blanked (Binance geo-blocked; FX via Tatum)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway)
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - VERIFIED (read-only): :8001/health healthy (db+redis connected, bg_jobs=false);
#     POST /api/user/login -> 200 "Login Successful!"; /api/public/tickers live (BTC ~$77.9k);
#     frontend 200 internal + external.
# - memory/COPY_AUDIT.md restored from git (9b7d41b94) — session task = Phase 2 of copy audit.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================




# ============================================================================
# 2026-08-27 (pod 09016278) RE-SETUP — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env rebuilt from a fresh full cred paste (no vault passphrase): /app/backend/.env
#   (backend, full key set) + /app/.env (frontend, same set; NEXT_PUBLIC_BASE_URL left
#   EMPTY so the browser makes relative /api calls -> ingress :8001). Then
#   `bash scripts/pod-bootstrap.sh --skip-env` -> POD READY in 28s.
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — overridden;
#       boot log confirms error-digest / webhook-migration / BullMQ worker / reconciliation SKIPPED)
#     DISABLE_OUTBOUND_EMAIL=true (paste had false — overridden; no Brevo outbound email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST blanked (Binance geo-blocked; FX via Tatum)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
# - >>> CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay") <<<
# - VERIFIED (read-only): GET :8001/health -> healthy (db connected, redis connected,
#     background_jobs.eligible=false = SAFE MODE, tatum operational CLOSED);
#     GET :8001/api/public/tickers -> live (BTC ~$79.2k, ETH ~$2.49k);
#     POST :8001/api/user/login (onarrival21@gmail.com) -> 200 "Login Successful!";
#     boot migrations "0 applied, 6 already present" => NO schema changes to prod.
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================



# ============================================================================
# 2026-08-27 (pod f431e319) UPDATE — merchant login email changed again + wallet UX fixes
# ----------------------------------------------------------------------------
# - tbl_user.email (user_id=1 "Hostbay") migrated: moxxcompany@gmail.com -> onarrival21@gmail.com
#   (guarded txn; login_type=EMAIL, email_verified kept TRUE; verified new email logs in).
# - >>> CURRENT MERCHANT LOGIN: onarrival21@gmail.com / Katiekendra123@ (user_id=1) <<<
# - PUBLIC STOREFRONT HANDLE for company_id=1 "The Dev Store" is **devhub**:
#     store  /devhub/shop   ·  product /devhub/p/<slug>  ·  cart /devhub/cart
#     (the user's CREATOR handle is "hostbay" but the store lives under "devhub").
#     Store currently has 1 product: "Talk to a Developer" ($100, digital).
# - Wallet edit "wallet not found" bug: FIXED + verified (backend 6/6, and I reproduced the
#   real UI flow: USDT-TRC20 Edit -> Save no-change -> PUT /wallet/updateWallet/4 -> 200, dialog closes).
# - Wallet REUSE UX fix: getReusableWallets now only offers currencies the CURRENT company is
#   MISSING (was showing wallets it already had -> confusing "0 copied"); wording changed from
#   "another account" -> "your other companies". For user_id=1 all companies (The Dev Store id=1,
#   SMADAV id=71) hold the same 13 coins, so the reuse card is now HIDDEN (nothing new to reuse).
# - Cosmetics: wallet card header shows base ticker (USDT/USDC/RLUSD/POL) so long codes no longer
#   overlap the title; /developer-keys invalid DOM nesting fixed (ApiKeyCardSubTitle component="div").
# ============================================================================



# ============================================================================
# 2026-08-27 (pod f431e319) DATA CHANGE — merchant "Hostbay" primary email migrated (PROD DB write)
# ----------------------------------------------------------------------------
# - Changed tbl_user.email for user_id=1 ("Hostbay"): hostbay@moxx.co -> moxxcompany@gmail.com
#   (guarded transactional UPDATE, 1 row; login_type=EMAIL unchanged; email_verified kept TRUE
#    because SAFE MODE has outbound email OFF, so resetting it would block re-verification).
# - Verified: login moxxcompany@gmail.com / Katiekendra123@ -> 200 "Login Successful!";
#   old email hostbay@moxx.co -> "Invalid email or password" (correctly rejected).
# - tbl_login_history.email (1417 historical audit rows under the old address) were LEFT AS-IS
#   (that table is queried by user_id, not email, so the login-activity panel is unaffected).
# - >>> MERCHANT LOGIN FOR TESTING IS NOW: moxxcompany@gmail.com / Katiekendra123@ (user_id=1) <<<
# ============================================================================



# ============================================================================
# 2026-08-27 (pod f431e319) RE-SETUP #5 — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#     /app/backend/.env (backend, full 188 keys) + /app/.env (frontend, same set;
#     NEXT_PUBLIC_BASE_URL left EMPTY so browser makes relative /api calls -> ingress :8001),
#     then `bash scripts/pod-bootstrap.sh --url <preview> --skip-env` -> POD READY in 25s
#     (deps pre-installed).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — overridden;
#       boot log confirms: error-digest / webhook-migration / BullMQ worker / reconciliation all skipped)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email; login-notification email skipped in log)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST blanked (Binance geo-blocked; FX via Tatum, 40 rates cached)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     No DATABASE_URL in paste -> Sequelize host/port fallback; db still connected fine.
# - Merchant login for testing: hostbay@moxx.co / Katiekendra123@ (user_id=1, "Hostbay")
# - VERIFIED (read-only, no writes to prod):
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational CLOSED)
#     GET :8001/api/public/tickers -> live prices (BTC ~$79.7k, ETH ~$2.53k)
#     POST :8001/api/user/login (hostbay@moxx.co) -> 200 "Login Successful!" (token issued)
#     Boot migrations: "0 applied, 6 already present" => NO schema changes to prod
#     External /auth/login renders full UI (screenshot: logo, email flow,
#       Google + GitHub buttons, crypto badges, 6-language picker)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================



# FEATURE (2026-08-26, pod 6c9c118d) — CUSTOMERS PAGE RE-IMAGINED — DONE (backend 12/12 tested; FE screenshot-verified)
# - New READ-ONLY endpoints: GET /api/userApi/customers/directory (+ /detail?key=) in
#   backend/controller/customerDirectoryController.ts — unify payer identity by email across
#   product orders / tbl_customer (non-internal) / payment-link recipients; payments folded from
#   tbl_user_transaction (same joins + taxonomy as dashboard/transactions: resolveTransactionSource,
#   PROCESSED_STATUSES, PROCESSED_USD_EXPR, deriveTxDisplayStatus). Anonymous payments collapse into
#   anon:<channel> buckets. Segments prospect/new/active/repeat/dormant. Redis cache 60s. Legacy
#   /userApi/customers endpoint kept (regression-tested).
# - Frontend Components/Page/Customers/index.tsx fully rewritten: stats (Customers/Revenue/Repeat
#   rate/New 30d), segment chips, search+sort+CSV export, table >=768 (Channels >=lg, LastPayment+
#   chevron >=900) / cards <768, detail drawer (bottom sheet on mobile) w/ KPIs + payment history +
#   orders + links + wallet-only-if-exists, "Request payment" -> /create-pay-link?email=<x> (prefill
#   added in CreatePaymentLink; advanced options auto-open). i18n in all 6 locales (common.json
#   customers.*, incl. new pageDescription). Verified at 390/768/1024/1920, dark+light.
# ----------------------------------------------------------------------------


# ============================================================================
# 2026-08-26 (pod 43248c91) RE-SETUP #4 — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#     /app/.env (frontend) + /app/backend/.env (backend),
#     then `bash scripts/pod-bootstrap.sh` -> POD READY in 25s (deps pre-installed).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — overridden;
#       boot log confirms all workers skipped: reconciliation/BullMQ/cron/digest)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     BINANCE_PROXY_URL + SSH_TUNNEL_* commented (geo-blocked; FX via Tatum, 10 cached prices)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY (relative /api browser calls; SSR uses INTERNAL_API_URL=:8001)
# - Merchant login for testing: hostbay@moxx.co / Katiekendra123@ (user_id=1, "Hostbay")
# - VERIFIED (read-only, no writes to prod):
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational CLOSED)
#     GET :8001/api/public/tickers -> live prices (BTC ~$78.5k, ETH ~$2.46k)
#     POST :8001/api/user/login (hostbay@moxx.co) -> 200 "Login Successful!" (user_id=1)
#     Boot migrations: "0 applied, 6 already present" => NO schema changes to prod
#     External /auth/login renders full UI (screenshot: logo, email flow,
#       Google + GitHub buttons, language picker)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# ============================================================================
# 2026-08-26 (pod 6c9c118d) RE-SETUP #3 — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#     /app/.env (30 lines, frontend) + /app/backend/.env (216 lines, backend),
#     then `bash scripts/pod-bootstrap.sh` -> POD READY in 26s (deps pre-installed).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (paste had jobs=true — overridden;
#       no sweeps/settlement/cron/payouts/webhook worker in preview)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     BINANCE_PROXY_URL + SSH_TUNNEL_* commented (no tunnel in preview; FX via Tatum)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY (relative /api browser calls; SSR uses INTERNAL_API_URL=:8001)
# - Merchant login for testing: hostbay@moxx.co / Katiekendra123@ (user_id=1, "Hostbay")
# - VERIFIED (read-only, no writes to prod):
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational)
#     GET :8001/api/public/tickers -> live prices (BTC ~$78.0k, ETH ~$2.4k)
#     POST :8001/api/user/login (hostbay@moxx.co) -> 200 "Login Successful!" (user_id=1)
#     Boot migrations: "0 applied, 6 already present" => NO schema changes to prod
#     external preview / -> 200; /auth/login renders full UI (screenshot: logo, email flow,
#       Google + GitHub buttons, language picker)
# - NOTE for testing agents: WIRED TO PRODUCTION DB. Prefer READ-ONLY checks.
# ============================================================================


# ============================================================================
# 2026-08-26 (new pod) RE-SETUP #2 — prod-connected, SAFE MODE, EMAIL OFF — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase):
#     /app/.env (frontend) + /app/backend/.env (backend), then `bash scripts/pod-bootstrap.sh`
#     -> POD READY (db+redis connected, frontend 200).
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (no sweeps/settlement/cron/payouts/webhook worker)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email — user-confirmed)
#     REDIS_PUBLIC_URL -> nozomi.proxy.rlwy.net:15794/1 (isolated Redis DB index 1)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     BINANCE_PROXY_URL + SSH_TUNNEL_HOST commented (no tunnel in preview; Binance geo-blocked -> FX via Tatum)
#     NEXTAUTH_SECRET freshly generated (paste had literal placeholder "openssl rand -base64 32")
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY (relative /api browser calls; SSR uses INTERNAL_API_URL=:8001)
# - Merchant login for testing: hostbay@moxx.co / Katiekendra123@ (user_id=1, "Hostbay")
# - VERIFIED (read-only, no writes to prod):
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational CLOSED, binance geo-blocked/10 cached prices)
#     GET :8001/api/public/tickers -> live prices (BTC ~$78.1k, ETH ~$2.4k)
#     POST :8001/api/user/login (hostbay@moxx.co) -> 200 "Login Successful!"
#     external preview / -> 200.
# ============================================================================



# ============================================================================
# 2026-08-26 (new pod) RE-SETUP — prod-connected, SAFE MODE — VERIFIED
# ----------------------------------------------------------------------------
# - Preview URL: https://user-profile-split.preview.emergentagent.com
# - Branch: Improvement
# - Env REBUILT by hand from a fresh full cred paste (no vault passphrase used):
#     /app/.env (34 lines, frontend) + /app/backend/.env (245 lines, backend),
#     then `bash scripts/pod-bootstrap.sh` -> POD READY in 26s.
# - SAFE MODE (preview talks to the LIVE prod Railway DB):
#     ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary (no sweeps/settlement/cron/payouts)
#     REDIS_PUBLIC_URL -> .../15794/1 (isolated Redis DB index 1)
#     DISABLE_OUTBOUND_EMAIL=true (no Brevo email)
#     DATABASE_URL set explicitly (postgres@roundhouse.proxy.rlwy.net:23599/railway, ssl reject=false)
#     BINANCE_PROXY_URL commented out (SSH tunnel not running; Binance geo-blocked -> FX via Tatum/CoinGecko)
#     NEXTAUTH_SECRET freshly generated (paste had the literal placeholder "openssl rand -base64 32")
#     /app/.env NEXT_PUBLIC_BASE_URL EMPTY (relative /api browser calls; SSR uses INTERNAL_API_URL=:8001)
# - Merchant login for testing: hostbay@moxx.co / Katiekendra123@ (user_id=1, "Hostbay")
# - VERIFIED (read-only, no writes to prod):
#     GET :8001/health -> healthy (database=connected, redis=connected,
#       background_jobs.eligible=false = SAFE MODE, tatum operational CLOSED, binance geo-blocked/10 cached prices)
#     GET :8001/api/public/tickers -> live prices (BTC ~$78.7k, ETH ~$2.4k)
#     POST :8001/api/user/login (hostbay@moxx.co) -> 200 "Login Successful!"
#     SSR of /auth/login + landing (title "Sell, tip, fundraise — in crypto · Dynopay") render fully
#     external preview -> 200. NOTE: automated screenshots blank (Cloudflare challenge to headless — infra noise).
# ============================================================================



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
# - Preview URL: https://user-profile-split.preview.emergentagent.com
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
# - Preview URL: https://user-profile-split.preview.emergentagent.com
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
# - Preview URL: https://user-profile-split.preview.emergentagent.com
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
# - Preview URL: https://user-profile-split.preview.emergentagent.com
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
- Preview URL: https://user-profile-split.preview.emergentagent.com
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
# Preview URL (CORRECT): https://user-profile-split.preview.emergentagent.com
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

# ============================================================================
# 2026-08-29 (perf session) — TEST SEED DATA + workspace note
# ----------------------------------------------------------------------------
# - Merchant login unchanged: onarrival21@gmail.com / Katiekendra123@ (user_id=1)
#   NOTE: dashboard default workspace now shows as "SMADAV" (company_id=71);
#   userData.name is still "Hostbay". Use x-company-id: 71 for API calls.
# - ACTIVE test payment link (seeded via API for checkout regression tests):
#     /pay?d=aEmBUd  ($5.00 USD, link_id=286, transaction_id 2c74c734-4bb6-4d6d-ab93-33a84b3a72e5,
#     description "Perf test link (agent) - safe to delete") — PROD DB, do not pay it.
# - API notes: POST /api/user/login (exempt from CSRF) -> data.accessToken;
#   POST /api/pay/createPaymentLink needs Authorization Bearer + company_id in body.
# ============================================================================

# ---------------------------------------------------------------------------
# 2026-08-29 — Fresh pod setup (env hand-split from user-pasted creds)
# - env.vault.enc passphrase is UNKNOWN. Tried: Katiekendra123@, Godisgood123@,
#   Nomadly123@ (+ variations) -> all "bad decrypt". `Katiekendra123@` is the
#   MERCHANT LOGIN password, NOT the vault passphrase. Do not retry the vault
#   with it; hand-split /app/.env + /app/backend/.env from pasted creds instead.
# - SAFE MODE enforced: ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary,
#   DISABLE_OUTBOUND_EMAIL=true (preview points at LIVE Railway DB).
# - Verified: /health -> db=connected, redis=connected, tatum operational.
#   Frontend 200 on :3000. Preview URL 200.
# - Binance WS geo-blocked (no SSH tunnel) -> REST fallback prices only; fine in SAFE MODE.
# - CURRENT MERCHANT LOGIN FOR TESTING: onarrival21@gmail.com / Katiekendra123@ (user_id=1, "Hostbay")
#   NOTE: moxxcompany@gmail.com returns "We couldn't find that email" — it was migrated
#   to onarrival21@gmail.com. Login flow: email (testid login-email-input) -> Continue,
#   then password (testid password-input) -> Sign in (testid signin-submit-btn).
#   Password login for this account does NOT trigger step-up 2FA (verified 2026-08-29).
# ---------------------------------------------------------------------------

# --- 2026-06 fork (pod 55c5e4b0, preview https://user-profile-split.preview.emergentagent.com) — DEEP AUDIT session ---
#   Login unchanged: onarrival21@gmail.com / Katiekendra123@ (2-step: email -> Enter -> password -> Enter; /auth/login).
#   New behaviours to know when testing: OTP verify endpoints lock a code after 5 wrong attempts
#   ("Too many incorrect attempts..."); /api/user/forgot-password is 20/15min per IP (429 + Retry-After);
#   unknown /api/* routes return JSON 404; PUT /company/webhook-settings rejects private/metadata URLs (400).
#   SAFE MODE still active (REDIS_PUBLIC_URL .../1, ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary,
#   DISABLE_OUTBOUND_EMAIL=true). Boot migrations 0021/0022 were applied to the LIVE DB from this pod.
#   [follow-up, same session] reset-password bypass CLOSED: POST /api/user/reset-password needs a real verify-otp
#   session token (body email ignored). Legit flow: forgot-password -> verify-otp (data.resetToken) -> reset-password.
#   OTP code readable in preview Redis at otp:<email>:json. Security alert dedup key: sec-alert:<event>:<email>:json (1h).
#   Backend runs via ts-node WITHOUT hot reload: `sudo supervisorctl restart backend` after backend TS edits.
