"""QA #8 backend: soft-deleted accounts must not be able to log in.

Full lifecycle test against the live preview URL:
  register (email OTP)  ->  set password (forgot-pw OTP)  ->  login OK
  step-up account_delete  ->  DELETE /api/user/account  ->  login MUST fail
  super-admin purge of the throwaway.

Prod DB is shared -- only touches emails prefixed qa_acctdel_.
"""
import os
import time
import json
import subprocess
import requests
import pytest

BASE = "https://secure-passphrase-12.preview.emergentagent.com"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 QA-iter232"}
TS = int(time.time())
EMAIL = f"qa_acctdel_{TS}@example.com"
PASSWORD = "QaAcctDel123@"
FIRST = "QA"
LAST = "AcctDel"

S = requests.Session()
S.headers.update(UA)


@pytest.fixture(scope="module", autouse=True)
def _warmup():
    # Wait for backend to be responsive
    for _ in range(20):
        try:
            r = S.get(f"{BASE}/api/health", timeout=10, headers=UA)
            if r.status_code < 500:
                break
        except Exception:
            pass
        time.sleep(2)
    yield


def _post(path, body=None, headers=None, retries=6):
    h = dict(UA)
    if headers:
        h.update(headers)
    last = None
    for i in range(retries + 1):
        try:
            r = S.post(f"{BASE}{path}", json=body or {}, headers=h, timeout=30)
        except Exception:
            time.sleep(3)
            continue
        if r.status_code < 500 and r.status_code != 429:
            return r
        last = r
        time.sleep(3)
    return last


def _get(path, headers=None):
    h = dict(UA)
    if headers:
        h.update(headers)
    return S.get(f"{BASE}{path}", headers=h, timeout=30)


def _delete(path, body=None, headers=None):
    h = dict(UA)
    if headers:
        h.update(headers)
    return S.delete(f"{BASE}{path}", json=body or {}, headers=h, timeout=30)


def _redis_otp(key):
    out = subprocess.check_output(
        ["node", "/app/backend/scripts/read_redis_key.cjs", key], text=True
    )
    # Script prints the value; sometimes JSON, sometimes plain
    out = out.strip()
    try:
        data = json.loads(out)
        if isinstance(data, dict):
            for k in ("otp", "code", "value"):
                if k in data:
                    return str(data[k])
        return str(data)
    except Exception:
        return out


ACCESS = {"token": None, "user_id": None}


# ---------------------------------------------------------------- register ---
def test_01_register_step1_sends_otp():
    r = _post("/api/user/registerEmail", {"email": EMAIL})
    assert r.status_code == 200, r.text
    assert "verification" in (r.json().get("message") or "").lower()


def test_02_register_verify_otp_returns_token():
    time.sleep(1)
    otp = _redis_otp(f"otp:{EMAIL}")
    assert otp and otp.isdigit(), f"missing OTP redis value: {otp!r}"
    r = _post("/api/user/registerEmail/verify-otp", {
        "email": EMAIL, "otp": otp,
        "first_name": FIRST, "last_name": LAST,
    })
    assert r.status_code == 200, r.text
    data = r.json().get("data") or {}
    tok = data.get("accessToken") or data.get("token")
    assert tok, r.text
    ACCESS["token"] = tok
    ACCESS["user_id"] = data.get("user_id") or (data.get("user") or {}).get("user_id")


# ---------------------------------------------------------------- password --
def test_03_forgot_password_sends_otp():
    r = _post("/api/user/forgot-password", {"email": EMAIL})
    assert r.status_code == 200, r.text


def test_04_forgot_password_verify_returns_reset_token():
    time.sleep(1)
    otp = _redis_otp(f"otp:{EMAIL}")
    assert otp and otp.isdigit(), f"OTP not found: {otp!r}"
    r = _post("/api/user/forgot-password/verify-otp", {"email": EMAIL, "otp": otp})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or {}
    tok = d.get("token") or d.get("resetToken") or d.get("reset_token")
    assert tok, r.text
    ACCESS["reset_token"] = tok


def test_05_reset_password():
    r = _post("/api/user/reset-password", {
        "token": ACCESS["reset_token"], "email": EMAIL, "newPassword": PASSWORD,
    })
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- login ok --
def test_06_login_works_before_delete():
    r = _post("/api/user/login", {"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or {}
    tok = d.get("accessToken") or d.get("token")
    # if 2fa required (shouldn't be — fresh account) skip: capture challenge
    if not tok and d.get("challenge_token"):
        pytest.skip("2fa unexpectedly required")
    assert tok, r.text
    ACCESS["token"] = tok


# --------------------------------------------------------------- soft-delete
def test_07_stepup_account_delete_request_code():
    h = {"Authorization": f"Bearer {ACCESS['token']}"}
    r = _post("/api/stepup/account_delete/request-code", {}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json().get("data") or {}
    otp = d.get("preview_otp")
    assert otp, f"preview_otp missing: {r.text}"
    ACCESS["stepup_otp"] = otp


def test_08_stepup_account_delete_verify():
    h = {"Authorization": f"Bearer {ACCESS['token']}"}
    r = _post("/api/stepup/account_delete/verify",
              {"method": "email", "code": ACCESS["stepup_otp"]}, headers=h)
    assert r.status_code == 200, r.text
    assert (r.json().get("data") or {}).get("active") in (True, None), r.text


def test_09_delete_account_soft_delete():
    h = {"Authorization": f"Bearer {ACCESS['token']}"}
    r = _delete("/api/user/account", {}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json().get("data") or {}
    assert d.get("logout") is True or d.get("scheduled_purge_at"), r.text


# --------------------------------------------------------------- login blocked
def test_10_login_rejected_after_delete():
    r = _post("/api/user/login", {"email": EMAIL, "password": PASSWORD})
    assert r.status_code >= 400 and r.status_code < 500, f"expected 4xx, got {r.status_code} {r.text}"
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    # no tokens leaked
    d = body.get("data") or {}
    assert not d.get("accessToken"), r.text
    assert not d.get("challenge_token"), r.text
    msg = (body.get("message") or body.get("error") or "").lower()
    assert any(k in msg for k in ("deleted", "deactivat", "not found", "credentials", "invalid")), r.text


# --------------------------------------------------------------- purge -----
ADMIN = {"email": "moxxcompany@gmail.com", "password": "Katiekendra123@"}


def test_11_admin_purge_deleted_account():
    r = _post("/api/admin/login", ADMIN)
    assert r.status_code == 200, r.text
    tok = (r.json().get("data") or {}).get("accessToken") or (r.json().get("data") or {}).get("token")
    assert tok, r.text
    h = {"Authorization": f"Bearer {tok}"}
    lst = _get("/api/admin/deleted-accounts", headers=h)
    assert lst.status_code == 200, lst.text
    body = lst.json().get("data")
    if isinstance(body, dict):
        items = body.get("accounts") or body.get("items") or []
    elif isinstance(body, list):
        items = body
    else:
        items = []
    found = None
    for it in items:
        if (it.get("email") or "").lower() == EMAIL.lower():
            found = it
            break
    assert found, f"our deleted account not listed: {EMAIL}"
    uid = found.get("user_id") or found.get("id")
    p = _post(f"/api/admin/deleted-accounts/{uid}/purge", {}, headers=h)
    assert p.status_code == 200, p.text
