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
# Mode selection (env var wins, then /app/.env.local, then default):
#   FRONTEND_MODE=dev         -> `next dev`   (hot reload, no build step) [default]
#   FRONTEND_MODE=production  -> `next start` (builds first if no BUILD_ID)
#
# ROOT-LEVEL `.env` AND `.next` MUST NOT EXIST IN THE POD (2026-09):
#   Emergent's commit tool stages with `git add -A ':(exclude).env' ':(exclude).next/*' …`
#   and git 2.39 exits 1 ("paths are ignored: .env .next") whenever an IGNORED
#   entry literally named `.env` or `.next` sits at the repo root — so every
#   checkpoint / Save-to-GitHub commit silently aborted before `git commit`.
#   Nested names are unaffected. Hence: env lives in /app/.env.local (Next.js
#   loads it natively) and the dev build dir is /app/.next-dev (NEXT_DIST_DIR).
# =============================================================================

set -e
cd /app

# Self-heal legacy layouts (see header): root .env -> .env.local, drop root .next
if [ -f /app/.env ]; then
  if [ -f /app/.env.local ]; then
    mv /app/.env "/app/.env.bak.$(date +%s)"
    echo "[start-frontend] moved stray /app/.env aside (.env.local already present)"
  else
    mv /app/.env /app/.env.local
    echo "[start-frontend] migrated /app/.env -> /app/.env.local"
  fi
fi
if [ -d /app/.next ]; then
  rm -rf /app/.next
  echo "[start-frontend] removed legacy /app/.next (dev builds now use .next-dev)"
fi

MODE="${FRONTEND_MODE:-}"
if [ -z "$MODE" ] && [ -f /app/.env.local ]; then
  MODE=$(grep -E '^FRONTEND_MODE=' /app/.env.local | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')
fi
MODE="${MODE:-dev}"

# Self-heal on a fresh pod: /app is restored from git, so node_modules is gone.
# Without this the service crash-loops on "next: No such file or directory"
# until someone installs by hand. flock serialises with the backend installer
# (parallel yarn installs corrupt the shared cache).
yarn_install() {
  # --production=false: NODE_ENV may be "production" in .env, which would make
  # yarn skip devDependencies (next lives in dependencies, but tooling does not).
  # --prefer-offline: use the warm yarn cache and skip the flaky registry fetch
  # (the "trouble with your network connection. Retrying..." stall that left the
  # first pass incomplete and forced a slow --check-files re-run). Falls back to
  # the network only for genuine cache misses, so it is always safe.
  flock /tmp/dynopay-yarn-install.lock yarn install --non-interactive --production=false --prefer-offline "$@"
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

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export HOSTNAME=0.0.0.0
export PORT=3000

if [ "$MODE" = "production" ] || [ "$MODE" = "prod" ] || [ "$MODE" = "start" ]; then
  export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-prod}"
  if [ ! -f "/app/$NEXT_DIST_DIR/BUILD_ID" ]; then
    echo "[start-frontend] FRONTEND_MODE=$MODE but no production build found -> running next build first..."
    node_modules/.bin/next build
  fi
  echo "[start-frontend] Starting Next.js in PRODUCTION mode (next start, distDir=$NEXT_DIST_DIR)"
  exec node_modules/.bin/next start -p 3000 -H 0.0.0.0
else
  export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-dev}"
  # A production build left in the dist dir confuses `next dev` (stale manifests).
  # BUILD_ID only exists after `next build`, so this runs exactly once when
  # switching prod -> dev and never wipes the dev cache afterwards.
  if [ -f "/app/$NEXT_DIST_DIR/BUILD_ID" ]; then
    echo "[start-frontend] Removing stale production build before dev start"
    rm -rf "/app/$NEXT_DIST_DIR"
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
    for route in /auth/login /dashboard /pay /fees /safedeal /transactions /notifications; do
      curl -sf -o /dev/null --max-time 90 "http://localhost:3000$route" || true
    done
    echo "[start-frontend] prewarm complete (/, /auth/login, /dashboard, /pay compiled)"
  ) &

  echo "[start-frontend] Starting Next.js in DEV mode (hot reload enabled, distDir=$NEXT_DIST_DIR)"
  exec node_modules/.bin/next dev -p 3000 -H 0.0.0.0
fi
