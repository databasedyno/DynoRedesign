# Phase 1 (Admin Platform Settings) — Progress Handoff — 2026-09-30

Respond to the user in **English**.

## User-approved decisions (from ask_human at fork start)
1. **Scope**: FULL Phase 1 — Fees & pricing, Order/checkout limits, SafeDeal risk, Security policy, Feature flags + NEW kill switches, Alert routing (~60 keys).
2. **Admin auth**: Harden admin auth FIRST — mandatory TOTP + short-lived revocable sessions + step-up (reason) on settings writes. (This is the SEC-002 dependency; settings dashboard must sit behind it.)
3. **Live DB**: additive tables/cols only, no seeding, test-and-cleanup against PROD (roundhouse.proxy.rlwy.net:23599 — reachable directly, NO ssh tunnel needed).
4. **Hot-reload**: user "not sure" → agent decision = wire in-process cache + Redis pub/sub (still TODO in Deliverable 2).
5. **Kill switches**: user skipped → agent default = store flags AND wire enforcement, but all switches default OFF so no behavior change until explicitly flipped (TODO in Deliverable 2).

## Build split
- **Deliverable 1 — Admin auth hardening (SEC-002)** → ✅ DONE + TESTED (backend). Frontend built, NOT yet screenshot-verified.
- **Deliverable 2 — Platform Settings dashboard** → ❌ NOT STARTED.

---

## DELIVERABLE 1 — DONE (backend 17/17 e2e passed)

Integration playbook obtained via integration_expert (otplib v13 + jsonwebtoken + Redis, mirrors merchant 2FA). Transport kept as **Bearer token in localStorage** (matches existing merchant + admin FE, and CSRF middleware skips Bearer requests) — NOT cookies, to avoid breaking admin SSE streams. Tokens are now **12h, session-backed, revocable** (was 30d non-revocable).

### New/changed backend files
- `models/adminModel.ts` — added cols: totp_secret, totp_enabled, totp_enrolled_at, totp_backup_codes(jsonb), tokens_valid_after, failed_login_count, locked_until.
- `models/adminSessionModel.ts` — NEW. tbl_admin_session (session_id uuid PK, admin_id, jti unique, expires_at, last_seen_at, revoked_at, revoke_reason, ip, user_agent). timestamps:false.
- `services/adminTotpService.ts` — NEW. otplib v13 TOTP + sha256 backup codes (mirrors twoFactorService).
- `services/adminAuthService.ts` — NEW. passwordPhase / beginEnrollment / completeEnrollment / totpPhase / issueSession / revokeSession / revokeAllSessions / verifyAccessToken / listSessions / verifyStepUp / consumeStepUp / getAdminStatus. tbl_admin via raw parameterized SQL; sessions via Sequelize model. JWT signed with ADMIN_JWT_SECRET||ACCESS_TOKEN_SECRET, iss=dynopay-admin, aud=dynopay-admin-console, HS256, 12h. Lockout 5 fails/15min. Legacy sha256->bcrypt password migration preserved.
- `controller/adminAuthController.ts` — NEW. loginPassword, loginTotp, enrollBegin, enrollComplete, logout, logoutAll, sessions, me, stepUp.
- `middleware/adminAuthMiddleware.ts` — REWRITTEN. Verifies JWT (iss/aud) + live session (exists, jti match, not revoked, not expired) + tokens_valid_after cutoff. Legacy 30d tokens now fail → forced re-login. Exports `requireAdminStepUp(reason)` for Deliverable 2 to gate settings writes. res.locals.user = {admin_id,email,role,sid}; res.locals.token kept (adminController.changePassword/updateEmail decode email from it — still works).
- `middleware/csrfMiddleware.ts` — added `/api/admin/enroll` to EXEMPT_PATHS (login already exempt via `/api/admin/login` prefix). **This required an explicit `supervisorctl restart backend` to take effect (hot-reload alone did NOT pick it up).**
- `routes/adminRouter.ts` — replaced `POST /admin/login` with: /login/password, /login/totp, /enroll/begin, /enroll/complete (all loginRateLimiter), and authed /me, /sessions, /logout, /logout-all, /step-up. (adminController.login now unused but left in place.)
- `migrations/bootMigrations.ts` — added 0055_admin_auth_columns (ALTER tbl_admin, additive/idempotent) + 0056_admin_session (create-only sync). Added adminSessionModel to getBootModels. **Both migrations already APPLIED to live prod DB (confirmed in boot logs).**
- `scripts/admin_2fa.cjs` — NEW helper: `node scripts/admin_2fa.cjs totp|status|reset [admin_id]`. **RECOVERY PATH** if admin loses authenticator: `reset` clears TOTP + revokes sessions so they re-enroll on next login.

