# DynoPay Railway Production Log Analysis Report
## Date: 2026-02-23 | Analysis Window: Feb 21–23, 2026
## Deployments Analyzed: d97d6a43 (current), 396f69ee, 5f832739

---

## Executive Summary

Analyzed **12,006 unique log entries** across 5 Railway deployments spanning Feb 21–23, 2026. Found **9 bugs** (3 critical, 3 high, 3 medium) and **4 anomalies**. The most urgent issue is a **POLYGON auto-conversion stuck in PENDING_DEPOSIT** for 45+ minutes with merchant funds undelivered, and a **BTC broadcast failure** that lost a customer payment.

---

## 🔴 POLYGON Payment Investigation

### Payment Details
| Field | Value |
|-------|-------|
| **Payment ID** | `97d3511d-c56b-4c8b-a5e0-115efbd9af32` |
| **Company** | 38 (richard@dyno.pt) |
| **Merchant Wallet** | `0x9a7221b5e32d5f99e8da95585835442e29afb38f` (wallet_id: 507, user_id: 28) |
| **Pool Address** | `0xa1988cb9c6c3b21f71d74ae1f1e70e7bdb5c22ee` |
| **Expected Amount** | 91.5 POLYGON (MATIC) |
| **Received Amount** | 108.869 POLYGON (**overpaid by 18.97%**) |
| **Blockchain TX** | `0xeb18ed9a6e03370693275a1cd8480b324c4ff721191d37ae1e625543e6cbc1d2` |
| **Tatum Webhook Source IP** | `35.185.216.99` (Google Cloud — Tatum infrastructure) |
| **Auto-Convert** | ACTIVE → 97.524 POLYGON → USDT |
| **Platform Fee** | 11.345 POLYGON (10.42%) |

### Where the POLYGON Payment Came From

The payment originated from an **external wallet on the Polygon (MATIC) blockchain**. The Tatum webhook monitoring service detected 108.869 MATIC arriving at the monitored address via transaction `0xeb18ed9a...` on the Polygon network. Key evidence:

1. **Tatum fired two webhooks** for the same tx hash `0xeb18ed9a...`:
   - `0x9a7221b5...` received **+108.869 MATIC** (the monitored merchant address)
   - `0xa1988cb9...` spent **-0.00063 MATIC** (gas from pool address)
2. The payment was created via **MerchantAPI** (company 38) — the creation event itself is outside the log retention window (predates Feb 22 00:12 UTC deployment)
3. Redis had pre-existing payment data: `{"currency":"POLYGON","expectedAmount":91.5,"payment_id":"97d3511d...","company_id":38}`
4. The payment was processed by company 38's auto-convert pipeline (settlement: POLYGON → USDT)

### POLYGON Payment Timeline

| Time (UTC) | Event |
|------------|-------|
| *Before Feb 22* | Payment `97d3511d` created via MerchantAPI. Pool address `0xa1988` reserved for POLYGON. Redis data set. |
| 02:43:48 | Tatum webhook received: 108.869 MATIC at `0x9a7221b5` (tx `0xeb18ed9a`) |
| 02:43:48 | Webhook auth warning: Unsigned webhook from UNKNOWN IP `35.185.216.99` |
| 02:43:49 | Redis data found for payment `97d3511d`. Processing begins. |
| 02:43:50 | ⚠️ State machine SOFT REJECT: `pending → processing` (missing `detected` transition) |
| 02:43:50 | Pending payment email sent to `richard@dyno.pt` |
| 02:43:51 | cryptoVerification: Found pool address `0xa1988`. Total received: 108.869 POLYGON. |
| 02:43:51 | Auto-convert ACTIVE for company 38. Created conversion record #28: 97.524 POLYGON → USDT |
| 02:43:51 | Fee split: Admin 11.345 POLYGON, Merchant 97.524 POLYGON. No direct transfer — all stays for sweep. |
| 02:43:52 | Pool address `0xa1988` released. Immediate sweep triggered. |
| 02:43:52 | Admin fee email sent to `moxxcompany@gmail.com`: 11.345 POLYGON |
| 02:43:53 | Sweep starts. Gas estimation: 32 Gwei. |
| 02:43:54 | Redis soft-delete for pool address (1800s TTL). |
| 02:43:55 | Payment received email sent to `richard@dyno.pt`: 97.524 POLYGON (converting to USDT) |
| 02:43:55 | State: `processing → payout_complete` ✅ |
| 02:43:55 | ⚠️ SOFT REJECT: `payout_complete → payout_complete` (duplicate completion event) |
| 02:43:58 | ❌ **SWEEP NOT PROFITABLE**: Balance 0.00037 POLYGON, Est. fee 0.000798 POLYGON. Skipping sweep. |
| 02:44:01 → 03:28:05 | ❌ **Conversion #28 STUCK in PENDING_DEPOSIT** — loops every minute for 45+ minutes. Never advances. |

