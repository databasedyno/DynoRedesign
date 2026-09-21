"""
SafeDeal iteration 207: Merchant-API funding + payout destination + payout at close.
Focus areas per review request (Batch new-in-iter):
- POST /api/safedeal/deals/:token/funding (create + idempotent) + GET returns coin list
- Webhook HMAC v2 (bad sig 401, pending/confirmed/settled state transitions, meta_data as JSON string)
- Payout destination (before vs after funding hold)
- Payout at close: SIMULATED withdrawal, fee 0, source='settlement'
- Parked payout (add address after funding → wallet balance banner)
- Admin readiness new schema (12 checks incl. api_key/webhook/fee_exempt/autoconvert)
- Regression: action=checkout is removed (400 Unknown action)
"""
import hashlib
import hmac
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 25

# --- helpers ---------------------------------------------------------------


def _load_webhook_secret():
    with open("/app/backend/.env", "r") as f:
        for line in f:
            if line.startswith("SAFEDEAL_WEBHOOK_SECRET="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("SAFEDEAL_WEBHOOK_SECRET missing")


WEBHOOK_SECRET = _load_webhook_secret()


def _req(method, url, **kw):
    """Retry on 503 backend-starting to survive TS backend recycles."""
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
    r2 = _req(
        "POST",
        f"{API}/safedeal/auth/verify-code",
        json={"email": email, "code": code},
    )
    assert r2.status_code == 200, r2.text[:200]
    return r2.json()["data"]["token"]


def _h(token):
    return {"x-safedeal-token": token, "Content-Type": "application/json"}


def _act(tok, deal_token, body):
    return requests.post(
        f"{API}/safedeal/deals/{deal_token}/action",
        headers=_h(tok),
        json=body,
        timeout=TIMEOUT,
    )


def _sign(body_str):
    t = str(int(time.time()))
    msg = f"{t}.{body_str}".encode()
    sig = hmac.new(WEBHOOK_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Dynopay-Signature-V2": f"t={t},v1={sig}",
    }


# --- fixtures --------------------------------------------------------------


@pytest.fixture(scope="module")
def parties():
    ts = int(time.time())
    seller = f"sd-qa-{ts}-seller@example.com"
    buyer = f"sd-qa-{ts}-buyer@example.com"
    return {
        "seller": seller,
        "buyer": buyer,
        "seller_tok": _login(seller),
        "buyer_tok": _login(buyer),
    }


@pytest.fixture(scope="module")
def funded_deal(parties):
    """Create a deal, accept, create Dynopay funding payment (USDT-TRC20), confirm via webhook."""
    seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
    r = requests.post(
        f"{API}/safedeal/deals",
        headers=_h(seller_tok),
        json={
            "title": "Iter207 funding test",
            "amount": 450,
            "price_currency": "EUR",
            "my_role": "seller",
            "counterparty_email": parties["buyer"],
            "fee_payer": "buyer",
            "auto_release_days": 3,
            "deal_type": "service",
            "terms": "Deliver logo files.",
        },
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, r.text[:300]
    d = r.json()["data"]
    token = d["deal_token"]
    escrow_id = d["escrow_id"]
    # accept
    ra = _act(buyer_tok, token, {"action": "accept"})
    assert ra.status_code == 200 and ra.json()["data"]["status"] == "awaiting_payment"

    # create payment
    rp = requests.post(
        f"{API}/safedeal/deals/{token}/funding",
        headers=_h(buyer_tok),
        json={"coin": "USDT-TRC20"},
        timeout=TIMEOUT,
    )
    assert rp.status_code in (200, 201), rp.text[:300]
    pay = rp.json()["data"]["payment"]
    return {
        "token": token,
        "escrow_id": escrow_id,
        "payment_id": pay["payment_id"],
        "address": pay["address"],
        "seller_tok": seller_tok,
        "buyer_tok": buyer_tok,
    }


# --- tests -----------------------------------------------------------------


class TestFunding:
    def test_get_funding_lists_stablecoins_first(self, funded_deal):
        r = requests.get(
            f"{API}/safedeal/deals/{funded_deal['token']}/funding",
            headers=_h(funded_deal["buyer_tok"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text[:200]
        data = r.json()["data"]
        coins = [c["coin"] for c in data["coins"]]
        # First four are the stablecoins in the specified order
        assert coins[:4] == ["USDT-TRC20", "USDT-POLYGON", "USDC-ERC20", "USDT-ERC20"], coins
        # Each has a numeric buyer_pays
        assert all("buyer_pays" in c for c in data["coins"])
        # Payment object present with qr_code
        assert data["payment"]["qr_code"], "qr_code missing"
        # TRON address starts with T
        assert data["payment"]["address"].startswith("T"), data["payment"]["address"]

    def test_get_funding_forbidden_for_seller(self, funded_deal):
        r = requests.get(
            f"{API}/safedeal/deals/{funded_deal['token']}/funding",
            headers=_h(funded_deal["seller_tok"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 403, r.text[:200]

    def test_funding_creation_idempotent_same_coin(self, funded_deal):
        r = requests.post(
            f"{API}/safedeal/deals/{funded_deal['token']}/funding",
            headers=_h(funded_deal["buyer_tok"]),
            json={"coin": "USDT-TRC20"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201), r.text[:200]
        assert r.json()["data"]["payment"]["payment_id"] == funded_deal["payment_id"]


class TestWebhook:
    def test_bad_signature_401(self, funded_deal):
        r = requests.post(
            f"{API}/safedeal/webhooks/dynopay",
            headers={
                "Content-Type": "application/json",
                "X-Dynopay-Signature-V2": "t=1,v1=00",
            },
            data=json.dumps({"event": "payment.confirmed"}),
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_pending_then_confirmed_then_settled(self, funded_deal):
        pid = funded_deal["payment_id"]
        eid = funded_deal["escrow_id"]
        token = funded_deal["token"]
        buyer_tok = funded_deal["buyer_tok"]

        # pending
        body = json.dumps(
            {
                "event": "payment.pending",
                "payment_id": pid,
                "txId": "0xseen207",
                "amount": 475,
                "currency": "USDT-TRC20",
                "meta_data": {"source": "safedeal", "escrow_id": eid},
            }
        )
        r = requests.post(
            f"{API}/safedeal/webhooks/dynopay", headers=_sign(body), data=body, timeout=TIMEOUT
        )
        assert r.status_code == 200, r.text[:200]

        rg = requests.get(
            f"{API}/safedeal/deals/{token}/funding",
            headers=_h(buyer_tok),
            timeout=TIMEOUT,
        )
        assert rg.json()["data"]["payment"]["status"] == "pending"

        # confirmed (meta_data as JSON string)
        body2 = json.dumps(
            {
                "event": "payment.confirmed",
                "payment_id": pid,
                "txId": "0xconf207",
                "amount": 475,
                "base_amount": 475,
                "currency": "USDT-TRC20",
                "meta_data": json.dumps({"source": "safedeal", "escrow_id": eid}),
            }
        )
        r2 = requests.post(
            f"{API}/safedeal/webhooks/dynopay", headers=_sign(body2), data=body2, timeout=TIMEOUT
        )
        assert r2.status_code == 200, r2.text[:200]

        # deal now funded
        rd = requests.get(
            f"{API}/safedeal/deals/{token}", headers=_h(buyer_tok), timeout=TIMEOUT
        )
        deal = rd.json()["data"]
        assert deal["status"] == "funded"
        assert deal["funding_method"] == "dynopay_api"

        # settled
        body3 = json.dumps(
            {
                "event": "payment.settled",
                "payment_id": pid,
                "txId": "0xconf207",
                "settlement_tx_id": "0xsettle207",
                "merchant_amount": 470,
                "currency": "USDT-TRC20",
                "meta_data": {"escrow_id": eid},
            }
        )
        r3 = requests.post(
            f"{API}/safedeal/webhooks/dynopay", headers=_sign(body3), data=body3, timeout=TIMEOUT
        )
        assert r3.status_code == 200

        rd2 = requests.get(
            f"{API}/safedeal/deals/{token}", headers=_h(buyer_tok), timeout=TIMEOUT
        )
        fp = rd2.json()["data"]["funding_payment"]
        assert fp["status"] == "settled"
        assert rd2.json()["data"]["funding_settled_at"] is not None

        # Re-sending confirmed is idempotent (deal stays funded)
        r4 = requests.post(
            f"{API}/safedeal/webhooks/dynopay", headers=_sign(body2), data=body2, timeout=TIMEOUT
        )
        assert r4.status_code == 200
        rd3 = requests.get(
            f"{API}/safedeal/deals/{token}", headers=_h(buyer_tok), timeout=TIMEOUT
        )
        assert rd3.json()["data"]["status"] == "funded"


class TestPayoutAndClose:
    def test_payout_after_funding_goes_to_parked_balance(self, funded_deal, parties):
        """Address added AFTER funding → 24h hold → payout parks in wallet balance."""
        token = funded_deal["token"]
        seller_tok = funded_deal["seller_tok"]
        buyer_tok = funded_deal["buyer_tok"]

        # step-up for adding a new address on the deal card
        rs = requests.post(
            f"{API}/safedeal/auth/step-up",
            headers=_h(seller_tok),
            json={"purpose": "add_address"},
            timeout=TIMEOUT,
        )
        assert rs.status_code == 200
        code = rs.json()["data"]["preview_code"]

        rp = requests.post(
            f"{API}/safedeal/deals/{token}/payout-destination",
            headers=_h(seller_tok),
            json={
                "payout_key": "USDT-TRON",
                "address": "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",
                "label": "iter207 tron",
                "code": code,
            },
            timeout=TIMEOUT,
        )
        assert rp.status_code == 200, rp.text[:300]
        pref = rp.json()["data"]["my_payout_pref"]
        assert pref["before_funding"] is False
        assert pref["address"]["payout_key"] == "USDT-TRON"

        # deliver + release
        rd = _act(seller_tok, token, {"action": "deliver", "delivery_note": "Iter207 delivered"})
        assert rd.status_code == 200 and rd.json()["data"]["status"] == "delivered"
        rr = _act(buyer_tok, token, {"action": "release"})
        assert rr.status_code == 200
        deal = rr.json()["data"]
        assert deal["status"] == "completed"
        payout_notes = [
            a["note"] for a in deal["activity_log"] if a["type"] == "payout_seller"
        ]
        assert payout_notes, deal["activity_log"]
        rw = requests.get(
            f"{API}/safedeal/wallet", headers=_h(seller_tok), timeout=TIMEOUT
        )
        wd = rw.json()["data"]
        cooling_hours = float(
            requests.get(f"{API}/safedeal/config", timeout=TIMEOUT).json()["data"].get("address_cooling_hours") or 0
        )
        if cooling_hours > 0:
            # 24h hold enabled → payout parks in the wallet balance
            assert "safety hold" in payout_notes[0].lower(), payout_notes
            assert (deal.get("seller_payout_tx") or "").startswith("WALLET-CREDIT-")
            assert float(wd["profile"]["parked_payout_usd"]) >= 450 - 0.01
            assert float(wd["wallet"]["available"]) >= 450 - 0.01
            return
        # Hold disabled by the owner (SAFEDEAL_ADDRESS_COOLING_HOURS=0) → paid to the address at once
        assert "paid" in payout_notes[0].lower() and "address" in payout_notes[0].lower(), payout_notes
        assert (deal.get("seller_payout_tx") or "").startswith(("WITHDRAWAL-", "SIMULATED-WITHDRAWAL-", "BINANCE-"))
        assert float(wd["profile"]["parked_payout_usd"]) == 0.0
        rwd = requests.get(f"{API}/safedeal/wallet/withdrawals", headers=_h(seller_tok), timeout=TIMEOUT).json()["data"]
        settlement = [w for w in rwd if w.get("source") == "settlement" and w.get("escrow_id") == funded_deal["escrow_id"]]
        assert settlement, rwd
        assert float(settlement[0]["net_usd"]) >= 450 - 0.01
        assert float(settlement[0].get("fee_usd") or 0) == 0.0


class TestBeforeFundingPath:
    def test_address_before_funding_paid_at_close(self, parties):
        """Second deal: seller picks address before funding → cooling-off waived → paid at close."""
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        # first ensure seller has a saved address from prior test; look up wallet addresses
        rw = requests.get(f"{API}/safedeal/wallet", headers=_h(seller_tok), timeout=TIMEOUT)
        addrs = rw.json()["data"].get("addresses", [])
        assert addrs, "seller has no saved addresses"
        addr_id = addrs[0].get("address_id") or addrs[0].get("id")

        r = requests.post(
            f"{API}/safedeal/deals",
            headers=_h(seller_tok),
            json={
                "title": "Iter207 before-funding",
                "amount": 90,
                "my_role": "seller",
                "counterparty_email": parties["buyer"],
                "fee_payer": "buyer",
                "auto_release_days": 3,
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 201
        token = r.json()["data"]["deal_token"]

        # Set payout destination BEFORE funding
        rp = requests.post(
            f"{API}/safedeal/deals/{token}/payout-destination",
            headers=_h(seller_tok),
            json={"address_id": addr_id},
            timeout=TIMEOUT,
        )
        assert rp.status_code == 200, rp.text[:200]
        assert rp.json()["data"]["my_payout_pref"]["before_funding"] is True

        assert _act(buyer_tok, token, {"action": "accept"}).status_code == 200
        # simulated funding
        rf = _act(buyer_tok, token, {"action": "fund"})
        assert rf.status_code == 200 and rf.json()["data"]["status"] == "funded"

        assert _act(seller_tok, token, {"action": "deliver", "delivery_note": "ok"}).status_code == 200
        rr = _act(buyer_tok, token, {"action": "release"})
        assert rr.status_code == 200
        deal = rr.json()["data"]
        assert deal["status"] == "completed"
        assert (deal.get("seller_payout_tx") or "").startswith("SIMULATED-WITHDRAWAL-"), deal.get(
            "seller_payout_tx"
        )
        payouts = [a for a in deal["activity_log"] if a["type"] == "payout_seller"]
        assert payouts and "paid" in payouts[0]["note"].lower(), payouts
        # internal vocabulary never leaks into user-facing notes; the flag lives in meta only
        assert "simulated" not in payouts[0]["note"].lower() and "binance" not in payouts[0]["note"].lower()
        assert (payouts[0].get("meta") or {}).get("simulated") is True, payouts[0]

        # Wallet withdrawals list has settlement row
        rwd = requests.get(
            f"{API}/safedeal/wallet/withdrawals", headers=_h(seller_tok), timeout=TIMEOUT
        )
        wd = rwd.json()["data"]
        assert wd and wd[0]["source"] == "settlement"
        assert float(wd[0]["fee_usd"]) == 0.0
        assert wd[0]["status"] == "sent"
        assert wd[0]["escrow_id"]


class TestRegressionAndReadiness:
    def test_checkout_action_removed(self, parties):
        # Create a fresh deal + accept then try old checkout action
        seller_tok, buyer_tok = parties["seller_tok"], parties["buyer_tok"]
        r = requests.post(
            f"{API}/safedeal/deals",
            headers=_h(seller_tok),
            json={
                "title": "Iter207 regression",
                "amount": 60,
                "my_role": "seller",
                "counterparty_email": parties["buyer"],
                "fee_payer": "buyer",
                "auto_release_days": 3,
            },
            timeout=TIMEOUT,
        )
        token = r.json()["data"]["deal_token"]
        _act(buyer_tok, token, {"action": "accept"})
        rr = _act(buyer_tok, token, {"action": "checkout"})
        assert rr.status_code == 400
        assert "unknown" in rr.text.lower()

    def test_admin_readiness_new_schema(self):
        # Login as super-admin
        with open("/app/memory/test_credentials.md", "r") as f:
            _ = f.read()  # ensure file present
        rl = requests.post(
            f"{API}/admin/login",
            json={"email": "moxxcompany@gmail.com", "password": "Katiekendra123@"},
            timeout=TIMEOUT,
        )
        assert rl.status_code == 200, rl.text[:200]
        admin_tok = rl.json()["data"]["accessToken"]
        r = requests.get(
            f"{API}/safedeal/admin/readiness",
            headers={"Authorization": f"Bearer {admin_tok}"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text[:400]
        data = r.json()["data"]
        keys = {c["key"] for c in data["checks"]}
        required = {
            "brand", "api_key", "webhook", "url", "live", "wallets",
            "custody", "pool", "fee_exempt", "autoconvert", "fees", "email",
        }
        assert required.issubset(keys), f"missing: {required - keys}"
        by = {c["key"]: c for c in data["checks"]}
        assert by["api_key"]["ok"] is True
        assert "dpk_live_" in by["api_key"]["detail"]  # key rotates per environment — only the prefix is stable
        assert "262" in by["api_key"]["detail"]
        assert by["webhook"]["ok"] is True
        assert by["fee_exempt"]["ok"] is True
        # live/autoconvert may be warn in preview
        assert data.get("live_settlement") is False
        assert data.get("brand", {}).get("company_id") == 262
        # Totals present
        assert "deals" in data or "totals" in data
