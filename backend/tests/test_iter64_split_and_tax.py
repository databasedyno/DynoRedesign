"""
Iteration 64 backend tests: analytics split + per-company tax + regressions.
SAFE MODE against LIVE prod. Tax PATCH allowed ONLY under X-Company-Id:62 (KLOSE).
"""
import os
import pytest
import requests

BASE_URL = "https://dynopay-setup-6.preview.emergentagent.com"
LOGIN = {"email": "hostbay@moxx.co", "password": "Katiekendra123@"}


@pytest.fixture(scope="session")
def token():
    import time
    last = None
    for _ in range(12):
        try:
            r = requests.post(f"{BASE_URL}/api/user/login", json=LOGIN, timeout=30)
            last = r
            if r.status_code == 200:
                break
        except Exception as e:
            last = e
        time.sleep(5)
    assert last is not None and getattr(last, "status_code", 0) == 200, f"login failed: {last}"
    r = last
    tok = r.json().get("data", {}).get("accessToken") or r.json().get("accessToken")
    assert tok, f"no accessToken in login response: {r.text[:300]}"
    return tok


def _h(token, company_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if company_id is not None:
        h["X-Company-Id"] = str(company_id)
    return h


# ---------- Analytics split ----------
class TestAnalyticsSplit:
    def test_split_shape_and_rows(self, token):
        r = requests.get(f"{BASE_URL}/api/user/creator/analytics/split",
                         headers=_h(token), timeout=30)
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        data = body.get("data", body)
        assert data.get("window_days") == 30
        assert "currency" in data
        companies = data.get("companies") or []
        assert len(companies) == 2, f"expected 2 companies got {len(companies)}: {companies}"
        by_id = {c["company_id"]: c for c in companies}
        assert 1 in by_id and 62 in by_id, f"missing ids: {list(by_id.keys())}"

        hb = by_id[1]
        assert hb.get("handle") == "hostbay"
        assert hb.get("is_primary") is True
        assert (hb.get("views_30d") or 0) > 0, f"hostbay views should be >0: {hb}"
        assert (hb.get("tips_count_30d") or 0) >= 1, f"hostbay tips_count >=1: {hb}"
        assert float(hb.get("tips_amount_30d") or 0) >= 10, f"hostbay tips_amount >=10: {hb}"

        kl = by_id[62]
        assert kl.get("handle") in (None, ""), f"KLOSE handle expected null: {kl}"
        assert kl.get("is_primary") is False
        for k in ("views_30d", "tips_count_30d", "tips_amount_30d", "sales_count_30d", "sales_amount_30d"):
            v = kl.get(k)
            if v is not None:
                assert float(v) == 0, f"KLOSE {k} expected 0 got {v}"


# ---------- Tax settings per-company ----------
class TestTaxSettings:
    def test_get_tax_company62_inherits_account(self, token):
        r = requests.get(f"{BASE_URL}/api/user/tax-settings",
                         headers=_h(token, 62), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data", r.json())
        assert d.get("source") == "account", d
        assert int(d.get("company_id")) == 62, d
        assert d.get("default_apply_tax") in (False, None, 0), d
        assert d.get("merchant_vat_id") in (None, ""), d

    def test_get_tax_company1_source_account(self, token):
        r = requests.get(f"{BASE_URL}/api/user/tax-settings",
                         headers=_h(token, 1), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data", r.json())
        assert d.get("source") == "account", d
        assert int(d.get("company_id")) == 1, d

    def test_patch_tax_company62_writes_company_scope(self, token):
        payload = {
            "default_apply_tax": True,
            "merchant_country_code": "DE",
            "merchant_vat_id": "DE123456789",
        }
        r = requests.patch(f"{BASE_URL}/api/user/tax-settings",
                           headers=_h(token, 62), json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        d = r.json().get("data", r.json())
        assert d.get("source") == "company", d
        assert int(d.get("company_id")) == 62, d
        assert d.get("default_apply_tax") in (True, 1), d
        assert d.get("merchant_country_code") == "DE", d
        assert d.get("merchant_vat_id") == "DE123456789", d

    def test_isolation_company1_still_account(self, token):
        # after patching 62, company 1 must NOT be affected
        r = requests.get(f"{BASE_URL}/api/user/tax-settings",
                         headers=_h(token, 1), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data", r.json())
        assert d.get("source") == "account", f"company1 leaked to company scope: {d}"
        assert d.get("merchant_vat_id") in (None, ""), d

    def test_patch_invalid_country_400(self, token):
        payload = {"merchant_country_code": "GERMANY"}
        r = requests.patch(f"{BASE_URL}/api/user/tax-settings",
                           headers=_h(token, 62), json=payload, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:300]}"


# ---------- Regressions ----------
class TestRegressions:
    def test_profile_company1_hostbay(self, token):
        r = requests.get(f"{BASE_URL}/api/user/creator/profile",
                         headers=_h(token, 1), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data", r.json())
        assert d.get("handle") == "hostbay", d

    def test_profile_company62_pending(self, token):
        r = requests.get(f"{BASE_URL}/api/user/creator/profile",
                         headers=_h(token, 62), timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json().get("data", r.json())
        assert d.get("storefront_pending") is True, d

    def test_public_shop_hostbay_200(self):
        r = requests.get(f"{BASE_URL}/api/shop/hostbay", timeout=30, allow_redirects=True)
        # Next page — 200 acceptable; if 30x, still fine.
        assert r.status_code in (200, 301, 302, 304), r.status_code
