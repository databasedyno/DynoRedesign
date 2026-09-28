# Dynopay + SafeDeal — End-to-End Experience Audit & Fix Program

A full walk-through of every screen and flow on Dynopay (merchant dashboard, hosted checkout, public site, admin) and SafeDeal (deal lifecycle, wallet, Telegram entry), recording every UX, UI, feature and engagement gap — then closing them, from broken flows down to polish and retention hooks.
The outcome is a product where a new merchant reaches their first payment without help, a buyer never wonders "did it go through?", and SafeDeal parties finish a deal and come back for the next one.

## Who it's for

- **New merchants**: signed up, no brand / link / payment yet — must reach first payment received.
- **Active merchants**: manage links, invoices, storefront, wallet, withdrawals, API keys, webhooks, team, settings.
- **Buyers**: land on a pay link / invoice / storefront, choose a coin, pay, and need certainty about status and receipt.
- **SafeDeal buyers and sellers**: arrive from Telegram or a shared deal link, create/accept a deal, fund, deliver, release or dispute, cash out.
- **Operators (admin)**: watch payments, settlements, withdrawals, disputes and system health; intervene when something is stuck.

## Core features and experience

**1. The audit itself (delivered as a living report)**
Every route is walked as each persona above, on desktop and on a phone, in light and dark mode, with the primary language plus a spot-check of the other five. Each finding is logged per screen with severity:
- **P0** — flow is broken, blocked, or misleading about money (wrong amount/status, dead end, error with no way out).
- **P1** — confusing or high-friction: unclear next step, missing empty/loading/error state, inconsistent labels, mobile overflow, copy that doesn't say what happens next.
- **P2** — polish: spacing, hierarchy, iconography, micro-interactions, dark-mode contrast, wording tone.
- **Engagement** — a missing nudge, reminder, celebration, or return hook at a moment where the user would otherwise stall.
The report also records what is already good, so nothing gets "fixed" that isn't a gap.

**2. Merchant activation (signup → first link → first payment)**
- A persistent onboarding checklist on the dashboard until complete: verify email → create brand → set payout wallet → create first payment link → share it → first payment received. Each step deep-links to the exact screen and shows what "done" looks like.
- Empty states everywhere (links, invoices, transactions, customers, wallet) that explain the object in one sentence and offer the single most useful action, not a blank table.
- Sandbox made obvious: "Try a test payment in 30 seconds" from the dashboard, with the simulator result appearing in the same place a real payment would.
- First-payment moment: a celebratory confirmation with the receipt, what happens next (settlement timing, fee shown), and the next best action (create another link / set up webhooks / invite team).
- Share mechanics on every link/invoice/storefront: copy, QR, Telegram/WhatsApp/X share, embed snippet — one click, no hunting.

**3. Buyer completion (hosted checkout, invoices, storefront, receipts)**
- A single, always-visible status timeline: Waiting → Detected → Confirming (n/12) → Settled, with plain-language explanation of each stage and realistic timing per coin.
- "Payment detected" only shows after the payment is verified on-chain (currently it can flip on an unverified notification).
- Expiry handled gracefully: countdown, then "Get a fresh address" rather than a dead page; late payments explained ("we received it after the window — the merchant has been notified").
- Under/over-payment messaging in exact amounts with the one thing the buyer must do (send the remaining X, or nothing).
- Coin/network mistakes prevented: network confirmation before showing the address, wrong-network warning kept prominent, memo/tag copy for XRP.
- Receipt: email capture on the success screen, downloadable/printable receipt, link back to the merchant's storefront.
- Mobile-first checkout: address/QR/amount above the fold at 390px, tap-to-copy feedback, wallet-pay button prominent where supported.

**4. SafeDeal deal completion and repeat deals**
- Entry from Telegram and from a shared deal link lands on a page that says who the deal is with, the amount, the fee, and exactly what to do next — no sign-in wall before the user understands the deal.
- Deal creation reduced to the essentials (what, how much, who pays the fee, deadline) with a live summary and a share step that defaults to Telegram.
- Funding step: fee transparency up front, per-coin network fee, clear "send exactly" instructions, same status timeline as Dynopay checkout, and a confirmation the other party can see.
- Delivery / release / dispute: each state has one obvious action per party, the other party's view is described ("Seller sees: awaiting your release"), deadlines and auto-actions spelled out.
- Wallet and cashout: balance breakdown (available / in escrow / pending cashout), cashout fee shown before confirming, transaction hash and explorer link after, Telegram alert on confirmation.
- Repeat: "Start another deal with this person", recent counterparties, deal templates from past deals; a deal history that reads like a receipt list, not a table.
- Trust signals on every SafeDeal page: how escrow protects each side, dispute policy in one paragraph, what SafeDeal never does.

**5. Retention and return visits (both products)**
- Notification center consistency: every event that emails also appears in-app with a deep link; unread state and mark-all-read behave the same on every screen.
- Reminders at stall points: unpaid payment link/invoice after 24h (merchant + optional buyer reminder), unfunded deal after 24h, deal awaiting release after delivery, pending cashout confirmations.
- Telegram alerts for SafeDeal at every lifecycle stage (created, funded, delivered, released, disputed, cashout confirmed) — today only cashout confirmation exists.
- Merchant weekly summary email: volume, fees, top links, pending items, one suggested action.

