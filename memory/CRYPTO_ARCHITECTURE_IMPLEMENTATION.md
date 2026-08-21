# DynoPay — Crypto Payment Architecture: Implementation Roadmap

**Created**: 2026-08-21
**Owner**: Engineering
**Scope**: 12-point crypto payment architecture audit → prioritized implementation list

This document lists every gap identified in the 2026-08 audit of the DynoPay
codebase against a standard custodial crypto payment architecture, ranks them
by priority (Tier 1 = P0 revenue/correctness risk → Tier 4 = strategic), and
tracks implementation status.

Living document. Update the **Status** column whenever a piece ships. Cross-refs
to `ENGINEERING_STRATEGY_REVIEW_2026-08.md` are in the "Refs" column.

---

## Priority tiers

| Tier | Definition | Turnaround |
|------|------------|-----------|
| **Tier 1** | Correctness / reliability of the money-moving path. Data-integrity risk if left unfixed. | Ship first. |
| **Tier 2** | Product completeness — features expected of a payments platform (compliance, reorgs, refunds UX). | Next quarter. |
| **Tier 3** | Operational hardening — signing isolation, secret rotation, observability. | 90 days. |
| **Tier 4** | Strategic / topology — split API from worker, remove SPOFs, contract tests. | As scale demands. |

---

## The 7 audit items

| # | Item | Tier | Status | Owner | Refs |
|---|------|------|--------|-------|------|
| 1 | **Refund execution flow** | 1 | 🅿️ **DEFERRED** (per user, 2026-08-21) | — | Sec below |
| 2 | **Missing webhook events** (`payment.created`, `.expired`, `.overpaid`, `refund`) | 1 | ⛔ Not started | — | Sec below |
| 3 | **Double-entry ledger** | 1 | ✅ **SHIPPED** (2026-08-21) | E1 | R4, Sec below |
| 4 | **KYC/AML activation** (Veriff real keys) | 2 | ⛔ Not started (needs live Veriff creds) | — | 90-day #2 |
| 5 | **Chain reorganization handling** | 2 | ⛔ Not started | — | — |
| 6 | **Signing isolation + withdrawal controls** | 3 | ⛔ Not started | — | R6 |
| 7 | **Secret rotation + Binance key scoping** | 3 | ⛔ Not started | — | R1, 90-day #1 |

Legend: ✅ shipped · 🚧 in-progress · ⛔ not started · 🅿️ deferred · ⚠️ blocked

---

## ✅ #3 Double-entry ledger (SHIPPED 2026-08-21)

### What was built

A parallel, additive, feature-flagged **double-entry ledger** that mirrors
the existing `paymentJournal` event log with balanced accounting entries. The
existing journal stays intact as the immutable audit source. The ledger is a
derived view that answers "how much do we owe this merchant right now?" and
"is our book balanced?" — the questions the event log cannot.

**New tables** (all created idempotently on boot when `ENABLE_LEDGER=true`):

- `tbl_ledger_accounts` — chart of accounts (7 seeded standard accounts)
- `tbl_ledger_entries` — append-only DR/CR rows; unique on
  `(payment_id, journal_event, dedup_key, line_index)`
- `tbl_ledger_invariant_checks` — audit log of invariant sweep results

**New services** (`backend/services/ledger/`):

- `ledgerService.ts` — `postDoubleEntry()`, `reverseBatch()`, `getBalances()`,
  `getPaymentLedger()`. Enforces `DR sum === CR sum` per currency at post time.
- `ledgerAccountsBootstrap.ts` — idempotent seeding of the standard chart.
- `ledgerPaymentMapper.ts` — payment lifecycle → ledger lines
  (`recordSettlementCompleted`, `recordPaymentDetected`).
- `ledgerInvariantChecker.ts` — rolling-window aggregation; alerts to Slack
  on drift; runs every `LEDGER_INVARIANT_INTERVAL_MIN` (default 30 min).
- `ledgerBackfill.ts` — one-shot backfill of settlement events from
  `paymentJournal` history; idempotent, supports dry-run.
- `ledgerBootstrap.ts` — startup wiring, feature-flag gate.

**New admin routes** (`backend/routes/ledgerRouter.ts`, mounted at `/api/ledger`):

- `GET  /api/ledger/health`            — feature-flag state + last invariant status
- `GET  /api/ledger/balances`          — DR/CR/net per (account, currency)
- `GET  /api/ledger/payment/:id`       — full timeline for a payment
- `GET  /api/ledger/invariants/latest` — last 20 invariant checks
- `POST /api/ledger/invariants/run`    — trigger an on-demand check
- `POST /api/ledger/backfill`          — backfill from paymentJournal (dry-run default)

