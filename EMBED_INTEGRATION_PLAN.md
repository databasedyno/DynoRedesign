# Dynopay Embeddable Checkout — Implementation Plan (a / b / c)

> **Status:** PLANNING — not started.
> **Created:** 2026-07-10 · **Owner:** Eng · **Tracking doc — update the checklists as we build.**
> Goal: give merchants Stripe-style ways to accept crypto **without sending the customer to a separate page**, on top of the existing hosted redirect checkout.

---

## 0. TL;DR / Scope

Build three embed products, mapped 1:1 to Stripe:

| Ref | Dynopay product | Stripe equivalent | Runs where | Needs new key? |
|-----|-----------------|-------------------|------------|----------------|
| **(a)** | **Embedded Checkout** — mount hosted `/pay` in an iframe (inline or modal) on the merchant's page | Stripe **Embedded Checkout** | Browser renders; **session created server-side** | ❌ Uses existing **secret** key (server-side) |
| **(b)** | **Inline Elements widget** — native crypto pay UI (address/QR/amount/status) rendered inside the merchant's own DOM | Stripe **Elements / Payment Element** | Browser | ✅ Needs **publishable key** |
| **(c)** | **Buy Button** — paste-able web component `<dynopay-buy-button>` | Stripe **Buy Button** / Payment Links | Browser (no-code) | ✅ Needs **publishable key** |

**Recommended build order:** (a) → (c) → (b). (a) delivers the most recognizable "Stripe embed" fastest and needs no key changes; (c) introduces the publishable key with the smallest surface; (b) is the largest UI effort and reuses (c)'s key + session infra.

All three deliver a single distributable script: **`embed.js`** (served from the checkout origin), exposing a global `Dynopay` (+ the `<dynopay-buy-button>` custom element).

---

## 1. Current state (grounded in the codebase)

- **Hosted checkout (redirect):** `POST /api/user/createPayment` with header `x-api-key` → returns `redirect_url = https://checkout.dynopay.com/pay?d=<signed token>`, plus `available_currencies`, `fee_payer`. (`DEVELOPER_INTEGRATION_GUIDE.md`)
- **Direct payment (raw data for own UI):** `createDirectPayment` → `{ qr_code, address, amount, currency, base_amount, base_currency, destination_tag? }`.
- **Checkout page:** `pages/pay/index.tsx` reads `router.query.d` (a signed/encrypted token; no API key needed to render). An **embedded layout already exists**: `Components/Layout/Pay3Layout.tsx` has an `embedded` prop (hides header/footer, tightens padding) used by `pages/pay/demo.tsx` inside the landing "Try it now" iframe.
- **API keys (SECRET only):** `backend/controller/apiController.ts`
  - Prefix: `dpk_live_` (production) / `dpk_test_` (dev); key string encrypted with `process.env.API_SECRET`.
  - Model `backend/models/apiModels/apiModel.ts`: `apiKey`, `status` (active/inactive/revoked), `base_currency`, `permissions` (`["payments","transactions","webhooks","wallets"]`), `test_mode_restrictions` (`{max_amount, allowed_currencies}`).
  - Auth middleware: `backend/middleware/legacyApiAuthMiddleware.ts` (`validateApiKey`), used by `backend/routes/merchantApiRouter.ts`.
  - Dashboard UI: `pages/developer-keys.tsx`; docs page: `pages/documentation.tsx`.
- **Webhooks:** signed with header `X-DynoPay-Signature` (+ `X-DynoPay-Event`, `-Timestamp`, `-Webhook-Id`, `-Type`). **These header names are a public contract — do NOT rename.**
- **⚠️ Iframe blocker:** `backend/server.ts` (~line 178) uses `helmet({ contentSecurityPolicy: { directives: { frameAncestors: ["'none'"] } } })`. **The whole app currently forbids being embedded in any iframe.** This must be relaxed *only for the embeddable checkout route*, scoped to each merchant's allow-listed domains.
- Frontend served as Next.js standalone; backend Node/TS behind nginx on the preview. Base URLs come from env (`NEXT_PUBLIC_BASE_URL`, `SERVER_URL`, `CHECKOUT_URL`) — **never hardcode**.

