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
  echo "[start-frontend] Starting Next.js in DEV mode (hot reload enabled)"
  exec node_modules/.bin/next dev -p 3000 -H 0.0.0.0
fi
