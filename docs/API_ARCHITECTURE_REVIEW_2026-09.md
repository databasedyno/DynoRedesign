# DynoPay API Architecture Review — September 2026

**Scope.** The merchant-facing HTTP API (`/api/*` = `/api/v1/*`), outbound merchant webhooks, the
OpenAPI description served at `/api/docs.json`, developer tooling (test keys, sandbox, embed/Elements
SDKs). Internal dashboard/admin endpoints are out of scope except where they leak into the merchant spec.

**Method.** Static read of `backend/routes`, `backend/middleware`, `backend/webhooks`, `backend/swagger`,
a programmatic audit of the live spec (`https://dynopay.com/api/docs.json`, OpenAPI 3.0.0, 65 paths /
68 operations), and a side-by-side with the patterns used by Stripe, Coinbase Commerce (incl. the 2026
Coinbase Business Checkout migration), BitPay and NOWPayments, plus the OpenAPI 3.1 → 3.2 standard.

**Verdict in one line.** The *plumbing* is better than most crypto gateways (Redis sliding-window rate
limits with standard headers, HMAC-verified provider webhooks, inbound idempotency journal, DLQ +
circuit-breaker on outbound webhooks, live/test key prefixes, sandbox restrictions, SSE stream, a
merchant/internal spec split). The *contract* is where DynoPay lags: RPC-style verb endpoints, no
resource objects returned on create, no `Idempotency-Key`, no machine-readable error codes, cosmetic
versioning, a non-standard webhook signature that cannot be verified against raw bytes, a 7-second
retry horizon, and an OpenAPI 3.0.0 document that is 91 % missing `operationId`s — which is what blocks
SDK generation. None of this needs a rewrite; everything below is additive and can ship behind the
existing surface.

---

## 1. Scorecard

| Area | Today | Industry bar (Stripe / Coinbase / BitPay / NOWPayments) | Grade |
|---|---|---|---|
| Resource model | RPC verbs: `POST /user/createPayment`, `GET /user/getPaymentStatus/:id`, `POST /pay/createPaymentLink` … (27 verb-noun paths) | Nouns + HTTP verbs: `POST /charges`, `GET /charges/{id}`, `POST /invoices` | C |
| Create → object | `createPayment` returns `{ redirect_url, fee_payer, available_currencies, webhook_url:"configured" }` — the payment **id is only inside the URL** (`merchantApiRouter.ts:520-531`) | Returns the full object: `id`, `status`, `hosted_url`, `expires_at`, `pricing`, `metadata`, `created_at` | D |
| Idempotency (merchant → DynoPay) | None on any merchant POST. Only *inbound* provider events are journaled (`services/idempotency/inboundEventService.ts`) | `Idempotency-Key` (Stripe, Coinbase Business `X-Idempotency-Key`) with 24 h replay of the original response | D |
| Errors | `{ success:false, message, statusCode }` (`helper/errorResponseHelper.ts`); a single machine code exists (`sandbox_restriction`) | `{ error: { type, code, message, param, doc_url, request_id } }`, stable `code` catalogue | C- |
| Versioning | `/api` and `/api/v1` mount the **same router** (`server.ts:351-352`); no header pinning, no `Deprecation`/`Sunset` | Date-pinned header (`Stripe-Version`, `X-CC-Version`), per-account default, documented changelog, deprecation headers | C |
| Pagination | Ad-hoc `page`/`limit` (40 sites), zero cursor endpoints | Cursor: `starting_after` / `limit` / `has_more` (Stripe, Coinbase) or `pageToken` (Coinbase Business) | C- |
| Auth & keys | `x-api-key` with `dpk_live_`/`dpk_test_` prefixes ✔, optional customer Bearer JWT, publishable keys for embed ✔. Key is an encrypted blob **stored and matched in plaintext** (`legacyApiAuthMiddleware.ts:57-100`); `permissions[]` stored but enforcement not visible in the merchant router | Keys hashed at rest, only prefix + last-4 shown, restricted keys with enforced scopes, key rotation with overlap window | C+ |
| Rate limiting | Redis sliding window, `X-RateLimit-*` + `Retry-After` ✔, per-key DB limit ✔. ⚠ Dormant `apiKeyRateLimiter` trusts a **client-sent `x-rate-limit` header** (`rateLimitMiddleware.ts:138`) — must never be mounted as-is | Same headers; limits never client-controlled | B (A once the dormant limiter is removed) |
| Webhook signature | `X-DynoPay-Signature = HMAC-SHA256(JSON.stringify({…body, timestamp}))` — signed over a **re-serialised object that differs from the body sent** (`webhooks/index.ts:330-350`); falls back to a hard-coded default secret when none configured (`webhooks/index.ts:34`) | Sign `timestamp + "." + rawBody` (`Stripe-Signature: t=…,v1=…`) or raw body (`X-CC-Webhook-Signature`); per-endpoint secret always required; replay window ±5 min | D+ |
| Webhook retries | 3 attempts, 1 s / 2 s / 4 s, then DLQ (`utils/webhookRetry.ts:28-33`); auto-disable after 3 failures in 24 h; history + stats endpoints ✔; no merchant-facing **resend** or **events list** | Retry for up to 72 h with exponential backoff; `GET /events` + resend from dashboard/API; thin vs snapshot payloads | C |
| Event catalogue | 6 always-on + 3 opt-in `payment.*` events ✔; no `payment_link.*`, `refund.*`, `conversion.*`, `payout.*` events | Full lifecycle events per resource | B- |
| Test mode / sandbox | `dpk_test_` restrictions ✔, `/api/public/sandbox` ✔, `webhook.test` ✔, guarded `__paytest` hook ✔ | Separate sandbox host (NOWPayments) or test-mode keys (Stripe) ✔ | B+ |
| Validation | Joi `validateRequest` exists but is wired on **6** routes; the merchant router hand-rolls checks | Every operation schema-validated; the same schema feeds the OpenAPI document | C |
| OpenAPI document | 3.0.0; **62/68 ops lack `operationId`**, 34 lack response examples, 11 lack any 4xx/5xx, no top-level `webhooks`, emoji in tags, `servers` from env | 3.1+ (JSON Schema 2020-12), 100 % `operationId`, lint-clean, `webhooks` object, published + versioned, drives SDKs | C |
| SDKs / DX | cURL/Node/Python snippets, `embed.js` + Elements browser SDK ✔, `DEVELOPER_INTEGRATION_GUIDE.md` ✔; **no server SDKs**, no Postman collection, no changelog | Generated SDKs (TS, Python, PHP, Go…), Postman, changelog, status page | C |
| Real-time | `GET /api/events/stream` (SSE) ✔ | Rare among crypto gateways — differentiator | A |

