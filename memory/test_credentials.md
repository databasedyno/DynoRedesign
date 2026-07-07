# Test Credentials

## Preview Environment (Emergent)
- URL: https://env-setup-preview-1.preview.emergentagent.com
- (Previous fork URL: https://env-setup-preview-1.preview.emergentagent.com)
- Frontend .env: /app/.env.local (NEXT_PUBLIC_BASE_URL + NEXTAUTH_URL point to the preview URL; /api/* routed to backend on port 8001)
- Backend .env: /app/backend/.env (points to Railway PostgreSQL `railway` DB on `roundhouse.proxy.rlwy.net:23599`)
- Redis: nozomi.proxy.rlwy.net:15794
- Backend runs NODE_ENV=production (sequelize .sync({}) = no destructive ALTER) + WORKER_ROLE=secondary (API-only; ALL cron jobs/sweeps/conversions/webhook-migration DISABLED — safe alongside production).
- Re-provisioned 2026-07-07 from a fresh checkout: `yarn install` in /app and /app/backend, .env files recreated from provided credentials.

## Primary QA Account (active user with $18k+ in transactions)
- Email: hostbay@moxx.co
- Password: Katiekendra123@
- Notes: Main account for QA testing. Has significant transaction history (~$18k lifetime volume).

## IMPORTANT — Preview backend DB note
- The preview backend's Railway PostgreSQL appears to have test users only.
- The previously documented admin `moxxcompany@gmail.com` does NOT exist in this DB.

## Throwaway QA Merchant (verified email)
- Email: qa.onboard.1782585233@dynopaytest.com
- Password: QaOnboard#2026
- user_id: 3 (email_verified=true). Has 1 company: "QA Test Co" (company_id=2). No wallet, no payment link.
- has_password: true

## Empty/new QA Merchant (verified email) — for dashboard empty-state testing
- Email: qa.empty.1782626169@dynopaytest.com
- Password: QaEmpty#2026
- user_id: 8 (email_verified=true). NO company, NO wallet, NO payment link, NO transactions.
- has_password: true

## i18n / language switching (IMPORTANT)
- The client language is stored in localStorage under the key **`lang`** (values: `en`/`pt`/`es`/`fr`/`de`/`nl`), NOT `i18nextLng`. Setting `i18nextLng` has NO effect.
- To force a language in a test: `localStorage.setItem('lang','de'); localStorage.setItem('lang_manual','true');` then **reload** (SSR always renders English first, the client switches on hydration ~1-2s).
- Easiest in a real browser: use the header language dropdown (e.g. pick "DE - Deutsch").

## Mint a 30-day JWT (bypass OTP) for logged-in UI tests
- Run: `node /app/scripts/mint_ux_tokens.js` — prints JWTs for `hostbay@moxx.co` (data-rich), `qa.empty...`, `qa.onboard...`.
- Inject: on the app origin `localStorage.setItem('token','<JWT>')`, then navigate to `/dashboard` (or `/create-pay-link`, `/wallet`, etc.).
- Use `hostbay@moxx.co` for pay-link tests — it has a company + wallet, so `/create-pay-link` reaches the Payment Settings form (the empty QA merchant is blocked by the onboarding gate).

## How to test logged-in flows (login is OTP-gated)
1. **Token injection (recommended for frontend tests)**: obtain a valid 30-day JWT and inject it:
   - On the app origin: `localStorage.setItem('token', '<JWT>')` then navigate to `/dashboard`.
2. **Scripted login via Redis OTP**: after `POST /api/user/login`, read the OTP with
   Redis key `login_otp:<session>:json` (via ioredis at redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794),
   then `POST /api/user/verifyLoginOTP`.

## Creating a fresh verified test merchant
1. `POST /api/user/registerUser` {name,email,password} → returns `accessToken` + `userData.user_id`.
2. Read OTP from Redis key `email-verify:<user_id>:json`.
3. `POST /api/user/verify-email` {otp} (Bearer accessToken) → email_verified=true.
Header required: `User-Agent: Mozilla/5.0 ... Chrome/120 Safari/537.36`

## Notes
- Admin passwords use bcrypt (12 rounds) with transparent SHA-256 migration on first login.
- JWT access tokens expire after 30 days.
- OTP rate limiter: 10 requests per IP:contact combo per 15 minutes.
- Login activity is recorded in `tbl_login_activities` on every successful login.
