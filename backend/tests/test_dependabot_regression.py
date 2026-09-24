"""Regression tests for Dependabot upgrade (Next 15 + backend dep swaps).
Read-only checks against the public preview endpoint.
"""
import os
import pytest
import time
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://passphrases-2.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Backend liveness (Node backend under ts-node + upgraded deps)
def _retry_get(api, url, retries=6, delay=4):
    last = None
    for _ in range(retries):
        r = api.get(url, timeout=45)
        last = r
        if r.status_code < 500:
            return r
        time.sleep(delay)
    return last


class TestBackendHealth:
    def test_api_root(self, api):
        r = _retry_get(api, f"{BASE_URL}/api")
        assert r.status_code == 200

    def test_api_status(self, api):
        r = _retry_get(api, f"{BASE_URL}/api/status")
        assert r.status_code == 200

    # Tatum/axios 0.33.0 path
    def test_public_tickers(self, api):
        r = _retry_get(api, f"{BASE_URL}/api/public/tickers")
        assert r.status_code == 200
        j = r.json()
        assert j.get("status") == "success"
        data = j.get("data")
        assert isinstance(data, list) and len(data) >= 3
        symbols = {t["symbol"] for t in data}
        assert "BTC" in symbols and "ETH" in symbols
        btc = next(t for t in data if t["symbol"] == "BTC")
        assert isinstance(btc["price"], (int, float)) and btc["price"] > 0


# Public pages (Next 15 SSR)
class TestPublicPages:
    @pytest.mark.parametrize("path", ["/", "/press", "/fees", "/auth/login", "/transactions"])
    def test_page_200(self, api, path):
        # tolerate transient 502 on Next dev restart / cold compile
        codes = []
        for _ in range(8):
            try:
                r = api.get(f"{BASE_URL}{path}", timeout=60)
                codes.append(r.status_code)
                if r.status_code == 200:
                    break
            except Exception as e:
                codes.append(f"exc:{type(e).__name__}")
            time.sleep(5)
        assert 200 in codes, f"{path} never returned 200 (saw {codes})"

    def test_hosted_checkout_page(self, api):
        codes = []
        for _ in range(8):
            try:
                r = api.get(f"{BASE_URL}/pay?d=rNtQRX", timeout=60)
                codes.append(r.status_code)
                if r.status_code == 200:
                    break
            except Exception as e:
                codes.append(f"exc:{type(e).__name__}")
            time.sleep(5)
        assert 200 in codes, f"/pay checkout never returned 200 (saw {codes})"


# Auth-gated endpoint should not 500 on Next 15 / new axios
class TestAuthGated:
    def test_dashboard_overview_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/overview?company_id=1&period=30d", timeout=30)
        assert r.status_code == 401
        j = r.json()
        assert j.get("success") is False
