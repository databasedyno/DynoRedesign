# Railway Log Analysis Report — 2026-03-22 (UPDATED)

**Deployment**: `2de7d399-2982-44b0-a488-018e0e89313d` (deployed Mar 20 19:13, status: SUCCESS)  
**Analysis Period**: 2026-03-20T19:16 → 2026-03-22T15:50 (~44 hours runtime)  
**Logs Analyzed**: ~14,000 unique runtime logs across 7 time windows

---

## Executive Summary

### ✅ GOOD NEWS: Payment ef0b29e4 Was Already Settled Successfully

The real 80.01 USDT-TRC20 payment (TX: `d33af4694c...`) was **successfully settled** at 15:04:46 UTC via outgoing TX `9c8e847453fccd19...`, confirmed in TRON block **81174922**. The merchant received **77.81 USDT-TRC20** (2.75% fee deducted). A `payment.confirmed` webhook was sent to the merchant. **No manual settlement is needed.**

### 🔴 ROOT CAUSE: TRON Spam Token Attack — Missing Asset Validation

A **TRON spam/scam token** called `ha138com` with amount `138.138` was airdropped to the same payment address (`TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5`) at nearly the same time as the legitimate 80.01 USDT payment. The webhook processor **failed to validate that the incoming token asset (`ha138com`) matched the expected currency (`USDT-TRC20`)**. This caused:

1. The scam token's amount (138.138) to overwrite the real USDT amount (80.01) in Redis
2. Settlement to attempt sending 135.07 USDT-TRC20 (which only has 80.01) → "Insufficient TRC20 balance"  
3. 9+ retry loops, DLQ entries, stuck payment watchdog alerts, SmartGas drain, and 3 `payment.failed` webhooks sent to the merchant
4. All subsequent noise and errors in the system

---

## Detailed Timeline — What Actually Happened

| Time (UTC) | Event |
|------------|-------|
| **14:50:16** | Payment created: 80 USDT-TRC20, address `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5` |
| **15:04:24.492** | **Webhook 1 (LEGIT)**: 80.01 USDT_TRON, TX `d33af4694c...` — enqueued |
| **15:04:25.173** | Webhook 1 processing starts |
| **15:04:26.329** | **Webhook 2 (SCAM)**: 138.138 `ha138com`, TX `05fd6ca870...` — enqueued |
| **15:04:26.889** | Webhook 2 processing starts — **RACE CONDITION**: overwrites Redis `receivedAmount` from 80.01 → 138.138 |
| **15:04:27.216** | Webhook 2 sends `payment.pending` to merchant with amount=138.138 (WRONG!) |
| **15:04:28.164** | Webhook 1's `cryptoVerification` starts (reads `receivedAmount: 80.01` from its own context) |
| **15:04:28.630** | Webhook 1: `PAYMENT RECEIVED (full): 80.01 USDT-TRC20` → fee calc correct |
| **15:04:29.540** | Webhook 2's `cryptoVerification` starts (reads `receivedAmount: 138.138` from its context) |
| **15:04:29.980** | Webhook 2: `PAYMENT RECEIVED (full): 138.138 USDT-TRC20` → INCORRECT AMOUNT |
| **15:04:40.572** | Webhook 1: Settlement TX `9c8e847453fc...` submitted |
| **15:04:41.066** | Webhook 2: ❌ Settlement FAILS — "Insufficient TRC20 balance" (tried to send 135.07 of only 80.01 available) |
| **15:04:46.529** | Webhook 1: ✅ TX `9c8e847453fc...` **CONFIRMED** in block 81174922 |
| **15:04:47.635** | Webhook 1: Address released back to pool |
| **15:04:49.921** | Webhook 1: `payment.confirmed` webhook sent — amount: 77.81 USDT-TRC20 ✅ |
| **15:04:51.209** | Webhook 1: `processing → payout_complete` — **DONE** |
| **15:04:54** | Webhook 2: Retry 2/3 fails (same error) |
| **15:05:10** | Webhook 2: Retry 3/3 fails → status=`failed` |
| **15:05:11** | Webhook 2: `payment.failed` webhook sent (for the SCAM TOKEN, not the real payment!) |
| **15:05:42** | Recovery retry 1/3 — same error |
| **15:06:09** | Recovery retry 2/3 — same error |
| **15:07:11** | Recovery retry 3/3 — same error |
| **15:07:39** | **Job exhausted → DLQ** — Critical alert email sent |

---

## 🔴 BUG #1: Missing Asset Validation in Webhook Processor (CRITICAL)

### The Problem

When a Tatum webhook arrives, the webhook processor reads the Redis data for the address:
```
Redis key: crypto-TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5
Redis data: { currency: "USDT-TRC20", expectedAmount: 80, payment_id: "ef0b29e4..." }
```

The webhook payload contains:
```json
{ "address": "TVzJHr4E...", "amount": "138.138", "asset": "ha138com" }
```

