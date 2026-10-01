"""
SafeDeal money-math audit (2026-06) — invariants that must hold across the whole lifecycle.

  I1  quote == charged: the fee/cost breakdown is FROZEN at funding (`fee_locked`), the deal's
      later views, invoice and PDF all report the frozen numbers (no live-rate drift).
  I2  custody conservation per deal: hold released == paid_to_seller + escrow_fee + exchange_fee
      + escrow_costs (± <$0.01 rounding) + refund left in the buyer's balance.
  I3  release / refund / split / mutually-agreed cancellation settle exactly per computeSettlementAmounts.
  I4  wallet == ledger: running balance on the newest statement row == available + held.
  I5  top-up credits exactly the requested amount; the quoted fees are what the statement shows.
  I6  withdrawal fee is never charged twice: a "kept in balance" settlement credits the reserved
      withdrawal fee, and the next manual withdrawal quote waives it (fee_waived).
  I7  invoices: total_cost == frozen totalCost; buyer_paid == amount ± fee share; cancellation
      invoices carry a "Cancellation fee" line.
"""
import os
import time

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://passphrase-config-2.preview.emergentagent.com").rstrip("/")
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


def _act(tok, deal_token, body):
    r = _req("POST", f"{API}/safedeal/deals/{deal_token}/action", headers=_h(tok), json=body)
    assert r.status_code == 200, f"{body.get('action')}: {r.status_code} {r.text[:300]}"
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


def _stepup(tok):
    return _req("POST", f"{API}/safedeal/auth/step-up", headers=_h(tok), json={}).json()["data"]["preview_code"]


def _topup(tok, amount, coin="USDT-TRC20"):
    r = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(tok), json={"amount": amount, "coin": coin})
    assert r.status_code in (200, 201), r.text[:300]
    t = r.json()["data"]["topup"] if "topup" in r.json()["data"] else r.json()["data"]
    tid = t["topup_id"]
    r2 = _req("POST", f"{API}/safedeal/wallet/topup/{tid}/simulate", headers=_h(tok), json={})
    assert r2.status_code in (200, 201), r2.text[:300]
    return t


def _create_deal(seller_tok, buyer_email, amount, fee_payer="buyer", my_role="seller", title="audit deal"):
    r = _req("POST", f"{API}/safedeal/deals", headers=_h(seller_tok), json={
        "title": title, "amount": amount, "counterparty_email": buyer_email, "my_role": my_role, "fee_payer": fee_payer, "deal_type": "service",
    })
    assert r.status_code == 201, r.text[:300]
    return r.json()["data"]


def _deal_rows(entries, escrow_id, kind=None):
    rows = [e for e in entries if e.get("escrow_id") == escrow_id and e["reference"].startswith(f"escrow:{escrow_id}:settle:")]
    if kind:
        rows = [e for e in rows if e["kind"] == kind]
    return rows


def _sum(rows):
    return round(sum(float(r["amount"]) for r in rows), 2)


def _fund_and_lock(parties, deal, buyer_pays_expected=None):
    """accept + fund-balance, then assert the breakdown is frozen and equals what was debited."""
    tok = deal["deal_token"]
    _act(parties["buyer_tok"], tok, {"action": "accept"})
    pre = _deal(parties["buyer_tok"], tok)
    assert pre["fee_locked"] is False and pre["breakdown"]["costsEstimated"] is True
    quote = pre["breakdown"]
    before = _wallet(parties["buyer_tok"])["wallet"]
    d = _act(parties["buyer_tok"], tok, {"action": "fund-balance"})
    assert d["status"] == "funded"
    assert d["fee_locked"] is True
    b = d["breakdown"]
    assert b["costsEstimated"] is False
    # frozen breakdown == the quote the buyer saw a moment earlier (same coin family: USDT)
    for k in ("escrowFee", "networkFeeUsd", "conversionFeeUsd", "withdrawalFeeUsd", "exchangeFeeUsd", "totalCost", "buyerPays", "sellerReceives"):
        assert abs(float(b[k]) - float(quote[k])) < EPS, (k, b[k], quote[k])
    assert abs(float(d["funded_amount_usd"]) - float(b["buyerPays"])) < EPS
    assert abs(float(d["custody_amount_stable"]) - float(b["buyerPays"])) < EPS
    after = _wallet(parties["buyer_tok"])["wallet"]
    assert abs((before["available"] - after["available"]) - float(b["buyerPays"])) < EPS
    assert abs((after["held"] - before["held"]) - float(b["buyerPays"])) < EPS
    if buyer_pays_expected is not None:
        assert abs(float(b["buyerPays"]) - buyer_pays_expected) < EPS
    return d


