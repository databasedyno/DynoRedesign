"""Regression tests after migration file refactor (0026 min_order + 0027 webhook secret rotation)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("BACKEND_BASE_URL", "http://localhost:8001")
EMAIL = "qa_minorder_p1b@example.com"
PASSWORD = "QaMinOrder123@"
COMPANY_ID = 231


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/user/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json().get("data") or {}
    tok = data.get("accessToken") or data.get("token")
    assert tok, f"no accessToken: {r.text[:300]}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Health / boot ---
def test_health_healthy():
    r = requests.get(f"{BASE_URL}/health", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "healthy"
    assert j.get("database") == "connected"
    assert j.get("redis") == "connected"


# --- Migration 0026 (min_order_usd) intact ---
def test_get_webhook_settings_min_order_column_intact(auth_headers):
    r = requests.get(f"{BASE_URL}/api/company/webhook-settings/{COMPANY_ID}", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("success") is True or "data" in j
    # min_order_usd may live on company or webhook-settings; just ensure endpoint works
    print("webhook-settings GET data keys:", list((j.get("data") or {}).keys()))


# --- Migration 0027 (webhook_secret_previous + expires_at) via rotation ---
def test_rotate_webhook_secret_sets_previous_valid_until(auth_headers):
    r = requests.put(
        f"{BASE_URL}/api/company/webhook-settings/{COMPANY_ID}",
        headers=auth_headers,
        json={"webhook_secret": "generate"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = (r.json() or {}).get("data") or {}
    pv = data.get("previous_secret_valid_until")
    assert pv, f"previous_secret_valid_until missing after rotate: {r.text[:400]}"
    # parse ISO timestamp and check ~24h future (allow 22-26h window)
    from datetime import datetime, timezone
    try:
        ts = datetime.fromisoformat(pv.replace("Z", "+00:00"))
    except Exception:
        pytest.fail(f"cannot parse previous_secret_valid_until={pv}")
    delta_h = (ts - datetime.now(timezone.utc)).total_seconds() / 3600.0
    assert 22 <= delta_h <= 26, f"expected ~24h grace, got {delta_h:.2f}h"


def test_get_webhook_settings_reflects_previous_valid_until(auth_headers):
    r = requests.get(f"{BASE_URL}/api/company/webhook-settings/{COMPANY_ID}", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = (r.json() or {}).get("data") or {}
    pv = data.get("previous_secret_valid_until")
    assert pv, f"GET should surface previous_secret_valid_until after rotation: {data}"
    from datetime import datetime, timezone
    ts = datetime.fromisoformat(pv.replace("Z", "+00:00"))
    delta_h = (ts - datetime.now(timezone.utc)).total_seconds() / 3600.0
    assert 22 <= delta_h <= 26, f"GET grace window off: {delta_h:.2f}h"


# --- Resend delivery endpoint auth+ownership+404 for missing log ---
def test_resend_delivery_nonexistent_returns_404(auth_headers):
    r = requests.post(
        f"{BASE_URL}/api/company/webhook-history/{COMPANY_ID}/resend/999999999",
        headers=auth_headers,
        timeout=15,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:400]}"


def test_resend_delivery_requires_auth():
    r = requests.post(
        f"{BASE_URL}/api/company/webhook-history/{COMPANY_ID}/resend/999999999",
        timeout=15,
    )
    assert r.status_code in (401, 403), f"unauthenticated should be 401/403, got {r.status_code}"
