# Railway Log Analysis — 2026-04-12

## Scope
- **Deployment**: `922138ff` (active since 2026-04-11 09:55 UTC)
- **Log window**: 2026-04-12 05:15 → 08:44 UTC (2001 entries)
- **Previous deployment**: `3bb44fdc` (2026-04-10 → 2026-04-11) — no BTC payments in that window

---

## 1. BTC Payment: `bfd34beb-25aa-44d2-b986-c7910141b3be`

### Timeline

| Time (UTC)    | Event |
|---------------|-------|
| 08:13:04      | Payment created: $30 USD → 0.00041857 BTC, Company 3, User 4 (nomadly@moxx.co) |
| 08:13:05      | FAST PATH: Pre-reserved BTC pool address `bc1q5d70qhrylltyhal6m729ewe7kkc5xr49hcesvy` |
| 08:13:05      | Tatum subscription created for address monitoring |
| 08:22:17      | **Tatum webhook received**: 0.00041857 BTC on-chain (tx: `137a5086...`) from IP `35.185.216.99` |
| 08:22:19      | ✅ `payment.pending` webhook → merchant |
| 08:22:19      | ✅ `payment.confirmed` webhook → merchant |
| 08:22:49      | ⚠️ `callMerchantWebhook` Attempt 1 **timed out** (30s exceeded) — merchant server slow |
| 08:22:51      | State: `pending → processing` |
| 08:22:52      | cryptoVerification begins |
| 08:22:52      | Wallet: BTC → `1JH5TnZzjYTf1yYw...` (Company 3) |
| 08:22:52      | Company-pays-fees, ratio-based distribution |
| 08:22:53      | Fee-free volume recorded: $30.00 (remaining: $0) |
| 08:22:54      | ℹ️ Same-wallet mode: admin = merchant wallet for BTC → combined single-output |
| 08:23:01      | ⚠️ Tatum vout API empty → **mempool.space fallback** found UTXO output index 1 |
| 08:23:02      | Settlement TX: `ee54d790...` — merchant: 0.00041703 BTC, admin fee: 0.00002023 BTC |
| 08:23:04      | Pool address released, subscription updated |
| 08:23:05      | **PAYOUT_COMPLETE** ✅ |
| 08:23:05      | Log: "skipping payment.settled webhook (merchant already notified)" |
| **08:23:09**  | **🐛 BUG: `payment.settled` webhook SENT ANYWAY by webhookProcessor** |
| 08:23:54      | Outgoing TX webhook received, correctly skipped (settlement) |

### Root Cause — Duplicate `payment.settled` Webhook

**Problem**: Merchant (`nomadlynew-production.up.railway.app`) received 3 webhooks:
1. `payment.pending` ✅
2. `payment.confirmed` ✅
3. `payment.settled` ❌ **DUPLICATE** — merchant treats both `confirmed` and `settled` as success → processes order twice

**Root cause**: The 2026-04-02 fix in `paymentController.ts` (line 5524) removed the `payment.settled` webhook call from `cryptoVerification()`, but **forgot to set** the Redis dedup key (`confirmed-webhook-sent-{paymentId}`) that `webhookProcessor.ts` (line 1168) checks before sending its own `payment.settled`.

**Flow**:
1. webhookProcessor sends `payment.confirmed` → merchant
2. webhookProcessor calls `cryptoVerification()` → settlement succeeds
3. `cryptoVerification` logs "skipping payment.settled" but **does NOT set dedup key**
4. Control returns to webhookProcessor → dedup check finds nothing → sends `payment.settled` **again**

### Fix Applied
**File**: `backend/controller/paymentController.ts` (line ~5540)

Added after the "skipping" log message:
```typescript
const settledDedupPaymentId = paymentId || tempData?.unique_tx_id || tempData?.ref || "unknown";
const settledDedupKey = `confirmed-webhook-sent-${settledDedupPaymentId}`;
await setRedisItem(settledDedupKey, { sent: true, sentAt: new Date().toISOString(), source: "cryptoVerification-skip" });
await setRedisTTL(settledDedupKey, 86400); // 24 hours
```

This sets the dedup flag that `webhookProcessor.ts` checks, preventing the duplicate `payment.settled`.

---

## 2. Other Anomalies Detected

### 🚨 Low Fee Wallet Balances (Recurring every 30 min)

