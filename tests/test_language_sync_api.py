"""Backend tests: account language persistence (cross-device sync source of truth).

Covers: POST /api/user/login (JWT, no OTP), GET /api/user/profile (data.language),
PUT /api/user/profile {language} idempotency + validation.
NOTE: runs against the user's LIVE account (explicitly authorized). Only the
`language` field is touched and it is restored to 'en' at the end.
"""

import os

import pytest
import requests
from dotenv import dotenv_values

env = dotenv_values("/app/.env")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or env.get("NEXT_PUBLIC_BASE_URL")
)
if not base_url:
    raise RuntimeError("Base URL missing from env")
BASE_URL = base_url.rstrip("/")

EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=60,
    )
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("data", {}).get("accessToken")
    if not tok:
        pytest.fail(f"no accessToken in login response: {r.text[:300]}")
    return tok


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def get_language(client):
    r = client.get(f"{BASE_URL}/api/user/profile", timeout=60)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    assert "data" in body
    return body["data"].get("language")


# --- login ---
def test_login_returns_jwt_no_otp(token):
    assert isinstance(token, str) and len(token) > 20


# --- profile read ---
def test_profile_returns_language(client):
    lang = get_language(client)
    assert lang in ["en", "pt", "fr", "es", "de", "nl"], f"unexpected language {lang}"


def test_profile_requires_auth():
    r = requests.get(f"{BASE_URL}/api/user/profile", timeout=60)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# --- FIX 2b: idempotent language-only PUT ---
def test_put_same_language_is_idempotent(client):
    r0 = client.put(f"{BASE_URL}/api/user/profile", json={"language": "en"}, timeout=60)
    assert r0.status_code == 200, r0.text[:300]
    r = client.put(f"{BASE_URL}/api/user/profile", json={"language": "en"}, timeout=60)
    assert r.status_code == 200, (
        f"PUT with unchanged language returned {r.status_code}: {r.text[:200]}"
    )
    assert get_language(client) == "en"


# --- FIX 2c: unsupported code rejected with 400 ---
def test_unsupported_language_rejected_400(client):
    before = get_language(client)
    r = client.put(f"{BASE_URL}/api/user/profile", json={"language": "zz"}, timeout=60)
    assert r.status_code == 400, (
        f"expected 400 for unsupported language, got {r.status_code}: {r.text[:200]}"
    )
    assert get_language(client) == before, "unsupported code mutated stored language"


# --- FIX 2d: valid change persists ---
def test_put_language_fr_persists(client):
    r = client.put(f"{BASE_URL}/api/user/profile", json={"language": "fr"}, timeout=60)
    assert r.status_code == 200, r.text[:300]
    assert get_language(client) == "fr"


def test_no_fields_to_update_still_400(client):
    r = client.put(f"{BASE_URL}/api/user/profile", json={}, timeout=60)
    assert r.status_code == 400, f"expected 400 for empty body, got {r.status_code}"


# --- cleanup: restore English ---
def test_zz_restore_language_en(client):
    r = client.put(f"{BASE_URL}/api/user/profile", json={"language": "en"}, timeout=60)
    assert r.status_code == 200, r.text[:300]
    assert get_language(client) == "en"
