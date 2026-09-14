# DynoPay — Feature & Information-Architecture Audit
**Date:** 2026-08-12 · **Requested by:** founder ("our application is scattered and not well arranged")

**Method.** Every number below was measured, not estimated:
- Tenancy/ownership map read from the **live production schema** (`information_schema`, read-only transaction).
- Adoption counts from the **live production tables** (read-only).
- Route inventory, bundle weights and public-surface findings from a **real `next build`** of the current `latest2` HEAD.
- Endpoint counts from `backend/routes/*.ts`.

Nothing was written, migrated or changed in the database to produce this audit.

---

## 0. Verdict

The app isn't badly built — it's **well built three times over**. The scatter you're feeling is not cosmetic; it comes from five structural forks, ranked here by how much they cost you:

| # | Problem | Hard evidence | Cost |
|---|---|---|---|
| 1 | **Three competing ideas of "who owns this"** (user / company / merchant_user) | 66 tables: 7 company-scoped, 15 user-scoped, 3 `merchant_user_id`, **15 carry BOTH**, 24 carry neither | Individuals can't use half the product; every new feature must pick a side |
| 2 | **Seven ways to get paid** | payment_link 46 rows (4 sub-types), buy_button 10, invoice 6, donation_tier 5, product_order 2, product 1, **subscription 0** | Merchant confusion, 7× maintenance, thin adoption everywhere |
| 3 | **Navigation doesn't describe the product** | 79 routes in the production bundle vs **13 sidebar entries**; "Customers" is labelled *soon* although it has live data | Features exist but are unfindable |
| 4 | **The account surface is triplicated and enormous** | `/settings` **3.15 MB** and `/company` **2.93 MB** first-load JS vs a **458 kB** baseline — the only two multi-MB routes in the app | Slowest pages in the product are the least differentiated |
| 5 | **410 endpoints with no resource discipline** | 410 route registrations / 26 routers; `userRouter` alone has **72**; `/api/test/*` (18 endpoints) mounted unconditionally | Nobody can hold the API in their head |
| 6 | **🚨 `dbInstance` booted the whole server from a per-query hook** | `utils/dbInstance.ts` ran `require('../server')` inside Sequelize's `beforeQuery` — so the first query from ANY script started a second server | Duplicate cron/sweep/webhook workers = double-processed payments. **Fixed this session** |

**The single highest-leverage fix is #1.** Do it first; #2 and #3 get dramatically easier afterwards, because you'll finally have one noun to hang features off.

---

## 1. Root cause #1 — three competing ideas of "who owns this"

You were right on both counts, and it's worse than the products table.

### 1.1 What the schema actually says

```
[COMPANY-scoped only]  (7)  api_usage_log, customer, customer_transaction, invoice,
                            merchant_pool_transaction, payment_journal, webhook_delivery_log
[USER-scoped only]    (15)  merchant_wallet, referral_reward, user_self_transaction,
                            user_preference, user_media, onboarding_event, security_log, ...
[merchant_user_id]     (3)  product, product_asset, product_order      <-- a THIRD convention
[BOTH user_id AND company_id, no documented winner] (15)
                            payment_link, user_transaction, user_wallet, api, buy_button,
                            kyc, notification, notification_preferences, publishable_key,
                            plan, stablecoin_conversion, user_addresses, user_temp_address,
                            usdt_pool_transaction, company
[NO tenancy key at all] (24) product_variant, payment_link_item, product_order_item,
                            donation_tier, donation_update, subscription, tax_rate, fees, ...
```

### 1.2 The number that proves your point

```
users .......................... 14
companies ....................... 4
users WITHOUT any company ...... 11   (79%)
users with MULTIPLE companies .... 1
```

