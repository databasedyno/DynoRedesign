#!/usr/bin/env bash
# SafeDeal API-key funding smoke: deal → accept → coin list → cryptoPayment address → signed webhook (confirmed) → funded
#   → payout destination (seller) → release → payout at close (Binance withdrawal, simulated) → parked-payout path for buyer refund.
set -euo pipefail
API="${API:-http://localhost:8001}/api/safedeal"
S="sd-api-$(date +%s)"
A="${S}-seller@example.com"; B="${S}-buyer@example.com"
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1"; }
login() { local code; code=$(curl -s -XPOST "$API/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\"}" | j "['data']['preview_code']"); curl -s -XPOST "$API/auth/verify-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"code\":\"$code\"}" | j "['data']['token']"; }
TA=$(login "$A"); TB=$(login "$B")
act() { curl -s -XPOST "$API/deals/$2/action" -H "x-safedeal-token: $1" -H 'Content-Type: application/json' -d "$3"; }

echo "# 1 create + accept"
CREATE=$(curl -s -XPOST "$API/deals" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"title\":\"Logo design\",\"amount\":120,\"my_role\":\"seller\",\"counterparty_email\":\"$B\",\"fee_payer\":\"buyer\",\"auto_release_days\":3,\"deal_type\":\"service\"}")
TOK=$(echo "$CREATE" | j "['data']['deal_token']"); EID=$(echo "$CREATE" | j "['data']['escrow_id']"); echo "deal $EID $TOK"
act "$TB" "$TOK" '{"action":"accept"}' | j "['data']['status']"

echo "# 2 coin list (buyer)"
curl -s "$API/deals/$TOK/funding" -H "x-safedeal-token: $TB" | j "['data']['status'],[(c['coin'],c['buyer_pays']) for c in d['data']['coins']][:5]"
echo "# 2b seller cannot"; curl -s "$API/deals/$TOK/funding" -H "x-safedeal-token: $TA" | j "['message']"

echo "# 3 create payment via Dynopay Merchant API (USDT-TRC20)"
FUND=$(curl -s -XPOST "$API/deals/$TOK/funding" -H "x-safedeal-token: $TB" -H 'Content-Type: application/json' -d '{"coin":"USDT-TRC20"}')
echo "$FUND" | j "['message'],d['data']['payment']['payment_id'],d['data']['payment']['address'],d['data']['payment']['crypto_amount'],d['data']['payment']['status'],d['data']['payment']['expires_at']"
PID=$(echo "$FUND" | j "['data']['payment']['payment_id']"); ADDR=$(echo "$FUND" | j "['data']['payment']['address']")
echo "# 3b same coin again → same payment (idempotent)"; curl -s -XPOST "$API/deals/$TOK/funding" -H "x-safedeal-token: $TB" -H 'Content-Type: application/json' -d '{"coin":"USDT-TRC20"}' | j "['data']['payment']['payment_id']=='$PID'"
echo "# 3c deal view carries funding_payment (no qr)"; curl -s "$API/deals/$TOK" -H "x-safedeal-token: $TB" | j "['data']['funding_payment']['coin'],'qr_code' in (d['data']['funding_payment'] or {}),d['data']['funding_method']"