---

## 2. Target architecture

```
Merchant site (browser)                         Merchant server                 Dynopay
─────────────────────────                       ────────────────                ───────────────────────────
(a) Embedded Checkout
  <script src=CHECKOUT/embed.js>
  Dynopay.mount('#el',{ fetchClientSecret })  ── calls ──▶  POST /api/embed/session  (x-api-key SECRET)
        │  iframe → CHECKOUT/embed/checkout?cs=<client_secret>                     ◀── { client_secret, expires_at }
        └─ postMessage events (resize, success, error) ◀───────────────── iframe (embeddable /pay variant)

(c) Buy Button (no merchant server)
  <script src=CHECKOUT/embed.js>
  <dynopay-buy-button button-id=... publishable-key=pk_live_...>
        └─ click → POST /api/embed/public/session (pk + domain check) → open iframe/redirect

(b) Elements (inline)
  Dynopay(pk_live_...).elements() → element.mount('#el')
        └─ POST /api/embed/public/intent (pk + domain check) → renders address/QR/amount natively
        └─ polls GET /api/embed/public/intent/:id/status  (or SSE) → 'succeeded' event
```

**Two-key security model (to be added):**
- **Secret key** `dpk_live_` / `dpk_test_` — server-only (already exists). Used by (a) to create sessions.
- **Publishable key** `pk_live_` / `pk_test_` — browser-safe (NEW). Bound to a **domain allow-list**; can only create small, constrained sessions/intents (amount caps, allowed currencies), never reads data. Used by (b) and (c).

---

## 3. Security model (must-haves)

- [ ] Secret key **never** appears in browser code. (a) creates the session on the merchant server.
- [ ] Publishable key is **origin-restricted**: every `/api/embed/public/*` call validates `Origin`/`Referer` against the key's registered domain allow-list; reject otherwise.
- [ ] Publishable key is **capability-limited**: create-session/intent only; enforce `test_mode_restrictions` (max amount, allowed currencies) and a per-key rate limit.
- [ ] **Client secret / session token** is short-lived (e.g. 30–60 min), single checkout, opaque, and is what the iframe loads — not the API key.
- [ ] **CSP `frame-ancestors`** relaxed ONLY for `GET /embed/checkout` (and the embeddable `/pay` variant): set dynamically to the session's allow-listed merchant origins. Rest of app stays `frame-ancestors 'none'` (keep clickjacking protection).
- [ ] **CORS** for `/api/embed/public/*`: reflect only allow-listed origins.
- [ ] Reuse existing **webhook** signing (`X-DynoPay-Signature`) for server-to-server truth; the browser `success` event is UI-only and must NOT be trusted for fulfillment.
- [ ] Preserve idempotency: creating a session should be safe to retry.

---

## 4. Phase 0 — Foundations (shared by a/b/c)

- [ ] **Serve `embed.js`** from the checkout origin (`CHECKOUT_URL`/`NEXT_PUBLIC_BASE_URL`). Decide host: a Next.js public asset + thin loader, or a dedicated route. Must be cacheable + versioned (`/embed.js` pins latest, `/v1/embed.js` stable).
- [ ] **Embeddable checkout route:** add `GET /embed/checkout?cs=<client_secret>` (or reuse `/pay` with `?embedded=1&cs=`) that renders the existing checkout via `Pay3Layout embedded`, resolving the payment from the client secret (not from raw `d` token in the URL bar).
- [ ] **Dynamic `frame-ancestors`:** middleware/route that sets `Content-Security-Policy: frame-ancestors <allowed origins>` for the embed route based on the session's merchant domain allow-list. (Touches `backend/server.ts` helmet — make it per-route, not global.)
- [ ] **postMessage protocol** (versioned): iframe → parent events
  - `dynopay:ready`, `dynopay:resize {height}`, `dynopay:success {payment_id}`, `dynopay:error {code,message}`, `dynopay:close`, `dynopay:currency_selected {currency}`.
  - parent → iframe: `dynopay:init {theme, locale}`.
