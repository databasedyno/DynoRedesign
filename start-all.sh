#!/bin/sh
set -e

# Ports
NGINX_PORT=${PORT:-8001}
BACKEND_PORT=3300
FRONTEND_PORT=3000

echo "[start-all] Starting DynoPay combined service"
echo "[start-all] nginx=$NGINX_PORT  backend=$BACKEND_PORT  frontend=$FRONTEND_PORT"

# Generate nginx config with actual port
sed "s/NGINX_PORT/$NGINX_PORT/g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start Express backend (port 3300)
echo "[start-all] Starting Express backend on port $BACKEND_PORT..."
cd /app/backend
PORT=$BACKEND_PORT node dist/server.js &
BACKEND_PID=$!

# Start Next.js frontend (port 3000)
echo "[start-all] Starting Next.js frontend on port $FRONTEND_PORT..."
cd /app/frontend
PORT=$FRONTEND_PORT HOSTNAME=0.0.0.0 NODE_OPTIONS="--no-warnings --max-old-space-size=1536" node server.js &
FRONTEND_PID=$!

# --- Wait for the BACKEND to be ready before starting nginx ---
# nginx proxies /api AND /health to the backend on :$BACKEND_PORT. If nginx
# comes up before the backend finishes its heavy boot (DB connect, versioned
# migrations, ledger/pool init, leader election), then:
#   - /api requests hit a not-yet-listening upstream -> nginx logs
#     "connect() failed (111: Connection refused)", and
#   - the platform /health probe (also proxied to the backend) flaps and can
#     fail the deploy readiness check ("DeployContainerHealthChecksFailed").
# The backend only answers /health AFTER app.listen(), i.e. once boot is done —
# so block here until it responds (bounded), with a fallback so a slow backend
# never leaves the site as a total outage.
BACKEND_WAIT=${BACKEND_WAIT:-120}
echo "[start-all] Waiting up to ${BACKEND_WAIT}s for backend /health on :$BACKEND_PORT..."
i=0
until curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[start-all] Backend process died during startup — aborting."
    kill $FRONTEND_PID 2>/dev/null || true
    exit 1
  fi
  i=$((i+1))
  if [ "$i" -ge "$BACKEND_WAIT" ]; then
    echo "[start-all] WARNING: backend not ready after ${BACKEND_WAIT}s — starting nginx anyway to avoid a total outage."
    break
  fi
  sleep 1
done
if [ "$i" -lt "$BACKEND_WAIT" ]; then
  echo "[start-all] Backend is ready after ~${i}s."
fi

# Frontend (Next.js standalone) usually boots in a couple of seconds — brief grace.
j=0
until curl -sf "http://127.0.0.1:$FRONTEND_PORT/" >/dev/null 2>&1; do
  j=$((j+1))
  if [ "$j" -ge 30 ]; then
    echo "[start-all] Frontend not answering after ${j}s — starting nginx anyway."
    break
  fi
  sleep 1
done

# Start nginx reverse proxy (listens on PORT)
echo "[start-all] Starting nginx on port $NGINX_PORT..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "[start-all] All services started (backend=$BACKEND_PID, frontend=$FRONTEND_PID, nginx=$NGINX_PID)"

# Notify search engines (IndexNow) that this deployment is live.
# Fire-and-forget: waits 90s for traffic switchover, reads /sitemap.xml from
# the local frontend, submits all URLs. Opt out with INDEXNOW_DISABLED=true.
if [ -f /app/scripts/indexnow-ping.mjs ]; then
  FRONTEND_PORT=$FRONTEND_PORT node /app/scripts/indexnow-ping.mjs --delay 90 &
fi

# Trap signals for graceful shutdown
trap "echo '[start-all] Shutting down...'; kill $BACKEND_PID $FRONTEND_PID $NGINX_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Monitor all processes — if any dies, shut everything down
while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[start-all] Backend process exited!"
    break
  fi
  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[start-all] Frontend process exited!"
    break
  fi
  if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[start-all] Nginx process exited!"
    break
  fi
  sleep 5
done

echo "[start-all] A process exited unexpectedly. Shutting down all..."
kill $BACKEND_PID $FRONTEND_PID $NGINX_PID 2>/dev/null || true
exit 1
