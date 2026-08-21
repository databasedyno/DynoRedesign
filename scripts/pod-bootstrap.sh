#!/bin/bash
# =============================================================================
# One-command setup for a NEW Emergent preview pod.
#
# Replaces the ~10 manual steps that used to be redone by hand every pod:
#   1. restore /app/.env + /app/backend/.env from the encrypted vault
#   2. point every URL key at THIS pod's preview hostname
#   3. enforce SAFE MODE (background jobs off — preview talks to the LIVE DB)
#   4. install deps (root first, then backend — serialised, shared yarn cache)
#   5. restart supervisor services
#   6. verify backend /health + frontend and print a pass/fail report
#
# Usage:
#   bash scripts/pod-bootstrap.sh --pass '<vault-passphrase>'
#   bash scripts/pod-bootstrap.sh                # env files already on disk
#   optional: --url <preview-url> --force-install --no-restart --skip-env
# =============================================================================
set -uo pipefail

PREVIEW_URL=""
VAULT_PASS="${DYNOPAY_VAULT_PASSPHRASE:-}"
FORCE_INSTALL=0
DO_RESTART=1
SKIP_ENV=0
FAILURES=()

while [ $# -gt 0 ]; do
  case "$1" in
    --url) PREVIEW_URL="$2"; shift 2 ;;
    --pass) VAULT_PASS="$2"; shift 2 ;;
    --force-install) FORCE_INSTALL=1; shift ;;
    --no-restart) DO_RESTART=0; shift ;;
    --skip-env) SKIP_ENV=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

step() { echo ""; echo "── $* ────────────────────────────────────────"; }
ok()   { echo "   ✅ $*"; }
bad()  { echo "   ❌ $*"; FAILURES+=("$*"); }

START=$(date +%s)

