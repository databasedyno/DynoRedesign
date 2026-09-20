"""
SafeDeal backend API smoke/regression tests.
Covers: config, sign-in preview code flow, deal validation, own-email rejection,
insufficient balance, wallet/statement, address+withdraw, deals list.
"""
import os
import subprocess
import time
import uuid
import pytest
import requests

BASE = os.environ.get("SAFEDEAL_BASE_URL") or "http://localhost:8001"
API = BASE.rstrip("/") + "/api"

# Directory that holds scripts/_pgq.js (the repo DB write helper) — this file lives in backend/tests/.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _make_address_usable(addr_id) -> None:
    """Clear the 24h new-address cooling-off (SAFEDEAL_ADDRESS_COOLING_HOURS, default 24) for a
    freshly-saved payout address by backdating its created_at, so a withdrawal can be exercised.
    Throwaway QA customers only."""
    subprocess.run(
        ["node", "scripts/_pgq.js",
         "UPDATE tbl_customer_payout_address SET created_at = created_at - interval '48 hours' "
         f"WHERE address_id = {int(addr_id)}"],
        cwd=BACKEND_DIR, check=True, capture_output=True, timeout=30,
    )


def _rand_email(role: str) -> str:
    return f"sd-{role}-{int(time.time())}-{uuid.uuid4().hex[:6]}@example.com"


def _post_with_retry(url, **kw):
    for _ in range(8):
        r = requests.post(url, timeout=20, **kw)
        if r.status_code == 503 and "starting" in r.text.lower():
            time.sleep(3); continue
        return r
    return r


def _get_with_retry(url, **kw):
    for _ in range(8):
        r = requests.get(url, timeout=20, **kw)
        if r.status_code == 503 and "starting" in r.text.lower():
            time.sleep(3); continue
        return r
    return r


def _login(email: str) -> str:
    r = _post_with_retry(f"{API}/safedeal/auth/send-code", json={"email": email})
    assert r.status_code == 200, f"send-code {r.status_code}: {r.text[:300]}"
    body = r.json()
    code = body.get("data", {}).get("preview_code")
    assert code, f"missing preview_code: {body}"
    r2 = requests.post(f"{API}/safedeal/auth/verify-code", json={"email": email, "code": code}, timeout=15)
    assert r2.status_code == 200, r2.text[:300]
    token = r2.json().get("data", {}).get("access_token") or r2.json().get("data", {}).get("token")
    assert token, f"missing token: {r2.json()}"
    return token


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ----- config -----
def test_config_returns_money_rules():
    r = _get_with_retry(f"{API}/safedeal/config")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["fee_percent"] == 5
    assert d["fee_min_usd"] == 10
    assert d["min_deal_usd"] == 30
    assert d["min_withdrawal_usd"] == 10
    assert d["withdrawal_approval_usd"] == 1000


# ----- auth -----
def test_signin_wrong_code_rejected():
    email = _rand_email("wrong")
    r = requests.post(f"{API}/safedeal/auth/send-code", json={"email": email}, timeout=15)
    assert r.status_code == 200
    r2 = requests.post(f"{API}/safedeal/auth/verify-code", json={"email": email, "code": "000000"}, timeout=15)
    assert r2.status_code in (400, 401, 422), r2.text[:200]


# ----- deals validation -----
def test_min_deal_amount_rejected():
    seller = _rand_email("seller")
    tok = _login(seller)
    r = requests.post(
        f"{API}/safedeal/deals",
        headers=_h(tok),
        json={"title": "Too small", "amount": 20, "role": "seller",
              "counterparty_email": _rand_email("buyer"), "fee_payer": "split", "auto_release_days": 5},
        timeout=15,
    )
    assert r.status_code == 400
    assert "minimum" in r.text.lower() or "30" in r.text


def test_cannot_invite_self():
    email = _rand_email("selfinv")
    tok = _login(email)
    r = requests.post(
        f"{API}/safedeal/deals",
        headers=_h(tok),
        json={"title": "Self invite", "amount": 300, "role": "seller",
              "counterparty_email": email, "fee_payer": "split", "auto_release_days": 5},
        timeout=15,
    )
    assert r.status_code == 400, r.text[:300]


