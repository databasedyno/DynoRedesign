"""
SafeDeal iteration 208: Wallet top-ups, pay-from-balance, exchange fee, auto-withdraw semantics, invoices.

Covers per review request:
- Fee preview: pre-funding quote priced for a stablecoin (exchange fee 0, 2% surcharge hint)
- Top-up quotes list: stablecoins have 0 exchange fee, non-stables 2.00
- Top-up create: idempotent, below-min 400, unsupported coin 400
- Top-up simulate: credits wallet exactly, 409 on 2nd, statement row appears
- Top-up list/get and cross-user 404
- Deal funded FROM BALANCE: buyer 'fund-balance' → funded, wallet debited
- Auto-withdraw OFF (default): release → WALLET-CREDIT-, parked=0, balance grows
- Auto-withdraw ON: add address → release pays it (parks only if SAFEDEAL_ADDRESS_COOLING_HOURS>0)
- Auto-withdraw ON w/o address → 400
- Deal-level payout destination BEFORE funding → settlement withdrawal on release
- Invoices endpoint returns closed deals only, with cost_items + exchange_fee
- Summary PDF for closed deals: filename 'safedeal-invoice-<id>.pdf'; non-party 403
- Webhook top-up path: HMAC v2 credit + replay-safe + bad signature 401
"""
import hashlib
import hmac
import json
import os
import time

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://passphrase-init-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 25


def _load_webhook_secret():
    with open("/app/backend/.env", "r") as f:
        for line in f:
            if line.startswith("SAFEDEAL_WEBHOOK_SECRET="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("SAFEDEAL_WEBHOOK_SECRET missing")


WEBHOOK_SECRET = _load_webhook_secret()


def _req(method, url, **kw):
    for _ in range(20):
        r = requests.request(method, url, timeout=TIMEOUT, **kw)
        if r.status_code == 503 and "Backend starting" in (r.text or ""):
            time.sleep(3)
            continue
        return r
    return r


def _login(email):
    r = _req("POST", f"{API}/safedeal/auth/send-code", json={"email": email})
    assert r.status_code == 200, r.text[:200]
    code = r.json()["data"]["preview_code"]
    r2 = _req("POST", f"{API}/safedeal/auth/verify-code", json={"email": email, "code": code})
    assert r2.status_code == 200, r2.text[:200]
    return r2.json()["data"]["token"]


def _h(tok):
    return {"x-safedeal-token": tok, "Content-Type": "application/json"}


def _act(tok, deal_token, body):
    return _req("POST", f"{API}/safedeal/deals/{deal_token}/action", headers=_h(tok), json=body)


def _sign(body_str):
    t = str(int(time.time()))
    msg = f"{t}.{body_str}".encode()
    sig = hmac.new(WEBHOOK_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return {"Content-Type": "application/json", "X-Dynopay-Signature-V2": f"t={t},v1={sig}"}


# ---- fixtures --------------------------------------------------------------


@pytest.fixture(scope="module")
def parties():
    ts = int(time.time())
    seller = f"sd-qa208-{ts}-seller@example.com"
    buyer = f"sd-qa208-{ts}-buyer@example.com"
    outsider = f"sd-qa208-{ts}-outsider@example.com"
    return {
        "seller": seller, "buyer": buyer, "outsider": outsider,
        "seller_tok": _login(seller),
        "buyer_tok": _login(buyer),
        "outsider_tok": _login(outsider),
    }


# ---- 1. fee preview --------------------------------------------------------


class TestFeePreview:
    def test_exchange_fee_for_unknown_funding(self):
        # Math audit: before the buyer picks a coin the quote is priced for a STABLECOIN
        # (exchange fee 0) and carries the non-stablecoin surcharge (2% + conversion + network) as a hint.
        r = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 100, "fee_payer": "buyer"})
        assert r.status_code == 200, r.text[:200]
        d = r.json()["data"]
        assert d["exchangeFeePercent"] == 2
        assert float(d["exchangeFeeUsd"]) == 0.0
        assert d["fundingCoinAssumed"] is True
        assert d["quotedFundingCoin"].startswith(("USDT-", "USDC-"))
        assert float(d["nonStableSurchargeUsd"]) >= 2.0  # 2% exchange fee on $100 + conversion + network delta
        keys = {c["key"] for c in d["costItems"]}
        assert "exchange_fee" in keys
        # totalCost = escrow + exchange + network + conversion + withdrawal
        expected = float(d["escrowFee"]) + float(d["exchangeFeeUsd"]) + float(d["networkFeeUsd"]) + float(d["conversionFeeUsd"]) + float(d["withdrawalFeeUsd"])
        assert abs(float(d["totalCost"]) - expected) < 0.01