| Chain    | Balance        | USD Value | Threshold | Status |
|----------|---------------|-----------|-----------|--------|
| TRX      | 38.30 TRX     | $12.27    | $30       | 🚨 CRITICAL |
| POLYGON  | 3.73 POLYGON  | $0.31     | $30       | ⚠️ VERY LOW |
| XRP      | 10.30 XRP     | $13.71    | $30       | ⚠️ LOW |
| ETH      | ~0.011 ETH    | $25.83    | $30       | ⚠️ LOW |

- Alert suppressed (already sent, 19-21h cooldown remaining)
- **Action needed**: Top up TRX, POLYGON, and XRP fee wallets. POLYGON is nearly empty ($0.31) — any POLYGON/USDT-POLYGON payments would fail settlement.

### ⚠️ Merchant Webhook Timeout

- `callMerchantWebhook` first attempt timed out at 08:22:49 (30s exceeded)
- Merchant server at `nomadlynew-production.up.railway.app` was slow
- Retry succeeded — no data loss
- **BUT**: The `await callMerchantWebhook()` call was **blocking settlement** — the 30s timeout delayed `cryptoVerification` by ~30s

### Fix Applied (Anomaly #2)
**Files**: `backend/webhooks/index.ts`, `backend/services/webhookProcessor.ts`

1. **Timeout reduced**: 30s → 15s (`webhooks/index.ts` line 300)
2. **Non-blocking pre-settlement webhooks** (`webhookProcessor.ts`):
   - `payment.pending` webhook (line ~819): `await callMerchantWebhook(...)` → fire-and-forget with `.catch()` error logging
   - `payment.confirmed` webhook (line ~988): `await callMerchantWebhook(...)` → fire-and-forget with `.then()/.catch()` logging
   - Settlement (`cryptoVerification`) now starts **immediately** without waiting for merchant webhook delivery
   - Post-settlement webhooks (`payment.settled`, `payment.failed`, crash-recovery) remain `await` — they don't block any critical path

### ⚠️ Tatum UTXO API Fallback

- `findUtxoOutputIndex` got no vout data from Tatum for tx `137a5086...`
- Successfully fell back to mempool.space
- **Risk**: If both Tatum and mempool.space are down, BTC settlement would fail
- **Recommendation**: Consider adding a third fallback (e.g., blockstream.info API)

### ℹ️ Stale Sweep Addresses (6 addresses)

- Every 30 min, threshold + time sweep checks 6 addresses with admin fees
- No actual sweeps executed — all likely below MIN_SWEEP_USD threshold
- These addresses accumulate small admin fees but aren't profitable to sweep
- **Status**: Working as designed (fee concentration strategy)

### ℹ️ Orphan Detection (Healthy)

- 207 AVAILABLE addresses scanned hourly
- All cached as zero-balance
- 0 orphans found — clean

### ℹ️ Webhook Queue (Healthy)

- Health checks every 60s: all OK
- Queue: waiting=0, active=0, delayed=0, failed=0
- Webhook delivery monitoring: operational (~170-210ms)

---

## 3. Overall System Health

| Component | Status | Notes |
|-----------|--------|-------|
| API | ✅ Operational | All endpoints returning expected status codes |
| Webhook Queue | ✅ Healthy | Zero failed/delayed jobs |
| Payment Processing | ✅ Working | BTC payment settled successfully |
| Orphan Detection | ✅ Clean | No orphan payments found |
| Fee Wallet Monitor | ⚠️ Low balances | TRX, POLYGON, XRP, ETH below threshold |
| Sweep Cron | ✅ Running | No profitable sweeps available |
| Merchant Webhooks | ⚠️ One timeout | Retry succeeded, merchant server was slow |
| UTXO Lookup | ⚠️ Fallback used | Tatum vout empty, mempool.space succeeded |

---

## 4. Recommendations

1. **Top up fee wallets** — especially POLYGON ($0.31) and TRX ($12.27)
2. **Verify fixes in production** — next BTC payment should:
   - Show `confirmed-webhook-sent-{paymentId}` dedup key (fix #1: no duplicate `payment.settled`)
   - Show settlement starting immediately without webhook timeout delay (fix #2: non-blocking)
3. **Consider UTXO fallback chain** — add blockstream.info as third option after Tatum + mempool.space
