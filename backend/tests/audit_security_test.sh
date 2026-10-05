#!/bin/bash
# Read-only security audit tests for Dynopay backend hardening pass
set +e
BASE="https://secure-passphrase-13.preview.emergentagent.com"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
COOKIE=$(mktemp)
PASS=0; FAIL=0
check(){ if [ "$1" = "$2" ]; then echo "PASS: $3 (got $1)"; PASS=$((PASS+1)); else echo "FAIL: $3 (expected $2, got $1)"; FAIL=$((FAIL+1)); fi; }
retry(){ for i in 1 2; do out=$(eval "$1"); code=$(echo "$out" | tail -1); if [ "$code" -lt 500 ] 2>/dev/null; then break; fi; sleep 2; done; echo "$out"; }

# 0. CSRF cookie
CSRF=$(curl -s -A "$UA" -c "$COOKIE" "$BASE/api/csrf-token" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('csrf_token') or d.get('csrfToken',''))")
echo "CSRF: $CSRF"

# 1. POST /api/status/check without admin - expect 401/403
R=$(curl -s -o /tmp/r.json -w "%{http_code}" -A "$UA" -b "$COOKIE" -X POST "$BASE/api/status/check" -H "x-csrf-token: $CSRF" -H "Content-Type: application/json" -d '{}')
if [ "$R" = "401" ] || [ "$R" = "403" ]; then echo "PASS: status/check admin-guarded ($R)"; PASS=$((PASS+1)); else echo "FAIL: status/check expected 401/403 got $R"; cat /tmp/r.json; FAIL=$((FAIL+1)); fi

# 2. GET /api/referral/leaderboard without auth - expect 401
R=$(curl -s -o /tmp/r.json -w "%{http_code}" -A "$UA" "$BASE/api/referral/leaderboard")
check "$R" "401" "referral/leaderboard requires auth"

# 3. Login as merchant, get Bearer
LOGIN=$(curl -s -A "$UA" -X POST "$BASE/api/user/login" -H "Content-Type: application/json" -d '{"email":"onarrival21@gmail.com","password":"Katiekendra123@"}')
CHAL=$(echo "$LOGIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('challenge_token',''))")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('accessToken',''))")
if [ -z "$TOKEN" ] && [ -n "$CHAL" ]; then
  TOTP=$(node /app/backend/scripts/print_totp.cjs 1 | head -1)
  V=$(curl -s -A "$UA" -X POST "$BASE/api/user/2fa/validate" -H "Content-Type: application/json" -d "{\"challenge_token\":\"$CHAL\",\"token\":\"$TOTP\"}")
  TOKEN=$(echo "$V" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('accessToken',''))")
fi
if [ -z "$TOKEN" ]; then echo "FAIL: could not obtain merchant token"; echo "$V" | head -c 300; FAIL=$((FAIL+1)); else echo "PASS: got merchant token ${TOKEN:0:24}..."; PASS=$((PASS+1)); fi

# 4. Leaderboard with token - masking + limit cap
LB=$(curl -s -A "$UA" -H "Authorization: Bearer $TOKEN" "$BASE/api/referral/leaderboard?limit=1000")
echo "$LB" > /tmp/lb.json
python3 <<PY
import json
d=json.load(open('/tmp/lb.json'))
rows=d.get('data',[])
if not isinstance(rows,list): rows=d.get('data',{}).get('leaderboard',[]) or d.get('leaderboard',[])
print(f"Leaderboard rows: {len(rows)}")
ok_cap = len(rows)<=25
allowed={'rank','name','referral_count','is_current_user'}
extra=set()
mask_ok=True
for r in rows:
    if not isinstance(r,dict): continue
    for k in r.keys():
        if k not in allowed: extra.add(k)
    if not r.get('is_current_user') and r.get('name'):
        # "First L." pattern: word + space + single letter + dot
        import re
        if not re.match(r"^\S+\s+[A-Z]\.$", r['name']):
            mask_ok=False
            print(f"  Unmasked: {r['name']}")
print(f"Cap<=25: {ok_cap}; extra_fields: {extra}; masking_ok: {mask_ok}")
PY

# 5. Leaderboard public - only rank+referral_count
LBP=$(curl -s -A "$UA" "$BASE/api/referral/leaderboard/public")
echo "$LBP" > /tmp/lbp.json
python3 <<PY
import json
d=json.load(open('/tmp/lbp.json'))
rows=d.get('data',[]) or d.get('leaderboard',[])
if isinstance(d.get('data'),dict): rows=d['data'].get('leaderboard',rows)
print(f"Public leaderboard rows: {len(rows) if isinstance(rows,list) else 'na'}")
if isinstance(rows,list):
    allowed={'rank','referral_count'}
    extra=set()
    for r in rows:
        if isinstance(r,dict):
            for k in r.keys():
                if k not in allowed: extra.add(k)
    print(f"Extra fields (should be empty): {extra}")
