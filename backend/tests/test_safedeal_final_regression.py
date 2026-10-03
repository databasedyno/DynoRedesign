"""
SafeDeal FINAL backend regression (iter 100) — independent black-box verification of
money-math invariants across the whole lifecycle.

Covers:
  - fee-preview (buyer / seller / split) shape + arithmetic + stablecoin-assumed quote
  - deal quote consistency (fee-preview == deal.breakdown before funding)
  - fund-from-balance: fee lock, custody, wallet debit, statement row
  - release (fee_payer=buyer): seller credit, withdrawal_fee_credit, conservation, breakdown-frozen
  - withdrawal fee credit consumption on manual withdrawal
  - refund via dispute (fee_payer=seller)
  - split (fee_payer=split) via dispute
  - auto-withdraw ON pays immediately (24h cooling-off disabled by owner)
  - wallet==ledger integrity, CSV statement
  - invoice PDF (party 200, non-party 403)
  - negative cases: 400/403/404

Live settlement is OFF → payouts are SIMULATED, that is expected.
"""
import os
import time

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://vault-init-7.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 30
EPS = 0.011


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


def _stepup(tok):
    return _req("POST", f"{API}/safedeal/auth/step-up", headers=_h(tok), json={}).json()["data"]["preview_code"]


def _act(tok, deal_token, body):
    r = _req("POST", f"{API}/safedeal/deals/{deal_token}/action", headers=_h(tok), json=body)
    assert r.status_code == 200, f"{body.get('action')}: {r.status_code} {r.text[:400]}"
    return r.json()["data"]


def _deal(tok, deal_token):
    r = _req("GET", f"{API}/safedeal/deals/{deal_token}", headers=_h(tok))
    assert r.status_code == 200, r.text[:200]
    return r.json()["data"]


def _wallet(tok):
    r = _req("GET", f"{API}/safedeal/wallet", headers=_h(tok))
    assert r.status_code == 200, r.text[:200]
    return r.json()["data"]


def _statement(tok):
    r = _req("GET", f"{API}/safedeal/wallet/statement?limit=500", headers=_h(tok))
    assert r.status_code == 200, r.text[:200]
    return r.json()["data"]


def _topup(tok, amount, coin="USDT-TRC20"):
    r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(tok), json={"amount": amount, "coin": coin})
    assert r.status_code in (200, 201), r.text[:300]
    data = r.json()["data"]
    t = data.get("topup", data)
    r2 = _req("POST", f"{API}/safedeal/wallet/topup/{t['topup_id']}/simulate", headers=_h(tok), json={})
    assert r2.status_code in (200, 201), r2.text[:300]
    return t


def _create_deal(seller_tok, buyer_email, amount, fee_payer="buyer", title="reg deal"):
    r = _req(
        "POST", f"{API}/safedeal/deals", headers=_h(seller_tok),
        json={
            "title": title, "amount": amount, "counterparty_email": buyer_email,
            "my_role": "seller", "fee_payer": fee_payer, "deal_type": "service",
        },
    )
    assert r.status_code == 201, r.text[:300]
    return r.json()["data"]


def _fund(buyer_tok, deal_token):
    _act(buyer_tok, deal_token, {"action": "accept"})
    pre = _deal(buyer_tok, deal_token)
    assert pre["fee_locked"] is False
    assert pre["breakdown"]["costsEstimated"] is True
    before = _wallet(buyer_tok)["wallet"]
    d = _act(buyer_tok, deal_token, {"action": "fund-balance"})
    assert d["status"] == "funded"
    assert d["fee_locked"] is True
    assert d["breakdown"]["costsEstimated"] is False
    after = _wallet(buyer_tok)["wallet"]
    assert abs((before["available"] - after["available"]) - float(d["breakdown"]["buyerPays"])) < EPS
    return d, pre["breakdown"]


# ---- module fixtures -----------------------------------------------

@pytest.fixture(scope="module")
def parties():
    ts = int(time.time())
    seller = f"sd-qa-final-{ts}-seller@example.com"
    buyer = f"sd-qa-final-{ts}-buyer@example.com"
    outsider = f"sd-qa-final-{ts}-outsider@example.com"
    p = {
        "seller": seller, "buyer": buyer, "outsider": outsider,
        "seller_tok": _login(seller), "buyer_tok": _login(buyer), "outsider_tok": _login(outsider),
    }
    # generous bankroll for all scenarios
    _topup(p["buyer_tok"], 800)
    return p