def _assert_conservation(parties, d, seller_amount, buyer_refund):
    """I2: buyer-side ledger rows consume the hold exactly; seller credit equals entitlement."""
    eid = d["escrow_id"]
    b = d["breakdown"]
    held = float(d["custody_amount_stable"])
    buyer_entries = _statement(parties["buyer_tok"])["entries"]
    unhold = _sum(_deal_rows(buyer_entries, eid, "hold_released"))
    assert abs(unhold - held) < EPS, (unhold, held)
    paid = _sum(_deal_rows(buyer_entries, eid, "paid_to_seller"))
    fee = _sum(_deal_rows(buyer_entries, eid, "escrow_fee"))
    exch = _sum(_deal_rows(buyer_entries, eid, "exchange_fee"))
    costs = _sum(_deal_rows(buyer_entries, eid, "escrow_costs"))
    rounding = _deal_rows(buyer_entries, eid, "rounding")
    assert not rounding or _sum(rounding) < 0.05, f"rounding row too large → live-rate drift: {rounding}"
    assert abs(paid - seller_amount) < EPS, (paid, seller_amount)
    assert abs(fee - float(b["escrowFee"])) < EPS, (fee, b["escrowFee"])
    assert abs(exch - float(b["exchangeFeeUsd"])) < EPS
    assert abs(costs - float(b["passThroughCosts"])) < EPS, (costs, b["passThroughCosts"])
    leftover = round(unhold - paid - fee - exch - costs - (_sum(rounding) if rounding else 0), 2)
    assert abs(leftover - buyer_refund) < EPS, (leftover, buyer_refund)
    if seller_amount > 0:
        seller_entries = _statement(parties["seller_tok"])["entries"]
        credit = _sum(_deal_rows(seller_entries, eid, "release_received"))
        assert abs(credit - seller_amount) < EPS, (credit, seller_amount)
    assert abs(float(d.get("seller_entitlement_stable") or 0) - seller_amount) < EPS
    assert abs(float(d.get("buyer_entitlement_stable") or 0) - buyer_refund) < EPS


def _assert_wallet_matches_ledger(tok):
    s = _statement(tok)
    if not s["entries"]:
        return
    newest = s["entries"][0]
    total = round(float(s["wallet"]["available"]) + float(s["wallet"]["held"]), 2)
    assert abs(float(newest["running_balance"]) - total) < EPS, (newest["running_balance"], total)


# ---- fixtures --------------------------------------------------------------


@pytest.fixture(scope="module")
def parties():
    ts = int(time.time())
    seller = f"sd-audit-{ts}-seller@example.com"
    buyer = f"sd-audit-{ts}-buyer@example.com"
    p = {"seller": seller, "buyer": buyer, "seller_tok": _login(seller), "buyer_tok": _login(buyer)}
    # Buyer bankroll for all scenarios (I5 is asserted in TestTopup on this same top-up).
    p["topup"] = _topup(p["buyer_tok"], 600)
    return p


# ---- I5 top-up -------------------------------------------------------------


