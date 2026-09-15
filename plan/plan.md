# Emails, public pages, checkout & creator pages — audit and fix proposal

Previous approved proposal (dashboard Command Centre + in-app pages, Waves 1–3) is archived at `/app/plan/dashboard_command_centre_plan.md`. Waves 1–3 are built; the end-to-end test sweep for Waves 2–3 stays deferred until asked for.

This plan covers what was requested next:

1. Every email the platform sends — fix the "payment received" gap (fee taken, amount forwarded) and audit all others against what a payments company is expected to send.
2. Landing page and all public pages, the hosted checkout and every buyer-facing page — what each should display for this kind of product, whether it is easy to use, and how it should look on phone, tablet, laptop and desktop.
3. Pages not touched by Waves 1–3 — the public creator page (tips), the store, product, cart and store checkout, and the remaining in-app pages.

Two phases: **Phase 1 = written audit** (findings with screenshots at four widths, every email rendered) for review; **Phase 2 = fixes in waves**, each shippable and reviewed on its own.

---

## Part A — Emails

### A1. The standard a payment-gateway email is held to

Research base: Stripe / Coinbase Commerce / BitPay / NOWPayments merchant notifications, transactional-email guides (SocketLabs, Fluxly, Regpacks, InfluenceFlow 2026), WCAG 2.2 AA.

Every email:
- One purpose, one primary button. Subject ≤ 50 characters and carries the fact ("Payment settled · $120.00 from Acme"); preheader carries the second fact (net amount, or what is needed).
- Brand header, a facts table, a short "what happens next / nothing to do" sentence, one button that opens the exact object (this payment, this wallet), not a list page.
- Footer: why you received it, how to change notification settings, support contact, legal name and address.
- Single column ≤ 600 px, body text ≥ 14 px, contrast ≥ 4.5:1, status never shown by colour alone, button ≥ 44 px tall, renders in dark mode, has a plain-text alternative.
- Times shown as "14:02 UTC (16:02 Berlin)" using the recipient's timezone; amounts formatted identically everywhere (crypto precision per asset, fiat 2 dp).

Money emails to a merchant additionally show the **full money path**, because that is what a non-custodial gateway is:
- Gross received (crypto + fiat value at the moment of payment — the value the merchant must book for tax).
- Dynopay fee (tier % and amount).
- Network fee, and who bore it (customer or merchant).
- Net forwarded, the destination wallet (masked, e.g. `bc1q…9x2k`), and the forward transaction hash with block-explorer link — or "forwarding now, visible in Payouts" when not yet broadcast.
- Asset and network, what was paid for (link / product / invoice name), customer (masked email), payment reference.

Buyer emails show what the buyer paid and what they get; never the merchant's fee.

### A2. Findings so far (payment family, read directly)

| Email | Today | Gap vs. standard |
|---|---|---|
| Payment received (merchant) | amount, crypto amount, method, status, date, reference | **No fee, no net, no forwarded-to wallet, no network, no on-chain hash / explorer link, no "what was paid for", no customer, no fiat value at time of payment.** Button goes to the transaction list, not the payment. |
| Payment pending (merchant) | amount, crypto amount, status, reference — amount correct | No confirmations required / typical wait, no network, no explicit "nothing to do yet". |
| Payment confirming (merchant) | progress bar per confirmation | Sent per confirmation step → inbox noise. Becomes opt-in (see A4). |
| Partial payment (merchant), buyer top-up nudge, partial expired, daily underpaid digest | expected / received / remaining | No fiat equivalent, no network; completed-partial outcome lacks fee / net / forwarded. |
| Customer receipt | to be verified in Phase 1 | Must show: merchant name and contact, item(s), amount paid in crypto and fiat, network, tx hash link, order/receipt number, refund-policy link, download/save option. |

### A3. Whole-inventory audit (Phase 1)

All ~20 families are rendered and scored against A1: account (welcome, verify, delete), activation and activation gate, KYC (approved / rejected / due), company / brand lifecycle, auto-convert results, customer receipt, order (paid / shipped / delivered / download), OTP and 2FA, security (new device, password change, login alert), payout-wallet change / verify, wallet-security freeze, referral (joined / reward), monthly billing report, payment-link campaigns, admin notifications and ops alerts. Output: a table per email — verdict **keep / fix / merge / retire**, the exact fields to add or remove, and a phone-width and dark-mode render.

### A4. Fixes already decided (Phase 2, Wave 4)

