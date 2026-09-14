# Dynopay Design & Architecture Audit — 2026-08-05
_Author: Emergent. Purpose: extend the Aurora v3 / v2026 design system beyond `/dashboard`, `/`, and `/fees`._

This is the follow-up audit requested in the 2026-08-05 chat session. Prior work established:
- **Home (`/`) — Aurora v3** (indigo, violet, sky, volt-lime, Unbounded/Plex, aurora gradient)
- **Fees (`/fees`) — Aurora v3** (dark hero, mono eyebrow, gradient number, calculator)
- **Dashboard (`/dashboard`) — v2026 / Coinbase tokens** (indigo, sidebar+topbar shell, VolumeHero, KpiStrip, AssetsCard, QuickActionsDock, FeeTierCard, ActivationChecklist)

Design tokens live in **`/app/Components/Page/Home/v3/theme.v3.ts`** (`useAurora()`) and **`/app/Components/Page/Dashboard/coinbase/styled.tsx`** (`CB_TOKENS`). Only **4 pages** currently import these: `dashboard.tsx`, `fees.tsx`, `blog/index.tsx`, `creator.tsx`. Everything else still uses generic MUI palette + one-off `sx={{}}` styles → **inconsistent surfaces, borders, radii, typography scale, and empty-state treatment.**

---

## 0 · Method

- Logged in as `hostbay@moxx.co` on the preview URL (`https://b4d836b1-…preview.emergentagent.com`).
- Captured 30 screenshots across **public marketing / auth / in-app / buyer / admin** at 1440×900.
- Cross-referenced with source in `/app/pages/*` and `/app/Components/Page/*`.
- Compared against the 2026-07-18 **DESIGN_PROPOSAL.md** (Aurora v3 plan) and the shipped v2026 dashboard as the reference baseline.

---

## 1 · Global findings

| # | Issue | Where | Severity |
|---|---|---|---|
| G1 | **Only 4 pages import Aurora/v2026 tokens** — every other page uses raw MUI palette. No shared shell primitives yet. | Everywhere except `dashboard/`, `fees.tsx`, `blog/index.tsx`, `creator.tsx` | 🔴 high |
| G2 | **No shared `DashShell`, `AuthShell`, `CheckoutShell`** as promised in DESIGN_PROPOSAL. Layout duplicated inside every page. | `/app/Components/Layout/*` | 🔴 high |
| G3 | **Mixed typography scale** — Unbounded lives on marketing pages, but in-app pages fall back to system sans. Section titles inconsistent (14/16/18/22 px used interchangeably). | In-app pages, legal pages | 🟠 medium |
| G4 | **Card/border tokens diverge** — dashboard uses 20 px radius + hairline `rgba(10,10,15,0.08)`; other pages mix 8/12/16 px + solid `theme.palette.divider`. | Wallet, Pay-links, Invoices, Settings, Customers | 🟠 medium |
| G5 | **Empty-state / loading states are missing** on most in-app pages (blank tables when 0 rows, no skeleton on first load, no "Recovered Customer" placeholder cleanup). | Customers, Invoices, Products | 🟠 medium |
| G6 | **Hydration error on `/creator`** ("initial UI does not match server") — visible in the browser as a red Next.js overlay. Must fix before any redesign. | `pages/creator.tsx` + `Components/Page/Creator/*` | 🔴 high (bug) |
| G7 | **No coherent motion system** — Aurora pages have subtle aurora blob animations & hover glows; in-app pages have none. Feels like two products. | In-app, Auth | 🟡 low-medium |
| G8 | **Light/dark parity broken outside dashboard** — many in-app pages force one mode or the other because tokens aren't defined for both (dashboard tokens handle both perfectly). | Wallet, Invoices, Settings | 🟠 medium |

---

## 2 · Page-by-page audit

Each row: **Status** = 🟢 shipped Aurora · 🟡 partially aligned · 🔴 not started. **Effort** = XS / S / M / L.

### 2.1 Public marketing

