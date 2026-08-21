#!/bin/bash
# =============================================================================
# Frontend entrypoint for the DEVELOPMENT / PREVIEW environment.
#
# The Emergent preview pod's supervisor runs `yarn start` inside /app/frontend
# (a tiny bridge package.json) which delegates here.
#
# PRODUCTION (DigitalOcean / Railway) does NOT use this file:
#   - it builds via Dockerfile.frontend (`next build`, output=standalone)
#   - and runs the standalone server: `node server.js`
#   (see railway-frontend.json / Dockerfile.frontend / start-all.sh)
#
# Mode selection (env var wins, then /app/.env, then default):
#   FRONTEND_MODE=dev         -> `next dev`   (hot reload, no build step) [default]
#   FRONTEND_MODE=production  -> `next start` (builds first if no .next/BUILD_ID)
# =============================================================================

set -e
cd /app

MODE="${FRONTEND_MODE:-}"
if [ -z "$MODE" ] && [ -f /app/.env ]; then
  MODE=$(grep -E '^FRONTEND_MODE=' /app/.env | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')
fi
MODE="${MODE:-dev}"

# Self-heal on a fresh pod: /app is restored from git, so node_modules is gone.
# Without this the service crash-loops on "next: No such file or directory"
# until someone installs by hand. flock serialises with the backend installer
# (parallel yarn installs corrupt the shared cache).
yarn_install() {
  # --production=false: NODE_ENV may be "production" in .env, which would make
  # yarn skip devDependencies (next lives in dependencies, but tooling does not).
  flock /tmp/dynopay-yarn-install.lock yarn install --non-interactive --production=false "$@"
}
if [ ! -x /app/node_modules/.bin/next ]; then
  echo "[start-frontend] node_modules missing -> yarn install (fresh-pod self-heal, ~1-2 min)..."
  yarn_install --network-concurrency 16 || true
  if [ ! -x /app/node_modules/.bin/next ]; then
    # yarn reports "already up-to-date" for a partially-present tree; --check-files repairs it.
    echo "[start-frontend] binaries still missing -> retrying with --check-files"
    yarn_install --check-files || true
  fi
  if [ ! -x /app/node_modules/.bin/next ]; then
    echo "[start-frontend] yarn install FAILED — backing off 30s before supervisor retries"
    sleep 30
    exit 1
  fi
  echo "[start-frontend] deps installed"
fi

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
export HOSTNAME=0.0.0.0
export PORT=3000

if [ "$MODE" = "production" ] || [ "$MODE" = "prod" ] || [ "$MODE" = "start" ]; then
  if [ ! -f /app/.next/BUILD_ID ]; then
    echo "[start-frontend] FRONTEND_MODE=$MODE but no production build found -> running next build first..."
    node_modules/.bin/next build
  fi
  echo "[start-frontend] Starting Next.js in PRODUCTION mode (next start)"
  exec node_modules/.bin/next start -p 3000 -H 0.0.0.0
else
  # A production build left in .next confuses `next dev` (stale manifests).
  # BUILD_ID only exists after `next build`, so this runs exactly once when
  # switching prod -> dev and never wipes the dev cache afterwards.
  if [ -f /app/.next/BUILD_ID ]; then
    echo "[start-frontend] Removing stale production build before dev start"
    rm -rf /app/.next
  fi
  # Prewarm: `next dev` compiles on first request (15-35s). Warming the hot
  # routes in the background means the first human click is instant.
  # flock -n keeps a single warmer alive across restart storms.
  (
    exec 9>/tmp/dynopay-prewarm.lock
    flock -n 9 || exit 0
    for _ in $(seq 1 60); do
      curl -sf -o /dev/null --max-time 90 http://localhost:3000/ && break
      sleep 2
    done
    for route in /auth/login /dashboard /pay; do
      curl -sf -o /dev/null --max-time 90 "http://localhost:3000$route" || true
    done
    echo "[start-frontend] prewarm complete (/, /auth/login, /dashboard, /pay compiled)"
  ) &

  echo "[start-frontend] Starting Next.js in DEV mode (hot reload enabled)"
  exec node_modules/.bin/next dev -p 3000 -H 0.0.0.0
fi
