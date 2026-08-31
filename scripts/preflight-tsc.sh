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
# 1. Decide which gates to run. --force runs BOTH (CI / `yarn preflight`).
#    In hook mode, run a gate only when its files are staged.
#      backend  = backend/*.ts(x) + backend tsconfig/package/lock
#      frontend = repo-root *.ts(x) OUTSIDE backend/ + root tsconfig/next.config/package.json
#    The DigitalOcean deploy type-checks BOTH (backend `tsc` + frontend
#    `next build` with typescript.ignoreBuildErrors=false), so a FRONTEND-only
#    type error must be caught here too — it slips past `next dev` otherwise.
# -----------------------------------------------------------------------------
RUN_BACKEND=0
RUN_FRONTEND=0

if [ "$FORCE" -eq 1 ]; then
  RUN_BACKEND=1
  RUN_FRONTEND=1
else
  STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
  if echo "${STAGED}" | grep -qE '^backend/.*\.(ts|tsx)$|^backend/tsconfig\.json$|^backend/package\.json$|^backend/yarn\.lock$'; then
    RUN_BACKEND=1
  fi
  if echo "${STAGED}" | grep -qE '^(pages|Components|Containers|Redux|hooks|helpers|contexts|utils|constants|styles|api|middleware)/.*\.(ts|tsx)$|^[^/]*\.(ts|tsx)$|^tsconfig\.json$|^next\.config\.mjs$|^package\.json$'; then
    RUN_FRONTEND=1
  fi

  if [ "$RUN_BACKEND" -eq 0 ] && [ "$RUN_FRONTEND" -eq 0 ]; then
    echo "[preflight-tsc] No backend/frontend TS changes staged — skipping."
    exit 0
  fi
  [ "$RUN_BACKEND" -eq 1 ] && echo "[preflight-tsc] Backend TS changes staged."
  [ "$RUN_FRONTEND" -eq 1 ] && echo "[preflight-tsc] Frontend TS changes staged."
fi

# -----------------------------------------------------------------------------
# 2. Ensure the tsc binary for a target exists (one-time install cost).
# -----------------------------------------------------------------------------
ensure_deps() {
  # $1 = dir, $2 = tsc probe path
  if [ -x "$2" ]; then return 0; fi
  echo "[preflight-tsc] $1 node_modules missing — installing (one-time)..."
  if (cd "$1" && yarn install --ignore-engines --production=false >/tmp/preflight-yarn-"$(basename "$1")".log 2>&1); then
    return 0
  fi
  echo "[preflight-tsc] yarn install failed for '$1'. Last 20 lines:"
  tail -20 /tmp/preflight-yarn-"$(basename "$1")".log 2>/dev/null || true
  return 1
}

# -----------------------------------------------------------------------------
# 3. Run tsc --noEmit for each requested gate; aggregate pass/fail.
# -----------------------------------------------------------------------------
FAILED=0

run_gate() {
  # $1 = label, $2 = dir, $3 = tsc probe path
  local label="$1" dir="$2" probe="$3" start
  if ! ensure_deps "$dir" "$probe"; then
    if [ "$FORCE" -eq 1 ]; then FAILED=1; else
      echo "[preflight-tsc] (hook mode: skipping ${label} gate on install failure)"
    fi
    return
  fi
  echo "[preflight-tsc] Running ${label} tsc --noEmit ..."
  start=$(date +%s)
  if (cd "$dir" && ./node_modules/.bin/tsc --noEmit); then
    echo "[preflight-tsc] ${label} TS OK ($(( $(date +%s) - start ))s)."
  else
    echo "[preflight-tsc] ${label} TypeScript errors above ($(( $(date +%s) - start ))s)."
    FAILED=1
  fi
}

[ "$RUN_BACKEND" -eq 1 ]  && run_gate "Backend"  "backend" "backend/node_modules/.bin/tsc"
[ "$RUN_FRONTEND" -eq 1 ] && run_gate "Frontend" "."       "node_modules/.bin/tsc"

# -----------------------------------------------------------------------------
# 4. Verdict — warn-in-hook, fail-in-CI (unchanged semantics).
# -----------------------------------------------------------------------------
if [ "$FAILED" -eq 0 ]; then
  echo "[preflight-tsc] All staged TS gates passed — safe to push."
  exit 0
fi

if [ "$FORCE" -eq 1 ]; then
  echo ""
  echo "[preflight-tsc]    FIX the TypeScript errors above before deploying."
  echo "[preflight-tsc]    This class of error costs ~7.5 min per failed build on DigitalOcean."
  echo ""
  exit 1
else
  echo ""
  echo "[preflight-tsc] WARNING: TypeScript errors above."
  echo "[preflight-tsc]   Commit allowed (hook is warn-only)."
  echo "[preflight-tsc]   GitHub Actions preflight.yml AND the DigitalOcean deploy WILL"
  echo "[preflight-tsc]   fail on these errors. Run \`yarn preflight\` for the strict pass/fail."
  echo ""
  exit 0
fi
