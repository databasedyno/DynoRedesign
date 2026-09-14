# Railway Log Analysis Report — 2026-03-15

**Deployment**: `3d2bfb2f-b9af-4758-abf2-e60c4cd2fe54` (deployed Mar 13 21:08, status: SUCCESS)  
**Analysis Period**: 2026-03-13T21:12 → 2026-03-15T11:03 (37+ hours)  
**Analyst**: Automated log analysis

---

## Executive Summary

One TRX payment (`844f75dd`) was processed on March 14 at 23:39 UTC. **The merchant payout succeeded**, but the **admin fee sweep has been failing continuously for 12+ hours** due to a **unit conversion bug** in `getAddressBalance()` for TRX. The code reads the TRX balance in SUN (1 TRX = 1,000,000 SUN) from the Tatum API but treats it as TRX, causing the sweep to attempt transferring ~5.77 million TRX ($1.7M) instead of 5.77 TRX ($1.72).

---

## Issue #1: TRX Admin Fee Sweep Failure (CRITICAL — P0)

### Root Cause

**File**: `backend/apis/tatumApi.ts`, lines 2197–2205  

```typescript
// CURRENT CODE (BUG):
} else if (currency === "TRX") {
    try {
      res = await tatumSdk.blockchain.tron.tronGetAccount(address);
      // ❌ tronGetAccount returns balance in SUN, not TRX!
      // res.balance = "5769762" (SUN) — treated as 5,769,762 TRX
    } catch ...
}
```

**Comparison with correctly handled chains:**
- **XRP** (line 2260): `Number(xrpRes.balance) / 1000000` — converts drops → XRP ✅
- **USDT-ERC20** (line 2182): `Number(tempRes.balance) / 1000000` — converts wei → USDT ✅
- **USDT-TRC20** (line 2214): `Number(tempRes.trc20[0]?.[...]) / 1000000` — converts to USDT ✅
- **TRX** (line 2199): Raw `tronGetAccount()` response, **NO conversion** ❌

### Impact Chain

| Step | What Happens | Expected | Actual |
|------|-------------|----------|--------|
| 1. `getAddressBalance("TRX")` | Reads on-chain TRX balance | 5.77 TRX | 5,769,762 (SUN, no conversion) |
| 2. `checkSweepProfitability()` | Converts to USD | $1.72 | $1,713,768.81 |
| 3. `amountToSend` calculation | Deduct gas (0) | 5.769758 TRX | 5,769,762 "TRX" |
| 4. `tronTransfer({ amount })` | Send to admin wallet | 5.77 TRX | 5,769,762 TRX |
| 5. Tatum broadcast | Submit to TRON network | ✅ Success | ❌ "balance is not sufficient" |

### Evidence (Log Excerpts)

```
[2026-03-15T10:30:02] ✅ TJZ93NM5btx4KA43r6KiGAJ69xw1RUaJiF (TRX): 5.76975808, 649 min since payout — sweeping
[2026-03-15T10:30:05] ✅ Sweep is profitable: $1,713,768.81 balance vs $0.00 fee     ← $1.7M for 5.77 TRX!
[2026-03-15T10:30:05] Account chain sweep: 5769762 - 0 (gas) = 5769762 TRX            ← SUN treated as TRX
[2026-03-15T10:30:05] ❌ Sweep transfer failed: "balance is not sufficient"
```

### Timeline of Failures

| Time | Attempts | Status |
|------|----------|--------|
| 2026-03-14 23:40 | Payment confirmed, admin fee retained: 5.77 TRX | ✅ Merchant payout succeeded |
| 2026-03-14 23:45 | First sweep attempt | ❌ Failed (4 min since payout) |
| 2026-03-15 00:00 | 2nd attempt | ❌ Failed |
| ... | Every 15 min | ❌ Failed |
| 2026-03-15 11:00 | ~48th attempt | ❌ Still failing |

**Total failed sweeps observed**: 48+ over 12+ hours, retrying every 15 minutes.

### Fix

```typescript
// FIXED CODE:
} else if (currency === "TRX") {
    try {
      const tempRes = await tatumSdk.blockchain.tron.tronGetAccount(address);
      // tronGetAccount returns balance in SUN (1 TRX = 1,000,000 SUN)
      res = { balance: (Number(tempRes?.balance || 0) / 1000000).toString() };
    } catch (e: unknown) {
      const err = e as { message?: string };
      if ((err.message || '').includes('account.not.found') || (err.message || '').includes('not.found')) {
        res = { balance: '0' };
      } else { throw e; }
    }
}
```

### Additional Concern: Stuck Pool Address

The pool address `TJZ93NM5btx4KA43r6KiGAJ69xw1RUaJiF` (DB ID: 202) is stuck in an IN_USE → SWEEPING loop. After the fix is deployed:
1. The sweep should succeed on the next cron run (15 min interval)
2. The address should transition to AVAILABLE and be reusable
3. If the address is still stuck, manually reset its status to AVAILABLE and admin_fee_balance to 0 after verifying the on-chain balance

---

## Issue #2: Binance WebSocket Geo-Blocking (LOW — P2)

### What Happened