# ---- 2. top-up quotes ------------------------------------------------------


class TestTopupCoins:
    def test_topup_coins_exchange_fee_split(self, parties):
        r = _req("GET", f"{API}/safedeal/wallet/topup/coins?amount=100", headers=_h(parties["buyer_tok"]))
        assert r.status_code == 200, r.text[:200]
        coins = r.json()["data"]["coins"]
        assert coins, "no coins listed"
        for c in coins:
            coin = c["coin"]
            xf = float(c["exchange_fee"])
            if coin.startswith("USDT-") or coin.startswith("USDC-"):
                assert xf == 0.0, f"{coin} should have 0 exchange fee, got {xf}"
            else:
                assert xf == 2.0, f"{coin} should have 2.00 exchange fee, got {xf}"
            # pays = amount + network + conversion + exchange
            pays = float(c["pays"])
            expected = 100 + float(c["network_fee"]) + float(c["conversion_fee"]) + xf
            assert abs(pays - expected) < 0.02, f"{coin}: pays={pays} expected≈{expected}"


# ---- 3. top-up create ------------------------------------------------------


@pytest.fixture(scope="module")
def topup(parties):
    tok = parties["buyer_tok"]
    r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(tok), json={"amount": 100, "coin": "USDT-TRC20"})
    assert r.status_code == 201, r.text[:300]
    t = r.json()["data"]["topup"]
    return t


class TestTopupCreate:
    def test_create_topup_shape(self, topup):
        for k in ("topup_id", "status", "address", "crypto_amount", "qr_code", "pays_usd"):
            assert k in topup, f"missing {k}"
        assert topup["status"] == "waiting"
        assert topup["address"].startswith("T"), topup["address"]

    def test_topup_idempotent_same_amount_and_coin(self, parties, topup):
        r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(parties["buyer_tok"]),
                 json={"amount": 100, "coin": "USDT-TRC20"})
        assert r.status_code in (200, 201)
        assert r.json()["data"]["topup"]["topup_id"] == topup["topup_id"]

    def test_below_min_400(self, parties):
        r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(parties["buyer_tok"]),
                 json={"amount": 5, "coin": "USDT-TRC20"})
        assert r.status_code == 400
        assert "Minimum" in r.text or "minimum" in r.text
        assert "10" in r.text

    def test_unsupported_coin_400(self, parties):
        r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(parties["buyer_tok"]),
                 json={"amount": 50, "coin": "DOGE-XYZ"})
        assert r.status_code == 400


# ---- 4. simulate deposit ---------------------------------------------------


class TestSimulate:
    def test_simulate_credits_wallet_exactly(self, parties, topup):
        tok = parties["buyer_tok"]
        # Baseline
        w0 = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok)).json()["data"]["wallet"]
        before = float(w0["available"])
        r = _req("POST", f"{API}/safedeal/wallet/topup/{topup['topup_id']}/simulate", headers=_h(tok), json={})
        assert r.status_code == 200, r.text[:200]
        w1 = r.json()["data"]["wallet"]
        assert abs(float(w1["available"]) - (before + 100.0)) < 0.01
        # 2nd simulate → 409
        r2 = _req("POST", f"{API}/safedeal/wallet/topup/{topup['topup_id']}/simulate", headers=_h(tok), json={})
        assert r2.status_code == 409

    def test_wallet_shows_topup_and_limits(self, parties, topup):
        r = _req("GET", f"{API}/safedeal/wallet", headers=_h(parties["buyer_tok"]))
        assert r.status_code == 200
        d = r.json()["data"]
        assert d.get("live") is False
        lims = d["limits"]
        assert float(lims["min_topup_usd"]) == 10.0
        assert float(lims["max_topup_usd"]) == 25000.0
        found = [t for t in d["topups"] if t["topup_id"] == topup["topup_id"]]
        assert found and found[0]["status"] == "credited"

    def test_statement_has_topup_row(self, parties):
        r = _req("GET", f"{API}/safedeal/wallet/statement", headers=_h(parties["buyer_tok"]))
        assert r.status_code == 200
        rows = r.json()["data"]["entries"]
        topups = [row for row in rows if row["kind"] == "topup"]
        assert topups, "no topup row in statement"
        # signed +100
        assert any(float(r["signed"]) == 100.0 for r in topups)
        assert "running_balance" in topups[0]