| Page | Status | Key gaps | Effort |
|---|---|---|---|
| `/` — Home | 🟢 | shipped Aurora v3 | — |
| `/fees` | 🟢 | shipped Aurora v3 | — |
| `/blog` (index) | 🟢 | uses `INDIGO` tokens; good editorial card layout; hover effects OK | — |
| `/blog/[slug]` | 🟡 | article page not yet audited — likely missing sticky TOC, coral pull-quotes, "Written by" card | S |
| `/documentation` | 🟡 | Aurora hero shipped (`[ DEVELOPER DOCUMENTATION ]` mono + indigo "API Reference" gradient); 4 method cards OK. **Missing:** language tabs on code blocks, "Copy this page for LLMs" pill, method chips (`POST`/`GET` colored), "Try in playground" hook to `TryItNowV3`. | M |
| `/company` | 🔴 | still the 442-line story page from before Aurora. No aurora hero, no `NumbersTrustBand` reuse, no team strip, no values grid. Just plain text. | S |
| `/help-support` (index) | 🟡 | category tiles exist with arrow icons and clean copy. **Missing:** big "Search help" input (aurora focus ring), "Popular articles" list underneath, chat entry indistinguishable from noise (currently coral card at bottom). | S |
| `/help-support/[slug]` | 🔴 | not audited but likely plain — needs same editorial layout as `blog/[slug]`, TOC, "Was this helpful?" mono toggle | S |
| `/system-status` | 🟡 | Aurora-tinted "All Systems Operational" chip and green dots — nice — but **missing** the flagship aurora "99.98%" hero number, per-service 90-day uptime tick-bars, region indicator (`US-east · Binance degraded`) even though backend `/health` already exposes it. | S |
| `/for/[vertical]` — merchants, creators, fundraisers, developers | 🟡 | All four use the **same generic template** with a coral-orange cloud icon and identical 3-step "Why Dynopay" block. **No vertical differentiation** — creators should get **volt-lime** treatment + `@handle` card mock, fundraisers get **violet** + goal-bar card, developers get **obsidian + volt** + live cURL playground. Currently all four look identical except for headline copy. | M |
| `/creator` | 🔴 (auth) | This is the in-app "Creator page" tab (settings, not marketing). **Hydration error** in the browser overlay. Missing: aurora accent bar; the ACCENT_COLOR picker is functional but the swatch tiles have no `useAurora()` colors. | M (blocked by G6 first) |
| `/aml-policy`, `/privacy-policy`, `/terms-conditions` | 🔴 | Just black text on cream. No mono eyebrow, no version pill (`Effective 2026-07-01`), no sticky TOC, no `§1.1` section numbering, no print-friendly CSS. | S (one shared `LegalDoc` template) |
| `/QA` | 🔴 | 2022-line monolith. Should fold into `help-support/[slug]#faq` and 301 the URL. | XS |

### 2.2 Auth

| Page | Status | Key gaps | Effort |
|---|---|---|---|
| `/auth/login` | 🔴 | Simple centered card. **Missing entire `AuthShell` proposal** — no split-screen, no obsidian left pane with rotating quote / trust badges, no aurora blob. Trust chips (`1,000+ merchants · $24M+ processed`) exist at bottom but disconnected. | M |
| `/auth/register` | 🔴 | Same as login. **Missing 2-step wizard** (Account → Purpose pills: "I'll sell · I'll fundraise · I'll be tipped · I'm a developer") — this drives onboarding routing and would materially improve activation. Also no `@handle` prefill from home hero. | M |
| `/reset-password` | 🔴 | Falls through to login with a toast. No 3-step wizard (email → OTP → new password) with a coral progress bar. | S |
| `/auth/secure-account`, `/auth/validateSocialLogin`, `/auth/github/callback` | 🔴 | Not yet using shared shell. `github/callback` should show an aurora spinner + "Signing you in with GitHub…". | S |

### 2.3 In-app (authenticated)

