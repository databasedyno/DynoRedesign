"""Regression test for Phase 3 donation v2 field mapping in getPaymentLinks
and Phase 3.3 crowdfunding public endpoints (tiers / updates)."""
import os
import json
import requests
import pytest

BASE_URL = "https://settle-engine.preview.emergentagent.com"
LOGIN_EMAIL = "hostbay@moxx.co"
LOGIN_PASSWORD = "Katiekendra123@"
CAMPAIGN_LINK_ID = 77


@pytest.fixture(scope="module")
def token_and_session():
    s = requests.Session()
    # Fetch CSRF token first (some routes require it)
    csrf = s.get(f"{BASE_URL}/api/csrf-token", timeout=30)
    csrf_token = None
    if csrf.status_code == 200:
        try:
            csrf_token = csrf.json().get("csrfToken") or csrf.json().get("data", {}).get("csrfToken")
        except Exception:
            pass
    headers = {"Content-Type": "application/json"}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    resp = s.post(
        f"{BASE_URL}/api/user/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        headers=headers,
        timeout=60,
    )
    print(f"[LOGIN] status={resp.status_code} body={resp.text[:400]}")
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text[:400]}"
    body = resp.json()
    token = body.get("data", {}).get("accessToken")
    assert token, f"No accessToken in login response: {body}"
    return token, s


# ── getPaymentLinks donation v2 field mapping regression ──
def test_get_payment_links_returns_donation_v2_fields(token_and_session):
    token, s = token_and_session
    resp = s.get(
        f"{BASE_URL}/api/pay/getPaymentLinks",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    assert resp.status_code == 200, f"getPaymentLinks failed: {resp.status_code} {resp.text[:400]}"
    body = resp.json()
    links = body.get("data", [])
    assert isinstance(links, list), f"Expected list at data, got {type(links)}"
    print(f"[getPaymentLinks] Total links returned: {len(links)}")

    donation_links = [l for l in links if l.get("link_type") == "donation"]
    print(f"[getPaymentLinks] Donation links: {len(donation_links)}")

    if not donation_links:
        pytest.skip("No donation links in this account; mapping regression not verifiable")

    # Assert every donation link has the donation subobject with the v2 keys
    required_keys = {"story_md", "gallery", "ends_at", "category", "organizer_thanks", "beneficiary"}
    for dl in donation_links:
        assert "donation" in dl, f"donation key missing on link_id={dl.get('link_id')}"
        donation = dl["donation"]
        missing = required_keys - set(donation.keys())
        assert not missing, f"Missing donation v2 keys on link_id={dl.get('link_id')}: {missing}"
        # type check gallery must be a list (mapping guarantees array via Array.isArray fallback)
        assert isinstance(donation["gallery"], list), (
            f"donation.gallery must be list, got {type(donation['gallery'])} on link_id={dl.get('link_id')}"
        )
        print(f"[donation link_id={dl.get('link_id')}] keys OK: story_md={donation['story_md'] is not None}, "
              f"gallery_len={len(donation['gallery'])}, category={donation['category']}, "
              f"ends_at={donation['ends_at']}, beneficiary={donation['beneficiary']}")


# ── Phase 3.3 tiers regression ──
def test_campaign_tiers_public_endpoint():
    resp = requests.get(f"{BASE_URL}/api/pay/campaign/{CAMPAIGN_LINK_ID}/tiers", timeout=60)
    assert resp.status_code == 200, f"tiers failed: {resp.status_code} {resp.text[:400]}"
    body = resp.json()
    tiers = body.get("data", body if isinstance(body, list) else [])
    if isinstance(body, dict) and "tiers" in body:
        tiers = body["tiers"]
    print(f"[tiers] count={len(tiers)} body={json.dumps(body)[:300]}")
    assert isinstance(tiers, list), f"tiers should be list, got {type(tiers)}"
    assert len(tiers) == 5, f"Expected 5 seeded tiers, got {len(tiers)}"


# ── Phase 3.3 updates regression ──
def test_campaign_updates_public_endpoint():
    resp = requests.get(f"{BASE_URL}/api/pay/campaign/{CAMPAIGN_LINK_ID}/updates", timeout=60)
    assert resp.status_code == 200, f"updates failed: {resp.status_code} {resp.text[:400]}"
    body = resp.json()
    updates = body.get("data", body if isinstance(body, list) else [])
    if isinstance(body, dict) and "updates" in body:
        updates = body["updates"]
    print(f"[updates] count={len(updates)} body={json.dumps(body)[:300]}")
    assert isinstance(updates, list), f"updates should be list, got {type(updates)}"
    assert len(updates) == 3, f"Expected 3 seeded updates, got {len(updates)}"
