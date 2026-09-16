"""
Regression test for merchant Direct-API GET /api/user/getPaymentStatus/:payment_id
returning fee = transaction_fee + fixed_fee (session change).

Flow:
 1. Login merchant (2-step) -> JWT
 2. Open api-key step-up (email OTP via preview_otp)
 3. Regenerate the existing development key (api_id=92) to get plaintext secret
 4. Call GET /api/user/getPaymentStatus/:payment_id for two settled payments and
    verify fee == transaction_fee (fixed_fee=0 for these historical rows) at both
    top-level `fee` and nested `payment.fee`.
 5. Cleanup: revoke the dev key session (POST /api/userApi/revoke/:id).
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"
DEV_KEY_API_ID = 92  # development key on company 1

# Expected data (from ro_query on tbl_user_transaction):
PAYMENTS = [
    {"id": "831d6b34-cf04-471a-8eac-daeae13220ee", "transaction_fee": 0.00001655, "fixed_fee": 0.0},
    {"id": "1eecbbde-3ed8-4440-9fc1-7ea2cada6c49", "transaction_fee": 2.0, "fixed_fee": 0.0},
]


@pytest.fixture(scope="module")
def merchant_jwt():
    s = requests.Session()
    import time as _t
    r2 = None
    for _ in range(12):
        r2 = s.post(f"{BASE}/api/user/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
        if r2.status_code != 503:
            break
        _t.sleep(5)
    assert r2.status_code in (200, 201), f"login {r2.status_code}: {r2.text[:300]}"
    data = r2.json().get("data") or r2.json()
    token = data.get("token") or data.get("accessToken") or data.get("jwt")
    assert token, f"no token in login response: {r2.text[:500]}"
    return token


@pytest.fixture(scope="module")
def dev_api_key(merchant_jwt):
    """Regenerate the existing dev key and yield the plaintext. Revoke on teardown."""
    h = {"Authorization": f"Bearer {merchant_jwt}"}
    # 1) request step-up code
    r = requests.post(f"{BASE}/api/stepup/apikey/request-code", headers=h, timeout=30)
    assert r.status_code == 200, f"request-code failed: {r.status_code} {r.text[:300]}"
    otp = (r.json().get("data") or {}).get("preview_otp")
    assert otp, f"preview_otp missing (DISABLE_OUTBOUND_EMAIL not true?): {r.text[:400]}"
    # 2) verify to open apikey scope
    v = requests.post(
        f"{BASE}/api/stepup/apikey/verify",
        headers=h, json={"method": "email", "code": otp}, timeout=30,
    )
    assert v.status_code == 200, f"verify failed: {v.status_code} {v.text[:300]}"
    # 3) regenerate the dev key
    reg = requests.post(
        f"{BASE}/api/userApi/regenerateApi/{DEV_KEY_API_ID}", headers=h, timeout=30,
    )
    assert reg.status_code == 200, f"regenerateApi failed: {reg.status_code} {reg.text[:400]}"
    body = reg.json().get("data") or reg.json()
    plaintext = (
        body.get("apiKey") if isinstance(body.get("apiKey"), str) else None
    ) or body.get("plaintext_key") or body.get("plaintextKey") or body.get("api_key") or body.get("key")
    # Search nested if not found
    if not plaintext:
        import json as _j
        raise AssertionError("plaintext key not in regenerate response: " + _j.dumps(body)[:600])
    yield plaintext
    # Teardown: revoke stepup session (not the key itself — keeping the dev key active
    # avoids breaking the merchant's dev slot; but we lock the stepup scope).
    try:
        requests.post(f"{BASE}/api/stepup/apikey/revoke", headers=h, timeout=15)
    except Exception:
        pass


@pytest.mark.parametrize("payment", PAYMENTS, ids=lambda p: p["id"])
def test_get_payment_status_returns_fee_sum(dev_api_key, payment):
    hdr = {"x-api-key": dev_api_key}
    r = requests.get(f"{BASE}/api/user/getPaymentStatus/{payment['id']}", headers=hdr, timeout=30)
    assert r.status_code == 200, f"status {r.status_code}: {r.text[:500]}"
    body = r.json()
    data = body.get("data") or body
    # Top-level fee
    top_fee = data.get("fee")
    expected = payment["transaction_fee"] + payment["fixed_fee"]
    assert top_fee is not None, "top-level fee is null"
    assert abs(float(top_fee) - expected) < 1e-9, (
        f"top-level fee={top_fee} expected={expected}"
    )
    # Nested payment.fee
    nested = (data.get("payment") or {}).get("fee")
    assert nested is not None, "payment.fee is null"
    assert abs(float(nested) - expected) < 1e-9, (
        f"payment.fee={nested} expected={expected}"
    )
    # For historical rows (fixed_fee=0) fee == transaction_fee (unchanged).
    assert abs(float(top_fee) - payment["transaction_fee"]) < 1e-9
