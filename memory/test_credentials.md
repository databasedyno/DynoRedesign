# Test credentials (current pod)

Preview URL (THIS pod): https://fb0ee85b-d90b-49e5-8b2a-bd2f244fc255.preview.emergentagent.com

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
