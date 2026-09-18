## RESOLUTION (2026-06) — Bucket A fixed & verified (testing_agent iteration_199: backend 100% / frontend 100%, 0 issues)
FIXED & VERIFIED (6):
- custom::21 Settled-only → relabelled "Export settled only" + tooltip (TransactionsToolbar.tsx); list unaffected by toggle. i18n added to 6 transactions.json (exportSettledOnly/-Hint).
- custom::20 View-on-Explorer → helpers/explorerUrl.ts rewritten with correct per-chain explorers (etherscan / tronscan / blockchair / xrpscan / solscan / polygonscan / bscscan) + empty-hash guard. Verified: ETH→etherscan, USDT-TRC20→tronscan, BTC→blockchair.
- INV-002 invoice date off-by-one → forced timeZone:"UTC" in pages/invoices.tsx, InvoicePreviewDrawer.tsx and backend pdfService.ts. Verified INV-20260712-00004 shows "Jul 12" in both list + PDF/preview.
- REF-002 referral double-count → referralService.ts now recomputes referral_count via syncReferralCount(distinct referred users) in both redeem paths (no blind +1). Leaderboard 200.
- custom::22 short description → made OPTIONAL in the quick-create modal (QuickCreateLinkPanel.validate) to match the full page.
- WAL-005 wallet address mismatch → walletOtp.validateWallet now rejects a wrong-network address (addressMatchesCurrency) with 400 ADDRESS_CURRENCY_MISMATCH before the Tatum call.
ALREADY RESOLVED — NO CHANGE NEEDED (verified in code/UI):
- COMP-006 company-delete OTP → DeleteBrandModal copy already says "We'll ask you to verify it's you first" (step-up is intentional).
- custom::23 2FA/Security card → renders cleanly at 390px (component already rebuilt responsive).
- PAY-003 pay-link edit → checkout → updatePaymentLink already syncs base_currency + accepted_currencies + available_currencies to DB AND the customer-<ref> Redis payload; not reproducible from code — needs a live edit→checkout retest only.
Buckets B (feature gaps) and D (env/scope) remain product decisions — untouched.
--------------------------------------------------------------------------------------------


# Quality Center (/quality) — failure triage vs CURRENT codebase
Source: tbl_qa_comment (DB-backed Quality Center, passcode-gated /quality page). Tester: Tuhin Hossain, Sept 2026.
Method: took the LATEST status per item (a thread can go fail→…→pass). 99 items total → 40 pass, 20 fail, 17 blocked, 17 awaiting_retest, 5 not_tested.
"Open" = latest status is fail/blocked (37 items). Below each is my assessment against the code as it stands now.

## BUCKET A — TRUE BUGS, still applicable (recommend fixing)
- **custom::21 — "Settled only" checkbox doesn't filter the list.** VERIFIED IN CODE. In Components/Page/Transactions/index.tsx the checkbox binds to `settledExport`/`setSettledExport` and only scopes the CSV export (`exportSettledHint` = "Exports only settled payments"); the visible table is filtered by the status chips. The label "Settled only" reads like a list filter → misleading. Fix: relabel/group it under Export ("Export settled only"), or make it actually filter the list.
- **referrals::REF-002 — leaderboard/count shows 2 for a single referral.** LIKELY REAL. getReferralLeaderboard just reads the `referral_count` column; services/referralService.ts increments referral_count in TWO places (~L205 and ~L318). If both attribution paths fire for one referral, the count doubles. Fix: ensure only one increment per referral (trace both paths).
- **custom::20 — "View on Explorer" → HTTP 400.** LIKELY REAL. TransactionDetailsModal calls explorerTxUrl(transaction.crypto, transaction.incomingTransactionId). helpers/explorerUrl.ts has no mapping for several assets (XRP uses blockchair "ripple" which 400s for many hashes; SOL/RLUSD/USDC/BNB/USDT variants fall through to bitcoin) and doesn't guard empty/again-internal ids. Fix: correct per-chain explorers (XRP→xrpscan, SOL→solscan, etc.), guard missing hash.
- **invoices::INV-002 — invoice date off-by-one (list "Jul 13" vs PDF/preview "12 July").** LIKELY REAL (timezone). invoice_date is a DATE; one surface renders in local tz, the other in UTC. Fix: format invoice_date as a plain calendar date (UTC) everywhere (list, preview, PDF template).
- **custom::22 — Pay-link "Short Description" required in modal but optional on full page.** Validation inconsistency between the two forms. Fix: unify the rule in both the modal and full-page create/edit forms.
- **paylinks::PAY-003 — editing a pay-link's currency/accepted crypto not reflected on buyer checkout.** Stale checkout config after save. Needs verify of checkout data source/caching; fix so checkout reads latest config.
- **custom::23 — 2FA / Security card layout breaks & wraps at some widths** ("Email codes" wraps, "On since"/date stack vertically, buttons misplaced). Components/Page/Profile/TwoFactorAuth.tsx + Settings/SecuritySection.tsx. Needs a screenshot at the affected width; fix responsive layout.
- **company::COMP-006 — unexpected OTP step after confirming company delete.** UX friction / undocumented extra step. Decide: drop the OTP for delete, or surface it in the flow copy.
- **wallet::WAL-005 — address-type mismatch shows a UI warning but POST /api/wallet/validateWalletAddress doesn't return valid:false.** API/UI inconsistency. Fix backend validator to return the mismatch.