---

## 🔴 CRITICAL BUGS

### BUG 1: POLYGON Auto-Conversion Stuck in PENDING_DEPOSIT ⚡ ACTIVE
- **Severity**: CRITICAL — Merchant funds undelivered
- **Payment**: `97d3511d` | Company 38 | 97.524 POLYGON → USDT
- **Status**: Conversion #28 stuck in `PENDING_DEPOSIT` since 02:44 UTC — **45+ log entries** showing cron loop but no state advancement
- **Root Cause**: Sweep failed because remaining balance (0.00037 POLYGON) was less than the gas fee (0.000798 POLYGON). The 108.869 POLYGON appears to have already been moved (balance nearly zero), but the conversion service doesn't detect the deposit on Binance side.
- **Impact**: Merchant (richard@dyno.pt) was told "converting to USDT" but conversion never completes
- **Files**: `services/conversionService.ts`, `services/merchantPool/merchantPoolSweep.ts`
- **Fix Needed**: 
  1. Add a timeout/error state for conversions stuck in PENDING_DEPOSIT beyond N minutes
  2. Investigate why sweep balance is dust when 108.869 POLYGON was received
  3. Add manual admin intervention endpoint for stuck conversions

### BUG 2: BTC Transaction Broadcast Failure — UTXO Fee Off-By-One
- **Severity**: CRITICAL — Customer payment failed
- **Payment**: `24912c35` | Company 3 | 0.00036608 BTC
- **Time**: 2026-02-21 22:32 UTC
- **Error**: `btc.broadcast.failed` — "Unspent value is 256 but specified fee is 255"
- **Root Cause Chain**:
  1. `findUtxoOutputIndex` could NOT find the output for `bc1q6cg0l7q2mdk00v685ptn0mpxzee48xs73r03zd` in the transaction → **defaulted to index 0**
  2. Wrong output index → incorrect UTXO value calculation → fee calculation off by 1 satoshi
  3. Tatum rejected the broadcast: unspent (256 sats) ≠ specified fee (255 sats)
- **Impact**: Payment went to `FAILED` state. Customer's BTC (0.00036608 BTC ≈ $25) stuck in temp address.
- **Files**: `controller/paymentController.ts` (findUtxoOutputIndex), `services/webhookProcessor.ts`
- **Fix Needed**: Fix `findUtxoOutputIndex` to correctly parse BTC transaction outputs, or add ±1 satoshi fee tolerance

### BUG 3: LTC Merchant Webhook URL Returns 404
- **Severity**: CRITICAL — Merchant never notified
- **Payment**: `0ab857ff` | Company 3 | LTC
- **Time**: 2026-02-21 11:35 UTC
- **Error**: `callMerchantWebhook ❌ Client error 404, not retrying` — "404 page not found"
- **Impact**: Both `payment.pending` and `payment.underpaid` webhooks failed. The payment itself completed (LTC was processed and swept), but the merchant's system was never notified.
- **Root Cause**: The merchant's webhook URL endpoint no longer exists or the path changed
- **Files**: `services/webhookProcessor.ts`
- **Fix Needed**: Add webhook delivery status tracking; alert admin when merchant webhook URLs consistently fail