**6. Admin console**
- Operational visibility for what was hard to see today: payments looping in reconciliation, webhooks failing delivery, settlements without bookkeeping, SafeDeal withdrawals awaiting approval — each with age, last error and a one-click drill-down.
- Consistent tables, filters and detail drawers across admin sections; mobile-usable for the on-call operator.

**7. Consistency and polish sweep**
- One vocabulary per concept across UI, emails and docs (e.g., "cashout" not "withdraw" on SafeDeal; "settled" not "completed"/"successful" interchangeably).
- Dark mode contrast, focus states, keyboard reachability, button hierarchy (one primary per screen), consistent spacing and card padding, locale-correct number/date formatting where still hard-coded.
- Restyle screens where the UI itself is the gap (within the existing gold/graphite Dynopay brand and SafeDeal's light gold/black brand).

## User flow

**New merchant**: lands on dynopay.com → understands pricing and what happens after signup in one screen → signs up → dashboard shows the checklist → creates brand and payout wallet → creates a payment link → shares it (or fires a sandbox test) → sees the first payment arrive with a celebration + receipt + next step → gets a weekly summary from then on.

**Buyer**: opens link → sees merchant, amount, and "pay with" → picks coin (network confirmed) → sees address/QR/amount above the fold → pays → timeline moves Waiting → Detected → Confirming → Settled → optional email receipt → returns to merchant.

**SafeDeal**: enters via Telegram or deal link → sees deal summary and their role → signs in (Telegram or email code) → creates/accepts → funds with fee shown → both parties see the same timeline → delivery → release (or dispute with a clear path) → seller sees balance and cashes out with fee shown → Telegram alert on confirmation → "start another deal with this person".

**Operator**: opens admin → dashboard shows anything stuck or failing at the top with age and last error → drills into the item → resolves or escalates → sees the queue clear.

## UI/UX feel

Direct and reassuring. Every screen answers three questions without scrolling: where am I, what is the state of my money, what do I do next. Money states use consistent colour semantics (green settled, amber waiting/confirming, red action needed). Copy is short, specific and in the user's language ("Send exactly 0.00185 ETH on Ethereum" not "Awaiting payment"). Motion is used only to confirm actions and progress (copy feedback, timeline steps, first-payment celebration). Dynopay stays on its gold/graphite brand with dark mode; SafeDeal stays light, gold and black, English-only. Mobile is treated as the primary SafeDeal device and a first-class Dynopay checkout device.

## Implementation phases

**Phase 1 — Audit + fix what blocks or confuses (built now)**
- Full walk-through of all five surfaces as every persona, desktop + mobile, light + dark; the report with P0/P1/P2/engagement findings and screenshots.
- Fix every P0 and P1 found: broken or dead-end flows, misleading money states, missing empty/loading/error states, mobile breakage, inconsistent labels.
- Activation core: dashboard onboarding checklist, empty-state CTAs, sandbox promotion, first-payment celebration, one-click share on links/invoices.
- Checkout core: verified status timeline (detected only after on-chain check), graceful expiry, exact under/over-payment messaging, mobile above-the-fold layout, receipt email capture.
- SafeDeal core: deal-link landing that explains before asking to sign in, simplified creation with Telegram-first share, fee transparency on funding and cashout, one obvious action per state per party, balance breakdown, "start another deal with this person".
- Admin: stuck-payment / failing-webhook / pending-withdrawal visibility with age and last error.
- Vocabulary and colour-semantics consistency pass across UI and emails.

**Phase 2 — Engagement and return hooks**
- Reminders at stall points (unpaid link/invoice, unfunded deal, awaiting release, pending cashout) by email and, for SafeDeal, Telegram.
- Telegram alerts for every SafeDeal lifecycle stage.
- Notification center parity with email; deep links everywhere.
- Merchant weekly summary email; recent counterparties and deal templates on SafeDeal.
- Trust/explainer content on SafeDeal pages; storefront "back to merchant" loops.

**Phase 3 — Depth and polish**
- Screen restyles where the UI is the remaining gap; accessibility pass (contrast, focus, keyboard, screen-reader labels).
- Full six-language copy and formatting audit on Dynopay surfaces.
- Admin console table/filter/drawer unification and mobile usability.
- Public site: pricing/what-happens-next clarity, docs entry points from the dashboard, comparison and FAQ refinements.

## Assumptions

- Fixes ship continuously in small batches per surface through the existing canary → swap → auto-rollback pipeline; the audit report is written first and updated as items close. No batching for prior review — you can stop any batch.
- Severity order is fixed: P0 → P1 → activation/checkout/SafeDeal completion → admin visibility → P2 polish. Engagement features that need new background jobs (reminders, digests) are Phase 2, not now.
- No new third-party services: email uses the existing sender, Telegram uses the existing SafeDeal bot, no analytics vendor is added; engagement is measured with existing data (payments, deals, logins).
- Fee policy, settlement math, security controls and the recent on-chain verification are not changed by this program; only how they are explained and displayed.
- SafeDeal remains English-only and light-themed; Dynopay keeps six languages and dark mode.
- "Detected" on checkout will wait for the on-chain check (adds roughly a second of latency) in exchange for never showing a false "payment detected".
- Restyles stay within the current brands; no logo, palette or typography change.
- The audit is performed against the live sites and the preview build; real money is not moved during the audit (sandbox and read-only checks only).
- Findings that turn out to be intentional product decisions (e.g., initials-only avatars, one-factor step-up) are recorded, not changed, unless you say otherwise.
- Admin console improvements are limited to visibility and navigation; no new operator actions that move funds are added in this program.