---

## 2. As-is architecture (facts, with evidence)

### 2.1 Surface map (merchant spec, 65 paths)
* **Direct API** (`routes/merchantApiRouter.ts`, mounted at `/api/user`): `createUser`, `cryptoPayment`,
  `createPayment`, `embed/session`, `addFunds`, `useWallet`, `getBalance`, `getTransactions`,
  `getSingleTransaction/:id`, `getCryptoTransaction/:address`, `getPaymentStatus/:payment_id`,
  `getSupportedCurrency`; customer credits at `/api/user/customers/{id}/credit|debit`.
* **Payment links** (`/api/pay/createPaymentLink`, `getPaymentLinks`, `links/{id}`, `deletePaymentLink/{id}`,
  `fee-preview`, `calculateFees`, `configured-currencies`).
* **API-key management** (`/api/userApi/*` — 19 operations: `addApi`, `getApi`, `regenerateKey`, `revoke`,
  `rateLimit`, `usage`, `logs`, plans, customers).
* **Webhooks** (`/api/company/webhook-settings|test|history|stats/{id}`, `/api/webhooks`,
  `/api/webhooks/fields`, `/api/webhooks/integration-guide`).
* **Embedded checkout / Elements** (`/api/embed/public/elements/*`, publishable-key auth).
* **Invoices, auto-convert, transactions export, status, SSE stream.**

### 2.2 Cross-cutting behaviour
* **Envelope**: success `{ success:true, message, data }` via `sendSuccess`; error
  `{ success:false, message, statusCode }` via `errorResponseHelper`. `message` is human prose and is
  the only discriminator a client has (e.g. `"Amount must be greater than or equal to 5"`).
* **Auth**: `legacyApiAuthMiddleware` decrypts the key (symmetric `API_SECRET`), extracts
  `company_id`/`adm_id`, then `SELECT … FROM tbl_api WHERE "apiKey"=$3 AND status='active'`. Sandbox
  restrictions are enforced for `dpk_test_`. A customer JWT in `Authorization` switches to the
  customer-scoped flow.
* **Versioning**: `app.use("/api", router); app.use("/api/v1", router);` — one implementation, two
  prefixes. There is no mechanism to change behaviour per version.
