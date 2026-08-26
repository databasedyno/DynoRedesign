# DynoPay — Extending the Usability Restructuring to Every Public Surface
### Buyer checkout · creator pages · store · order/receipt · auth & onboarding · landing · support — recommendation for approval

---

## Why this plan exists

The 6-move usability restructuring just shipped for the merchant app (responsive
rulebook, side-panels, one story per sale, ⌘K, mobile finish, clarity microcopy,
light default). Those moves deliberately excluded everything a **buyer, supporter,
or visitor** touches. This plan closes that gap: the same principles, translated
for public surfaces — because a checkout page has no sidebar to search and no
tables to pin, the improvements change shape, not spirit.

One rule carries over unchanged: **the checkout handles real money on the live
database — nothing in this plan touches payment logic, amounts, addresses, fees
or currency math.** Everything here is structure, clarity and touch usability.

---

## The surfaces and what each one gets

### 1. Buyer checkout (/pay) — the money moment
Already the strongest page in the product; it gets additive improvements only:
- **Open in wallet (mobile):** one tap opens the buyer's crypto wallet app with
  the address and exact amount pre-filled (standard payment URIs — bitcoin:,
  ethereum:, etc.), next to the existing QR/copy. On desktop nothing changes.
- **Plain-English status:** while waiting/confirming, one human line under the
  technical status — "We can see your payment — waiting for network
  confirmations (usually 5–15 min)" — same tooltip system merchants now have.
- **Copy honesty:** one-tap copy for amount and address separately, with a
  clear "copied" response; 44px touch targets on every control.
- **Scroll honesty:** the currency/network selector rows get the same edge-fade
  hints as in-app lists — nothing scrollable is invisible anymore.

### 2. Creator page + tip flow
- Tip presets, share controls and link rows: 44px targets, edge fades on any
  horizontal rows.
- After a supporter tips: clearer confirmation moment (what happens next, in
  plain words) — no flow changes.
- The sticky Support bar fix already shipped; this pass makes the rest match it.

### 3. Public store + cart
- **Cart becomes a side sheet** that slides over the product grid (same
  stay-in-context pattern as the merchant panels) instead of a separate page —
  buyers never lose their place browsing. Old cart URLs keep working.
- Product grid: consistent card behavior across desktop/tablet/phone, tap-sized
  quantity controls, edge fades on scrollable option rows.

### 4. Public order/receipt page (order status a buyer revisits)
- Same plain-English status lines as checkout (paid / confirming / completed /
  refunded), and a clear "what to do if something looks wrong" line with the
  merchant contact.

### 5. Auth + onboarding
- Touch pass: every input/button ≥44px on phones; OAuth buttons consistent.
- Microcopy: password rules stated before the user fails them; error messages
  say what to do next, not just what went wrong.
- Onboarding steps show progress ("Step 2 of 3") and allow going back without
  losing entered data. No step is added or removed.

### 6. Landing/marketing + Help & Support + public status page
- These were recently rebuilt, so they get a **consistency pass, not a rework**:
  tap targets, edge fades on scrollable strips, the light theme verified
  end-to-end, and naming aligned with the app (one name for the same feature
  everywhere a visitor and a merchant see it).

---

## Explicitly NOT in this plan
- No changes to payment logic, wallet addresses, amount/fee math, tax, or
  conversion — anywhere.
- No new colors, fonts, or component styling — the shipped design system stays.
- No redesign of landing/auth (recently rebuilt) — consistency only.
- Email templates and admin pages stay out of scope.
- All 6 languages preserved; every new label ships translated in all of them.

---

## Decisions needed from you

1. **Wallet deep-links on mobile checkout.** This is the one item with real
   behavior added to the money page (still zero payment-logic change — it only
   pre-fills the buyer's own wallet app).
   a. Include it (recommended — biggest buyer win on mobile)
   b. Skip it; visual/clarity improvements only on /pay
2. **Store cart as a side sheet.**
   a. Yes, slide-over cart, old URLs redirect (recommended)
   b. Keep the separate cart page, only polish it
3. **Checkout status wording.** The plain-English lines will be shown to real
   buyers immediately.
   a. Ship in all 6 languages at once (recommended)
   b. English first, other languages after you review the tone
4. **Scope.** Approve all 6 surfaces, or start with a subset? Recommended order
   if phased: checkout → store/cart → auth/onboarding → creator → order page →
   landing/support (buyer-money surfaces first).

---

## Assumptions (will proceed on these unless you object)

- The preview runs against the **live production database**: verification is
  read-only — no test payments, no real tips, no orders placed. Checkout states
  that only appear mid-payment are verified with visual/structural checks, not
  by moving money.
- Wallet deep-links use the standard open URI schemes (no third-party SDK, no
  WalletConnect, no new dependencies).
- The light theme default that already shipped applies to public pages as-is;
  this plan only verifies and fixes stragglers.
- "Same improvements" is interpreted as the principles (context, clarity,
  touch, scroll honesty) — not literally porting merchant features like ⌘K or
  bottom tabs onto public pages, which would not make sense for visitors.

---

## What you'll see when it's done

- A mobile buyer taps once and their wallet opens with everything pre-filled;
  if they prefer QR or copy, both are one honest tap with clear feedback.
- Every "what is happening with my money?" moment — checkout, tip, order
  status — answers in plain language.
- Browsing a store and managing the cart happens in one place, no page-hops.
- Sign-up and login feel finished on a phone: nothing cramped, nothing vague.
- No public surface is left behind the in-app quality bar.
