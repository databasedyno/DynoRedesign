# Railway Log Analysis Report — 2026-04-07

**Deployment:** `5cfa12d7-b560-4477-965c-1aa8378bdd9e` (SUCCESS)  
**Time Window:** 07:11 UTC → 11:25 UTC (~4.2 hours)  
**Total Logs Analyzed:** ~3,887 entries  
**HTTP 500 / Crashes:** None ✅  

---

## 🔴 CRITICAL — Fee Wallet Balances Dangerously Low (4 chains)

All four gas fee wallets are **below the $30 threshold**, meaning settlements on these chains could fail if balances aren't replenished:

| Chain | Balance | USD Value | Threshold | Status |
|-------|---------|-----------|-----------|--------|
| **TRX** | 28.96 TRX | **$9.11** | $30 | 🚨 CRITICAL (draining — was 33.39 TRX at 07:11, dropped to 28.96 by 11:12) |
| **POLYGON** | 3.73 POL | **$0.34** | $30 | 🚨 NEAR ZERO |
| **XRP** | 10.30 XRP | **$13.47** | $30 | ⚠️ LOW |
| **ETH** | 0.01194 ETH | **$24.95** | $30 | ⚠️ LOW |

**Impact:** TRX wallet dropped ~4.4 TRX ($1.39) in this window due to 2 successful USDT-TRC20 settlements. At this rate, the TRX wallet can only handle ~3-4 more TRC20 settlements before running dry. POLYGON is effectively at zero.

**CRITICAL email sent** to `moxxcompany@gmail.com` at 07:11 UTC. Alert cooldown is active (suppressing further emails for ~31 hours).

---

## ⚠️ HIGH — 4 Stale Pool Addresses Stuck in Infinite Sweep Loop

Four pool addresses have small leftover balances that are **repeatedly attempted to sweep every 30 minutes** but **always fail profitability check** (gas cost > balance):

| Address | Chain | Balance | Gas Fee | Idle Time | Result |
|---------|-------|---------|---------|-----------|--------|
| `TRisAcnVJpaQd46No53CcDxEZTPKCvCXbW` | USDT-TRC20 | $3.63 | $2.62 (8.3 TRX) | **81,883 min (~57 days)** | Skipped — but could actually sweep (balance > fee), yet is being skipped |
| `TSVRT7Z1X68UJEhTNzwpqNxaTbfg5t5Yr7` | USDT-TRC20 | $2.05 | $2.62 (8.3 TRX) | **7,260 min (~5 days)** | Skipped — unprofitable ✓ |
| `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe` | USDT-TRC20 | $4.26 | $2.62 (8.3 TRX) | **2,857 min (~2 days)** | Skipped — but could actually sweep (balance > fee) |
| `0x5e4e7f585893e83f157e3f30811abda363210cb2` | USDT-ERC20 | $0.000312 | High (ERC20 gas) | **31,111 min (~21.6 days)** | Skipped — dust amount |

**Anomaly:** `TRisAcnVJpaQd46No53CcDxEZTPKCvCXbW` ($3.63) and `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe` ($4.26) have balances HIGHER than the gas fee ($2.62), yet are still being skipped. The profitability check may have additional margin requirements, or the `NO gas funded` message indicates the TRX fee wallet is too low to fund gas for these sweeps. This creates a chicken-and-egg problem: fee wallet is low → can't fund gas for sweeps → can't recover funds → fee wallet stays low.

**Impact:** ~$10 in stuck funds across these addresses. 8 sweep attempts per cycle × 4 addresses = 32 unnecessary API calls per 30-min cron tick. The ERC20 dust address ($0.000312) has been idle for 21+ days and should be released back to pool without sweeping.

---

## ⚠️ MEDIUM — TRON API Rate Limiting (HTTP 429)

Getting **HTTP 429 (Too Many Requests)** from the TRON API when checking energy resources:

| Time | Affected Addresses |
|------|-------------------|
| 09:30 | `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe`, `TRisAcnVJpaQd46No53CcDxEZTPKCvCXbW` |
| 10:00 | `TRisAcnVJpaQd46No53CcDxEZTPKCvCXbW`, `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe`, `TSVRT7Z1X68UJEhTNzwpqNxaTbfg5t5Yr7` |
| 10:30 | All 3 TRON addresses |
| 11:00 | `TSVRT7Z1X68UJEhTNzwpqNxaTbfg5t5Yr7` |

**Pattern:** Occurs every 30 minutes during the sweep cron. Multiple resource checks for multiple addresses in rapid succession hit the rate limit. **9 instances total** in 4 hours.

**Impact:** Sweep fee estimation falls back to default values when rate-limited, but the profitability check still works. No settlement failures caused by this — the two real payments at 10:37 and 10:48 both successfully checked resources. However, if a real payment settlement coincides with the cron sweep, the rate limit could affect fee estimation accuracy.

---

## ⚠️ MEDIUM — Merchant Webhook Timeouts (2 occurrences)