* **Outbound webhooks** (`webhooks/index.ts`): headers `X-DynoPay-Event`, `X-DynoPay-Timestamp`,
  `X-DynoPay-Webhook-Id`, `X-DynoPay-Type`, `X-DynoPay-Signature`; body = `{...event, webhook_id,
  sent_at, created_at}`; signature computed over `{...body, timestamp}` (a *different* JSON string than
  the one on the wire, so it can only be verified by re-parsing, re-adding `timestamp`, and hoping key
  order and number formatting match); 20 s delivery timeout; safe-redirect follow; DLQ; per-URL 404
  auto-disable (Redis, 24 h) and per-company circuit breaker (3 hits / 24 h) with owner e-mail.
* **Idempotency**: inbound Tatum/provider events are journaled (`inboundEventModel`,
  `paymentJournalModel`); referral payouts accept `idempotency_key`. Merchant POSTs do not.
* **Rate limiting**: `createRateLimiter` (Redis ZSET sliding window) with `X-RateLimit-Limit/Remaining/Reset`
  and `Retry-After` on 429. Per-key limits editable via `PUT /api/userApi/rateLimit/{id}`.

### 2.3 What is already strong (keep)
Live/test key prefixes; sandbox restrictions; merchant vs internal spec split (`swagger/specSplit.ts`);
webhook history/stats/test endpoints; DLQ + circuit breaker; timing-safe HMAC compare; provider-webhook
HMAC + IP allow-list; SSE stream; `X-RateLimit-*` headers; Elements/embed publishable-key model;
`INTERNAL_API_URL` loopback for SSR self-calls.

---

## 3. Reference bar — what the comparators actually do

| Concern | Stripe | Coinbase Commerce → Coinbase Business (2026) | BitPay | NOWPayments |
|---|---|---|---|---|
| Resource | `/v1/payment_intents`, `/v1/checkout/sessions` | `/charges` (id, code, hosted_url, pricing, timeline, expires_at, metadata) → `/checkouts` | `/invoices` (id, url, status, expirationTime, …) | `/v1/payment`, `/v1/invoice`, `/v1/payment/{id}` |
| Auth | `Authorization: Bearer sk_live_…` / restricted `rk_` keys | `X-CC-Api-Key` | ECDSA-signed requests (`x-identity`, `x-signature`) for merchant facade | `x-api-key` |
| Versioning | `Stripe-Version: 2026-xx-xx` date header + account default | `X-CC-Version: 2018-03-22` | `x-accept-version: 2.0.0` | path `/v1` |
| Idempotency | `Idempotency-Key` on every POST, 24 h replay | `X-Idempotency-Key` (Business Checkout) | — | — |
| Pagination | `limit` + `starting_after`/`ending_before`, `has_more` | `starting_after` cursor → `pageSize`/`pageToken` | offset/date filters | offset `limit`/`page` |
| Errors | `error.type/code/message/param/doc_url` + `Request-Id` header | `error.type/message` | `error` + facade-specific codes | `code/message` |
| Webhook signature | `Stripe-Signature: t=…,v1=HMAC(t + "." + rawBody)`, 5-min tolerance | `X-CC-Webhook-Signature = HMAC-SHA256(rawBody)`; v1 webhooks deprecated 2026-01-26 → v2 (adds `transaction_hash`, `network`, `block_number`) | IPNs **unsigned** → refetch invoice | `x-nowpayments-sig = HMAC-SHA512(JSON of key-sorted body)` |
| Retries | up to 72 h exponential, `/v1/events` list, resend from dashboard; thin + snapshot events | days-long retries, `/events` list | retries + refetch | retries |
| Test mode | `sk_test_` keys, same host | sandbox merchant | `test.bitpay.com` host | `api-sandbox.nowpayments.io` host |
| Spec / SDKs | Public OpenAPI (3.0 + `x-stripe*`), SDKs in 8 languages generated from it | OpenAPI + AsyncAPI published by community | SDKs (Node, PHP, Java, Python…) | Postman + SDKs |

Take-aways that matter for DynoPay: (1) every comparator returns a **first-class object with an `id`**
on create; (2) the two most respected APIs (Stripe, Coinbase) sign **raw bytes** and give merchants an
**events list** for reconciliation; (3) idempotency keys are now table-stakes even in crypto
(Coinbase Business added `X-Idempotency-Key` in its 2026 migration); (4) versioning is a *header*,
not a path alias.