@pytest.fixture(scope="module")
def cfg():
    r = _req("GET", f"{API}/safedeal/config")
    assert r.status_code == 200
    return r.json()["data"]


# ---- 1) FEE PREVIEW ------------------------------------------------

class TestFeePreview:
    def test_stablecoin_assumed_quote_shape(self):
        r = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 100, "fee_payer": "buyer"})
        assert r.status_code == 200, r.text[:200]
        q = r.json()["data"]
        assert q["exchangeFeePercent"] == 2
        assert float(q["exchangeFeeUsd"]) == 0
        assert q["fundingCoinAssumed"] is True
        assert str(q["quotedFundingCoin"]).startswith(("USDT-", "USDC-"))
        assert float(q["nonStableSurchargeUsd"]) >= 2 - EPS
        keys = {c["key"] for c in q["costItems"]}
        for k in ("escrow_fee", "exchange_fee", "network_fee", "conversion_fee", "withdrawal_fee"):
            assert k in keys, (k, keys)
        total = float(q["escrowFee"]) + float(q["exchangeFeeUsd"]) + float(q["networkFeeUsd"]) + float(q["conversionFeeUsd"]) + float(q["withdrawalFeeUsd"])
        assert abs(total - float(q["totalCost"])) < EPS
        assert abs(float(q["buyerPays"]) - (100 + float(q["totalCost"]))) < EPS
        assert abs(float(q["sellerReceives"]) - 100) < EPS

    def test_fee_payer_seller(self):
        q = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 100, "fee_payer": "seller"}).json()["data"]
        assert abs(float(q["buyerPays"]) - 100) < EPS
        assert abs(float(q["sellerReceives"]) - (100 - float(q["totalCost"]))) < EPS

    def test_fee_payer_split(self):
        q = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 100, "fee_payer": "split"}).json()["data"]
        half = round(float(q["totalCost"]) / 2, 2)
        assert abs(float(q["buyerPays"]) - (100 + half)) < EPS
        assert abs(float(q["sellerReceives"]) - (100 - (float(q["totalCost"]) - half))) < EPS

    def test_amount_zero_returns_400(self):
        r = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 0, "fee_payer": "buyer"})
        assert r.status_code == 400, r.status_code


# ---- 2) QUOTE CONSISTENCY ------------------------------------------

class TestQuoteConsistency:
    def test_deal_breakdown_matches_preview(self, parties):
        q = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 120, "fee_payer": "buyer"}).json()["data"]
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 120, "buyer", "qc-deal")
        b = deal["breakdown"]
        assert deal["fee_locked"] is False
        assert b["costsEstimated"] is True
        for k in ("escrowFee", "networkFeeUsd", "conversionFeeUsd", "withdrawalFeeUsd", "exchangeFeeUsd", "totalCost", "buyerPays", "sellerReceives"):
            assert abs(float(q[k]) - float(b[k])) < EPS, (k, q[k], b[k])
        _act(parties["seller_tok"], deal["deal_token"], {"action": "cancel"})


# ---- 3) FUND + FEE LOCK --------------------------------------------

class TestFundAndLock:
    def test_fund_locks_and_debits_and_statement(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 70, "buyer", "fund-lock")
        d, quote = _fund(parties["buyer_tok"], deal["deal_token"])
        b = d["breakdown"]
        for k in ("escrowFee", "networkFeeUsd", "withdrawalFeeUsd", "totalCost", "buyerPays", "sellerReceives"):
            assert abs(float(b[k]) - float(quote[k])) < EPS, k
        assert abs(float(d["custody_amount_stable"]) - float(b["buyerPays"])) < EPS
        entries = _statement(parties["buyer_tok"])["entries"]
        deb = [e for e in entries if e.get("escrow_id") == d["escrow_id"]]
        assert deb, "expected at least one ledger row for the funded deal"
        # any row referencing this escrow should carry an amount close to buyerPays
        amounts = [float(e.get("amount") or 0) for e in deb]
        assert any(abs(a - float(b["buyerPays"])) < EPS for a in amounts), amounts
        # rows expose the required shape
        row = deb[0]
        for f in ("kind", "signed", "running_balance"):
            assert f in row, f"statement row missing '{f}': {row}"


# ---- 4) RELEASE (buyer pays) + fee credit --------------------------

