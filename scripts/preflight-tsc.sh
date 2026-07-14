#!/usr/bin/env bash
# =============================================================================
#  preflight-tsc.sh — Backend TypeScript build gate (warn-in-hook, fail-in-CI)
# -----------------------------------------------------------------------------
#  Why this exists
#    On 2026-07-13 the DigitalOcean deploy pipeline burned ~37 min of build
#    minutes on 5 back-to-back push builds that all failed at the very same
#    `tsc` compile step (missing fields on the inline RedisPaymentItem
#    interface in backend/controller/payment/cryptoCheckout.ts). A 15-second
#    local `tsc --noEmit` would have caught it before the push happened.
#
#  Design (2026-07-14 update — session 47)
#    Original behavior BLOCKED every git commit that had a backend TS error.
#    Problem: the Emergent "Save to GitHub" flow uses `git commit` under the
#    hood, so a broken backend TS file made "Save to GitHub" silently fail —
#    the button click just did nothing from the user's perspective. Fix:
#
#    - When invoked as a HOOK (no --force flag): WARN only (exit 0).
#      Errors are printed loudly so the developer sees them, but the commit
#      is allowed through. Save-to-GitHub keeps working. The .github
#      workflow (preflight.yml) still catches the error server-side.
#    - When invoked with --force (yarn preflight / CI): HARD FAIL (exit 1).
#      This is what `yarn preflight` and the CI workflow call. Deploy
#      pipelines and manual "please gate my push" runs still get strict
#      enforcement.
#
#  Usage
#    ./scripts/preflight-tsc.sh              # hook-mode: warn only, never blocks
#    ./scripts/preflight-tsc.sh --force      # strict: fails on any TS error
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
      echo "[preflight-tsc] yarn install failed. Last 20 lines:"
      tail -20 /tmp/preflight-yarn.log
      # In hook mode, don't block on install failures either.
      if [ "$FORCE" -ne 1 ]; then
        echo "[preflight-tsc] (hook mode: WARN only — commit allowed)"
        exit 0
      fi
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
  echo "[preflight-tsc] Backend TS OK (${ELAPSED}s) — safe to push."
  exit 0
else
  ELAPSED=$(( $(date +%s) - START_TS ))
  if [ "$FORCE" -eq 1 ]; then
    # Strict mode (CI / `yarn preflight`) — fail hard.
    echo ""
    echo "[preflight-tsc] Backend TypeScript errors above (${ELAPSED}s spent)."
    echo "[preflight-tsc]"
    echo "[preflight-tsc]    FIX the errors before deploying."
    echo "[preflight-tsc]    This exact class of error costs ~7.5 min per failed build on DigitalOcean."
    echo "[preflight-tsc]"
    exit 1
  else
    # Hook mode — WARN only, do not block the commit. Save to GitHub stays green.
    echo ""
    echo "[preflight-tsc] WARNING: Backend TypeScript errors above (${ELAPSED}s spent)."
    echo "[preflight-tsc]"
    echo "[preflight-tsc]   Commit allowed (hook is warn-only as of session 47)."
    echo "[preflight-tsc]   Please fix ASAP — GitHub Actions preflight.yml AND the"
    echo "[preflight-tsc]   DigitalOcean deploy will fail on these errors."
    echo "[preflight-tsc]"
    echo "[preflight-tsc]   Run \`yarn preflight\` to see the strict pass/fail."
    echo "[preflight-tsc]"
    exit 0
  fi
fi