---

## 4. OpenAPI standard gap (3.0.0 → 3.1 / 3.2)

The standard moved twice since this spec was written: **3.1** (JSON Schema 2020-12 alignment) and
**3.2.0 (released 2025-09-19, backward compatible with 3.1)**; Arazzo 1.1 (May 2026) and the Overlay spec
are companions.

| Item | Why it matters for DynoPay | Change |
|---|---|---|
| `openapi: "3.0.0"` | Tooling (Redocly, Speakeasy, Fern, Stainless, openapi-generator) targets 3.1 schemas; 3.0 `nullable`/`example` idioms are deprecated | Bump to `3.1.0` (or `3.2.0`); convert `nullable: true` → `type: ["string","null"]`, `example` → `examples`, `exclusiveMinimum: true` → numeric |
| No top-level `webhooks` object | Outbound webhooks are documented as **prose in `info.description`** + a "Webhooks" tag. 3.1 lets you describe every `payment.*` payload as a real operation with schemas & examples — generators then emit typed event handlers | Add `webhooks: { "payment.confirmed": { post: { requestBody: … } } … }` |
| 62 of 68 operations lack `operationId` | SDK generators refuse or emit `getApiPayCreatePaymentLinkPost`-style names | Add stable ids (`payments.create`, `payments.retrieve`, `paymentLinks.list` …) |
| 34 ops without response examples, 11 without any 4xx/5xx | Docs are the product for developers; error shapes are unguessable | Add `examples` and a shared `components.responses.Error` |
| `servers` comes from env (preview URL in the pod) | Consumers of `/api/docs.json` copy the wrong host; no sandbox host listed | Static `servers: [{ url: "https://dynopay.com" }]` (+ sandbox once it exists), or 3.2 `$self` |
| Tags: `"Webhooks"` **and** `"📡 Webhooks"`, `"Direct API - Merchant Integration"` | Duplicate/emoji tags fragment navigation and SDK module names | Normalise; with 3.2 use hierarchical `parent`/`kind` tags |
| `info.version: "1.0.0"` never changes | No way to tell which contract a consumer generated against | Version the *document* (semver or date) independently of the API version header |
| No spec lint in CI | Drift returns immediately | `npx @redocly/cli lint` in `preflight.yml` (recommended ruleset + `operation-operationId`, `no-unused-components`) |
| Merchant/internal split by custom code (`specSplit.ts`) | Works, but is bespoke | Optional: express the split as an **Overlay** document |
| No workflow description | "create payment → poll `getPaymentStatus` → receive `payment.settled`" is only prose | Optional: one **Arazzo** workflow file; some doc tools render it as a guided flow |

Feasibility: `swagger-jsdoc` passes the `openapi` string through and `swagger-ui-express` (Swagger UI 5)
renders 3.1 natively, so the bump itself is a one-line change plus the schema idiom conversions.

---

## 5. Gap analysis by theme

Severity: **P0** = risk to money/integrations today · **P1** = blocks growth/DX · **P2** = polish.

### 5.1 Webhooks (P0)
1. **Signature is not verifiable from raw bytes.** `signaturePayload = { ...webhookPayload, timestamp }`
   is stringified for the HMAC while the wire body is `JSON.stringify(webhookPayload)`. Merchants must
   re-serialise an object with an extra field in the same key order — brittle across languages and
   silently broken by any JSON library that re-orders keys or formats numbers differently. This is the
   number-one reason integrations "can't verify signatures" and end up disabling verification.
   *Fix:* dual-sign for one release: keep the legacy header and add
   `X-Dynopay-Signature-V2: t=<unix>,v1=<hex HMAC-SHA256(secret, t + "." + rawBody)>`; document a
   ±300 s tolerance; publish verify snippets (Node/Python/PHP/Go). After a deprecation window, drop v1.
2. **Default shared secret fallback** (`'dynopay-webhook-default-v1'` when `DYNOPAY_WEBHOOK_SECRET` is
   unset and the merchant has none). A signature under a shared/guessable secret is worse than none
   because it *looks* verified. *Fix:* auto-generate a per-endpoint `whsec_…` at webhook-URL save time,
   show once, allow rotation with a 24 h overlap; refuse to send signed-by-default.
3. **7-second retry horizon** (1 s / 2 s / 4 s → DLQ). A merchant deploy or a 2-minute outage loses
   events. *Fix:* schedule 1 m, 5 m, 30 m, 2 h, 6 h, 12 h, 24 h (BullMQ delayed jobs already exist);
   keep the circuit breaker but base it on *consecutive days*, not 3 hits.
