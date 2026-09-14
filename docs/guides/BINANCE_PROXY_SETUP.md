# Binance Proxy Setup Complete ✅

## Overview
The Binance API proxy has been successfully configured and is now operational. This allows DynoPay to access Binance API from geo-blocked regions (US servers) by routing traffic through a German VPS.

## What Was Done

### 1. Installed Required Tools
- **sshpass**: Password-based SSH authentication
- **autossh**: Automatic SSH tunnel reconnection

### 2. Created SOCKS5 Tunnel
- **VPS Server**: 95.179.167.16 (Germany)
- **Local Port**: 1080
- **Protocol**: SOCKS5 proxy via SSH
- **Connection**: Persistent tunnel with automatic reconnection

### 3. Supervisor Service Configuration
Created `/etc/supervisor/conf.d/binance-tunnel.conf` with:
- Auto-start on system boot
- Auto-restart on failure
- Keep-alive monitoring (30s interval)
- Proper logging

## Current Status

### ✅ All Systems Operational

```json
{
  "backend": "RUNNING",
  "binance_tunnel": "RUNNING",
  "binance_websocket": {
    "connected": true,
    "geo_blocked": false,
    "cached_prices": 10,
    "cached_klines": 10,
    "rest_fallback_failures": 0
  }
}
```

### Service Details

**SOCKS5 Tunnel**: ✅ Active on 127.0.0.1:1080
- Supervisor process: `binance-tunnel`
- Logs: `/var/log/supervisor/binance-tunnel.{out,err}.log`
- Auto-restarts on connection failure

**Binance WebSocket**: ✅ Connected
- Tracking 10 cryptocurrency pairs
- Live price streaming active
- Using proxy successfully

**Backend API**: ✅ Healthy
- Auto-conversion service operational
- Binance Convert API accessible
- All 15 blockchain chains supported

## Technical Configuration

### Environment Variables (.env)
```bash
BINANCE_API_KEY=REDACTED_BINANCE_API_KEY
BINANCE_API_SECRET=REDACTED_BINANCE_SECRET
BINANCE_BASE_URL=https://api.binance.com
BINANCE_PROXY_URL=socks5://127.0.0.1:1080
```

### Smart Proxy Detection
The backend automatically detects if proxy is needed:
1. Tests direct Binance access first
2. If geo-blocked (HTTP 451/403) → enables proxy
3. If direct access works → skips proxy for lower latency

### Supervisor Configuration
Location: `/etc/supervisor/conf.d/binance-tunnel.conf`

The tunnel:
- Runs as root user
- Uses autossh for reliability
- Monitors connection health (ServerAliveInterval: 30s)
- Logs all activity
- Priority: 10 (starts early in boot sequence)

## Management Commands

### Check Status
```bash
sudo supervisorctl status binance-tunnel
netstat -tulpn | grep 1080
curl --socks5 127.0.0.1:1080 -s https://api.binance.com/api/v3/ping
```

### Restart Tunnel
```bash
sudo supervisorctl restart binance-tunnel
```

### View Logs
```bash
tail -f /var/log/supervisor/binance-tunnel.out.log
tail -f /var/log/supervisor/backend.out.log | grep Binance
```

### Test Binance Connection
```bash
# Test proxy connectivity
curl --socks5 127.0.0.1:1080 -s https://api.binance.com/api/v3/time

# Check backend health
curl -s http://localhost:8001/health | jq '.binance_websocket'
```

## Troubleshooting

### If Tunnel Fails
1. Check supervisor status: `sudo supervisorctl status binance-tunnel`
2. View error logs: `tail -50 /var/log/supervisor/binance-tunnel.err.log`
3. Test VPS connectivity: `ping 95.179.167.16`
4. Restart service: `sudo supervisorctl restart binance-tunnel`

### If Binance Still Geo-Blocked
1. Verify proxy is listening: `netstat -tulpn | grep 1080`
2. Test proxy manually: `curl --socks5 127.0.0.1:1080 https://api.binance.com/api/v3/ping`
3. Check backend logs: `grep "Binance" /var/log/supervisor/backend.out.log | tail -20`
4. Restart backend: `sudo supervisorctl restart backend`

### Manual Tunnel Setup
If supervisor service fails, you can start manually:
```bash
bash /app/scripts/autossh_tunnel.sh
```

## Features Enabled

With the proxy operational, these features now work:

### ✅ Auto-Stablecoin Conversion
- Volatile crypto → USDT/USDC conversion via Binance Convert API
- Instant quote retrieval
- Automatic conversion execution
- Withdrawal to merchant wallets

### ✅ Live Price Streaming
- Real-time cryptocurrency prices via WebSocket
- 10 major pairs: BTC, ETH, LTC, DOGE, SOL, XRP, BCH, BNB, TRX, POL
- Kline (candlestick) data for volatility monitoring
- Automatic fallback to REST API if WebSocket fails

### ✅ Conversion Service
- Background processing of pending conversions
- Deposit detection
- Quote acceptance
- Withdrawal execution
- Full audit trail

## Next Steps

The Binance proxy is now fully operational and will:
1. ✅ Auto-start on server restart
2. ✅ Auto-reconnect if connection drops
3. ✅ Log all activity for debugging
4. ✅ Support all Binance API operations

No further action needed - the system is production-ready!

---

**Setup Completed**: February 13, 2026
**Status**: ✅ Fully Operational
**Monitored By**: Supervisor
