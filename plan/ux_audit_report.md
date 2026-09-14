# DynoPay — end-to-end UI/UX pain-point audit (June 2026)

Scope: onboarding → merchant app → payment links → hosted checkout → creator page & tips → store → order → emails.
Evidence: full read of every buyer-facing surface and the onboarding/merchant code, plus live production content
(dynopay.com landing, /pay/demo, creator pages @devhub and @csvcleanroom, /test/shop, product page, store checkout,
donation demo). Browser screenshots were not available in this session; anything that needs a screen or backend
check to confirm is tagged **VERIFY**. Severity: **Blocker** (user can't finish or money is at risk) · **Major**
(likely confusion / drop-off) · **Minor** (friction) · **Polish**. Effort: XS / S / M / L.

---

## 1. Executive summary — top 10

| # | Pain point | Where | Sev |
|---|---|---|---|
| 1 | Products under the $10 order minimum are live and buyable until checkout, where the buyer is blocked ($7 and $9 items at @csvcleanroom today) | Store | Blocker |
| 2 | After paying for a store order the success screen has no link to the order/downloads page — buyer must go find the email | Store | Blocker |
| 3 | The checkout's own countdown flips to "expired" at 0:00 even when a payment was already detected and is confirming; polling stops and the buyer is told to "contact the merchant" (**VERIFY** backend timer extension) | Checkout | Blocker |
| 4 | Any checkout error collapses the whole panel to a red alert — no brand, no coin selectors, no retry, although the copy says "choose a different coin" | Checkout | Major |
| 5 | Three different checkout experiences for the same buyer (payment link V2, inline tip/store checkout, legacy stepper): different coin pickers, QR visibility, warnings, fee display and copy | Checkout / Creator / Store | Major |
| 6 | Auto-generated account identity leaks to the public: "csvcleanroom_529785728b" is the page title, heading, share text, breadcrumb and shop title | Onboarding / Creator | Major |
| 7 | Onboarding demands a self-custody wallet address per coin before a link can exist — the landing promises "no crypto knowledge required"; there is no "I don't have a wallet" path | Onboarding | Major |
| 8 | Network-first coin picker and address auto-reservation with a running timer before the buyer has chosen anything | Checkout | Major |
| 9 | Merchant redirect URL / embed success signal are not honoured on the V2 checkout; the only filled button on the success screen is "Share Dynopay" (**VERIFY**) | Checkout | Major |
| 10 | The $10 platform floor silently rewrites creator settings (presets under $10 vanish; "Buy me a coffee" at $10 vs Ko-fi's $3–5) and is inconsistent (donations $5) | Creator / Tips | Major |

---

## 2. Journey maps

### 2.1 New merchant: landing → sign-up → first link
1. Landing hero → "Start accepting payments". Landing states "0.0% Starter fee" in one stat card and "from 1.5% (Starter)" in the FAQ on the same page (E4). Promises "~4s payout" / "confirms in seconds" (E5).
2. Register: purpose picker → email or phone → OTP → first/last name → success (confetti). Passwordless by default (A5).
3. `/get-started` wizard, Step 1 "Tell us about you": account type again (purpose was already asked), first/last name again (prefilled), brand name, country, logo (A3).
4. Step 2 "Where should your money go?": must add a wallet address (email OTP) to unlock links. No help for users without a wallet; one address per coin (A2).
5. Step 3 first link (simple form + phone preview) → Step 4 share (copy / QR / share / open). Step 4 only completes when a real payment lands, so the progress ring sits at 3/4 indefinitely (A4).
6. Dashboard "Getting started" hero until the first payment; then the established dashboard.
Friction score: 8–9 screens before a shareable link; the wallet step is the drop-off point.

### 2.2 Buyer: payment link → hosted checkout (V2)
1. Open link → "Pay {Merchant}" · verified badge · "Total you pay" with fee breakdown (fee shown as estimate).
2. Network and currency are auto-selected (remembered per device) and an address is **reserved immediately**; the 30-min timer starts before the buyer has read the page (B4). Switching either select reserves a new address.
3. Buyer must pick the *network* before the *coin* ("Tron" before "USDT") (B3). Receipt-email field sits between selects and the QR.
4. QR (tap to copy), wrong-network warning, address, amount, "Open in wallet app" (native coins only), memo, collapsible refund address, Waiting → Detected → Confirmed timeline with a generic "usually 5–15 min" (B7).
5. States: underpaid (good — exact remainder, same address), overpaid (silently success, B8), expired (Start over reloads; no reference id; "Go to Dynopay" leaves the merchant, B13), error (dead end, B2).
6. Success: check animation, amount, breakdown, Download receipt (outlined), Copy receipt link (text), email catch, then a **filled indigo "Share Dynopay"** — no "Return to {merchant}" and no redirect (B5, B6).

### 2.3 Fan: creator page → tip
1. `/{handle}`: cover, avatar, name, @handle, bio, socials, then **"Share this page"** (share row before any content, C5), then Support widget, featured campaign, Shop grid, links.
2. Support widget: presets (≥ $10 only), Custom, name, email, message, anonymous → "Buy $10.00" (C3, C4).
3. Inline checkout (InlineTipCheckout): coin grid (coin-first, labels like "USDT (Tron)"), then address row, **QR hidden behind "Show QR code"**, no "Open in wallet", no wrong-network warning, "≈ $25" base amount (C2).
4. Success: thank-you, share chips, "Back to @handle" / "Send another tip". Expired/failed copy hard-coded English (C7).

### 2.4 Shopper: creator page / shop → product → cart → checkout → order
1. Shop grid: 4 of 5 products at @csvcleanroom show a "◫" placeholder glyph (D3); category chips with one category; "Sort Sort Featured" (D8).
2. Product page: plain MUI page, "← Back to {name}'s shop", price, quantity, Add to cart / **Buy now (opens the mini-cart drawer, D6)**, description rendered as a raw monospace `pre` block (D5); gallery images never shown (D9). No mention of the $10 minimum or network fees.
3. `/{handle}/checkout`: unbranded "Checkout" h4, email (required), name, VAT ID, line items without images, total, "Pay with crypto →" (D4). $10 minimum surfaces here for the first time (D1).
4. Inline checkout (same component as tips) → success: "Back to @handle" / "New payment" — **no path to `/order/<ref>`** where downloads / license keys / booking links live (D2).
5. `/order/<ref>` itself is good: status, human line, deliveries, resend links, totals, tax, help line.

### 2.5 Merchant: money lands
1. Notification + email (payment method now included). Auto-convert: two-stage notification (just fixed).
2. Transactions → detail drawer (hashes, fees, settled-to). Payouts/"Balances" page → coin-filtered transactions.
3. Gap: a failed auto-conversion has no merchant-facing state or retry — funds sat in the exchange deposit wallet unnoticed (~$86 across 3 conversions in the last session) (E2).

---

## 3. Findings

### A — Onboarding & first run
| ID | Sev | Finding | Who | Why it matters | Recommended fix | Effort |
|---|---|---|---|---|---|---|
| A1 | Major | Auto-provisioned account names leak publicly: "csvcleanroom_529785728b" as `<title>`, H1, share text ("Support csvcleanroom_529785728b on Dynopay…"), product breadcrumb, shop title. | Creators, their visitors | Looks broken/spammy; destroys trust on the one link the creator shares. | Never publish a page/shop while the display name is the generated placeholder; make display name a hard gate at handle claim; banner in Storefront settings for existing placeholder names; backfill from contact name. | S–M |
| A2 | Major | Step 2 requires a self-custody address per coin before any link can be created ("Add at least one address to unlock payment links"). No guidance for people without a wallet; one-address-per-coin implies up to 15 addresses. | New merchants without crypto experience | Direct contradiction of "No crypto experience needed"; biggest drop-off point in the wizard. | Add "Don't have a wallet yet?" helper (recommended wallets per coin, 60-second setup, video), a single-stablecoin quick path (one USDT address + auto-convert), and let the merchant create and *preview* the first link before the wallet, blocking only *sharing*. | M |
| A3 | Minor | Identity captured twice: purpose picker + name at register, then account type + first/last name again in wizard Step 1. | New merchants | Feels like the app forgot what was just typed. | Skip known fields; Step 1 = brand + country (+ optional logo). | S |
| A4 | Minor | Step 4 "Share it" is only marked done when a payment arrives; ring stays 3/4 and CTA "Share your link" persists indefinitely. | New merchants | Progress feels stuck. | Mark step done on first copy/QR/share action; separate "first payment" celebration. | S |
| A5 | Minor | OTP-only accounts must fetch a code every login unless they discover "Set password" in Settings. | Returning merchants | Login friction on every visit. | Offer optional password set-up on the success step and as a dismissible dashboard nudge; passkeys later. | S |
| A6 | Polish | Wizard copy "takes about 30 seconds" for a wallet add that includes an email OTP round-trip. | New merchants | Small expectation miss. | Reword or drop the estimate. | XS |

### B — Hosted checkout (payment links, V2)
| ID | Sev | Finding | Who | Why | Fix | Effort |
|---|---|---|---|---|---|---|
| B1 | Blocker **VERIFY** | Client timer sets phase `expired` at 0:00 regardless of `detected`; polling and SSE stop; expired copy says "if you already sent funds, contact the merchant". Backend may extend `remaining_seconds` while pending — confirm. | Buyers on slow chains (BTC/ETH congestion) | Buyer believes a real, in-flight payment failed; support tickets; abandoned "duplicate" payments. | Never expire once detected; hide the countdown and show "Payment detected — confirming" until the backend reports final state; keep polling. | S |
| B2 | Major | `error`/`failed` phase renders only an alert inside the shell: no logo, headline, amount, selects or retry. Error copy tells the buyer to "choose a different coin". | Buyers | Dead end; looks broken; lost sale. | Keep header + selects mounted; inline error beneath the selects; "Try again" button; keep the buyer's chosen coin. | S |
| B3 | Major | Network-first selection ("NETWORK: Tron" → "CURRENCY: USDT"). Buyers think coin-first; USDT/USDC holders must know their network name before seeing the coin. | Buyers | Wrong-network risk; hesitation; Coinbase Commerce / Stripe crypto are coin-first. | Coin-first list (with fiat equivalent per coin), then network chips only when a coin has more than one network. | M |
| B4 | Major | Address is auto-reserved on load and the 30-minute timer starts before the buyer chose anything; each select change reserves another address. | Buyers, merchant address pool | Urgency before comprehension; wasted reservations; the "Send exactly" amount jumps when the exact fee replaces the estimate. | Show selection without reserving; reserve on an explicit "Continue" (or on first interaction), then start the timer. Keep remembered-coin as a preselected default only. | S–M |
| B5 | Major **VERIFY** | `redirect_url` from getData is only used on the already-paid revisit view. `CleanCheckoutV2` receives no `redirectUrl` and the parent never passes `onSuccess`, so `isSuccess` stays false → embed `postMessage('dynopay:success' / 'dynopay:redirect')` never fires from the V2 path. | Merchants with redirect/embed; their buyers | Buyers stranded on Dynopay after paying; embedded stores can't react. | Pass `redirectUrl` + `onSuccess`; add "Return to {merchant}" with a 5-second auto-redirect countdown. | S |
| B6 | Major | Success screen hierarchy: only filled primary button is "Share Dynopay" (platform promo); receipt is outlined; no return-to-merchant; no "what happens next". | Buyers, merchants | Platform self-promotion over the buyer's job; merchants dislike it on their checkout. | Order: Return to merchant (primary) → Download/Email receipt → subtle share text link. | S |
| B7 | Minor | Confirmation ETA is a fixed "usually 5–15 min" for every chain (SOL/TRX seconds; BTC up to 60 min). | Buyers | Anxiety or false alarm depending on chain. | Per-network ETA table; show "usually under a minute on Tron". | S |
| B8 | Minor | Overpaid → plain success with no note on the excess or refund path; underpaid top-up doesn't mention the second network fee. | Buyers | Money questions with no answer on screen. | Overpaid: show excess + "the merchant can refund the difference"; underpaid: "you'll pay a second network fee". | S |
| B9 | Polish | Memo/tag copy button uses the `amt` flag → the *Amount* row shows "Copied". | XRP/XLM buyers | Wrong feedback location. | Own flag for memo. | XS |
| B10 | Polish | "Total you pay" shows an estimate, then silently changes when the exact fee arrives. | Buyers | "The price changed" moment. | One-line note "updated with the exact network fee". | XS |
| B11 | Polish | Refund address saves on blur with no confirmation (inline checkout does show "Refund address saved"). | Buyers | Uncertainty whether it stuck. | Reuse the saved indicator. | XS |
| B12 | Minor (decision) | Buyer sees merchant economics — "Merchant receives $X · Dynopay fee $Y" on checkout, success and receipt email/PDF. | Merchants | Stripe/Coinbase never expose the merchant's fee to a customer; some merchants will object. | Merchant setting "Show fee split to customers" — default on only when the customer pays the fee. | S |
| B13 | Minor | Expired-link screen: no reference id, no way to leave an email, "Go to Dynopay" sends the buyer to the platform site. | Buyers | Buyer can't cite the payment; merchant loses them. | Show reference, "Ask {merchant} for a new link" (mailto/return URL), optional "notify me" email. | S |
| B14 | Minor **VERIFY** | Only `standard/payment/contribution/cart` link types get the V2 checkout; other types (invoice-style links?) fall back to the legacy 3-step stepper. | Buyers of those links | Two visual systems for the same brand. | Confirm which types hit the legacy path; route them through V2 or retire the stepper. | M |
| B15 | Polish | V2 self-fetch path hard-codes `language: 'en'` (the parent path passes the real language). | Non-English buyers | Backend-localised strings may return English on the fallback/SWR path. | Pass `i18n.language`. | XS |
| B16 | Polish | Success/receipt mint & share strings default to "Merchant" when the brand name is missing ("I just paid Merchant with crypto"). | Buyers | Placeholder copy leaks. | Hide share when no name. | XS |

### C — Creator page & tips
| ID | Sev | Finding | Who | Why | Fix | Effort |
|---|---|---|---|---|---|---|
| C1 | Major | Three checkout implementations: `CleanCheckoutV2` (links), `InlineTipCheckout` (tips, creator links, store — 1,300 lines with its own coin table and English-only copy), legacy stepper. Different selection model, QR treatment, warnings, fee display, success actions. | Every buyer | Inconsistent trust cues; bugs fixed in one place stay in the others (e.g. B1 logic duplicated). | One checkout component with `mode` (link / tip / donation / cart) and `layout` (page / inline). | L |
| C2 | Major | Inline checkout: QR collapsed by default ("Show QR code"), no "Open in wallet app" deep link, **no wrong-network / wrong-coin warning**, "≈ $25" shows the base amount even when the crypto amount includes buyer-paid fees, no fee breakdown, single "Waiting for payment" pill without the Detected step. | Fans, shoppers (mostly on phones) | Mobile-first surfaces have the weakest mobile payment ergonomics and the highest wrong-network loss risk. | Bring inline checkout to V2 parity (or C1). | M |
| C3 | Major | $10 platform floor: presets < $10 are filtered out publicly (creator can still save them → only "Custom" chip remains); min forced to 10 with `Math.max`; "Buy me a coffee" reads "Buy $10.00"; donation campaigns show "Minimum $5.00". | Creators, fans | Creator's settings silently ignored; $10 coffee kills small tips; inconsistent floors. | Enforce and explain the floor inside settings (disable invalid presets, show why); reconsider a lower tip floor or a per-network floor; align donation/tip/store minimums. | S (+ business decision) |
| C4 | Minor | Tip form asks name, email, message and anonymous before the amount is confirmed; email placeholder hard-coded English; CTA "Buy $10.00". | Fans | Ko-fi asks name + message only; every field costs conversions. | Amount + optional message first; email on the success screen (already exists); CTA "Buy a $10 coffee" / "Tip $10". | S |
| C5 | Minor | "Share this page" row sits above the support widget, products and links. | Visitors | Asked to share before seeing anything worth sharing. | Share as a header icon + footer row; keep native share on mobile. | S |
| C6 | Minor | Two support CTAs when both the support widget and a featured donation exist; sticky mobile "Support {name}" bar uses dark ink text on any merchant accent (light-text accents fail contrast — the `readableOn` guard exists but isn't used there). | Visitors on phones | Choice paralysis; accessibility. | One primary support CTA per page; use `readableOn(accent)` on the sticky bar. | S |
| C7 | Minor | Hard-coded English across public creator surfaces: "Share this page", "Link copied!", "Support {first name}", "raised of", "supporters", "Powered by", empty-state body, inline-checkout MODE_COPY, underpaid/expired/failed copy, "Copied!", "Copy link". | Non-English visitors | Breaks the 6-language promise on the most-shared page. | Move to `landing.creator.*` keys; run the existing i18n missing-key script over `Components/Page/Creator/*`. | S |
| C8 | Polish | Featured campaign CTA and support widget both use gradient buttons; link cards navigate inline for links but full-page for donations. | Visitors | Inconsistent interaction model. | Inline for both or clear "opens campaign" affordance. | S |
| C9 | Minor | Public analytics/momentum widget and donor wall show first names + amounts by default (creator toggle exists). | Fans | Some tippers won't expect public listing. | Default "anonymous" checked when message is empty? Or make the listing explicit near the anonymous toggle. | XS |

### D — Store (shop, product, cart, checkout, order)
| ID | Sev | Finding | Who | Why | Fix | Effort |
|---|---|---|---|---|---|---|
| D1 | Blocker | $10 minimum order enforced only at `/checkout` (`MIN_TOTAL_CENTS`). Live products under $10 exist ($7, $9 at @csvcleanroom); product page and cart give no warning. | Shoppers, merchants | Buyer adds, reaches checkout, is blocked; merchant never learns why nothing sells. | Enforce at publish (block or warn "can only be bought with other items"), show "minimum order $10" on product page/cart when below, or remove the store floor. | S |
| D2 | Blocker | Store success (inline checkout, mode `link`) offers "Back to @handle" and "New payment" — no link to `/order/<ref>` (downloads, license keys, booking links, resend). Cart is cleared on confirm. | Shoppers | Paid but can't reach what they bought without opening email; support load. | Primary CTA "View your order & downloads" → `/order/<ref>`; auto-redirect after 3 s; keep order ref visible. | S |
| D3 | Major | Products without a cover image show a "◫" glyph placeholder (shop grid and product page). | Shoppers | Store looks broken/unfinished (4 of 5 products at a live merchant). | Generated cover (title initials on accent gradient) + nudge merchants to add images. | S |
| D4 | Major | Store checkout is generic: no merchant name/logo, default MUI typography, line items without thumbnails, fee payer not disclosed, VAT ID field for everyone. | Shoppers | Brand continuity breaks right at the money step; trust dip. | Brand header (avatar, name, verified), thumbnails, "network fee paid by…" line, VAT ID behind "Business purchase?" toggle. | M |
| D5 | Minor | `description_md` rendered as a raw monospace `<pre>` block (no markdown rendering). | Shoppers | Looks like code; long descriptions hard to read. | Render sanitized markdown (a sanitizer already exists in `utils/sanitizeHtml.ts`). | S |
| D6 | Minor | "Buy now" adds to cart and opens the mini-cart drawer instead of going to checkout. | Shoppers | One extra step on the highest-intent action. | Buy now → `/checkout` directly (keep Add to cart for multi-item). | XS |
| D7 | Minor | Empty/test shops are public and in the sitemap (`/test/shop`, `/fggg/shop`, …) and show **merchant-facing** onboarding CTAs to visitors ("Add your first product", "Start campaign", "Open Creator") with emoji icons. | Visitors, SEO | Wrong audience; indexes junk pages under the brand. | Visitor-appropriate empty state ("{name} hasn't listed anything yet — follow / tip"), `noindex` + exclude 0-product shops from the sitemap. | S |
| D8 | Polish | Category chips shown with a single category; "Sort / Sort / Featured" duplicated labels; shop share text uses tip framing ("Support X on Dynopay — pay or tip"). | Shoppers | Clutter, wrong framing for a store. | Hide filters with < 2 categories; one sort label; store-specific share text. | XS |
| D9 | Minor | Gallery images can be uploaded in the editor but the product page renders only the cover. | Merchants, shoppers | Work with no payoff. | Simple thumbnail strip. | S |
| D10 | Minor | Editor offers a "physical" tax category while checkout collects no shipping address; product type "service" hides quantity but nothing explains fulfilment expectations. | Merchants | Physical listings would arrive with no address. | Label store as digital/services only in the editor; hide "physical" or add an address step. | S |
| D11 | Polish | Product page and shop use `Intl.NumberFormat("en-US")` regardless of language; price heading is a small `h4`. | Non-English shoppers | Locale mismatch. | Use the shared money formatter. | XS |

### E — Merchant app (established)
| ID | Sev | Finding | Who | Why | Fix | Effort |
|---|---|---|---|---|---|---|
| E1 | Major | Create payment link is a 2,100-line form: type selector, basic settings, description, coin picker with search, tax, post-payment, quick-sell, campaign manager. Default path still exposes far more than Stripe's amount + name. | Merchants | Time-to-link; decision fatigue; the wizard's 3-field version proves the minimum works. | Progressive form: amount, description, Create; sections collapsed and remembered; "Duplicate last link". | M |
| E2 | Major | Failed auto-conversions have no merchant-facing state or retry (3 FAILED conversions, ~$86, sat in the exchange deposit wallet unnoticed). | Merchants with auto-convert | Money invisible; trust in auto-convert. | Transactions/Payouts row state "Conversion failed — funds held", Retry / Contact support, email alert. | M |
| E3 | Minor | "Balances" section name on a non-custodial product implies held funds. | Merchants | Misleading mental model. | "Settlements" / "Payouts" wording; explain pending vs settled inline (partly done). | XS |
| E4 | Minor | Landing pricing contradicts itself: "0.0% Starter fee" stat vs "from 1.5% (Starter)" FAQ vs "first payment fee-free". | Prospects | Pricing trust. | One pricing sentence reused everywhere. | XS |
| E5 | Minor | Landing "~4s payout", "confirms in seconds" vs checkout "usually 5–15 min". | Prospects → buyers | Expectation gap. | Per-network language on both. | XS |
| E6 | Minor | Direct-Pay static address shown in the link success modal alongside the hosted link. | Merchants, their buyers | Two ways to pay one link; buyers paying the static address skip amount/network checks. | Move Direct Pay behind an explicit toggle with a warning. | S |
| E7 | Backlog (confirmed) | Expired-link rescue (Extend/Resend); OTP before deleting a brand; brand type backfill; "Accepts all coins" badge; brand name in weekly summary + link-created emails; AUTH-002 phone duplicate check. | Merchants | Already on the backlog — not re-discovered. | As planned. | — |

### F — Emails & notifications
| ID | Sev | Finding | Who | Why | Fix | Effort |
|---|---|---|---|---|---|---|
| F1 | Minor | Buyer receipt (email + PDF) shows "Merchant receives / Platform fee" (see B12). | Merchants | Exposes merchant economics. | Respect the same merchant setting. | S |
| F2 | Minor | Buyer receipt lacks the on-chain tx hash / explorer link and a link back to the merchant page or order. | Buyers | Proof of payment for crypto is the hash. | Add hash + explorer link, merchant/order link. | S |
| F3 | **VERIFY** | Buyer emails for expired / underpaid sessions when an email was left. | Buyers | Closes the loop on the B1/B8 cases. | Confirm; add if missing. | S |

---

## 4. Quick wins (one short batch)
B9 · B10 · B11 · B15 · B16 · C6 (contrast) · C8 · D5 · D6 · D8 · D11 · E3 · E4 · E5 · A4 · A6 · C7 (creator strings)

## 5. Proposed build batches (approve one at a time)
1. **Money-path blockers (S–M):** D1 min-order at publish/product, D2 order CTA, B1 never-expire-once-detected (+ backend confirm), B2 recoverable error state, B5 redirect/embed success, B6 success hierarchy.
2. **One checkout (L):** merge InlineTipCheckout + CleanCheckoutV2 (C1/C2); coin-first picker (B3); reserve-on-confirm (B4); per-network ETA (B7); overpaid/underpaid copy (B8).
3. **Identity & onboarding (M):** A1 placeholder-name gate + backfill, A2 wallet helper + create-before-wallet, A3 de-duplicate fields, A5 optional password, C3 floor enforcement in settings (+ decide the floor).
4. **Store polish (M):** D3 generated covers, D4 branded checkout, D7 visitor empty state + noindex, D9 gallery, D10 editor labels.
5. **Trust & copy (S):** B12/F1 fee-split setting, F2 hash in receipt, C5 share placement, E4/E5 landing consistency, E6 Direct Pay toggle.
6. **Merchant money visibility (M):** E2 failed-conversion state, E1 progressive create-link.

## 6. Method & limitations
- Code read: `pages/pay/index.tsx`, `CleanCheckoutV2` + checkout modules, `InlineTipCheckout`, `SupportWidget`, `CreatorProfile`, `CreatorShopSection`, `[handle]/{checkout,p/[slug]}`, `order/[publicRef]`, `GetStarted/*`, `auth/register`, `CreatorPageSettings`, `ProductEditor`, `CreatePaymentLink`, `customerReceiptEmail`.
- Live content: landing, `/pay/demo`, `/pay/donation-demo`, `/devhub`, `/csvcleanroom`, `/csvcleanroom/shop`, `/csvcleanroom/p/…`, `/csvcleanroom/checkout`, `/test/shop`, sitemap.
- Not exercised: screenshots at 390/1920, dark theme, real payments, logged-in merchant screens (covered by the recent 43-row UX plan + iterations 138–144). Items tagged **VERIFY** need one browser/backend pass before building.
- Cross-reference: nothing here duplicates a row already marked DONE in `memory/UX_PLAN_STATUS.md`; E7 lists items already on the backlog.

---

## 7. Status — 2026-06 (pod 671bfbd8) · all 67 items closed or dispositioned

Verified by `testing_agent` iteration_145 (backend 95% / frontend 90%, 0 pageerrors, 0 5xx) + follow-up self-tests (screenshots at 1920 and 390).

| Series | Done | Notes |
|---|---|---|
| A1–A6 | ✅ all | A1 `publicCompanyName.ts`/`brandName.ts` scrub (API + emails + titles); A2 `WalletHelp` (renders only when the brand has no wallet — intentional); A3 "Signed up as …"; A4 share-step completes on copy/QR/share; A5 `PasswordNudge`; A6 copy fixed. |
| B1–B16 | ✅ all | B3 coin-first list, B4 reserve on Continue, B5 `redirectUrl`+`onSuccess` wired, B6 "Return to {merchant}" primary, B7 `networkEta`, B12 fee-split setting (`show_fee_split_to_customers`), B13 expired ref, B14 every non-donation type → V2 (legacy stepper only via build flag), B15/B16 done. |
| C1–C9 | ✅ C2–C9 · C1 dispositioned | C2 inline checkout now at V2 parity (QR default, wallet deep-link, network warning, Detected step, fee line). **C1 (single merged component) deferred** — L-effort refactor with no remaining user-visible gap; tracked in ROADMAP. C7: 45 missing `landing.creator.*`/`shop.*`/`checkout.*` keys added to all 6 locales (`scripts/i18n/add_creator_store_keys.py`), `creator.share` string/namespace clash fixed (`creator.shareLabel`), CreatorShopSection localized. |
| D1–D11 | ✅ all | D1 floor on grid + product page (`product-detail-min-order`, Number-coerced price) + cart; D2 order CTA + auto-redirect; D3 `ProductCoverFallback` (also cart line items); D4 branded checkout + VAT behind toggle; D5 markdown; D6 Buy now → checkout; D7 visitor empty state + noindex; D8 toolbar; D9 gallery; D10 physical-goods label/hint now says no shipping address is collected; D11 locale formatter on cart. Also fixed store pages rendering under the fixed home header on phones (shop/product/cart/checkout/order `pt`). |
| E1–E7 | ✅ E1–E6 · E7 backlog | E1 Advanced-options accordion + **Duplicate** action (`paylink-detail-duplicate` → `/create-pay-link?duplicate=<id>` prefill); E2 `FailedConversionsCard` + conversion emails; E3 "Payouts & settlements"; E4/E5 landing copy; E6 Direct Pay behind toggle. |
| F1–F3 | ✅ all | F1 receipt respects fee-split setting; F2 tx hash + explorer link; F3 buyer email on grace-window expiry (`sendBuyerPaymentExpiredEmail`, 6 locales, wired in `paymentController` incomplete_expired path — leader-only cron, render-verified with DISABLE_OUTBOUND_EMAIL). |