**Callsite integration** — `paymentReliability.markSettlementCompleted()` now
dual-writes to the ledger via `recordSettlementCompleted()` when
`LEDGER_DUAL_WRITE=true`. Non-blocking — a ledger error never fails a
settlement (source-of-truth stays in `paymentJournal` + on-chain).

### Chart of standard accounts

| Code | Kind | Normal | Purpose |
|------|------|--------|---------|
| `buyer_escrow` | LIABILITY | CR | Funds held from buyer, owed to merchant/refund |
| `merchant_payable` | LIABILITY | CR | Net amount owed to a merchant post-fee |
| `fee_revenue` | INCOME | CR | Platform take-rate + fixed fees |
| `gas_expense` | EXPENSE | DR | On-chain network fees paid by the platform |
| `conversion_pnl` | INCOME | CR | PnL from stablecoin auto-conversion |
| `refund_liability` | LIABILITY | CR | Refundable amount pending payout |
| `suspense` | ASSET | DR | Transient / uncategorized — MUST clear within 24h |

### Standard postings

```
payment_detected  (buyer→pool address confirmed on-chain):
  DR buyer_escrow      98.5 USDT  |  CR merchant_payable  98.5 USDT
  DR buyer_escrow       1.5 USDT  |  CR fee_revenue        1.5 USDT

settlement_sent   (pool→merchant + fee wallet):
  DR merchant_payable  98.5 USDT  |  CR buyer_escrow      98.5 USDT
  DR fee_revenue        1.5 USDT  |  CR buyer_escrow       1.5 USDT
  [optional gas leg if platform pays gas separately]
  DR gas_expense       0.05 USDT  |  CR buyer_escrow      0.05 USDT
```

### Feature flags (all default OFF — safe for LIVE prod)

| Env | Default | Effect |
|-----|---------|--------|
| `ENABLE_LEDGER` | `false` | Sync ledger tables + seed accounts on boot |
| `LEDGER_DUAL_WRITE` | `false` | Post to ledger from `markSettlementCompleted()` |
| `LEDGER_INVARIANT_CRON` | `false` | Run invariant sweep every N minutes |
| `LEDGER_INVARIANT_WINDOW_HOURS` | `168` (7d) | Rolling window scanned by invariant checker |
| `LEDGER_INVARIANT_INTERVAL_MIN` | `30` | Cron interval |

### Rollout sequence (recommended)

1. **Preview / staging**: `ENABLE_LEDGER=true`, `LEDGER_DUAL_WRITE=true`,
   `LEDGER_INVARIANT_CRON=true`. Let it run alongside real traffic for 7 days.
2. **Backfill**: `POST /api/ledger/backfill { "dry_run": true }` — confirm
   scan count. Then `dry_run: false, since: <ISO>` to seed history.
3. **Production**: enable flags. Watch `/api/ledger/health` for the first
   invariant sweep; investigate any drift immediately.

### Invariants asserted

- **INV-1** (per currency, global window): `SUM(DR) === SUM(CR)` for every
  currency across the invariant window. Non-zero delta → drift alert.
- **INV-2** (per batch): every `batch_id` must independently balance per
  currency. Catches "half-posted" batches from bugs / race conditions.
- **IDEMPOTENCY**: `(payment_id, journal_event, dedup_key)` uniquely names
  a batch. Retries are no-ops. Enforced by unique DB index +
  application-level short-circuit.

### Tests

Unit tests (all green, 22 tests):

- `__tests__/ledgerDecimals.test.ts` — decimal math (13 tests). Ensures
  `0.1 + 0.2 === "0.3"` (BigInt-backed, no float loss), 1-satoshi drift
  detection, multi-currency independence.
- `__tests__/ledgerPaymentMapper.test.ts` — line construction (9 tests).
  Verifies settlement + detection mappers emit balanced batches with the
  right account codes and dedup keys.

Smoke test (against LIVE prod DB, cleanup on exit):

- `scripts/ledgerSmokeTest.ts` — end-to-end: bootstrap → post balanced batch
  → verify idempotency → reject unbalanced → query balances → run invariant
  → reverse batch → verify net-zero.

### Files added

```
backend/models/ledger/ledgerAccountModel.ts
backend/models/ledger/ledgerEntryModel.ts
backend/models/ledger/ledgerInvariantModel.ts
backend/services/ledger/ledgerAccountsBootstrap.ts
backend/services/ledger/ledgerBackfill.ts
backend/services/ledger/ledgerBootstrap.ts
backend/services/ledger/ledgerInvariantChecker.ts
backend/services/ledger/ledgerPaymentMapper.ts
backend/services/ledger/ledgerService.ts
backend/routes/ledgerRouter.ts
backend/scripts/ledgerSmokeTest.ts
backend/__tests__/ledgerDecimals.test.ts
backend/__tests__/ledgerPaymentMapper.test.ts
```

