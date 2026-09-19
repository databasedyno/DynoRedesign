#!/usr/bin/env bash
# SafeDeal smoke: exchange fee, top-up → balance, fund from balance, auto-withdraw semantics, invoices.
set -u
API="$(grep -E '^APP_URL=|APP_URL=' /etc/supervisor/conf.d/supervisord.conf | sed -E 's/.*APP_URL="([^"]+)".*/\1/')/api"
TS=$(date +%s)
BUYER="sd-smoke-$TS-buyer@example.com"; SELLER="sd-smoke-$TS-seller@example.com"
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$1"; }
login() { local code; code=$(curl -s -X POST "$API/safedeal/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\"}" | j "['data']['preview_code']"); curl -s -X POST "$API/safedeal/auth/verify-code" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"code\":\"$code\"}" | j "['data']['token']"; }
BT=$(login "$BUYER"); ST=$(login "$SELLER"); echo "tokens ok: ${BT:0:10}… ${ST:0:10}…"
H() { echo "-H x-safedeal-token:$1 -H Content-Type:application/json"; }

echo "== 1. fee preview (unknown coin → exchange fee shown)"; curl -s -X POST "$API/safedeal/fee-preview" -H 'Content-Type: application/json' -d '{"amount":100,"fee_payer":"buyer"}' | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print({k:d[k] for k in ['escrowFee','exchangeFeeUsd','exchangeFeePercent','conversionFeeUsd','networkFeeUsd','withdrawalFeeUsd','totalCost','buyerPays']});print([ (c['key'],c['amount']) for c in d['costItems']])"

echo "== 2. top-up quotes for \$100"; curl -s "$API/safedeal/wallet/topup/coins?amount=100" $(H $BT) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([(c['coin'],c['exchange_fee'],c['conversion_fee'],c['network_fee'],c['pays']) for c in d['coins']])"
echo "== 3. create top-up USDT-TRC20 \$100"; T=$(curl -s -X POST "$API/safedeal/wallet/topup" $(H $BT) -d '{"amount":100,"coin":"USDT-TRC20"}'); echo "$T" | python3 -c "import sys,json;d=json.load(sys.stdin);t=d['data']['topup'];print(d['message']);print(t['topup_id'],t['status'],t['address'],t['crypto_amount'],t['pays_usd'])"
TID=$(echo "$T" | j "['data']['topup']['topup_id']")
echo "== 3b. idempotent re-create"; curl -s -X POST "$API/safedeal/wallet/topup" $(H $BT) -d '{"amount":100,"coin":"USDT-TRC20"}' | j "['data']['topup']['topup_id']"
echo "== 3c. below min"; curl -s -X POST "$API/safedeal/wallet/topup" $(H $BT) -d '{"amount":5,"coin":"USDT-TRC20"}' | j "['message']"
echo "== 4. simulate deposit"; curl -s -X POST "$API/safedeal/wallet/topup/$TID/simulate" $(H $BT) -d '{}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'], d['data']['wallet'])"
echo "== 4b. simulate again (409)"; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/safedeal/wallet/topup/$TID/simulate" $(H $BT) -d '{}'
echo "== 5. wallet + statement"; curl -s "$API/safedeal/wallet" $(H $BT) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d['wallet'], 'topups', [(t['topup_id'],t['status']) for t in d['topups']], 'limits', d['limits'])"
curl -s "$API/safedeal/wallet/statement" $(H $BT) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([(r['kind'],r['signed'],r['running_balance']) for r in d['entries']])"

echo "== 6. seller creates \$30 deal (buyer pays fees), buyer accepts + funds from balance"
D=$(curl -s -X POST "$API/safedeal/deals" $(H $ST) -d "{\"title\":\"Smoke deal $TS\",\"amount\":30,\"my_role\":\"seller\",\"counterparty_email\":\"$BUYER\",\"fee_payer\":\"buyer\",\"auto_release_days\":1}")
TOK=$(echo "$D" | j "['data']['deal_token']"); echo "deal $TOK"
curl -s -X POST "$API/safedeal/deals/$TOK/action" $(H $BT) -d '{"action":"accept"}' | j "['data']['status']"
curl -s "$API/safedeal/deals/$TOK" $(H $BT) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];b=d.get('fee_breakdown') or d.get('breakdown') or {};print('buyer_balance',d.get('buyer_balance'));print('keys with fee', [k for k in d if 'fee' in k.lower() or 'breakdown' in k.lower()])"
curl -s -X POST "$API/safedeal/deals/$TOK/action" $(H $BT) -d '{"action":"fund-balance"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'], d['data']['status'], d['data'].get('funding_method'), d['data'].get('custody_amount_stable'))"
curl -s "$API/safedeal/wallet" $(H $BT) | j "['data']['wallet']"

