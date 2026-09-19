#!/usr/bin/env bash
# SafeDeal backend smoke test (simulated money). Usage: bash /app/backend/scripts/safedeal_smoke.sh [API_BASE]
set -euo pipefail
API="${1:-http://localhost:8001}/api/safedeal"
J() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }
SELLER="sd-seller-$(date +%s)@example.com"; BUYER="sd-buyer-$(date +%s)@example.com"

login() { # $1 email -> token
  code=$(curl -s -X POST "$API/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\"}" | J "d['data']['preview_code']")
  curl -s -X POST "$API/auth/verify-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"code\":\"$code\"}" | J "d['data']['token']"
}
ST=$(login "$SELLER"); BT=$(login "$BUYER"); echo "tokens ok"

DEAL=$(curl -s -X POST "$API/deals" -H "x-safedeal-token: $ST" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Logo design\",\"amount\":200,\"my_role\":\"seller\",\"counterparty_email\":\"$BUYER\",\"fee_payer\":\"split\",\"auto_release_days\":5}")
TOKEN=$(echo "$DEAL" | J "d['data']['deal_token']"); echo "deal $TOKEN status=$(echo "$DEAL" | J "d['data']['status']") buyerPays=$(echo "$DEAL" | J "d['data']['breakdown']['buyerPays']") sellerGets=$(echo "$DEAL" | J "d['data']['breakdown']['sellerReceives']")"

echo "min-deal check: $(curl -s -X POST "$API/deals" -H "x-safedeal-token: $ST" -H 'Content-Type: application/json' -d "{\"title\":\"tiny\",\"amount\":20,\"counterparty_email\":\"$BUYER\"}" | J "d['message']")"
echo "preview: $(curl -s "$API/deals/$TOKEN/preview" | J "d['data']['counterparty_email_masked']")"

act() { curl -s -X POST "$API/deals/$TOKEN/action" -H "x-safedeal-token: $1" -H 'Content-Type: application/json' -d "$2"; }
echo "accept: $(act "$BT" '{"action":"accept"}' | J "d['data']['status']")"
echo "fund(sim): $(act "$BT" '{"action":"fund"}' | J "d['data']['status'] + ' held=' + str(d['data']['custody_amount_stable'])")"
echo "buyer wallet after fund: $(curl -s "$API/wallet" -H "x-safedeal-token: $BT" | J "d['data']['wallet']")"
echo "deliver: $(act "$ST" '{"action":"deliver","delivery_note":"Files sent"}' | J "d['data']['status']")"
echo "release: $(act "$BT" '{"action":"release"}' | J "d['data']['status'] + ' seller_leg=' + d['data']['seller_payout_state']")"
echo "seller wallet: $(curl -s "$API/wallet" -H "x-safedeal-token: $ST" | J "d['data']['wallet']")"
echo "buyer wallet: $(curl -s "$API/wallet" -H "x-safedeal-token: $BT" | J "d['data']['wallet']")"
echo "buyer statement:"; curl -s "$API/wallet/statement" -H "x-safedeal-token: $BT" | python3 -c "import sys,json; [print('  ',r['type'],r['kind'],r['signed'],'->',r['running_balance']) for r in json.load(sys.stdin)['data']['entries']]"

# ── second deal: pay from balance + cancellation request + agree (refund minus fees)
D2=$(curl -s -X POST "$API/deals" -H "x-safedeal-token: $BT" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Domain transfer\",\"amount\":50,\"my_role\":\"buyer\",\"counterparty_email\":\"$SELLER\",\"fee_payer\":\"buyer\"}")
T2=$(echo "$D2" | J "d['data']['deal_token']"); echo "deal2 $T2 buyerPays=$(echo "$D2" | J "d['data']['breakdown']['buyerPays']")"
act2() { curl -s -X POST "$API/deals/$T2/action" -H "x-safedeal-token: $1" -H 'Content-Type: application/json' -d "$2"; }
echo "accept2: $(act2 "$ST" '{"action":"accept"}' | J "d['data']['status']")"
echo "fund-balance (buyer has 0): $(act2 "$BT" '{"action":"fund-balance"}' | J "d['message']")"
echo "seller pre-fund cancel? (should be free cancel): skipped"
echo "fund(sim)2: $(act2 "$BT" '{"action":"fund"}' | J "d['data']['status']")"
echo "cancel request (seller): $(act2 "$ST" '{"action":"cancel","reason":"cannot deliver"}' | J "d['message'] + ' | kind=' + str(d['data']['dispute_proposal'].get('kind'))")"
echo "agree (buyer): $(act2 "$BT" '{"action":"dispute-accept"}' | J "d['data']['status'] + ' buyer_leg=' + d['data']['buyer_payout_state']")"
echo "buyer wallet: $(curl -s "$API/wallet" -H "x-safedeal-token: $BT" | J "d['data']['wallet']")"

# ── third: free pre-funding cancel by counterparty
D3=$(curl -s -X POST "$API/deals" -H "x-safedeal-token: $ST" -H 'Content-Type: application/json' -d "{\"title\":\"Extra item\",\"amount\":40,\"counterparty_email\":\"$BUYER\"}")
T3=$(echo "$D3" | J "d['data']['deal_token']")
curl -s -X POST "$API/deals/$T3/action" -H "x-safedeal-token: $BT" -H 'Content-Type: application/json' -d '{"action":"accept"}' >/dev/null
echo "free cancel by buyer: $(curl -s -X POST "$API/deals/$T3/action" -H "x-safedeal-token: $BT" -H 'Content-Type: application/json' -d '{"action":"cancel"}' | J "d['data']['status'] + ' | ' + d['message']")"

# ── wallet: address (step-up) + withdraw
SC=$(curl -s -X POST "$API/auth/step-up" -H "x-safedeal-token: $ST" | J "d['data']['preview_code']")
ADDR=$(curl -s -X POST "$API/wallet/addresses" -H "x-safedeal-token: $ST" -H 'Content-Type: application/json' -d "{\"payout_key\":\"USDT-TRON\",\"address\":\"TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf\",\"label\":\"Main\",\"code\":\"$SC\"}")
AID=$(echo "$ADDR" | J "d['data']['address_id']"); echo "address saved id=$AID"
echo "quote: $(curl -s -X POST "$API/wallet/withdraw/quote" -H "x-safedeal-token: $ST" -H 'Content-Type: application/json' -d "{\"address_id\":$AID,\"amount\":50}" | J "d['data']")"
SC=$(curl -s -X POST "$API/auth/step-up" -H "x-safedeal-token: $ST" | J "d['data']['preview_code']")
echo "withdraw 50: $(curl -s -X POST "$API/wallet/withdraw" -H "x-safedeal-token: $ST" -H 'Content-Type: application/json' -d "{\"address_id\":$AID,\"amount\":50,\"code\":\"$SC\"}" | J "d['message'] + ' status=' + d['data']['withdrawal']['status'] + ' wallet=' + str(d['data']['wallet'])")"
echo "deals list (seller): $(curl -s "$API/deals" -H "x-safedeal-token: $ST" | J "[ (x['title'], x['status'], x['my_role']) for x in d['data']]")"
echo "csv head:"; curl -s "$API/wallet/statement.csv" -H "x-safedeal-token: $ST" | head -3
echo "DONE seller=$SELLER buyer=$BUYER"