**The webhook processor NEVER checks if `payload.asset` matches `redis.currency`.** It accepts the amount (138.138) from the scam token as if it were USDT-TRC20.

### The Fix Required

In `webhookProcessor.ts`, after reading Redis data and before processing the payment, add:
```typescript
// Validate webhook asset matches expected currency
const expectedCurrency = items?.currency;
const webhookAsset = payload.asset || payload.currency;
if (expectedCurrency && webhookAsset && !isAssetMatchingCurrency(webhookAsset, expectedCurrency)) {
  webhookLogs.warn(`[WebhookProcessor] ⛔ ASSET MISMATCH: webhook asset "${webhookAsset}" ≠ expected "${expectedCurrency}" — ignoring spam token`);
  return;
}
```

### Impact Without Fix

- Any TRON spam token airdrop can corrupt active payment data via Redis overwrite
- Can cause incorrect settlement amounts, failed settlements, and merchant notification with wrong amounts
- This is a **security vulnerability** — attackers could deliberately send specific amounts to trigger overpayments

---

## 🔴 BUG #2: Scam Token Amount Treated as USDT (Data Integrity)

The `currencyConvert` function saw `currency: "USDT-TRC20"` (from Redis, not from webhook) and applied a 1:1 stablecoin peg to the scam token's amount:
```
[currencyConvert] 💵 Stablecoin 1:1: USDT→USD = 138.138 (exact peg)
```

This caused:
- Fee calculation based on $138.138 instead of $80.01
- `adminAmountToSend = 3.07207` (2.22% of 138.138)
- `userAmountToSend = 135.06593` (97.78% of 138.138)
- Settlement attempted for 135.07 USDT-TRC20 but only 80.01 existed

---

## 🟡 BUG #3: Merchant Received Incorrect `payment.failed` Webhooks

Because the scam token triggered a parallel processing path, the merchant received:
1. ✅ `payment.pending` (80.01 USDT) — correct, from webhook 1
2. ❌ `payment.pending` (138.138 USDT-TRC20) — WRONG, from scam token webhook 2
3. ✅ `payment.confirmed` (77.81 USDT) — correct, from webhook 1 settlement
4. ❌ `payment.failed` (138.138 USDT-TRC20) — WRONG, from scam token webhook 2 failure
5. ❌ `payment.failed` (138.138 USDT-TRC20) — WRONG, from recovery retry failure

The merchant webhook at `nomadlynew-production.up.railway.app` received BOTH confirmed AND failed webhooks for the same `payment_id`. This is confusing and could cause incorrect order handling.

---

## 🟡 BUG #4: Watchdog Reports Same Payment ID 4x

The watchdog query returns the same `payment_id` (ef0b29e4) 4 times. This is because:
- Multiple webhook entries (USDT + ha138com + TRX gas) all modify the same Redis key
- The watchdog may be counting Redis keys that share the same payment_id
- OR the cron query produces cartesian-product duplicates from JOIN operations

---

## Correctly Settled Payment Summary

| Field | Value |
|-------|-------|
| **Payment ID** | `ef0b29e4-a053-40de-85f1-fe9bb1053727` |
| **Status** | ✅ **SETTLED** (payout_complete) |
| **Incoming TX** | `d33af4694c94d6406c917a9854b29be52e5331df5bb3436499a47f038ff36253` (80.01 USDT_TRON) |
| **Outgoing TX** | `9c8e847453fccd19fc3e9e8e11ff54cc41d803c3ae4241dfd5ff0540b2c2b607` (confirmed, block 81174922) |
| **Merchant Amount** | 77.81 USDT-TRC20 |
| **Admin Fee** | 2.20 USDT-TRC20 (2.75%) |
| **Merchant Wallet** | `TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR` |

---

## 🚨 Required Actions — Priority Order

| # | Priority | Action | Status |
|---|----------|--------|--------|
| 1 | ~~P0~~ | ~~Manually settle payment~~ | ✅ **Already settled** at 15:04:46Z |
| 2 | ~~P0~~ | ~~Replenish TRX gas~~ | ✅ **Done by user** |
| 3 | **🔴 P0** | **Add asset/currency validation** in webhook processor — reject tokens that don't match expected currency | **NEEDS FIX** |
| 4 | **🔴 P0** | Clean up DLQ entries for scam token TX `05fd6ca870...` | Needs action |
| 5 | **🟡 P1** | Add TRON spam token whitelist/blacklist to prevent known scam tokens | Recommended |
| 6 | **🟡 P1** | Fix watchdog deduplication to avoid reporting same payment 4x | Recommended |
| 7 | **🟢 P2** | Investigate if merchant at nomadlynew took incorrect action from the conflicting webhooks | Manual check |

---

*Report generated 2026-03-22. Root cause: TRON spam token "ha138com" bypassed webhook asset validation.*
