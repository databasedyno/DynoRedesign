"""
SafeDeal iteration 101 — user-facing copy scrub verification.
Verifies that internal vocabulary (SIMULATED / simulated / Binance / BINANCE-…) is
absent from all user-facing notes, messages, statement rows, and invoice PDFs,
while internal fields (activity meta.simulated, withdrawals[].tx_hash) remain valid.
"""
import os
import re
import subprocess
import time

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://vault-setup-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 30

BAD_PATTERNS = re.compile(r"(simulated|binance|\[LIVE\])", re.IGNORECASE)


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
    assert r.status_code == 200, r.text[:300]
    code = r.json()["data"]["preview_code"]
    r2 = _req("POST", f"{API}/safedeal/auth/verify-code",
              json={"email": email, "code": code})
    assert r2.status_code == 200, r2.text[:300]
    return r2.json()["data"]["token"]


def _step_up(tok):
    r = _req("POST", f"{API}/safedeal/auth/step-up",
             headers={"x-safedeal-token": tok, "Content-Type": "application/json"},
             json={})
    assert r.status_code == 200, r.text[:300]
    return r.json()["data"]["preview_code"]


def _h(tok):
    return {"x-safedeal-token": tok, "Content-Type": "application/json"}


def _act(tok, token, body):
    return _req("POST", f"{API}/safedeal/deals/{token}/action", headers=_h(tok), json=body)


def _assert_clean(text, where):
    m = BAD_PATTERNS.search(text or "")
    assert not m, f"{where} contains forbidden term {m.group(0)!r}: {text!r}"


# --- 1. DB-wide backfill verification ---------------------------------------

def _run_sql(sql):
    r = subprocess.run(
        ["node", "scripts/q.js", sql],
        cwd="/app/backend", capture_output=True, text=True, timeout=30,
    )
    assert r.returncode == 0, r.stderr
    return r.stdout


class TestDBBackfill:
    def test_activity_log_notes_clean(self):
        out = _run_sql(
            "SELECT count(*) FROM tbl_escrow_deal d, jsonb_array_elements(d.activity_log) e "
            "WHERE e->>'note' ~* '(simulated|binance|\\[LIVE\\])'"
        )
        assert '"count": "0"' in out, out

    def test_settlement_note_clean(self):
        out = _run_sql(
            "SELECT count(*) FROM tbl_escrow_deal WHERE settlement_note ~* '(simulated|binance)'"
        )
        assert '"count": "0"' in out, out

    def test_customer_transaction_clean(self):
        out = _run_sql(
            "SELECT count(*) FROM tbl_customer_transaction "
            "WHERE transaction_details ~* '(simulated|binance)'"
        )
        assert '"count": "0"' in out, out


# --- 2. Deal #209 reported case ---------------------------------------------

DEAL_209_TOKEN = "26dffe8a2ab8432acb1362c54ea12ecddd95ca71d4365867"
DEAL_209_SELLER = "moxxcompany@gmail.com"


class TestDeal209:
    def test_deal_209_notes_clean(self):
        tok = _login(DEAL_209_SELLER)
        r = _req("GET", f"{API}/safedeal/deals/{DEAL_209_TOKEN}", headers=_h(tok))
        assert r.status_code == 200, r.text[:300]
        d = r.json()["data"]
        _assert_clean(d.get("settlement_note") or "", "deal209.settlement_note")
        for i, e in enumerate(d.get("activity_log") or []):
            _assert_clean(e.get("note") or "", f"deal209.activity[{i}].note")


# --- Fresh parties fixture --------------------------------------------------

@pytest.fixture(scope="module")
def parties():
    ts = int(time.time())
    seller = f"sd-qa-scrub-{ts}-seller@example.com"
    buyer = f"sd-qa-scrub-{ts}-buyer@example.com"
    return {
        "seller": seller, "buyer": buyer,
        "seller_tok": _login(seller), "buyer_tok": _login(buyer),
    }


# --- 3. Fresh simulated deal lifecycle --------------------------------------