At deployment startup (Mar 13 21:12), Binance WebSocket connected successfully:
```
[2026-03-13T21:12:41] [Binance] ✅ Direct access OK — non-US deployment detected. Proxy DISABLED.
[2026-03-13T21:12:42] [BinanceWS] ✅ Connected — tracking 10 assets
```

But by Mar 15, the WebSocket got geo-blocked (Railway IPs are static, so this is likely a Binance-side policy change):
```
[2026-03-15T10:56:47] [BinanceWS] ❌ WebSocket error: Unexpected server response: 451
[2026-03-15T10:56:47] [BinanceWS] 🌍 Binance WebSocket geo-blocked from this server region.
[2026-03-15T10:56:47] Reconnecting in 300s (attempt #1, geo-blocked)...
```

### Impact
- Real-time price feeds via WebSocket degraded → falls back to REST API (Tatum rate API)
- Price data is still available but with higher latency
- Volatility monitor initial scan shows 0/10 assets classified (WS connected: false)

### Recommendation
- The SOCKS5 proxy (`BINANCE_PROXY_URL=socks5://127.0.0.1:1080`) is configured but the SSH tunnel to the German VPS may not be active on Railway. Verify the SSH tunnel keepalive script is running.

---

## Issue #3: Security Scanning Activity (INFO)

### What Happened

At **2026-03-15T10:03:54 UTC**, a burst of ~30 requests from a single IP probed for sensitive files:
```
GET /.env                → 404
GET /.git/config         → 404
GET /api/user/createPayment → 404
GET /kyc/submit          → 404
GET /user/onboarding-status → 404
```

### Impact
- All requests returned 404 — **no sensitive data was leaked**
- This is routine automated scanning, not a targeted attack
- The `.env` and `.git/config` requests confirm the server correctly does NOT expose these files

---

## Issue #4: Nginx Response Buffering Warnings (INFO)

```
[warn] upstream response is buffered to a temporary file /var/lib/nginx/tmp/proxy/...
```

This occurs for large static JavaScript chunks being proxied to the Next.js dev server. **Not a functional issue** — it's a performance optimization warning. Can be resolved by increasing `proxy_buffer_size` in nginx.conf if desired.

---

## Payment Flow Analysis: TX 844f75dd

| Time (UTC) | Event |
|------------|-------|
| 23:39:14 | MerchantAPI: Payment created ($48 USD → 161.28 TRX, Company: 3) |
| 23:39:15 | Pool address `TJZ93NM5btx4KA43r6KiGAJ69xw1RUaJiF` reserved (pre-reserved fast path) |
| 23:40:23 | Tatum webhook received: 160.997 TRX from customer |
| 23:40:24 | WebhookProcessor: First transaction detected |
| 23:40:25 | ✅ Email sent to nomadly@moxx.co: "Payment Pending Confirmation" |
| 23:40:26 | Merchant webhook: `payment.pending` → nomadlynew-production.up.railway.app (200 OK) |
| 23:40:26 | State: pending → processing (underpaid within tolerance: -0.283 TRX / -0.17%) |
| 23:40:27 | Merchant webhook: `payment.underpaid` → nomadlynew-production.up.railway.app (200 OK) |
| 23:40:28 | Settlement: Same-wallet mode (admin = merchant wallet for TRX) |
| 23:40:28 | Fee split: Merchant 155.227 TRX, Admin 5.770 TRX (3.58%) |
| 23:40:32 | **✅ Merchant payout TX broadcast** (155.227 TRX) |
| 23:40:38 | Payout TX confirmed in block 80954903 |
| 23:40:41 | Merchant webhook: `payment.confirmed` → 200 OK |
| 23:40:53 | State: processing → payout_complete |
| 23:40:53 | ✅ Email: "Payment received - 155.227 TRX" to nomadly@moxx.co |
| 23:45:05 | **❌ First admin fee sweep attempt FAILS** (TRX unit bug) |
| ... | Sweep retries every 15 min, all fail |

**Verdict**: Payment processing worked correctly. Merchant received their funds. Only the admin fee collection (sweep) is broken due to the SUN→TRX unit conversion bug.

---

## System Health Summary

| Component | Status | Notes |
|-----------|--------|-------|
| PostgreSQL | ✅ Healthy | Connected on startup, no connection errors |
| Redis | ✅ Healthy | Connected, webhook queue operating normally |
| WebhookQueue | ✅ Healthy | Health checks passing every 60s, 0 failed jobs |
| BinanceWS | ⚠️ Degraded | Geo-blocked after IP rotation, using REST fallback |
| Payment Processing | ✅ Operational | Monitoring cron reports "operational" status |
| Admin Fee Sweep | ❌ Broken | TRX sweep failing continuously (unit conversion bug) |
| Nginx | ✅ Running | Minor buffering warnings on large static chunks |

---

## Recommended Actions

1. **[P0] Fix TRX unit conversion** in `getAddressBalance()` — add `/ 1000000` for SUN→TRX
2. **[P0] Deploy fix** and verify the stuck sweep for address 202 succeeds on next cron run
3. **[P1] Add unit test** for `getAddressBalance("TRX")` to ensure it returns TRX not SUN
4. **[P2] Verify SSH tunnel** for Binance SOCKS5 proxy is active on Railway deployment
5. **[P3] Consider adding a sweep failure counter** — after N consecutive failures for the same address, alert admin and pause retries