echo "# 4 webhook: bad signature → 401"
curl -s -o /dev/null -w "%{http_code}\n" -XPOST "${API}/webhooks/dynopay" -H 'Content-Type: application/json' -H 'X-Dynopay-Signature-V2: t=1,v1=00' -d '{"event":"payment.confirmed"}'
echo "# 4b webhook: pending → confirmed (signed)"
SECRET=$(grep -E '^SAFEDEAL_WEBHOOK_SECRET=' /app/backend/.env | cut -d= -f2)
sign() { local t body sig; t=$(date +%s); body="$1"; sig=$(printf '%s.%s' "$t" "$body" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}'); curl -s -XPOST "${API}/webhooks/dynopay" -H 'Content-Type: application/json' -H "X-Dynopay-Signature-V2: t=$t,v1=$sig" --data-binary "$body"; }
sign "{\"event\":\"payment.pending\",\"payment_id\":\"$PID\",\"txId\":\"0xseen\",\"amount\":126.5,\"currency\":\"USDT-TRC20\",\"meta_data\":{\"source\":\"safedeal\",\"escrow_id\":$EID}}" | j "['note']"
curl -s "$API/deals/$TOK/funding" -H "x-safedeal-token: $TB" | j "['data']['payment']['status']"
sign "{\"event\":\"payment.confirmed\",\"payment_id\":\"$PID\",\"txId\":\"0xconfirmed\",\"amount\":126.5,\"base_amount\":126.5,\"currency\":\"USDT-TRC20\",\"meta_data\":\"{\\\"source\\\":\\\"safedeal\\\",\\\"escrow_id\\\":$EID}\"}" | j "['note']"
curl -s "$API/deals/$TOK" -H "x-safedeal-token: $TB" | j "['data']['status'],d['data']['funding_method'],d['data']['funding_payment']['seen_tx'],d['data']['custody_amount_stable']"
echo "# 4c settled webhook (idempotent on status)"
sign "{\"event\":\"payment.settled\",\"payment_id\":\"$PID\",\"txId\":\"0xconfirmed\",\"settlement_tx_id\":\"0xsettle\",\"merchant_amount\":126.1,\"currency\":\"USDT-TRC20\",\"meta_data\":{\"escrow_id\":$EID}}" | j "['note']"
curl -s "$API/deals/$TOK" -H "x-safedeal-token: $TB" | j "['data']['funding_payment']['status'],d['data']['funding_payment']['merchant_amount'],d['data']['funding_settled_at'] is not None"

echo "# 5 seller sets payout destination inside the deal (new address, step-up)"
CODE=$(curl -s -XPOST "$API/auth/step-up" -H "x-safedeal-token: $TA" | j "['data']['preview_code']")
curl -s -XPOST "$API/deals/$TOK/payout-destination" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"payout_key\":\"USDT-TRON\",\"address\":\"TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR\",\"code\":\"$CODE\"}" | j "['message'],d['data']['my_payout_pref']['before_funding'],d['data']['my_payout_pref']['address']['payout_key']"

echo "# 6 deliver + release → payout at close (address added AFTER funding → cooling-off → parked)"
act "$TA" "$TOK" '{"action":"deliver","delivery_note":"Files sent"}' | j "['data']['status']"
REL=$(act "$TB" "$TOK" '{"action":"release"}'); echo "$REL" | j "['data']['status'],d['data']['seller_payout_state'],[a['note'] for a in d['data']['activity_log'] if a['type']=='payout_seller']"
echo "# 6b seller wallet: parked payout + balance"; curl -s "$API/wallet" -H "x-safedeal-token: $TA" | j "['data']['wallet']['available'],d['data']['profile']['parked_payout_usd'],len(d['data']['withdrawals'])"

echo "# 7 second deal: seller address chosen BEFORE funding → cooling-off waived → paid at close"
CREATE2=$(curl -s -XPOST "$API/deals" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"title\":\"Second job\",\"amount\":80,\"my_role\":\"seller\",\"counterparty_email\":\"$B\",\"fee_payer\":\"buyer\",\"auto_release_days\":3}")
TOK2=$(echo "$CREATE2" | j "['data']['deal_token']")
SELLER_ADDR=$(curl -s "$API/wallet" -H "x-safedeal-token: $TA" | j "['data']['addresses'][0]['address_id']")
curl -s -XPOST "$API/deals/$TOK2/payout-destination" -H "x-safedeal-token: $TA" -H 'Content-Type: application/json' -d "{\"address_id\":$SELLER_ADDR}" | j "['data']['my_payout_pref']['before_funding']"
act "$TB" "$TOK2" '{"action":"accept"}' | j "['data']['status']"
act "$TB" "$TOK2" '{"action":"fund"}' | j "['data']['status']"
act "$TA" "$TOK2" '{"action":"deliver","delivery_note":"done"}' | j "['data']['status']"
act "$TB" "$TOK2" '{"action":"release"}' | j "['data']['status'],d['data']['seller_payout_tx'],[a['note'] for a in d['data']['activity_log'] if a['type']=='payout_seller']"
echo "# 7b seller withdrawals: settlement payout, fee 0"; curl -s "$API/wallet/withdrawals" -H "x-safedeal-token: $TA" | j "['data'][0]['source'],d['data'][0]['fee_usd'],d['data'][0]['net_usd'],d['data'][0]['status'],d['data'][0]['escrow_id']"
echo "DEALS $TOK $TOK2"
