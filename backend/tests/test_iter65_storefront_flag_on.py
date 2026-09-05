"""
Iteration 65: Verify STOREFRONT_PER_COMPANY=true (flag-ON) end-to-end on LIVE prod.
SAFE MODE: only allowed writes are PUT /api/user/creator/profile under X-Company-Id: 62 (KLOSE).
Main agent will reset company 62 handle to NULL post-run.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("NEXT_PUBLIC_BASE_URL", "https://setup-vault-5.preview.emergentagent.com").rstrip("/")
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="session")
def token():
    # Retry to account for backend cold-start 503 window
    last_err = None
    for i in range(8):
        try:
            r = requests.post(
                f"{BASE_URL}/api/user/login",
                json={"email": EMAIL, "password": PASSWORD},
                timeout=20,
            )
            if r.status_code == 200:
                data = r.json()
                tok = (data.get("data") or {}).get("accessToken") or data.get("accessToken")
                assert tok, f"no accessToken in login body: {data}"
                return tok
            last_err = f"{r.status_code} {r.text[:200]}"
        except Exception as e:
            last_err = str(e)
        time.sleep(3)
    pytest.fail(f"Login failed after retries: {last_err}")


def _headers(token, company_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if company_id is not None:
        h["X-Company-Id"] = str(company_id)
    return h


# ---------- Profile reads: flag-ON must return company-scoped fields, no storefront_pending ----------

class TestCreatorProfileFlagOn:
    def test_profile_company_1_hostbay(self, token):
        r = requests.get(f"{BASE_URL}/api/user/creator/profile", headers=_headers(token, 1), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        # flag-ON: NO storefront_pending
        assert "storefront_pending" not in data, f"flag-ON path should not return storefront_pending: {data}"
        assert data.get("company_id") == 1, data
        assert (data.get("handle") or "").lower() == "hostbay", data
        assert data.get("creator_page_enabled") is True, data

    def test_profile_company_62_klose(self, token):
        r = requests.get(f"{BASE_URL}/api/user/creator/profile", headers=_headers(token, 62), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        assert "storefront_pending" not in data, f"flag-ON path should not return storefront_pending: {data}"
        assert data.get("company_id") == 62, data
        # handle may be None (before claim). After claim (later test) becomes klose-qa-8x3.
        # But this test always runs first alphabetically vs claim test; still tolerate either.
        h = data.get("handle")
        assert h in (None, "", "klose-qa-8x3"), f"unexpected handle: {h}"
        if h in (None, ""):
            assert data.get("creator_page_enabled") in (False, None), data


# ---------- Public storefront resolution ----------

class TestPublicStorefrontResolution:
    def test_public_shop_hostbay(self):
        r = requests.get(f"{BASE_URL}/api/shop/hostbay", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # payload varies; assert no column errors and identifies hostbay
        text = str(body).lower()
        assert "column" not in text or "does not exist" not in text, body
        assert "hostbay" in text, body

    def test_public_pay_creator_hostbay(self):
        r = requests.get(f"{BASE_URL}/api/pay/creator/hostbay", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        text = str(body).lower()
        assert "hostbay" in text, body


# ---------- Uniqueness 409 across companies ----------

class TestHandleUniquenessAcrossCompanies:
    def test_klose_cannot_claim_hostbay(self, token):
        r = requests.put(
            f"{BASE_URL}/api/user/creator/profile",
            headers=_headers(token, 62),
            json={"handle": "hostbay"},
            timeout=15,
        )
        assert r.status_code == 409, f"expected 409 conflict, got {r.status_code}: {r.text}"


# ---------- KLOSE claim its own handle + isolation ----------

CLAIMED_HANDLE = "klose-qa-8x3"


class TestKloseClaimAndIsolation:
    def test_a_klose_claim_handle(self, token):
        r = requests.put(
            f"{BASE_URL}/api/user/creator/profile",
            headers=_headers(token, 62),
            json={"handle": CLAIMED_HANDLE, "creator_page_enabled": True},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        assert data.get("company_id") == 62, data
        assert (data.get("handle") or "").lower() == CLAIMED_HANDLE, data

    def test_b_public_klose_live(self, token):
        # small delay for any caching
        time.sleep(1)
        r = requests.get(f"{BASE_URL}/api/pay/creator/{CLAIMED_HANDLE}", timeout=15)
        assert r.status_code == 200, r.text
        text = str(r.json()).lower()
        assert "klose" in text or CLAIMED_HANDLE in text, r.text

    def test_c_hostbay_still_live_and_isolated(self):
        r = requests.get(f"{BASE_URL}/api/pay/creator/hostbay", timeout=15)
        assert r.status_code == 200, r.text
        text = str(r.json()).lower()
        assert "hostbay" in text, r.text
        assert CLAIMED_HANDLE not in text, "hostbay page must not leak KLOSE identity"

    def test_d_analytics_split_shows_both(self, token):
        r = requests.get(
            f"{BASE_URL}/api/user/creator/analytics/split",
            headers=_headers(token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        companies = data.get("companies") or []
        by_id = {c.get("company_id"): c for c in companies}
        assert 1 in by_id and 62 in by_id, by_id
        assert (by_id[1].get("handle") or "").lower() == "hostbay", by_id[1]
        assert (by_id[62].get("handle") or "").lower() == CLAIMED_HANDLE, by_id[62]
        # hostbay real data
        h1 = by_id[1]
        views = h1.get("views_30d") or h1.get("views") or 0
        tips_amt = h1.get("tips_amount_30d") or h1.get("tips_amount") or 0
        assert float(views) > 0, h1
        assert float(tips_amt) >= 10, h1


# ---------- Products company scoping ----------

class TestProductsScoping:
    def test_products_company_1(self, token):
        r = requests.get(f"{BASE_URL}/api/products", headers=_headers(token, 1), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        items = data if isinstance(data, list) else (data.get("items") or data.get("products") or [])
        assert isinstance(items, list), data

    def test_products_company_62(self, token):
        r = requests.get(f"{BASE_URL}/api/products", headers=_headers(token, 62), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        items = data if isinstance(data, list) else (data.get("items") or data.get("products") or [])
        assert isinstance(items, list), data


# ---------- Regression: tax + wallet still work under flag-ON ----------

class TestFlagOnRegression:
    def test_tax_settings_company_62(self, token):
        r = requests.get(f"{BASE_URL}/api/user/tax-settings", headers=_headers(token, 62), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        data = body.get("data", body)
        src = data.get("source") or (data.get("tax_settings") or {}).get("source")
        # After main-agent reset, expected source='account'. Tolerate 'company' if reset not yet done.
        assert src in ("account", "company"), data

    def test_wallet_all_transactions(self, token):
        r = requests.post(
            f"{BASE_URL}/api/wallet/getAllTransactions",
            headers=_headers(token),
            json={},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