| Time | Event | Target | Result |
|------|-------|--------|--------|
| 10:37:08 | `payment.confirmed` webhook for $39 payment | `nomadlynew-production.up.railway.app/dynopay/crypto-pay-domain` | Attempt 1 timed out (15s), retry succeeded ✅ |
| 10:47:59 | `payment.confirmed` webhook for $100 payment | Same merchant endpoint | Attempt 1 timed out (15s), retry succeeded ✅ |

**Pattern:** The `payment.confirmed` webhook to the NomadlyNew merchant consistently times out on first attempt (~15s), but succeeds on retry. This suggests the merchant's Railway service may be cold-starting or has slow response times.

**Impact:** No data loss — retries succeed. But adds 15s+ latency to the payment confirmation flow.

---

## ⚠️ LOW — Binance WebSocket HTTP 418 on Startup

At deployment startup (07:11:57), Binance direct ping returned **HTTP 418** ("I'm a teapot" — Binance's way of saying the request is blocked, likely geo-restriction or IP ban):

```
[Binance] ⚠️ Direct ping failed (Request failed with status code 418), defaulting to no proxy.
[BinanceWS] Starting Binance WebSocket price stream...
[BinanceWS] Connecting to 10 streams (BTC, ETH, LTC, DOGE, SOL, XRP, BCH, BNB, TRX, POL)...
[BinanceWS] ✅ Connected — tracking 10 assets
```

**Impact:** Direct API ping fails, but WebSocket price stream still connected successfully. Prices are flowing. This is a non-issue unless the WebSocket also gets blocked.

---

## ✅ GOOD NEWS — Payments Processing Correctly

Two real payments successfully processed during the window:

### Payment 1: $39 USDT-TRC20 (e0d6d788)
- 10:36:49 — Tatum webhook received (39 USDT from `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5`)
- 10:36:52 — `payment.pending` webhook sent to merchant ✅
- 10:37:09 — `payment.confirmed` webhook sent (after 1 retry) ✅
- 10:37:12 — Fee-free volume recorded ($39, remaining: $0)
- 10:37:13 — Same-wallet settlement (admin = merchant wallet)
- 10:37:16 — Token transfer succeeded, TX confirmed in block 81630243
- 10:37:23 — Settlement complete: merchant=35.37 USDT, fee=1.585 USDT
- 10:37:29 — `payment.settled` webhook sent ✅
- **Total time: ~40 seconds** end-to-end

### Payment 2: $100 USDT-TRC20 (872eeb3a)
- 10:46:02 — Payment created via Merchant API (Company 3)
- 10:47:41 — Tatum webhook received (100 USDT from `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe`)
- 10:48:01 — `payment.confirmed` webhook sent ✅
- 10:48:05 — Fee-free volume recorded ($100, remaining: $0)
- 10:48:16 — Settlement complete with TX hashes
- 10:48:23 — `payment.settled` webhook sent ✅
- **Total time: ~42 seconds** end-to-end

---

## 📊 System Health Summary

| Component | Status | Notes |
|-----------|--------|-------|
| API Server | ✅ Operational | No 500 errors, no crashes |
| WebhookQueue | ✅ Healthy | Consistent health checks, 0 failed jobs |
| Payment Processing | ✅ Working | 2/2 settlements successful |
| Webhook Delivery | ⚠️ Retries needed | Merchant endpoint slow (NomadlyNew) |
| Binance Prices | ✅ Connected | 10 asset streams active |
| Fee Wallets | 🚨 CRITICAL | 4/4 below threshold |
| Merchant Pool Sweeps | ⚠️ Stuck | 4 stale addresses, infinite retry loop |
| TRON API | ⚠️ Rate limited | 429s during sweep crons |
| Reconciliation | ✅ OK | 1 re-queued, 0 errors |

---

## 🎯 Recommended Actions (Priority Order)

1. **🚨 P0 — Top up fee wallets** — TRX ($9.11), POLYGON ($0.34), XRP ($13.47), ETH ($24.95). All below $30 threshold. TRX especially urgent as it's actively being drained by settlements.

2. **⚠️ P1 — Fix stale address sweep loop** — Either: (a) Force-sweep the two profitable addresses (`TRisAcnVJpa...` $3.63, `TAoyePonm...` $4.26) when fee wallet has enough gas, or (b) Release them back to pool and write off the small balances, or (c) Add a "max idle time" after which dust addresses are automatically released.

3. **⚠️ P1 — Release ERC20 dust address** — `0x5e4e7f...` has $0.000312 USDT-ERC20 stuck for 21+ days. This will never be profitable to sweep. Release it.

4. **⚠️ P2 — Add TRON API rate limiting backoff** — The sweep cron makes rapid sequential resource checks that hit 429s. Add a small delay (200-500ms) between TRON API calls during batch sweep operations.

5. **ℹ️ P3 — Investigate NomadlyNew webhook latency** — The merchant's endpoint consistently times out on first attempt. Consider increasing webhook timeout or alerting the merchant.
