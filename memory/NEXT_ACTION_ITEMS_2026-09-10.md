# Next Action Items — 2026-09-10 (multi-bug fix session)

Follow-ups from the session that fixed 6 reported issues (quick-link coins,
individual-brand name, wallet-copy save, brand glyph, KYC badge, merchant email
brand names). This file is the pickup list for the next agent / session.

## Context — what shipped this session (for reference)
- `Components/Page/Payment-link/QuickCreateLinkPanel.tsx` — quick links now send
  `accepted_currencies` = the brand's configured coins (from
  `useWalletData().walletData[].walletTitle`); empty still means "all" server-side.
- `Components/UI/OnboardingFlow/CreateCompanyModal.tsx` — brand/display name is
  optional for `account_type='individual'`, defaults to the person's name.
- `backend/controller/companyController.ts` (addCompany) — server-side fallback:
  individual + blank name → `company_name` = contact/account name.
- `backend/middleware/companyMiddleware.ts` — Joi schema is now account-type
  aware: individual brands may omit `company_name` AND `email` (needs a contact
  first/last name when no company_name). Business unchanged (both required).
- `Components/UI/WalletManagerModal/{index,ManagerFooter}.tsx` — after a
  copy-from-another-brand (saves instantly) the footer shows "N wallets copied
  and saved" + an enabled **Done** button (`data-testid=wallet-manager-done-btn`).
- `Components/UI/CompanySelector/index.tsx` — account-type-aware `BrandGlyph`
  (person vs briefcase) in trigger/header/rows; KYC badge uses `selected?.company_id ?? active`.
- Emails: new helper `emailShared.brandSubject(companyName, subject)` applied to
  merchant subjects in `companyEmails` (created/updated), `walletEmails`
  (added/updated/reminder/batch-summary), `conversionEmails` (auto-conversion
  payout), and `orderEmails.sendOrderReceiptMerchantEmail` (brand threaded from
  `orderFulfillmentService.ts`).

Status: code-complete, tsc clean (FE+BE), backend behavior verified by testing
agent (individual `account_type` persists; quick-link currencies accepted).
Frontend UI (#1–#5) NOT browser-verified (testing agent skipped per user).
All throwaway test data created during verification was cleaned from the prod DB.

---

## ACTION ITEMS

### 1. Verify In Browser  (verification — do first)
- **What:** Run the frontend testing agent over the 5 UI fixes.
- **Why:** #1–#5 are code-complete + type-checked but were never exercised in a
  real browser (testing agent was skipped at user request).
- **Flows to cover (login: onarrival21@gmail.com / Katiekendra123@, 2-step):**
  - Quick link: `/pay-links` → quick create → confirm the created link's checkout
    (`/pay?d=...`) offers ALL the brand's configured coins.
  - Individual brand: header brand selector → "Add brand" → choose
    "Individual / creator" → leave display name blank → submit → new brand shows a
    **person** glyph + "INDIVIDUAL" tag, and its name = the person's name.
  - Wallet copy: open a throwaway brand (e.g. "QA Throwaway Brand 2", company_id
    179) → Manage wallets → "Copy from another brand" → confirm footer shows
    "copied and saved" + enabled **Done** button.
  - Brand glyph + KYC badge: switch between brands; the verified check next to a
    verified brand (The Dev Store / company_id 1) must not blink out.
- **Note:** creating a brand/link writes to the LIVE prod DB — use obvious
  throwaway names and clean up (direct DB delete of `tbl_company` cascades to
  `tbl_api` etc.; delete `tbl_payment_link` rows explicitly).
- **Acceptance:** all four flows pass; no console/hydration errors at 390/1920.
- **Effort:** S. **Risk:** low.

### 2. Finish Email Brand Names  (asked-for follow-up)
- **What:** Add the brand name to the two merchant emails still missing it:
  `billingReportEmails.sendWeeklySummaryEmail` and
  `linkCampaignEmails.sendPaymentLinkCreatedEmail`.
- **Why:** This session only covered senders where `companyName` was already in
  scope. These two don't receive the brand, so their subjects can't be branded.
- **How:**
  - Add a `companyName` param to each sender and wrap the subject with the
    existing `brandSubject(companyName, subject)` helper (from `emailShared.ts`).
  - Thread `companyName` from every caller: find callers with
    `grep -rn "sendWeeklySummaryEmail\|sendPaymentLinkCreatedEmail" backend`
    and look up the company by `company_id` (see the pattern already added in
    `orderFulfillmentService.ts` — dynamic `import companyModel` → `findByPk`).
  - Optional consistency pass: audit remaining merchant senders that lack the
    brand in the subject and where the caller has the company id (e.g. wallet
    OTP/delete emails, weekly conversion summary).
- **Verify:** email sending is OFF in preview — verify by rendering with
  `backend/scripts/render_email_previews.ts` (and re-check the greeting test in
  `backend/__tests__/emailGreetingFirstName.test.ts`), not by delivery.
- **Effort:** S–M. **Risk:** low (subject strings only + param threading).

### 3. Backfill Brand Types  (spark — corrects existing data)
- **What:** Let a merchant flip an existing brand between Individual and Business
  with one tap (all 7 brands on user_id=1 are currently stored as `business`).
- **Why:** The glyph/label fix (#4/#5) is data-driven; historical brands created
  before the account-type toggle are all `business`, so they still show a
  briefcase even for real creators. There is no in-app way to correct them.
- **How (backend already half-exists):**
  - `business → individual`: no endpoint yet. Add a small owner-only PATCH
    (e.g. `PATCH /api/company/:id/account-type`) that sets `account_type` and,
    for individual, keeps name/wallets/keys intact.
  - `individual → business`: `upgradeToBusiness` already exists in
    `companyController.ts` (requires name + country). Reuse it.
  - Frontend: add the control in `CompanySettingsDialog` (Brand section) or the
    company row quick-edit; guard with a confirm.
- **Acceptance:** toggling a brand updates the glyph/tag immediately after
  `refetchCompanies()`; wallets/links/keys unchanged.
- **Effort:** M. **Risk:** medium (write path on live data — gate to owner + confirm).

### 4. All-Coins Badge  (spark — quick-link clarity)
- **What:** Show an "Accepts all your coins" chip on quick-created links so
  merchants see at a glance which payment methods the buyer will get.
- **Why:** Quick links intentionally accept every configured coin; surfacing that
  reassures merchants (the original confusion behind issue #1).
- **How:** In the QuickCreate success state and/or `PaymentLinkDetailPanel`, when
  a link's `accepted_currencies` is null/empty OR equals the brand's full
  configured set, render a chip "Accepts all N coins" (list them on hover). Add
  i18n string in all 6 languages.
- **Acceptance:** chip appears on quick links, reflects the real configured set,
  and reads correctly in every language.
- **Effort:** S. **Risk:** low (display only).
