# Donation / External Page & In‑App Customer Features — Standards Review & Proposed Work

## Why this document exists
You asked two things:
1. How does our **donation / external (payer‑facing) page** compare to industry standards and competitors, and do we have everything such a page normally needs?
2. The same question for our **in‑app Customer features** (the Customers area inside the dashboard).

This plan answers both with a gap review, then proposes what to add. Nothing is built yet — it needs your sign‑off on scope.

---

## Part A — Donation & external payment page

### A1. What the market expects (from current competitor/standard research)

**Donation pages** (The Giving Block, Coinbase Commerce, NOWPayments, BitPay, CoinGate) typically include:
- A clear "Donate crypto" call‑to‑action and on‑page giving (no hop to a third‑party site).
- The **list of accepted coins shown up front**.
- Donor name/email captured **so a receipt can be sent**.
- A **fund‑handling / liquidation statement** — do we convert the gift to cash immediately or hold it as crypto.
- **Tax / compliance copy** — e.g. "crypto is treated as property; keep your own records for larger gifts."
- A **thank‑you / confirmation** step with the transaction details and next steps.
- **Trust and security cues**, and a short **FAQ** (minimums, confirmation time, refunds, is my gift anonymous, who to contact).
- Increasingly, **recurring / monthly** giving and a **"cover the fees"** option.

**Hosted crypto checkout** (the actual pay step) standard elements: merchant branding + order reference, amount shown in **crypto and fiat**, a **payment address + QR**, a **coin/network selector**, an **expiry timer**, and clear **status states** (waiting / detected / confirmed / underpaid / overpaid / expired).

### A2. What we already have (strong — at or above competitors)

Our donation/crowdfunding page already includes: preset + custom amounts, donor name/email/message, an "anonymous" option, a goal progress bar with milestone ticks, countdown + last‑24h urgency banner, category and beneficiary blocks, a Markdown "story", a photo gallery, Kickstarter‑style **reward tiers**, an organizer **updates feed**, a **supporter wall** (medals for top donors, organizer replies), a share tray, a sticky mobile donate bar, and goal‑reached / ended states.

Our crypto checkout already includes: 12 assets with network choice (USDT and RLUSD multi‑network), **per‑coin minimums** that grey out coins an order can't clear, address + QR + copy, memo/destination‑tag handling, amount in **crypto and fiat**, an **expiry countdown**, full **underpaid / overpaid / expired / failed** handling with "pay the remainder", per‑chain polling, "open in wallet" deep links, and redirect back to the merchant with the transaction reference.

**Conclusion:** on giving mechanics and checkout mechanics we already match or exceed the named competitors. The gaps are almost entirely around **compliance, receipts, and a few "normal for donation pages" conveniences** — not the core flow.

### A3. Gaps vs standard (donation/external)

| # | Gap | Impact |
|---|-----|--------|
| A‑G1 | **No donation receipt** emailed or downloadable to the donor (amount, fiat value at time of gift, date, tx hash, campaign, merchant). | Donors/nonprofits expect a receipt for their records; this is a common ask. |
| A‑G2 | **No fund‑handling / liquidation statement** on the page (does the gift settle to the organizer as crypto, or convert to cash). | A standard trust/compliance element; its absence looks less legitimate. |
| A‑G3 | **No tax / "not financial advice" / refund note** on the giving page. | Standard compliance copy for crypto giving. |
| A‑G4 | **Accepted coins are not shown on the campaign page** — the donor only sees them at the pay step. | Competitors show "We accept BTC, ETH, stablecoins…" up front to reduce hesitation. |
| A‑G5 | **No FAQ / donor‑support block** (minimums, confirmation time, refunds, anonymity, contact). | Standard; reduces support load and abandonment. |
| A‑G6 | **Thin post‑payment confirmation for donations** — the success screen confirms payment but offers no receipt download and no "share that you gave". | Standard thank‑you pages do more here. |
| A‑G7 | **One‑time only — no recurring / monthly giving.** | The Giving Block / NOWPayments offer it; it is the single biggest missing feature vs donation‑specialist competitors. Large effort. |
| A‑G8 | **No "cover the processing fee" toggle** on the donate form (donor opts to add the fee so the organizer nets the full amount). | Very common on donation pages; small effort. |

### A4. Proposed scope for Part A (grouped so you can pick)