# ----- full happy path: create, accept, fund-balance insufficient, fund(sim), deliver, release -----
@pytest.fixture(scope="module")
def deal_ctx():
    seller_email = _rand_email("seller")
    buyer_email = _rand_email("buyer")
    seller_tok = _login(seller_email)
    buyer_tok = _login(buyer_email)
    r = requests.post(
        f"{API}/safedeal/deals",
        headers=_h(seller_tok),
        json={"title": "Logo design", "amount": 300, "role": "seller",
              "counterparty_email": buyer_email, "fee_payer": "split", "auto_release_days": 5},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text[:400]
    d = r.json()["data"]
    token = d.get("deal_token") or d.get("token") or d.get("deal", {}).get("token")
    assert token
    return {
        "seller_email": seller_email, "buyer_email": buyer_email,
        "seller_tok": seller_tok, "buyer_tok": buyer_tok, "token": token,
    }


def test_unrelated_user_forbidden(deal_ctx):
    stranger_tok = _login(_rand_email("stranger"))
    r = requests.get(f"{API}/safedeal/deals/{deal_ctx['token']}", headers=_h(stranger_tok), timeout=15)
    assert r.status_code in (403, 404), r.text[:200]


def test_buyer_accept_and_fund_balance_insufficient(deal_ctx):
    # Buyer accepts
    r = requests.post(f"{API}/safedeal/deals/{deal_ctx['token']}/action",
                      headers=_h(deal_ctx["buyer_tok"]),
                      json={"action": "accept"}, timeout=15)
    assert r.status_code == 200, r.text[:300]
    # Insufficient balance for fund-balance
    r2 = requests.post(f"{API}/safedeal/deals/{deal_ctx['token']}/action",
                       headers=_h(deal_ctx["buyer_tok"]),
                       json={"action": "fund-balance"}, timeout=15)
    assert r2.status_code == 400
    assert "balance" in r2.text.lower()


def test_fund_sim_release_and_wallets(deal_ctx):
    # Simulated fund
    r = requests.post(f"{API}/safedeal/deals/{deal_ctx['token']}/action",
                      headers=_h(deal_ctx["buyer_tok"]),
                      json={"action": "fund"}, timeout=30)
    assert r.status_code == 200, r.text[:400]
    time.sleep(1)
    # Seller marks delivered
    r = requests.post(f"{API}/safedeal/deals/{deal_ctx['token']}/action",
                      headers=_h(deal_ctx["seller_tok"]),
                      json={"action": "deliver", "note": "shipped"}, timeout=15)
    assert r.status_code == 200, r.text[:300]
    # Buyer releases
    r = requests.post(f"{API}/safedeal/deals/{deal_ctx['token']}/action",
                      headers=_h(deal_ctx["buyer_tok"]),
                      json={"action": "release"}, timeout=30)
    assert r.status_code == 200, r.text[:400]
    time.sleep(1)
    # Seller wallet has funds
    rw = requests.get(f"{API}/safedeal/wallet", headers=_h(deal_ctx["seller_tok"]), timeout=15)
    assert rw.status_code == 200
    seller_data = rw.json()["data"]
    seller_wallet = seller_data.get("wallet") or seller_data
    seller_bal = seller_wallet["available"]
    assert seller_bal > 0, f"seller balance not credited: {rw.json()}"
    # Buyer available ends at 0
    rb = requests.get(f"{API}/safedeal/wallet", headers=_h(deal_ctx["buyer_tok"]), timeout=15)
    assert rb.status_code == 200
    buyer_wallet = rb.json()["data"].get("wallet") or rb.json()["data"]
    assert buyer_wallet["available"] == 0
    assert buyer_wallet["held"] == 0


def test_statement_csv(deal_ctx):
    r = requests.get(f"{API}/safedeal/wallet/statement.csv", headers=_h(deal_ctx["seller_tok"]), timeout=15)
    assert r.status_code == 200
    assert "Date,Deal" in r.text or "Date" in r.text


def test_add_address_and_withdraw(deal_ctx):
    # Send step-up code for address add
    r = requests.post(f"{API}/safedeal/auth/step-up",
                      headers=_h(deal_ctx["seller_tok"]),
                      json={"purpose": "add_address"}, timeout=15)
    assert r.status_code == 200, r.text[:200]
    code = r.json().get("data", {}).get("preview_code")
    assert code
    r2 = requests.post(f"{API}/safedeal/wallet/addresses",
                       headers=_h(deal_ctx["seller_tok"]),
                       json={"payout_key": "USDT-TRON",
                             "address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
                             "label": "tron main", "code": code}, timeout=15)
    assert r2.status_code in (200, 201), r2.text[:300]
    addr_id = r2.json()["data"].get("id") or r2.json()["data"].get("address_id")
    _make_address_usable(addr_id)  # clear the 24h new-address cooling-off so the withdraw proceeds
    # Get quote (POST)
    rq = requests.post(f"{API}/safedeal/wallet/withdraw/quote",
                       headers=_h(deal_ctx["seller_tok"]),
                       json={"address_id": addr_id, "amount": 50}, timeout=15)
    assert rq.status_code == 200, rq.text[:200]
    # Send withdrawal step-up code
    r3 = requests.post(f"{API}/safedeal/auth/step-up",
                       headers=_h(deal_ctx["seller_tok"]),
                       json={"purpose": "withdraw"}, timeout=15)
    code2 = r3.json()["data"]["preview_code"]
    r4 = requests.post(f"{API}/safedeal/wallet/withdraw",
                       headers=_h(deal_ctx["seller_tok"]),
                       json={"address_id": addr_id, "amount": 50, "code": code2}, timeout=30)
    assert r4.status_code == 201, r4.text[:400]
    body = r4.json()
    status = body["data"].get("status") or body["data"].get("withdrawal", {}).get("status")
    assert status in ("sent", "pending_approval"), body


def test_invalid_address_rejected(deal_ctx):
    r = requests.post(f"{API}/safedeal/auth/step-up",
                      headers=_h(deal_ctx["seller_tok"]),
                      json={"purpose": "add_address"}, timeout=15)
    code = r.json()["data"]["preview_code"]
    r2 = requests.post(f"{API}/safedeal/wallet/addresses",
                       headers=_h(deal_ctx["seller_tok"]),
                       json={"payout_key": "USDT-TRON",
                             "address": "NOT-A-VALID-ADDRESS",
                             "label": "bad", "code": code}, timeout=15)
    assert r2.status_code == 400, r2.text[:200]


def test_deals_list_includes_completed(deal_ctx):
    r = requests.get(f"{API}/safedeal/deals", headers=_h(deal_ctx["seller_tok"]), timeout=15)
    assert r.status_code == 200
    data = r.json()["data"]
    deals = data if isinstance(data, list) else (data.get("deals") or [])
    assert isinstance(deals, list)
    assert any((d.get("deal_token") or d.get("token")) == deal_ctx["token"] for d in deals)
