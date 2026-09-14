"""Step-Up Authentication backend gate tests.

Verifies: 403 STEPUP_REQUIRED gate, request-code, verify, revoke,
status, scope isolation, rate limiting, and end-to-end auto-retry
against the referral payout auto endpoint (SAFE - credit mode
means the retried write is rejected by the controller with 400).
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("STEPUP_BASE_URL", "http://localhost:8001")
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"
COMPANY_ID = "1"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json().get("data") or r.json()
    tk = data.get("accessToken") or data.get("token")
    assert tk, f"no access token in {r.text[:200]}"
    return tk


@pytest.fixture(scope="module")
def headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-Id": COMPANY_ID,
        "Content-Type": "application/json",
    }


def _revoke(headers, scope):
    try:
        requests.post(f"{BASE}/api/stepup/{scope}/revoke", headers=headers, timeout=15)
    except Exception:
        pass


# Ensure clean slate
@pytest.fixture(scope="module", autouse=True)
def _clean(headers):
    for s in ("payout", "wallet"):
        _revoke(headers, s)
    yield
    for s in ("payout", "wallet"):
        _revoke(headers, s)


class TestStepUpGate:
    def test_a_payout_auto_gated(self, headers):
        r = requests.post(
            f"{BASE}/api/referral/payout/auto",
            headers=headers,
            json={"enabled": True, "auto_min_usd": 1},
            timeout=20,
        )
        assert r.status_code == 403, r.text
        body = r.json()
        # payload could be {code, scope} or nested
        code = body.get("code") or (body.get("data") or {}).get("code")
        scope = body.get("scope") or (body.get("data") or {}).get("scope")
        assert code == "STEPUP_REQUIRED", body
        assert scope == "payout", body

    def test_b_request_code_payout(self, headers):
        r = requests.post(
            f"{BASE}/api/stepup/payout/request-code", headers=headers, timeout=20
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        otp = data.get("preview_otp")
        assert otp and len(str(otp)) == 6, f"no preview_otp: {r.text[:200]}"
        # stash on class
        TestStepUpGate.otp = otp

    def test_c_rate_limit_30s(self, headers):
        r = requests.post(
            f"{BASE}/api/stepup/payout/request-code", headers=headers, timeout=20
        )
        assert r.status_code == 429, f"expected 429 got {r.status_code}: {r.text[:200]}"

    def test_d_verify_payout(self, headers):
        otp = getattr(TestStepUpGate, "otp", None)
        assert otp, "no otp captured"
        r = requests.post(
            f"{BASE}/api/stepup/payout/verify",
            headers=headers,
            json={"method": "email", "code": otp},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data") or r.json()
        assert data.get("active") is True, data

    def test_e_status_active(self, headers):
        r = requests.get(f"{BASE}/api/stepup/payout/status", headers=headers, timeout=20)
        assert r.status_code == 200
        data = r.json().get("data") or r.json()
        assert data.get("active") is True

    def test_f_retry_passes_gate_but_business_rejects(self, headers):
        r = requests.post(
            f"{BASE}/api/referral/payout/auto",
            headers=headers,
            json={"enabled": True, "auto_min_usd": 1},
            timeout=20,
        )
        # Gate passes now (not 403). Business logic returns 400 (credit mode).
        assert r.status_code != 403, r.text
        assert r.status_code == 400, f"expected 400 business-error got {r.status_code}: {r.text[:300]}"
        body = r.json()
        msg = (body.get("message") or "").lower()
        assert "usdt" in msg or "cash" in msg, body

    def test_g_revoke(self, headers):
        r = requests.post(f"{BASE}/api/stepup/payout/revoke", headers=headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_h_status_inactive_after_revoke(self, headers):
        r = requests.get(f"{BASE}/api/stepup/payout/status", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json().get("data") or r.json()
        assert data.get("active") is False

    def test_i_scope_isolation_wallet(self, headers):
        r = requests.post(
            f"{BASE}/api/wallet/batch",
            headers=headers,
            json={"company_id": 1, "operations": []},
            timeout=20,
        )
        assert r.status_code == 403, r.text
        body = r.json()
        code = body.get("code") or (body.get("data") or {}).get("code")
        scope = body.get("scope") or (body.get("data") or {}).get("scope")
        assert code == "STEPUP_REQUIRED"
        assert scope == "wallet"

    def test_j_bogus_scope_400(self, headers):
        r = requests.get(f"{BASE}/api/stepup/bogus/status", headers=headers, timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"