### Files touched (minimal surface)

```
backend/server.ts                      +5 lines (bootstrap init, router mount)
backend/services/paymentReliability.ts +20 lines (dual-write hook)
```

---

## 🅿️ #1 Refund execution flow (DEFERRED per user)

**Deferred 2026-08-21** — user explicitly excluded refund + all refund-related
work from this iteration.

When resumed, the shape should be:

- Admin/support endpoint: `POST /api/refunds/execute { payment_id, amount, reason }`
- Approval workflow: `POST /api/refunds/:id/approve` (2-person rule above threshold)
- Idempotent on-chain send (reuse `settlementIdempotency` patterns)
- Ledger posting (uses `refund_liability` account seeded in #3):
  ```
  DR merchant_payable / CR refund_liability   (accrue refund obligation)
  DR refund_liability / CR buyer_escrow       (execute — funds sent back on-chain)
  ```
- Journal event `refund_completed` in `paymentJournal`
- Optional webhook `refund` (see #2)

---

## ⛔ #2 Missing webhook events

Emit for these lifecycle transitions (in addition to existing `payment.completed`):

| Event | Fires when | Suggested payload |
|-------|-----------|-------------------|
| `payment.created` | Payment link/session first hits `AWAITING_PAYMENT` | `payment_id, amount, currency, address, expires_at` |
| `payment.expired` | State machine transitions to `EXPIRED` | `payment_id, expired_at, last_seen_amount` |
| `payment.overpaid` | Detected amount > requested amount (state → `OVERPAID`) | `payment_id, expected, received, delta` |
| `refund` | (deferred with #1) refund executed on-chain | `refund_id, payment_id, amount, currency, tx_id` |

Wire into `webhookQueue.enqueueWebhook()` from `paymentStateMachine.ts`
transitions. Reuse existing HMAC signing (`x-dynopay-signature`) and merchant
webhook URL routing.

---

## ⛔ #4 KYC/AML activation

**Blocked** on live Veriff API keys (currently `VERIFF_API_KEY=install-bundle`
placeholder). Once real keys land:

- Threshold-gated per `KYC_TRIGGER_VOLUME_USD` (e.g., $1k/mo)
- Incoming-fund screening (address risk score via Chainalysis / TRM)
- Persist verification state in existing `kycModel`
- Block payout when KYC required but pending

---

## ⛔ #5 Chain reorganization handling

Post-confirmation depth re-check window:

- After state → `CONFIRMED`, wait `REORG_HOLD_BLOCKS` (chain-specific)
  before firing settlement.
- On each new block, re-query the confirmed TX; if it's no longer on the
  main chain (`getTransaction()` returns null/uncle), roll back to
  `AWAITING_PAYMENT` and post a reversing ledger batch.
- Chain-specific `confirmationRequirements.ts` already has confirmation
  counts — extend with `reorgHoldBlocks`.

---

## ⛔ #6 Signing isolation + withdrawal controls

Per audit R6:

- Extract the signer into a separate deploy (`signer-service`), receives
  signed JSON-RPC over mTLS.
- Destination allowlist: only registered merchant + admin wallet addresses.
- Per-tx spend cap + rolling 24h cap; deny above thresholds.
- 2-person approval above `WITHDRAWAL_APPROVAL_THRESHOLD_USD` (e.g., $10k).

---

## ⛔ #7 Secret rotation + Binance scoping

Per audit R1:

- Rotate all secrets pasted into chat across the 7+ preview pods.
- Move to a secret manager (GCP Secret Manager preferred — already using GCP KMS).
- Binance key: revoke; issue new one with **read + convert only** and
  **IP allowlist** to the (future) worker deploy region.

---

## Cross-reference: R# from ENGINEERING_STRATEGY_REVIEW_2026-08

| R# | Item | Maps to # here |
|----|------|----------------|
| R1 | Secret sprawl | #7 |
| R2 | God files | (separate refactor track) |
| R3 | Migration discipline | (separate DevEx track) |
| R4 | Ledger | ✅ **#3** |
| R5 | Single-instance topology | Tier 4 |
| R6 | Signing isolation | #6 |
| R7 | Observability | Tier 4 |
| R8 | Test pyramid | Tier 4 |
| R9 | Binance SPOF | Tier 4 |

---

## Change log

- **2026-08-21** — E1 shipped #3 Double-entry ledger (feature-flagged OFF by
  default). Verified end-to-end via `scripts/ledgerSmokeTest.ts` on the LIVE
  preview DB; cleaned up test rows + dropped ledger tables so prod is
  untouched until operator flips flags intentionally. Deferred #1 (refunds)
  per user; documented remaining 6 items.