echo "== 7. seller delivers, buyer releases; seller has NO auto-withdraw → funds stay in balance"
curl -s -X POST "$API/safedeal/deals/$TOK/action" $(H $ST) -d '{"action":"deliver","note":"done"}' | j "['data']['status']"
R=$(curl -s -X POST "$API/safedeal/deals/$TOK/action" $(H $BT) -d '{"action":"release"}'); echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d['status'], d.get('seller_payout_state'), d.get('seller_payout_tx'));print([a['note'] for a in d['activity_log'] if a['type'].startswith('payout')])"
echo "-- seller wallet (expect available > 0, no withdrawal rows)"; curl -s "$API/safedeal/wallet" $(H $ST) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d['wallet'], 'withdrawals', len(d['withdrawals']), 'parked', d['profile']['parked_payout_usd'])"
echo "-- buyer statement kinds"; curl -s "$API/safedeal/wallet/statement" $(H $BT) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([(r['kind'],r['signed']) for r in d['entries']])"

echo "== 8. invoices (buyer + seller) + PDF"
curl -s "$API/safedeal/invoices" $(H $BT) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([(i['invoice_no'],i['my_role'],i['total_cost'],i['my_fee_share'],i['my_amount'],[(c['key'],c['amount']) for c in i['cost_items']]) for i in d])"
curl -s "$API/safedeal/invoices" $(H $ST) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([(i['invoice_no'],i['my_role'],i['my_fee_share'],i['my_amount'],i['my_payout']) for i in d])"
curl -s -D - -o /tmp/sd-inv.pdf "$API/safedeal/deals/$TOK/summary.pdf" $(H $ST) | grep -i "content-disposition\|HTTP/"; python3 -c "
import subprocess;print(subprocess.run(['pdftotext','/tmp/sd-inv.pdf','-'],capture_output=True,text=True).stdout[:1200])" 2>/dev/null || echo "(pdftotext missing)"

echo "== 9. auto-withdraw ON path: seller adds address, toggles ON, second deal released → withdrawal created"
CODE=$(curl -s -X POST "$API/safedeal/auth/step-up" $(H $ST) -d '{}' | j "['data']['preview_code']")
A=$(curl -s -X POST "$API/safedeal/wallet/addresses" $(H $ST) -d "{\"payout_key\":\"USDT-TRON\",\"address\":\"TA53ttWWqYD2kbLNvJhXj9Qfy1yXN1fjBE\",\"label\":\"Bybit\",\"code\":\"$CODE\"}"); AID=$(echo "$A" | j "['data']['address_id']"); echo "address $AID"
curl -s -X POST "$API/safedeal/profile" $(H $ST) -d "{\"auto_withdraw\":true,\"auto_withdraw_address_id\":$AID}" | j "['data']['profile']"
D2=$(curl -s -X POST "$API/safedeal/deals" $(H $ST) -d "{\"title\":\"Smoke deal 2 $TS\",\"amount\":30,\"my_role\":\"seller\",\"counterparty_email\":\"$BUYER\",\"fee_payer\":\"buyer\",\"auto_release_days\":1}"); TOK2=$(echo "$D2" | j "['data']['deal_token']")
curl -s -X POST "$API/safedeal/deals/$TOK2/action" $(H $BT) -d '{"action":"accept"}' >/dev/null
curl -s -X POST "$API/safedeal/deals/$TOK2/action" $(H $BT) -d '{"action":"fund-balance"}' | j "['data']['status']"
curl -s -X POST "$API/safedeal/deals/$TOK2/action" $(H $ST) -d '{"action":"deliver","note":"done"}' >/dev/null
curl -s -X POST "$API/safedeal/deals/$TOK2/action" $(H $BT) -d '{"action":"release"}' | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d['status'], d.get('seller_payout_tx'));print([a['note'] for a in d['activity_log'] if a['type']=='payout_seller'])"
echo "-- seller wallet (expect parked>0 because address cooling, or withdrawal if cooling skipped)"; curl -s "$API/safedeal/wallet" $(H $ST) | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d['wallet'], 'withdrawals', [(w['withdrawal_id'],w['source'],w['status'],w['amount_usd']) for w in d['withdrawals']], 'parked', d['profile']['parked_payout_usd'])"
echo "-- toggle OFF clears parked"; curl -s -X POST "$API/safedeal/profile" $(H $ST) -d '{"auto_withdraw":false}' >/dev/null; curl -s "$API/safedeal/wallet" $(H $ST) | j "['data']['profile']"
echo "DONE buyer=$BUYER seller=$SELLER"