class TestTopup:
    def test_topup_credits_exact_amount_and_quoted_fee(self, parties):
        w = _wallet(parties["buyer_tok"])["wallet"]
        assert abs(w["available"] - 600) < EPS
        rows = [e for e in _statement(parties["buyer_tok"])["entries"] if e["kind"] == "topup"]
        assert rows and abs(float(rows[0]["amount"]) - 600) < EPS
        t = parties["topup"]
        quoted_fee = round(float(t["network_fee_usd"]) + float(t["conversion_fee_usd"]) + float(t["exchange_fee_usd"]), 2)
        assert abs(float(rows[0]["meta"]["total_fee_usd"]) - quoted_fee) < EPS
        assert abs(float(t["pays_usd"]) - (600 + quoted_fee)) < EPS


# ---- I1 fee preview == deal quote ------------------------------------------


class TestQuoteConsistency:
    def test_fee_preview_matches_deal_breakdown(self, parties):
        r = _req("POST", f"{API}/safedeal/fee-preview", json={"amount": 60, "fee_payer": "buyer"})
        assert r.status_code == 200
        q = r.json()["data"]
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 60, "buyer", title="quote-check")
        b = deal["breakdown"]
        for k in ("escrowFee", "networkFeeUsd", "withdrawalFeeUsd", "totalCost", "buyerPays"):
            assert abs(float(q[k]) - float(b[k])) < EPS, (k, q[k], b[k])
        assert q["fundingCoinAssumed"] is True and q["exchangeFeeUsd"] == 0
        _act(parties["seller_tok"], deal["deal_token"], {"action": "cancel"})


# ---- I2/I3 release, buyer pays ---------------------------------------------


class TestReleaseBuyerPays:
    @pytest.fixture(scope="class")
    def settled(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 60, "buyer", title="release-buyer-pays")
        d = _fund_and_lock(parties, deal)
        seller_before = _wallet(parties["seller_tok"])
        _act(parties["seller_tok"], deal["deal_token"], {"action": "deliver", "delivery_note": "done"})
        d2 = _act(parties["buyer_tok"], deal["deal_token"], {"action": "release"})
        return {"funded": d, "final": d2, "seller_before": seller_before}

    def test_release_amounts(self, parties, settled):
        d = settled["final"]
        assert d["status"] == "completed" and d["outcome"] == "release"
        b = d["breakdown"]
        assert abs(float(b["buyerPays"]) - (60 + float(b["totalCost"]))) < EPS
        assert abs(float(b["sellerReceives"]) - 60) < EPS
        _assert_conservation(parties, d, seller_amount=60, buyer_refund=0)

    def test_breakdown_unchanged_after_settlement(self, settled):
        f, d = settled["funded"]["breakdown"], settled["final"]["breakdown"]
        for k in ("escrowFee", "networkFeeUsd", "withdrawalFeeUsd", "exchangeFeeUsd", "totalCost", "buyerPays", "sellerReceives"):
            assert abs(float(f[k]) - float(d[k])) < EPS, k

    def test_seller_wallet_and_fee_credit(self, parties, settled):
        w = _wallet(parties["seller_tok"])
        assert abs(w["wallet"]["available"] - settled["seller_before"]["wallet"]["available"] - 60) < EPS
        # I6: payout was kept in balance → the reserved withdrawal fee becomes a credit
        assert abs(w["profile"]["withdrawal_fee_credit_usd"] - float(settled["final"]["breakdown"]["withdrawalFeeUsd"])) < EPS
        notes = [a for a in settled["final"]["activity_log"] if a["type"] == "withdrawal_fee_credit"]
        assert notes, "expected a withdrawal_fee_credit activity entry"

    def test_wallets_match_ledger(self, parties, settled):
        _assert_wallet_matches_ledger(parties["buyer_tok"])
        _assert_wallet_matches_ledger(parties["seller_tok"])


# ---- I6 withdrawal fee credit → manual withdrawal --------------------------