# ---- 5. top-up list & get / cross-user 404 --------------------------------


class TestTopupList:
    def test_list_and_get(self, parties, topup):
        tok = parties["buyer_tok"]
        r = _req("GET", f"{API}/safedeal/wallet/topup", headers=_h(tok))
        assert r.status_code == 200
        arr = r.json()["data"]
        # data may be dict or list; normalise
        if isinstance(arr, dict):
            arr = arr.get("topups") or arr.get("items") or arr
        assert isinstance(arr, list) and any(x["topup_id"] == topup["topup_id"] for x in arr)
        r2 = _req("GET", f"{API}/safedeal/wallet/topup/{topup['topup_id']}", headers=_h(tok))
        assert r2.status_code == 200

    def test_other_user_gets_404(self, parties, topup):
        r = _req("GET", f"{API}/safedeal/wallet/topup/{topup['topup_id']}", headers=_h(parties["outsider_tok"]))
        assert r.status_code == 404


# ---- 6. Deal funded from balance ------------------------------------------


def _create_deal(seller_tok, buyer_email, amount=30, title="iter208 deal"):
    r = _req("POST", f"{API}/safedeal/deals", headers=_h(seller_tok), json={
        "title": title, "amount": amount, "my_role": "seller",
        "counterparty_email": buyer_email, "fee_payer": "buyer", "auto_release_days": 1,
    })
    assert r.status_code == 201, r.text[:300]
    return r.json()["data"]


@pytest.fixture(scope="module")
def deal_off(parties):
    """Deal funded from balance while auto-withdraw is OFF (default)."""
    d = _create_deal(parties["seller_tok"], parties["buyer"], amount=30, title="iter208 off")
    tok = d["deal_token"]
    ra = _act(parties["buyer_tok"], tok, {"action": "accept"})
    assert ra.status_code == 200
    return d


class TestFundFromBalance:
    def test_insufficient_balance_400(self, parties):
        # outsider buyer has 0 balance
        outsider_email = parties["outsider"]
        d = _create_deal(parties["seller_tok"], outsider_email, amount=50, title="iter208 insuf")
        tok = d["deal_token"]
        _act(parties["outsider_tok"], tok, {"action": "accept"})
        r = _act(parties["outsider_tok"], tok, {"action": "fund-balance"})
        assert r.status_code == 400
        assert "balance" in r.text.lower()

    def test_fund_from_balance_debits_and_holds(self, parties, deal_off):
        tok = parties["buyer_tok"]
        w0 = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok)).json()["data"]["wallet"]
        avail0, held0 = float(w0["available"]), float(w0.get("held", 0))
        r = _act(tok, deal_off["deal_token"], {"action": "fund-balance"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()["data"]
        assert d["status"] == "funded"
        w1 = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok)).json()["data"]["wallet"]
        # buyerPays for $30 deal from-balance (USDT stable, no conversion fee) = 30 + 10 escrow + 2 network + 1 withdrawal = 43
        debited = avail0 - float(w1["available"])
        held_delta = float(w1.get("held", 0)) - held0
        assert 42.5 <= debited <= 43.5, f"buyer debited {debited}"
        assert 42.5 <= held_delta <= 43.5, f"held delta {held_delta}"


# ---- 7. Release path: auto-withdraw OFF → wallet credit --------------------


