"""Iter166: Creator stats regression - visit beacon + creator/stats/analytics/split."""
import os
import pytest
import requests

BASE = "https://passphrase-init.preview.emergentagent.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/user/login",
                      json={"email": EMAIL, "password": PASSWORD},
                      headers={"User-Agent": UA, "Content-Type": "application/json"},
                      timeout=30)
    assert r.status_code == 200, f"login {r.status_code}: {r.text[:200]}"
    j = r.json()
    tok = (j.get("data") or {}).get("accessToken") or j.get("accessToken")
    assert tok, f"no token in {j}"
    return tok


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "User-Agent": UA, "Content-Type": "application/json"}


def test_creator_stats(auth_headers):
    r = requests.get(f"{BASE}/api/user/creator/stats?company_id=1", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
    d = r.json().get("data", {})
    print("stats:", d)
    assert d.get("total_visits", 0) > 0, f"expected total_visits > 0, got {d.get('total_visits')}"
    assert d.get("supporters_count") == 4, f"expected 4 supporters, got {d.get('supporters_count')}"
    assert isinstance(d.get("daily_visits"), list) and len(d["daily_visits"]) == 14, f"daily_visits len {len(d.get('daily_visits') or [])}"
    for e in d["daily_visits"]:
        assert "date" in e and "count" in e
    assert "top_referrers" in d


def test_creator_analytics(auth_headers):
    r = requests.get(f"{BASE}/api/user/creator/analytics?company_id=1", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
    d = r.json().get("data", {})
    print("analytics:", d)
    totals = d.get("totals") or {}
    assert totals.get("supporters_lifetime") == 4, f"got {totals.get('supporters_lifetime')}"
    assert totals.get("amount_lifetime") == 40, f"got {totals.get('amount_lifetime')}"
    assert d.get("window_days") == 30


def test_creator_analytics_split(auth_headers):
    r = requests.get(f"{BASE}/api/user/creator/analytics/split", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
    d = r.json().get("data", {})
    print("split:", d)
    companies = d.get("companies") or []
    dev = next((c for c in companies if c.get("company_id") == 1 or c.get("handle") == "devhub"), None)
    assert dev, f"devhub company not found in {companies}"
    assert dev.get("views_30d", 0) >= 6, f"views_30d={dev.get('views_30d')}"
    assert len(dev.get("views_daily") or []) == 30


def test_visit_beacon_browser_ua():
    r = requests.post(f"{BASE}/api/pay/creator/devhub/visit",
                      json={"path": "/devhub", "referrer": ""},
                      headers={"User-Agent": UA, "Content-Type": "application/json"},
                      timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
    j = r.json()
    assert j.get("ok") is True, f"got {j}"
    assert "counted" in j


def test_visit_beacon_bot_ua_not_counted():
    r = requests.post(f"{BASE}/api/pay/creator/devhub/visit",
                      json={"path": "/devhub", "referrer": ""},
                      headers={"User-Agent": "curl/7.68", "Content-Type": "application/json"},
                      timeout=30)
    # bot gate may either return 200 with counted:false, or 403; both should not increment
    if r.status_code == 200:
        j = r.json()
        assert j.get("counted") is False, f"bot UA counted true: {j}"
    else:
        assert r.status_code in (401, 403), f"unexpected {r.status_code}: {r.text[:200]}"
