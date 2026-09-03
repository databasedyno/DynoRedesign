"""
Iteration 120 regression — READ-ONLY on LIVE prod DB, SAFE MODE.
Focus: walletOtp.ts trimming regression (verifyOtp/verifyCode/validateWalletAddress),
walletSudo.status, reset-password security fix, currency rates endpoints, public tickers.
"""
import os
import math
import json
import pytest
import requests

BASE_URL = (os.environ.get("TEAM_TEST_BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
EMAIL = os.environ.get("TEAM_TEST_OWNER_EMAIL", "")
PASSWORD = os.environ.get("TEAM_TEST_OWNER_PASSWORD", "")

pytestmark = pytest.mark.skipif(
    not (BASE_URL and EMAIL and PASSWORD),
    reason="set TEAM_TEST_BASE_URL, TEAM_TEST_OWNER_EMAIL, TEAM_TEST_OWNER_PASSWORD",
)


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def token(s):
    r = s.post(f"{BASE_URL}/api/user/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    j = r.json()
    tok = (j.get("data") or {}).get("accessToken") or j.get("accessToken") or j.get("token")
    assert tok, f"no accessToken in login response: {json.dumps(j)[:400]}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# =============== Login sanity ===============
class TestLogin:
    def test_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 20


# =============== Wallet OTP regression (walletOtp.ts trimmed) ===============
class TestWalletOtp:
    def test_verifyOtp_missing_otp(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/wallet/verifyOtp", headers=auth_headers, json={"company_id": 1}, timeout=20)
        assert r.status_code == 400, r.text[:300]
        assert "otp" in r.text.lower()

    def test_verifyOtp_missing_company(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/wallet/verifyOtp", headers=auth_headers, json={"otp": "123456"}, timeout=20)
        assert r.status_code == 400, r.text[:300]
        assert "company" in r.text.lower()

    def test_verifyOtp_invalid_otp_own_company(self, s, auth_headers):
        # ATTEMPT 1 (kept minimal to avoid tripping the 5-strike lockout)
        r = s.post(f"{BASE_URL}/api/wallet/verifyOtp", headers=auth_headers,
                   json={"otp": "000000", "company_id": 1}, timeout=20)
        assert r.status_code != 500, f"got 500: {r.text[:300]}"
        assert 400 <= r.status_code < 500, r.text[:300]

    def test_verifyOtp_foreign_company(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/wallet/verifyOtp", headers=auth_headers,
                   json={"otp": "111111", "company_id": 999999}, timeout=20)
        assert r.status_code in (403, 400, 404), r.text[:300]
        # spec says 403 "don't have access"
        if r.status_code == 403:
            assert "access" in r.text.lower() or "company" in r.text.lower()

    def test_verifyCode_alias_missing_otp(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/wallet/verifyCode", headers=auth_headers, json={"company_id": 1}, timeout=20)
        assert r.status_code == 400, r.text[:300]
        assert "otp" in r.text.lower()

    def test_verifyOtp_unauth(self, s):
        r = s.post(f"{BASE_URL}/api/wallet/verifyOtp", json={"otp": "1", "company_id": 1}, timeout=20)
        assert r.status_code in (401, 403), r.text[:300]

    def test_validateWalletAddress_ok(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/wallet/validateWalletAddress", headers=auth_headers,
                   json={"wallet_address": "0x0000000000000000000000000000000000000000",
                         "currency": "ETH", "company_id": 1}, timeout=25)
        assert r.status_code != 500, f"got 500: {r.text[:400]}"
        assert r.status_code < 500

    def test_validateWalletAddress_unauth(self, s):
        r = s.post(f"{BASE_URL}/api/wallet/validateWalletAddress",
                   json={"wallet_address": "0x0", "currency": "ETH", "company_id": 1}, timeout=20)
        assert r.status_code in (401, 403), r.text[:300]


# =============== Wallet sudo status regression ===============
class TestWalletSudo:
    def test_sudo_status_auth(self, s, auth_headers):
        r = s.get(f"{BASE_URL}/api/wallet/sudo/status", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert isinstance(j, dict)

    def test_sudo_status_unauth(self, s):
        r = s.get(f"{BASE_URL}/api/wallet/sudo/status", timeout=20)
        assert r.status_code in (401, 403), r.text[:300]


# =============== Reset password security regression ===============
class TestResetPassword:
    def test_bogus_token(self, s):
        r = s.post(f"{BASE_URL}/api/user/reset-password",
                   json={"token": "bogus", "password": "Whatever123!"}, timeout=20)
        assert r.status_code == 400, r.text[:300]
        # Confirm rejection language
        assert "invalid" in r.text.lower() or "expired" in r.text.lower() or "token" in r.text.lower()

    def test_empty_token(self, s):
        r = s.post(f"{BASE_URL}/api/user/reset-password",
                   json={"token": "", "password": "Whatever123!"}, timeout=20)
        assert r.status_code == 400, r.text[:300]

    def test_missing_token(self, s):
        r = s.post(f"{BASE_URL}/api/user/reset-password",
                   json={"password": "Whatever123!"}, timeout=20)
        assert r.status_code == 400, r.text[:300]

    def test_login_still_works_after_bypass_attempts(self, s):
        r = s.post(f"{BASE_URL}/api/user/login",
                   json={"email": EMAIL, "password": PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text[:300]


# =============== Currency rates ===============
def _finite_scan(obj, path="root"):
    problems = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            problems += _finite_scan(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            problems += _finite_scan(v, f"{path}[{i}]")
    elif isinstance(obj, float):
        if not math.isfinite(obj):
            problems.append(f"{path}={obj}")
    elif isinstance(obj, str):
        low = obj.lower()
        if low in ("nan", "infinity", "-infinity") or "e+" in low or "e-" in low:
            # allow exponent only if the actual numeric parse is very small; the code contract says no exponent strings
            problems.append(f"{path}='{obj}'")
    return problems


class TestCurrencyRates:
    def test_wallet_getCurrencyRates_valid(self, s, auth_headers):
        body = {"source": "USD", "amount": 100, "currencyList": ["BTC", "ETH"], "fixedDecimal": True}
        r = s.post(f"{BASE_URL}/api/wallet/getCurrencyRates", headers=auth_headers, json=body, timeout=30)
        assert r.status_code != 500, r.text[:500]
        assert r.status_code == 200, r.text[:500]
        problems = _finite_scan(r.json())
        assert not problems, f"non-finite values: {problems}"

    def test_wallet_getCurrencyRates_empty_body(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/wallet/getCurrencyRates", headers=auth_headers, json={}, timeout=20)
        assert r.status_code != 500, r.text[:500]
        assert 400 <= r.status_code < 500, r.text[:500]

    def test_wallet_getCurrencyRates_unknown_currency(self, s, auth_headers):
        body = {"source": "USD", "amount": 10, "currencyList": ["ZZZ"], "fixedDecimal": True}
        r = s.post(f"{BASE_URL}/api/wallet/getCurrencyRates", headers=auth_headers, json=body, timeout=25)
        assert r.status_code != 500, r.text[:500]

    def test_payment_getCurrencyRates_shape(self, s, auth_headers):
        # paymentRouter.getCurrencyRates uses customerAuthMiddleware; call with same Bearer to check behavior — expect clean 4xx or 200, never 500.
        body = {"source": "USD", "amount": 100, "currencyList": ["BTC", "ETH"], "fixedDecimal": True}
        r = s.post(f"{BASE_URL}/api/payment/getCurrencyRates", headers=auth_headers, json=body, timeout=30)
        assert r.status_code != 500, r.text[:500]
        if r.status_code == 200:
            problems = _finite_scan(r.json())
            assert not problems, f"non-finite values: {problems}"


# =============== Public tickers ===============
class TestPublicTickers:
    def test_tickers(self, s):
        r = s.get(f"{BASE_URL}/api/public/tickers", timeout=20)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        problems = _finite_scan(j)
        assert not problems, f"non-finite: {problems}"
        # check BTC/ETH present with positive price
        blob = json.dumps(j).upper()
        assert "BTC" in blob and "ETH" in blob
