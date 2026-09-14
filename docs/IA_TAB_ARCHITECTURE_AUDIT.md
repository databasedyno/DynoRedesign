# DynoPay — Human-Experience & Tab-Architecture Audit
**Date:** 2026-06 (fork session) · **Author:** E1 · **Scope:** merchant app IA — which functionality belongs in which tab, judged against how a human actually uses this product
**Companion docs:** `docs/IA_AUDIT_2026-08.md` (the structural audit: tenancy, primitives, endpoint sprawl) · `memory/CHANGELOG.md` (what shipped)
**Contents:** §0–3 audit · §4 target architecture + laws · §5 sequenced plan · **§6 next-action build specs (N1–N4)** · **§7 potential improvements (I1–I7)** · §8 open questions

---

## STATUS — updated 2026-08-13 (read this first; it supersedes the ✅/priority marks below)

**Batch A "the chrome" SHIPPED** — verified on the live prod DB (backend 6/6, frontend 8/9 with the two
misses explained below). It closed **N1 (F13) · N3 (F3) · F4 · F6 · F7 · F8 · F9**, plus F14 earlier.

| What | State |
|---|---|
| F14 route loader | ✅ shipped (earlier session) |
| **F13 / N1** persona nav + reveal-on-relevance | ✅ shipped 2026-08-13 |
| **F3 / N3** one `+ New` in the header | ✅ shipped 2026-08-13 |
| **F4** *Invoices & Tax* → **Receipts & Tax** (nav + page title + tab, 6 locales) | ✅ shipped |
| **F6** Fees given a home (*Plan & fees* pointer in Settings) | ✅ shipped |
| **F7** Customers ships for real; the *Soon* badge MECHANISM was deleted (law 5) | ✅ shipped |
| **F8** Notifications left the nav → header bell (same unread badge) | ✅ shipped |
| **F9** Referrals left the nav → footer card + Settings pointer | ✅ shipped |
| **F5 / N4** Developers home (Keys · Webhooks · Events log · Docs) | ✅ shipped 2026-08-13 (Batch B) |
| **F11** Settings → grouped rail (ACCOUNT·BUSINESS·PAYMENTS), *Company* → *Account details* | ✅ shipped 2026-08-13 (Batch B) |
| **F1 / N2** product sales inline + retire the 3rd order surface | ⏳ Batch C |
| **F2** Storefront analytics → one deep-link strip | ⏳ Batch C |
| F10, F12 | ⏳ not started |
| §7 I1–I7 revenue ideas | ⏳ I7 partially: buyer receipt shipped as a checkout PDF download (2026-08-13); the shareable receipt PAGE is still open. I6's SSR prerequisite fixed. |

### §8 open questions — ANSWERED by the founder 2026-08-13
1. **Q1 naming:** persona-specific. `Storefront` for individuals, **`Checkout page`** for business — a
   business has no catalog to "front" (1 product exists platform-wide, and 4 of 5 accounts are business).
   Still outstanding sprawl: the dashboard tile says *Your page* and the legacy route says *creator* —
   one name should win everywhere.
2. **Q3 Customers:** ship it, revealed once a customer row exists (142 customer rows across 3 of 5
   accounts, but only 2 repeat buyers — so the row is real, the "paid me twice" job is still thin).
3. **Q4 reveal-on-relevance:** **yes**, session-sticky, with every hidden row still reachable from
   Settings. The data made the case: only 1 of 5 accounts has an invoice row and only 2 of 5 have an API
   key, so most merchants were carrying 2–3 permanently-empty rows.
4. **Q2 real invoicing:** **not on the roadmap now** → *Receipts & Tax* stays a leaf, and `Bill` is
   deliberately absent from `+ New`. 6 invoices exist in total and 39 of 46 links sit in `pending`: the
   product is "share a link, get paid now", not "send a bill and wait". If receivables are ever wanted,
   **I1 expired-link rescue** delivers most of it without inventing a new object.

