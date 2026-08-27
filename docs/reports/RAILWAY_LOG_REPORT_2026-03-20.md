# Railway Log Analysis Report — 2026-03-20

**Deployment**: `b969bb94-0189-4459-8911-e961b3791fbc` (deployed Mar 15 11:16, status: SUCCESS)  
**Analysis Period**: 2026-03-15T11:20 → 2026-03-20T17:10 (~5 days runtime)  
**Logs Analyzed**: 2,001 runtime logs + 1,729 startup logs + HTTP logs  
**Previous Reports**: [2026-02-23](/app/RAILWAY_LOG_REPORT_2026-02-23.md), [2026-03-15](/app/RAILWAY_LOG_REPORT_2026-03-15.md)

---

## Executive Summary

The latest deployment has been running stably for ~5 days with **no crashes, OOM events, or restarts**. However, there are **2 payments permanently stuck in 'processing'** for 94+ hours, generating continuous watchdog warnings every 2 minutes (~2,800+ alerts since getting stuck). The Binance WebSocket geo-blocking issue from the previous report has returned. The TRX SUN→TRX unit conversion bug from the Mar 15 report **has been fixed** and is no longer causing sweep failures.

---

## 🔴 ANOMALY #1: Two Payments Stuck in 'processing' (CRITICAL — P0)

### Details

| Field | Value |
|-------|-------|
| **Payment IDs** | `69f71235-e9a7-41b6-a2f7-780e0bb21366`, `a7f60980-2bc4-439b-9d05-d2022aae021c` |
| **State** | `processing` (stuck) |
| **Duration Stuck** | 5,649+ minutes (~94 hours / ~3.9 days) as of latest log |
| **First Seen** | ~Mar 16 at ~23:00 UTC (calculated: 5649 min before Mar 20 17:10) |
| **Watchdog Frequency** | Every 2 minutes |
| **Estimated Alert Count** | ~2,800+ warnings generated |

### Evidence

```
[2026-03-20T16:28:51] [Watchdog] ⚠️ 2 payment(s) stuck in 'processing' for >10 min. Oldest: 5609 min.
[2026-03-20T17:10:03] [Watchdog] ⚠️ 2 payment(s) stuck in 'processing' for >10 min. Oldest: 5649 min.
```

The "oldest" counter increments by 2 every 2 minutes, confirming these payments have been stuck without any state change for the entire observation window.

### Impact

- **Merchant(s) not paid**: These payments are stuck between receiving crypto and completing the payout
- **Pool addresses locked**: The associated pool addresses are likely stuck in IN_USE/SWEEPING state, reducing address pool capacity
- **Log noise**: ~2,800 watchdog warnings are generated, potentially masking other important alerts
- **No auto-recovery**: The watchdog detects but does NOT auto-remediate

### Recommended Solutions

1. **Immediate**: Investigate both payment IDs in the database to determine:
   - Which currency/company they belong to
   - Whether the merchant payout transaction was broadcast but not confirmed
   - Whether they're related to the TRON OUT_OF_ENERGY issue from the PRD
2. **Use the recovery endpoint**: `POST /diagnostics/recover-stuck-payment` with each payment_id
3. **Code fix**: Add auto-escalation to the watchdog — if a payment is stuck >60 min, attempt automatic recovery or at minimum send an admin email alert (not just log)
4. **Add a sweep failure circuit breaker**: After N consecutive retries, mark the payment for manual review instead of infinite retry

---

## 🟡 ANOMALY #2: Binance WebSocket Geo-Blocking (MEDIUM — P2)

### Details

At deployment startup (Mar 15 11:20), Binance connected successfully:
```
[2026-03-15T11:20:48] [Binance] ✅ Direct access OK — non-US deployment detected. Proxy DISABLED.
[2026-03-15T11:20:49] [BinanceWS] ✅ Connected — tracking 10 assets
```

However, in the most recent runtime logs (Mar 20), the Binance connection has been geo-blocked again:
```
[Binance] 🌍 Geo-blocked but proxy also failed. Proxy DISABLED (will retry next cycle).
[BinanceWS] Starting Binance WebSocket price stream...
[BinanceWS] Connecting to 10 streams (BTC, ETH, LTC, DOGE, SOL, XRP, BCH, BNB, TRX, POL)...
```

### Impact

- Real-time price streaming via WebSocket is **down**
- System falls back to REST-based Tatum rate API (higher latency, ~3s per refresh cycle)
- Volatility monitoring has insufficient data for TRX and POL
- Price data is still functional but degraded

### Recommended Solutions

1. **Verify the SOCKS5 proxy tunnel**: The `BINANCE_PROXY_URL=socks5://127.0.0.1:1080` is configured but the SSH tunnel to the German VPS likely isn't active on Railway
2. **Alternative**: Use a third-party WebSocket proxy service that relays Binance streams
3. **Long-term**: Consider switching to CoinGecko or CryptoCompare WebSocket as a fallback price source

---

## 🟡 ANOMALY #3: Tatum API 403 for Certain Currency Pairs (MEDIUM — P3)

### Details

```
[2026-03-15T11:20:49] [currencyConvert] Tatum rate API failed for TRX→BRL: 403
[2026-03-15T11:20:49] [currencyConvert] Tatum rate API failed for TRX→GBP: 403
```

The Tatum rate API returns 403 for TRX→BRL and TRX→GBP pairs, classified as "permanently unsupported" and cached for 24 hours.

### Impact