- **"Payment received" becomes "Payment settled"** with the full money path from A1. If the forward has not yet been broadcast when the email is sent, the row reads "Forwarding to bc1q…9x2k — appears in Payouts"; no second "forwarded" success email is sent (Payouts page and the in-app inbox record it).
- **New "Payout delayed" email** when a forward has not completed within 2 hours or has failed: amount, destination, what Dynopay is doing, a support button. This is the only forward-related email besides the settled one.
- **Overpaid** (merchant): if no email exists today, add one — overpaid by X, buttons "Refund excess" / "Keep as credit".
- **Pending** gains network, confirmations required and typical wait; **confirming** progress emails switch off by default (opt-in in Settings → Notifications).
- **Partial / underpaid family** gains fiat equivalent, network; the completed-partial outcome shows fee / net / forwarded like a settled payment.
- **Refund emails** (buyer and merchant) show refunded amount, asset and network, refund tx hash, original payment reference.
- **Auto-convert emails** show source amount → rate → converted amount → spread / fee.
- **Monthly statement** shows gross, fees, net by asset, payment count, and a link to the CSV export.
- **Notification control**: every non-critical email can be switched off in Settings → Notifications; security and money-exception emails cannot. Footer of every email links there.
- **Cross-cutting**: one shared template; the same status vocabulary and colours as the dashboard chips; identical amount and time formatting; plain-text part for every email; all new strings in every language the app already ships.

---

## Part B — Public marketing pages

### B1. Standard

Research base: Stripe website checklist, fintech landing-page studies (DesignRevision, WebAnatomy, WSA 2026), payment-gateway competitor pages.

Page order for a payments product: **value proposition → trust → proof → how it works → pricing → developers → FAQ → final CTA.** Trust is a hero element, not a footer link. Claims are quantified only where real numbers exist — no invented "$X processed" or "99.99 %" figures. One primary CTA per screen ("Start accepting crypto" / "Create free account"), one low-friction secondary ("See fees" / "View docs"). Pricing is fully transparent on its own page and summarised on the landing page. Phone load under 2 s, no horizontal scroll, forms use the right keyboard types and autocomplete.

### B2. What each public page should display

| Page | Should display | Usability check |
|---|---|---|
| **Landing (/)** | Headline stating the outcome (accept crypto, keep it non-custodial, get paid to your own wallet); sub-line with the fee and "no monthly cost"; primary + secondary CTA; live product visual (real checkout or dashboard, not an illustration); trust strip (non-custodial, no card data, KYC/AML posture, status link); supported coins and networks; three ways to sell (payment links, your page/store, API); how it works in 3 steps; fee summary; developer snippet; social proof only if real; FAQ; final CTA; complete footer (product, developers, company, legal, status, language). | Above-the-fold answers "what is it, what does it cost, is it safe" without scrolling on every width. |
| **Fees** | Fee per tier with thresholds, what triggers each tier, network-fee policy (who pays), auto-convert spread, refunds, no hidden items; worked example ("$100 sale → you receive …"); comparison with card fees stated factually. | A merchant can compute their exact net for a sale. |
| **About / Company** | Who runs it, legal entity and address, custody model, regulatory posture, contact channels (email + support hours), press kit link. | Legitimacy questions answered on one page. |
| **How it works** | The buyer journey and the merchant journey as two parallel step lists with real screenshots; time to first payment. | Reads in under a minute on a phone. |
| **For / verticals**, **Compare / competitors** | Same skeleton as the landing page with the vertical's or competitor's specifics; factual comparison tables; no unverifiable claims. | One CTA; tables scroll horizontally inside their own container on phone, never the page. |
| **Documentation** | Quick-start (first payment in N lines), auth, endpoints, webhooks with signature verification, sandbox, SDKs, changelog; copyable code blocks; sidebar nav. | Search or jump-to on phone; code blocks do not overflow. |
| **Help centre** | Categories (getting paid, payouts, checkout problems, account & security, taxes), top articles, search, contact route with expected response time. | "My payment is stuck" resolves in two taps. |
| **System status** | Per-component status, incident history, subscribe. | Reachable from every footer and every error state. |
| **Blog, Press, Referral program** | Standard content layouts; referral program page states reward, conditions, payout timing. | Readable line length (≤ 75 characters) on desktop. |
| **Legal (Terms, Privacy, AML)** | Table of contents, last-updated date, plain-language summary at top. | No pinch-zoom needed on phone. |
| **Sign up / Log in / Register / Reset / Invite** | One-column forms, social login clearly separated, password rules shown before failing, error text next to the field, link to the other flow. | Completable one-handed on a phone. |
| **404 / error / unsubscribe** | Plain explanation, search or home, status link, support. | Never a dead end. |

---

## Part C — Hosted checkout and buyer-facing pages

