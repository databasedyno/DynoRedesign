# Railway Log Analysis — 2026-04-09

**Deployment analyzed**: `2ddc34c0-fe15-41b6-9cb8-627e8d6c2d7c` (SUCCESS, Apr 7 15:30 → present)  
**Log window**: 2026-04-09 04:20 UTC → 08:10 UTC (~4 hours, 2001 log entries)  
**Previous deployment cross-referenced**: `e8f8172a` (Apr 7 11:58–15:19, had 17 error-level logs)

---

## Executive Summary

| Category | Status | Severity |
|----------|--------|----------|
| Application errors (current deployment) | 0 error-level logs | ✅ Healthy |
| Fee wallet balances | 3 of 4 below threshold | 🔴 Critical |
| Stuck merchant pool sweeps | 5 addresses in infinite defer loop | 🟡 Medium |
| Stale USDT-TRC20 funds | 3 addresses with unsweepable USDT (~$7.27 total) | 🟡 Medium |
| Stablecoin conversion cron | Running idle (230 cycles, 0 conversions) | 🟡 Investigate |
| FeeWalletMonitor API failure | 1 transient failure at 07:32 UTC | 🟡 Low |
| Security probes | WordPress/PHP attack scans detected | ℹ️ Info (handled correctly) |
| Previous deployment errors | OUT_OF_ENERGY TRON settlement failures | ℹ️ Resolved by redeploy |

---

## 🔴 CRITICAL: Fee Wallet Balances Below Threshold

Three of four fee wallets are **below the $30 alert threshold**, which means settlements on these chains may fail due to insufficient gas:

| Chain | Balance | USD Value | Threshold | Status |
|-------|---------|-----------|-----------|--------|
| **POLYGON** | 3.7293 MATIC | **$0.32** | $30 | 🔴 **CRITICALLY LOW** |
| **XRP** | 10.300 XRP | **$13.72** | $30 | 🟡 Low |
| **ETH** | 0.01194 ETH | **$26.05** | $30 | 🟡 Low |
| **TRX** | 94.90 TRX | ~$28-30 | WARNING | ⚠️ Warning |

**Impact**: Any incoming POLYGON, XRP, or ETH payments that require settlement will fail because there isn't enough gas to execute the transfer. POLYGON is most critical at **$0.32** — essentially empty.

**Alert status**: Low-balance alert was already sent and is suppressed (expires in ~35h). No new alerts will fire until the suppression expires, even though the situation is worsening.

**Recommendation**: 
1. **Immediately top up POLYGON fee wallet** with at least $50 worth of MATIC
2. Top up XRP fee wallet with ~20 XRP
3. Top up ETH fee wallet with ~0.015 ETH
4. Consider whether the alert suppression window (48h) is too long — if wallets aren't topped up within that window, no reminder is sent

---

## 🟡 MEDIUM: Stuck Merchant Pool Sweep Loop