class TestReleaseAutoWithdrawOff:
    def test_release_credits_seller_wallet(self, parties, deal_off):
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        tok = deal_off["deal_token"]
        rd = _act(seller_tok, tok, {"action": "deliver", "note": "done"})
        assert rd.status_code == 200
        rr = _act(buyer_tok, tok, {"action": "release"})
        assert rr.status_code == 200, rr.text[:300]
        deal = rr.json()["data"]
        assert deal["status"] == "completed"
        assert (deal.get("seller_payout_tx") or "").startswith("WALLET-CREDIT-"), deal.get("seller_payout_tx")
        notes = [a["note"] for a in deal["activity_log"] if a["type"] == "payout_seller"]
        assert notes and "auto-withdraw is off" in notes[0].lower(), notes
        # seller wallet
        rw = _req("GET", f"{API}/safedeal/wallet", headers=_h(seller_tok))
        wd = rw.json()["data"]
        assert float(wd["wallet"]["available"]) >= 30 - 0.01
        assert wd["withdrawals"] == [] or len(wd["withdrawals"]) == 0
        assert float(wd["profile"]["parked_payout_usd"]) == 0.0

    def test_buyer_statement_has_ledger_kinds(self, parties):
        rs = _req("GET", f"{API}/safedeal/wallet/statement", headers=_h(parties["buyer_tok"]))
        kinds = [r["kind"] for r in rs.json()["data"]["entries"]]
        for k in ("hold_released", "paid_to_seller", "escrow_fee", "escrow_costs"):
            assert k in kinds, f"missing kind {k} in {set(kinds)}"
        # exchange_fee only for non-stable funding; from-balance uses USDT → no row
        assert "exchange_fee" not in kinds


# ---- 8. Auto-withdraw ON with cooling-off address → parked -----------------


@pytest.fixture(scope="module")
def seller_address(parties):
    seller_tok = parties["seller_tok"]
    code = _req("POST", f"{API}/safedeal/auth/step-up", headers=_h(seller_tok), json={}).json()["data"]["preview_code"]
    r = _req("POST", f"{API}/safedeal/wallet/addresses", headers=_h(seller_tok),
             json={"payout_key": "USDT-TRON", "address": "TA53ttWWqYD2kbLNvJhXj9Qfy1yXN1fjBE", "label": "iter208 tron", "code": code})
    assert r.status_code in (200, 201), r.text[:300]
    return r.json()["data"]