### New frontend files
- `pages/admin/login.tsx` — REWRITTEN. 3-step flow: password → (TOTP verify | enroll QR+code) → backup-codes screen. MUI-styled. data-testids: admin-email-input, admin-password-input, admin-login-submit, admin-2fa-code-input, admin-2fa-verify-btn, admin-enroll-qr, admin-enroll-secret, admin-enroll-verify-btn, admin-backup-codes, admin-backup-continue-btn, admin-login-error.
- `axiosAdmin.ts` — added 401/403 response interceptor: clears admin_token + redirects to /admin/login (auth routes exempt).

### Backend test result (17/17 PASS, throwaway admin, cleaned up)
wrong pw→401, pw→ENROLL_REQUIRED, enroll/begin secret+qr, enroll wrong code→400, enroll complete→token+10 backup codes, /me authed, bogus token→403, pw→TOTP_REQUIRED (after enroll), totp wrong→400, totp correct→token, backup code login once, backup reuse→400, step-up grant, step-up bad reason→400, sessions list, logout-all, token dead after logout-all→403.

### ⚠️ OPERATIONAL / STILL TODO for Deliverable 1
- **FRONTEND NOT SCREENSHOT-VERIFIED.** Next agent: screenshot `https://secure-passphrase-12.preview.emergentagent.com/admin/login` (NEXT_PUBLIC_SERVER_URL in /app/.env.local; NEXT_PUBLIC_BASE_URL is empty so admin API calls go to same-origin /api). Verify password → enroll QR renders. To e2e a full login without touching the real admin, seed a throwaway tbl_admin row and use `scripts/admin_2fa.cjs totp <id>` for codes, then delete it.
- **REAL ADMIN IMPACT (moxxcompany@gmail.com)**: password unchanged, BUT on next admin-console login they will be FORCED to enroll TOTP (QR) and save backup codes. Their old 30d token is now invalid. This is intended (SEC-002). Communicate this to the user. If ever locked out: `cd /app/backend && node scripts/admin_2fa.cjs reset 1` (confirm real admin_id first via `... status <id>`).
- Did NOT wrap existing fund-moving admin routes (credit/debit, binance-sell, dispute) in requireAdminStepUp yet — playbook item; do alongside Deliverable 2 or as follow-up.

---

## DELIVERABLE 2 — Platform Settings dashboard (NOT STARTED)
Follow `/app/memory/ADMIN_PLATFORM_SETTINGS_2026-09-30.md` §5–6. Plan:
- DB: `tbl_platform_setting (key PK, value jsonb, updated_by, updated_at, version)` + append-only `tbl_platform_setting_history`. Add as bootMigrations 0057/0058 (create-only). NO seeding.
- `services/platformSettings/registry.ts` — typed registry (~60 keys, 6 groups) each: group,type,zod/joi validation,default,envFallback,requiresStepUp,killSwitch. Resolution: DB override → env → code default (so .env keeps working; zero-risk).
- `services/platformSettings/index.ts` — get(key) w/ in-process cache + Redis pub/sub invalidation (node-redis v4: use redis.duplicate() for subscriber). set(key,val,admin,reason) → validate + write + history row + publish invalidation.
- `controller/admin/platformSettingsController.ts` + routes: GET /admin/settings (grouped, effective value + source chip), PUT /admin/settings/:key (adminAuthMiddleware + requireAdminStepUp("platform-settings"), audited), GET /admin/settings/history.
- Kill switches: maintenance / pause checkouts / pause settlements / pause SafeDeal cashouts — store + enforce at request boundary (503), all default OFF.
- Frontend `pages/admin/settings.tsx` — tabs per group, source chip (Override/Env/Default), edit+diff+save with step-up prompt (POST /admin/step-up then retry with X-Admin-Step-Up header), one-click revert, history view. Add nav link in admin layout. Use existing MUI/admin conventions.
- TEST with testing_agent (backend + frontend) after build.

## Key facts / gotchas
- Monorepo: Next.js at /app root (port 3000), Node/TS backend at /app/backend (port 8001 via python proxy → node 3300). NODE_ENV=production in pod → boot uses versioned migration runner (buildBootMigrations), NOT sync-alter. New tables MUST be added as a migration entry (and to getBootModels for dev parity).
- Redis client: `import { redis } from "../utils/redisInstance"` (node-redis v4). Helpers: setRedisItemWithTTL/getRedisItem/deleteRedisItem. redis.set(k,v,{EX}) / redis.get / redis.getDel / redis.del all work.
- Env reads: `utils/config` → str/num/bool/raw. Fee/limit values today read via envRaw with code defaults — settings service should shadow these.
- After editing middleware or anything not hot-reloaded, `sudo supervisorctl restart backend` (wait ~12s; migrations + boot).
- LIVE DB — additive only, clean up any test rows.
