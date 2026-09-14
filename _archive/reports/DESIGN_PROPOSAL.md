# Dynopay — Design Proposal (v3, "Aurora")
_Author: Emergent, 2026‑07‑18_

This document is the plan for **everything not yet redesigned**. The public home
page (`/`) and the fees page (`/fees`) have already been shipped in the new
Aurora system — this document lists every remaining page, groups them by
surface, and proposes the exact treatment for each, with the design tokens,
components, and priorities you'll need to sign off before I start building.

---

## 0. What's already shipped (recap)

| Surface | Page(s) | Status |
|---|---|---|
| Public marketing home | `/` (index) | ✅ **Shipped v3 (Aurora)** — 6 sections, coral + violet + volt palette, live @handle card, synthetic product mocks |
| Public pricing | `/fees` | ✅ **Shipped v3 (Aurora)** — 4 tier cards, live volume calculator, comparison strip, non-custodial pillars |

Every page below is either untouched or lightly branded and needs the same
treatment.

---

## 1. Design system reference (Aurora v3)

Any new page in this proposal will inherit the same tokens/components already
live in `/app/Components/Page/Home/v3/`.

### 1.1 Color tokens (see `theme.v3.ts`)

```
--bg          #FAFAF7   Paper (light canvas)
--bg-alt      #F3EFEA   Cream (alternating sections)
--bg-dark     #0B0B0F   Obsidian (dark surfaces / accent bands)

--ink         #0A0A0A   Primary text
--ink-2       #3F3F46   Secondary text
--ink-3       #71717A   Tertiary / metadata

--coral       #FF5B49   Primary CTA · Merchants
--violet      #7C5CFF   Secondary accent · Fundraisers / callouts
--sky         #4FD1FF   Accent tail of aurora
--volt        #CCFF00   Money / settled / success / Creators
--volt-ink    #5A6B00   Volt on light backgrounds (a11y)

Aurora gradient:  linear-gradient(135deg, #FF5B49, #7C5CFF 55%, #4FD1FF)
```

### 1.2 Typography

Already loaded via `_document.tsx` and available as CSS variables:

```
--font-hero    Unbounded          (headlines, big numbers, brand)
--font-body    IBM Plex Sans      (body copy, buttons, forms)
--font-tech    IBM Plex Mono      (labels, metadata, code, ticker)
```

### 1.3 Reusable components (shipped, in `v3/`)

- `<Eyebrow>` — mono, 11px, 0.28em tracking. Section tag.
- `<HeadlineXL>` — 40–88px, tight, hero.
- `<HeadlineL>` — 30–52px, section head.
- `<Body>` — 17px body.
- `<AuroraInk>` — gradient text fill.
- `BrowserFrame` (inside `ProductStoryV3.tsx`) — macOS chrome + URL bar for
  synthetic product mocks. Will be lifted into its own file
  `v3/BrowserFrame.tsx` so every marketing page can reuse it.

### 1.4 New components this proposal introduces

| Component | Where it lives | Used by |
|---|---|---|
| `<PageHero>` | `Components/Page/_shared/PageHero.tsx` | every non-home public page |
| `<PromptCard>` | `Components/Page/_shared/PromptCard.tsx` | doc / help / blog cards |
| `<DashShell>` | `Components/Dashboard/Shell/DashShell.tsx` | all authenticated pages (sidebar + topbar + main) |
| `<DataCard>`, `<KPIStat>`, `<StatusPill>` | `Components/Dashboard/_atoms/` | dashboard body |
| `<AuthShell>` | `Components/Auth/AuthShell.tsx` | login / register / reset / social validate |
| `<CheckoutShell>` | `Components/Checkout/CheckoutShell.tsx` | `/[handle]` / `/pay` / `/order/[ref]` |

---

## 2. Remaining PUBLIC pages

_Everything under this section is a marketing / trust / policy surface. Any
casual visitor can hit them. They must share one voice with `/` and `/fees`._

### 2.1 `/documentation` — Developer docs
**Current:** 1821‑line monolith, dense two‑pane sidebar, generic dark theme.

**Proposal — "Docs as a product page"**
- **Top bar** — sits inside the standard site header (already fine) with an
  additional persistent "Ask AI" input + a version pill (`v1 · latest`).