class TestAutoWithdrawOn:
    def test_toggle_on_without_address_400(self, parties):
        # outsider seller has no address
        outsider_tok = parties["outsider_tok"]
        r = _req("POST", f"{API}/safedeal/profile", headers=_h(outsider_tok), json={"auto_withdraw": True})
        assert r.status_code == 400

    def test_release_with_auto_withdraw_on(self, parties, seller_address):
        """Auto-withdraw ON → release pays the seller's saved address. With the 24h address
        cooling-off enabled (SAFEDEAL_ADDRESS_COOLING_HOURS>0) a fresh address parks instead;
        the owner disabled the hold (default 0), so the payout is sent immediately."""
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        aid = seller_address.get("address_id") or seller_address.get("id")
        cooling_hours = float(_req("GET", f"{API}/safedeal/config").json()["data"].get("address_cooling_hours") or 0)
        rprof = _req("POST", f"{API}/safedeal/profile", headers=_h(seller_tok),
                     json={"auto_withdraw": True, "auto_withdraw_address_id": aid})
        assert rprof.status_code == 200, rprof.text[:300]

        d = _create_deal(seller_tok, parties["buyer"], amount=30, title="iter208 on")
        tok = d["deal_token"]
        _act(buyer_tok, tok, {"action": "accept"})
        r_fund = _act(buyer_tok, tok, {"action": "fund-balance"})
        assert r_fund.status_code == 200, r_fund.text[:300]
        _act(seller_tok, tok, {"action": "deliver", "note": "done"})
        rr = _act(buyer_tok, tok, {"action": "release"})
        assert rr.status_code == 200
        deal = rr.json()["data"]
        assert deal["status"] == "completed"
        notes = [a["note"] for a in deal["activity_log"] if a["type"] == "payout_seller"]
        assert notes, deal["activity_log"]

        rw = _req("GET", f"{API}/safedeal/wallet", headers=_h(seller_tok)).json()["data"]
        if cooling_hours > 0:
            assert "safety hold" in notes[0].lower(), notes
            assert float(rw["profile"]["parked_payout_usd"]) >= 30 - 0.01
            return
        assert "paid 30" in notes[0].lower() and "address" in notes[0].lower(), notes
        assert float(rw["profile"]["parked_payout_usd"]) == 0.0
        rwd = _req("GET", f"{API}/safedeal/wallet/withdrawals", headers=_h(seller_tok)).json()["data"]
        settlement = [w for w in rwd if w.get("source") == "settlement" and w.get("escrow_id") == d["escrow_id"]]
        assert settlement, rwd
        assert abs(float(settlement[0]["net_usd"]) - 30) < 0.01
        assert float(settlement[0].get("fee_usd") or 0) == 0.0  # fee reserved in the deal quote, not charged twice

    def test_toggle_off_clears_parked(self, parties):
        seller_tok = parties["seller_tok"]
        w0 = _req("GET", f"{API}/safedeal/wallet", headers=_h(seller_tok)).json()["data"]["wallet"]
        avail0 = float(w0["available"])
        r = _req("POST", f"{API}/safedeal/profile", headers=_h(seller_tok), json={"auto_withdraw": False})
        assert r.status_code == 200
        rw = _req("GET", f"{API}/safedeal/wallet", headers=_h(seller_tok)).json()["data"]
        assert float(rw["profile"]["parked_payout_usd"]) == 0.0
        assert abs(float(rw["wallet"]["available"]) - avail0) < 0.01


# ---- 9. Deal-level payout destination BEFORE funding → withdrawal ---------


class TestDealPayoutDestination:
    def test_before_funding_address_triggers_settlement_withdrawal(self, parties, seller_address):
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        aid = seller_address.get("address_id") or seller_address.get("id")

        # Ensure buyer has enough balance — top up with a fresh $100 USDT-TRC20 sim.
        r_top = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(buyer_tok),
                     json={"amount": 100, "coin": "USDT-ERC20"})
        assert r_top.status_code in (200, 201), r_top.text[:200]
        new_tid = r_top.json()["data"]["topup"]["topup_id"]
        _req("POST", f"{API}/safedeal/wallet/topup/{new_tid}/simulate", headers=_h(buyer_tok), json={})

        d = _create_deal(seller_tok, parties["buyer"], amount=30, title="iter208 deal-addr")
        tok = d["deal_token"]
        _act(buyer_tok, tok, {"action": "accept"})

        # ensure auto-withdraw off but set deal-level pref (before funding)
        _req("POST", f"{API}/safedeal/profile", headers=_h(seller_tok), json={"auto_withdraw": False})
        rp = _req("POST", f"{API}/safedeal/deals/{tok}/payout-destination", headers=_h(seller_tok),
                  json={"address_id": aid})
        assert rp.status_code == 200, rp.text[:300]
        assert rp.json()["data"]["my_payout_pref"]["before_funding"] is True

        r_fund = _act(buyer_tok, tok, {"action": "fund-balance"})
        assert r_fund.status_code == 200
        _act(seller_tok, tok, {"action": "deliver", "note": "done"})
        rr = _act(buyer_tok, tok, {"action": "release"})
        assert rr.status_code == 200
        deal = rr.json()["data"]
        assert deal["status"] == "completed"
        rwd = _req("GET", f"{API}/safedeal/wallet/withdrawals", headers=_h(seller_tok)).json()["data"]
        settlement = [w for w in rwd if w.get("source") == "settlement" and w.get("escrow_id") == d["escrow_id"]]
        assert settlement, f"no settlement withdrawal for deal {d['escrow_id']} in {rwd}"
        assert settlement[0]["status"] == "sent"


# ---- 10. Invoices endpoint -------------------------------------------------


