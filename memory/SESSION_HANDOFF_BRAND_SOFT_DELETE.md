> STATUS UPDATE (end of session): R1 (admin Deleted-Brands UI) and R2 (backend curl E2E + frontend
> testing_agent iteration_161 = 100%) are now ✅ DONE + VERIFIED; throwaway test brands purged, prod DB clean.
> Still open: R3 (merchant delete-brand toast copy), R4 (translate myCountry), and the NEW "Delete entire
> account" feature. The "REMAINING" R1/R2 sections below are kept for reference/build notes.


# SESSION HANDOFF — Brand 7-Day Soft Delete + 3 fixes (2026-06, pod 7f90e7ef)

Preview URL (THIS pod): https://cred-manager-29.preview.emergentagent.com
Mode: SAFE MODE, wired to PRODUCTION Railway Postgres. Outbound email OFF (DISABLE_OUTBOUND_EMAIL=true,
emails dumped to EMAIL_DUMP_DIR). Background jobs OFF (cron won't run here — runs in prod only).
User approved running the schema migration against production (already applied — see below).

Original request (4 items): (1) landing copy implying Dynopay works from any country, (2) 7-day brand
soft-delete + admin restore + merchant/admin emails, (3) login→dashboard transition logo bug, (4) referral
code pre-filled from marketing CTAs (?ref=how_to).

============================================================
## ✅ DONE THIS SESSION (backend boots clean; core company read verified under paranoid; NOT yet full-tested)
============================================================

### 1. Referral prefill fix (FRONTEND, low risk) — pages/auth/register.tsx
- The `?ref=` effect now only pre-fills the referral field when the value looks like a GENUINE code
  (regex `^(DYNO|REF)[A-Z0-9-]{3,}$`, case-insensitive). Marketing attribution tags (how_to, docs_hero,
  fees_calculator, promo_bar, exit_intent, products_links, referral_program, about, press …) are silently
  ignored — first-payment-fee-free still applies. Real codes: DYNO-XXXXXX / DYNO2026JOH1A2B3 / REF-1A2B3C4D.
- No CTA files changed (they still pass ?ref=<tag>; register now ignores non-codes).

### 2. Login transition logo (FRONTEND) — pages/auth/login.tsx
- Added `redirecting` state + a full-screen pulsing Dynopay logo splash (keyframes overlayFadeIn/logoBreath)
  shown during the login→dashboard hand-off. Success effect sets redirecting=true, navigates after 850ms;
  splash stays mounted until the dashboard renders. data-testid="login-redirect-splash".

### 3. Landing "any country" copy (FRONTEND) — langs/locales/en/landing.json + Components/Page/Home/v5/FAQV5.tsx
- v5.global.body reworded to imply worldwide availability ("no country list to apply to…").
- NEW FAQ item v5.faq.myCountry ("Can I use Dynopay from my country?") + softened v5.faq.countries answer
  (removed the limiting "30+ countries" framing). FAQV5 IDS array now includes "myCountry".
- EN only; de/es/fr/pt/nl fall back to EN for myCountry (optional to translate later).

### 4. 7-DAY BRAND SOFT DELETE (BACKEND) — the big one
- **Migration APPLIED to prod**: backend/migrations/012_company_soft_delete.sql added deleted_at,
  deleted_by, scheduled_purge_at (+2 indexes) to tbl_company. Runner: backend/scripts/run_migration.js.
  Verified columns exist.
- **Model** backend/models/companyModels/companyModel.ts: `paranoid: true, deletedAt: "deleted_at"` +
  new deleted_by / scheduled_purge_at fields. ⇒ EVERY Sequelize find/count/association auto-excludes
  soft-deleted brands. Use `{ paranoid: false }` (or `restore()`) to see/act on deleted rows.
- **deleteCompany** (companyController.ts) rewritten: now SOFT-deletes (sets deleted_at=now,
  deleted_by, scheduled_purge_at=now+7d), invalidates dashboard cache, sends merchant "7 days to restore"
  email (sendBrandSoftDeletedEmail) + admin notify (sendBrandDeletedAdminEmail). Heavy cleanup moved out.
  Returns 200 with message "Brand deleted. You have 7 days to restore it…" + scheduled_purge_at/restore_before.
- **brandPurgeService.ts** (NEW): `purgeBrand()` = the OLD hard cleanup (revoke API keys, delete payment
  links + Redis, prune orphan customers, destroy(force:true)) + merchant "permanently deleted" email;
  `purgeExpiredBrands()` sweeps rows past scheduled_purge_at; export `BRAND_DELETE_GRACE_DAYS = 7`.
- **Emails** companyEmails.ts: sendBrandSoftDeletedEmail, sendBrandPermanentlyDeletedEmail, sendBrandRestoredEmail.
  adminNotificationEmails.ts: sendBrandDeletedAdminEmail (→ ADMIN_EMAIL). Plain-English inline style (no i18n keys).
- **Admin endpoints** (adminController.ts + adminRouter.ts, adminAuthMiddleware):
  - GET  /api/admin/deleted-brands            → list soft-deleted brands (+owner, days_remaining, expired)
  - POST /api/admin/deleted-brands/:companyId/restore  → restore() + clear purge + notify merchant
  - POST /api/admin/deleted-brands/:companyId/purge    → immediate permanent purge (calls purgeBrand)
  - getUserDetail brands query now filters `deleted_at IS NULL` (merchant drawer = active brands only).
- **Raw-SQL scoping filters** added `AND deleted_at IS NULL` to a user's active-brand subqueries in:
  dashboardController.ts (action counts), user/onboarding.ts (×2), helper/kycEnforcement.ts (×2).
- **Full account deletion** (user/accountLifecycle.ts): companyModel.destroy now `force:true` so account
  deletion still HARD-deletes companies (not a recoverable brand delete).
- **Cron** server.ts leader section: daily 03:20 UTC `purgeExpiredBrands()` (lock cron:purgeExpiredBrands).
  INERT in this pod (SAFE MODE) — runs in production only.

============================================================
## ⏳ REMAINING (do next — priority order)
============================================================

### R1 (P0) — Admin "Deleted Brands" UI  ← FEATURE IS INCOMPLETE WITHOUT THIS
The backend restore/list endpoints exist but there is NO frontend to see or restore deleted brands.
Build a panel (new Components/Page/Admin/Merchants/DeletedBrandsPanel.tsx, rendered at the top of
Components/Page/Admin/Merchants/index.tsx, shown only when the list is non-empty):
- Fetch: `adminBaseApi.get("/admin/deleted-brands")` (import adminBaseApi from "@/axiosAdmin").
- Row per brand: company_name, owner_name/owner_email, deleted_at, days_remaining ("N days left"),
  scheduled_purge_at. "Restore" button → POST `/admin/deleted-brands/${id}/restore` (toast + refetch +
  refresh the merchant list). Optional "Delete now" → POST `/admin/deleted-brands/${id}/purge` (confirm dialog).
- data-testids: deleted-brands-panel, deleted-brand-row-<id>, restore-brand-<id>-btn, purge-brand-<id>-btn.
- Style with the existing admin MUI patterns (Paper/Table/Chip like index.tsx / MerchantDrawer.tsx).

### R2 (P0) — TESTING (nothing is functionally tested yet)
Use a THROWAWAY brand — do NOT delete real brands (owner user_id=1 has 1 "The Dev Store", 71 SMADAV,
165 Nameword — all live prod data). Create a scratch brand on the owner account first.
- Frontend (testing_agent, frontend only): login splash shows then dashboard loads; `/auth/register?ref=how_to`
  → referral field NOT shown/prefilled; `/auth/register?ref=DYNO-TEST99` → prefilled + shown; landing FAQ has
  "Can I use Dynopay from my country?" and the reworded Global Reach band.
- Backend soft-delete E2E: POST /company/deleteCompany/:id/send-otp (preview returns `preview_otp` in the
  JSON since DISABLE_OUTBOUND_EMAIL=true) → DELETE /company/deleteCompany/:id?otp=… → brand vanishes from
  GET /company/getCompany → appears in GET /admin/deleted-brands → POST restore → back in getCompany.
  Emails are SUPPRESSED (verify via backend log lines `[Email] SUPPRESSED … subject=Your brand …` and the
  HTML dumped to EMAIL_DUMP_DIR). Test permanent delete via POST /admin/deleted-brands/:id/purge on the
  throwaway brand (or set its scheduled_purge_at in the past and call purgeExpiredBrands).
  Admin creds: moxxcompany@gmail.com / Katiekendra123@ (login at /admin/login). Merchant: onarrival21@gmail.com
  / Katiekendra123@.

### R3 (P1) — Merchant delete-brand success copy
The dashboard component that calls DELETE /company/deleteCompany/:id should surface the new 200 message
("Brand deleted. You have 7 days to restore it — contact support if this was a mistake."). Find the brand-delete
modal (company settings / brand selector) and confirm its toast uses the API message (many do already).

### R4 (P2) — Translate the new FAQ item (myCountry) into de/es/fr/pt/nl (currently EN fallback).

============================================================
## 🆕 NEW FUTURE FEATURE requested by user this session (NOT started)
============================================================
**Merchant "Delete entire account" UI with the SAME confirmation dialog as brand delete + 7-day data protection.**
- Give merchants a UI (account/profile settings) to delete their WHOLE account, using the same OTP/typed
  confirmation pattern as brand deletion, and the SAME 7-day recoverable grace period before permanent purge.
- Today backend/controller/user/accountLifecycle.ts HARD-deletes the account immediately (this session set
  its companyModel.destroy to force:true). To do the feature: mirror the brand soft-delete — add
  deleted_at/scheduled_purge_at to tbl_user (migration), soft-delete on account deletion, block login for a
  soft-deleted user, hide from admin active lists, admin restore + a purge cron, and 3 emails (deleted /
  restored / permanently deleted). Reuse the brand pattern in brandPurgeService/companyEmails as the template.
- Scope this as its own session (schema + auth-login gating + admin UI + cron + emails).

============================================================
## GOTCHAS
============================================================
- Paranoid is now ON for companyModel: any NEW raw SQL that lists a user's ACTIVE brands must add
  `AND deleted_at IS NULL`. All ORM reads are auto-filtered. Historical display JOINs (transaction lists that
  just show company_name) were intentionally left alone.
- The purge cron does NOT run in this pod (SAFE MODE). It only runs on the prod leader instance.
- Migration 012 is already applied to the prod DB. Re-running it is idempotent (IF NOT EXISTS).
- Ship to prod = "Save to GitHub" (droplet auto-deploy). The cron + emails go live there.