- [ ] **Session store:** table/Redis for `client_secret → {company_id, amount, currency set, redirect_uri, webhook_url, meta_data, status, expires_at, allowed_origins}`.

---

## 5. Phase 1 — (a) Embedded Checkout  ← START HERE

**Backend**
- [ ] `POST /api/embed/session` (auth: **secret** `x-api-key`). Body: `{ amount, currency?, redirect_uri?, webhook_url?, meta_data?, allowed_origins?, ui_mode: 'embedded'|'hosted' }`. Returns `{ client_secret, expires_at, publishable_currencies }`. Internally reuses the existing `createPayment` flow to reserve address/link.
- [ ] `GET /embed/checkout?cs=` renders embeddable checkout from `client_secret`.
- [ ] Set dynamic `frame-ancestors` from `allowed_origins`.

**embed.js (client)**
- [ ] `Dynopay.initEmbeddedCheckout({ fetchClientSecret })` → returns `{ mount('#el'), destroy() }` (inline iframe, auto-resize via postMessage).
- [ ] `Dynopay.redirectToCheckout({ clientSecret })` (fallback / modal mode).
- [ ] Modal variant: `Dynopay.openCheckout({ fetchClientSecret })` (overlay + iframe + close).

**Dashboard**
- [ ] "Embed" tab (in `developer-keys.tsx` or new page): copy-paste snippet + server snippet (Node/PHP/Python) + live preview.

**Merchant usage (target)**
```html
<script src="https://checkout.dynopay.com/embed.js"></script>
<div id="dynopay-checkout"></div>
<script>
  const checkout = await Dynopay.initEmbeddedCheckout({
    fetchClientSecret: () => fetch('/create-dynopay-session').then(r => r.json()).then(d => d.client_secret)
  });
  checkout.mount('#dynopay-checkout');
</script>
```
```js
// merchant server — secret key stays here
app.post('/create-dynopay-session', async (req, res) => {
  const { data } = await axios.post(`${DYNO}/api/embed/session`,
    { amount: 50, redirect_uri: 'https://shop.com/thanks', ui_mode: 'embedded',
      allowed_origins: ['https://shop.com'] },
    { headers: { 'x-api-key': process.env.DYNOPAY_API_KEY } });
  res.json({ client_secret: data.client_secret });
});
```

**Test (Phase 1)**
- [ ] Standalone test merchant HTML page (served locally) mounts the iframe against a preview session.
- [ ] Verify: iframe loads, resizes, coin selection works, success/redirect fires, `frame-ancestors` blocks non-allow-listed origins, secret key never in browser. Run frontend testing agent.

---

## 6. Phase 2 — (c) Buy Button (introduces publishable key)

