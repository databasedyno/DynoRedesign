# INLINE TIP CHECKOUT — SPEC

**Author:** main_agent · **Created:** 2026-07-13 (Session 42 setup)
**Status:** implementation started
**Scope:** creator page `/{handle}` Support Widget only — the standard `/pay/` checkout is UNCHANGED.

---

## 1. Problem

The Support Widget (Session 40/41 — "Tip / Buy-me-a-coffee") currently REDIRECTS the donor away from the creator's brand:

```
/{handle}  →  click preset amount  →  POST /api/pay/tip  →  window.location.href = /pay?d=<child>
```

That redirect kills the creator's momentum (visitor is now on a generic checkout URL, sees a big header, breadcrumbs, footer) and adds a page-load between "I want to tip Alice" and "here's Alice's crypto address."

The user asked to keep the donor **on the creator page** and complete the whole payment inline, **including underpayment and overpayment states**.

## 2. Backend contract (UNCHANGED — reused as-is)

No new endpoints. No schema changes.

- `POST /api/pay/tip` — Session 40. Creates the contribution child + returns `{ d, payment_link, amount, currency }`. **Public, CSRF-exempt** (Session 41).
- `POST /api/pay/getData` — Session 38. Returns `{ token, amount, base_currency, available_currencies, contribution: {…}, link_type: "contribution", merchant, fee_info, expiry, … }`. Public.
- `POST /api/pay/getCurrencyRates` — Returns crypto amounts + fees. Requires the session JWT (from `getData.data.token`) as `Authorization: Bearer …`. Same as `/pay` uses.
- `POST /api/pay/encrypt-payload` — Public. Wraps the {currency, amount, paymentType} into an encrypted payload.
- `POST /api/pay/addPayment` — Reserves a merchant-pool address for the selected crypto. Returns `{ address, qr_code, memo?, hash, expires_in_minutes, remaining_minutes, redirect? }`. Requires the session JWT.
- `POST /api/pay/verifyCryptoPayment` — Polling endpoint. Body `{ address }`. Returns `{ status: "waiting" | "pending" | "confirmed" | "underpaid" | "overpaid" | "expired" | "failed", paidAmount, expectedAmount, remainingAmount, excessAmount, paidAmountUsd, expectedAmountUsd, remainingAmountUsd, excessAmountUsd, baseCurrency, currency, grace_period_minutes, remaining_seconds, merchant_settings: { overpayment_threshold_usd, grace_period_minutes }, redirect }`. Requires the session JWT.

Notice these endpoints ALREADY produce donation-flavored copy for `contribution` links (Session 38). We just have to render it inline.

## 3. Frontend deliverable

### 3.1 NEW file — `Components/Page/Creator/InlineTipCheckout.tsx`

Self-contained, ~500 lines, no dependency on `pages/pay/index.tsx` or `Components/Page/Pay3Components/cryptoTransfer.tsx`. Uses **raw `fetch`** with an explicit `Authorization: Bearer <session-token>` header so a merchant visitor's own localStorage JWT is NOT sent to the customer endpoints (which would 403 with "Customer account does not exist").

**Props:**
```ts
{
  d: string,                      // payment ref from POST /api/pay/tip
  handle: string,                 // creator handle for share URLs
  creatorName: string,            // for success card
  style: 'coffee' | 'tip' | 'support',
  siteUrl: string,                // canonical /{handle} URL for the Back CTA + share
  onNewTip: () => void,           // parent hook: reset to amount picker
  onCancel: () => void,           // parent hook: back to amount picker
}
```

**Internal finite state machine:**
```
loading_meta
  ↓ (getData success)
currency_select
  ↓ (user picks crypto)
creating_payment
  ↓ (addPayment success)
awaiting_payment  ← ─┐
  ↓ verifyCryptoPayment poll (10s)
  ├─ confirmed    → success card
  ├─ underpaid    → underpaid card (keeps polling for delta)
  ├─ overpaid     → success card (Q2b: treat as bigger tip, NO refund message)
  ├─ expired      → error card, offer "Try again" → onNewTip
  └─ failed       → error card, offer "Try again" → onNewTip
```

**Auth:** the session JWT is stored in local component state (`sessionToken`), NEVER in `localStorage`. All customer-auth endpoints receive it via an explicit `Authorization: Bearer` header.

**Polling:** 10s interval on `verifyCryptoPayment`, cleared on unmount, `confirmed`/`overpaid`/`expired`/`failed` → poll stops, `underpaid` → poll continues (backend may report `confirmed` once the delta lands).