class TestWithdrawalFeeCredit:
    def test_quote_waives_fee_and_withdrawal_consumes_credit(self, parties):
        tok = parties["seller_tok"]
        w = _wallet(tok)
        credit = w["profile"]["withdrawal_fee_credit_usd"]
        assert credit > 0
        code = _stepup(tok)
        r = _req("POST", f"{API}/safedeal/wallet/addresses", headers=_h(tok), json={"payout_key": "USDT-TRON", "address": "TA53ttWWqYD2kbLNvJhXj9Qfy1yXN1fjBE", "label": "audit", "code": code})
        assert r.status_code in (200, 201), r.text[:300]
        aid = r.json()["data"]["address_id"]
        q = _req("POST", f"{API}/safedeal/wallet/withdraw/quote", headers=_h(tok), json={"address_id": aid, "amount": 20}).json()["data"]
        assert abs(q["fee_waived"] - min(credit, q["fee"] + q["fee_waived"])) < EPS
        assert abs(q["net"] - (20 - q["fee"])) < EPS
        assert q["fee_credit_available"] == credit
        before = w["wallet"]["available"]
        code = _stepup(tok)
        r = _req("POST", f"{API}/safedeal/wallet/withdraw", headers=_h(tok), json={"address_id": aid, "amount": 20, "code": code})
        assert r.status_code == 201, r.text[:300]
        wd = r.json()["data"]["withdrawal"]
        assert abs(float(wd["fee_usd"]) - q["fee"]) < EPS and abs(float(wd["net_usd"]) - q["net"]) < EPS
        w2 = _wallet(tok)
        assert abs(before - w2["wallet"]["available"] - 20) < EPS
        assert abs(w2["profile"]["withdrawal_fee_credit_usd"] - round(credit - q["fee_waived"], 2)) < EPS
        row = [e for e in _statement(tok)["entries"] if e["kind"] == "withdrawal"][0]
        assert abs(float(row["meta"]["fee_waived"]) - q["fee_waived"]) < EPS
        assert "fee credit" in row["description"]
        _assert_wallet_matches_ledger(tok)


# ---- I2/I3 refund via dispute, seller pays fees -----------------------------


class TestRefundSellerPays:
    def test_refund_keeps_costs_from_pool(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 80, "seller", title="refund-seller-pays")
        d = _fund_and_lock(parties, deal, buyer_pays_expected=80)
        b = d["breakdown"]
        _act(parties["buyer_tok"], deal["deal_token"], {"action": "dispute", "proposed_outcome": "refund", "reason": "not delivered"})
        d2 = _act(parties["seller_tok"], deal["deal_token"], {"action": "dispute-accept"})
        assert d2["status"] == "refunded" and d2["outcome"] == "refund"
        expected_refund = round(80 - float(b["totalCost"]), 2)
        assert abs(float(d2["breakdown"]["totalCost"]) - float(b["totalCost"])) < EPS
        _assert_conservation(parties, d2, seller_amount=0, buyer_refund=expected_refund)
        inv = [x for x in _req("GET", f"{API}/safedeal/invoices", headers=_h(parties["buyer_tok"])).json()["data"] if x.get("escrow_id") == d2["escrow_id"]][0]
        assert abs(inv["total_cost"] - float(b["totalCost"])) < EPS
        assert abs(inv["buyer_paid"] - 80) < EPS and inv["my_fee_share"] == 0
        assert abs(inv["my_amount"] - expected_refund) < EPS
        _assert_wallet_matches_ledger(parties["buyer_tok"])


# ---- I2/I3 split 30/70, fees split -----------------------------------------