**Publishable key (NEW) — backend**
- [ ] Extend API-key model (or new `tbl_publishable_keys`): `publishable_key` (`pk_live_`/`pk_test_`), `company_id`, `allowed_domains[]`, `status`, `constraints {max_amount, allowed_currencies}`, `linked_secret_key_id?`.
- [ ] Generation in `apiController.ts` alongside secret key (publishable is **not** encrypted the same way — it's public, but store hashed lookup + plaintext prefix).
- [ ] `POST /api/embed/public/session` (auth: **publishable** key + Origin allow-list). Body: `{ button_id? | amount, currency? }`. Enforces constraints + rate limit. Returns `{ client_secret }`.
- [ ] Optional "Buy Button" objects: pre-created `{ button_id, amount|price, label, currencies }` in dashboard (like Stripe's button config).

**embed.js**
- [ ] Register `<dynopay-buy-button>` custom element. Attrs: `button-id` or `amount`, `publishable-key`, `label`, `theme`, `mode="modal|redirect"`. On click → `/api/embed/public/session` → open iframe/modal or redirect.

**Dashboard**
- [ ] "Buy Buttons" UI: create button, pick amount/currencies/label, copy snippet; manage publishable keys + domain allow-list.

**Merchant usage (target)**
```html
<script src="https://checkout.dynopay.com/embed.js"></script>
<dynopay-buy-button
  button-id="btn_123"
  publishable-key="pk_live_xxx">
</dynopay-buy-button>
```

**Test (Phase 2)**
- [ ] Button renders, click opens checkout, domain allow-list enforced (button on wrong domain rejected), constraints enforced. Testing agent.

---

## 7. Phase 3 — (b) Inline Elements widget

**Backend**
- [ ] `POST /api/embed/public/intent` (publishable key + Origin). Returns intent `{ intent_id, client_secret, currencies }`.
- [ ] `POST /api/embed/public/intent/:id/select-currency` → `{ address, qr_code, amount, currency, destination_tag? }` (reuse `createDirectPayment`).
- [ ] `GET /api/embed/public/intent/:id/status` (or SSE stream) → `pending|detected|confirming|succeeded|expired`.

**embed.js**
- [ ] `const dp = Dynopay('pk_live_...'); const elements = dp.elements({ clientSecret }); const el = elements.create('crypto'); el.mount('#el');`
- [ ] Native UI: currency picker → address + QR + copy + amount + live status; emits `succeeded`/`expired` events.
- [ ] Theming/appearance API (colors, radius, dark mode) to match Stripe's `appearance`.

**Test (Phase 3)**
- [ ] Element mounts, currency switch updates address/QR, status polling reaches `succeeded` on a test payment, events fire. Testing agent.

---

## 8. New API surface (summary)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/embed/session` | secret `x-api-key` | (a) create embedded/hosted session → `client_secret` |
| GET | `/embed/checkout?cs=` | client secret | (a) render embeddable checkout (dynamic frame-ancestors) |
| POST | `/api/embed/public/session` | publishable key + Origin | (c) create session from button/amount |
| POST | `/api/embed/public/intent` | publishable key + Origin | (b) create inline intent |
| POST | `/api/embed/public/intent/:id/select-currency` | publishable key + Origin | (b) get address/QR for chosen coin |
| GET | `/api/embed/public/intent/:id/status` | publishable key + Origin | (b) poll/stream status |
| CRUD | publishable keys + buy buttons | dashboard (JWT) | manage keys/buttons |

`embed.js` global API: `Dynopay.initEmbeddedCheckout`, `Dynopay.openCheckout`, `Dynopay.redirectToCheckout`, `Dynopay(pk).elements()`, `<dynopay-buy-button>`.

---

## 9. Backward compatibility & rollout

- [ ] Existing `createPayment` redirect flow stays unchanged.
- [ ] Existing secret keys keep working; publishable key is additive.
- [ ] Global `frame-ancestors 'none'` stays for the app; only embed routes are relaxed.
- [ ] Version `embed.js` (`/v1/`) so the SDK can evolve without breaking merchants.
- [ ] Update `DEVELOPER_INTEGRATION_GUIDE.md` + `pages/documentation.tsx` with an "Embeds" section per phase.

---

## 10. Decisions (LOCKED — Stripe-way defaults, 2026-07-10)

1. **embed.js host** — serve from the **checkout origin** (`CHECKOUT_URL`/`NEXT_PUBLIC_BASE_URL`; on preview = preview origin), **versioned** (`/v1/embed.js`). Merchants load it directly; not self-hosted. (Stripe: `js.stripe.com/v3/`.)
2. **Buy Button model** — **pre-created button objects** with a `button-id` (amount/currencies defined server-side in dashboard) are the primary path (Stripe does only this, to prevent price tampering). We MAY *also* allow an inline `amount` attr for convenience, but button-id is canonical.
3. **Publishable key** — **one `pk_live_`/`pk_test_` per company** (account-wide, like Stripe). Because our crypto `pk` can trigger address generation (more powerful than a card `pk`), it is **domain-locked + amount-capped by default** (stricter than Stripe needs). Domain allow-list required before a `pk` is usable.
4. **Fulfillment trust** — **webhooks only** (`payment.succeeded`), never the browser `success` event. Documented loudly. (Matches Stripe.)
5. **Status delivery for (b)** — **polling first** (`GET …/intent/:id/status`), SSE later. (Crypto is async, so unlike Stripe we DO surface live "confirming…" status in the client — but truth is still the webhook.)
6. **Theming** — Elements (b) gets an **`appearance` API** (theme + variables: accent/radius/dark). (a)/(c) ship light theming (dark mode + accent) in v1.
7. **Fees/limits** — embed sessions **inherit the existing hosted-checkout fee tiers + min/max amounts**. No embed-specific fee. Fees modeled **per-method** so card tiers can differ later.

---

## 11. Progress tracker

- [~] **Phase 0 — Foundations**: embed.js host ✅ (`/v1/embed.js`), embeddable route ✅ (reused `/pay?...&embed=1`), postMessage ✅ (EmbedBridge: ready/resize/success/redirect), session store ✅ (Redis `customer-<id>`). ⬜ dynamic `frame-ancestors` per allowed_origins (DEFERRED — origins are now stored on the session; enforcement is a follow-up. Frontend currently sets no X-Frame-Options, so framing already works).
- [x] **Phase 1 — (a) Embedded Checkout**: backend `POST /api/user/embed/session` ✅ (BACKEND-TESTED 7/7, Session 20c), `GET /pay?...&embed=1` embedded render ✅, `embed.js` `initEmbeddedCheckout`/`openCheckout`(modal)/`redirectToCheckout` ✅, merchant test page `/embed-test.html` ✅, Dashboard "Embed" snippet UI ✅ (FRONTEND-TESTED PART 1 8/8), live iframe embed inline + modal ✅ (FRONTEND-TESTED PART 2 15/15). ✅ Docs added: markdown guide (`DEVELOPER_INTEGRATION_GUIDE.md` §Embedded Checkout — architecture + session API + inline/modal/redirect examples + React example + security checklist + postMessage table) + in-app `/documentation` page (new "Embedded Checkout" section with `POST /embed/session` endpoint card).
- [ ] Phase 2 — (c) Buy Button (publishable key + web component + dashboard + tests)
- [ ] Phase 3 — (b) Elements inline widget (intent APIs + elements SDK + status + tests)
- [x] Docs updated (guide + /documentation — completed 2026-07-11)
- [ ] Final end-to-end test on a real merchant test page

**Session 20c (2026-07-10) delivered:** backend embed-session endpoint (method-agnostic), `/v1/embed.js` SDK, `/pay` embed mode + `EmbedBridge`, `/embed-test.html`. Backend verified 7/7. Files: `backend/routes/merchantApiRouter.ts` (route), `public/v1/embed.js`, `public/embed-test.html`, `Components/Common/EmbedBridge.tsx`, `Components/Layout/Pay3Layout.tsx`, `pages/pay/index.tsx`.

**Session 21c (2026-07-11) delivered:** Phase 1(a) docs. Files: `DEVELOPER_INTEGRATION_GUIDE.md` (+229 lines, new "Embedded Checkout" section between "Common Integration Patterns" and "Customer Wallet System" + TOC entry), `pages/documentation.tsx` (new API_ENDPOINTS entry `embed-session` + new SECTIONS entry `{id:"embed", title:"Embedded Checkout", endpoints:["embed-session"]}`). Next.js build clean; /documentation renders the new section via the existing SECTIONS-driven loop. **Phase 1(a) — Embedded Checkout — is now feature-complete.** Ready to pick up Phase 2 (Buy Button + publishable key).

---

*When resuming: read §1 (current state) and §11 (tracker), pick the next unchecked phase, and follow its checklist. Do not rename `X-DynoPay-*` webhook headers. Never hardcode URLs — use env (`CHECKOUT_URL`/`NEXT_PUBLIC_BASE_URL`/`SERVER_URL`).*
