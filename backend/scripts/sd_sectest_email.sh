#!/usr/bin/env bash
# E2E test of the SafeDeal email-change security fix (step-up + session kill + 24h hold).
set -u
HOST="https://passphrase-config-2.preview.emergentagent.com"
API="$HOST/api/safedeal"
R=$RANDOM$RANDOM
EMAIL="sd-sectest-$R@example.com"
NEWMAIL="sd-sectest-new-$R@example.com"
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)"; }

echo "== customer: $EMAIL  ->  $NEWMAIL =="

CODE1=$(curl -s -X POST "$API/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}" | J "['data']['preview_code']")
echo "1) send-code preview: $CODE1"

RESP=$(curl -s -X POST "$API/auth/verify-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE1\"}")
TOKOLD=$(echo "$RESP" | J "['data']['token']")
echo "2) verify-code -> old token: ${TOKOLD:0:24}..."

ME1=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/me" -H "x-safedeal-token: $TOKOLD")
echo "3) /me with old token (expect 200): $ME1"

# 4) change email WITHOUT step-up code -> must be blocked (400)
NOCODE=$(curl -s -o /tmp/nocode.json -w "%{http_code}" -X POST "$API/account/email/start" -H "x-safedeal-token: $TOKOLD" -H 'Content-Type: application/json' -d "{\"email\":\"$NEWMAIL\"}")
echo "4) email/start WITHOUT step-up (expect 400): $NOCODE  msg=$(cat /tmp/nocode.json | J "['message']" 2>/dev/null)"

# 5) request step-up code (sent to CURRENT email)
STEP=$(curl -s -X POST "$API/auth/step-up" -H "x-safedeal-token: $TOKOLD" -H 'Content-Type: application/json' -d "{\"action\":\"change_email\"}" | J "['data']['preview_code']")
echo "5) step-up preview code (to current mailbox): $STEP"

# 6) change email WITH step-up code -> 200, sends code to NEW email
START=$(curl -s -X POST "$API/account/email/start" -H "x-safedeal-token: $TOKOLD" -H 'Content-Type: application/json' -d "{\"email\":\"$NEWMAIL\",\"code\":\"$STEP\"}")
NEWCODE=$(echo "$START" | J "['data']['preview_code']")
echo "6) email/start WITH step-up -> new-email code: $NEWCODE"

# 7) verify new email -> 200, new token
VER=$(curl -s -X POST "$API/account/email/verify" -H "x-safedeal-token: $TOKOLD" -H 'Content-Type: application/json' -d "{\"code\":\"$NEWCODE\"}")
TOKNEW=$(echo "$VER" | J "['data']['token']")
NEWEMAIL_OUT=$(echo "$VER" | J "['data']['user']['email']")
echo "7) email/verify -> new email=$NEWEMAIL_OUT  new token: ${TOKNEW:0:24}..."

# 8) old token must now be REJECTED (session invalidated)
ME_OLD=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/me" -H "x-safedeal-token: $TOKOLD")
echo "8) /me with OLD token after change (expect 401): $ME_OLD"

# 9) new token still works
ME_NEW=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API/me" -H "x-safedeal-token: $TOKNEW")
echo "9) /me with NEW token (expect 200): $ME_NEW"

echo "== DB state (tokens_valid_after + cashout_hold_until should be set) =="
node "$(dirname "$0")/sd_sectest_db.cjs" read "$NEWMAIL"

echo "== cleanup =="
node "$(dirname "$0")/sd_sectest_db.cjs" cleanup "$NEWMAIL"
