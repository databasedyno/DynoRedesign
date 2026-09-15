# Dashboard redesign + in-app page audit — proposal (approved; Waves 1–3 built, E2E test sweep deferred by user)

## 1. What the research says a merchant dashboard should be

Sources studied: Stripe Dashboard (home + mobile widgets), Shopify Home (2024–26 redesigns), Square, BTCPay Server, NOWPayments and Coinbase Commerce merchant portals, plus SaaS-dashboard audits (Eleken, Brightscout, Mantlr, SetProduct).

Consistent findings:

1. **The home screen answers one question: "Is my business OK today, and what do I need to do?"** Stripe calls this "decision speed"; Shopify's latest home is a task feed ("Things to do") above metrics. Nothing on the home should exist only because it is possible to show it.
2. **Navigation and content never overlap.** Sidebars / bottom bars are for getting places; the home is for *state* and *action*. Shortcut tiles that repeat the sidebar are the most common "overbuilt dashboard" failure.
3. **3–7 primary KPIs, each with context.** Every number carries a comparison (vs. previous period) or a target. A naked number is noise.
4. **Money in motion beats lifetime totals.** Stripe leads with *gross → net → what's arriving next* (available / pending / next payout). For a non-custodial crypto gateway the equivalent is *confirming now → settled today → forwarded to your wallets*.
5. **Exceptions first.** Failed, underpaid, overpaid, expired, disputed — each with a one-tap action. BTCPay and NOWPayments both centre the merchant UI on the payment *state machine*, not on charts.
6. **Crypto-specific KPIs merchants actually act on:** checkout completion rate (invoices created → paid), median confirmation time, underpaid/expired rate, share of volume per asset/network, webhook/API failure count, payout-wallet health (address configured per accepted coin, recent forward failures).
7. **Marketing lives elsewhere.** Referral codes, tier upsells and "grow" promos are demoted to a single collapsible slot or moved to their own pages; they never sit in the first two screens.
8. **Empty state is onboarding, not a blank chart.** New merchants get the next best action; established merchants never see onboarding chrome.

## 2. Diagnosis of the current Dynopay dashboard

Current stack of blocks (desktop, top → bottom): greeting · balance strip with range control · **4 quick-action cards (Payment links, Create invoice, Open wallet, Transactions)** · gateway health strip · auto-convert banner · volume chart + right rail (**fee-tier progress, "Grow with Dynopay" upsell, referral code card**) · 3-KPI strip · recent activity + assets breakdown. Plus up to six ad-hoc banners (KYC grace, underpaid, password nudge, claim handle, first-payment celebration, first-run redirect).

| # | Problem | Why it matters |
|---|---|---|
| A | The 4 quick-action cards duplicate the sidebar, the phone bottom bar (Home · Sell · + · Money · More) **and** the header "+ New" control | Pure navigation masquerading as content; wastes the second screen row. Breaks the app's own "one create control" rule. |
| B | Three promotional cards (fee tier, grow, referral) occupy the entire right rail — the most valuable real estate after the headline | The rail sells instead of informing; the volume chart is squeezed. |
| C | Only one exception is surfaced (underpaid count). Pending confirmations, expired checkouts, overpaid, webhook failures, accepted coins without a payout wallet, ageing API keys are invisible | The dashboard cannot tell the merchant what to do. |
| D | Headline metric is period volume only; no "settling now / landed today / forwarded to which wallet" | For a non-custodial gateway "where is my money right now" is the primary question. |
| E | Gateway health strip is system status — green almost every day, not merchant-specific | Should be one line that only expands when something is degraded. |
| F | Auto-convert banner is a settings toggle living on the home | Settings belong in Settings/Payouts; home shows status only. |
| G | Six banner types compete for the top of page and stack ad hoc | No single "attention" model. |
| H | Assets card and KPI strip repeat the chart's window in another shape | Redundant. |

Net: roughly 40 % of the page is navigation or promotion, exceptions are almost absent, and money-in-motion is missing.

## 3. Proposed new dashboard ("Command centre")

Principle: **State → Attention → Money → Trend → Activity.** Nothing that is a link elsewhere gets its own tile. Same content model on desktop and phone; only layout changes.

### Zone 1 — Header line
- Greeting + brand switcher stay.
- **Live pulse chip**: "3 payments confirming · last paid 4 min ago" (or "Quiet — last payment Tue 14:02"). Replaces the gateway health strip; turns amber/red only when Dynopay itself is degraded, then expands to show which service.
- Range control (Today · 7d · 30d · 90d · 12m · custom) stays global for zones 3–4.