4. **No reconciliation path**: no `GET /events` (paged, filterable by type/created), no
   `POST /webhook-history/{logId}/resend`. Merchants who miss a webhook have to poll
   `getPaymentStatus` per payment. *Fix:* add both; they reuse the existing `webhook_logs` table.
5. **Event catalogue gaps**: no `payment_link.paid`, `refund.*`, `conversion.completed|failed`,
   `payout.sent`, `invoice.paid`. Opt-in mechanism already exists — extend the list.

### 5.2 Idempotency & safety of writes (P0)
`POST /user/createPayment`, `/user/cryptoPayment`, `/pay/createPaymentLink`, `/user/customers/{id}/credit|debit`
are all non-idempotent. A client retry after a network timeout creates a second payment (and a second
reserved pool address) or double-credits a customer wallet. *Fix:* accept `Idempotency-Key` (UUID) on
all merchant POSTs; Redis `idem:{keyFingerprint}:{Idempotency-Key}` → stored status+body for 24 h;
same key + different body → `409 idempotency_key_reused`. ~150 lines as a middleware; zero behaviour
change for callers who don't send the header.

### 5.3 Contract shape (P1)
1. **Create returns no object.** `createPayment` → `{ redirect_url, … }`; the id must be parsed out of
   `?d=`. `getPaymentStatus` then returns a different shape (`payment_status`, `status`, `auto_convert…`).
   *Fix (additive):* return a `payment` object alongside the existing fields:
   `{ id, object:"payment", status, hosted_url, amount, currency, crypto:{…}, expires_at, metadata, created_at, redirect_url, … }`
   and use the *same* object from `getPaymentStatus`. Publish the status state machine
   (`waiting → pending → confirmed → processing → settled | underpaid | expired | failed | refunded`) as
   an enum in the spec — it already exists in code (`merchantApiRouter.ts:1150`).
2. **Errors have no `code`.** *Fix (additive):* keep `success/message/statusCode`, add
   `error: { type: "invalid_request_error"|"authentication_error"|"rate_limit_error"|"api_error",
   code: "amount_below_minimum", param: "amount", doc_url }` and a `Request-Id` response header (log it).
   Start with the ~20 messages in the merchant router; the Joi validator can emit `code` automatically.
3. **Pagination.** Add `limit` + `starting_after` + `has_more` to `getTransactions`, `getPaymentLinks`,
   the future `/events`, and `webhook-history`. Keep `page` working for a deprecation period.
4. **Money representation.** Fiat amounts travel as JSON numbers; crypto amounts as decimals. Document
   precision explicitly and consider strings for crypto amounts (Coinbase/BitPay do) to avoid float
   drift in dynamically-typed clients.
5. **Validation coverage.** Route every merchant operation through `validateRequest` (Joi) and generate
   the OpenAPI request schemas from those Joi schemas (`joi-to-json`) so docs cannot drift from code.

### 5.4 Versioning (P1)
`/api/v1` is an alias, so a breaking change today breaks *everyone*. Introduce
`Dynopay-Version: 2026-10-01` (date-pinned, per-key default stored in `tbl_api`, header overrides),
gate the first behavioural change behind it (e.g. the new error envelope or the `payment` object as
the *top-level* response), and send `Deprecation: true` + `Sunset: <RFC 1123 date>` +
`Link: <…>; rel="successor-version"` on legacy RPC endpoints once resource routes exist.

### 5.5 Resource-oriented v2 surface (P1, additive)
Alias the existing handlers under nouns — no logic duplication:

| Legacy (keep) | Resource route (new) |
|---|---|
| `POST /user/createPayment`, `POST /user/cryptoPayment` | `POST /v2/payments` (`type: hosted \| direct`) |
| `GET /user/getPaymentStatus/{id}`, `getSingleTransaction/{id}` | `GET /v2/payments/{id}` |
| `GET /user/getTransactions` | `GET /v2/payments?status=&created[gte]=&limit=&starting_after=` |
| `POST /pay/createPaymentLink`, `GET /pay/getPaymentLinks`, `GET/PUT /pay/links/{id}`, `DELETE /pay/deletePaymentLink/{id}` | `POST/GET /v2/payment_links`, `GET/PATCH/DELETE /v2/payment_links/{id}` |
| `POST /user/createUser`, customers credit/debit | `POST/GET /v2/customers`, `POST /v2/customers/{id}/balance_transactions` |
| `/company/webhook-settings/{id}` | `POST/GET /v2/webhook_endpoints`, `GET /v2/events`, `POST /v2/events/{id}/resend` |
| `GET /user/getSupportedCurrency`, `/pay/fee-preview` | `GET /v2/currencies`, `GET /v2/fees/preview` |

