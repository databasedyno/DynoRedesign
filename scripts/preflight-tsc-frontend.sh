#!/usr/bin/env bash
# =============================================================================
#  preflight-tsc-frontend.sh — Frontend TypeScript build gate
#                              (warn-in-hook, fail-in-force)
# -----------------------------------------------------------------------------
#  Why this exists
#    Sibling of scripts/preflight-tsc.sh (which gates ONLY backend/*.ts).
#    On 2026-08 a DigitalOcean build burned minutes on a FRONTEND type error
#    (Components/Page/API/styled.tsx — a polymorphic `component` prop on a
#    styled(Typography)). `next dev` (preview) does not strict type-check, so
#    the error only surfaced at DO's `next build`. A 10–15s local
#    `tsc --noEmit` at the repo root catches this exact class before push.
#
#    CI (.github/workflows/preflight.yml -> frontend-tsc) already HARD-gates
#    this server-side. This script adds the same guard locally so it is caught
#    at commit time — one step earlier than CI, before a build is ever spent.
#
#  Design (mirrors preflight-tsc.sh)
#    - HOOK mode (no --force): WARN only (exit 0). Prints errors loudly but
#      never blocks the commit, so the Emergent "Save to GitHub" flow (which
#      commits under the hood) keeps working. CI still fails the push.
#    - --force (yarn preflight / CI-style): HARD FAIL (exit 1).
#
#  Usage
#    ./scripts/preflight-tsc-frontend.sh           # hook-mode: warn only
#    ./scripts/preflight-tsc-frontend.sh --force    # strict: fail on any error
# =============================================================================

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FORCE=0
if [ "${1:-}" = "--force" ]; then FORCE=1; fi

# -----------------------------------------------------------------------------
# 1. Skip when no FRONTEND TS/config files are staged (hook mode only).
#    Frontend = repo-root *.ts/*.tsx that are NOT under backend/, plus the
#    root tsconfig.json / package.json.
# -----------------------------------------------------------------------------
if [ "$FORCE" -ne 1 ]; then
  CHANGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
    | grep -E '\.(ts|tsx)$|^tsconfig\.json$|^package\.json$' \
    | grep -Ev '^backend/' \
    || true)

  if [ -z "${CHANGED}" ]; then
    echo "[preflight-tsc-fe] No frontend TS/config changes staged — skipping."
    exit 0
  fi

  echo "[preflight-tsc-fe] Frontend TS changes detected:"
  echo "${CHANGED}" | sed 's/^/  • /'
fi

# -----------------------------------------------------------------------------
# 2. Ensure root node_modules/.bin/tsc exists.
# -----------------------------------------------------------------------------
if [ ! -x node_modules/.bin/tsc ]; then
  echo "[preflight-tsc-fe] root node_modules missing tsc."
  if [ "$FORCE" -ne 1 ]; then
    echo "[preflight-tsc-fe] (hook mode: WARN only — commit allowed)"
    exit 0
  fi
  echo "[preflight-tsc-fe] installing (one-time)..."
  yarn install --ignore-engines --production=false --frozen-lockfile \
    || yarn install --ignore-engines --production=false
fi

# -----------------------------------------------------------------------------
# 3. Run tsc --noEmit (root project — same check as `yarn lint` / CI / next build).
# -----------------------------------------------------------------------------
echo "[preflight-tsc-fe] Running frontend tsc --noEmit ..."
START_TS=$(date +%s)

if ./node_modules/.bin/tsc --noEmit; then
  ELAPSED=$(( $(date +%s) - START_TS ))
  echo "[preflight-tsc-fe] Frontend TS OK (${ELAPSED}s) — safe to push."
  exit 0
else
  ELAPSED=$(( $(date +%s) - START_TS ))
  if [ "$FORCE" -eq 1 ]; then
    echo ""
    echo "[preflight-tsc-fe] Frontend TypeScript errors above (${ELAPSED}s spent)."
    echo "[preflight-tsc-fe]    FIX before deploying — DigitalOcean's \`next build\`"
    echo "[preflight-tsc-fe]    strict type-checks and will fail on these."
    exit 1
  else
    echo ""
    echo "[preflight-tsc-fe] WARNING: Frontend TypeScript errors above (${ELAPSED}s spent)."
    echo "[preflight-tsc-fe]   Commit allowed (hook is warn-only, mirrors backend gate)."
    echo "[preflight-tsc-fe]   GitHub Actions preflight.yml AND the DigitalOcean build WILL fail."
    echo "[preflight-tsc-fe]   Run \`yarn preflight\` to see the strict pass/fail."
    exit 0
  fi
fi
