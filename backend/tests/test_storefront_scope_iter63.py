"""Storefront-per-company flag-OFF scoping tests (iteration 63)
Verifies non-primary company (KLOSE, id=62) gets pending shell and does NOT leak
primary (hostbay, id=1) storefront data.
"""
import os
import pytest
import requests

BASE = "https://dynopay-setup-2.preview.emergentagent.com"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/user/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    j = r.json()
    tok = (j.get("data") or {}).get("accessToken") or j.get("accessToken")
    assert tok, f"no accessToken in login response: {j}"
    return tok


def _h(token, company_id=None):
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if company_id is not None:
        h["X-Company-Id"] = str(company_id)
    return h


# --- Non-primary (KLOSE, company 62) — pending shell, no leak ---

def test_profile_klose_pending(token):
    r = requests.get(f"{BASE}/api/user/creator/profile", headers=_h(token, 62), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("storefront_pending") is True, d
    assert d.get("handle") in (None, "", ), f"handle should be null: {d.get('handle')}"
    assert d.get("creator_page_enabled") is False
    assert d.get("account_handle") == "hostbay"
    assert d.get("primary_company_id") == 1
    assert d.get("company_id") == 62


def test_stats_klose_empty(token):
    r = requests.get(f"{BASE}/api/user/creator/stats", headers=_h(token, 62), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("has_handle") is False, d
    # All-zero stats — check any numeric fields
    for k, v in d.items():
        if isinstance(v, (int, float)):
            assert v == 0, f"expected zero, got {k}={v}"


def test_analytics_klose_empty(token):
    r = requests.get(f"{BASE}/api/user/creator/analytics", headers=_h(token, 62), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("has_handle") is False, d


def test_put_profile_klose_blocked(token):
    r = requests.put(
        f"{BASE}/api/user/creator/profile",
        headers=_h(token, 62),
        json={"bio": "qa test"},
        timeout=30,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:300]}"
    body = r.text.lower()
    assert "doesn't have its own storefront yet" in body or "does not have its own storefront yet" in body or "own storefront yet" in body, r.text[:300]


# --- Primary (hostbay, company 1) regression ---

def test_profile_hostbay_ok(token):
    r = requests.get(f"{BASE}/api/user/creator/profile", headers=_h(token, 1), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("handle") == "hostbay", d
    assert d.get("creator_page_enabled") is True
    assert not d.get("storefront_pending"), d


def test_profile_no_header_defaults_hostbay(token):
    r = requests.get(f"{BASE}/api/user/creator/profile", headers=_h(token), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("handle") == "hostbay", d


def test_stats_hostbay_has_handle(token):
    r = requests.get(f"{BASE}/api/user/creator/stats", headers=_h(token, 1), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("has_handle") is True, d


def test_analytics_hostbay_has_handle(token):
    r = requests.get(f"{BASE}/api/user/creator/analytics", headers=_h(token, 1), timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json().get("data") or {}
    assert d.get("has_handle") is True, d
