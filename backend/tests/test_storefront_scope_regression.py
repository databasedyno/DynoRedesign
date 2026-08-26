"""
Regression tests for STOREFRONT_PER_COMPANY feature flag (OFF).
Verifies no 500 'column does not exist' errors and legacy behavior preserved.
READ-ONLY: only login + GET requests.
"""
import os
import pytest
import requests

BASE_URL = "https://checkout-deployment-1.preview.emergentagent.com"
LOCAL_HEALTH = "http://localhost:8001/health"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:400]}"
    body = r.json()
    data = body.get("data") or {}
    tok = data.get("accessToken") or data.get("access_token") or body.get("accessToken")
    assert tok, f"No accessToken in login response: {body}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _get(path, headers=None, extra=None):
    h = dict(headers or {})
    if extra:
        h.update(extra)
    return requests.get(f"{BASE_URL}{path}", headers=h, timeout=30)


def test_health_localhost():
    r = requests.get(LOCAL_HEALTH, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "healthy"
    assert body.get("background_jobs", {}).get("eligible") is False


def test_login_returns_jwt_directly(token):
    assert isinstance(token, str) and len(token) > 20


def test_products_list_with_company_header_ignored(auth_headers):
    r = _get("/api/products", auth_headers, {"X-Company-Id": "1"})
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    body = r.json()
    data = body.get("data") or {}
    items = data.get("items")
    assert isinstance(items, list), f"data.items must be a list, got: {type(items)} body={body}"
    # Ensure no column-does-not-exist error leaked
    assert "column" not in r.text.lower() or "does not exist" not in r.text.lower()


def test_products_categories(auth_headers):
    r = _get("/api/products/categories", auth_headers)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"


def test_creator_profile_new_endpoint(auth_headers):
    r = _get("/api/user/creator/profile", auth_headers)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = (r.json() or {}).get("data") or {}
    assert data.get("handle") == "hostbay", f"handle mismatch: {data}"
    assert data.get("creator_page_enabled") is True, f"creator_page_enabled: {data}"
    assert data.get("company_id") in (None, "null"), f"company_id should be null: {data.get('company_id')}"


def test_creator_check_handle_own(auth_headers):
    r = _get("/api/user/creator/check-handle", auth_headers, extra={})
    # Use params via requests
    r = requests.get(
        f"{BASE_URL}/api/user/creator/check-handle",
        headers=auth_headers,
        params={"handle": "hostbay"},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = (r.json() or {}).get("data") or {}
    assert data.get("available") is True, f"available should be True (own handle): {data}"


def test_public_creator_page():
    r = requests.get(f"{BASE_URL}/api/pay/creator/hostbay", timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = (r.json() or {}).get("data") or {}
    creator = data.get("creator") or {}
    assert creator.get("handle") == "hostbay", f"creator handle: {creator}"


def test_public_shop_by_handle():
    r = requests.get(f"{BASE_URL}/api/shop/hostbay", timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = (r.json() or {}).get("data") or {}
    merchant = data.get("merchant") or {}
    assert merchant.get("handle") == "hostbay", f"merchant handle: {merchant}"
    products = data.get("products")
    assert isinstance(products, list), f"products must be list: {type(products)}"


def test_creator_stats(auth_headers):
    r = _get("/api/user/creator/stats", auth_headers)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = (r.json() or {}).get("data") or {}
    assert data.get("has_handle") is True, f"has_handle: {data}"


def test_creator_analytics(auth_headers):
    r = _get("/api/user/creator/analytics", auth_headers)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"


def test_dashboard_regression(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/dashboard",
        headers=auth_headers,
        params={"company_id": 1},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