## BUCKET B — FEATURE GAPS (scope/product decisions, not "broken")
- invoices::INV-001 — invoice search field missing.
- notifications::NOTIF-001 — delete-notification action missing.
- devkeys::DEV-006 — delete-customer action missing.
- settings::SET-007 — login history (date/ip/device) not shown.
- settings::SET-003 — password-change control (VERIFY: may exist under Security).
- company::COMP-004 — webhook delivery log lacks full request/headers/response body view.
- checkout::CHK-001 — transaction detail shows a single "Fee", not Platform + Blockchain + Total breakdown. (No fee split found in TransactionDetailsModal.)
- auth::AUTH-013 — email verification & unsubscribe (VERIFY: unsubscribe page exists at /unsubscribe).

## BUCKET C — LIKELY ALREADY RESOLVED (stale note → retest, do NOT re-fix)
- **settings::SET-008 — "deleted account can still log in": FIXED.** authLogin.ts now gates soft-deleted users (`isUserSoftDeleted` → 403 ACCOUNT_DELETED_LOGIN_MESSAGE, L142-145) and finalizeLogin re-gates; verifyLoginOTP also routes through finalizeLogin.
- **settings::SET-002 — "profile photo upload missing": EXISTS.** controller/user/profile.ts handles "Profile Photo: Updated/Removed"; UI in Components/Page/Profile/AccountSetting.tsx. May be a placement/discoverability nit only.
- 17 awaiting_retest items already marked fixed-pending-verify by QA: auth::AUTH-003, AUTH-009; dashboard::DASH-001, DASH-003; public::PUB-001/002/004/005/007; custom::7,8,9,13,14,15,17,18. → schedule a retest pass, not new fixes.

## BUCKET D — ENVIRONMENT / TEST-HARNESS / OUT-OF-SCOPE (no product code fix)
- auth::AUTH-011 (make token 10-min for testing) — test convenience, not a bug.
- checkout::CHK-004, wallet::WAL-006 — "need a real crypto payment to test" — env.
- company::COMP-005 (provide a failed-conversion test record) — test data request.
- notifications::NOTIF-003 (web push not configured) — infra/scope.
- paylinks::PAY-005 (no UI to create a referral discount to verify) — test data/scope.
- settings::SET-004 / SET-005 — phone/SMS OTP send fails → SMS provider (Telnyx) likely not configured in this env; VERIFY before treating as a real bug.
- settings::SET-006 (remove email/phone, "no way to test") — env.
- auth::AUTH-002 (phone dup verify) — phone flow/env.
- subscriptions::SUB-001 (/api/subscription not found) — feature may be unbuilt; scope VERIFY.
- kyc::KYC-001 / KYC-003 — KYC status/requirements/resubmission incomplete; scope VERIFY.
- auth::AUTH-006 (Facebook sign-in missing) — not implemented (app uses Google/GitHub); scope decision.
- checkout::CHK-003 (bank-transfer option) — crypto gateway; likely out of scope.
- paylinks::PAY-001 (auto-generated link name not surfaced) — minor UX.
- invoices::INV-003 (/api/tax/rate not found) — replaced by /api/user/tax-settings; doc mismatch, not a bug.

## Recommended fix order (highest value, lowest risk first)
1. custom::21 (Settled-only relabel)  2. custom::20 (explorer URLs)  3. invoices::INV-002 (date tz)
4. referrals::REF-002 (double count)  5. custom::22 (short-desc validation)  6. custom::23 (2FA layout)
7. wallet::WAL-005  8. company::COMP-006  9. paylinks::PAY-003