- **Left sidebar** (280px, sticky) — collapsible sections with volt-lime hover
  chip, section counter (`01 · Getting started`, `02 · Auth`, …), search box
  with fuzzy match, and a thin coral progress bar showing scroll position
  through the current section.
- **Content column** (max‑width 760px) — Plex Sans, 17px body, 1.6 line-height.
  Headings in Unbounded. Big **"On this page"** anchor list floats on the right
  at desktop widths.
- **Code blocks** — obsidian bg, IBM Plex Mono, volt-lime for strings, sky for
  keywords, coral for values. Copy button per block. **Language tabs**
  (cURL / Node / Python / Go) on multi-lang examples.
- **LLM-native touch (unique)** — every top-level page shows a
  **"Copy this page as Markdown for LLMs"** pill under the H1. Developers use
  Claude/GPT to help them integrate — we make that instant.
- **API reference generator** — turn the current inline API tables into
  collapsible endpoint cards with method chips (`POST` coral, `GET` volt),
  request/response tabs, and a **"Try in playground"** button that pipes into
  the `/try-it` interactive section from the home page.

**Effort:** L (rewrite of the container + doc-item components; content itself
gets ported unchanged into MDX blocks so nothing is lost)

---

### 2.2 `/blog` and `/blog/[slug]` — Blog
**Current:** basic list of cards + article page.

**Proposal**
- **Index (`/blog`)** — aurora-tinted hero band with rotating "featured
  article", then a two-column layout: category chips down the left
  (`Product / Engineering / Company / Crypto 101 / Case studies`), grid of
  article cards on the right. Each card = big title, mono author + date,
  Unbounded tag, aurora bottom-strip on hover.
- **Article (`/blog/[slug]`)** — editorial reading layout, max‑width 720px,
  Plex Sans 18px, drop cap on the first paragraph, coral pull-quotes, TOC
  sticky right rail. End of article: mono "Written by" card + related posts +
  the Final CTA aurora band we ship on `/` and `/fees`.
- **RSS + Atom feeds** — surface link in the footer.

**Effort:** M

---

### 2.3 `/for/[vertical]` — Audience landing pages
**Current:** dynamic route rendering vertical-specific copy.

**Proposal** — four bespoke landing pages, each keyed off the AudienceDoors on
home. The route becomes:

| URL | Palette accent | Fold interaction |
|---|---|---|
| `/for/merchants` | coral | Storefront checkout preview + fee slider |
| `/for/fundraisers` | violet | Goal-bar campaign card + donor wall preview |
| `/for/creators` | volt | @handle card (same as home hero) + tip amounts |
| `/for/developers` | obsidian + volt | Live cURL playground (reuse `TryItNowV3`) |

Each page uses the same 6-section skeleton as `/` but rewrites Section 3
(ProductStory) with mocks scoped to that audience. Copy is audience-specific;
scaffolding is shared, so a fifth audience later takes ~2 hours.

**Effort:** M (four pages × one skeleton)

---

### 2.4 `/creator` — Creator standalone marketing page
Very similar to `/for/creators` above — I'd **merge them** and 301 `/creator`
→ `/for/creators` to avoid duplicate SEO.

**Effort:** S

---

### 2.5 `/company` — About page
**Current:** 442-line story page.

**Proposal**
- Aurora hero: "Money should move like the internet."
- Big Unbounded typography, editorial two-column story block.
- **Numbers band** (reuse `NumbersTrustBand` component with different copy):
  "$X moved · Y merchants · Z countries · Non-custodial from day one".
- Founding-team strip (headshots in circles + one-line bios, aurora ring on
  hover).
- Values grid (3 or 4 pillars, mono eyebrows).
- Careers callout ("We're hiring →" links to a section or an external page).
- Final CTA aurora band (reused).

**Effort:** S

---

### 2.6 `/help-support` and `/help-support/[slug]` — Help center
**Proposal**
- **Index** — search-first layout (big centered "Search help" input with
  aurora focus ring), then category tiles under it (Getting started,
  Payments, Payouts, KYC, Developers, Billing). Below: "Popular articles" list.
