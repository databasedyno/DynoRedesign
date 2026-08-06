# DynoPay — Enhancements & Fixes Log

_Last updated: 2026-08-05_

This document tracks every feature enhancement and fix discussed/requested, with
current status, root cause (for bugs), and the plan. Status legend:
✅ Done & verified · 🔧 In progress · 🕗 Backlog (needs go-ahead / design input)

---

## ✅ DONE & VERIFIED

### 1. Fee-payer "You receive" math (Create Payment Link)
- **Was:** `GET /api/pay/fee-preview` always returned `you_receive = amount − fee`, ignoring who pays.
- **Fix:** endpoint now honours `fee_payer`. `customer` → merchant receives the FULL amount, customer pays `amount + fee`; `company` → fee deducted from payout. Frontend sends `fee_payer`, re-fetches on toggle, and shows a "Customer pays" row.
- **Verified:** backend testing agent (all cases).

### 2. Fee Tiers in the create-link estimate
- **Was:** preview used only the 1.5% percentage; settlement also charges a fixed per-tier fee (e.g. $1.00 for $1–$100) → estimate didn't match to the cent.
- **Fix:** `getFeePreview` now adds the fixed tier fee (`getFeeTiers`) so the estimate matches settlement (network fee still shown at checkout once a coin is picked). Label shows e.g. "Estimated Fee (1.5% + 1 USD fixed)".
- **Verified:** backend testing agent (fee=1.30, company you_receive=18.70, customer customer_pays=21.30).

### 3. Fee Clarity on checkout
- **Fix (`CleanCheckoutV2`):** relabeled the customer-pays fee row "Network fee" → "Processing fee", the total → "Total you pay", and the success/receipt screen now shows the fee-inclusive total the customer actually paid.
- **Verified:** frontend testing agent.

### 4. Dark/light invisible text — expiry date/time picker
- **Root cause:** `ExpirationDateTime.tsx` & `TimeDropdown.tsx` imported the STATIC light-mode theme instead of `useTheme()`; icons were force-filtered black.
- **Fix:** dynamic `useTheme()`; icons use `themed-icon`.
- **Verified:** frontend testing agent (white in dark, near-black in light).

### 5. "Coinbase look" typography — app-wide
- **Fonts:** added **Inter** (UI text) + **Roboto Mono** (numbers) via `next/font` in `_app.tsx` (`--font-inter`, `--font-roboto-mono`). UI-Kit `MONO` now leads with Roboto Mono.
- **Scope:** Inter applied to the whole authenticated shell via `Containers/Client` (redefines `--font-sans`); public landing/checkout keep their own type.
- **UI Kit:** new `styles/uiKit.tsx` — `MONO`, `<Icon name="…">` (Lucide via Iconify), `MonoAmount`.
- **Verified:** frontend testing agent across Dashboard, Transactions, Payment Links, Profile (Inter confirmed; Roboto Mono on money pages; both themes).

### 6. Dashboard restyle (pilot) + Wallet/Transactions rollout
- Monospace numerals + Lucide line icons on Dashboard (hero, KPIs, quick actions, command bar, checklist, assets, fee tier), Wallet (amounts, view/edit/delete icons), Transactions (amounts, source/close/download icons, tax total, webhook JSON).
- **Verified:** Dashboard 6/6 (96/96 icons rendered) both themes; Transactions verified; Wallet by code review (test account has 0 wallets).

### 7. `/invoices` ERR_ABORTED (fix applied 2026-08-05)
- **Finding:** the page is NOT broken — it loads (HTTP 200, renders invoices + tax report). The `ERR_ABORTED` was a transient navigation artifact caused by NextAuth's `SessionProvider` firing a mount fetch to `/api/auth/session` (which, in this preview, routes to the backend proxy and gets aborted during navigation → recurring `CLIENT_FETCH_ERROR`).
- **Fix:** pass a DEFINED initial session (`session={pageProps.session ?? null}`) so NextAuth v4 skips the mount fetch; also `refetchWhenOffline={false}`. Removes the recurring error app-wide. OAuth sign-in still refreshes the session on demand.
- **Verify:** frontend testing agent (repeated navigation to /invoices, no abort, no CLIENT_FETCH_ERROR).

---