> **⚠️ HONESTY CORRECTION (added after inspecting the actual rows).**
> That 79% is arithmetically true but **practically misleading, and I'm correcting my own
> headline**. Listing the 11 account-less users by email shows the population is dominated by
> test data:
>
> | user_id | email | real? |
> |---|---|---|
> | 2, 8, 11, 12 | `qa.onboard@`, `qa.empty@`, `qa.exist@`, `qa.unverif@` `dynopaytest.com` | QA |
> | 4, 5, 6, 7 | `test_…@`, `paytest_…@` `dynopay-test.com` | QA |
> | 9 | `testdyno@dyno.pt` | internal test |
> | 10 | **email IS NULL** | broken signup record |
> | 14 | `andwela.peiter@gmail.com` | **the only real human** |
>
> So the honest statement is: **the architectural fork is 100% real and will bite every
> individual signup, but today it is hurting 1 real user, not 11.** Fix it because it is
> structural, not because 11 merchants are complaining.
>
> Independent live proof that the fork is real, found while code-splitting `/settings`:
> `hooks/usePublishableKeys.ts` deliberately calls `GET /api/publishable-keys` with **no
> `company_id`** ("fetch all keys", per its own doc comment) — and the backend requires
> `company_id`, so it returns **400** on every load of the API Keys section. A feature written to
> work "without a company" against a backend that demands one. That is Root Cause #1 in miniature,
> and it is a live bug today.
>
> Practical consequence for the backfill: **do not blindly create personal accounts for all 11** —
> that would add ~10 junk companies to the production database. Backfill real users, and consider
> purging the QA accounts instead.


A company is **not** created at signup — `tbl_company` rows are only created by an explicit
"create company" action (`companyController.ts:261`). And on the frontend,
`CompanyDataContext` bails out early when the list is empty (`if (!companyList.length) return;`),
so `selectedCompanyId` stays `null` forever for those 11 accounts.

**Therefore, for 79% of your users, every company-scoped feature is unreachable:**
invoices, customers, payment journal, webhook logs, API usage. They can hold a wallet and take
a payment, but they cannot be invoiced-from or have customers. That is exactly the
"a creator can be an individual without being a company" gap you described.

### 1.3 It is already leaking into new code

While building the Quick-Action badge counts I had to write this to count a merchant's products:

```sql
AND p.merchant_user_id = (SELECT user_id FROM tbl_company WHERE company_id = :companyId)
```

Every future feature pays that same tax, and the bridge silently breaks for the 1 user who owns
**multiple** companies (which company's products? the query can't say).

### 1.4 Recommendation — one tenant, called `Account`

> **One noun owns everything: `Account`. Every user gets one at signup. "Company" becomes a
> *business profile* attached to an Account — not a second ownership root.**

```
Account (tenant)                     <- everything scopes to this
├─ type: individual | business       <- creator vs company, a flag not a schema fork
├─ business profile (optional)       <- legal name, VAT, address, KYC  (today's tbl_company fields)
├─ members (future: teams)
├─ wallets, transactions, payouts
├─ payment links, products, invoices, customers
└─ api keys, webhooks, preferences
```

- An **individual creator** = Account with `type=individual` and no business profile. Everything works.
- A **business** = Account with a business profile filled in. Invoices get legal details.
- One user owning several businesses = several Accounts, with an account switcher (you already
  have the switcher UI for companies — it keeps working).

**Migration that is safe on a live payments DB** (never rename a column in place):

| Phase | Action | Breaking? |
|---|---|---|
| **P0** | Auto-provision a personal Account (= `tbl_company` row, `type=individual`) at signup, **and backfill the 11 existing account-less users**. Nothing else changes. | No — purely additive. Immediately unblocks invoices/customers for 79% of users |
| **P1** | Add `company_id` to `product`, `product_asset`, `product_order`; backfill from `merchant_user_id`; dual-write; then switch reads. Keep the old column. | No |
| **P2** | For the 15 "BOTH" tables, publish one written rule — *`company_id` is authoritative, `user_id` is the actor/audit trail* — and make every query obey it. Add the missing key to the 24 unscoped tables (or document the parent join). | No |
| **P3** | Rename to `account_id` in the **API/TypeScript layer only** (DB columns keep their names behind a mapping). Retire `merchant_user_id` reads. | API-versioned |

