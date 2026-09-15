"""Wave 4 emails + notification-preferences round-trip (SAFE MODE).

Covers:
- POST /api/track/visitor is a no-op 200
- Login (email+password) returns accessToken; authenticated /api/user/profile works
- GET/PUT /api/notifications/preferences round-trip for company category 'confirming'
"""
import os
import copy
import pytest
import requests

BASE_URL = "https://passphrase-init.preview.emergentagent.com"
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"
COMPANY_ID = 1


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{BASE_URL}/api/user/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:300]}"
    data = r.json()["data"]
    token = data["accessToken"]
    session.headers["Authorization"] = f"Bearer {token}"
    return {"token": token, "user_id": data["userData"]["user_id"]}


def test_visitor_endpoint_is_no_op_200(session):
    r = session.post(f"{BASE_URL}/api/track/visitor", json={"page": "/"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True


def test_login_returns_token_no_500(session):
    # Fresh session avoids the module fixture side-effects
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/user/login",
               json={"email": EMAIL, "password": PASSWORD},
               timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("data", {}).get("accessToken"), "no accessToken in response"
    assert body["data"]["userData"]["email"] == EMAIL


def test_authenticated_read_endpoint(session, auth):
    # profile is a common authenticated endpoint
    r = session.get(f"{BASE_URL}/api/user/profile", timeout=15)
    # Fallback endpoints if profile doesn't exist
    if r.status_code == 404:
        r = session.get(f"{BASE_URL}/api/user/getUser", timeout=15)
    assert r.status_code == 200, f"auth read failed: {r.status_code} {r.text[:200]}"


def test_notifications_prefs_confirming_roundtrip(session, auth):
    # GET current prefs
    r = session.get(f"{BASE_URL}/api/notifications/preferences?company_id={COMPANY_ID}", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    data = body.get("data", body)
    # Locate company_notification_prefs
    company_prefs = data.get("company_notification_prefs") or {}
    assert isinstance(company_prefs, dict), f"expected company_notification_prefs dict, got {type(company_prefs)}"
    original_categories = copy.deepcopy(company_prefs.get("categories", {}) or {})
    original_confirming = bool(original_categories.get("confirming", False))

    # Build payload: preserve team_fanout + existing categories, flip confirming True
    new_categories = copy.deepcopy(original_categories)
    new_categories["confirming"] = True
    put_payload = {
        "company_id": COMPANY_ID,
        "company_notification_prefs": {
            **({"team_fanout": company_prefs["team_fanout"]} if "team_fanout" in company_prefs else {}),
            "categories": new_categories,
        },
    }
    r = session.put(f"{BASE_URL}/api/notifications/preferences", json=put_payload, timeout=15)
    assert r.status_code == 200, f"PUT true failed: {r.status_code} {r.text[:300]}"

    # GET again
    r = session.get(f"{BASE_URL}/api/notifications/preferences?company_id={COMPANY_ID}", timeout=15)
    assert r.status_code == 200
    after = r.json().get("data", {}).get("company_notification_prefs", {})
    assert after.get("categories", {}).get("confirming") is True, f"confirming did not persist as True: {after}"

    # Restore to original
    restore_categories = copy.deepcopy(original_categories)
    # If confirming wasn't present originally, set it to False explicitly to reset
    if "confirming" not in restore_categories:
        restore_categories["confirming"] = False
    else:
        restore_categories["confirming"] = original_confirming
    restore_payload = {
        "company_id": COMPANY_ID,
        "company_notification_prefs": {
            **({"team_fanout": company_prefs["team_fanout"]} if "team_fanout" in company_prefs else {}),
            "categories": restore_categories,
        },
    }
    r = session.put(f"{BASE_URL}/api/notifications/preferences", json=restore_payload, timeout=15)
    assert r.status_code == 200, f"PUT restore failed: {r.status_code} {r.text[:200]}"

    # Final verify
    r = session.get(f"{BASE_URL}/api/notifications/preferences?company_id={COMPANY_ID}", timeout=15)
    assert r.status_code == 200
    final = r.json().get("data", {}).get("company_notification_prefs", {})
    final_confirming = bool(final.get("categories", {}).get("confirming", False))
    assert final_confirming == original_confirming, \
        f"restore failed: original={original_confirming} final={final_confirming}"