### Zone 2 — Needs attention (task feed; renders only when non-empty)
One ordered list, max 5 visible, "show all" beyond that. Each row = icon · plain sentence · one action button. Priority order:
1. Security / compliance blockers: KYC due, 2FA not set up (soft/hard wall), wallet changes frozen, password missing.
2. Money exceptions: underpaid awaiting a decision, overpaid (refund/credit), expired checkouts today with amount, payments pending > 60 min.
3. Configuration gaps: accepted coin with no payout wallet, webhook endpoint failing (N failures / 24 h), API key older than 12 months, product out of stock, payment link expiring.
4. Growth nudges (at most one, always last): claim your page handle, referral reward earned, fee-free credit remaining.

This zone **replaces** every banner in problem G and the quick-action cards in problem A.

### Zone 3 — Money now (three tiles in one row)
- **Settled** in range: gross volume, net after fees, delta vs. previous period, payment count.
- **In flight**: amount detected on-chain and awaiting confirmations right now + count; tap → Transactions filtered to "confirming".
- **Forwarded to your wallets**: amount forwarded in range, split by asset (mini bars), last forward time; tap → Payouts. If auto-convert is on, one line inside the tile: "Converted to USDT: $x". The toggle itself leaves the home.

### Zone 4 — Trend (one wide card)
- Volume chart with the range control; toggle **Volume / Payments / Avg ticket**; asset mix available as a legend toggle inside the same card (replaces the separate assets card).
- Beneath the chart, one **Checkout health** line: completion rate (created → paid), median confirmation time, underpaid + expired rate — each with delta. Replaces the generic 3-KPI strip.

### Zone 5 — Activity (two columns desktop, stacked on phone)
- **Recent payments** (8 rows): amount, asset, status chip using the real state machine (confirming / paid / underpaid / overpaid / expired / refunded), customer, time, tx link. Row click opens the existing transaction drawer.
- **Top links & products** in range: name, paid count, volume — the revenue-attribution view that exists nowhere today.

### Zone 6 — Plan & growth (one collapsible row at the very bottom; collapsed by default after the merchant has a month of history)
- One line: "Starter tier · 1.5 % · $x of $10k to Growth (1 %)". Fee-tier card, grow slot and referral card are **removed** from the home. Referral lives only in Refer & earn; growth offers become feed rows when genuinely relevant.

### New-merchant state (until first payment)
- Zone 2 becomes the Getting-started checklist (the existing 5 steps with real progress) and is the only block above the fold.
- Zones 3–5 render as a faded preview with the caption "fills in after your first payment" (kept from today).

### Phone
- Same zones in the same order; Money tiles become a horizontally swipeable row; Trend defaults to 7d; Activity shows 5 rows with "See all".
- Bottom bar (Home · Sell · + · Money · More) unchanged — that is the navigation, so the home carries none.

### Visual direction
- "Quiet money": large tabular numerals, one accent colour reserved for actions, colour otherwise reserved for payment states (green paid · amber confirming/underpaid · red expired/failed · grey refunded), depth through layering rather than borders everywhere, dark mode first-class. A full visual spec is produced by a design pass before building; the content model above is what needs approval.

### Data that does not exist yet (will be added)
Checkout completion rate, median confirmation time, expired/overpaid counts in range, in-flight amount, forwarded-by-asset in range, webhook failures / 24 h, "accepted coin without wallet" check, top links/products by volume. Everything else already exists.

## 4. Page-by-page audit — what each page should answer, and what changes

Rubric applied to every page: (1) the page answers its one question within the first screen; (2) one obvious primary action; (3) lists filter by the states a merchant actually searches for; (4) empty / loading / error states teach the next step; (5) nothing duplicates navigation; (6) the phone layout is the same content, not a subset.