class TestReleaseAndFeeCredit:
    @pytest.fixture(scope="class")
    def state(self, parties):
        seller_before = _wallet(parties["seller_tok"])
        credit_before = float(seller_before["profile"].get("withdrawal_fee_credit_usd") or 0)
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 60, "buyer", "release-buyer-pays")
        d, _ = _fund(parties["buyer_tok"], deal["deal_token"])
        _act(parties["seller_tok"], deal["deal_token"], {"action": "deliver", "delivery_note": "ok"})
        final = _act(parties["buyer_tok"], deal["deal_token"], {"action": "release"})
        return {"funded": d, "final": final, "seller_before": seller_before, "credit_before": credit_before}

    def test_completed_and_conservation(self, parties, state):
        d = state["final"]
        assert d["status"] == "completed"
        b = d["breakdown"]
        assert abs(float(b["sellerReceives"]) - 60) < EPS
        # conservation
        total = float(b["escrowFee"]) + float(b["exchangeFeeUsd"]) + float(b["networkFeeUsd"]) + float(b["conversionFeeUsd"]) + float(b["withdrawalFeeUsd"])
        assert abs(float(b["buyerPays"]) - (float(b["sellerReceives"]) + total)) < EPS

    def test_breakdown_frozen_across_settlement(self, state):
        f, d = state["funded"]["breakdown"], state["final"]["breakdown"]
        for k in ("escrowFee", "networkFeeUsd", "withdrawalFeeUsd", "exchangeFeeUsd", "totalCost", "buyerPays", "sellerReceives"):
            assert abs(float(f[k]) - float(d[k])) < EPS, k

    def test_seller_credit_and_withdrawal_fee_credit(self, parties, state):
        w = _wallet(parties["seller_tok"])
        assert abs(w["wallet"]["available"] - state["seller_before"]["wallet"]["available"] - 60) < EPS
        credit_after = float(w["profile"]["withdrawal_fee_credit_usd"])
        expected_delta = float(state["final"]["breakdown"]["withdrawalFeeUsd"])
        assert abs((credit_after - state["credit_before"]) - expected_delta) < EPS
        notes = [a for a in state["final"]["activity_log"] if a["type"] == "withdrawal_fee_credit"]
        assert notes, "expected withdrawal_fee_credit activity entry"


# ---- 5) WITHDRAWAL FEE CREDIT CONSUMPTION --------------------------

class TestWithdrawalFeeCredit:
    def test_quote_waives_and_withdraw_consumes(self, parties, cfg):
        tok = parties["seller_tok"]
        w = _wallet(tok)
        credit = float(w["profile"]["withdrawal_fee_credit_usd"])
        if credit <= 0:
            pytest.skip("no fee credit available")
        code = _stepup(tok)
        r = _req(
            "POST", f"{API}/safedeal/wallet/addresses", headers=_h(tok),
            json={"payout_key": "USDT-TRON", "address": "TA53ttWWqYD2kbLNvJhXj9Qfy1yXN1fjBE", "label": "reg", "code": code},
        )
        assert r.status_code in (200, 201), r.text[:300]
        aid = r.json()["data"]["address_id"]
        min_wd = float(cfg.get("min_withdrawal_usd") or 10)
        amount = max(min_wd, 15)
        q = _req("POST", f"{API}/safedeal/wallet/withdraw/quote", headers=_h(tok),
                 json={"address_id": aid, "amount": amount}).json()["data"]
        assert float(q["fee_waived"]) > 0
        assert abs(float(q["fee"]) + float(q["fee_waived"]) - float(q["list_fee"])) < EPS if "list_fee" in q else True
        assert abs(float(q["net"]) - (amount - float(q["fee"]))) < EPS
        before = float(w["wallet"]["available"])
        code = _stepup(tok)
        body = {"address_id": aid, "amount": amount, "code": code}
        r = _req("POST", f"{API}/safedeal/wallet/withdraw", headers=_h(tok), json=body)
        if r.status_code == 400:
            # inspect required extras
            print("withdraw 400 ->", r.text[:300])
        assert r.status_code in (200, 201), r.text[:300]
        wd = r.json()["data"]["withdrawal"]
        assert abs(float(wd["fee_usd"]) - float(q["fee"])) < EPS
        w2 = _wallet(tok)
        assert abs(before - float(w2["wallet"]["available"]) - amount) < EPS
        assert abs(float(w2["profile"]["withdrawal_fee_credit_usd"]) - round(credit - float(q["fee_waived"]), 2)) < EPS
        wds = _req("GET", f"{API}/safedeal/wallet/withdrawals", headers=_h(tok)).json()["data"]
        assert any(str(x.get("id")) == str(wd.get("id")) or abs(float(x.get("amount_usd") or 0) - amount) < EPS for x in (wds if isinstance(wds, list) else wds.get("withdrawals") or []))