P0 alone is a few hours of work and is the single biggest UX unlock in this audit.

---

## 2. Root cause #2 — seven ways to get paid

### 2.1 Measured adoption (live production)

| Surface | Rows | Distinct owners | Verdict |
|---|---|---|---|
| `payment_link` (4 sub-types: standard 28, contribution 14, donation 2, cart 2) | 46 | 2 | **This is the product** |
| `buy_button` | 10 | — | Channel, not a product |
| `invoice` | 6 | 1 | Document, not a product |
| `donation_tier` | 5 | — | Config of a link |
| `product_order` | 2 | — | Real, tiny |
| `product` | 1 | — | Real, tiny |
| `subscription` | **0** | — | Built, never used |

Seven surfaces, and **~85% of all real objects are payment links**. Each surface still carries
its own pages, controllers, tables, nav entry and mental model.

### 2.2 Recommendation — 2 primitives, 1 document, 1 channel

> **Collapse to two nouns a merchant must learn: a Link and a Product.**

| Keep as a primitive | Demote to a *preset* of it | Rationale |
|---|---|---|
| **Payment Link** | one-off · cart · contribution/goal · donation · tip jar | Already ONE table with a `link_type` column — this is largely a **UI/labelling** job, not a migration |
| **Product** (catalog + storefront) | digital · physical · service | Genuinely different (inventory, variants, fulfilment) |
| — | **Invoice** = a Link + business details + PDF, shown in an "Invoices" view | Stop maintaining a parallel silo; an invoice *is* a request for payment |
| — | **Buy button / embed** = a distribution channel for an existing Link | It's a snippet, not an object |
| — | **Subscription** = park it behind a flag until one real merchant asks | 0 rows; don't pay to maintain a hypothesis |

Merchant-facing result: **"Get paid" → New link / New product**, with presets inside. Instead of
guessing between pay link, buy button, invoice, donation, tip jar, product and subscription.

### 2.3 The biggest surprise: **you don't actually have invoicing**

Found while building the Quick-Action badges — worth its own heading because it changes the roadmap.

`tbl_invoice` rows are created **only by `autoGenerateInvoice()`**, and only once a transaction has
already reached `done`/`successful` (`invoiceController.ts` ~line 490). The UI agrees: it hardcodes
a settled pill for every row, with this comment in
`Components/Page/Invoices/InvoicePreviewDrawer.tsx:29` —

> *"Header shows a StatusPill (settled tone; **every invoice in Dynopay is** [paid])"*

So all 6 live invoices sit at `status='generated'` while the UI correctly renders them **PAID**.

**Conclusion: "Invoices & Tax" is a *receipts & tax-document* feature, not accounts-receivable.**
There is today **no way for a merchant to send a bill and wait for it to be paid** — the thing most
people mean by "invoicing". The closest real receivable signal in the product is
*payment links that expired before anyone paid them* (10 of them right now for hostbay).

Consequences:
- An "unpaid invoices" badge is impossible to build truthfully — I removed it after seeing this,
  rather than ship a number that is confidently wrong.
- The nav label "Invoices & Tax" oversells it. Honest naming: **"Receipts & Tax"**.
- This makes the §2.2 recommendation more valuable, not less: *real* invoicing = a payment link
  with business details + due date + reminders (you already have `expires_at`,
  `final_reminder_sent_at` and Brevo email). That is a genuinely new, sellable capability and it
  reuses machinery you already own.
- Also note the tile label mismatch: the `invoice` quick-action reads **"Create invoice"** but
  navigates to `/invoices` (a read-only list) — and nothing there creates one.

---

## 3. Root cause #3 — navigation doesn't describe the product

### 3.1 Today