**5 pool addresses** are caught in an infinite defer-retry loop. Every 30 minutes, the sweep cron:
1. Identifies them as eligible for time-based sweep
2. Acquires a lock for each
3. Determines they're "unprofitable" (gas cost > balance value)
4. Defers them to Apr 14–16
5. Releases the lock
6. Repeats next cycle (the deferral isn't being respected)

### Affected Addresses

**USDT-TRC20 (stale tokens, marked "force sweeping" but still deferred):**
| Address | Balance | Idle Time |
|---------|---------|-----------|
| `TRisAcnVJpaQd46No53CcDxEZTPKCvCXbW` | 3.63 USDT | ~58 days (84,673 min) |
| `TSVRT7Z1X68UJEhTNzwpqNxaTbfg5t5Yr7` | 2.052 USDT | ~7 days (10,050 min) |
| `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe` | 1.585 USDT | ~1.3 days (1,934 min) |

**ETH (dust balances):**
| Address | Balance | Idle Time |
|---------|---------|-----------|
| `0xdb0c01c41879d877654050002e6e6f283841c9c3` | 0.005148 ETH (~$11.22) | ~35 days |
| `0x7c5bba3218950cb3c965cd52e5151d9c4f64d8f6` | 0.00277 ETH (~$6.04) | ~31 days |

**Total stranded value**: ~$7.27 USDT + ~$17.26 ETH = **~$24.53**

**Root cause**: The sweep deferral mechanism records a future date (e.g., `2026-04-14T14:00:06`) but the next cron cycle (30 min later) doesn't check the deferral date — it re-identifies the addresses and tries again. This is a **bug in the deferral check logic**.

**Impact**: 
- Wasting ~160 cron log entries per hour (5 addresses × 8 sweep cycles/4hr × 4 log entries each)
- Unnecessary Redis lock contention
- $24.53 in stranded funds

**Recommendation**:
1. Fix the deferral check in `merchantPoolSweep.ts` to actually skip addresses whose deferral date hasn't passed
2. For the USDT-TRC20 addresses, consider a manual sweep if TRX gas costs have dropped, or mark them as permanently deferred
3. For the ETH dust, consider if these are worth sweeping given current gas prices

---

## 🟡 INVESTIGATE: Stablecoin Conversion Cron Fully Idle

The stablecoin conversion cron ran **230 lock/release cycles** in the 4-hour window but performed **zero actual conversions**. The pattern is:
```
[Lock] Acquired: cron:stablecoinConversion (TTL: 240s)
[Lock] Released: cron:stablecoinConversion
```
With no conversion activity logged between acquire and release.

**Possible explanations**:
- ✅ No volatile crypto received recently (no pending conversions) — most likely
- ⚠️ Binance integration is misconfigured or disconnected (no SSH tunnel/proxy events visible)
- ⚠️ Auto-convert is disabled for all merchants

**No SSH tunnel or Binance proxy events** appear anywhere in the logs, which is unusual given the README mentions US servers need SOCKS5 tunnels for Binance.

**Recommendation**: Verify Binance connectivity by checking `GET /api/diagnostics/binance-ping` (requires admin auth) or reviewing the `BINANCE_API_KEY` configuration.

---

## 🟡 LOW: FeeWalletMonitor API Transient Failure

At **07:32:06 UTC**, the FeeWalletMonitor failed to check the TRX fee wallet:
```
[cronLogger] warn: [FeeWalletMonitor] API call failed:  — skipping alert cycle to avoid false positive
[cronLogger] info: [FeeWalletMonitor] ⏭️ Using last known status (94.90 TRX) due to API error
```

**Note**: The error message is **empty** after "API call failed:" — this suggests the error object isn't being serialized properly.

**Impact**: Minimal — the monitor correctly fell back to the last known value and recovered by the next cycle (08:02 UTC).

**Recommendation**: Fix the error message serialization in `feeWalletMonitor.ts` to capture the actual error (e.g., `err.message || JSON.stringify(err)`).

---

## ℹ️ INFO: Security Probes Detected (Handled Correctly)

Automated vulnerability scanners probed the application:

| Time (UTC) | Path | Status | Type |
|------------|------|--------|------|
| 06:57:30 | `GET /wp-content/plugins/hellopress/wp_filemanager.php` | 404 | WordPress plugin exploit |
| 06:57:30 | `GET /a7.php` | 404 | PHP webshell probe |
| 06:17:47 | `GET /.well-known/passkey-endpoints` | 404 | Apple passkey discovery |
| 06:41:48 | `GET /` (UA: `fasthttp`) | 200 | Bot/scanner framework |

All attack attempts correctly returned 404. The `fasthttp` user-agent is commonly used by automated scanners but got a standard 200 response on the homepage, which is expected.

**Recommendation**: No action needed. Consider adding rate limiting for 404 responses from suspicious user agents, or adding `fasthttp` to bot protection rules.

---

## ℹ️ INFO: Previous Deployment Errors (Apr 7, Now Resolved)

The prior deployment (`e8f8172a`) had **17 error-level logs** between 14:36–14:37 UTC, all related to a TRON `OUT_OF_ENERGY` settlement failure:

- **Payment**: USDT-TRC20 transfer from `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe`
- **TX hash**: `1f8f52a54880f89...` failed 3 retry attempts
- **Root cause**: Gas funding provided insufficient energy for TRC20 token transfer
- **Resolution**: New deployment (`2ddc34c0`) deployed at 15:30 UTC; current deployment shows zero errors

**Note**: The `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe` address still appears in the stuck sweep loop (1.585 USDT), suggesting the funds from this failed settlement were never recovered.

---

## System Health Summary

| Component | Status | Details |
|-----------|--------|---------|
| Express/Node.js server | ✅ Running | No crashes, no restarts in window |
| WebhookQueue (BullMQ) | ✅ Healthy | Health checks every 60s: waiting=0, active=0, failed=0 |
| Webhook delivery monitor | ✅ Operational | 171–358ms response times |
| Currency rate cache | ✅ Working | Refreshing 36 rates via Tatum every 2h |
| Orphan payment detection | ✅ Clean | Scanned 206 addresses, 0 orphans found |
| Incomplete payment processing | ✅ Clean | 0 pending payment links, immediate lock release |
| Address pool pre-warming | ✅ Running | Checking 57 merchant+chain combinations |
| Cron job execution | ✅ All running | All cron jobs acquiring and releasing locks properly |
| Database (PostgreSQL) | ✅ Connected | No connection errors in window |
| Redis | ✅ Connected | Lock operations all succeeding |

---

## Recommended Actions (Priority Order)

1. 🔴 **Top up fee wallets** — POLYGON ($0.32), XRP ($13.72), ETH ($26.05) immediately
2. 🟡 **Fix sweep deferral bug** — Addresses 3, 12, 45, 56, 58 are re-tried every cycle despite being deferred
3. 🟡 **Investigate Binance connectivity** — 230 idle conversion cycles, no tunnel/proxy events
4. 🟡 **Recover stranded USDT** — 3 TRC20 addresses with ~$7.27 USDT stuck for days/weeks
5. ℹ️ **Fix FeeWalletMonitor error serialization** — Empty error message at 07:32 UTC
6. ℹ️ **Review alert suppression window** — 48h may be too long for critical fee wallet alerts