---

## 🟠 HIGH SEVERITY BUGS

### BUG 4: State Machine — Missing `detected` Transition (SYSTEMIC)
- **Severity**: HIGH — Affects ALL payments
- **Affected Payments**: `2bdfa507` (USDT-TRC20), `0ab857ff` (LTC), `24912c35` (BTC), `97d3511d` (POLYGON)
- **Error**: `SOFT REJECT: Invalid state transition: pending → processing. Allowed: [detected, expired, failed]`
- **Root Cause**: The payment flow goes directly from `pending` to `processing` without passing through `detected`. The state machine expects `pending → detected → processing`, but `detected` is never set.
- **Impact**: All payments generate state machine warnings. Currently soft-enforced (non-blocking), but if hard-enforced it would break all payment processing.
- **Files**: `services/paymentStateMachine.ts`, `services/webhookProcessor.ts`
- **Fix Needed**: Either add the `detected` state transition when webhooks are received, or update the state machine to allow `pending → processing`

### BUG 5: Double `payout_complete` Transition
- **Severity**: HIGH
- **Affected Payments**: `2bdfa507`, `97d3511d`
- **Error**: `SOFT REJECT: Invalid state transition: payout_complete → payout_complete. Allowed: [refunded]`
- **Root Cause**: After payment completes, a second event fires the same completion transition. Likely the webhook processor AND the reconciliation cron both fire `crypto-verification-success`.
- **Impact**: Duplicate webhooks may be sent to merchants. State machine integrity compromised.
- **Files**: `services/webhookProcessor.ts`, `controller/paymentController.ts`

### BUG 6: Unparseable Status `"undefined"` in Redis
- **Severity**: HIGH
- **Payment**: `0ab857ff` (LTC)
- **Error**: `Unparseable status in crypto-verification-success-ref: "undefined" → "successful"`
- **Root Cause**: The Redis status for this payment was never set before the success path reads it. The status reads as literal string `"undefined"`.
- **Files**: `services/webhookProcessor.ts`, `controller/paymentController.ts`

---

## 🟡 MEDIUM SEVERITY BUGS

### BUG 7: DOGE Pool Address Permanently Stuck — NaN reserved_until
- **Severity**: MEDIUM — Resource leak
- **Address**: `D9dE9G6ofwPvCVSiQtPvbMZbna9JGhsuXK`
- **Evidence**: **75 log entries** over 3 days showing the same address in a stuck state
- **Pattern**: `"reserved NaN min ago — checking balance"` → `"no balance. Skipping"` → repeat forever
- **Eventually**: `"no valid reserved_until or updatedAt — skipping"` (after code fix, but address still stuck)
- **Root Cause**: `reserved_until` field is NULL or invalid in the database, causing NaN when calculating minutes
- **Impact**: Wasted cron cycles; DOGE pool address permanently unavailable
- **Fix Needed**: Database cleanup — release this stuck address and fix NULL `reserved_until` handling

### BUG 8: Webhook Auth — Unsigned Webhooks from Unrecognized IPs
- **Severity**: MEDIUM — Security concern
- **Evidence**:
  - 3 webhooks from unknown IPs (`34.82.77.148`, `35.185.216.99` × 2) — "allowing but flagged for review"
  - 5 webhooks from `167.82.142.x` — missing `x-payload-hash` header (legacy subscriptions)
- **Risk**: Unsigned webhooks could be spoofed to trigger fake payment confirmations
- **Fix Needed**: Update Tatum IP allowlist; migrate legacy subscriptions to include HMAC signing