# ---------------------------------------------------------------- preview URL
step "1/6  Detecting preview URL"
if [ -z "$PREVIEW_URL" ]; then
  PREVIEW_URL=$(grep -hoE 'APP_URL="[^"]+"' /etc/supervisor/conf.d/*.conf 2>/dev/null | head -1 | sed -E 's/APP_URL="([^"]+)"/\1/')
fi
if [ -z "$PREVIEW_URL" ]; then
  bad "could not detect preview URL — pass it with --url https://<host>"
else
  ok "$PREVIEW_URL"
fi

# ------------------------------------------------------------------ env files
step "2/6  Environment files"
if [ "$SKIP_ENV" -eq 1 ]; then
  ok "skipped (--skip-env)"
elif [ -f /app/.env ] && [ -f /app/backend/.env ] && [ -z "$VAULT_PASS" ]; then
  ok "already present (root $(wc -l < /app/.env) lines, backend $(wc -l < /app/backend/.env) lines)"
elif [ -f /app/env.vault.enc ]; then
  if DYNOPAY_VAULT_PASSPHRASE="$VAULT_PASS" bash /app/scripts/env-vault.sh open; then
    ok "restored from env.vault.enc"
  else
    bad "vault restore failed (wrong passphrase?)"
  fi
else
  bad "no env files and no env.vault.enc — paste credentials, then run: bash scripts/env-vault.sh seal '<pass>'"
fi

# ----------------------------------------------------- URL sync + safe mode
step "3/6  Syncing URLs to this pod + enforcing SAFE MODE"
if [ -n "$PREVIEW_URL" ] && [ -f /app/.env ] && [ -f /app/backend/.env ]; then
  python3 - "$PREVIEW_URL" <<'PY'
import sys

url = sys.argv[1].rstrip('/')

def patch(path, keys, cors_key=None, forced=None):
    lines = open(path).read().splitlines()
    seen, out, changed = set(), [], []
    for line in lines:
        if '=' in line and not line.lstrip().startswith('#'):
            key = line.split('=', 1)[0].strip()
            if key in keys:
                if line != f"{key}={url}":
                    changed.append(key)
                line = f"{key}={url}"
                seen.add(key)
            elif forced and key in forced:
                if line != f"{key}={forced[key]}":
                    changed.append(key)
                line = f"{key}={forced[key]}"
                seen.add(key)
            elif cors_key and key == cors_key:
                val = line.split('=', 1)[1].strip()
                parts = [p.strip() for p in val.split(',') if p.strip() and 'preview.emergent' not in p]
                parts.append(url)
                new = f"{cors_key}=" + ','.join(parts)
                if line != new:
                    changed.append(key)
                line = new
                seen.add(key)
        out.append(line)
    for key in forced or {}:
        if key not in seen:
            out.append(f"{key}={forced[key]}")
            changed.append(key + ' (added)')
    open(path, 'w').write('\n'.join(out) + '\n')
    print(f"   ✅ {path}: {', '.join(changed) if changed else 'already correct'}")

patch('/app/.env',
      {'NEXTAUTH_URL', 'NEXT_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_CREATOR_BASE_URL'},
      forced={'FRONTEND_MODE': 'dev', 'INTERNAL_API_URL': 'http://localhost:8001'})

patch('/app/backend/.env',
      {'SERVER_URL', 'FRONTEND_URL', 'CHECKOUT_URL', 'NEXTAUTH_URL', 'NEXT_PUBLIC_BASE_URL'},
      cors_key='CORS_ALLOWED_ORIGINS',
      forced={'ENABLE_BACKGROUND_JOBS': 'false', 'WORKER_ROLE': 'secondary'})
PY
  [ $? -ne 0 ] && bad "URL sync failed"
  ok "SAFE MODE enforced (ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary)"
else
  bad "skipped URL sync — env files or preview URL missing"
fi

# -------------------------------------------------------------- dependencies
step "4/6  Dependencies (root -> backend, serialised)"
install_deps() {
  local dir="$1" probe="$2" label="$3"
  if [ "$FORCE_INSTALL" -eq 0 ] && [ -x "$probe" ]; then
    ok "$label already installed"
    return
  fi
  echo "   installing $label (this is the slow part on a fresh pod)..."
  (cd "$dir" && flock /tmp/dynopay-yarn-install.lock yarn install --non-interactive --network-concurrency 16 >"/tmp/yarn-$label.log" 2>&1)
  if [ ! -x "$probe" ]; then
    # yarn says "already up-to-date" for a partially-present tree; --check-files repairs it.
    (cd "$dir" && flock /tmp/dynopay-yarn-install.lock yarn install --non-interactive --check-files >>"/tmp/yarn-$label.log" 2>&1)
  fi
  if [ -x "$probe" ]; then
    ok "$label installed"
  else
    bad "$label yarn install failed — see /tmp/yarn-$label.log"
    tail -20 "/tmp/yarn-$label.log"
  fi
}
install_deps /app /app/node_modules/.bin/next root
install_deps /app/backend /app/backend/node_modules/.bin/ts-node backend

# ------------------------------------------------------------------- restart
step "5/6  Restarting services"
if [ "$DO_RESTART" -eq 1 ]; then
  sudo supervisorctl restart backend frontend >/dev/null 2>&1 && ok "backend + frontend restarted" || bad "supervisorctl restart failed"
else
  ok "skipped (--no-restart)"
fi

# -------------------------------------------------------------------- verify
step "6/6  Verifying"
BACKEND_JSON=""
for i in $(seq 1 40); do
  BACKEND_JSON=$(curl -s --max-time 5 http://localhost:8001/health 2>/dev/null)
  echo "$BACKEND_JSON" | grep -q '"status":"healthy"' && break
  sleep 3
done
if echo "$BACKEND_JSON" | grep -q '"status":"healthy"'; then
  python3 - "$BACKEND_JSON" <<'PY'
import json, sys
h = json.loads(sys.argv[1])
print(f"   ✅ backend healthy — db={h.get('database')} redis={h.get('redis')} "
      f"tatum={h.get('tatum_api', {}).get('operational')} "
      f"background_jobs={h.get('background_jobs', {}).get('eligible')} (false = SAFE MODE)")
PY
else
  bad "backend /health never returned healthy"
fi

FRONT_CODE=""
for i in $(seq 1 40); do
  FRONT_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:3000/ 2>/dev/null)
  [ "$FRONT_CODE" = "200" ] && break
  sleep 3
done
[ "$FRONT_CODE" = "200" ] && ok "frontend 200 on :3000 (dev server compiled + warm)" || bad "frontend returned $FRONT_CODE"

if [ -n "$PREVIEW_URL" ]; then
  EXT=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$PREVIEW_URL/" 2>/dev/null)
  [ "$EXT" = "200" ] && ok "external $PREVIEW_URL -> 200" || bad "external $PREVIEW_URL -> $EXT"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "✅ POD READY in $(( $(date +%s) - START ))s — $PREVIEW_URL"
else
  echo "⚠️  FINISHED WITH ${#FAILURES[@]} PROBLEM(S) in $(( $(date +%s) - START ))s:"
  for f in "${FAILURES[@]}"; do echo "   - $f"; done
  exit 1
fi