**Overpayment (Q2b — user decision):**
```
overpaid → phase = 'confirmed'
         → success card shows the actual paid amount (which is > expected)
         → no "refund" copy anywhere
```

**Underpayment (Q1a — user decision):**
```
underpaid → phase = 'underpaid'
         → shows the SAME address (keep polling; do NOT reserve a new one)
         → "Send X more to complete your tip" — remaining crypto amount in mono
         → grace period timer from backend (default 30 min from merchant_settings)
         → continues to poll; when backend flips to confirmed → success card
```

### 3.2 CHANGED — `Components/Page/Creator/SupportWidget.tsx`

Replace the `window.location.href = /pay?d=…` redirect with:

```tsx
// on POST /api/pay/tip success → capture d + expand widget in place
setPhase('checkout')
setPaymentRef(d)
```

Render:
- `phase === 'form'`  → existing amount picker (unchanged)
- `phase === 'checkout'` → `<InlineTipCheckout d={paymentRef} … onNewTip={() => setPhase('form')} />`

Keep the "Prefer a full page? Open checkout →" escape-hatch link visible during `checkout` so users can jump to `/pay?d=<d>` if they want the bigger view.

### 3.3 UNCHANGED
- The standard `/pay/` route (used by non-tip payment links, invoices, elements SDK, etc.). Not touched.
- `CryptoTransfer.tsx`. Not touched.
- Underpayment / Overpayment / TransferExpectedCard components. Not touched (we render our own compact inline versions in InlineTipCheckout).
- Backend. Zero changes.
- i18n locale files. English-only in-component `defaultValue`s (matches the rest of the Creator surface — Session 41 note).

## 4. UX / Design

- Widget stays lime-bordered inside the same rounded card.
- Currency chips: same style as amount presets (mono monospace, lime hover).
- Address row: mono font + tap-to-copy + QR toggle button (QR expandable on click).
- Timer: mono digits, subtle secondary color.
- Underpaid card: soft warning tint (not red), same address highlighted with "Add X more".
- Success card: lime tick, donor message reveal (if present + not anonymous), share sheet (X / WhatsApp / Copy) + "Back to @{handle}" + "Send another tip".
- Dark/light aware via `useTheme()`.
- Mobile: single column, tap targets ≥ 44px.

## 5. Testability

New testids on the InlineTipCheckout:
- `inline-tip-loading`
- `inline-tip-currency-picker`
- `inline-tip-currency-<code>` (one per available crypto)
- `inline-tip-address`
- `inline-tip-copy`
- `inline-tip-qr-toggle`
- `inline-tip-status-pill`
- `inline-tip-timer`
- `inline-tip-underpaid`
- `inline-tip-underpaid-remaining`
- `inline-tip-success`
- `inline-tip-success-message` (donor message reveal)
- `inline-tip-success-share-x`
- `inline-tip-success-share-whatsapp`
- `inline-tip-success-share-copy`
- `inline-tip-success-back-btn`
- `inline-tip-success-new-tip-btn`
- `inline-tip-expired`
- `inline-tip-retry-btn`
- `inline-tip-fallback-fullpage` (the /pay?d=… escape hatch)

## 6. Verification plan (post-code)

Backend regression: NONE — no backend changes.

Frontend manual smoke-test on preview URL:
1. `/hostbay` (public, unauth)  → widget shows presets ✅ (already works)
2. Click "$5 · Buy" → widget expands, currency picker with hostbay's configured wallets ✅
3. Pick LTC → address + QR + expected LTC amount + status pill "Waiting…" ✅
4. Wait (or simulate `verifyCryptoPayment` return `underpaid` via curl) → underpaid card with remaining amount ✅
5. Simulate `confirmed` return → success card with donor message + share buttons + "Back to @hostbay" + "Send another tip" ✅
6. Cancel button anywhere → back to amount picker ✅
7. Share buttons open X/WhatsApp intents + Copy shows "Link copied!" ✅

Auto testing agents (`deep_testing_backend_v2`, `auto_frontend_testing_agent`): pending user approval per DEV_WORKFLOW.

## 7. Rollback

If anything breaks: revert `Components/Page/Creator/SupportWidget.tsx` to the old redirect behavior + delete `Components/Page/Creator/InlineTipCheckout.tsx`. Backend is untouched, LIVE DB is untouched.

---

END OF SPEC.