```
Main      : Dashboard · Transactions · Invoices & Tax
Payments  : Pay links(+) · Products(feature-flagged) · Creator page · Wallets · Customers(soon)
Account   : API · Referrals · Notifications · Settings
```

**79 routes ship in the production bundle; 13 appear in the sidebar.** Reachable but unlisted:
`/fees`, `/create-pay-link`, `/company`, `/profile`, `/documentation`, `/help-support`,
`/system-status`, `/order/[publicRef]`, `/pay-links/products/*`.

Contradictions found in the code:
- **"Customers" is tagged `soon: true`** in the sidebar, yet `tbl_customer` holds live rows and
  `pages/customers.tsx` + `Components/Page/Customers` are fully built.
- **Products is hidden behind `NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG`** while it's the only surface
  with inventory, orders and a storefront.
- **Two live sidebars**: the merchant app uses `NewSidebar`; `Layout/Sidebar` is still used by
  `Containers/Payment`, `Containers/Admin`, `Header`, `AdminHeader`.
- `Layout/Menus.tsx` (232 lines, the original nav) is **imported by nothing** — dead.
- Two dashboards: `Dashboard/v2026` is live; `Dashboard/coinbase` survives as the shared style
  layer (`styled.tsx`, `CB_TOKENS`) plus 13 loose legacy components at `Dashboard/*.tsx`.

### 3.2 Recommendation — 5 groups that match the merchant's job

```
HOME          Dashboard
GET PAID      Links · Products · Invoices                    [ + New ]
MONEY         Wallets · Transactions · Conversions & payouts
CUSTOMERS     Customers · Orders
STOREFRONT    Creator page (public shop, live preview)
DEVELOPERS    API keys · Webhooks · Docs
ACCOUNT       Settings (profile · business & KYC · tax · notifications · team) · Referrals · Fees & tier
```

Rules to hold the line: **one "New" button** (never a per-object create page in the nav);
nothing ships in the nav marked *soon*; if a page isn't in the nav it either gets a home or gets
deleted.

---

## 4. Root cause #4 — the account surface is triplicated *and* the heaviest code you ship

Measured from the production build — these are the **only** two multi-megabyte routes:

```
/settings        34.6 kB page  →  3.15 MB first-load JS   (538 lines; already has a "company" section)
/company         14.2 kB page  →  2.93 MB first-load JS   (416 lines)
/profile                          18-line shell
--------------------------------------------------------------
every other route                 ~458–622 kB   (shared baseline: 458 kB, of which _app = 372 kB)
```

So the two pages that **duplicate each other** are 6–7× heavier than anything else in the app.

**Recommendation:** one `/settings` with tabs (Profile · Business & KYC · Tax · Payments ·
Webhooks · Notifications · Danger zone); redirect `/company` and `/profile` into it;
`next/dynamic` each tab so the tab you open is the only one you download. Expect the 3.15 MB to
fall to a few hundred kB — the biggest single perf win available, and it removes a whole
"where do I change this?" class of confusion.

---

## 5. Root cause #5 — 410 endpoints, no resource discipline

```
410 route registrations across 26 router files
userRouter ........ 72   <- god-router (auth + profile + prefs + quick-actions + activity + ...)
paymentRouter ..... 38
walletRouter ...... 35
productRouter ..... 25
adminRouter ....... 23
companyRouter ..... 22
apiRouter ......... 22
diagnosticsRouter . 24
testRouter ........ 18   <- mounted UNCONDITIONALLY: router.use("/test", testRouter)
```

**Recommendation:** split `userRouter` by resource (`/auth`, `/me`, `/preferences`, `/security`);
gate `/api/test` and `/api/diagnostics` behind `NODE_ENV !== "production"` or an admin guard;
prefer **one aggregated read per screen** over many chatty calls — the new
`GET /api/dashboard/action-counts` (one SELECT of scalar counts, Redis-cached 60 s) is the
pattern to copy.

---

## 5.5 🚨 Root cause #6 — the database layer booted the entire server (FIXED)