PY

# 6. /referral/apply without auth
R=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" -b "$COOKIE" -X POST "$BASE/api/referral/apply" -H "x-csrf-token: $CSRF" -H "Content-Type: application/json" -d '{"referral_code":"NOPE-0000"}')
check "$R" "401" "referral/apply requires auth"

R=$(curl -s -o /dev/null -w "%{http_code}" -A "$UA" -b "$COOKIE" -X POST "$BASE/api/referral/referee/redeem" -H "x-csrf-token: $CSRF" -H "Content-Type: application/json" -d '{"referral_code":"NOPE-0000"}')
check "$R" "401" "referral/referee/redeem requires auth"

# 7. Apply with Bearer + bogus code, body user_id 305 - expect 404 and NOT applied to 305
R=$(curl -s -o /tmp/r.json -w "%{http_code}" -A "$UA" -H "Authorization: Bearer $TOKEN" -X POST "$BASE/api/referral/apply" -H "Content-Type: application/json" -d '{"referral_code":"NOPE-0000","user_id":305}')
check "$R" "404" "referral/apply invalid code -> 404"
echo "  body: $(cat /tmp/r.json | head -c 200)"

# 8. Tax rate-limit headers
curl -s -D /tmp/h.txt -A "$UA" "$BASE/api/tax/acronyms" -o /tmp/b.json -w "HTTP:%{http_code}\n"
grep -i "^x-ratelimit-limit" /tmp/h.txt || echo "FAIL: no X-RateLimit-Limit on tax/acronyms"

curl -s -D /tmp/h.txt -A "$UA" -b "$COOKIE" -X POST "$BASE/api/tax/validate" -H "x-csrf-token: $CSRF" -H "Content-Type: application/json" -d '{}' -o /tmp/b.json -w "HTTP:%{http_code}\n"
grep -i "^x-ratelimit-limit" /tmp/h.txt || echo "FAIL: no X-RateLimit-Limit on tax/validate"

# 9. encrypt-payload rate-limit
curl -s -D /tmp/h.txt -A "$UA" -b "$COOKIE" -X POST "$BASE/api/pay/encrypt-payload" -H "x-csrf-token: $CSRF" -H "Content-Type: application/json" -d '{"payload":{"a":1}}' -o /tmp/b.json -w "HTTP:%{http_code}\n"
grep -i "^x-ratelimit-limit" /tmp/h.txt || echo "FAIL: no X-RateLimit-Limit on encrypt-payload"

# 10. notifications trigger-weekly-summary with Bearer+CSRF, dry_run true, user_id 305 - scoped to caller
curl -s -A "$UA" -b "$COOKIE" -H "Authorization: Bearer $TOKEN" -H "x-csrf-token: $CSRF" -X POST "$BASE/api/notifications/trigger-weekly-summary" -H "Content-Type: application/json" -d '{"user_id":305,"dry_run":true}' -o /tmp/nws.json -w "HTTP:%{http_code}\n"
python3 -c "import json;d=json.load(open('/tmp/nws.json'));print('weekly-summary:',json.dumps(d)[:400])"

curl -s -A "$UA" -b "$COOKIE" -H "Authorization: Bearer $TOKEN" -H "x-csrf-token: $CSRF" -X POST "$BASE/api/notifications/trigger-wallet-reminder" -H "Content-Type: application/json" -d '{"user_id":305,"dry_run":true}' -o /tmp/nwr.json -w "HTTP:%{http_code}\n"
python3 -c "import json;d=json.load(open('/tmp/nwr.json'));print('wallet-reminder:',json.dumps(d)[:400])"

# 11. Merchant API - invalid x-api-key expect 401, JSON envelope not 500
R=$(curl -s -o /tmp/r.json -w "%{http_code}" -A "$UA" -X POST "$BASE/api/user/useWallet" -H "x-api-key: dpk_live_invalidkey" -H "Content-Type: application/json" -d '{"amount":"abc"}')
check "$R" "401" "useWallet invalid api key -> 401"
echo "  useWallet: $(cat /tmp/r.json | head -c 200)"

R=$(curl -s -o /tmp/r.json -w "%{http_code}" -A "$UA" -X POST "$BASE/api/user/cryptoPayment" -H "x-api-key: dpk_live_invalidkey" -H "Content-Type: application/json" -d '{}')
check "$R" "401" "cryptoPayment invalid api key -> 401"
echo "  cryptoPayment: $(cat /tmp/r.json | head -c 200)"

echo ""
echo "==== SUMMARY: PASS=$PASS FAIL=$FAIL ===="