### 5.6 Keys & scopes (P1)
* Store `sha256(key)` (+ `dpk_live_ab12…wxyz` display form); look up by hash. Today the full key sits in
  `tbl_api."apiKey"` and is matched by equality — a DB read leak = live credentials.
* Enforce the stored `permissions[]` (`payments`, `transactions`, `webhooks`, `wallets`) in the merchant
  router (403 `insufficient_scope`); add read-only keys.
* Delete or fix the dormant `apiKeyRateLimiter` (`x-rate-limit` request header must never set the limit).

### 5.7 Developer experience (P2 → becomes P1 once the spec is clean)
* Generate SDKs (TypeScript, Python, PHP first — the languages on the landing page) from the 3.1 spec
  with Speakeasy/Fern/openapi-generator; publish a Postman collection from the same file.
* API changelog page + `Dynopay-Version` table; sandbox host or clearly documented `dpk_test_` semantics
  per endpoint; webhook local-testing guide (`webhook.test` + tunnel).
* Fold `DEVELOPER_INTEGRATION_GUIDE.md` sections into `x-codeSamples` on operations so Swagger/Redoc
  show real snippets next to each call.

---

## 6. Prioritised roadmap

| Phase | Scope | Compat | Effort | Outcome |
|---|---|---|---|---|
| **0 — Spec hygiene** | Bump to OpenAPI 3.1; `operationId` on all 68 ops; shared `Error` response; examples; static `servers`; tag cleanup; add `webhooks` object for the 9 events; Redocly lint in `preflight.yml` | Non-breaking (doc only) | 2–3 days | SDK-generatable spec; lint stops drift |
| **1 — Reliability** | `Idempotency-Key` middleware on merchant POSTs; `Request-Id` header; `error.code` catalogue (additive); webhook signature v2 (dual-signed) + per-endpoint `whsec_` + remove default secret; 24 h retry schedule; `GET /events` + resend; `payment` object in create/status responses (additive) | Additive | 1–2 weeks | Retries are safe, webhooks verifiable in any language, reconciliation possible |
| **2 — Contract v2** | `Dynopay-Version` header with per-key default; resource routes (§5.5) aliasing existing handlers; cursor pagination; `Deprecation`/`Sunset` on RPC routes; hashed key storage; scope enforcement; remove dormant client-controlled limiter | Additive + announced deprecations | 3–5 weeks | Stripe-grade contract without a rewrite |
| **3 — Ecosystem** | Generated SDKs (TS/Python/PHP), Postman, changelog page, Arazzo flow for the checkout lifecycle, optional Overlay for the merchant/internal split, richer event catalogue (`refund.*`, `conversion.*`, `payout.*`) | Additive | 2–3 weeks | Developer onboarding measured in minutes |

Suggested first PR (Phase 0 + the two smallest P0 items): spec bump + `operationId`s + Redocly lint,
`Idempotency-Key` middleware, and webhook signature v2 dual-signing. All three are invisible to
existing integrations.

---

## 7. Decisions needed from the owner
1. **Version header name & first pinned date** (`Dynopay-Version: 2026-10-01`?) and whether per-key
   defaults live in `tbl_api` (recommended) or `tbl_company`.
2. **Signature v2 deprecation window** for the legacy `X-DynoPay-Signature` (suggest 90 days after the
   dashboard shows "verify with v2" to every merchant with a webhook URL).
3. **Crypto amounts as strings** in new responses (recommended) vs numbers (status quo).
4. **Sandbox strategy**: keep `dpk_test_` on the production host (status quo) or add
   `sandbox.dynopay.com` (NOWPayments/BitPay model). Test keys on one host is cheaper and Stripe-like.
5. **OpenAPI 3.1 vs 3.2**: 3.1 has the broadest tooling today; 3.2 adds `$self`, hierarchical tags and
   structured examples but some generators still lag. Recommendation: 3.1 now, 3.2 when Speakeasy/Fern
   confirm support.

*Prepared 2026-09-12 from the working tree at commit `41e1064f9` and the live spec at
`https://dynopay.com/api/docs.json`. No code was changed for this review.*