class TestFreshDealLifecycle:
    def test_full_lifecycle_clean_notes(self, parties):
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        # top up buyer wallet so fund action works (fund action requires balance)
        rt = _req("POST", f"{API}/safedeal/wallet/topup",
                  headers=_h(buyer_tok),
                  json={"amount": 100, "coin": "USDT-TRC20"})
        assert rt.status_code in (200, 201), rt.text[:300]
        topup_id = rt.json()["data"]["topup"]["topup_id"]
        rs = _req("POST", f"{API}/safedeal/wallet/topup/{topup_id}/simulate",
                  headers=_h(buyer_tok), json={})
        assert rs.status_code == 200, rs.text[:300]
        credited_msg = rs.json().get("message", "")
        _assert_clean(credited_msg, "topup_simulate.message")
        assert "credited" in credited_msg.lower()

        # create deal
        rc = _req("POST", f"{API}/safedeal/deals",
                  headers=_h(seller_tok),
                  json={"title": "scrub-lifecycle", "amount": 30,
                        "my_role": "seller",
                        "counterparty_email": parties["buyer"],
                        "fee_payer": "buyer", "auto_release_days": 1})
        assert rc.status_code == 201, rc.text[:300]
        token = rc.json()["data"]["deal_token"]

        # accept, fund (from balance), deliver, release
        ra = _act(buyer_tok, token, {"action": "accept"})
        assert ra.status_code == 200, ra.text[:300]

        rf = _act(buyer_tok, token, {"action": "fund"})
        assert rf.status_code == 200, rf.text[:300]
        fund_msg = rf.json().get("message", "")
        _assert_clean(fund_msg, "action.fund.message")
        assert fund_msg == "Payment received — escrow funded. The seller has been notified.", fund_msg

        rd = _act(seller_tok, token, {"action": "deliver", "note": "done"})
        assert rd.status_code == 200, rd.text[:300]

        rr = _act(buyer_tok, token, {"action": "release"})
        assert rr.status_code == 200, rr.text[:300]

        # fetch deal, assert everything clean
        rg = _req("GET", f"{API}/safedeal/deals/{token}", headers=_h(seller_tok))
        assert rg.status_code == 200
        d = rg.json()["data"]
        assert d["status"] == "completed", d["status"]
        _assert_clean(d.get("settlement_note") or "", "fresh.settlement_note")
        assert d["settlement_note"] == "Release: seller +30 USD, platform fee 10 USD (authorized)", \
            d["settlement_note"]

        # activity entries: text clean; meta.simulated exists where relevant
        activity = d["activity_log"]
        has_release_meta = False
        has_funded_meta = False
        for i, e in enumerate(activity):
            _assert_clean(e.get("note") or "", f"fresh.activity[{i}].note ({e.get('type')})")
            t = e.get("type", "")
            if t == "outcome_release" and (e.get("meta") or {}).get("simulated") is True:
                has_release_meta = True
            if t == "funded" and (e.get("meta") or {}).get("simulated") is True:
                has_funded_meta = True
                assert "held securely in escrow" in (e.get("note") or ""), e.get("note")
        assert has_release_meta, "outcome_release entry missing meta.simulated=true"
        assert has_funded_meta, "funded entry missing meta.simulated=true"


# --- 4. Auto-withdraw payout note clean -------------------------------------

