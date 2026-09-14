#!/bin/bash
# SSH SOCKS5 Tunnel Keep-Alive for Binance Proxy
# Fallback script — primary management is via sshTunnelManager.ts in Node.js
# Usage: bash /app/backend/scripts/ssh-tunnel-keepalive.sh &

VPS_IP="${SSH_TUNNEL_HOST:-95.179.167.16}"
VPS_USER="${SSH_TUNNEL_USER:-root}"
VPS_PASS="${SSH_TUNNEL_PASS:-E9o,RRotPdX_d7fC}"
LOCAL_PORT="${SSH_TUNNEL_LOCAL_PORT:-1080}"
CHECK_INTERVAL=30

ensure_tunnel() {
    if ! lsof -i:${LOCAL_PORT} >/dev/null 2>&1; then
        echo "[$(date)] SSH tunnel down, reconnecting..."
        sshpass -p "${VPS_PASS}" ssh \
            -o StrictHostKeyChecking=no \
            -o ServerAliveInterval=60 \
            -o ServerAliveCountMax=3 \
            -o ExitOnForwardFailure=yes \
            -o ConnectTimeout=10 \
            -D ${LOCAL_PORT} -f -N ${VPS_USER}@${VPS_IP}
        
        if [ $? -eq 0 ]; then
            echo "[$(date)] SSH tunnel re-established on port ${LOCAL_PORT}"
        else
            echo "[$(date)] SSH tunnel reconnection FAILED"
        fi
    fi
}

echo "[$(date)] SSH tunnel keepalive started (checking every ${CHECK_INTERVAL}s)"
while true; do
    ensure_tunnel
    sleep ${CHECK_INTERVAL}
done