### BUG 9: BTC `findUtxoOutputIndex` Always Defaults to Index 0
- **Severity**: MEDIUM — Causes BUG 2
- **Evidence**: Every BTC payment shows `"Could not find output for bc1q6cg0... defaulting to index 0"`
- **Root Cause**: The function that parses BTC transaction outputs cannot match the pool address to any output, falling back to index 0
- **Impact**: When the actual output is at index > 0, UTXO spending fails (as seen in BUG 2)
- **Files**: `controller/paymentController.ts` (findUtxoOutputIndex)

---

## 🔵 ANOMALIES

### ANOMALY 1: High Cron Lock Contention
| Cron Job | Failed Lock Acquisitions |
|----------|------------------------|
| `stablecoinConversion` | 35× |
| `performScheduledSweeps` | 18× |
| `checkMissedPayments` | 5× |
| `processIncompletePayments` | 5× |

**Interpretation**: Cron jobs are running longer than their scheduled interval, causing the next execution to fail lock acquisition. The `stablecoinConversion` job is particularly slow (35 failures) — likely related to the PENDING_DEPOSIT polling loop.

### ANOMALY 2: Fontconfig Missing on Railway
- **Error**: `Fontconfig error: Cannot load default config file: No such file: (null)`
- **When**: During QR code generation (sharp library)
- **Impact**: Low — QR codes still generate, but font rendering for currency logos may be degraded
- **Fix**: Add `fontconfig` to Railway Dockerfile/nixpacks

### ANOMALY 3: Blockchain Service Rate Limiting
- `BlockchainFeeService` rate limited fetching TRX price, using fallback
- `TronEnergy` couldn't check token activation for `TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR`, assuming existing
- **Impact**: Low — fallback prices used, but could cause fee miscalculation in edge cases

### ANOMALY 4: Duplicate Webhook Detection
- LTC webhook `b1a0fe48...` detected as duplicate but still processed
- **Impact**: Low — dedup system caught it, but the duplicate reached the processing pipeline before being stopped

---

## Payment Summary

| Payment ID | Currency | Company | Amount | Status | Issues |
|------------|----------|---------|--------|--------|--------|
| `97d3511d` | POLYGON | 38 | 108.869 (exp: 91.5) | payout_complete BUT **conversion stuck** | BUG 1, BUG 4, BUG 5 |
| `24912c35` | BTC | 3 | 0.00036608 | **FAILED** | BUG 2, BUG 4, BUG 9 |
| `0ab857ff` | LTC | 3 | 0.9391435 (exp: 2.85) | payout_complete | BUG 3, BUG 4, BUG 6 |
| `2bdfa507` | USDT-TRC20 | 3 | 15.004831 (exp: 15) | payout_complete ✅ | BUG 4, BUG 5 |
| `12d19437` | BTC | 3 | 0.00074065 | payout_complete ✅ | BUG 9 (non-fatal) |
| `0cff859b` | BTC | 3 | 0.00073999 | payout_complete ✅ | BUG 9 (non-fatal) |

---

## Recommended Priority Actions

1. **IMMEDIATE**: Manually resolve POLYGON conversion #28 — either trigger Binance deposit check or mark as completed with manual settlement
2. **IMMEDIATE**: Investigate stuck BTC funds from payment `24912c35` in address `bc1q6cg0l7q2mdk00v685ptn0mpxzee48xs73r03zd`
3. **P0**: Fix `findUtxoOutputIndex` to correctly identify BTC output indices
4. **P0**: Add `pending → processing` to state machine allowed transitions (or add `detected` state)
5. **P1**: Add timeout/escalation for conversions stuck in PENDING_DEPOSIT
6. **P1**: Clean up stuck DOGE address `D9dE9G6ofwPvCVSiQtPvbMZbna9JGhsuXK`
7. **P1**: Update Tatum IP allowlist for webhook auth
8. **P2**: Add merchant webhook health monitoring with admin alerts on 404s
9. **P2**: Install `fontconfig` package in Railway deployment

---

*Report generated from Railway GraphQL API logs. Analysis covers deployments d97d6a43, 396f69ee, 5f832739, 25d1a24d, 6897be61.*
