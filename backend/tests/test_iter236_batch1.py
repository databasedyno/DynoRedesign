"""Iteration 236 — Phase 1 Batch 1 P0 backend fixes.

Tests: CK-02 (deleted pay link 404), MD-06 (merchant getPaymentLinkById 404 for slug),
MD-01 sandbox exclusion from dashboard/overview + wallet transactions + admin analytics.
"""
import os
import subprocess
import time
import requests
import pytest

BASE_URL = "https://trx-limit-unified.preview.emergentagent.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"


class RetrySession(requests.Session):
    def request(self, method, url, **kwargs):
        kwargs.setdefault("timeout", 30)
        last = None
        for _ in range(6):
            last = super().request(method, url, **kwargs)
            if last.status_code < 500:
                return last
            time.sleep(3)
        return last


@pytest.fixture(scope="session")
def s():
    session = RetrySession()
    session.headers.update({"User-Agent": UA, "Content-Type": "application/json"})
    # warmup
    for _ in range(10):
        try:
            r = session.get(f"{BASE_URL}/api/pay/getData", timeout=10)
            if r.status_code < 500:
                break
        except Exception:
            pass
        time.sleep(3)
    return session


def _totp():
    out = subprocess.check_output(["node", "/app/backend/scripts/print_totp.cjs", "1"], text=True)
    return out.strip().splitlines()[-1].strip()


@pytest.fixture(scope="session")
def merchant_token(s):
    r = s.post(f"{BASE_URL}/api/user/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    challenge = r.json()["data"]["challenge_token"]
    # Try TOTP up to 2 times (rotates every 30s)
    for _ in range(2):
        code = _totp()
        r2 = s.post(f"{BASE_URL}/api/user/2fa/validate", json={"challenge_token": challenge, "token": code}, timeout=30)
        if r2.status_code == 200:
            return r2.json()["data"]["accessToken"]
        time.sleep(2)
    pytest.skip(f"2fa validate failed: {r2.status_code} {r2.text[:200]}")


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json()["data"]["accessToken"]


# ---------------- CK-02 ----------------
class TestCK02:
    def test_getdata_deleted_link_returns_404(self, s):
        r = s.post(f"{BASE_URL}/api/pay/getData", json={"data": "rNtQRX"}, timeout=30)
        assert r.status_code == 404, f"expected 404 got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("success") is False
        assert "not found" in (body.get("message") or "").lower() or "expired" in (body.get("message") or "").lower()

    def test_getdata_existing_link_regression(self, s):
        r = s.post(f"{BASE_URL}/api/pay/getData", json={"data": "jgQQzL"}, timeout=30)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:200]}"
        body = r.json()
        data = body.get("data") or {}
        assert float(data.get("amount", 0)) == 12
        assert data.get("token"), "expected data.token"


# ---------------- MD-06 ----------------
class TestMD06:
    def test_link_by_slug_returns_404(self, s, merchant_token):
        r = s.get(f"{BASE_URL}/api/pay/links/rNtQRX", headers={"Authorization": f"Bearer {merchant_token}"}, timeout=30)
        assert r.status_code == 404, f"expected 404 got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "not found" in (body.get("message") or "").lower()

    def test_link_by_id_regression(self, s, merchant_token):
        # GET list of pay links for company 1
        r = s.get(
            f"{BASE_URL}/api/pay/getPaymentLinks?company_id=1&page=1&rowsPerPage=10",
            headers={"Authorization": f"Bearer {merchant_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"list failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        d = body.get("data") or {}
        rows = d.get("rows") or d.get("links") or d.get("data") or (d if isinstance(d, list) else [])
        if isinstance(rows, dict):
            rows = rows.get("data") or rows.get("items") or []
        assert rows, f"no links returned: {str(body)[:300]}"
        link_id = None
        for row in rows:
            lid = row.get("link_id") or row.get("id") or row.get("payment_link_id")
            if lid and str(lid).isdigit():
                link_id = lid
                break
        assert link_id, f"no numeric link_id in list: {str(rows)[:300]}"
        r2 = s.get(f"{BASE_URL}/api/pay/links/{link_id}", headers={"Authorization": f"Bearer {merchant_token}"}, timeout=30)
        assert r2.status_code == 200, f"expected 200 got {r2.status_code}: {r2.text[:200]}"


# ---------------- MD-01 sandbox exclusion ----------------
class TestMD01:
    def test_overview_excludes_sandbox_usd_20(self, s, merchant_token):
        r = s.get(
            f"{BASE_URL}/api/dashboard/overview?company_id=1&period=30d",
            headers={"Authorization": f"Bearer {merchant_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        data = r.json().get("data") or {}
        by_asset = ((data.get("forwarded") or {}).get("by_asset")) or []
        # Ensure no bare 'USDT' amount 20 sandbox row leaked
        for row in by_asset:
            asset = str(row.get("asset") or row.get("currency") or "").upper()
            amt = float(row.get("amount") or row.get("total") or 0)
            assert not (asset == "USDT" and abs(amt - 20) < 0.01), f"sandbox tx leak in overview: {row}"

    def test_wallet_tx_1280_marked_dev_and_usdt(self, s, merchant_token):
        headers = {"Authorization": f"Bearer {merchant_token}"}
        found = None
        for page in range(1, 25):
            r = s.post(
                f"{BASE_URL}/api/wallet/getAllTransactions",
                json={"company_id": 1, "page": page, "rowsPerPage": 100},
                headers=headers,
                timeout=30,
            )
            assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
            d = r.json().get("data") or {}
            rows = (d.get("customers_transactions") or []) + (d.get("self_transactions") or [])
            if not rows:
                break
            for row in rows:
                if int(row.get("transaction_id") or 0) == 1280:
                    found = row
                    break
            if found:
                break
        assert found, "transaction_id 1280 not found"
        assert (found.get("environment") or "").lower() == "development", f"env: {found.get('environment')}"
        cc = (found.get("crypto_currency") or "").upper()
        assert "USDT" in cc, f"crypto_currency: {cc}"

    def test_admin_analytics_excludes_usd_20(self, s, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = s.post(f"{BASE_URL}/api/admin/getAdminAnalytics", json={}, headers=headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json().get("data") or {}
        # popularCurrency is the volume-by-currency structure on admin analytics
        pop = d.get("popularCurrency") or []
        # No bare 'USD' fiat entry with transaction_count > 0 (sandbox leak indicator)
        usd_fiat = [row for row in pop
                    if str(row.get("wallet_type", "")).upper() == "USD"
                    and str(row.get("currency_type", "")).upper() == "FIAT"
                    and int(row.get("transaction_count") or 0) > 0]
        assert not usd_fiat, f"Sandbox 'USD' FIAT leaked into admin analytics popularCurrency: {usd_fiat}"
