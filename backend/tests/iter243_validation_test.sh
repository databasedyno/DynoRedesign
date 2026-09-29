#!/usr/bin/env bash
# Iteration 243 — verifies new backend input-validation + admin analytics fixes
set -u
URL="${SERVER_URL:-http://localhost:8001}"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
PASS=0; FAIL=0
COOKIE_JAR=$(mktemp)

pass(){ echo "PASS: $*"; PASS=$((PASS+1)); }
fail(){ echo "FAIL: $*"; FAIL=$((FAIL+1)); }

# --- CSRF ---
CSRF=$(curl -s -A "$UA" -c "$COOKIE_JAR" "$URL/api/csrf-token" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('csrf_token') or d.get('data',{}).get('csrf_token',''))")
[ -n "$CSRF" ] && pass "csrf token acquired" || fail "csrf token"

hdr=(-H "Content-Type: application/json" -H "x-csrf-token: $CSRF" -A "$UA")

# --- calculateFees: amount non-numeric ---
r=$(curl -s -A "$UA" -b "$COOKIE_JAR" -o /tmp/r1.json -w "%{http_code}" "${hdr[@]}" -X POST "$URL/api/pay/calculateFees" -d '{"amount":"abc","cryptocurrency":123}')
msg=$(python3 -c "import json;print(json.load(open('/tmp/r1.json')).get('message',''))")
if [ "$r" = "400" ] && [[ "$msg" == *"Valid payment amount"* ]]; then pass "calcFees amount=abc -> 400 ($msg)"; else fail "calcFees amount=abc -> $r msg=$msg"; fi

# --- calculateFees: cryptocurrency non-string ---
r=$(curl -s -A "$UA" -b "$COOKIE_JAR" -o /tmp/r2.json -w "%{http_code}" "${hdr[@]}" -X POST "$URL/api/pay/calculateFees" -d '{"amount":10,"cryptocurrency":123}')
msg=$(python3 -c "import json;print(json.load(open('/tmp/r2.json')).get('message',''))")
if [ "$r" = "400" ] && [[ "$msg" == *"Cryptocurrency"* ]]; then pass "calcFees crypto=123 -> 400 ($msg)"; else fail "calcFees crypto=123 -> $r msg=$msg"; fi

# --- referral/referee/validate: code as array ---
r=$(curl -s -A "$UA" -b "$COOKIE_JAR" -o /tmp/r3.json -w "%{http_code}" "${hdr[@]}" -X POST "$URL/api/referral/referee/validate" -d '{"code":[1]}')
msg=$(python3 -c "import json;print(json.load(open('/tmp/r3.json')).get('message',''))")
if [ "$r" = "400" ] && [[ "$msg" == *"Referee code"* ]]; then pass "referral validate code=[1] -> 400 ($msg)"; else fail "referral validate code=[1] -> $r msg=$msg"; fi

# --- webhook-history logId non-numeric (requires merchant bearer) ---
MTOK=$(cat /app/memory/tmp/merchant_token.txt 2>/dev/null | tr -d '\r\n')
if [ -n "$MTOK" ]; then
  r=$(curl -s -A "$UA" -o /tmp/r4.json -w "%{http_code}" -H "Authorization: Bearer $MTOK" "$URL/api/company/webhook-history/1/detail/zz9")
  msg=$(python3 -c "import json;print(json.load(open('/tmp/r4.json')).get('message',''))")
  if [ "$r" = "400" ] && [[ "$msg" == *"numeric"* || "$msg" == *"logId"* ]]; then pass "webhook detail zz9 -> 400 ($msg)"; else fail "webhook detail zz9 -> $r msg=$msg"; fi
else
  fail "merchant token missing"
fi

# --- Admin login + analytics ---
ATOK=$(curl -s -A "$UA" -H "Content-Type: application/json" -X POST "$URL/api/admin/login" -d '{"email":"moxxcompany@gmail.com","password":"Katiekendra123@"}' | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(d.get('accessToken') or d.get('token',''))")
if [ -n "$ATOK" ]; then pass "admin login token acquired"; else fail "admin login"; fi

if [ -n "$ATOK" ]; then
  for ep in "analytics/revenue?period=7d" "analytics/users" "analytics/cohorts" "analytics/funnel" "analytics/onboarding" "analytics/attribution"; do
    r=$(curl -s -A "$UA" -o /tmp/adm.json -w "%{http_code}" -H "Authorization: Bearer $ATOK" "$URL/api/admin/$ep")
    if [ "$r" = "200" ]; then
      pass "GET /api/admin/$ep -> 200"
      if [[ "$ep" == analytics/revenue* ]]; then
        tfc=$(python3 -c "import json;d=json.load(open('/tmp/adm.json'));print(d.get('data',{}).get('total_fees_collected'))")
        if [[ "$tfc" =~ ^[0-9.\-]+$ ]] || [ "$tfc" = "0" ]; then pass "revenue.total_fees_collected numeric=$tfc"; else fail "total_fees_collected not numeric: $tfc"; fi
      fi
    else
      body=$(head -c 200 /tmp/adm.json)
      fail "GET /api/admin/$ep -> $r body=$body"
    fi
  done
fi

echo "==== SUMMARY: PASS=$PASS FAIL=$FAIL ===="
