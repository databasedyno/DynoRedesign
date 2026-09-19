#!/usr/bin/env bash
# SafeDeal Batch 2/3 backend smoke: fiat deal → amend → resend → accept → fund → deliver(proof+file) → request-changes → deliver → PDF → cooling-off.
set -euo pipefail
API="${API:-http://localhost:8001}/api/safedeal"
S="sd-b23-$(date +%s)"
A="${S}-seller@example.com"; B="${S}-buyer@example.com"
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1"; }
login() { local code; code=$(curl -s -XPOST "$API/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\"}" | j "['data']['preview_code']"); curl -s -XPOST "$API/auth/verify-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"code\":\"$code\"}" | j "['data']['token']"; }
TA=$(login "$A"); TB=$(login "$B")
act() { curl -s -XPOST "$API/deals/$2/action" -H "x-safedeal-token: $1" -H 'Content-Type: application/json' -d "$3"; }

echo "# 1 create EUR deal (goods, due date)"
DUE=$(date -u -d '+5 days' +%Y-%m-%d)
CREATE=$(curl -s -XPOST "$API/deals" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"title\":\"Vintage lens\",\"amount\":300,\"price_currency\":\"EUR\",\"my_role\":\"seller\",\"counterparty_email\":\"$B\",\"fee_payer\":\"buyer\",\"auto_release_days\":3,\"deal_type\":\"goods\",\"delivery_due_at\":\"$DUE\",\"terms\":\"Ships insured.\"}")
TOK=$(echo "$CREATE" | j "['data']['deal_token']"); echo "$CREATE" | j "['data']['price_currency'],d['data']['price_amount'],d['data']['amount'],d['data']['deal_type'],d['data']['delivery_due_at']"

echo "# 2 buyer accepts, then seller amends (→ back to invited)"
act "$TB" "$TOK" '{"action":"accept"}' | j "['data']['status']"
act "$TA" "$TOK" '{"action":"amend","amount":320,"terms":"Ships insured + tracked."}' | j "['message'],d['data']['status'],d['data']['price_amount']"
echo "# 2b buyer cannot amend"; act "$TB" "$TOK" '{"action":"amend","title":"x y"}' | j "['message']"
echo "# 3 resend invite + cooldown"
act "$TA" "$TOK" '{"action":"resend-invite"}' | j "['message']"
act "$TA" "$TOK" '{"action":"resend-invite"}' | j "['message']"
echo "# 4 re-accept + fund (locks fx)"
act "$TB" "$TOK" '{"action":"accept"}' | j "['data']['status']"
act "$TB" "$TOK" '{"action":"fund"}' | j "['data']['status'],d['data']['fx_locked_at'] is not None,d['data']['counterparty']"
echo "# 5 seller uploads a file + delivers with proof"
printf '\x89PNG\r\n\x1a\n%s' "fakepng-bytes" > /tmp/sd-proof.png
FID=$(curl -s -XPOST "$API/deals/$TOK/files" -H "x-safedeal-token: $TA" -F "file=@/tmp/sd-proof.png;type=image/png" | j "['data']['attachment_id']"); echo "file id $FID"
act "$TA" "$TOK" "{\"action\":\"deliver\",\"delivery_note\":\"Shipped today\",\"tracking\":{\"carrier\":\"DHL\",\"number\":\"JD0001\"},\"links\":[\"https://dhl.com/track/JD0001\"],\"attachment_ids\":[$FID]}" | j "['data']['status'],d['data']['delivery_proof'],[a['name'] for a in d['data']['attachments']]"
echo "# 5b buyer downloads the file"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$API/deals/$TOK/files/$FID" -H "x-safedeal-token: $TB"
echo "# 6 buyer requests changes (round 1) → funded"
act "$TB" "$TOK" '{"action":"request-changes","message":"short"}' | j "['message']"
act "$TB" "$TOK" '{"action":"request-changes","message":"The lens cap is missing, please include it."}' | j "['data']['status'],d['data']['revision_round'],d['data']['revision_note']"
echo "# 7 seller re-delivers, buyer round 2, seller re-delivers, round 3 blocked"
act "$TA" "$TOK" '{"action":"deliver","delivery_note":"Cap added"}' | j "['data']['status']"
act "$TB" "$TOK" '{"action":"request-changes","message":"Still wrong cap model, need the original."}' | j "['data']['revision_round']"
act "$TA" "$TOK" '{"action":"deliver","delivery_note":"Original cap"}' | j "['data']['status']"
act "$TB" "$TOK" '{"action":"request-changes","message":"One more thing please, thanks."}' | j "['message']"
echo "# 8 PDF"; curl -s -o /tmp/sd-deal.pdf -w "%{http_code} %{content_type} " "$API/deals/$TOK/summary.pdf" -H "x-safedeal-token: $TB"; head -c 5 /tmp/sd-deal.pdf; echo
echo "# 9 release → wallet → add address → withdraw blocked by cooling-off"
act "$TB" "$TOK" '{"action":"release"}' | j "['data']['status']"
CODE=$(curl -s -XPOST "$API/auth/step-up" -H "x-safedeal-token: $TA" | j "['data']['preview_code']")
curl -s -XPOST "$API/wallet/addresses" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"payout_key\":\"USDT-TRON\",\"address\":\"TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR\",\"code\":\"$CODE\"}" | j "['data']['address_id']"
ADDR=$(curl -s "$API/wallet" -H "x-safedeal-token: $TA" | j "['data']['addresses'][0]['address_id']")
CODE=$(curl -s -XPOST "$API/auth/step-up" -H "x-safedeal-token: $TA" | j "['data']['preview_code']")
curl -s -XPOST "$API/wallet/withdraw" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"address_id\":$ADDR,\"amount\":50,\"code\":\"$CODE\"}" | j "['message']"
echo "# 10 admin run-reminders (needs admin token) — skipped unless ADMIN_TOKEN set"
[ -n "${ADMIN_TOKEN:-}" ] && curl -s -XPOST "$API/admin/run-reminders" -H "Authorization: Bearer $ADMIN_TOKEN" | j "['message']" || true
echo "DEAL $TOK"
