"""Backend tests for one-way hashed API key (Phase 1 security).

Scope: company_id=228 QA HashKeys Brand only. Do not touch other brands.
"""
import re
import subprocess
import pytest
import requests

BASE_URL = "https://cred-manager-29.preview.emergentagent.com"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
COMPANY_ID = 228
EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"

STATE = {"token": None, "api_id": None, "prev_key": None}


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"User-Agent": UA, "Content-Type": "application/json"})
    return ses


@pytest.fixture(scope="module")
def owner_headers(s):
    r = s.post(f"{BASE_URL}/api/user/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    tk = r.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {tk}", "X-Company-Id": str(COMPANY_ID),
            "User-Agent": UA, "Content-Type": "application/json"}


def _get_dev_row(s, owner_headers):
    r = s.get(f"{BASE_URL}/api/userApi/getApi?company_id={COMPANY_ID}", headers=owner_headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    all_rows = data.get("all") if isinstance(data, dict) else data
    dev = [x for x in all_rows if x.get("environment") == "development" and x.get("status") == "active"]
    assert dev, f"No active dev key: {all_rows}"
    return dev[0]


# ---------- 1) Regenerate + hash-based auth ----------
def test_1_regenerate_returns_opaque_token(s, owner_headers):
    row = _get_dev_row(s, owner_headers)
    api_id = row["api_id"]
    STATE["api_id"] = api_id
    r = s.post(f"{BASE_URL}/api/userApi/regenerateKey/{api_id}", headers=owner_headers, json={})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    key = data.get("apiKey")
    assert key and key.startswith("dpk_test_"), data
    assert len(key) == 52, f"len={len(key)}"
    assert data.get("environment") == "development"
    assert "key_hash" not in data
    hint = data.get("key_hint") or ""
    assert re.match(r"^dpk_test_.{4}\u2026.{4}$", hint), hint
    STATE["token"] = key


def test_2_new_key_auth_supported_currency(s):
    r = s.get(f"{BASE_URL}/api/user/getSupportedCurrency",
              headers={"x-api-key": STATE["token"], "User-Agent": UA})
    assert r.status_code == 200, r.text


def test_3_create_payment_sandbox_restriction(s):
    r = s.post(f"{BASE_URL}/api/user/createPayment",
               headers={"x-api-key": STATE["token"], "User-Agent": UA, "Content-Type": "application/json"},
               json={"amount": 500, "redirect_uri": "https://example.com/r"})
    assert r.status_code == 400, r.text
    body = r.json()
    code = (body.get("error") or {}).get("code") if isinstance(body.get("error"), dict) else body.get("code")
    assert code == "sandbox_restriction", body


# ---------- 2) Rotation invalidates old ----------
def test_4_rotation_invalidates_old(s, owner_headers):
    old = STATE["token"]
    r = s.post(f"{BASE_URL}/api/userApi/regenerateKey/{STATE['api_id']}", headers=owner_headers, json={})
    assert r.status_code == 200, r.text
    newer = r.json()["data"]["apiKey"]
    assert newer != old
    STATE["token"] = newer
    r2 = s.get(f"{BASE_URL}/api/user/getSupportedCurrency",
               headers={"x-api-key": newer, "User-Agent": UA})
    assert r2.status_code == 200
    r3 = s.get(f"{BASE_URL}/api/user/getSupportedCurrency",
               headers={"x-api-key": old, "User-Agent": UA})
    assert r3.status_code == 401, r3.text
    body = r3.json()
    code = (body.get("error") or {}).get("code") if isinstance(body.get("error"), dict) else body.get("code")
    assert code == "api_key_invalid", body


def test_5_bogus_key(s):
    bogus = "dpk_live_" + ("a" * 43)
    r = s.get(f"{BASE_URL}/api/user/getSupportedCurrency", headers={"x-api-key": bogus, "User-Agent": UA})
    assert r.status_code == 401
    body = r.json()
    code = (body.get("error") or {}).get("code") if isinstance(body.get("error"), dict) else body.get("code")
    assert code == "api_key_invalid", body


def test_6_missing_key(s):
    r = s.get(f"{BASE_URL}/api/user/getSupportedCurrency", headers={"User-Agent": UA})
    assert r.status_code == 401
    body = r.json()
    code = (body.get("error") or {}).get("code") if isinstance(body.get("error"), dict) else body.get("code")
    assert code == "api_key_missing", body


# ---------- 3) List endpoints don't leak ----------
def test_7_getApi_list_no_leak(s, owner_headers):
    r = s.get(f"{BASE_URL}/api/userApi/getApi?company_id={COMPANY_ID}", headers=owner_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    all_rows = data.get("all") if isinstance(data, dict) else data
    assert all_rows
    for row in all_rows:
        assert "apiKey" not in row, f"apiKey leaked: {row}"
        assert "key_hash" not in row, f"key_hash leaked: {row}"
        assert row.get("key_version") == 2, row
        assert row.get("key_hint")
        assert row.get("apiKey_masked") == row.get("key_hint")


def test_8_getApi_by_id_no_leak(s, owner_headers):
    r = s.get(f"{BASE_URL}/api/userApi/getApi/{STATE['api_id']}", headers=owner_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    if isinstance(data, dict) and "all" in data:
        row = data["all"][0]
    elif isinstance(data, list):
        row = data[0]
    else:
        row = data
    assert "apiKey" not in row, row
    assert "key_hash" not in row, row
    assert row.get("key_version") == 2
    assert row.get("key_hint")
    assert row.get("apiKey_masked") == row.get("key_hint")


# ---------- 4) Create flow ----------
def test_9_delete_and_recreate(s, owner_headers):
    r = s.delete(f"{BASE_URL}/api/userApi/deleteApi/{STATE['api_id']}", headers=owner_headers)
    assert r.status_code == 200, r.text
    payload = {"company_id": COMPANY_ID, "api_name": "QA key",
               "base_currency": "USD", "environment": "development"}
    r2 = s.post(f"{BASE_URL}/api/userApi/addApi", headers=owner_headers, json=payload)
    assert r2.status_code == 200, r2.text
    data = r2.json()["data"]
    key = data.get("apiKey")
    assert key and key.startswith("dpk_test_") and len(key) == 52, data
    assert data.get("key_hint")
    assert "key_hash" not in data
    r3 = s.get(f"{BASE_URL}/api/user/getSupportedCurrency",
               headers={"x-api-key": key, "User-Agent": UA})
    assert r3.status_code == 200
    STATE["token"] = key
    new_id = data.get("api_id") or data.get("id")
    if new_id:
        STATE["api_id"] = new_id


def test_10_production_requires_wallet(s, owner_headers):
    payload = {"company_id": COMPANY_ID, "api_name": "QA prod attempt",
               "base_currency": "USD", "environment": "production"}
    r = s.post(f"{BASE_URL}/api/userApi/addApi", headers=owner_headers, json=payload)
    assert r.status_code == 400, r.text
    assert "wallet" in r.text.lower(), r.text


# ---------- 5) DB state ----------
def test_11_db_state():
    out = subprocess.check_output(
        ["node", "scripts/ro_query.js",
         "select \"apiKey\" is null as plaintext_null, length(key_hash) hl, key_version from tbl_api where company_id=228 and status='active'"],
        cwd="/app/backend", text=True)
    assert "true" in out.lower()
    assert "64" in out
    assert re.search(r"\b2\b", out)


def test_12_no_missing_hash():
    out = subprocess.check_output(
        ["node", "scripts/ro_query.js",
         "select count(*) filter (where key_hash is null) as missing_hash from tbl_api"],
        cwd="/app/backend", text=True)
    m = re.search(r"missing_hash\s*\n[-\s|]*\n\s*(\d+)", out)
    assert m and m.group(1) == "0", out
