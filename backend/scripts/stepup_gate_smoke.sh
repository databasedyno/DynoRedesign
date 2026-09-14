#!/usr/bin/env bash
# Step-up gate chain smoke test (SAFE MODE: no data mutated — the gated calls are
# either read-only-ish or invalid enough to be rejected AFTER the gate).
set -u
BASE=${BASE:-http://localhost:8001}
EMAIL=${EMAIL:-onarrival21@gmail.com}
PASS=${PASS:-Katiekendra123@}
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

TOKEN=$(curl -s -X POST "$BASE/api/user/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | j "d['data']['accessToken']")
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-Company-Id: 1")
echo "token ok: ${TOKEN:0:12}…"

echo; echo "== 1. status (apikey) — expect active:false, methods.email true"
curl -s "$BASE/api/stepup/apikey/status" "${AUTH[@]}" | j "(d['data']['active'], d['data']['methods'], d['data']['contact'])"

echo; echo "== 2. gated call WITHOUT session → expect 403 STEPUP_REQUIRED scope=apikey"
curl -s -o /tmp/su1.json -w "%{http_code}\n" -X POST "$BASE/api/userApi/regenerateKey/999999" "${AUTH[@]}"; cat /tmp/su1.json; echo

echo; echo "== 3. request-code (apikey) → preview_otp"
R=$(curl -s -X POST "$BASE/api/stepup/apikey/request-code" "${AUTH[@]}" -d '{}'); echo "$R" | head -c 300; echo
OTP=$(echo "$R" | j "d['data'].get('preview_otp','')")
echo "otp=$OTP"

echo; echo "== 4. verify with WRONG code → 400"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/stepup/apikey/verify" "${AUTH[@]}" -d '{"method":"email","code":"000000"}'

echo; echo "== 5. verify with correct code → 200 active"
curl -s -X POST "$BASE/api/stepup/apikey/verify" "${AUTH[@]}" -d "{\"method\":\"email\",\"code\":\"$OTP\"}" | head -c 300; echo

echo; echo "== 6. same gated call WITH session → passes the gate (expect NOT 403 STEPUP; 404/403-owner for bogus id)"
curl -s -o /tmp/su2.json -w "%{http_code}\n" -X POST "$BASE/api/userApi/regenerateKey/999999" "${AUTH[@]}"; cat /tmp/su2.json; echo

echo; echo "== 7. SCOPE ISOLATION: wallet-scoped call still 403 STEPUP_REQUIRED scope=wallet"
curl -s -o /tmp/su3.json -w "%{http_code}\n" -X POST "$BASE/api/wallet/batch" "${AUTH[@]}" -d '{"company_id":1,"operations":[]}'; cat /tmp/su3.json; echo

echo; echo "== 8. status (apikey) → active:true"
curl -s "$BASE/api/stepup/apikey/status" "${AUTH[@]}" | j "(d['data']['active'], d['data']['expires_at']>0)"

echo; echo "== 9. revoke → status active:false, gated call 403 again"
curl -s -X POST "$BASE/api/stepup/apikey/revoke" "${AUTH[@]}" -d '{}' | head -c 120; echo
curl -s "$BASE/api/stepup/apikey/status" "${AUTH[@]}" | j "d['data']['active']"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/userApi/regenerateKey/999999" "${AUTH[@]}"

echo; echo "== 10. unknown scope → 400; rate limit second request-code within 30s → 429"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/stepup/bogus/status" "${AUTH[@]}"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/stepup/apikey/request-code" "${AUTH[@]}" -d '{}'

echo; echo "== 11. other gated routes without session → all 403 STEPUP_REQUIRED with their scope"
echo "   (payloads are deliberately non-mutating even if a gate were missing: bogus ids / states the controller rejects before any write)"
for spec in "POST /api/team/invite team" "DELETE /api/company/deleteCompany/999999999 brand_delete" "PUT /api/company/auto-convert/999999999 settlement" "POST /api/referral/payout/auto payout" "PUT /api/user/changePassword security" "POST /api/user/2fa/disable security" "POST /api/wallet/wallet/delete/verify wallet"; do
  set -- $spec; M=$1; P=$2; S=$3
  CODE=$(curl -s -o /tmp/su4.json -w "%{http_code}" -X "$M" "$BASE$P" "${AUTH[@]}" -d '{"company_id":999999999,"wallet_id":999999999,"email":"stepup-probe-invalid","enabled":true,"auto_min_usd":1,"oldPassword":"definitely-wrong-old-pw","newPassword":"Bbbbbbbb1@","confirmPassword":"Bbbbbbbb1@"}')
  echo "$M $P → $CODE $(cat /tmp/su4.json | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('code'),d.get('scope'))" 2>/dev/null) (expect 403 STEPUP_REQUIRED $S)"
done