This was found by accident and is the most dangerous single thing in the audit. It is already fixed.

`utils/dbInstance.ts` needed to know whether the process was shutting down, and got that flag like this — inside Sequelize's `beforeQuery` hook, i.e. **on every single query**:

```ts
hooks: {
  beforeQuery: () => {
    // Lazy import to avoid circular deps — server.ts exports isShuttingDown
    const { isShuttingDown } = require('../server');   // ← boots server.ts
    ...
  }
}
```

`server.ts` calls `startServer()` at module scope. So **the first query issued by any process that had imported a model would load and boot a second copy of the entire application**:

```
server.ts → models → utils/dbInstance → require('../server') → server.ts
```

Observed live at 2026-08-12 21:36 UTC while verifying account provisioning: a plain maintenance
script that imported a model tried to `app.listen(3300)`, hit `EADDRINUSE`, threw an uncaught
exception, and the ErrorMonitor sent **three alert emails to the admin address**. Stack trace
confirmed `at startServer (server.ts:1462)` inside the script's own process.

**Why this was worse than noise.** On a box where `ENABLE_BACKGROUND_JOBS=true`, that second boot
would also start:
- a second cron scheduler,
- a second BullMQ webhook worker,
- a second crypto sweep loop.

i.e. **double-processing of real payments and fund movements**, triggered by nothing more than
running a migration or maintenance script. It also means you could not write a script, a
migration or a unit test that touched a model without booting the server — which is a large part
of why this codebase is hard to work in safely.

**Fix applied.** The dependency is inverted. A new `utils/shutdownState.ts` owns the flag and
imports nothing; `dbInstance` reads it with a plain static import; `server.ts` sets it in
`gracefulShutdown()`. The cycle is gone and the per-query `require()` is gone.

Verified: the same script that previously fired three alert emails now runs to completion with
**zero** `EADDRINUSE`, **zero** server boots and **zero** alerts, while all provisioning checks
pass and query behaviour is unchanged (`database: connected`, no `Query blocked` events).

**Lesson worth generalising:** `server.ts` should contain only bootstrap, and boot code must never
be importable by library code. Any remaining `require()` inside a hot path deserves the same
scrutiny.



## 6. Public-surface leaks — **FIXED this session**

The production build confirmed these were **live, publicly routable pages on dynopay.com**:

```
/QA                          26 kB      /pay/state-demo             10.3 kB
/pay/demo                   9.67 kB     /pay/success-demo           4.17 kB
/pay/donation-demo          20.8 kB     /pay/payment-states-demo    12.4 kB
+ /api/test/*  (18 endpoints, mounted with no environment guard)
```

A payments company shipping `/QA` and five fake-payment-state demos to its production domain is an
avoidable trust problem (and an SEO one).

**Fix applied.** A new `middleware.ts` blocks all six paths with a genuine **404** whenever
`NODE_ENV === "production"` (escape hatches: `BLOCK_DEV_PAGES=true` to force it on anywhere,
`=false` to reopen). Middleware — not `getServerSideProps` — because none of the six pages export a
data-fetching function, so they are served as static HTML and a page-level guard would never run.
The `matcher` is an exact allow-list, so no other route is affected. Verified: all six return 404
locally *and* through the public ingress, while `/`, `/auth/login`, `/dashboard` and `/pay-links`
still return 200.

**On `/api/test/*` — correcting an earlier assumption in this audit.** Every one of the 19 routes
*does* require a JWT. But it is only `authMiddleware`, i.e. **any logged-in merchant, not an
admin**, and the router exposes `POST /test/fix-customer-id-column` (schema DDL),
`POST /test/manual-transfer` (moves funds), `GET|DELETE /test/redis/:key` and
`POST /test/send-*-email`. That is privilege escalation on a payments platform. It is now mounted
only when `ENABLE_TEST_ENDPOINTS=true` or outside production, and returns 404 otherwise (verified:
`/api/test/thresholds` went from 401 to 404 while `/api/dashboard/` still answers 401).