### C1. Standard

Research base: Stripe checkout guidance, crypto-checkout conversion studies (Aurpay, Inxy, Xaigate, Pallapay 2026), BitPay / Coinbase Commerce hosted pages.

- Fiat amount is the anchor; crypto amount is secondary and recomputed with a visible rate-lock timer (15–20 min) that changes colour at 5 and 2 minutes and offers "refresh price" when it expires — the page never goes dead.
- Asset / network chooser shows, per option, the approximate network fee and typical confirmation time; the cheapest/fastest option is pre-selected; stablecoins first.
- Desktop: QR ≥ 200 px above the fold with copy-address and copy-amount buttons. Phone: "Open in wallet" deep link first, then full-width copy buttons (≥ 48 px tall); QR secondary.
- Three-state progress that stays visible: waiting → detected (confirmations x / y) → confirmed, with the tx hash and explorer link once detected.
- Fee disclosure before paying: who pays the network fee and the exact amount to send, with a "send exactly this amount" warning.
- Edge states with instructions, not error codes: underpaid (remaining amount, top-up window, same address), overpaid (what happens to the excess), expired (create new payment), wrong network (what to do, support link).
- Trust at the anxiety point: merchant name and logo, "non-custodial — paid directly to the merchant", AML/terms links, support contact, Dynopay mark.
- Buyer receives: optional email field for receipt (explained), success page with receipt link, "save merchant" and "back to merchant" actions.

### C2. What each buyer page should display

| Page | Should display |
|---|---|
| **Hosted checkout (/pay)** | Everything in C1; merchant identity at top; order summary (item, quantity, price, tax if any); email field for receipt; language switch; states per C1. |
| **Payment success** | Confirmed amount (fiat + crypto), merchant, order/receipt number, tx hash link, what happens next (download / delivery / merchant message), receipt link, save merchant, return to merchant. |
| **Payment failed / expired** | Which state (expired, underpaid closed, rejected) in plain words, what the buyer can do (new payment, contact merchant), support link, no technical codes. |
| **Payment verify (return from wallet)** | Same three-state progress as checkout; never a spinner without text. |
| **Order status (/order/ref)** | Order summary, payment state, fulfilment state (paid → processing → shipped/delivered or download available), merchant contact, receipt link. |
| **Receipt (/receipt/token)** | Printable/PDF-ready: merchant legal name and contact, buyer, items, amounts (fiat + crypto), network, tx hash, date/time with timezone, receipt number, refund policy. |
| **Saved merchants** | Kept; consistent card layout with the rest. |
| **Pay-side Terms / AML** | Reachable from checkout footer; plain-language summary. |

---

## Part D — Public creator pages (tips, store)

Research base: Ko-fi, Buy Me a Coffee, Gumroad and Shopify storefront practice.

| Page | Should display | Usability |
|---|---|---|
| **Creator page (/handle)** | Cover, avatar, name, one-line bio, social links; **tip block**: three preset amounts + custom amount, optional message to the creator, one "Tip" button; optional supporter wall (recent tips, opt-in per creator); link to the store with the top 3 products; share button; "powered by Dynopay" with the non-custodial note. | Tip completes in three taps on a phone; primary button visible within the first screen. |
| **Store (/handle/shop)** | Product grid: real cover image, title, price, availability, one tap to product; category filter when > 8 products; cart indicator; search when > 20. | Grid = 1 column on phone, 2 on tablet, 3–4 on laptop/desktop; images never crop titles. |
| **Product (/handle/p/slug)** | Above the fold: cover, title, price, who it is for, "Buy" button; then what is included (bulleted), delivery type (download / shipping / service), refund policy, FAQ; related products. | "Buy" is visible without scrolling on a phone; sticky buy bar on phone. |
| **Cart (/handle/cart)** | Items with quantity controls, subtotal, tax/shipping line if any, total, single "Checkout" button, continue-shopping link. | Editable without leaving the page. |
| **Store checkout (/handle/checkout)** | Buyer details only when needed (shipping vs. digital), then the hosted checkout from Part C in the same visual shell — one experience, not two. | Same trust cues and states as /pay. |

---

## Part E — Remaining in-app pages (not covered by Waves 1–3)