| Page | Should answer | Change proposed |
|---|---|---|
| **Payment links** (incl. Products tab) | "Which links are live, which are earning, which need fixing?" | Status filters (live / expired / disabled / earning in 30d); per-row 30-day paid count + volume; inline copy / QR / share; "expiring soon" badge. In-page create buttons removed except in the empty state — the header "+ New" is the only create control. |
| **Your page** (storefront / creator page) | "Is my public page live, what does it look like, is it converting?" | Live preview thumbnail, publish state, views → checkouts → paid funnel for the range, one primary action (Edit page). Handle claiming moves here entirely (no dashboard banner). |
| **Transactions** | "Find any payment fast and understand its state." | Default view last 30 days; state filters mirroring the state machine; a saved "Needs action" filter; rows show expected vs. received, network, confirmations, customer; drawer keeps tx hash + explorer link + resolve actions (mark settled / refund / request top-up). Export stays. |
| **Payouts** | "What was forwarded to my wallets, and is anything stuck?" | Stuck / failed forwards pinned at the top with a retry or contact action; per-wallet timeline (amount, tx, fee, time); monthly total by asset. Auto-convert status + toggle lives here. |
| **Receipts & Tax** | "What did I collect, and what do I owe / report?" | Period totals in the header (collected, tax, fees), one-click export per period; collected-tax view and threshold monitor kept; empty state explains receipts are records of money already received (no receivables). |
| **Payout wallets** | "Do I have a wallet for every coin I accept, and are they safe?" | Accepted-coin coverage with missing wallets first; last forward per wallet; address-sanity result; security status (freeze, trusted devices link). Wallet edits keep the step-up gate. |
| **Wallet security** | "Who can change my wallets, and from where?" | Merged into Settings → Security (it currently duplicates the Profile & Security sessions/devices content). One security page, linked from Payout wallets. |
| **Customers** | "Who pays me, how often, who is at risk?" | Lifetime value, last paid, payment count, preferred asset per customer; repeat vs. one-time filter; export; empty state explains customers appear automatically from checkouts. |
| **Refer & earn** | "How much have I earned and how do I share?" | Owns the referral code, share tools and earnings history (moved off the dashboard); reward status per referral. |
| **Settings** | "Change how my business and payments behave." | Left section index: Profile & Security · Business · Payments · Team · Notifications · Plan & fees · Language. Fee-tier progress and premium / fee-free info move to **Plan & fees**. Security gathers 2FA, trusted devices, sessions, login history, wallet freeze. |
| **Developers** | "Are my integrations healthy?" | Webhook delivery health (success rate, last failure, retry), API-key age with rotation reminder, quick links to docs and live console; key management kept. |
| **Notifications** | "What happened that I have not seen?" | Grouped by type (payments · security · system · growth), mark-all-read, each item links to its object. Dashboard feed rows also appear here so nothing is lost after dismissal. |
| **Help & Support** | "Get help without leaving." | Kept; add a "was this about a payment?" prompt that pre-fills the transaction reference. |
| **Get started (wizard)** | "Finish setup in five short steps." | Unchanged (just shipped). The dashboard checklist resumes it. |
| **KYC** | "What do I need to verify, by when?" | Kept; the deadline becomes a Zone 2 feed row instead of its own banner. |

Cross-cutting usability fixes:
- One create control everywhere (header "+ New" / phone centre "+"); pages keep only empty-state CTAs.
- One status vocabulary and chip palette across dashboard, transactions, payouts, receipts and notifications.
- Every list page: default 30-day range, sticky filter bar, teaching empty state, phone layout as cards with the same fields.
- Banners retired as a pattern: anything urgent is a dashboard feed row plus a notification.

## 5. Delivery in three waves (each shippable on its own)

1. **Dashboard command centre** — Zones 1–6, the new data aggregates, the new-merchant state; removal of quick-action cards, promo rail, gateway strip and ad-hoc banners. — DONE, tested.
2. **Money pages** — Transactions, Payouts, Payout wallets (+ Wallet-security merge), Receipts & Tax. — DONE (coded), E2E sweep deferred.
3. **Sell / Grow / Settings pages** — Payment links, Your page, Customers, Refer & earn, Settings (Plan & fees, Security), Developers, Notifications. — DONE (coded), E2E sweep deferred.

## 6. Assumptions (push back if any is wrong)

- The dashboard is **not** user-customisable (no drag/drop, no add/remove widgets) in this version; a fixed, opinionated layout ships first.
- Fee-tier progress, referral code and growth promos leave the dashboard entirely (one collapsed line remains at the bottom).
- The gateway health strip is replaced by the live pulse chip that only expands when something is degraded.
- The auto-convert toggle moves to Payouts; its status stays visible inside the "Forwarded" tile.
- Existing brand language (indigo accent, Inter + mono numerals, dark mode) is kept; the redesign changes composition and content, not the brand.
- Team members (non-owners) see the same dashboard minus onboarding and security rows they cannot act on.
- Navigation structure (sidebar groups, phone bottom bar, header "+ New") is not changed.
- Waves run in order 1 → 2 → 3, each reviewed before the next starts.
