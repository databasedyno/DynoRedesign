#!/usr/bin/env bash
# =============================================================================
#  preflight-tsc.sh — Fail-fast local backend TypeScript build gate
# -----------------------------------------------------------------------------
#  Why this exists
#    On 2026-07-13 the DigitalOcean deploy pipeline burned ~37 min of build
#    minutes on 5 back-to-back push builds that all failed at the very same
#    `tsc` compile step (missing fields on the inline RedisPaymentItem
#    interface in backend/controller/payment/cryptoCheckout.ts). Each failure
#    took ~7½ min to surface — a delta that a 15-second local `tsc --noEmit`
#    would have caught before the push ever happened.
#
#  What this does
#    1. If invoked from a git hook (or with no args), inspect the staged files
#       and skip when no backend TypeScript / package / tsconfig files changed.
#       This keeps typical frontend-only commits <1 s.
#    2. Otherwise (or with --force), run `tsc --noEmit` inside /backend.
#    3. Auto-install backend/node_modules on first invocation.
#    4. Fail loudly with a clear message + how to bypass (NOT recommended).
#
#  Usage
#    ./scripts/preflight-tsc.sh              # hook-mode: skip if no BE changes
#    ./scripts/preflight-tsc.sh --force      # always run (used by CI + `yarn preflight`)
# =============================================================================

set -eu

# Locate repo root (this script lives at $REPO/scripts/preflight-tsc.sh)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FORCE=0
if [ "${1:-}" = "--force" ]; then FORCE=1; fi

# -----------------------------------------------------------------------------
# 1. Skip when no backend TS/config files are staged (hook mode only)
# -----------------------------------------------------------------------------
if [ "$FORCE" -ne 1 ]; then
  # `git diff --cached` shows the changes that WILL be committed.
  CHANGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
    | grep -E '^backend/.*\.(ts|tsx)$|^backend/tsconfig\.json$|^backend/package\.json$|^backend/yarn\.lock$' \
    || true)

  if [ -z "${CHANGED}" ]; then
    echo "[preflight-tsc] No backend TS/config changes staged — skipping."
    exit 0
  fi

  echo "[preflight-tsc] Backend TS changes detected:"
  echo "${CHANGED}" | sed 's/^/  • /'
fi

# -----------------------------------------------------------------------------
# 2. Ensure backend/node_modules/.bin/tsc exists (one-time cost)
# -----------------------------------------------------------------------------
if [ ! -x backend/node_modules/.bin/tsc ]; then
  echo "[preflight-tsc] backend/node_modules missing — installing (one-time)..."
  if ! (cd backend && yarn install --ignore-engines --production=false --frozen-lockfile >/tmp/preflight-yarn.log 2>&1); then
    echo "[preflight-tsc]   frozen-lockfile install failed, retrying without --frozen-lockfile..."
    (cd backend && yarn install --ignore-engines --production=false >/tmp/preflight-yarn.log 2>&1) || {
      echo "[preflight-tsc] ❌ yarn install failed. Last 20 lines:"
      tail -20 /tmp/preflight-yarn.log
      exit 1
    }
  fi
fi

# -----------------------------------------------------------------------------
# 3. Run tsc --noEmit
# -----------------------------------------------------------------------------
echo "[preflight-tsc] Running backend tsc --noEmit ..."
START_TS=$(date +%s)

if (cd backend && ./node_modules/.bin/tsc --noEmit); then
  ELAPSED=$(( $(date +%s) - START_TS ))
  echo "[preflight-tsc] ✅ Backend TS OK (${ELAPSED}s) — safe to push."
  exit 0
else
  ELAPSED=$(( $(date +%s) - START_TS ))
  echo ""
  echo "[preflight-tsc] ❌ Backend TypeScript errors above (${ELAPSED}s spent)."
  echo "[preflight-tsc]"
  echo "[preflight-tsc]    FIX the errors before committing."
  echo "[preflight-tsc]    This exact class of error costs ~7½ min per failed build on DigitalOcean."
  echo "[preflight-tsc]"
  echo "[preflight-tsc]    Bypass (NOT recommended, will break prod deploy):"
  echo "[preflight-tsc]       git commit --no-verify"
  echo "[preflight-tsc]"
  exit 1
fi