# ---- 6) REFUND (seller pays) via dispute ---------------------------

class TestRefund:
    def test_refund_after_dispute(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 90, "seller", "refund-seller")
        d, _ = _fund(parties["buyer_tok"], deal["deal_token"])
        b = d["breakdown"]
        buyer_before = float(_wallet(parties["buyer_tok"])["wallet"]["available"])
        _act(parties["buyer_tok"], deal["deal_token"], {"action": "dispute", "proposed_outcome": "refund", "reason": "not delivered"})
        d2 = _act(parties["seller_tok"], deal["deal_token"], {"action": "dispute-accept"})
        assert d2["status"] == "refunded"
        buyer_after = float(_wallet(parties["buyer_tok"])["wallet"]["available"])
        # fee_payer=seller: buyer paid amount (90); refund retains fees (borne by seller) → buyer gets amount-totalCost back
        expected_refund = round(90 - float(b["totalCost"]), 2)
        assert abs((buyer_after - buyer_before) - expected_refund) < 0.05, (buyer_after - buyer_before, expected_refund)
        # conservation on deal breakdown
        assert abs(float(d2["breakdown"]["totalCost"]) - float(b["totalCost"])) < EPS


# ---- 7) SPLIT (split fee_payer) ------------------------------------

class TestSplit:
    def test_split_dispute_50_50(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 100, "split", "split-50")
        d, _ = _fund(parties["buyer_tok"], deal["deal_token"])
        b = d["breakdown"]
        pool = float(b["sellerReceives"])
        seller_before = float(_wallet(parties["seller_tok"])["wallet"]["available"])
        buyer_before = float(_wallet(parties["buyer_tok"])["wallet"]["available"])
        _act(parties["seller_tok"], deal["deal_token"], {"action": "dispute", "proposed_outcome": "split", "split_percent_seller": 50, "reason": "partial"})
        d2 = _act(parties["buyer_tok"], deal["deal_token"], {"action": "dispute-accept"})
        assert d2["status"] == "split"
        seller_amount = round(pool * 0.5, 2)
        buyer_refund = round(pool - seller_amount, 2)
        seller_after = float(_wallet(parties["seller_tok"])["wallet"]["available"])
        buyer_after = float(_wallet(parties["buyer_tok"])["wallet"]["available"])
        assert abs((seller_after - seller_before) - seller_amount) < 0.05
        assert abs((buyer_after - buyer_before) - buyer_refund) < 0.05
        assert abs(float(d2.get("seller_entitlement_stable") or 0) + float(d2.get("buyer_entitlement_stable") or 0) + (float(b["totalCost"])) - float(d2["custody_amount_stable"])) < 0.05


# ---- 8) AUTO-WITHDRAW ON pays immediately --------------------------

class TestAutoWithdraw:
    def test_cooling_off_disabled_pays_immediately(self, parties, cfg):
        assert cfg.get("address_cooling_hours") == 0, cfg.get("address_cooling_hours")
        tok = parties["seller_tok"]
        # find seller's saved address (added in fee credit test); else add one
        w = _wallet(tok)
        addrs = w.get("addresses") or []
        if not addrs:
            code = _stepup(tok)
            r = _req("POST", f"{API}/safedeal/wallet/addresses", headers=_h(tok),
                     json={"payout_key": "USDT-TRON", "address": "TA53ttWWqYD2kbLNvJhXj9Qfy1yXN1fjBE", "label": "auto", "code": code})
            assert r.status_code in (200, 201), r.text[:300]
            aid = r.json()["data"]["address_id"]
        else:
            aid = addrs[0]["id"] if "id" in addrs[0] else addrs[0].get("address_id")
        pr = _req("POST", f"{API}/safedeal/profile", headers=_h(tok),
                  json={"auto_withdraw": True, "auto_withdraw_address_id": aid})
        assert pr.status_code == 200, pr.text[:300]
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 50, "buyer", "auto-wd")
        d, _ = _fund(parties["buyer_tok"], deal["deal_token"])
        _act(parties["seller_tok"], deal["deal_token"], {"action": "deliver", "delivery_note": "auto"})
        final = _act(parties["buyer_tok"], deal["deal_token"], {"action": "release"})
        assert final["status"] == "completed"
        payout_notes = [a for a in final["activity_log"] if a["type"] == "payout_seller"]
        assert payout_notes, "expected payout_seller activity log"
        wds_resp = _req("GET", f"{API}/safedeal/wallet/withdrawals", headers=_h(tok)).json()["data"]
        wds = wds_resp if isinstance(wds_resp, list) else wds_resp.get("withdrawals") or []
        settle = [x for x in wds if x.get("source") == "settlement" and str(x.get("escrow_id")) == str(final["escrow_id"])]
        assert settle, f"no settlement withdrawal row for escrow {final['escrow_id']}"
        s = settle[0]
        assert abs(float(s["net_usd"]) - 50) < EPS
        assert abs(float(s["fee_usd"]) - 0) < EPS
        prof = _wallet(tok)["profile"]
        assert float(prof.get("parked_payout_usd") or 0) == 0
        # revert
        pr2 = _req("POST", f"{API}/safedeal/profile", headers=_h(tok), json={"auto_withdraw": False})
        assert pr2.status_code == 200