| Page | Should answer | Change proposed |
|---|---|---|
| **Create payment link (builder)** | "Make a link that sells this thing, correctly." | Single scrolling form with live preview; amount / open amount, asset restrictions, expiry, collect buyer info, redirect URL, tax; review step shows the buyer-facing result before publishing. |
| **Payment link detail (pay-links/slug)** | "How is this link doing and how do I share it?" | Header: status, 30-day paid count and volume, funnel (views → checkouts → paid); share tools (copy, QR, embed); recent payments for this link; edit / disable actions. |
| **Products (new / edit / orders)** | "Sell and fulfil this product." | Editor with live product-page preview, inventory, delivery type, files; orders list per product with fulfilment state actions (mark shipped, resend download) and buyer contact. |
| **Your page → Page tab (tips settings)** | "How do tips work on my page?" | Preset amounts, custom-amount toggle, thank-you message, supporter wall on/off, goal (optional) — with live preview of the public tip block. |
| **Profile** | "Who am I in this account?" | Kept lean: identity, email, avatar, password, 2FA entry point; everything else already lives in Settings. |
| **KYC** | "What do I verify, by when, what is the status?" | Status timeline, deadline, document list, what happens if missed; kept as is where already so. |
| **Help & Support (in-app)** | "Get help without leaving." | Pre-filled payment reference when opened from a payment; article search; ticket status. |
| **Legacy wallet page** | — | If it duplicates Payout wallets, redirect to it (same treatment as the old wallet-security page). |
| **Old redirect pages (creator, wallet-security)** | — | Confirmed redirects; nothing else. |

---

## Part F — Responsive standard applied to every page above

Four target widths, both light and dark, checked in Phase 1 and required in Phase 2:

| Class | Test size | Rules |
|---|---|---|
| Phone | 390 × 844 | Single column; primary action visible in the first screen and sticky where the page has one job (checkout, product, tip); tap targets ≥ 44 px; amount fields open numeric keyboard; tables become cards; no horizontal page scroll (tables scroll inside their container). |
| Tablet | 820 × 1180 (portrait) and landscape | Two columns only where content is list + detail or form + preview; marketing sections stack to two-up grids; checkout stays a centred single column (max 480 px). |
| Laptop | 1366 × 768 and 1440 × 900 | Full layout; content width capped at 1200 px; text lines ≤ 75 characters; checkout centred at max 520 px with merchant/order summary alongside. |
| Desktop | 1920 × 1080 | Content capped at 1320–1440 px, centred; extra width goes to margins or the product visual, never to stretched text or wider cards; no element scales past its laptop size. |

Also: WCAG 2.2 AA contrast and visible focus on every interactive element; images with alt text; Core Web Vitals targets (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) on the landing page and checkout; one language sample beyond English rendered per page to catch overflow.

---

## Part G — Deliverables and order

**Phase 1 — Audit report** (for review before any fix): one document with, for every email and page above, a screenshot at the four widths (emails at 600 px and phone), the gaps against Parts A–F, and a severity: *blocker* (wrong or missing money information, dead-end state, unusable on phone), *should fix* (missing standard content, weak hierarchy), *polish*.

**Phase 2 — Fix waves** (each shippable and reviewed):
- **Wave 4 — Emails**: A4 fixes plus every "fix" verdict from the audit; shared template, notification controls, plain-text parts, translations.
- **Wave 5 — Hosted checkout + buyer pages** (Part C).
- **Wave 6 — Creator public pages**: tips, store, product, cart, store checkout (Part D) and the tips-settings tab (Part E).
- **Wave 7 — Public marketing pages** (Part B).
- **Wave 8 — Remaining in-app pages** (Part E).

The deferred end-to-end test sweep for Waves 2–3 runs when asked; it can be folded into Wave 4's testing.

---

## Part H — Decisions and assumptions (push back if any is wrong)

- One "Payment settled" email per payment; no separate "forwarded" success email; a "Payout delayed" email only when a forward is late (> 2 h) or failed.
- Per-confirmation "confirming" emails become opt-in (off by default). Pending and settled stay on.
- Fees in emails: Dynopay fee shown as tier % and amount; network fee shown separately with who paid it; buyer emails never show the merchant fee.
- Fiat value in emails is the value at the moment the payment was detected (the figure a merchant books).
- Buyer emails carry the merchant's name as the sender display and a "powered by Dynopay" footer; merchant emails carry Dynopay branding. Existing email transport is kept.
- Marketing pages change in content, structure and responsiveness only; brand visuals (indigo accent, type, dark mode) are unchanged. No trust metric is shown unless it is a real, current number.
- Creator tip block: three presets + custom amount + optional message; supporter wall is opt-in per creator and off by default.
- Store checkout reuses the hosted checkout inside the creator shell — one checkout experience across the product.
- Every new string ships in all languages the app already supports.
- Wave order 4 → 5 → 6 → 7 → 8, each reviewed before the next starts; the audit (Phase 1) is reviewed before Wave 4 begins.
