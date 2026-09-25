# QA Center Triage — current state (regenerated 2026-09-25)

Source: `tbl_qa_comment` via `GET /api/quality/data` (passcode `Dynopay123@`, header `x-qa-passcode`).
Status = the **latest** comment per item_key. Statuses: pass | fail | blocked | awaiting_retest | not_tested.

Distribution over 112 tracked items: **pass 61 · awaiting_retest 17 · blocked 18 · fail 10 · not_tested 6**.

Most notes authored by QA "Tuhin Hossain" (early–mid Sep 2026); awaiting_retest items are dev-fixed by E1 pending QA re-verify (several need production/Cloudflare).

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