class TestAutoWithdrawPayout:
    def test_auto_withdraw_payout_note(self, parties):
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]

        # add payout address (step-up)
        code = _step_up(seller_tok)
        ra = _req("POST", f"{API}/safedeal/wallet/addresses",
                  headers=_h(seller_tok),
                  json={"payout_key": "USDT-TRON",
                        "address": "TA53ttWWqYD2kbLNvJhXj9Qfy1yXN1fjBE",
                        "label": "qa", "code": code})
        assert ra.status_code in (200, 201), ra.text[:300]
        addr_id = ra.json()["data"]["address_id"]

        # enable auto-withdraw
        rp = _req("POST", f"{API}/safedeal/profile", headers=_h(seller_tok),
                  json={"auto_withdraw": True, "auto_withdraw_address_id": addr_id})
        assert rp.status_code == 200, rp.text[:300]

        # buyer top-up more if needed (statement check)
        rt = _req("POST", f"{API}/safedeal/wallet/topup",
                  headers=_h(buyer_tok),
                  json={"amount": 100, "coin": "USDT-TRC20"})
        assert rt.status_code in (200, 201), rt.text[:300]
        topup_id = rt.json()["data"]["topup"]["topup_id"]
        rs = _req("POST", f"{API}/safedeal/wallet/topup/{topup_id}/simulate",
                  headers=_h(buyer_tok), json={})
        assert rs.status_code == 200

        # buyer statement — the topup row description must be clean
        rst = _req("GET", f"{API}/safedeal/wallet/statement", headers=_h(buyer_tok))
        assert rst.status_code == 200
        stmt = rst.json()["data"]
        rows = stmt.get("rows") or stmt.get("statement") or stmt
        if isinstance(rows, dict):
            rows = rows.get("rows") or []
        for row in rows:
            for k in ("description", "note", "label"):
                _assert_clean(row.get(k) or "", f"buyer_statement.row.{k}")

        # create + fund-balance + deliver + release
        rc = _req("POST", f"{API}/safedeal/deals",
                  headers=_h(seller_tok),
                  json={"title": "scrub-auto-payout", "amount": 30,
                        "my_role": "seller",
                        "counterparty_email": parties["buyer"],
                        "fee_payer": "buyer", "auto_release_days": 1})
        assert rc.status_code == 201, rc.text[:300]
        token = rc.json()["data"]["deal_token"]

        assert _act(buyer_tok, token, {"action": "accept"}).status_code == 200
        rf = _act(buyer_tok, token, {"action": "fund-balance"})
        assert rf.status_code == 200, rf.text[:300]
        assert _act(seller_tok, token, {"action": "deliver", "note": "ok"}).status_code == 200
        rr = _act(buyer_tok, token, {"action": "release"})
        assert rr.status_code == 200, rr.text[:300]

        # inspect payout activity
        rg = _req("GET", f"{API}/safedeal/deals/{token}", headers=_h(seller_tok))
        assert rg.status_code == 200
        d = rg.json()["data"]
        payout_entries = [e for e in d["activity_log"]
                          if e.get("type") == "payout_seller"]
        assert payout_entries, "no payout_seller entry"
        pe = payout_entries[0]
        _assert_clean(pe.get("note") or "", "payout_seller.note")
        assert pe["note"].startswith("Paid 30 USDT to"), pe["note"]
        assert "(simulated)" not in pe["note"]
        assert (pe.get("meta") or {}).get("simulated") is True
        assert (pe.get("meta") or {}).get("withdrawal_id") is not None

        # seller wallet withdrawals[] tx_hash is internal — starts with SIMULATED-WITHDRAWAL-
        rw = _req("GET", f"{API}/safedeal/wallet", headers=_h(seller_tok))
        assert rw.status_code == 200
        w = rw.json()["data"]
        wds = w.get("withdrawals") or []
        assert wds, "no withdrawals in seller wallet"
        # find the one for this deal (or newest)
        latest = wds[0]
        assert (latest.get("tx_hash") or "").startswith("SIMULATED-WITHDRAWAL-"), latest.get("tx_hash")


# --- 5. Manual withdrawal toast --------------------------------------------

class TestManualWithdraw:
    def test_manual_withdrawal_message(self, parties):
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        # turn auto-withdraw OFF
        rp = _req("POST", f"{API}/safedeal/profile", headers=_h(seller_tok),
                  json={"auto_withdraw": False})
        assert rp.status_code == 200, rp.text[:300]

        # ensure buyer wallet has funds (top-up + simulate)
        rt = _req("POST", f"{API}/safedeal/wallet/topup", headers=_h(buyer_tok),
                  json={"amount": 100, "coin": "USDT-TRC20"})
        assert rt.status_code in (200, 201), rt.text[:300]
        tid = rt.json()["data"]["topup"]["topup_id"]
        assert _req("POST", f"{API}/safedeal/wallet/topup/{tid}/simulate",
                    headers=_h(buyer_tok), json={}).status_code == 200

        # create + fund-balance + deliver + release → seller wallet gains balance
        rc = _req("POST", f"{API}/safedeal/deals", headers=_h(seller_tok),
                  json={"title": "manual-withdraw", "amount": 30, "my_role": "seller",
                        "counterparty_email": parties["buyer"], "fee_payer": "buyer",
                        "auto_release_days": 1})
        assert rc.status_code == 201, rc.text[:300]
        token = rc.json()["data"]["deal_token"]
        assert _act(buyer_tok, token, {"action": "accept"}).status_code == 200
        rf = _act(buyer_tok, token, {"action": "fund-balance"})
        assert rf.status_code == 200, rf.text[:300]
        assert _act(seller_tok, token, {"action": "deliver", "note": "d"}).status_code == 200
        assert _act(buyer_tok, token, {"action": "release"}).status_code == 200

        # get address_id + confirm balance
        rw = _req("GET", f"{API}/safedeal/wallet", headers=_h(seller_tok))
        assert rw.status_code == 200
        w = rw.json()["data"]
        balance = float(w.get("available") or w.get("balance_usd") or w.get("balance") or 0)
        addrs = w.get("addresses") or w.get("payout_addresses") or []
        if not addrs or balance < 10:
            pytest.skip(f"pre-req unmet for manual withdraw test: bal={balance} addrs={len(addrs)} wallet_keys={list(w.keys())}")
        address_id = addrs[0].get("address_id") or addrs[0].get("id")

        rq = _req("POST", f"{API}/safedeal/wallet/withdraw/quote",
                  headers=_h(seller_tok),
                  json={"amount": 10, "address_id": address_id})
        assert rq.status_code == 200, rq.text[:300]

        code = _step_up(seller_tok)
        rwd = _req("POST", f"{API}/safedeal/wallet/withdraw", headers=_h(seller_tok),
                   json={"amount": 10, "address_id": address_id, "code": code})
        assert rwd.status_code in (200, 201), rwd.text[:300]
        msg = rwd.json().get("message", "")
        assert msg == "Withdrawal sent.", msg
        _assert_clean(msg, "manual_withdraw.message")


