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

# --- Per-process launchers (reused for the first boot AND for respawns) -------
# Each process runs from its own cwd; we return to /app afterwards so the rest
# of the script (and the monitor loop) have a stable working directory.
start_backend() {
  ( cd /app/backend && PORT=$BACKEND_PORT exec node dist/server.js ) &
  BACKEND_PID=$!
}
start_frontend() {
  ( cd /app/frontend && PORT=$FRONTEND_PORT HOSTNAME=0.0.0.0 \
      NODE_OPTIONS="--no-warnings --max-old-space-size=1536" exec node server.js ) &
  FRONTEND_PID=$!
}
start_nginx() {
  nginx -g "daemon off;" &
  NGINX_PID=$!
}

# Start Express backend (port 3300)
echo "[start-all] Starting Express backend on port $BACKEND_PORT..."
start_backend

# Start Next.js frontend (port 3000)
echo "[start-all] Starting Next.js frontend on port $FRONTEND_PORT..."
start_frontend

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
start_nginx

echo "[start-all] All services started (backend=$BACKEND_PID, frontend=$FRONTEND_PID, nginx=$NGINX_PID)"

# Notify search engines (IndexNow) that this deployment is live.
# Fire-and-forget: waits 90s for traffic switchover, reads /sitemap.xml from
# the local frontend, submits all URLs. Opt out with INDEXNOW_DISABLED=true.
if [ -f /app/scripts/indexnow-ping.mjs ]; then
  FRONTEND_PORT=$FRONTEND_PORT node /app/scripts/indexnow-ping.mjs --delay 90 &
fi

# Trap signals for graceful shutdown. A function (not a pre-expanded string) so
# it kills the CURRENT pids even after a process has been respawned below.
shutdown() {
  echo "[start-all] Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID $NGINX_PID 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

# --- Supervisor loop: RESPAWN the one process that died, keep the others up ---
# Why: the backend intentionally process.exit(1)s on an uncaughtException (the
# only safe thing to do after an uncaught error). Previously ANY process dying
# tore the whole container down, so a single transient backend crash after idle
# 502'd the ENTIRE site (frontend + API) for the full ~30-60s restart window.
# Now we respawn just the dead process — e.g. a backend crash no longer takes
# the frontend down, and /api recovers in seconds. A genuine crash-loop still
# falls through to a clean full-container restart (compose restart policy) so
# unrecoverable faults are surfaced, not masked forever.
RESTART_LIMIT=${RESTART_LIMIT:-6}      # max respawns within the window before bailing
RESTART_WINDOW=${RESTART_WINDOW:-180}  # seconds
restart_count=0
window_start=$(date +%s)

note_restart() {
  now=$(date +%s)
  if [ $((now - window_start)) -gt "$RESTART_WINDOW" ]; then
    window_start=$now
    restart_count=0
  fi
  restart_count=$((restart_count + 1))
  if [ "$restart_count" -gt "$RESTART_LIMIT" ]; then
    echo "[start-all] Crash loop: ${restart_count} respawns within ${RESTART_WINDOW}s — tearing down for a clean container restart."
    kill $BACKEND_PID $FRONTEND_PID $NGINX_PID 2>/dev/null || true
    exit 1
  fi
}

while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[start-all] ⚠️ Backend exited — respawning (frontend/nginx stay up)."
    note_restart
    start_backend
    k=0
    until curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; do
      if ! kill -0 $BACKEND_PID 2>/dev/null; then break; fi
      k=$((k+1))
      if [ "$k" -ge 60 ]; then break; fi
      sleep 1
    done
    echo "[start-all] Backend respawned (ready after ~${k}s)."
  fi
  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[start-all] ⚠️ Frontend exited — respawning (backend/nginx stay up)."
    note_restart
    start_frontend
  fi
  if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[start-all] ⚠️ Nginx exited — respawning."
    note_restart
    start_nginx
  fi
  sleep 5
done