# ---- 9) Wallet == Ledger + CSV -------------------------------------

class TestWalletLedgerIntegrity:
    def test_running_balance_matches(self, parties):
        for role in ("buyer_tok", "seller_tok"):
            tok = parties[role]
            s = _statement(tok)
            if not s.get("entries"):
                continue
            newest = s["entries"][0]
            w = s["wallet"]
            total = round(float(w["available"]) + float(w["held"]), 2)
            assert abs(float(newest["running_balance"]) - total) < 0.05, (role, newest["running_balance"], total)
            # sum-of-signed sanity
            signed_sum = round(sum(float(e["signed"]) for e in s["entries"]), 2)
            assert abs(signed_sum - total) < 0.05, (role, signed_sum, total)

    def test_csv_export(self, parties):
        for url in (f"{API}/safedeal/wallet/statement.csv", f"{API}/safedeal/wallet/statement?format=csv"):
            r = _req("GET", url, headers=_h(parties["buyer_tok"]))
            if r.status_code == 200:
                ct = r.headers.get("Content-Type", "")
                assert "csv" in ct.lower() or "text/plain" in ct.lower(), ct
                return
        pytest.skip("CSV export route not present")


# ---- 10) Invoice PDF + non-party 403 -------------------------------

class TestInvoicePdf:
    def test_pdf_party_and_outsider(self, parties):
        inv = [x for x in _req("GET", f"{API}/safedeal/invoices", headers=_h(parties["buyer_tok"])).json()["data"] if x.get("type") == "deal"]
        assert inv, "no deal invoices for buyer"
        token = inv[0]["deal_token"]
        r = _req("GET", f"{API}/safedeal/deals/{token}/summary.pdf", headers=_h(parties["buyer_tok"]))
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/pdf")
        assert "safedeal-invoice-" in r.headers.get("Content-Disposition", "")
        r2 = _req("GET", f"{API}/safedeal/deals/{token}/summary.pdf", headers=_h(parties["outsider_tok"]))
        assert r2.status_code in (403, 404), r2.status_code


# ---- 11) Negative cases --------------------------------------------

class TestNegatives:
    def test_fund_balance_insufficient(self, parties):
        # outsider has 0 balance — create a deal with outsider as buyer
        deal = _create_deal(parties["seller_tok"], parties["outsider"], 40, "buyer", "insuf")
        _act(parties["outsider_tok"], deal["deal_token"], {"action": "accept"})
        r = _req("POST", f"{API}/safedeal/deals/{deal['deal_token']}/action",
                 headers=_h(parties["outsider_tok"]), json={"action": "fund-balance"})
        assert r.status_code == 400, r.status_code
        _act(parties["seller_tok"], deal["deal_token"], {"action": "cancel"})

    def test_withdraw_below_min(self, parties, cfg):
        tok = parties["seller_tok"]
        addrs = _wallet(tok).get("addresses") or []
        if not addrs:
            pytest.skip("no address")
        aid = addrs[0].get("id") or addrs[0].get("address_id")
        min_wd = float(cfg.get("min_withdrawal_usd") or 10)
        if min_wd <= 0.5:
            pytest.skip("no min_withdrawal_usd enforced in this env")
        small = round(max(0.01, min_wd / 10), 2)
        code = _stepup(tok)
        r = _req("POST", f"{API}/safedeal/wallet/withdraw", headers=_h(tok),
                 json={"address_id": aid, "amount": small, "code": code})
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"

    def test_outsider_cannot_read_deal(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 30, "buyer", "priv")
        r = _req("GET", f"{API}/safedeal/deals/{deal['deal_token']}", headers=_h(parties["outsider_tok"]))
        assert r.status_code in (403, 404), r.status_code
        _act(parties["seller_tok"], deal["deal_token"], {"action": "cancel"})
