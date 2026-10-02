#!/usr/bin/env bash
# Drives the AML velocity/hold/mixer test end-to-end: create throwaway customer via API,
# run the ts-node integration test, then clean up.
set -u
HOST="https://secure-passphrase-10.preview.emergentagent.com"
API="$HOST/api/safedeal"
R=$RANDOM$RANDOM
EMAIL="sd-amltest-$R@example.com"
J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)"; }

echo "== throwaway customer: $EMAIL =="
CODE=$(curl -s -X POST "$API/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}" | J "['data']['preview_code']")
RESP=$(curl -s -X POST "$API/auth/verify-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}")
TOK=$(echo "$RESP" | J "['data']['token']")
CID=$(curl -s -X GET "$API/me" -H "x-safedeal-token: $TOK" | J "['data']['user']['customer_id']")
echo "customer_id=$CID"

echo "== integration test (ts-node) =="
cd /app/backend && npx ts-node -r dotenv/config scripts/sd_sectest_withdraw.ts "$CID"
RC=$?

echo "== AML alert in logs for customer $CID? =="
grep -iE "AML ALERT: customer $CID" /var/log/supervisor/backend.out.log | tail -3

echo "== cleanup =="
node /app/backend/scripts/sd_sectest_db.cjs cleanup "$EMAIL"
exit $RC