class TestInvoices:
    def test_invoices_only_closed_deals_and_shape(self, parties, deal_off):
        # buyer + seller both should see the closed deal_off
        for who_tok, role_expected in ((parties["buyer_tok"], "buyer"), (parties["seller_tok"], "seller")):
            r = _req("GET", f"{API}/safedeal/invoices", headers=_h(who_tok))
            assert r.status_code == 200, r.text[:300]
            invs = r.json()["data"]
            match = [i for i in invs if str(i["invoice_no"]) == f"SD-{deal_off['escrow_id']}"]
            assert match, f"invoice for {deal_off['escrow_id']} missing"
            inv = match[0]
            assert inv["my_role"] == role_expected
            keys = {c["key"] for c in inv["cost_items"]}
            assert "escrow_fee" in keys
            # buyer bears all fees when fee_payer=buyer
            if role_expected == "buyer":
                assert float(inv["my_fee_share"]) > 0
            else:
                assert float(inv["my_fee_share"]) == 0
            # my_amount present
            assert "my_amount" in inv


# ---- 11. Summary PDF -------------------------------------------------------


class TestSummaryPdf:
    def test_closed_deal_pdf(self, parties, deal_off):
        r = _req("GET", f"{API}/safedeal/deals/{deal_off['deal_token']}/summary.pdf", headers={"x-safedeal-token": parties["seller_tok"]})
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "").lower()
        cd = r.headers.get("content-disposition", "")
        assert f"safedeal-invoice-{deal_off['escrow_id']}.pdf" in cd, cd

    def test_open_deal_pdf_filename(self, parties):
        d = _create_deal(parties["seller_tok"], parties["buyer"], amount=30, title="iter208 open pdf")
        r = _req("GET", f"{API}/safedeal/deals/{d['deal_token']}/summary.pdf", headers={"x-safedeal-token": parties["seller_tok"]})
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert f"safedeal-{d['escrow_id']}.pdf" in cd, cd

    def test_pdf_forbidden_for_non_party(self, parties, deal_off):
        r = _req("GET", f"{API}/safedeal/deals/{deal_off['deal_token']}/summary.pdf",
                 headers={"x-safedeal-token": parties["outsider_tok"]})
        assert r.status_code == 403


# ---- 12. Webhook top-up ---------------------------------------------------


class TestWebhookTopup:
    def test_webhook_credits_wallet_and_replay_safe(self, parties):
        tok = parties["buyer_tok"]
        # Fresh top-up
        r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(tok),
                 json={"amount": 100, "coin": "USDT-POLYGON"})
        assert r.status_code == 201, r.text[:300]
        tp = r.json()["data"]["topup"]
        tid = tp["topup_id"]

        w0 = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok)).json()["data"]["wallet"]
        avail0 = float(w0["available"])

        body = json.dumps({
            "event": "payment.confirmed",
            "meta_data": {"source": "safedeal", "topup_id": tid},
            "txId": "0xabc208",
            "amount": "100",
        })
        r1 = requests.post(f"{API}/safedeal/webhooks/dynopay", headers=_sign(body), data=body, timeout=TIMEOUT)
        assert r1.status_code == 200, r1.text[:300]

        w1 = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok)).json()["data"]
        assert abs(float(w1["wallet"]["available"]) - (avail0 + 100.0)) < 0.05
        rec = [t for t in w1["topups"] if t["topup_id"] == tid]
        assert rec and rec[0]["status"] == "credited"

        # replay
        r2 = requests.post(f"{API}/safedeal/webhooks/dynopay", headers=_sign(body), data=body, timeout=TIMEOUT)
        assert r2.status_code == 200
        w2 = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok)).json()["data"]["wallet"]
        assert abs(float(w2["available"]) - float(w1["wallet"]["available"])) < 0.01, "double-credit on replay"

    def test_webhook_bad_signature_401(self):
        body = json.dumps({"event": "payment.confirmed"})
        r = requests.post(f"{API}/safedeal/webhooks/dynopay",
                          headers={"Content-Type": "application/json", "X-Dynopay-Signature-V2": "t=1,v1=bad"},
                          data=body, timeout=TIMEOUT)
        assert r.status_code == 401
