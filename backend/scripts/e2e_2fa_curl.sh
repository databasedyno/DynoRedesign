#!/usr/bin/env bash
# E2E TOTP 2FA lifecycle via curl against the preview. Requires EMAIL/PASSWORD env.
set -u
API=$(grep "^NEXT_PUBLIC_SERVER_URL" /app/.env | cut -d= -f2)
API=${API%/}
J() { python3 -c "
import sys,json
d=json.load(sys.stdin)
try: print(eval('d'+sys.argv[1]))
except Exception as e: print('ERR',type(e).__name__)" "$1" 2>/dev/null; }
totp() { node -e "const {generateSync}=require('/app/backend/node_modules/otplib');console.log(generateSync({secret:process.argv[1],strategy:'totp'}))" "$1" 2>/dev/null; }

echo "## 1. password login (no 2FA yet)"
R=$(curl -s -X POST "$API/api/user/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$R" | J "['data']['accessToken']"); echo "  token: ${TOKEN:0:20}... requires_2fa=$(echo "$R" | J "['data'].get('requires_2fa')")"

echo "## 2. status (expect enabled false)"
curl -s "$API/api/user/2fa/status" -H "Authorization: Bearer $TOKEN" | J "['data']"

echo "## 3. setup"
S=$(curl -s -X POST "$API/api/user/2fa/setup" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
SECRET=$(echo "$S" | J "['data']['secret']"); BACKUP=$(echo "$S" | J "['data']['backup_codes'][0]"); QR=$(echo "$S" | J "['data']['qr_code'][:22]")
echo "  secret=$SECRET backup0=$BACKUP qr=$QR"

echo "## 4. verify-setup with WRONG code (expect 400)"
curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/verify-setup" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"token":"000000"}'

echo "## 5. verify-setup with real TOTP"
CODE=$(totp "$SECRET"); curl -s -X POST "$API/api/user/2fa/verify-setup" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"token\":\"$CODE\"}" | J "['message']"

echo "## 6. status (expect enabled true, 10 codes)"
curl -s "$API/api/user/2fa/status" -H "Authorization: Bearer $TOKEN" | J "['data']"

echo "## 7. login again -> expect requires_2fa + challenge_token, NO accessToken"
R=$(curl -s -X POST "$API/api/user/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
CH=$(echo "$R" | J "['data']['challenge_token']"); echo "  requires_2fa=$(echo "$R" | J "['data']['requires_2fa']") challenge=${CH:0:12}... accessToken=$(echo "$R" | J "['data'].get('accessToken')")"

echo "## 8. validate with wrong code (expect 401)"
curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/validate" -H "Content-Type: application/json" -d "{\"challenge_token\":\"$CH\",\"token\":\"111111\"}"

echo "## 9. validate with TOTP (expect accessToken)"
CODE=$(totp "$SECRET"); V=$(curl -s -X POST "$API/api/user/2fa/validate" -H "Content-Type: application/json" -d "{\"challenge_token\":\"$CH\",\"token\":\"$CODE\"}")
TOKEN2=$(echo "$V" | J "['data']['accessToken']"); echo "  method=$(echo "$V" | J "['data']['method']") token=${TOKEN2:0:20}..."

echo "## 10. replay same challenge (expect 400 expired)"
CODE=$(totp "$SECRET"); curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/validate" -H "Content-Type: application/json" -d "{\"challenge_token\":\"$CH\",\"token\":\"$CODE\"}"

echo "## 11. login + validate with BACKUP code"
R=$(curl -s -X POST "$API/api/user/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
CH=$(echo "$R" | J "['data']['challenge_token']")
V=$(curl -s -X POST "$API/api/user/2fa/validate" -H "Content-Type: application/json" -d "{\"challenge_token\":\"$CH\",\"token\":\"$BACKUP\"}")
echo "  method=$(echo "$V" | J "['data']['method']") remaining=$(curl -s "$API/api/user/2fa/status" -H "Authorization: Bearer $TOKEN2" | J "['data']['backup_codes_remaining']")"

echo "## 12. reuse same backup code (expect 401)"
R=$(curl -s -X POST "$API/api/user/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
CH=$(echo "$R" | J "['data']['challenge_token']")
curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/validate" -H "Content-Type: application/json" -d "{\"challenge_token\":\"$CH\",\"token\":\"$BACKUP\"}"

echo "## 13. regenerate backup codes: wrong pw (401) then right pw"
curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/regenerate-backup-codes" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"password":"nope"}'
curl -s -X POST "$API/api/user/2fa/regenerate-backup-codes" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d "{\"password\":\"$PASSWORD\"}" | J "['data']['backup_codes'].__len__()"

echo "## 14. disable: no credential (400), wrong pw (401), right pw (200)"
curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/disable" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -w "  http=%{http_code}\n" -X POST "$API/api/user/2fa/disable" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"password":"nope"}'
curl -s -X POST "$API/api/user/2fa/disable" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d "{\"password\":\"$PASSWORD\"}" | J "['message']"

echo "## 15. login again -> direct session (no 2FA)"
R=$(curl -s -X POST "$API/api/user/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "  requires_2fa=$(echo "$R" | J "['data'].get('requires_2fa')") hasToken=$(echo "$R" | J "['data'].get('accessToken') is not None")"
