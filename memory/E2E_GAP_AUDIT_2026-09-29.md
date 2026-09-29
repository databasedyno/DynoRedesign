# End-to-End Gap Audit — 2026-09-29 (backend + frontend)

Scope requested by owner: FE↔BE contract mismatches, money-flow logic, security/hardening,
observability/ops — **fix everything found**. Read-only against the shared PROD DB/Redis.

## Method
- `backend/scripts/dump_routes.ts` — walks the live Express router tree → 586 routes with the
  middleware chain per route (`memory/reports/routes_dump_2026-09-29.json`).
- `scripts/qa/api_contract_xref.py` — cross-references every frontend axios/fetch/SWR call
  (pages, Components, Containers, Redux, api, hooks, helpers, contexts) against that table
  (`memory/reports/api_contract_xref_2026-09-29.txt`). **Result: 0 frontend calls to a
  missing backend route, 0 HTTP-method mismatches.** Internal `<Link>`/router.push targets
  all resolve to a page (106 pages). i18n: en/es/fr/pt complete; de/nl only differ on the
  legacy legal pages (different structure, not missing copy).
- tsc BE + FE = 0 errors, eslint FE = 0, jest unit project 36 suites (713 → 728 tests incl.
  new ones) green (paymentFees.test.ts flakes only under full-suite load — pre-existing).
- Public GET fuzz (61 routes), authed merchant GET fuzz (87), admin GET fuzz (24), public
  POST garbage-body fuzz; live-droplet env inspection over SSH (read-only).
- testing_agent iteration_242 + iteration_243: backend 8/8 security guards + 13/13 validation,
  frontend merchant sweep (15 pages) + admin sweep (8 pages) + public pages clean.

## Gaps found & FIXED
| # | Sev | Area | Gap | Fix |
|---|-----|------|-----|-----|
| M1 | HIGH (cosmetic spoof) | money/checkout | `tatumCryptoWebHook` published SSE `pending` ("payment detected") on RAW receipt, before dedup/spam filter/on-chain gate — an unsigned forged webhook could flip a buyer's tab. | Publish moved into `webhookProcessor` after `gateIncomingTx` passes; also published when the gate returns `ChainVerifyRetry(status="pending")` (real tx seen in mempool). `chainTxVerifier`: EVM-native recipient+amount checked BEFORE the mined gate so `pending` means "real tx paying us"; `ChainVerifyRetry` now carries `.status`. Tests added. |
| M2 | HIGH (funds) | refunds | Prod runs `ENABLE_CRYPTO_REFUNDS=true` + `REFUND_DRY_RUN=false`, but Phase-C rails (`refundWorker.detectDeposit/forwardToCustomer`) are unwired stubs → a live refund would reserve a real pool address and ask the merchant to deposit funds nothing can forward (0 rows so far). | `refundService.isForwardingWired()` (env `REFUND_FORWARDING_WIRED`, default off) → `createRefund` refuses live refunds with a clear message; `GET /refunds/preview` returns `live_available:false` + reason; `CryptoRefundModal` shows a warning (`refund-live-unavailable`) and disables Create. i18n ×6. Test `refundLiveGuard.test.ts`. |
| M3 | HIGH (double-spend) | merchant API | `POST /api/user/useWallet` read→compare→write debit raced (concurrent calls could overdraw a customer wallet). | Single conditional `UPDATE … WHERE amount >= $1 … RETURNING` + ledger insert in one transaction; `amount` must be a finite number (also on cryptoPayment/createPayment/embed/addFunds). |
| S1 | HIGH | security | `POST /api/status/check` public → anyone could spam external health probes + INSERT into prod `tbl_service_health`. | `adminAuthMiddleware`. |
| S4 | HIGH (PII) | security | `GET /api/referral/leaderboard` public, unbounded `limit`, leaked merchant `user_id`, full name, earnings. FE also expected `is_current_user` which BE never sent. | Auth required, limit ≤25, names masked "First L.", no ids/earnings, `is_current_user` computed from JWT. `/leaderboard/public` unchanged (rank+count only). |
| S5 | HIGH (revenue leak) | security | `POST /api/referral/apply` + `/referee/redeem` public and trusted body `user_id` → attach your referral code to ANY merchant (25% fee credit for 12 months) / grant 50% fee discounts. | Both auth-gated; `user_id` taken from the JWT, body ignored. |
| S6 | MED | security | `POST /api/notifications/trigger-weekly-summary` / `trigger-wallet-reminder` accepted any `user_id` (or none → fan-out to ALL users) behind plain merchant auth. | Scoped to the caller's own user_id. |
| S2/S3 | LOW | abuse | Public paid-API proxies (`/api/tax/*` → APILayer) and `/api/pay/encrypt-payload|calculateFees|calculate-payment` had no rate limit. | Dedicated `tax:<ip>` limiter 30/15 min; `publicReadRateLimiter` (120/min) on the pay endpoints. |
| B1 | MED | admin | `GET /api/admin/analytics/revenue` 500 — `fee_amount` column doesn't exist. | `COALESCE(transaction_fee,0)+COALESCE(fixed_fee,0)`. |
| B2 | LOW | validation | 500s on garbage input: `calculateFees` (non-string cryptocurrency), `referee/validate|redeem` (non-string code), `company/webhook-history/:id/detail/:logId` (non-numeric logId). | Type/format guards → 400. |
| O1 | MED | observability | `apiUsageLogger` existed but was never mounted → `tbl_api_usage_log` empty forever; Developers page "Last used"/usage/logs always blank. | Mounted on `/api/user` + `/api/user/customers`; atomic `request_count+1`; unit test `apiUsageLogger.test.ts`. |
| O2 | LOW | FE | Notifications → "Browser notifications" offered Activate although prod/preview have no VAPID keys → silent failure. | Hook probes `/notifications/push/vapid-key`; UI shows `push-unavailable-note`; error toast on failure; i18n ×6. |
| O3 | MED | observability | `tbl_inbound_events` (523 rows) all stuck `received`; `markProcessed/markFailed` never called. | `inboundEventId` flows receiver → BullMQ job; worker marks `processed`/`failed`; receiver marks `skipped` (dup/outgoing/unknown asset). |

## Found but intentionally NOT changed
- `customer-<ref>` Redis sessions have no TTL — they ARE the payment-link store (see PRD 2026-06 note);
  adding TTLs would break reusable links / late settlements. Needs a scoped design (per pathType) — backlog.
- Tatum webhooks from unknown IPs without `x-payload-hash` are still accepted (flagged) — by design
  (legacy subscriptions); the on-chain gate is the real control and now also guards the SSE status.
- ~275 backend routes have no frontend caller (merchant API, SafeDeal API, webhooks, admin analytics,
  legacy `/api/subscriptions`, `/api/wallet/withdrawAssets`, `/api/webhook` Flutterwave). Documented in
  `memory/reports/api_contract_xref_2026-09-29.txt`; dead-code removal is a separate decision.
- Preview infra rate-limits `/_next/static` during rapid automated navigation (429 → MIME error noise).
  Not in our code path.

## Prod env facts (read via SSH, read-only)
`NODE_ENV=production ENABLE_BACKGROUND_JOBS=true ENABLE_CRYPTO_REFUNDS=true REFUND_DRY_RUN=false
ENABLE_INBOUND_EVENT_DEDUP=true`, no `VAPID_*`, no `REFUND_FORWARDING_WIRED` → live refunds now
refused until the worker rails are implemented and the flag is set.
