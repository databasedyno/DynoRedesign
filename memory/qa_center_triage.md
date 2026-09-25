# QA Center Triage — current state (regenerated 2026-09-25)

Source: `tbl_qa_comment` via `GET /api/quality/data` (passcode `Dynopay123@`, header `x-qa-passcode`).
Status = the **latest** comment per item_key. Statuses: pass | fail | blocked | awaiting_retest | not_tested.

Distribution over 112 tracked items: **pass 61 · awaiting_retest 17 · blocked 18 · fail 10 · not_tested 6**.

Most notes authored by QA "Tuhin Hossain" (early–mid Sep 2026); awaiting_retest items are dev-fixed by E1 pending QA re-verify (several need production/Cloudflare).


---

## FAIL-BUCKET RESOLUTION UPDATE (2026-09-25, E1 fork) — 6 of 10 fixed/confirmed, 4 remain

- **#1 Webhook delivery log** — RESOLVED (enhance). Detail modal (`WebhookConsoleSection.tsx`, `openDetail` → `GET /api/company/webhook-history/:id/detail/:logId`) already showed payload + HTTP response status + latency + retries + error. Added a **Request headers** block (testid `webhook-detail-headers`, copy btn `webhook-detail-copy-headers`) reconstructed from the deterministic outbound headers (`X-DynoPay-Event/-Webhook-Id/-Timestamp/-Signature`, Content-Type, User-Agent — see `backend/webhooks/index.ts` L344). No schema column for request headers/response body exists, so headers are reconstructed (accurate) and response body isn't stored. Code-verified + `/developer-keys` compiles 200. → mark **awaiting_retest**.
- **#3 Customer delete** — FIXED + VERIFIED. `DELETE /api/userApi/customers/manual` (`customerAnnotationController.deleteManualCustomer`, manual-only guard) + UI Remove button (`customer-detail-delete`, gated on `c.manual`) with 2-click confirm. curl e2e (create→delete→404, non-manual→400) + testing_agent iteration_231 (4/4). → **pass**.
- **#4 Notification delete** — FIXED + VERIFIED. Per-row trash (`notification-delete-<id>`) → optimistic remove + existing `DELETE /api/notifications/:id` (user-scoped). testing_agent iteration_231 (row removed, persists across reload). → **pass**.
- **#7 Login history** — ALREADY WORKS (stale). `GET /api/user/login-activity` AND `/api/user/login-history` return real rows with ip/device/browser/os/location/login_at/method/status. → **awaiting_retest**.
- **#8 Delete-account re-login** — GUARD EXISTS (stale). Soft-delete login gate in `authLogin.ts` L142 + `userShared.ts` L163 ("authoritative for ALL login paths"). Code-verified (not e2e — avoids soft-deleting a real account). → **awaiting_retest**.
- **#9 KYC status/requirements** — ALREADY WORKS (stale). `/api/kyc/status`, `/requirements`, `/history` all return complete data (user 1 approved, threshold $10k, required_documents…). → **awaiting_retest**.

STILL OPEN (need decision / provider / visual pass):
- **#2 Webhook Settings padding/alignment** — visual polish, not started.
- **#5 Profile photo upload** — currently INTENTIONALLY initials-only (`AccountSetting.tsx` L266 comment: "Account avatar — initials only. Logos live on brands"). Needs product decision: add upload (object storage) vs keep initials.
- **#6 Add-Phone mobile OTP (Telnyx Verify)** — provider/env-specific; real SMS delivery not exercisable in preview.
- **#10 Ultra-wide (2550px) wasted space** — responsive polish, not started.

---

## FAIL (10) — real defects to fix
1. **Webhook delivery log — full request/response not viewable** (`company::COMP-004`). Clicking a delivery in Events Log doesn't show payload/headers/response.
2. **Webhook Settings UI — inconsistent left padding / title-label alignment** (`custom::19`). Layout polish.
3. **Customers — Delete Customer missing** (`devkeys::DEV-006`). No UI to delete a customer.
4. **Notifications — Delete Notification missing** (`notifications::NOTIF-001`). No per-notification delete.
5. **Profile — Profile photo upload missing** (`settings::SET-002`). No upload/change avatar option.
6. **Add Phone — mobile OTP send fails** (`settings::SET-005`). Email users can't add a phone; OTP not sent.
7. **Login History not available** (`settings::SET-007`). Should list date/time, IP, device, location.
8. **Delete Account — deleted account can still log in** (`settings::SET-008`). After DELETE /api/user/account, same creds still log in; brand-create then errors. Security-adjacent.
9. **KYC status/requirements APIs return nothing** (`kyc::KYC-001`). GET /api/kyc/status + /api/kyc/requirements not returning expected data.
10. **Responsive — wide desktop (2550px) wastes space** (`crosscut::CC-004`). Content stays narrow/fixed width on ultra-wide.

## BLOCKED (18) — couldn't test / feature-missing (needs decision or data)
- Phone Registration duplicate-error check (`auth::AUTH-002`)
- Facebook Sign-In missing (`auth::AUTH-006`)
- Token refresh: 7-day access token; QA wants 10-min for testing (`auth::AUTH-011`) — test-config request
- Email Verification & Unsubscribe missing (`auth::AUTH-013`)
- Auto-Convert: need a way to simulate a failed conversion to test Retry (`company::COMP-005`) — test-data request
- Network fees post-payment response (`wallet::WAL-006`) — needs a real payment
- Payment Link: no link-name field / auto-name unclear (`paylinks::PAY-001`)
- Referral-discount link creation UI missing (`paylinks::PAY-005`)
- Bank Transfer option not visible/settable (`checkout::CHK-003`)
- Payment verification needs real crypto (`checkout::CHK-004`) — mockable
- Tax rate/lookup endpoints (`/api/tax/rate/:cc`, `/api/tax/lookup`) not found (`invoices::INV-003`)
- Push notifications need Web Push config (`notifications::NOTIF-003`)
- Password change missing (`settings::SET-003`)
- Change/Add Email — phone-otp error blocks (`settings::SET-004`)
- Remove Email/Phone — no way to test (`settings::SET-006`)
- Subscription CRUD endpoint (`/api/subscription`) not found (`subscriptions::SUB-001`)
- KYC resubmission endpoint blocked (`kyc::KYC-003`)
- i18n Arabic/Hebrew (RTL) not available (`i18n::I18N-001`)

## AWAITING_RETEST (17) — dev-fixed, pending QA re-verify (many production/Cloudflare-only)
Landing hydration #418/#423 (PUB-001), homepage cards autosize (custom::7), /for/* clipping + help padding (custom::8), mobile hamburger blank (PUB-002), back scroll restore (custom::9), fee calculator breakdown (PUB-004), docs JSON example (PUB-005), blog category filter + help feedback (PUB-007), signup email subject (custom::13), email+password login OTP set-password (auth::AUTH-003), Google already-registered handling (custom::14), 2FA enable/disable (auth::AUTH-009 + custom::15), dashboard auto-convert control (dashboard::DASH-001), onboarding no-store 304 (dashboard::DASH-003), long brand name truncation (custom::17), brand logo save-confirm (custom::18).

## NOT_TESTED (6) — no status yet (not enumerated here; see /quality).

---
Suggested fix order for the FAIL bucket (quick wins → bigger): #2 (UI padding), #5 (add-phone OTP), #7 (login history), #4 (notification delete), #3 (customer delete), #1 (webhook log details), #9 (KYC APIs), #8 (delete-account re-login — security), #6? , #10 (ultra-wide responsive).