### Deviations + notes from the Batch A build
- **Group count:** the persona orders in §6/N1 cannot be expressed as ≤4 *contiguous* semantic groups, so
  the business rail uses `Dashboard` (no label) · **GET PAID** · **MONEY** · **YOUR SETUP** · **ACCOUNT`**
  and the individual rail uses **GET PAID** · **MONEY** · **ACCOUNT** — 4 labels, as targeted.
- **Customers** sits at the end of the MONEY group rather than under a one-row `GROW` heading: a heading
  costs the same vertical space as a nav row, and this rail's height is the scarce resource.
- **Per-section dividers were dropped** in the expanded rail (kept in the collapsed rail, which has no
  labels). Nav content height went **744px → 551px**, so the whole rail now fits at 1080p; before this,
  ~271px — Customers, Settings and Developers — was below the fold.
- **The real space hog is the footer:** the referral card + Help & Support own ~240px of the rail, more
  than five nav rows. Worth a look before adding any further row.
- **Reveal signals** ride the existing `GET /api/dashboard/action-counts` (3 extra `EXISTS()` in the same
  read-only, Redis-cached statement; cache key v2→v3) and are consumed through `hooks/useNavReveal.ts`:
  one request per account per 60s no matter how many consumers, session-sticky so a revealed row can
  never vanish mid-visit, and fails closed. `receipts` reuses `PROCESSED_STATUS_SQL` so it can never
  disagree with the dashboard's own volume figures (parity re-verified: 180 = 180).


---

## 0. Verdict in one paragraph

The last audit fixed **who owns an object** (one `Account` tenant) and **how many objects exist**
(collapse to Link + Product). This audit is the layer above it: **where a human expects to find
each job.** The nav is no longer wrong because it has too many objects — it is wrong because it is
organised around **our tables** (transactions, invoices, wallets, customers, keys) instead of the
**four things a merchant actually does**: *get set up · get paid · check what came in · tune the
business.* Nine of the eleven sidebar rows are nouns from the schema. Every high-value job in the
product — collect a tip, sell a product, send a bill, see today's money, get an API key — is
currently split across **two or more** surfaces, and each split costs a support ticket. The
storefront merge that shipped this session is the template for the rest: *one job, one home, tabs
inside it.*

**The single biggest human-experience finding:** DynoPay is **non-custodial** — money lands in the
merchant's own wallet, there is no balance, no payout, no ledger to manage. That makes half of a
normal gateway's IA unnecessary, and it means the product's centre of gravity is not "money
management" but **"get a link/page in front of a buyer."** The nav does not say that. It leads
with Dashboard → Transactions → Invoices (three read-only surfaces) and buries the two surfaces
that actually create revenue.

---

## 1. Method — how "which tab owns this" was decided

The product type matters, so the rules are derived from it, not from taste.

**Product type:** self-serve, non-custodial crypto payment gateway **plus** a creator storefront.
Two personas now exist in the schema (`tbl_company.account_type`):

| Persona | Who | Primary job | Frequency |
|---|---|---|---|
| **Individual creator** | one person, no company | share ONE page, take tips + sell a few digital items | opens the app weekly, on a phone |
| **Business** | registered company, may have staff | take payments from customers, reconcile, integrate the API | opens the app daily, on a desktop |

**Four ownership tests** applied to every feature:

1. **Job test** — a tab may own exactly one sentence of intent. If describing a tab needs "and",
   it is two tabs.
2. **Frequency test** — daily surfaces belong in the primary nav; set-once surfaces belong in
   Settings, no matter how important they *feel*. (Wallets is set once; Transactions is daily.)
3. **Config-vs-result test** — *configuring* a thing and *seeing its results* are different jobs.
   Config lives with the object; results live in the one reporting surface. Splitting results
   across surfaces is what makes a product feel scattered.
4. **Consequence test** — irreversible/financial actions (wallet address, API key, tax rate) must
   be one level deeper than everyday actions and must never be adjacent to a destructive twin.

---

## 2. Current inventory (what each surface holds today)

**Sidebar — 11 rows, 3 groups**

```
OVERVIEW   Dashboard · Transactions · Invoices & Tax
PAYMENTS   Payment Links [+] · Storefront (NEW) · Wallets · Customers (SOON)
ACCOUNT    API · Referrals · Notifications · Settings
footer     referral-code card · Help & Support
```

**Tabbed surfaces that exist inside those rows**

| Surface | Tabs / sections today | Owns |
|---|---|---|
| `/storefront` *(new this session)* | Page · Products · Share | handle, cover, bio, socials, theme, publish, tip box, product catalog, public link + QR |
| `/settings` | Profile · Company · Payments · Tax · Webhooks · API keys · Notifications | identity, tenant details, currencies, VAT defaults, dev config, prefs |
| `/invoices` | Invoices · Tax Report | settled receipts (PDF), VAT summary |
| `/transactions` | one list + filters (wallet, source, date, search) | every inbound payment, `source ∈ {payment_link, api, contribution, tip, product, direct}` |
| `/wallet` | one list grouped by chain + account-scope chip | receiving addresses (set once) |
| `/dashboard` | KPI strip · Quick-actions dock · Activation · Recent transactions · Fee tier | today's numbers + shortcuts |
| Not in nav | `/create-pay-link`, `/fees`, `/developer-keys`, `/customers`, `/documentation`, `/help-support`, `/pay-links/products/*`, `/order/[publicRef]` | — |

**Live-data reality check** (from the previous audit, unchanged): 46 payment links · 10 buy buttons
· 6 invoices (all settled receipts) · 5 donation tiers · 2 product orders · 1 product · **0
subscriptions**. ~85% of everything a merchant has ever created is a payment link.

---

## 3. Findings — misplacements, ranked by human cost

### F1 · Product orders live in three places, none of them "Products" 🔴
`/transactions?source=product` (the real ledger), `/pay-links/products/[id]/orders` (a per-product
list), and a "View product orders →" link inside the Storefront → Products tab that *leaves* the
storefront. A merchant asking "did my ebook sell?" has three answers and no default.
**Fix:** results belong to the ledger, not to the catalog. Keep ONE orders view (`Transactions`,
pre-filtered), delete the per-product page, and show `sold_count` + revenue **inline on the product
row** so the answer is where the question is asked. The cross-link stays but is labelled as a
filter of Transactions, not a separate destination.

### F2 · Tips: configured in Storefront, reported in Transactions, counted in Storefront 🔴
The tip box is configured in Storefront → Page; tip payments appear in Transactions
(`source=tip`); *but* total visits / supporters / tip totals are rendered as stat tiles in
Storefront → Page, and a "Momentum" widget also renders them **on the public page**. Three homes
for one number.
**Fix (config-vs-result):** Storefront = configuration + preview only, with **one** result strip
that is explicitly a deep link ("12 supporters · view in Transactions →"). All numbers come from
the reporting surface; nothing else computes its own.

### F3 · Creating things has no single home 🔴
"New link" is a full page (`/create-pay-link`) reachable from a `+` on the nav row, a dashboard
tile, and several empty states. "New product" only exists inside Storefront → Products. **An
invoice cannot be created at all** (see F4). The mental model "where do I make a thing?" has no
answer.
**Fix:** one **`+ New`** control in the app header (not per-nav-row): *Payment link · Product ·
(later) Bill*. Every empty state routes into the same control so the path is learned once.

### F4 · "Invoices & Tax" is a receipts archive wearing a receivables name 🟠
`tbl_invoice` rows are only ever created *after* a transaction settles; the UI hard-codes a PAID
pill. There is no way to send a bill and wait. Meanwhile the *tax rate* is configured in Settings →
Tax while the *tax report* is a tab of Invoices — the config and its output are two clicks and one
mental model apart.
**Fix:** rename to **Receipts & Tax** and move it out of the top group into a "Money" group next to
Transactions; add a Settings → Tax cross-link at the top of the Tax Report tab ("VAT is set to 0% —
change in Settings"). Real invoicing (a Link + business details + due date + reminders) is a
*new capability*, not a rename — keep it out of the nav until it exists.

### F5 · Developer tooling is split across a nav row and two Settings sections 🟠
Sidebar "API" → `/developer-keys` (keys + embed snippets) **and** Settings → API keys **and**
Settings → Webhooks. Same job, three doors; the Settings copies are the ones with the search
ranking and the ones users find first.
**Fix:** one **Developers** destination with tabs *Keys · Webhooks · Events log · Docs*. Remove
both Settings sections (leave a one-line pointer). This also removes the duplicated publishable-key
fetch that produced the 400 fixed this session.

### F6 · Fees: three homes, none in the nav 🟠
`/fees` (full page, unlisted), the dashboard Fee-tier card, and Settings → Payments copy.
**Fix:** fees are a *plan* concern → **Settings → Plan & fees** as the single home; the dashboard
card is a promo that links there. Delete the orphan route or redirect it (same pattern as
`/company` → `/settings`).

### F7 · "Customers (SOON)" is shipped, populated and hidden 🟠
`tbl_customer` holds live rows, the page is fully built, invoices imply customers — yet the nav
says *soon*, which reads as "this product can't do it."
**Fix:** either ship the row (recommended: it is the only surface that answers "who paid me
twice?") or remove the label. Never ship a nav item marked *soon* — it is an advert for a missing
feature at the exact moment someone is looking for it.

### F8 · Notifications occupies a primary nav row for an inbox that already has a bell 🟡
Plus Settings → Notifications for preferences (correct placement).
**Fix:** the inbox belongs to the header bell + a "see all" panel; free the nav row. Preferences
stay in Settings.

### F9 · Referrals is in the primary nav *and* permanently pinned in the sidebar footer 🟡
A once-a-quarter job holding two slots, one of them permanent screen real estate.
**Fix:** keep the footer card (it carries the code and the share buttons — that is the whole
feature) and move the page into **Settings → Referrals**.

### F10 · Wallets fails the frequency test but must stay visible 🟡
Non-custodial means a merchant adds an address once and never returns; by the frequency test it is
Settings. But it is also the **trust anchor** ("where does my money go?") and it is where a second
account starts empty.
**Fix:** keep it in the nav, rename to **Payout wallets** (says what it is), and keep the two
things shipped this session: the account-scope chip and the "use the same wallets as ‹other
account›" nudge. Never place "remove wallet" next to "add wallet" (consequence test).

### F11 · Settings mixes four different mental models in one flat list 🟠
Profile (me) · Company (the tenant) · Payments (money behaviour) · Tax (money behaviour) ·
Webhooks (dev) · API keys (dev) · Notifications (prefs) — a flat 7-item list where the first two
items are the ones the account-completeness nudge points at.
**Fix:** four groups: **Account** (profile, security, sessions) · **Business** (details, tax, team
later) · **Payments** (currencies, checkout, plan & fees) · *(Developers moves out per F5)*.
Also: "Company" is the wrong word for an individual creator — call it **Account details** and let
the copy switch on `account_type`.

### F12 · The dashboard dock duplicates the nav — deliberately, and that is fine 🟢
The quick-actions dock overlaps 4 nav rows. This is the one duplication worth keeping: it is
personalised (it now suggests the 4 pages a merchant actually opens) and it is the phone-first
path. **Rule to hold:** the dock may only contain *destinations that already exist in the nav* —
never a unique action that lives nowhere else.

### F13 · One IA is shown to two very different personas 🔴
An individual creator sees Invoices & Tax, Customers, API and Webhooks before they have ever taken
a payment; a business sees "Storefront" (a creator word) for its checkout page. `account_type`
exists now, so this is solvable without asking anyone anything.
**Fix — persona-ordered nav (same rows, different order + reveal):**

| | Individual creator | Business |
|---|---|---|
| First group | **Storefront** · Payment links · Dashboard | **Dashboard** · Payment links · Transactions |
| Money | Transactions · Payout wallets | Transactions · Receipts & Tax · Payout wallets |
| Hidden until relevant | Receipts & Tax, Customers, Developers | Storefront stays, labelled **Checkout page** |

Reveal-on-relevance beats a settings toggle: show *Receipts & Tax* the first time a transaction
settles, *Developers* the first time an API key exists (or on demand from Settings).

### F14 · FIXED during this audit — the route loader stuck when leaving Storefront ✅
**Symptom:** leaving `/storefront` fired `routeChangeStart` + `beforeHistoryChange` but never
`routeChangeComplete`; the URL changed while the old page stayed on screen under the global
`RouteTransitionLoader`.
**Root cause (not what it looked like):** the page was in a **render loop** — 69 renders on a single
load. The header-action effect depended on MUI's `theme` object *and* called `setPageAction`, which
is state in `_app`; every commit produced a new dependency, which re-ran the effect, which set state
again. A page that never stops re-rendering never lets React commit the next route, so Next's
`set()` promise never resolves and the loader never hides.
**Fix:** the header action is now its own component (`<OpenPageAction/>`) that reads the theme
itself, so the effect depends only on `[setPageAction, handle]`. Renders on load: **69 → 5**;
`routeChangeComplete` fires; loader clears; the code-split tabs were kept.
**Rule earned:** *any effect that writes layout state (`setPageName`, `setPageAction`,
`setPageWarning`) may only depend on primitives.* Non-primitive deps (theme, objects, arrays,
JSX) turn a layout setter into a render loop, and the symptom shows up as a "navigation bug"
somewhere else entirely.

---

## 4. Recommended target architecture

### 4.1 Nav — 4 groups, 8 rows (from 3 groups / 11 rows)

```
HOME        Dashboard
GET PAID    Payment links        (presets inside: one-off · cart · goal · tip jar)
            Storefront           (Page · Products · Share)     ← creator-first order flips this to #1
MONEY       Transactions         (tabs: All · Orders · Tips)
            Receipts & Tax       (revealed after first settlement)
            Payout wallets
GROW        Customers            (revealed when a customer exists)
ACCOUNT     Settings             (Account · Business · Payments · Referrals)
            Developers           (Keys · Webhooks · Events · Docs — revealed on demand)
header      + New   ·   🔔 inbox   ·   account switcher (Individual/Business chip)
footer      referral code card · Help & Support
```

### 4.2 Tab-ownership map (the answer to the question asked)

| Surface | Tab | **Belongs here** | **Must NOT be here** |
|---|---|---|---|
| **Storefront** | Page | handle, cover, bio, socials, theme, publish toggle, tip box config, live preview | any analytics beyond one deep-link strip |
| | Products | catalog rows with inline price/status/**sold count**, new/edit | order lists, fulfilment |
| | Share | public URL, copy, QR, social targets, embed snippet for the page | link-level embed snippets (those belong to a link) |
| **Payment links** | list | links + presets + status, expiry rescue | products, invoices |
| **Transactions** | All / Orders / Tips | every inbound payment, filters, export, per-payment drill-in | anything that *configures* a source |
| **Receipts & Tax** | Receipts / Tax report | settled receipt PDFs, VAT summary + "rate set in Settings" pointer | tax *rate* editing |
| **Payout wallets** | list | addresses per chain, account scope, reuse-from-other-account | withdrawals (non-custodial: there are none) |
| **Settings** | Account | profile, password, sessions, language | company/tax |
| | Business | legal name, **country**, address, VAT id, (team) | API keys |
| | Payments | display currency, checkout defaults, **Plan & fees** | webhooks |
| | Referrals | code, payouts, terms | — |
| **Developers** | Keys / Webhooks / Events / Docs | publishable + secret keys, endpoints, delivery log, docs | anything a non-technical merchant needs |
| **Dashboard** | — | today's numbers, activation checklist, personalised dock, recent payments | unique actions that exist nowhere else |

### 4.3 Seven laws to stop the sprawl returning

1. **One job per tab.** If the description needs "and", split it.
2. **Config with the object, results in the ledger.** No surface computes its own numbers.
3. **One create control.** `+ New` in the header; empty states route into it.
4. **Set-once lives in Settings** — except the one trust anchor (wallets).
5. **Nothing ships marked *soon*.** Reveal on relevance instead.
6. **A route that is not in the nav either gets a home or gets redirected** (the `/company` →
   `/settings` and `/creator` → `/storefront` pattern).
7. **Layout-state effects take primitive deps only.** `setPageName` / `setPageAction` /
   `setPageWarning` write state in `_app`; an effect that writes them must never depend on `theme`,
   objects or JSX — the page render-loops and route transitions stop committing (F14).

---

## 5. Sequenced plan

| # | Change | Effort | Risk | Why now |
|---|---|---|---|---|
| **P0** | ~~Fix F14 (stuck route loader leaving Storefront)~~ **DONE** — render loop from a themed `setPageAction` effect | S | low | shipped-feature regression |
| **P0** | F1 orders: inline `sold_count`/revenue on product rows, single Orders view | S | low | removes the worst three-way split |
| **P0** | F13 persona-ordered nav + reveal-on-relevance (`account_type` already exists) | M | low | biggest perceived-fit win, no migration |
| **P1** | F5 Developers destination; drop Settings → API keys / Webhooks | M | med | kills a duplicate that already caused a 400 |
| **P1** | F4 rename to Receipts & Tax + Settings→Tax pointer | S | low | honest naming, no code risk |
| **P1** | F3 single `+ New` in the header | M | low | teaches one path |
| **P1** | F11 Settings → 4 groups, "Company" → "Account details" | S | low | matches individual/business reality |
| **P2** | F7 ship Customers (or drop the *soon* label) | M | low | only "who paid me twice" surface |
| **P2** | F8 inbox → bell, F9 Referrals → Settings, F6 Fees → Plan & fees | S | low | frees 3 nav rows |
| **P2** | F2 Storefront analytics → one deep-link strip | S | low | config/result separation |

**Explicitly NOT recommended:** a mega "Get paid" wizard (links already do this), a custody/balance
UI (non-custodial by design), subscriptions in the nav (0 rows), or a settings toggle for the
persona nav (reveal-on-relevance instead).

> The four items agreed as **next actions** (N1–N4 in §6) are the P0/P1 rows above: persona nav,
> product sales inline, one `+ New`, Developers home.

---

## 6. Next actions — build specs (agreed backlog)

The four items below are the agreed next actions from this audit, written as specs so they can be
picked up without re-deriving the reasoning. Each one closes a numbered finding.

### N1 · Persona nav — order + reveal-on-relevance · closes **F13** · effort M · risk low
**Goal:** a creator sees the tools that make them money first; a business sees reconciliation
first; neither sees a row that is meaningless to them yet.

- Source of truth: `tbl_company.account_type` via `hooks/useAccountProfile.ts` (already shipped).
- Order — individual: `Storefront · Payment links · Dashboard · Transactions · Payout wallets`;
  business: `Dashboard · Payment links · Transactions · Receipts & Tax · Storefront · Payout wallets`.
- Reveal rules (never a settings toggle): **Receipts & Tax** appears after the first settled
  transaction; **Customers** when a customer row exists; **Developers** when an API key exists or
  from a Settings link; **Storefront** is always visible (it is the product for one persona and the
  checkout page for the other).
- Label switch: `Storefront` (individual) ↔ `Checkout page` (business) — pending Q1 in §8.
- Files: `Components/Layout/NewSidebar/index.tsx`, `Components/Layout/MobileNavigationBar/index.tsx`,
  `hooks/useAccountProfile.ts` (add the derived `reveal` flags in one place so both navs agree).
- Acceptance: a brand-new individual account sees 5 rows and no Tax/Customers/Developers; a business
  with transactions sees the business order; a row never disappears once revealed in a session;
  active-route highlighting still resolves for nested paths.

### N2 · Product sales on the product row · closes **F1** · effort S · risk low
**Goal:** answer "did it sell?" where the question is asked, and stop maintaining three order views.

- Storefront → Products rows show **units sold** and **revenue** inline (the list API already
  returns `sold_count`; add summed revenue or derive from orders).
- Row click-through goes to `Transactions` pre-filtered to that product (`?source=product&product_id=`),
  labelled as a filter — not to a separate per-product page.
- Retire `/pay-links/products/[productId]/orders` (redirect to the filtered Transactions view, same
  pattern as `/creator`), and drop the "View product orders →" cross-link from the tab header.
- Files: `Components/Page/Storefront/ProductsTab.tsx`, `Components/Page/Transactions/index.tsx`
  (accept + display a product filter), `pages/pay-links/products/[productId]/orders.tsx` → redirect.
- Acceptance: a product with 2 orders shows `2 sold · $10.00`; clicking it lands on Transactions
  filtered to that product; no other route lists product orders.

### N3 · One `+ New` control · closes **F3** · effort M · risk low
**Goal:** one learned path for "make a thing to get paid".

- A single `+ New` in the app header (next to the account switcher): **Payment link · Product**
  (+ *Bill* later, only once real invoicing exists). Keyboard: `n`.
- The `+` currently attached to the Payment-links nav row is removed; every empty-state CTA
  (`EmptyDataModel`, activation checklist, quick-action tiles) routes into the same control so the
  path is taught by repetition.
- Files: `Components/Layout/NewHeader/index.tsx` (+ mobile equivalent),
  `Components/Layout/NewSidebar/index.tsx` (drop `plus: true`),
  `Components/UI/EmptyDataModel/index.tsx`, `Components/Page/Dashboard/v2026/*`.
- Acceptance: exactly one create affordance in the chrome; both entries land on the existing
  `/create-pay-link` and product-new flows; no empty state invents its own create path.

### N4 · Developers home · closes **F5** (and removes the duplicate that caused the keys 400) · effort M · risk med
**Goal:** one door for keys, webhooks, events and docs.

- `/developer-keys` becomes **Developers** with tabs *Keys · Webhooks · Events log · Docs*, built on
  the same tab shell pattern as `/storefront` (local tab state synced from `?tab=`, code-split tabs,
  **primitive-only deps in any layout-state effect** — see law 7).
- Settings → *API keys* and Settings → *Webhooks* are removed and replaced by a one-line pointer;
  their components move rather than fork.
- Every publishable-key read goes through `hooks/usePublishableKeys.ts` with a company id (the fix
  that stopped the 400) — no second fetch path.
- Files: `pages/developer-keys.tsx`, `Components/Page/API/*`, `pages/settings/index.tsx` (drop 2
  sections), `Components/Page/Settings/*`.
- Acceptance: keys/webhooks reachable from exactly one nav destination; zero `/api/publishable-keys`
  requests without `company_id`; Settings shows 4 groups (see F11) with no developer sections.

**Batch definition of done:** `tsc --noEmit` clean · testing agent green on the touched flows ·
no route left un-homed (law 6) · `memory/CHANGELOG.md` updated · this document's findings marked.

**Explicitly out of scope for this batch:** real invoicing (a new capability, not an IA change),
custody/balance UI (non-custodial by design), subscriptions, and any nav toggle in Settings.

---

## 7. Potential improvements (beyond the IA fixes)

Ranked by impact on the merchant's own revenue, since that is what keeps them in the product.

| # | Idea | Why it pays | Effort |
|---|---|---|---|
| **I1** | **Expired-link rescue** — the 10 expired-unpaid links are the only genuine receivable signal in the product; one tap to *extend* or *resend* | recovers money that was already asked for; needs no new object (`expires_at`, reminder fields and Brevo email exist) | S |
| **I2** | **Share nudge after the first product goes live** — a one-time prompt on Storefront → Share ("your page has something to sell — post it") with the pre-filled social targets already built | the storefront only earns once it is shared; publishing is the moment of highest intent | S |
| **I3** | **Plain-English read on the dashboard KPI** — "Busier than yesterday: 3 more payments, smaller baskets" next to the delta | turns a number merchants glance at into something they act on; complements the low-base delta rule already shipped | S |
| **I4** | **Offline QR pack** — print-ready PNG/PDF of the page QR (stall, flyer, video overlay) from Storefront → Share | crypto tips and small sales are often in-person; the QR already exists, only the export is missing | S |
| **I5** | **"Sell this again"** on a settled transaction — regenerate the same link/product with one tap | repeat revenue from proven demand; reuses link duplication | M |
| **I6** | **Storefront SEO + OG polish** — per-product OG images, structured data, sitemap entries for live `{handle}` pages | the public page is the only surface a stranger can find; it currently ships noindex-adjacent defaults and no product OG | M |
| **I7** | **Buyer-facing receipt page** — a shareable receipt URL after payment (the merchant-side receipts already exist) | buyer confidence in crypto checkout is the #1 conversion blocker; also reduces "did it go through?" support | M |

**Non-obvious one worth arguing about:** the individual-creator persona would likely pay for
*audience* features (subscriber list, "notify me" on a sold-out product, thank-you automation) long
before they need anything on the business side of the roadmap — and the storefront merge is what
makes those buildable in one place.

---

## 8. Open questions for the founder

1. **Naming for the business persona:** "Storefront" is creator language. Show
   **Checkout page** to `account_type='business'` and keep *Storefront* for individuals — or pick
   one neutral word for both ("Your page")?
2. **Real invoicing:** is "send a bill and wait to be paid" on the roadmap? It changes whether
   *Receipts & Tax* stays a leaf or becomes a group.
3. **Customers:** ship it now (it is built) or delete the row until it earns its place?
4. **Reveal-on-relevance:** comfortable with the nav growing as a merchant progresses, or do you
   want every row visible from day one even when empty?
