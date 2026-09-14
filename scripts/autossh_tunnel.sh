#!/bin/bash
# SOCKS5 proxy tunnel to German VPS for Binance API access
VPS_HOST="95.179.167.16"
VPS_USER="root"
VPS_PASS='E9o,RRotPdX_d7fC'
LOCAL_PORT=1080

# Kill any existing tunnel
pkill -f "ssh.*-D ${LOCAL_PORT}" 2>/dev/null
sleep 1

export AUTOSSH_GATETIME=0
export SSHPASS="$VPS_PASS"

sshpass -e autossh -M 0 -f -N -D ${LOCAL_PORT} \
  -o "StrictHostKeyChecking=no" \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -o "ExitOnForwardFailure=yes" \
  ${VPS_USER}@${VPS_HOST}

sleep 2

if ss -tlnp | grep -q ":${LOCAL_PORT}"; then
  echo "SOCKS5 proxy tunnel established on port ${LOCAL_PORT}"
else
  echo "ERROR: Failed to establish tunnel"
  exit 1
fi