By contrast `diagnosticsRouter` was checked and is **correctly admin-guarded** (19 routes, 20
`adminAuthMiddleware` references), so it was deliberately left alone.

---

## 7. Sequenced plan

| Phase | Work | Why now | Risk |
|---|---|---|---|
| **P0** (days) | ✅ **1. DONE** — `account_type` + `tbl_account_member` added, owner rows seeded, personal Account auto-provisioned at signup via a single `userModel.afterCreate` hook, and the backfill applied (1 real user; the other 10 are QA rows, deliberately skipped)  ✅ **2. DONE** — `/QA`, `/pay/*-demo` and `/api/test/*` blocked in production  ✅ **3. DONE** — `/settings` code-split 3.15 MB → **649 kB**, `/company` 2.93 MB → **454 kB** (now a redirect), `/profile` zero-JS redirect  ⬜ 4. Un-hide **Customers**, decide the Products flag | Unblocks individual creators, removes the two heaviest routes in the app, closes the public leaks | Low — additive |
| **P1** (1–2 wks) | Account-scope the product tables (add `company_id`, backfill, dual-write, switch reads); publish the "`company_id` is authoritative" rule and fix the 15 ambiguous tables | Stops the bug class you spotted | Low/med — dual-write first |
| **P2** (2–4 wks) | Re-group the nav into the 5 groups; collapse pay surfaces into Link + Product presets; Invoice becomes a document view; Buy button becomes an embed tab; park Subscriptions | The visible "it feels organised now" win | Med — mostly UI |
| **P3** (opportunistic) | `account_id` in the API layer; retire `Layout/Sidebar`, `Menus.tsx`, legacy dashboard components; split `userRouter` | Long-term velocity | Low |

## 8. What NOT to do

- ❌ Don't rename live DB columns in place, and don't run a big-bang tenancy migration on a
  production payments database. Additive + dual-write + backfill, always.
- ❌ Don't build a third dashboard. Two already exist; `v2026` is the one.
- ❌ Don't add an eighth way to get paid. Every new idea should be a **preset** of Link or Product.
- ❌ Don't delete the `coinbase` folder yet — `v2026` imports its style tokens (`SurfaceCard`, `CB_TOKENS`).

## 9. Decisions taken (founder, 2026-08-12)

1. **Who is DynoPay for?** → **Both** individual creators and businesses.
   ⇒ **Account becomes the root; Company is optional.** This locks in §1.4 and makes P0-1
   (auto-provision + backfill the 11 account-less users) mandatory, not optional.
2. **Teams / multi-user per account?** → **Yes, plan for it now.**
   ⇒ P0 introduces `Account` with a `members` join table from day one (owner role only at first),
   so we never have to retrofit ownership a second time.
3. **Subscriptions** → see A.1 below (recommendation: **park**).
4. **Creator page vs Shop vs Tips** → see A.2 below (recommendation: **one Storefront**).

---

## Appendix A — answers to the two questions you asked back

### A.1 "What is subscription for?"

**What it is in your codebase today** (not what the word usually means):

| Aspect | Finding |
|---|---|
| Tables | `tbl_plan` (merchant-defined plans) + `tbl_subscription` (subscribers to a plan) |
| API | **3 endpoints** — `GET /api/subscriptions`, `GET /api/subscriptions/:id`, `POST /api/subscriptions` |
| Scoping | `getSubscriptions` looks up `planModel.where({ user_id })` → user-scoped, and `tbl_subscription` carries **no tenancy key at all** |
| Billing rail | imports `flw` — **Flutterwave, i.e. fiat cards**, not crypto |
| Merchant UI | **none.** The only frontend reference to "subscription" anywhere is `pages/QA.tsx` |
| Live data | **0 plans, 0 subscriptions** |