| Page | Status | Key gaps | Effort |
|---|---|---|---|
| `/dashboard` | 🟢 | shipped v2026 — this IS the reference | — |
| `/transactions` | 🟡 | Uses dashboard shell + coinbase tokens (looks aligned). **Missing:** coin logo circle with aurora ring per row, status pills (currently plain), export CSV/JSON control, right-drawer "Selected transaction" detail panel, wallet column populated (currently `—`). | M |
| `/wallet` | 🟡 | Uses shell. **Missing:** big "Total processed" hero across the top (aurora ink); cards lack the aurora border-top or per-chain accent; no "Pending settlements" list; no coral `+ Add chain` tile. Address rows and action icons are cramped. | M |
| `/pay-links` | 🟡 | Table with filters, status pills, "Create payment link" CTA — good. **Missing:** views/orders/revenue per-row metrics, per-row "Copy link" quick action, empty description rows should show a coral link (`+ Add description`), drawer-based edit instead of full-page nav. | S |
| `/pay-links/products` | 🔴 | Not captured (blocked by hydration error on `/creator` sidebar tab). Needs inline-editable table + orders view. | M |
| `/create-pay-link` | 🟡 | **One of the better-redesigned pages** — has Payment link/Crowdfunding tabs, "Sell a product from store" quick-fill, blockchain-fees-paid-by radio, accepted-crypto grid, **and a live preview panel on the right** (already matches proposal). **Missing:** aurora accent chips, better crypto grid iconography, a compact "Advanced options" fold. | S |
| `/invoices` | 🔴 | Very basic table (6 rows, columns Invoice#/Date/Customer/VAT/Total/PDF). All customers show `hostbay` (data quality). **Missing:** Kanban grouped by status (Draft/Sent/Paid/Overdue/Void), customer avatars, due date, bulk actions, invoice editor drawer with live PDF preview. This is the biggest single-file page in the app (1131 lines) and the biggest UX gap. | L |
| `/customers` | 🟡 | KPI cards top (Total/Wallet/Base) + search + table. **Missing:** right-drawer customer profile (lifetime value, orders, KYC flags); rows all show "Recovered Customer" — placeholder needs cleanup; no customer avatar or initials tile; no filter chips. | M |
| `/developer-keys` | 🟢 | Actually one of the best-designed pages. Has USD API Key + Admin Token with copy/reveal, embedded checkout server+client code samples in coinbase-obsidian code blocks. **Only missing:** two-column layout (keys list left / playground right) instead of stacked; separate Webhook Endpoints section with logs viewer. | S |
| `/referrals` | 🟡 | Has referral code, share buttons (Twitter/WhatsApp/Telegram/Copy), "How It Works" 3-step, "10% Off Fees" and "50% Off Fees" cards, referral stats grid. **Missing:** aurora hero band that headlines the personal link (currently just a plain code); "Refer earnings breakdown" is bland. | S |
| `/settings` | 🟡 | Left-hand vertical tabs (Profile & Security / Company / Payments / Tax / Webhooks / API Keys / Notifications). Content pane structure works. **Missing:** aurora border-top on active section card; danger zone at bottom (delete account / revoke all keys) in coral-outlined card. | S |
| `/profile` | 🟡 | Redirects to `/settings` — good decision (simplifies IA). Just needs sidebar entry consolidated. | XS |
| `/notifications` | 🟡 | Timeline with `Inbox (4)` / `Settings` tabs + "Payment Received" / "Payment Pending" cards. **Missing:** filter chips by kind (transaction/invoice/security/support); rows should deep-link to the underlying resource. | S |

### 2.4 Buyer-facing / checkout

| Page | Status | Key gaps | Effort |
|---|---|---|---|
| `/[handle]` (creator public page) | 🟢 | Aurora shipped: circular avatar with indigo ring, share bar, tip amount chips, momentum chart, "Powered by Dynopay" footer. | — |
| `/[handle]/shop` | 🟢 | Volt-lime gradient hero band, "1 product · 2 sold · Instant crypto checkout" chips, product grid with category filter + Sort dropdown. Good. | — |
| `/[handle]/cart`, `/[handle]/checkout` | 🟡 | Not deeply captured; likely aligned but need audit of the buyer confirmation state. | S |
| `/pay/demo`, `/pay/index` | 🟡 | 3-step progress bar (ORDER → PAYMENT → DONE), indigo Pay CTA, order details + line items, "Fees covered by merchant" badge — solid foundation. **Missing:** aurora gradient inside the progress bar's active segment; big Unbounded total; aurora background flourishes on `payment` state; volt-lime confetti on `settled`; coral shake on `failed`. | M |
| `/pay/donation-demo`, `/pay/success-demo`, `/pay/payment-states-demo` | 🔴 | Should be **consolidated into one `/pay/demo` state-picker playground** (drop-down at top: pending / confirming / confirmed / settled / failed / expired) so the demo state machine is showcased in a single URL. | S |
| `/order/[publicRef]` | 🔴 | Read-only receipt not audited but likely on the old design. | S |
| `/payment/success`, `/payment/failed`, `/payment/verify` | 🔴 | Not audited. Should reuse the checkout state animations. | S |

### 2.5 Admin

| Page | Status | Key gaps | Effort |
|---|---|---|---|
| `/admin`, `/admin/fee`, `/admin/wallet`, `/admin/withdraw`, `/admin/transferSpeed`, `/admin/profile`, `/admin/login` | 🔴 | Not yet touched. Per proposal these should share `DashShell` but with an `Admin` badge next to the logo and a volt-lime top-border across every page to remind operators "you're in admin". Denser tables, no marketing motion. | M |

---

## 3 · Product-type differentiation (the piece missing today)

Dynopay has **four buyer types** — merchants, fundraisers, creators, developers — but the current app treats them all identically. The design proposal calls for **per-vertical color accents** so the surface a user is on reflects the mode they are in:

| Vertical | Primary token | Where it should appear |
|---|---|---|
| **Merchants** (default) | `INDIGO #4F46E5` | dashboard, invoices, pay-links, products, checkout, `/for/merchants` |
| **Fundraisers** | `VIOLET #7C5CFF` | crowdfunding pay-link editor, donation checkout, goal-bar cards, `/for/fundraisers` |
| **Creators** | `VOLT #CCFF00` | `@handle` page, creator settings, tip checkout, `/for/creators` |
| **Developers** | `OBSIDIAN #0B0B0F` + `VOLT` code hits | `/developer-keys`, `/documentation`, `/for/developers` |

**Right now** these accents are only correctly applied on:
- `/[handle]` (creators, volt) ✓
- `/[handle]/shop` (creators, volt) ✓
- `/dashboard` (merchants, indigo) ✓

Missing everywhere else — see `for/*`, `create-pay-link` (should shift accent when Crowdfunding tab is active), donation checkout, developer-keys sidebar row, etc.

---

## 4 · Recommended sequence (my proposal)

Numbered phases; each phase ships independently.

### Phase 1 — Unblock (½ day)
- Fix **hydration error on `/creator`** (G6) — this is a real user-facing bug, must land first
- Extract shared design primitives into `/app/Components/UI/_shared/`:
  - `<Eyebrow>`, `<HeadlineXL/L>`, `<Body>`, `<AuroraInk>`, `<StatusPill>`, `<PillButton>`, `<SurfaceCard>` (re-export from v3 + coinbase so a single import path works everywhere)
- Add a `useVerticalAccent()` hook that returns the right token based on route/context

### Phase 2 — Auth flip (½ day)
- Build `<AuthShell>` (split-screen desktop, single-column mobile, aurora obsidian left pane with rotating merchant quote + trust badges)
- Repaint `/auth/login`, `/auth/register`, `/reset-password`, `/auth/secure-account`, `/auth/validateSocialLogin`, `/auth/github/callback` on top of it
- Add 2-step register wizard with **purpose pills** — this is a real activation lever

### Phase 3 — In-app polish (2–3 days)
- **Transactions:** coin logo with aurora ring + right-drawer detail
- **Wallet:** big total hero + `+ Add chain` tile + per-chain accent stripe
- **Invoices** (biggest ROI): split 1131-line file into `InvoiceList`, `InvoiceEditor`, `InvoicePreview`, `FilterBar`, `BulkActions`; add Kanban grouping + live PDF preview drawer
- **Customers:** right-drawer profile + cleanup "Recovered Customer" placeholder naming
- **Settings:** aurora border-top on active section card + danger zone

### Phase 4 — Public marketing (2 days)
- **`/for/[vertical]`:** apply per-vertical accent + swap ProductStory mocks per audience
- **`/company`:** aurora hero + team strip + values grid
- **`/system-status`:** flagship "99.98%" aurora number + 90-day tick bars + region indicator
- **Legal pages** (`aml-policy`, `privacy-policy`, `terms-conditions`): one shared `<LegalDoc>` template

### Phase 5 — Checkout state machine (2 days)
- Build `<CheckoutShell>` with the 5-state animation set (aurora pulse / coral shake / volt confetti)
- Consolidate `/pay/*` demos into a single `/pay/demo` state-picker playground

### Phase 6 — Admin (1 day)
- Reuse `DashShell` with `Admin` badge + volt-lime top-border; denser tables

**Total runway: ~7–8 working days** to bring 30+ pages to parity with `/dashboard` and `/`.

---

## 5 · What I need from you to start

1. **Sequence** — accept the Phase 1 → 6 order above, or flip to public-marketing first (Phase 4 before 3)?
2. **Vertical accents** — confirm the 4-color mapping (INDIGO merchants / VIOLET fundraisers / VOLT creators / OBSIDIAN+VOLT developers) or override
3. **Hydration bug fix** — OK to start with Phase 1 (fix `/creator` hydration + extract shared primitives) since nothing else can safely ship without shared primitives?
4. **Scope limits** — any specific page(s) you want prioritized because they hurt conversion right now (e.g. auth, invoices)?

Once you decide, I'll execute phase-by-phase, ship each independently, and check back before starting the next.