- **Article** — same editorial layout as blog article. TOC + related articles
  + a `Was this helpful?` mono toggle at the bottom that fires
  `POST /api/help/feedback` (already exists per the codebase).
- **Ticket entry point** — if a user is signed in, a "Talk to us" pill in the
  top right opens the same in-app support drawer that lives at `/notifications`.

**Effort:** M

---

### 2.7 `/system-status` — Public status page
**Current:** 626 lines, live checks against Redis / DB / Tatum etc.

**Proposal**
- Big **`All systems normal · 99.98%`** hero with the aurora gradient inside
  the number.
- Segmented status grid: three columns — **Payments API · Settlement engine ·
  Merchant dashboard** — each with a 90‑day uptime bar (thin coral tick per
  incident, volt-lime for green days).
- Incident history list underneath, in Unbounded, with mono timestamps.
- Region indicator: this dashboard already reports Binance geo-block status —
  we surface it as a mono pill next to each region name ("US-east · degraded
  Binance rates, using CoinGecko fallback").
- Everything is still driven by the existing `/api/status` endpoint — this is
  purely a visual re-skin.

**Effort:** S

---

### 2.8 `/aml-policy`, `/privacy-policy`, `/terms-conditions` — Legal / policy
**Proposal — one shared "LegalDoc" template**
- Narrow single column (max‑width 720px).
- Sticky mini-TOC on desktop.
- Version + last-updated date pill at the top.
- Print-friendly stylesheet (looks intentional if a compliance officer prints
  it).
- Mono legal captions ("Effective 2026‑07‑01"), Plex Sans body, section
  numbering (§1.1, §1.2, …).

**Effort:** S — one template, three thin data files.

---

### 2.9 `/QA` — QA / FAQ
Currently a QA page. Fold into the compact FAQ on home + a longer FAQ block on
`/help-support`. If we keep the standalone URL, 301 to
`/help-support#faq` to consolidate.

**Effort:** XS

---

## 3. AUTH pages

_The `/auth/*` group. Focus is trust + speed. Uses a shared `AuthShell` for
consistency._

### 3.1 `AuthShell` (shared)
- Split-screen desktop, single column mobile.
- **Left pane** (55% desktop): aurora obsidian panel with a big rotating
  quote (`"Our first crypto payout took 4 seconds." — HostBay, live merchant`)
  plus a subtle animated aurora blob and, at the bottom, small mono trust badges
  (SOC2 / GDPR / Non‑custodial).
- **Right pane** (45%): form on paper background, Unbounded heading, Plex
  Sans labels, coral primary CTA.

### 3.2 `/auth/login` (2085 lines currently)
- Same structure — but the form itself is trimmed hard. Right now it's a
  monster. Proposal:
  1. Email + Password.
  2. `Continue` (coral, full‑width).
  3. Divider `or`.
  4. Google + GitHub OAuth buttons (reuse existing).
  5. **Optional 2FA step** slides in without navigating away.
  6. Small footer: `Forgot password?` + `Create account`.
- All the current logic (rate limiting, geo detection, device trust) stays;
  only the layout + component library changes.

### 3.3 `/auth/register` (815 lines)
- Two-step wizard:
  1. Account: name + email + password (with strength meter that shifts from
     coral → volt).
  2. Purpose: one-of pills (`I'll sell · I'll fundraise · I'll be tipped · I'm
     a developer`) — drives which onboarding flow we push them into after
     first login.
- **Handle claim (same as home hero)** — if they came from the home page with
  a handle already typed, we prefill it and show a green tick or coral cross.
- Same OAuth buttons on the right of the split.

### 3.4 `/reset-password`, `/auth/secure-account`, `/auth/validateSocialLogin`
- Same `AuthShell`.
- Reset: three‑step (email → OTP → new password) with a coral progress bar
  at top of the right pane.
- Secure account: aurora "Verify your account" banner + steps checklist.

### 3.5 `/auth/github/callback`
- Loading state only. Aurora spinner + "Signing you in with GitHub…".

**Effort (all auth):** M — one `AuthShell` + 5 slim view components.

---

## 4. DASHBOARD (authenticated app)

_This is the largest surface. Everything below assumes a shared **`DashShell`**
with sidebar + topbar + main content._

### 4.1 `DashShell` (shared layout)

- **Sidebar** — 240px, sticky, `--bg-alt` background, obsidian text.
  Sections:
  ```
  Overview          →  /dashboard
  Payments          →  /transactions
    ↳ Pay links     →  /pay-links
    ↳ Products      →  /pay-links/products
    ↳ Invoices      →  /invoices
    ↳ Customers     →  /customers
  Wallet            →  /wallet
  Developers        →  /developer-keys
  Referrals         →  /referrals
  ─────────
  Settings          →  /settings
  Notifications     →  /notifications  (with unread coral dot)
  Profile           →  /profile        (avatar + name at the bottom)
  ```
  Each row has: 16px icon, Plex Sans 14px label, thin coral **left bar** on
  the active row.
- **Topbar** — 64px, white bg with a 1px `--line`. Left: page title (Unbounded
  22px). Right: global search (⌘K), balance chip (aurora ink for the number),
  a `+ New` split-button, notifications bell, avatar menu.
- **Body** — max‑width 1240px, 32px side padding.
- **Right-side drawer** for creating pay-links / invoices / products (avoids
  full-page navigation for common actions).

### 4.2 `/dashboard` — Overview
**Current:** 99-line container that composes existing dashboard cards.

**Proposal — "Answer four questions in the fold"**
1. **How much did I make?** — Big Unbounded number in aurora ink, showing
   30‑day net volume in USD, with a 7‑day sparkline underneath.
2. **In which coin?** — Donut of settled currencies, coral/violet/volt/sky
   slices, mono legend.
3. **Where's it flowing?** — Live "Recent activity" feed (poll every 10s):
   coin badge · amount · settlement direction · time-ago. Each row is
   clickable → deep-link into `/transactions`.
4. **What needs my attention?** — Task cards: unclaimed KYC steps, unsigned
   API keys, low-balance chains, unread support messages. Each with a coral
   `Action →` chip.

Below the fold: `Getting started` checklist (only shows for first-30-days
users) + `Recent orders` table.

### 4.3 `/transactions` (35 lines — thin container)
- Full-width table with sticky column headers.
- Filter chips at top (`All · Settled · Pending · Failed · Refunded · Auto-
  converted`). Multi-select.
- Right rail: **Selected transaction** detail panel that slides in without
  leaving the page.
- Row anatomy: coin logo (32px circle with aurora ring), amount, USD equiv,
  chain pill, status pill, timestamp, arrow-right to open drawer.
- Export CSV / JSON button in the topbar.

### 4.4 `/wallet` (265 lines)
- Grid of wallet tiles (same look as the mock on home /step 03) — one per
  chain the merchant has activated.
- Big total across the top (aurora ink).
- Per-tile actions: **Withdraw**, **Receive**, **View on explorer**.
- Below tiles: "Pending settlements" list.
- Adding a new chain = a coral `+ Add chain` tile that opens a drawer with all
  15+ supported chains as toggles.

### 4.5 `/pay-links` and children (66 + 401 + product pages)
- **Index** — table of pay-links, one column per key metric (link,
  product/service, views, orders, revenue, status). "Copy link" quick action
  per row. Big `+ New pay-link` in the topbar opens a drawer.
- **Create/edit pay-link (`/create-pay-link`)** — drawer form with:
  amount / currency / accepted coins (multi-select chips) / branding preview
  on the right (live preview of the buyer-facing checkout).
- **Products (`/pay-links/products`, `/products/new`, `/[id]/edit`,
  `/[id]/orders`)** — spreadsheet-ish table for products, editable inline for
  price/name; orders view = filtered transactions.

### 4.6 `/invoices` (1066 lines — the biggest single file in the app)
- Kanban-ish list grouped by status (`Draft · Sent · Paid · Overdue · Void`).
- Row = customer avatar + name + amount + due date + status pill.
- Bulk actions: `Send reminder · Mark paid · Duplicate · Delete`.
- Invoice editor drawer with live PDF preview on the right.
- I'd split the 1066-line file into 4–5 subcomponents during the redesign
  (list, editor, preview, filter bar, actions) so future changes are cheap.

### 4.7 `/customers` (30 lines — thin container)
- Simple table + right-drawer detail view.
- Customer profile: lifetime value, last transaction, list of orders,
  compliance flags (KYC state, geo, sanctions).

### 4.8 `/developer-keys` (82 lines)
- **Two-column layout**: keys list on the left, code-samples playground on
  the right (reuse `TryItNowV3`'s codeblock component).
- Key row: name · type (`live` coral / `test` volt) · created · last-used ·
  copy · revoke.
- `+ Generate key` drawer with scope selection.
- Below: **Webhook endpoints** section (same shape) — add / test / view logs.

### 4.9 `/referrals`
- Aurora hero showing user's own referral link + copy button + share pills
  (X / Telegram / WhatsApp / email).
- Below: earnings stats (referred users, activated, earned) + a table of
  referrals with status pills.

### 4.10 `/settings` (537 lines)
- Left-hand vertical tabs (Account · Business · Compliance · Notifications
  · Security · Billing · API · Team). Same visual language as sidebar.
- Content pane uses **section cards** (aurora border-top when the section is
  the active tab): each setting is a labelled row with an inline value and
  an "Edit" ghost button.
- Danger zone (delete account, revoke all keys) in a coral-outlined card at
  the bottom.

### 4.11 `/profile` (18 lines) and `/notifications` (23 lines)
- Profile = simplified view of `/settings/account`.
- Notifications = full-page timeline view of the same list that lives behind
  the topbar bell. Filter by kind (transaction, invoice, security, support).
  Each row → deep-link into the underlying resource.

**Total dashboard effort:** L. Sequenced:
1. `DashShell` (1–2 days) →
2. Overview + transactions + wallet →
3. Pay-links + products →
4. Invoices (biggest single) →
5. Everything else.

---

## 5. CHECKOUT / BUYER-FACING surfaces

_These are the pages non-Dynopay users hit when they pay a merchant. Same
Aurora aesthetic but with the merchant's own brand allowed to shine._

### 5.1 `/[handle]` (creator public page)
- Big vertical card centered on the page, avatar + display name + short bio.
- **Inline tip amounts** (existing behavior, already flagged as
  `NEXT_PUBLIC_INLINE_TIP_CHECKOUT`) with the same amount chip pattern from
  the home hero.
- Merchant can theme it: pick a hero image, an accent color (falls back to
  aurora coral if not set), and toggle showing recent tippers.

### 5.2 `/[handle]/shop`, `/p/[slug]`, `/cart`, `/checkout`
- Shop = product grid with hover-lift on cards, price in Unbounded, aurora
  gradient on the "Buy" chip.
- Product page = image left / info right, sticky "Buy in crypto" panel.
- Cart = clean line-items list, address block, "Continue to checkout" coral
  CTA.
- Checkout = same visual language as the checkout mock on the home page's
  ProductStory (browser chrome removed, this IS the checkout).

### 5.3 `/pay`, `/pay/index`, `/pay/demo` and payment-state pages
- One shared checkout shell.
- States handled: `pending → confirming → confirmed → settled → failed`.
- Each state has its own micro-animation (subtle aurora pulse on pending,
  coral shake on failure, volt confetti on settled).
- QR + address block, live TX explorer link, remaining time countdown.
- Demo pages (`/pay/demo`, `/pay/donation-demo`, `/pay/success-demo`,
  `/pay/payment-states-demo`) become a **`/pay/demo` playground**: single
  page with a state-picker at the top and the checkout below, so we
  demonstrate every state without maintaining separate files.

### 5.4 `/order/[publicRef]`
- Public receipt page. Same clean checkout shell but read-only.
- Shows: order ref, merchant, amount, coin, chain, TX hash (linked to
  explorer), timestamp, status.

### 5.5 `/payment/success`, `/failed`, `/verify`
- Reuse the payment-state animations from above.
- Success page adds: "Save receipt", "Share with merchant", "See on chain".

**Effort:** M — one `CheckoutShell`, one state machine, then per-page skins.

---

## 6. ADMIN

_The `/admin/*` group is internal-facing (fee tuning, wallet ops, transfer
speeds, admin profile). It should feel more utilitarian — data-density
first — but still share tokens with the rest of the app._

### Proposal
- Different visual weight: darker default (obsidian everywhere), no marketing
  motion, sharp corners, denser tables.
- Same `DashShell` skeleton but with an `Admin` badge next to the logo and a
  volt-lime top-border across every page to visually remind you "you're in
  admin".
- Pages: `/admin` (dashboard of platform-wide KPIs), `/admin/fee`,
  `/admin/wallet`, `/admin/withdraw`, `/admin/transferSpeed`,
  `/admin/profile`, `/admin/login`.

**Effort:** M — mostly reusing `DashShell`; some custom heavy tables.

---

## 7. Rollout plan — how I'd sequence this

Each phase produces a deployable, testable release. Numbers are calendar-week
estimates assuming you approve each phase before I start the next.

| Phase | What ships | Est. |
|---|---|---|
| **✅ 0** | Home + Fees (done) | — |
| **1** | Public marketing polish: `/documentation`, `/company`, `/help-support`, `/system-status`, `/QA`, legal templates | 1 wk |
| **2** | `/blog` + `/blog/[slug]` + `/for/[vertical]` (all 4 verticals) | 1 wk |
| **3** | `AuthShell` + login/register/reset/secure-account/validate | ~3 days |
| **4** | `DashShell` + `/dashboard` + `/transactions` + `/wallet` | 1 wk |
| **5** | Pay-links: `/pay-links`, `/create-pay-link`, `/pay-links/products/*` | ~4 days |
| **6** | `/invoices` (biggest single file, gets split into components too) | ~4 days |
| **7** | Everything else in dashboard: `/customers`, `/developer-keys`, `/referrals`, `/settings`, `/profile`, `/notifications` | 1 wk |
| **8** | Buyer-facing: `/[handle]/*`, `/pay/*`, `/order/[publicRef]`, `/payment/*` | 1 wk |
| **9** | `/admin/*` | ~3 days |

Total redesign runway from here: **~6–7 weeks** at one full-time pace, or we
can pick the two or three surfaces that most affect conversion right now.

---

## 8. Decisions I need from you before I start Phase 1

Answer any of these in shorthand:

1. **Sequence** — is the Phase 1 → 9 order above right, or do you want the
   dashboard shipped **before** the rest of the marketing pages? _(Dashboard
   is where real users spend hours; marketing is where prospects convert.)_
   → **a. keep proposed order (marketing → auth → dashboard → checkout → admin)**
   → **b. flip — do dashboard first, marketing later**
   → **c. custom order (tell me)**

2. **Documentation strategy** — the current `/documentation` is a 1821-line
   TSX monolith. To make it maintainable I want to move the content to
   **MDX files** in `/content/docs/`. This means content-writers (or you) can
   edit prose without touching JSX. Blocker?
   → **a. yes, move to MDX**
   → **b. keep as TSX for now**

3. **Blog CMS** — do you want the blog fed by:
   → **a. MDX files in the repo (git-managed, no CMS)**
   → **b. an external CMS (Contentful / Sanity / Ghost)**
   → **c. keep whatever is there — you'll wire content up yourself**

4. **Handle system** — the home hero and audience pages promise
   `dynopay.me/@yourhandle`. Is that already a real route
   (`/[handle].tsx` exists), and is the DB-side lookup working? If not, I
   need to add the reservation flow. → **a. already working**  · **b. need to
   build it**

5. **Dashboard priorities** — inside the dashboard, which single view do
   real merchants use the most today? I'll prioritise that in Phase 4.
   → **a. Overview** · **b. Transactions** · **c. Wallet** · **d. Pay‑links**
   · **e. Invoices**

6. **Admin** — is `/admin/*` used by internal Dynopay staff only, or is it
   ever exposed to external partners / whitelabels? Affects how much branding
   flexibility it needs. → **a. staff only** · **b. also partners**

7. **Testimonials** — you said "drop" for home. Same for
   `/for/[vertical]` and `/company`? Or those pages get real quotes if we
   can source them?
   → **a. drop everywhere** · **b. keep on `/company` and `/for/*` if real
   quotes exist** · **c. keep everywhere but only if we have real quotes**

Answer in the format `1a 2a 3a …` and I'll kick off Phase 1 immediately.

---

_End of proposal._
