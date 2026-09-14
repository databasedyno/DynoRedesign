# Railway Log Analysis: ETH Payment → Webhook Not Delivered to Hostbaybot

## Date: 2026-02-18 | Payment: f6ba336d-3553-4821-bcdc-e6fe00642c4a

---

## Executive Summary

The ETH payment was received and eventually processed, but the webhook was sent to **nomadlynew-production.up.railway.app** instead of **hostingbot-production-952f.up.railway.app** (hostbaybot). This was caused by a **chain of 3 bugs**:

1. **CSRF middleware blocking Tatum webhooks** → no real-time payment detection
2. **`reserveAddress` doesn't clear stale `last_payment_context`** → old nomadlybot data persists when hostbaybot reserves the same pool address
3. **Fallback reconstruction overwrites correct Redis data** with stale context from wrong payment

---

## Root Cause Chain (in order)

### BUG 1: CSRF Middleware Blocks Tatum Webhooks (403)
- **File**: `backend/middleware/csrfMiddleware.ts`
- **Evidence**: Railway HTTP logs show `POST /api/tatum-crypto-webhook → 403` from Tatum IP `34.82.77.148`
- **Cause**: EXEMPT_PATHS includes `/api/webhook` (Flutterwave) but NOT `/api/tatum-webhook` or `/api/tatum-crypto-webhook`
- **Impact**: Tatum cannot notify DynoPay of on-chain transactions in real-time

### BUG 2: `reserveAddress` Doesn't Clear `last_payment_context`
- **File**: `backend/services/merchantPool/merchantPoolReservation.ts` (lines 102-116)
- **Cause**: When reserving an address for a new payment, the function updates `status`, `current_payment_id`, etc. but does NOT clear or update `last_payment_context`
- **What happened**:
  - Pool address `0x7c5bba...` was previously reserved for nomadlybot payment `349a9ac9`
  - That payment expired → `releaseExpiredReservations` saved `last_payment_context` with nomadlybot's data (webhook_url = `nomadlynew-production.up.railway.app`)
  - Address became AVAILABLE with stale `last_payment_context` still pointing to `349a9ac9`
  - Hostbaybot reserved the same address for payment `f6ba336d` → stale `last_payment_context` NOT cleared

### BUG 3: Reconstruction Overwrites Correct Redis Data
- **File**: `backend/services/merchantPool/merchantPoolMonitoring.ts` (lines 634-683)
- **Cause**: When Tatum tx lookup fails 3 times, the missed payment check reconstructs Redis data from `last_payment_context`. But this context belongs to the PREVIOUS payment (`349a9ac9` / nomadlybot), not the current one (`f6ba336d` / hostbaybot)
- **Impact**: The correct Redis data (with hostbaybot's webhook URL) is **overwritten** with the stale context from nomadlybot

---

## Full Timeline

| Time (UTC)   | Event |
|-------------|-------|
| 12:00:17 | ✅ Payment `f6ba336d` created via MerchantAPI. Address `0x7c5bba...` reserved for ETH. **webhook_url from body: `hostingbot-production-952f.up.railway.app/...`** |
| ~12:05 | User sends 0.02119245 ETH to `0x7c5bba...` |
| ~12:05 | Tatum detects on-chain tx, sends webhook to `/api/tatum-crypto-webhook` → **❌ 403 CSRF BLOCKED** |
| 12:10 | checkMissedPayments: address within 10-min grace period, skipped |
| 12:20 | ⚠️ MISSED PAYMENT DETECTED. Balance: 0.02119245 ETH. Tatum tx lookup fails (1/3) |
| 12:30 | ⚠️ Tatum tx lookup fails (2/3) |
| 12:40 | ❌ Tatum tx lookup fails (3/3). **Context-based recovery uses stale `last_payment_context` from payment `349a9ac9` (nomadlybot)**. Reconstructs Redis with wrong webhook URL. cryptoVerification returns "not_found" (tx_id null) |
| 12:50–13:30 | ⏳ Payment stuck in "processing" state for 50+ minutes. Each check: "Webhook currently processing" |
| 13:38:09 | 🔄 RECONCILIATION cron finally finds tx on-chain: `0xb3a721eea...` |
| 13:38:11 | `payment.pending` webhook → `nomadlynew-production.up.railway.app` (WRONG URL) → 200 |
| 13:38:29 | `payment.confirmed` webhook → `nomadlynew-production.up.railway.app` (WRONG URL) → 200 |
| 13:38:34 | Payment state: processing → payout_complete |

---

## Fixes Applied (All 3 Implemented)

### Fix 1: CSRF Exempt Paths (CRITICAL - prevents recurrence)
```typescript
// backend/middleware/csrfMiddleware.ts - Add to EXEMPT_PATHS:
"/api/tatum-webhook",
"/api/tatum-crypto-webhook",
"/api/failed_webhook",
```

### Fix 2: Clear `last_payment_context` on new reservation
```typescript
// backend/services/merchantPool/merchantPoolReservation.ts - reserveAddress()
// Add to the poolAddress.update() call at line 102:
last_payment_context: null,  // Clear stale context from previous payment
```

### Fix 3: Prefer existing Redis data over stale context in reconstruction
```typescript
// backend/services/merchantPool/merchantPoolMonitoring.ts - reconstruction logic
// Before reconstructing, check if valid Redis data already exists
const existingRedis = await getRedisItem(cryptoRedisKey);
if (existingRedis?.webhook_url && existingRedis?.payment_id === currentPaymentId) {
  // Don't overwrite - existing data is correct
  cronLogger.info(`[MerchantPool] ✅ Existing Redis data is valid, skipping reconstruction`);
} else {
  // Reconstruct but prefer current payment data over last_payment_context
}
```

---

## Railway Credentials Used
- **Token type**: Project-Access-Token (header: `Project-Access-Token`)
- **Project ID**: `64052ce1-2ba2-4345-bf65-449c01cb77ef`
- **Service ID**: `ec021102-c129-48c5-a9a9-ef54108af927`
- **Environment**: production (`77215087-a0dd-438b-ba84-1480def90f7a`)
- **Latest deployment**: `3aa97f97-db39-4032-9224-aa88478e1c6b` (SUCCESS, 2026-02-16)