## 🕗 BACKLOG — needs go-ahead / design input

### A. Overpayment retention + refund request + admin email  (money flow — needs sign-off)
- **Current behaviour:** overpayment is DETECTED, but the full received amount (incl. excess) is already settled to the merchant; "overpaid" is only a status flag with `excessAmount`. No platform retention, no refund flow, no admin email.
- **Requested behaviour:** platform RETAINS the overpaid excess; the payer requests a refund AFTER payment by submitting a wallet; ADMIN gets an email with payment details and processes the refund manually.
- **Design decisions still needed (from earlier questions):**
  - Retention model: (a) settle only expected amount to merchant + keep excess on platform/admin wallet (needs sweep/settlement changes) vs (b) settle full + record excess as a liability + manual off-chain refund.
  - Refund-request UX: checkout success screen form and/or a "you overpaid" email link.
  - Admin email: send to `ADMIN_EMAIL` (moxxcompany@gmail.com) via Brevo — confirm OK to send real emails in preview (background jobs are OFF).
  - Safe-to-test constraints on LIVE production data.
- **New pieces:** refund-request model/table, API endpoints, admin email template, admin refund UI, settlement change.

### B. Merchant settings UI for overpayment/underpayment/grace thresholds
- `companyModel` already has `overpayment_threshold_usd` ($5 default), `underpayment_threshold_usd` ($1), `grace_period_minutes` (30), but there is **no UI and no API** to edit them. Add a settings section + endpoint.

### C. Creator page header/image — overflow fix + UI/UX reimagining  (public creator/tip/store pages)
- Header overflows onto the profile image area (reported on the public page). Needs the exact screenshot / a published creator page to reproduce precisely.
- Also: reimagine the hero layout (cover `cover_style`: solid/gradient/pattern/image + avatar + name/handle) for a modern, unique look consistent with the new design language.

### D. API documentation review (consistency, integration simplicity, clarity)
- Public `/documentation` page (~1,820 lines) + backend Swagger at `/api/docs`. Audit for consistency with the actual backend API, integration simplicity, and clarity; recommend/implement technical changes.

### E. UI/UX copy pass (consistency & clarity)
- Sweep in-app copy (labels, buttons, empty states, tooltips) for consistent voice and clarity.

### F. Finish the design rollout  🔧 IN PROGRESS
- **Phase 1 DONE & verified (2026-08-06):** Referrals, Invoices (+ tax report), and Company migrated to the single **Lucide** `<Icon>` set + **Roboto Mono** on all figures; Invoices also dropped its static `@/styles/theme` import (spacing → `useTheme()`).
- **Phase 2 DONE & verified (2026-08-06):** Profile (AccountSetting, UpdatePassword, LoginActivity, ActiveSessions, AddContactInfo), the API/Developer‑Keys pages (ApiKeysPage, PublishableKeysSection, BuyButtonsSection, WebhookConsoleSection), and Wallet (`Wallet/index.tsx` static‑theme import removed; `pages/wallet.tsx` icons + breakpoints → `useTheme()`) all migrated to Lucide `<Icon>`. Verified via screenshots (developer‑keys 93 / profile 47 / wallet 42 Iconify icons, zero runtime errors). All lint clean.
- **Remaining (Phase 3 — dark‑mode audit):** shared in-app UI components still importing the static `@/styles/theme` (DataTable, DeleteModel, AdornedInputField, CurrencySelector, SettingsAccordion, Toast, ApiKeysModel) — migrate to `useTheme()`/tokens.
- **Excluded:** public marketing pages (Home, `/fees`, checkout) keep their own design system; Customers page is "SOON".

---

## Notes / environment
- Preview uses relative `/api` (frontend `NEXT_PUBLIC_BASE_URL` empty) so it works on any preview host.
- Connected to LIVE production Railway PostgreSQL + Redis. **Background jobs are OFF** (`ENABLE_BACKGROUND_JOBS=false`, `WORKER_ROLE=secondary`) so no real sweeps/conversions/emails fire from the preview.
- NextAuth OAuth (Google/GitHub) can't complete in the preview because `/api/auth/*` routes to the backend proxy, not Next.js — email/password (JWT) login works normally.
- Test merchant: `hostbay@moxx.co` / `Katiekendra123@`.
