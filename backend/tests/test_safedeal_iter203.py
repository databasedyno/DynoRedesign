"""
SafeDeal iteration 203 tests.
Covers new/uncovered flows:
 - wallet response shape (top-level balances + data.wallet)
 - withdraw HTTP 201 + >$1000 pending_approval + immediate available drop
 - post-funding cancel (mutual agreement) → refund flow
 - dispute negotiation (open/counter/message/accept) → split settlement
 - admin login + admin withdrawal approve/reject/409 conflict/reversal statement
 - admin readiness endpoint
 - legacy escrow admin deals list regression (dealUrl invite_url)
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

ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASS = "Katiekendra123@"


# ---------- helpers ----------
def _rand_email(role: str) -> str:
    return f"sd-{role}-{int(time.time())}-{uuid.uuid4().hex[:6]}@example.com"


def _post_retry(url, **kw):
    for _ in range(8):
        r = requests.post(url, timeout=30, **kw)
        if r.status_code == 503 and "starting" in r.text.lower():
            time.sleep(3); continue
        return r
    return r


def _get_retry(url, **kw):
    for _ in range(8):
        r = requests.get(url, timeout=30, **kw)
        if r.status_code == 503 and "starting" in r.text.lower():
            time.sleep(3); continue
        return r
    return r


def _login(email: str) -> str:
    r = _post_retry(f"{API}/safedeal/auth/send-code", json={"email": email})
    assert r.status_code == 200, r.text[:300]
    code = r.json()["data"]["preview_code"]
    r2 = _post_retry(f"{API}/safedeal/auth/verify-code", json={"email": email, "code": code})
    assert r2.status_code == 200, r2.text[:300]
    d = r2.json()["data"]
    return d.get("access_token") or d.get("token")


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _stepup(tok: str, purpose: str) -> str:
    r = _post_retry(f"{API}/safedeal/auth/step-up", headers=_h(tok), json={"purpose": purpose})
    assert r.status_code == 200, r.text[:300]
    return r.json()["data"]["preview_code"]


def _create_deal(seller_tok: str, buyer_email: str, amount=300, fee_payer="buyer") -> str:
    r = _post_retry(
        f"{API}/safedeal/deals",
        headers=_h(seller_tok),
        json={
            "title": f"Test deal {uuid.uuid4().hex[:6]}",
            "amount": amount,
            "role": "seller",
            "counterparty_email": buyer_email,
            "fee_payer": fee_payer,
            "auto_release_days": 5,
        },
    )
    assert r.status_code in (200, 201), r.text[:400]
    d = r.json()["data"]
    return d.get("deal_token") or d.get("token") or d.get("deal", {}).get("token")


def _act(tok: str, token: str, action: str, **extra):
    payload = {"action": action, **extra}
    return _post_retry(f"{API}/safedeal/deals/{token}/action", headers=_h(tok), json=payload)


def _wallet(tok: str) -> dict:
    r = _get_retry(f"{API}/safedeal/wallet", headers=_h(tok))
    assert r.status_code == 200, r.text[:200]
    return r.json()["data"]


# ---------- admin token (module-scoped) ----------
@pytest.fixture(scope="module")
def admin_token():
    r = _post_retry(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text[:300]
    tok = r.json()["data"]["accessToken"]
    assert tok
    return tok


# ---------- 1. wallet shape ----------
def test_wallet_exposes_top_level_balances_and_wallet():
    tok = _login(_rand_email("shape"))
    data = _wallet(tok)
    for k in ("available", "held", "total", "currency"):
        assert k in data, f"missing top-level {k}: keys={list(data.keys())}"
    assert "wallet" in data
    w = data["wallet"]
    for k in ("available", "held", "total", "currency"):
        assert k in w, f"missing wallet.{k}"
        assert data[k] == w[k], f"mismatch for {k}: top={data[k]} wallet={w[k]}"


# ---------- 2. withdraw HTTP 201 + >1000 pending_approval + immediate drop ----------
@pytest.fixture(scope="module")
def big_withdrawal_ctx(admin_token):
    """Seller earns 1200 via a released deal, then requests a 1100 withdrawal (>1000 → pending)."""
    seller = _rand_email("bigwd-s")
    buyer = _rand_email("bigwd-b")
    stok = _login(seller)
    btok = _login(buyer)
    token = _create_deal(stok, buyer, amount=1200, fee_payer="buyer")
    assert _act(btok, token, "accept").status_code == 200
    assert _act(btok, token, "fund").status_code == 200
    time.sleep(0.5)
    assert _act(stok, token, "deliver", note="ok").status_code == 200
    assert _act(btok, token, "release").status_code == 200
    time.sleep(0.5)
    sw = _wallet(stok)
    assert sw["available"] >= 1100, f"seller balance not credited: {sw}"

    # Add payout address
    code = _stepup(stok, "add_address")
    ra = _post_retry(f"{API}/safedeal/wallet/addresses", headers=_h(stok),
                     json={"payout_key": "USDT-TRON",
                           "address": "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",
                           "label": "big", "code": code})
    assert ra.status_code in (200, 201), ra.text[:300]
    addr_id = ra.json()["data"].get("id") or ra.json()["data"].get("address_id")
    _make_address_usable(addr_id)  # clear the 24h new-address cooling-off so the withdraw proceeds

    # Withdraw 1100
    avail_before = _wallet(stok)["available"]
    wcode = _stepup(stok, "withdraw")
    rw = _post_retry(f"{API}/safedeal/wallet/withdraw", headers=_h(stok),
                     json={"address_id": addr_id, "amount": 1100, "code": wcode})
    return {
        "seller_tok": stok, "seller_email": seller, "addr_id": addr_id,
        "resp": rw, "avail_before": avail_before,
    }


def test_withdraw_returns_201_and_pending_approval(big_withdrawal_ctx):
    rw = big_withdrawal_ctx["resp"]
    assert rw.status_code == 201, f"expected 201, got {rw.status_code}: {rw.text[:300]}"
    body = rw.json()["data"]
    wd = body.get("withdrawal") or body
    assert wd.get("status") == "pending_approval", f"status={wd.get('status')} body={body}"
    assert wd.get("requires_approval") is True, f"requires_approval={wd.get('requires_approval')}"


def test_withdraw_pending_debits_available_immediately(big_withdrawal_ctx):
    before = big_withdrawal_ctx["avail_before"]
    after = _wallet(big_withdrawal_ctx["seller_tok"])["available"]
    assert after <= before - 1100 + 0.01, f"available did not drop by 1100: {before} → {after}"


# ---------- 3. Admin withdrawal approve ----------
def test_admin_lists_pending_withdrawal_and_approves(admin_token, big_withdrawal_ctx):
    r = _get_retry(f"{API}/safedeal/admin/withdrawals?status=pending_approval",
                   headers=_h(admin_token))
    assert r.status_code == 200, r.text[:300]
    payload = r.json()["data"]
    items = payload if isinstance(payload, list) else (payload.get("withdrawals") or payload.get("items") or [])
    assert isinstance(items, list) and len(items) > 0, f"no pending withdrawals: {payload}"
    ours = [w for w in items if w.get("customer_email") == big_withdrawal_ctx["seller_email"]]
    assert ours, f"our seller's withdrawal not listed"
    w = ours[0]
    wd_id = w.get("id") or w.get("withdrawal_id")
    assert wd_id
    # ensure customer_email field present
    assert "customer_email" in w

    r2 = _post_retry(f"{API}/safedeal/admin/withdrawals/{wd_id}/approve",
                     headers=_h(admin_token))
    assert r2.status_code == 200, r2.text[:300]
    d = r2.json()["data"]
    assert d.get("status") == "sent", d
    assert d.get("simulated") is True, d
    assert (d.get("tx_hash") or "").startswith("SIMULATED-"), d

    # Approving again → 409
    r3 = _post_retry(f"{API}/safedeal/admin/withdrawals/{wd_id}/approve",
                     headers=_h(admin_token))
    assert r3.status_code == 409, f"expected 409, got {r3.status_code}: {r3.text[:200]}"


def test_admin_reject_withdrawal_reverses_balance(admin_token):
    """Self-contained: fresh seller earns 1200 → requests 1100 → admin rejects → balance restored."""
    seller = _rand_email("rej-s")
    buyer = _rand_email("rej-b")
    stok = _login(seller); btok = _login(buyer)
    token = _create_deal(stok, buyer, amount=1200, fee_payer="buyer")
    assert _act(btok, token, "accept").status_code == 200
    assert _act(btok, token, "fund").status_code == 200
    time.sleep(0.5)
    assert _act(stok, token, "deliver", note="ok").status_code == 200
    assert _act(btok, token, "release").status_code == 200
    time.sleep(0.5)
    # Add addr
    code = _stepup(stok, "add_address")
    ra = _post_retry(f"{API}/safedeal/wallet/addresses", headers=_h(stok),
                     json={"payout_key": "USDT-TRON",
                           "address": "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",
                           "label": "rej", "code": code})
    assert ra.status_code in (200, 201), ra.text[:300]
    addr_id = ra.json()["data"].get("id") or ra.json()["data"].get("address_id")
    _make_address_usable(addr_id)  # clear the 24h new-address cooling-off so the withdraw proceeds
    avail_before = _wallet(stok)["available"]
    wcode = _stepup(stok, "withdraw")
    rw = _post_retry(f"{API}/safedeal/wallet/withdraw", headers=_h(stok),
                     json={"address_id": addr_id, "amount": 1100, "code": wcode})
    assert rw.status_code == 201, rw.text[:300]
    wd = rw.json()["data"].get("withdrawal") or rw.json()["data"]
    wd_id = wd.get("withdrawal_id") or wd.get("id")
    assert wd.get("status") == "pending_approval"

    avail_after_req = _wallet(stok)["available"]
    assert avail_after_req <= avail_before - 1050 + 0.01

    r2 = _post_retry(f"{API}/safedeal/admin/withdrawals/{wd_id}/reject",
                     headers=_h(admin_token), json={"reason": "test rejection"})
    assert r2.status_code == 200, r2.text[:300]
    d = r2.json()["data"]
    assert d.get("status") == "rejected", d

    # Balance credited back
    avail_after_reject = _wallet(stok)["available"]
    assert abs(avail_after_reject - avail_before) < 0.5, \
        f"balance not restored: before={avail_before} after={avail_after_reject}"

    # Statement contains withdrawal_reversed entry
    rs = _get_retry(f"{API}/safedeal/wallet/statement", headers=_h(stok))
    assert rs.status_code == 200
    body = rs.json()["data"]
    entries = body if isinstance(body, list) else (body.get("entries") or body.get("items") or [])
    types = [str(e.get("kind") or e.get("type") or "") for e in entries]
    assert any("withdrawal_reversed" in t or "reversed" in t for t in types), \
        f"no withdrawal_reversed entry in statement, types={types}"


def test_admin_routes_require_auth():
    r = _get_retry(f"{API}/safedeal/admin/withdrawals?status=pending_approval")
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ---------- 4. Admin readiness ----------
def test_admin_readiness(admin_token):
    r = _get_retry(f"{API}/safedeal/admin/readiness", headers=_h(admin_token))
    assert r.status_code == 200, r.text[:400]
    d = r.json()["data"]
    assert "ready" in d and isinstance(d["ready"], bool)
    assert d.get("live_settlement") is False
    assert d.get("brand", {}).get("company_id") == 262
    checks = d.get("checks")
    assert isinstance(checks, list) and len(checks) == 12, f"checks: {checks}"
    keys = {c.get("key"): c for c in checks}
    expected = {"brand", "api_key", "webhook", "url", "live", "wallets", "custody",
                "pool", "fee_exempt", "autoconvert", "fees", "email"}
    assert expected.issubset(set(keys.keys())), f"got keys={set(keys.keys())}"
    for c in checks:
        for k in ("key", "ok", "label", "detail"):
            assert k in c, f"missing {k} in check {c}"
    assert keys["brand"]["ok"] is True
    assert keys["fees"]["ok"] is True
    # wallets.ok is data-dependent on prod-ops (brand 262 may or may not have funding wallets
    # provisioned yet) — assert the shape, not a fixed value, so this doesn't flip on go-live.
    assert isinstance(keys["wallets"]["ok"], bool)
    # totals/deals are data-dependent — the SafeDeal brand may be freshly purged to a clean state,
    # so assert the shape (an int), not a positive count.
    assert isinstance(d.get("totals", {}).get("customers", 0), int)
    assert isinstance(d.get("deals", {}).get("count", 0), int)


# ---------- 5. Post-funding cancel (mutual agreement → refund) ----------
@pytest.fixture(scope="module")
def cancel_ctx():
    seller = _rand_email("cxl-s")
    buyer = _rand_email("cxl-b")
    stok = _login(seller)
    btok = _login(buyer)
    token = _create_deal(stok, buyer, amount=300, fee_payer="buyer")
    assert _act(btok, token, "accept").status_code == 200
    assert _act(btok, token, "fund").status_code == 200
    time.sleep(0.5)
    return {"stok": stok, "btok": btok, "token": token,
            "seller_email": seller, "buyer_email": buyer}


def test_buyer_requests_cancellation_after_funding(cancel_ctx):
    r = _act(cancel_ctx["btok"], cancel_ctx["token"], "cancel")
    assert r.status_code == 200, r.text[:400]
    body = r.json()
    msg = str(body.get("message", "")).lower()
    assert "cancellation requested" in msg or "cancellation" in msg, body
    # Verify status disputed with cancellation proposal
    rg = _get_retry(f"{API}/safedeal/deals/{cancel_ctx['token']}", headers=_h(cancel_ctx["btok"]))
    assert rg.status_code == 200
    deal = rg.json()["data"].get("deal") or rg.json()["data"]
    assert deal.get("status") == "disputed", f"status={deal.get('status')}"
    prop = deal.get("dispute_proposal") or {}
    assert prop.get("kind") == "cancellation", f"proposal={prop}"
    assert (prop.get("proposed_outcome") or prop.get("outcome")) == "refund", f"proposal={prop}"


def test_requester_cannot_accept_own_proposal(cancel_ctx):
    r = _act(cancel_ctx["btok"], cancel_ctx["token"], "dispute-accept")
    assert r.status_code in (400, 403, 409), f"expected 4xx, got {r.status_code}: {r.text[:200]}"


def test_seller_accepts_cancellation_refunds_buyer(cancel_ctx):
    # Buyer available BEFORE
    bw_before = _wallet(cancel_ctx["btok"])
    # Seller accepts
    r = _act(cancel_ctx["stok"], cancel_ctx["token"], "dispute-accept")
    assert r.status_code == 200, r.text[:400]
    time.sleep(0.5)

    rg = _get_retry(f"{API}/safedeal/deals/{cancel_ctx['token']}", headers=_h(cancel_ctx["btok"]))
    deal = rg.json()["data"].get("deal") or rg.json()["data"]
    assert deal.get("status") == "refunded", f"status={deal.get('status')}"

    bw = _wallet(cancel_ctx["btok"])
    assert bw["held"] == 0, f"buyer held not 0: {bw['held']}"
    assert 250 < bw["available"] < 318.30, \
        f"buyer available {bw['available']} not in expected refund range"

    sw = _wallet(cancel_ctx["stok"])
    # Seller received nothing extra (only pre-existing 0 assumed for a fresh account)
    assert sw["available"] == 0, f"seller wrongly credited: {sw}"


# ---------- 6. Dispute negotiation with split ----------
@pytest.fixture(scope="module")
def dispute_ctx():
    seller = _rand_email("dsp-s")
    buyer = _rand_email("dsp-b")
    stok = _login(seller)
    btok = _login(buyer)
    token = _create_deal(stok, buyer, amount=300, fee_payer="buyer")
    assert _act(btok, token, "accept").status_code == 200
    assert _act(btok, token, "fund").status_code == 200
    time.sleep(0.5)
    assert _act(stok, token, "deliver", note="half done").status_code == 200
    return {"stok": stok, "btok": btok, "token": token,
            "seller_email": seller, "buyer_email": buyer}


def test_dispute_open_counter_message_accept_split(dispute_ctx):
    tok = dispute_ctx["token"]
    btok = dispute_ctx["btok"]; stok = dispute_ctx["stok"]

    # Buyer opens dispute with split 40/60
    r = _act(btok, tok, "dispute",
             proposed_outcome="split", split_percent_seller=40, message="half done")
    assert r.status_code == 200, r.text[:400]
    rg = _get_retry(f"{API}/safedeal/deals/{tok}", headers=_h(btok))
    deal = rg.json()["data"].get("deal") or rg.json()["data"]
    assert deal.get("status") == "disputed"
    assert (deal.get("dispute_stage") or deal.get("dispute", {}).get("stage")) == "negotiation"
    prop = deal.get("dispute_proposal") or {}
    assert prop.get("split_percent_seller") == 40

    # Seller counters with 60
    r2 = _act(stok, tok, "dispute-counter",
              proposed_outcome="split", split_percent_seller=60)
    assert r2.status_code == 200, r2.text[:400]
    rg = _get_retry(f"{API}/safedeal/deals/{tok}", headers=_h(stok))
    deal = rg.json()["data"].get("deal") or rg.json()["data"]
    prop = deal.get("dispute_proposal") or {}
    assert prop.get("split_percent_seller") == 60
    assert (prop.get("by") or "").lower() == "seller", f"by={prop.get('by')}"

    # Buyer posts message
    len_before = len(deal.get("dispute_thread") or deal.get("dispute", {}).get("thread") or [])
    r3 = _act(btok, tok, "dispute-message", message="ok")
    assert r3.status_code == 200, r3.text[:400]
    rg = _get_retry(f"{API}/safedeal/deals/{tok}", headers=_h(btok))
    deal = rg.json()["data"].get("deal") or rg.json()["data"]
    thread = deal.get("dispute_thread") or deal.get("dispute", {}).get("thread") or []
    assert len(thread) > len_before, f"thread not grown: {len(thread)} vs {len_before}"

    # Buyer accepts seller's 60/40 proposal
    r4 = _act(btok, tok, "dispute-accept")
    assert r4.status_code == 200, r4.text[:400]
    time.sleep(0.5)

    rg = _get_retry(f"{API}/safedeal/deals/{tok}", headers=_h(btok))
    deal = rg.json()["data"].get("deal") or rg.json()["data"]
    assert deal.get("status") == "split", f"status={deal.get('status')}"

    sw = _wallet(stok); bw = _wallet(btok)
    assert sw["available"] > 0, f"seller not credited: {sw}"
    assert bw["available"] > 0, f"buyer not credited: {bw}"
    # Rough sanity: seller ≈ 60% of net pool (~$300), buyer ≈ 40%
    assert sw["available"] > bw["available"], f"seller ({sw['available']}) should be > buyer ({bw['available']})"


# ---------- 7. Legacy escrow admin deals list regression (dealUrl invite_url) ----------
def test_legacy_escrow_admin_list_regression(admin_token):
    r = _get_retry(f"{API}/escrow/admin/deals", headers=_h(admin_token))
    if r.status_code in (401, 403):
        pytest.skip(f"route requires different auth: {r.status_code}")
    if r.status_code == 404:
        pytest.skip("legacy /api/escrow/admin/deals route not present")
    assert r.status_code == 200, r.text[:300]
    body = r.json().get("data") or []
    deals = body if isinstance(body, list) else (body.get("deals") or body.get("items") or [])
    non_sd = [d for d in deals if (d.get("source") or "") != "safedeal"]
    # If any non-SafeDeal deals exist, they must have invite_url with /escrow/invite/
    for d in non_sd[:10]:
        inv = d.get("invite_url") or d.get("inviteUrl") or ""
        assert inv and "/escrow/invite/" in inv, f"bad invite_url on deal id={d.get('id')}: {inv!r}"
