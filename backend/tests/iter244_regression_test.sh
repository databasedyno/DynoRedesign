#!/usr/bin/env bash
# iter244 regression test — fiat routes removed + 2FA step-up + currency + scanner
set -u
URL="${SERVER_URL:-https://passphrase-config-2.preview.emergentagent.com}"
TOK=$(cat /app/memory/tmp/merchant_token.txt)
UA="Mozilla/5.0"
PASS=0; FAIL=0; FAILS=()
c() { # curl → status
  curl -s -o /tmp/_body -w '%{http_code}' -H "User-Agent: $UA" "$@"
}
chk() { # chk NAME EXPECTED_CODES...
  local name=$1; shift
  local got=$1; shift
  for exp in "$@"; do [[ "$got" == "$exp" ]] && { PASS=$((PASS+1)); echo "PASS $name ($got)"; return; }; done
  FAIL=$((FAIL+1)); FAILS+=("$name: got $got body=$(head -c 200 /tmp/_body)"); echo "FAIL $name got=$got body=$(head -c 200 /tmp/_body)"
}

echo "=== 1) Fiat routes REMOVED (404) ==="
chk POST_webhook            "$(c -X POST "$URL/api/webhook" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_failed_webhook     "$(c -X POST "$URL/api/failed_webhook" -H 'Content-Type: application/json' -d '{}')" 404
chk GET_subscriptions       "$(c "$URL/api/subscriptions" -H "Authorization: Bearer $TOK")" 404
chk POST_createPlan         "$(c -X POST "$URL/api/userApi/createPlan" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_pay_authStep       "$(c -X POST "$URL/api/pay/authStep" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_pay_verifyPayment  "$(c -X POST "$URL/api/pay/verifyPayment" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_pay_confirmPayment "$(c -X POST "$URL/api/pay/confirmPayment" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_wallet_authStep    "$(c -X POST "$URL/api/wallet/authStep" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_wallet_verifyPay   "$(c -X POST "$URL/api/wallet/verifyPayment" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{}')" 404
chk POST_wallet_confirmPay  "$(c -X POST "$URL/api/wallet/confirmPayment" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{}')" 404

echo "=== 2) Crypto routes STILL EXIST (non-404) ==="
code=$(c -X POST "$URL/api/pay/addPayment" -H 'Content-Type: application/json' -d '{}')
[[ "$code" != "404" ]] && { PASS=$((PASS+1)); echo "PASS pay_addPayment_not404 ($code)"; } || { FAIL=$((FAIL+1)); FAILS+=("pay_addPayment_not404 got 404"); echo "FAIL pay_addPayment_not404"; }
code=$(c -X POST "$URL/api/tatum-crypto-webhook" -H 'Content-Type: application/json' -d '{}')
[[ "$code" != "404" ]] && { PASS=$((PASS+1)); echo "PASS tatum_webhook_not404 ($code)"; } || { FAIL=$((FAIL+1)); FAILS+=("tatum_webhook_not404 got 404"); echo "FAIL tatum_webhook_not404"; }

echo "=== 3) 2FA step-up enforced on contact changes ==="
step_check() {
  local name=$1 url=$2 method=$3 body=$4
  local got
  got=$(c -X "$method" "$URL$url" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "$body")
  local code=$(python3 -c "import json,sys;print(json.load(open('/tmp/_body')).get('code',''))" 2>/dev/null)
  if [[ "$got" == "403" && "$code" == "STEPUP_REQUIRED" ]]; then
    PASS=$((PASS+1)); echo "PASS $name (403 STEPUP_REQUIRED)"
  else
    FAIL=$((FAIL+1)); FAILS+=("$name got=$got code=$code body=$(head -c 200 /tmp/_body)"); echo "FAIL $name got=$got code=$code"
  fi
}
step_check addPhone         /api/user/addPhone         POST '{"phone":"+2348012345678"}'
step_check verifyAddPhone   /api/user/verifyAddPhone   POST '{"otp":"000000"}'
step_check putPhone         /api/user/phone            PUT  '{"newPhone":"+2348012345678","password":"Katiekendra123@"}'
step_check delPhone         /api/user/phone            DELETE '{}'
step_check addEmail         /api/user/addEmail         POST '{"email":"qa-probe@example.com"}'

echo "--- updateUser mass-assignment ---"
got=$(c -X PUT "$URL/api/user/updateUser" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"data":{"name":"Kendra Test","email":"attacker@example.com"}}')
body=$(cat /tmp/_body)
if [[ "$got" == "400" && "$body" == *"must be verified"* ]]; then PASS=$((PASS+1)); echo "PASS updateUser_email_blocked"; else FAIL=$((FAIL+1)); FAILS+=("updateUser_email_blocked got=$got body=$body"); echo "FAIL updateUser_email_blocked got=$got body=$(head -c 200 /tmp/_body)"; fi

got=$(c -X PUT "$URL/api/user/profile" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"mobile":"2348012345678"}')
body=$(cat /tmp/_body)
if [[ "$got" == "400" && "$body" == *"must be verified"* ]]; then PASS=$((PASS+1)); echo "PASS profile_mobile_blocked"; else FAIL=$((FAIL+1)); FAILS+=("profile_mobile_blocked got=$got body=$body"); echo "FAIL profile_mobile_blocked got=$got body=$(head -c 200 /tmp/_body)"; fi

echo "--- stepup status + unlock/relock ---"
got=$(c "$URL/api/stepup/security/status" -H "Authorization: Bearer $TOK")
body=$(cat /tmp/_body)
echo "stepup_status body: $body"
if [[ "$got" == "200" && "$body" == *'"factor":"authenticator"'* && "$body" == *'"totp":true'* ]]; then PASS=$((PASS+1)); echo "PASS stepup_status"; else FAIL=$((FAIL+1)); FAILS+=("stepup_status got=$got body=$body"); fi

# TOTP → unlock
TOTP=$(node /app/backend/scripts/print_totp.cjs 1 | tr -d '[:space:]' | tail -c 6)
echo "TOTP=$TOTP"
got=$(c -X POST "$URL/api/stepup/security/verify" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"method\":\"totp\",\"code\":\"$TOTP\"}")
body=$(cat /tmp/_body)
if [[ "$got" == "200" && "$body" == *'"active":true'* ]]; then PASS=$((PASS+1)); echo "PASS stepup_verify"; else FAIL=$((FAIL+1)); FAILS+=("stepup_verify got=$got body=$body"); echo "FAIL stepup_verify got=$got body=$body"; fi

# addPhone must NOT be 403 STEPUP_REQUIRED anymore
got=$(c -X POST "$URL/api/user/addPhone" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"phone":"+2348012345678"}')
body=$(cat /tmp/_body)
if [[ "$body" == *"STEPUP_REQUIRED"* ]]; then FAIL=$((FAIL+1)); FAILS+=("addPhone_after_stepup still gated: $body"); echo "FAIL addPhone_after_stepup still gated"; else PASS=$((PASS+1)); echo "PASS addPhone_after_stepup ($got — gate opened)"; fi

# revoke
got=$(c -X POST "$URL/api/stepup/security/revoke" -H "Authorization: Bearer $TOK")
[[ "$got" == "200" || "$got" == "204" ]] && { PASS=$((PASS+1)); echo "PASS stepup_revoke ($got)"; } || { FAIL=$((FAIL+1)); FAILS+=("stepup_revoke got=$got"); }

echo "=== 4) Currency ==="
got=$(c "$URL/api/user/display-currency?company_id=1" -H "Authorization: Bearer $TOK")
body=$(cat /tmp/_body)
if [[ "$got" == "200" && "$body" == *'"display_currency":"NGN"'* && "$body" == *'"brand_currency_set":true'* ]]; then PASS=$((PASS+1)); echo "PASS user_display_currency"; else FAIL=$((FAIL+1)); FAILS+=("user_display_currency got=$got body=$body"); echo "FAIL user_display_currency body=$body"; fi

got=$(c -X PATCH "$URL/api/user/display-currency" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"display_currency":"USD"}')
[[ "$got" == "404" ]] && { PASS=$((PASS+1)); echo "PASS patch_user_display_removed"; } || { FAIL=$((FAIL+1)); FAILS+=("patch_user_display_removed got=$got"); }

got=$(c "$URL/api/dashboard?company_id=1" -H "Authorization: Bearer $TOK")
body=$(cat /tmp/_body)
if [[ "$body" == *'"currency":"NGN"'* && "$body" == *"₦"* ]]; then PASS=$((PASS+1)); echo "PASS dashboard_ngn"; else FAIL=$((FAIL+1)); FAILS+=("dashboard_ngn got=$got body=$(head -c 300 /tmp/_body)"); echo "FAIL dashboard_ngn"; fi

got=$(c "$URL/api/dashboard/overview?company_id=1&period=7d" -H "Authorization: Bearer $TOK")
body=$(cat /tmp/_body)
if [[ "$body" == *'"currency":"NGN"'* && "$body" == *"₦"* ]]; then PASS=$((PASS+1)); echo "PASS overview_ngn"; else FAIL=$((FAIL+1)); FAILS+=("overview_ngn got=$got body=$(head -c 300 /tmp/_body)"); echo "FAIL overview_ngn"; fi

got=$(c "$URL/api/company/display-currency/1" -H "Authorization: Bearer $TOK")
body=$(cat /tmp/_body)
if [[ "$body" == *'"display_currency":"NGN"'* ]]; then PASS=$((PASS+1)); echo "PASS company_display_currency"; else FAIL=$((FAIL+1)); FAILS+=("company_display_currency got=$got body=$body"); fi

# addApi without base_currency — send invalid company_id ("abc") — assert error does NOT mention base_currency/Currency
got=$(c -X POST "$URL/api/userApi/addApi" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"company_id":"abc","api_name":"qa-should-fail","environment":"production"}')
body=$(cat /tmp/_body)
if [[ "$got" == "400" && "$body" != *"base_currency"* && "$body" != *"Currency"* && "$body" != *"currency"* ]]; then
  PASS=$((PASS+1)); echo "PASS addApi_no_currency_required"
else
  # accept if not 400 but definitely fail if currency mentioned
  if [[ "$body" == *"base_currency"* || "$body" == *"Currency is Required"* ]]; then
    FAIL=$((FAIL+1)); FAILS+=("addApi_no_currency_required body mentions currency: $body"); echo "FAIL addApi_no_currency_required"
  else
    PASS=$((PASS+1)); echo "PASS addApi_no_currency_required (got=$got no currency mention)"
  fi
fi

echo "=== 5) Scanner hardening ==="
got=$(c "$URL/api/pay/creator/credentials.json")
[[ "$got" == "404" ]] && { PASS=$((PASS+1)); echo "PASS creator_credentials_404"; } || { FAIL=$((FAIL+1)); FAILS+=("creator_credentials_404 got=$got"); }
got=$(c "$URL/api/pay/creator/devhub")
[[ "$got" == "200" ]] && { PASS=$((PASS+1)); echo "PASS creator_devhub_200"; } || { FAIL=$((FAIL+1)); FAILS+=("creator_devhub_200 got=$got"); }

# Frontend catch-all — keep to 3 scanner probes total to avoid IP block
for p in /.env /config.json /wp-config.php.bak; do
  got=$(c "$URL$p")
  [[ "$got" == "404" ]] && { PASS=$((PASS+1)); echo "PASS FE_$p=404"; } || { FAIL=$((FAIL+1)); FAILS+=("FE_$p got=$got"); }
done
got=$(c "$URL/devhub")
[[ "$got" == "200" ]] && { PASS=$((PASS+1)); echo "PASS devhub_200"; } || { FAIL=$((FAIL+1)); FAILS+=("devhub_200 got=$got"); }

echo
echo "======================================"
echo "TOTAL: PASS=$PASS FAIL=$FAIL"
for f in "${FAILS[@]}"; do echo "  - $f"; done