- **Mitigated**: Cross-rate recovery fills the gap (TRX→USD × USD→BRL, TRX→USD × USD→GBP)
- Cross-rate recovery confirmed working in logs:
  ```
  [BackgroundCache] 🔗 Cross-rate recovery: TRX→GBP = 0.231105 (via TRX→USD × USD→GBP)
  [BackgroundCache] 🔗 Cross-rate recovery: TRX→BRL = 1.627806 (via TRX→USD × USD→BRL)
  ```
- No action needed unless cross-rate accuracy becomes an issue

---

## 🟡 ANOMALY #4: Unsigned Webhook from Unknown IP (MEDIUM — P2)

### Details

```
[2026-03-15T11:30:48] [WebhookAuth] Unsigned webhook from UNKNOWN IP 34.145.44.151 — allowing but flagged for review
```

### Impact

- Webhook was accepted without HMAC signature verification
- IP `34.145.44.151` is likely a Google Cloud IP (Tatum infrastructure) but not in the allowlist
- This is a recurring issue from the Feb 23 report (BUG 8)

### Recommended Solutions

1. Update the Tatum IP allowlist to include `34.145.44.x` range
2. Migrate legacy webhook subscriptions to include HMAC signing
3. Consider enforcing strict signature verification and rejecting unsigned webhooks

---

## 🔵 ANOMALY #5: WebPush Disabled (LOW — P3)

### Details

```
[2026-03-15T11:20:42] [WebPush] VAPID keys not configured — web push disabled
```

### Impact

- Browser push notifications for payment alerts are not functioning
- Users must rely on email notifications only

### Recommended Solution

- Generate VAPID keys and set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` environment variables if push notifications are desired

---

## 🔵 ANOMALY #6: Health Check Failure During Startup (LOW — Transient)

### Details

```
[2026-03-15T11:20:44] [error] connect() failed (111: Connection refused) while connecting to upstream... 
request: "GET /health HTTP/1.1", upstream: "http://127.0.0.1:3300/health"
```

### Impact

- **Transient only**: Railway's healthcheck hit the backend before Node.js fully started on port 3300
- Backend came up within seconds and subsequent healthchecks passed
- No user-facing impact

### Recommended Solution

- Add a `startPeriod` or health check delay in Railway config to allow Node.js startup time

---

## ✅ Previously Reported Issues — Status Update

| Issue | Report | Status | Notes |
|-------|--------|--------|-------|
| TRX SUN→TRX unit conversion bug | Mar 15 | ✅ **FIXED** | Code confirmed: `/ 1000000` conversion added at line 2203 of tatumApi.ts |
| Binance WebSocket geo-blocking | Mar 15 | ⚠️ **RECURRING** | Connected at deployment, blocked again by Mar 20 |
| POLYGON conversion stuck PENDING_DEPOSIT | Feb 23 | ❓ Unknown | Not observed in current logs (may be resolved or different payments) |
| BTC UTXO findOutputIndex bug | Feb 23 | ❓ Unknown | No BTC payments observed in this log window |
| LTC Merchant Webhook 404 | Feb 23 | ❓ Unknown | No LTC webhook failures in this window |
| State machine missing 'detected' transition | Feb 23 | ❓ Likely still present | No new payment processing events in this log window to confirm |
| DOGE pool address stuck NaN | Feb 23 | ❓ Unknown | Not mentioned in current logs |

---

## System Health Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Deployment** | ✅ Stable | 5 days uptime, no crashes/restarts |
| **PostgreSQL** | ✅ Healthy | No connection errors |
| **Redis** | ✅ Healthy | Connected successfully at startup |
| **WebhookQueue (BullMQ)** | ✅ Healthy | Health checks passing every 60s: waiting=0, active=0, failed=0 |
| **Payment Processing** | ⚠️ 2 stuck | 2 payments stuck in 'processing' for 94+ hours |
| **Binance WebSocket** | ❌ Geo-blocked | Using REST API fallback (Tatum rates) |
| **Tatum Rate API** | ✅ Operational | 36-40 rates refreshed per cycle in ~3s, cross-rate recovery working |
| **Address Pool Warming** | ✅ Operational | Pre-reserving addresses for companies 4, 16, 28, 72, 77 across multiple currencies |
| **Admin Fee Sweeps** | ✅ Operational | TRX sweep bug fixed; no sweep failures observed |
| **Error Monitoring** | ✅ Active | Digest emails being sent to moxxcompany@gmail.com every 15 min |
| **Webhook Auth** | ⚠️ Permissive | Unsigned webhooks from unknown IPs still accepted |
| **Web Push** | ❌ Disabled | VAPID keys not configured |

---

## Recommended Priority Actions

| Priority | Action | Effort |
|----------|--------|--------|
| **P0** | Investigate and recover 2 stuck payments (`69f71235...`, `a7f60980...`) via `/diagnostics/recover-stuck-payment` | 1-2 hours |
| **P0** | Add auto-recovery/escalation to watchdog for payments stuck >60 min | 4-6 hours |
| **P1** | Verify/fix SOCKS5 proxy for Binance WebSocket on Railway | 2-3 hours |
| **P1** | Update Tatum webhook IP allowlist with new Google Cloud IPs | 1 hour |
| **P2** | Add circuit breaker to stuck payment retry logic | 3-4 hours |
| **P2** | Configure VAPID keys for web push notifications | 1 hour |
| **P3** | Add Railway health check start delay to avoid transient 502s | 30 min |

---

*Report generated from Railway GraphQL API (Project-Access-Token). Deployment b969bb94 on api.dynopay.com.*
