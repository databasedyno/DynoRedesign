#!/bin/bash
# =============================================================================
# Encrypted env vault — survives new pods.
#
# WHY: /app is restored from git on every new pod, so `.env`, `backend/.env`
# and `backend/dynopay.json` (all gitignored) are wiped and had to be re-pasted
# by hand every single time. This seals them into ONE tracked ciphertext file
# (env.vault.enc, AES-256-CBC + PBKDF2/300k) that git keeps, so a new pod only
# needs the passphrase.
#
# Usage:
#   bash scripts/env-vault.sh seal [passphrase]   # encrypt current env -> env.vault.enc
#   bash scripts/env-vault.sh open [passphrase]   # restore env files from env.vault.enc
#   bash scripts/env-vault.sh list [passphrase]   # show what's inside without writing
#
# Passphrase resolution: argument -> $DYNOPAY_VAULT_PASSPHRASE -> interactive prompt.
# =============================================================================
set -uo pipefail

VAULT="/app/env.vault.enc"
CMD="${1:-}"
PASS="${2:-${DYNOPAY_VAULT_PASSPHRASE:-}}"

MEMBERS=()
for f in app/.env app/backend/.env app/backend/dynopay.json; do
  [ -f "/$f" ] && MEMBERS+=("$f")
done

die() { echo "❌ $*" >&2; exit 1; }

if [ -z "$CMD" ]; then
  die "usage: env-vault.sh seal|open|list [passphrase]"
fi

if [ -z "$PASS" ]; then
  read -r -s -p "Vault passphrase: " PASS; echo
fi
[ -z "$PASS" ] && die "empty passphrase"
export VP="$PASS"

enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 300000 -salt -base64 -pass env:VP; }
dec() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 300000 -base64 -pass env:VP; }

case "$CMD" in
  seal)
    [ ${#MEMBERS[@]} -eq 0 ] && die "nothing to seal — /app/.env and /app/backend/.env are both missing"
    tar -C / -czf - "${MEMBERS[@]}" | enc > "$VAULT" || die "encryption failed"
    # Verify the vault decrypts before anyone commits it.
    if ! dec < "$VAULT" | tar -tzf - >/dev/null 2>&1; then
      rm -f "$VAULT"; die "vault failed verification — not written"
    fi
    echo "✅ sealed $(printf '%s ' "${MEMBERS[@]}")-> $VAULT ($(wc -c < "$VAULT") bytes)"
    echo "   restore on any pod:  bash scripts/env-vault.sh open '<passphrase>'"
    ;;
  open)
    [ ! -f "$VAULT" ] && die "$VAULT not found"
    STAMP=$(date +%s)
    for f in /app/.env /app/backend/.env; do
      [ -f "$f" ] && cp "$f" "$f.bak.$STAMP"
    done
    if ! dec < "$VAULT" | tar -C / -xzf -; then
      die "decryption failed — wrong passphrase?"
    fi
    echo "✅ restored from vault:"
    for f in /app/.env /app/backend/.env /app/backend/dynopay.json; do
      if [ -f "$f" ]; then echo "   $f ($(wc -l < "$f") lines)"; fi
    done
    exit 0
    ;;
  list)
    [ ! -f "$VAULT" ] && die "$VAULT not found"
    dec < "$VAULT" | tar -tzvf - || die "decryption failed — wrong passphrase?"
    ;;
  *)
    die "unknown command '$CMD' (seal|open|list)"
    ;;
esac