class TestSplitFeesSplit:
    def test_split_settles_net_pool(self, parties):
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 100, "split", title="split-30-70")
        d = _fund_and_lock(parties, deal)
        b = d["breakdown"]
        half = round(float(b["totalCost"]) / 2, 2)
        assert abs(float(b["buyerPays"]) - (100 + half)) < EPS
        pool = float(b["sellerReceives"])
        assert abs(pool - (100 - (float(b["totalCost"]) - half))) < EPS
        _act(parties["seller_tok"], deal["deal_token"], {"action": "dispute", "proposed_outcome": "split", "split_percent_seller": 30, "reason": "partial"})
        d2 = _act(parties["buyer_tok"], deal["deal_token"], {"action": "dispute-accept"})
        assert d2["status"] == "split" and d2["outcome"] == "split"
        seller_amount = round(pool * 0.30, 2)
        buyer_refund = round(pool - seller_amount, 2)
        _assert_conservation(parties, d2, seller_amount=seller_amount, buyer_refund=buyer_refund)
        inv = [x for x in _req("GET", f"{API}/safedeal/invoices", headers=_h(parties["seller_tok"])).json()["data"] if x.get("escrow_id") == d2["escrow_id"]][0]
        assert abs(inv["total_cost"] - float(b["totalCost"])) < EPS
        assert abs(inv["buyer_paid"] - float(b["buyerPays"])) < EPS
        assert abs(inv["my_fee_share"] - round(float(b["totalCost"]) - half, 2)) < EPS
        assert abs(inv["my_amount"] - seller_amount) < EPS


# ---- I3 mutually-agreed cancellation after funding -------------------------


class TestCancellationAfterFunding:
    def test_cancellation_fee_line_and_refund(self, parties):
        cfg = _req("GET", f"{API}/safedeal/config").json()["data"]
        deal = _create_deal(parties["seller_tok"], parties["buyer"], 50, "buyer", title="cancel-after-funding")
        d = _fund_and_lock(parties, deal)
        b = d["breakdown"]
        r = _act(parties["buyer_tok"], deal["deal_token"], {"action": "cancel", "reason": "changed my mind"})
        assert r["status"] == "disputed" and r["dispute_proposal"]["kind"] == "cancellation"
        d2 = _act(parties["seller_tok"], deal["deal_token"], {"action": "dispute-accept"})
        assert d2["status"] == "refunded"
        cb = d2["breakdown"]
        assert cb["costItems"][0]["label"].startswith("Cancellation fee"), cb["costItems"][0]
        cancel_fee = round(max(50 * cfg["cancellation_fee_percent"] / 100, cfg["fee_min_usd"]), 2)
        assert abs(float(cb["escrowFee"]) - cancel_fee) < EPS
        # frozen pass-through costs are reused, only the fee line changes
        assert abs(float(cb["passThroughCosts"]) - float(b["passThroughCosts"])) < EPS
        expected_refund = round(float(d["custody_amount_stable"]) - float(cb["totalCost"]), 2)
        _assert_conservation(parties, d2, seller_amount=0, buyer_refund=expected_refund)
        inv = [x for x in _req("GET", f"{API}/safedeal/invoices", headers=_h(parties["buyer_tok"])).json()["data"] if x.get("escrow_id") == d2["escrow_id"]][0]
        assert inv["cost_items"][0]["label"].startswith("Cancellation fee")
        assert abs(inv["total_cost"] - float(cb["totalCost"])) < EPS
        _assert_wallet_matches_ledger(parties["buyer_tok"])
        _assert_wallet_matches_ledger(parties["seller_tok"])


# ---- I1 PDF uses the frozen numbers ----------------------------------------


class TestInvoicePdf:
    def test_pdf_downloads_for_closed_deal(self, parties):
        inv = [x for x in _req("GET", f"{API}/safedeal/invoices", headers=_h(parties["buyer_tok"])).json()["data"] if x.get("type") == "deal"]
        assert inv
        r = _req("GET", f"{API}/safedeal/deals/{inv[0]['deal_token']}/summary.pdf", headers=_h(parties["buyer_tok"]))
        assert r.status_code == 200 and r.headers.get("Content-Type", "").startswith("application/pdf")
        assert "safedeal-invoice-" in r.headers.get("Content-Disposition", "")
        assert len(r.content) > 5000