- **Tier 1 — Compliance & trust polish (recommended now, low effort):** A‑G2, A‑G3, A‑G4, A‑G5. Adds an accepted‑coins strip, a short fund‑handling + tax/refund note, and a small FAQ/contact block to the campaign page. Copy‑and‑layout only; no new payment logic.
- **Tier 2 — Donor receipt (recommended, medium effort):** A‑G1 + A‑G6. Emailed donation receipt and a downloadable/printable receipt page, plus a receipt link on the thank‑you screen.
- **Tier 3 — Conversion conveniences (optional, small–medium):** A‑G8 "cover the fees" toggle.
- **Tier 4 — Recurring giving (optional, large):** A‑G7 monthly donations. Own project; likely a follow‑up.

---

## Part B — In‑app Customer features (dashboard)

### B1. What the market expects
Payment‑platform customer areas (Stripe, Square, PayPal) normally offer: a customer list with lifetime value / payment counts / segments, a customer detail view with full payment & order history and contact details, **private notes and tags**, the ability to **add or edit a customer** manually, per‑customer **actions** (resend receipt, refund, send a payment request / message), **CSV export**, and a clear handling of contactable vs anonymous customers.

### B2. What we already have (strong)
A payments‑derived "CRM‑lite": customers unified by email across links, store orders, tips, donations and API payments; header stats (customers, revenue, repeat rate, new‑30d); search, sort, and segment filters (repeat/new/dormant/invited/anonymous); CSV export; a detail drawer with lifetime value / payments / first‑seen, **store‑credit wallet**, full payment history, store orders, links sent, "request payment", copy‑email, and a clean single bucket for anonymous payments.

**Conclusion:** the list, segmentation, history, export and store‑credit pieces are already at or above the norm. The gaps are the **merchant‑side management actions**.

### B3. Gaps vs standard (customers)

| # | Gap | Impact |
|---|-----|--------|
| B‑G1 | **No private notes / tags** on a customer. | Standard CRM feature merchants expect. |
| B‑G2 | **No manual add / edit customer** — customers only appear automatically from payments; you can't add a contact or correct a name/email. | Common gap that frustrates merchants. |
| B‑G3 | **No per‑customer actions** beyond "request payment" and copy‑email — e.g. **resend receipt**, **refund**, **email the customer**. | Standard; keeps work inside the product. |
| B‑G4 | **No unified chronological timeline** (payments, links, orders in one time order). Currently shown as separate lists. | Nice‑to‑have; competitors show one timeline. |
| B‑G5 | **Only email/mobile contact + no marketing‑consent / unsubscribe state** surfaced. | Minor; relevant if you later message customers. |

### B4. Proposed scope for Part B (grouped)
- **Tier 1 — Notes & tags (recommended, low–medium):** B‑G1.
- **Tier 2 — Manual add / edit customer (recommended, medium):** B‑G2.
- **Tier 3 — Per‑customer actions (medium):** B‑G3 — start with **resend receipt**; refund/email depend on whether those flows already exist elsewhere.
- **Tier 4 — Unified timeline (optional, small):** B‑G4.

---

## Decisions that would change this plan

1. **How far to go now.** Suggested default: **Part A Tier 1 + Tier 2** and **Part B Tier 1 + Tier 2**. Recurring giving (A‑G7) and refund/email actions (part of B‑G3) treated as follow‑ups. Confirm, or re‑prioritise.
2. **Fund‑handling wording (A‑G2) — factual input needed.** What actually happens to a crypto donation: does it settle to the organizer's DynoPay balance **as crypto**, or is it **auto‑converted to a fiat/stable balance**, and does this depend on the merchant's payout settings? The on‑page statement must be truthful, so this is the one item only you can answer. Also: should this line be **merchant‑configurable per campaign**, or a single fixed platform statement?
3. **Donation receipts (A‑G1).** Email receipt only, or **also a downloadable/printable receipt page**? Any fields legally required for your target regions (e.g. a "no goods or services were provided" line, organizer legal name / tax ID)?
4. **Recurring / monthly giving (A‑G7)** — include now (large, separate build) or defer?
5. **Customer actions (B‑G3)** — is there an existing **refund** flow and an existing **customer‑facing receipt** we should reuse, or should the first cut be **notes/tags + manual add/edit + resend‑receipt** only?

## Assumptions (used unless you say otherwise)
- All additions are **additive** and must not change existing payment/settlement logic or break current campaigns.
- New donor‑facing copy stays **translatable** and works in the existing **dark‑mode‑default** theme on desktop and mobile.
- "Cover the fees" (A‑G8) is treated as optional and only included if Tier 3 is approved.
- Customer notes/tags are **private to the merchant** (never shown to payers).
- Where a receipt or refund flow already exists elsewhere in the app, we reuse it rather than build a parallel one.