# --- 6. Fee preview cost notes ---------------------------------------------

class TestFeePreview:
    def test_fee_preview_notes_no_binance(self, parties):
        rp = _req("POST", f"{API}/safedeal/fee-preview",
                  headers=_h(parties["buyer_tok"]),
                  json={"amount": 100, "fee_payer": "buyer"})
        assert rp.status_code == 200, rp.text[:300]
        d = rp.json()["data"]
        items = d.get("costItems") or d.get("cost_items") or []
        assert items, "no costItems returned"
        found_withdrawal_fee = False
        for it in items:
            for k in ("note", "label"):
                v = it.get(k) or ""
                assert "Binance" not in v, f"costItems.{k} contains Binance: {v!r}"
                _assert_clean(v, f"costItems.{k}")
            if (it.get("key") or it.get("type") or "").lower().find("withdraw") >= 0:
                found_withdrawal_fee = True
                note = it.get("note") or ""
                assert "Exchange withdrawal" in note, note
        assert found_withdrawal_fee, "no withdrawal_fee cost item"


# --- 7. Invoice PDF ---------------------------------------------------------

class TestInvoicePdf:
    def test_invoice_pdf_clean(self, parties):
        # create a deal + take through completed via fund-balance for pdf
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        rc = _req("POST", f"{API}/safedeal/deals",
                  headers=_h(seller_tok),
                  json={"title": "scrub-pdf", "amount": 30,
                        "my_role": "seller",
                        "counterparty_email": parties["buyer"],
                        "fee_payer": "buyer", "auto_release_days": 1})
        assert rc.status_code == 201, rc.text[:300]
        token = rc.json()["data"]["deal_token"]
        assert _act(buyer_tok, token, {"action": "accept"}).status_code == 200
        rf = _act(buyer_tok, token, {"action": "fund-balance"})
        if rf.status_code != 200:
            # fallback to normal fund
            rf = _act(buyer_tok, token, {"action": "fund"})
        assert rf.status_code == 200, rf.text[:300]
        assert _act(seller_tok, token, {"action": "deliver", "note": "d"}).status_code == 200
        assert _act(buyer_tok, token, {"action": "release"}).status_code == 200

        # fetch PDF
        rp = _req("GET", f"{API}/safedeal/deals/{token}/summary.pdf",
                  headers={"x-safedeal-token": seller_tok})
        assert rp.status_code == 200, rp.text[:300]
        assert "pdf" in (rp.headers.get("Content-Type", "").lower())
        # extract text
        pdf_path = f"/tmp/sd_scrub_{int(time.time())}.pdf"
        with open(pdf_path, "wb") as fh:
            fh.write(rp.content)
        try:
            r = subprocess.run(["pdftotext", pdf_path, "-"],
                               capture_output=True, text=True, timeout=15)
            text = r.stdout if r.returncode == 0 else ""
        except FileNotFoundError:
            text = ""
        if not text:
            from pypdf import PdfReader
            reader = PdfReader(pdf_path)
            text = "\n".join((p.extract_text() or "") for p in reader.pages)
        # assertions
        low = text.lower()
        for bad in ("simulated", "binance", "binance-", "[live]", "via simulated"):
            assert bad not in low, f"PDF contains {bad!r}"
        # 'Held in custody' row (if present) should say 'via SafeDeal balance' or 'via crypto payment'
        # Only assert if it's a fund-balance flow (skip if fund fallback used)
