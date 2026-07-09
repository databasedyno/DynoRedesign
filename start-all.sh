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

# Wait for backend and frontend to be ready
echo "[start-all] Waiting for services to start..."
sleep 3

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