So it's a half-built **merchant-facing recurring-billing** feature (your merchant defines a plan,
their customer subscribes, card-billed via Flutterwave) that no merchant can reach because it has
no UI.

**Recommendation: park it behind a flag — don't delete, don't invest yet.** Three reasons:

1. **It contradicts the product's value proposition.** DynoPay sells crypto acceptance; this
   feature's only billing rail is Flutterwave card payments.
2. **Recurring crypto is genuinely hard and this design doesn't solve it.** There is no
   "card on file" for a wallet — you cannot pull funds from a customer's wallet on a schedule.
   Real crypto recurring needs either a stablecoin **allowance/pull** model (ERC-20 `approve`,
   which only works per-chain and needs the customer to stay topped up) or a **scheduled
   request** model.
3. **The honest MVP is something you can almost ship today.** "Recurring invoices/reminders":
   a payment link on a schedule + an email nudge. You already own every piece —
   `expires_at`, `final_reminder_sent_at`, Brevo, and the (currently receipt-only) invoice
   document. Combined with §2.3, *this* is the feature to build when a real merchant asks for
   "subscriptions", and it would be the first genuine **receivables** capability in the product.

Concretely: leave the 3 endpoints in place behind `NEXT_PUBLIC_ENABLE_SUBSCRIPTIONS=false`, and
put "Recurring payment requests" on the roadmap instead.

### A.2 "Creator page, Shop and Tips — what do you recommend?"

**First, the good news: your *public* side is already right. Don't touch it.**

```
/{handle}              creator profile  (bio, links, SupportWidget = tips)
/{handle}/shop         product grid
/{handle}/p/{slug}     product detail
/{handle}/cart         cart
/{handle}/checkout     checkout
```

One handle, one root, everything nests underneath. That is exactly how Gumroad/Ko-fi/Stripe
storefronts are shaped, and it's good for SEO and for the merchant's "one link in bio".

**The mess is entirely on the merchant side** — the same storefront is managed from four doors:

| Door | What it edits | In the sidebar? |
|---|---|---|
| `/creator` | the page itself (handle, bio, links, theme) | yes — "Creator page" |
| `/pay-links/products` | the catalog that fills `/{handle}/shop` | only if `NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG=true` |
| `/pay-links` | tip jars & donation goals live here too (`is_tip_jar`, `link_type=donation\|contribution`) | yes — "Payment Links" |
| `/create-pay-link` | creation form | no (orphan route) |

So "tips" have no home of their own — they're payment-link rows that surface as a widget on the
creator page. That's actually the **right data model**; it's just invisible in the IA.

**Recommendation — one "Storefront" section with three tabs, and a hard split from "Links":**

```
STOREFRONT                       ← everything that lives at /{handle}, always-on
  ├─ Page        (today's /creator: handle, bio, theme, links)   [Preview ↗ /{handle}]
  ├─ Products    (catalog → /{handle}/shop)
  └─ Support     (tip jar + donation/contribution goals — a filtered payment-link view)

LINKS                            ← one-off requests you send to a specific person
  └─ Payment links (+ New)
```

The merchant mental model becomes one sentence:

> **Storefront** = my always-on public page. **Links** = a one-time request I send to someone.

Specifics:
- **Do NOT give tips a separate page or URL.** A tip jar is a *block* on the creator page — you
  already have `SupportWidget` plus `NEXT_PUBLIC_INLINE_TIP_CHECKOUT=true` for inline checkout.
  One handle, one URL to promote. Splitting it would fragment the very link they market.
- **Merge "Creator page" and "Products" under Storefront**, with a persistent **Preview ↗** to
  `/{handle}`. Today a merchant cannot tell that Products and Creator page produce *the same*
  public site.
- **Un-flag Products** (or drop the catalog) — a hidden storefront tab is worse than either choice.
- Keep the tip/donation *rows* in `tbl_payment_link`. No migration needed: the Support tab is a
  filtered view, so this is nav + labelling work, not data work.

