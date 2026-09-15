"""Backend tests for mandatory 2FA + trusted devices + 30-day sessions (iter 177).

Covers:
- Login challenge (email method), validate/resend, dp_device cookie, 30-day JWT
- Trusted devices list/delete
- 2FA enforcement + status endpoints
- Hard-wall: step-up gated route → 403 MFA_ENROLLMENT_REQUIRED; enrol via email; STEPUP_REQUIRED after
- Reset flow (request→confirm) + session/device revocation + wallet freeze + admin unfreeze
"""
import base64
import json
import os
import subprocess
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://passphrase-init.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USER_B_EMAIL = "qa_minorder_p1b@example.com"
USER_B_PASS = "QaMinOrder123@"
USER_B_ID = 221
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASS = "Katiekendra123@"


def _pgq(sql: str):
    """Run write SQL via _pgq helper (safe mode, QA user only)."""
    return subprocess.run(
        ["node", "scripts/_pgq.js", sql],
        cwd="/app/backend", capture_output=True, text=True, timeout=30,
    )


def _login(session: requests.Session, email: str, password: str):
    r = session.post(f"{API}/user/login", json={"email": email, "password": password})
    return r


def _decode_jwt_payload(tok: str):
    parts = tok.split(".")
    padded = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))


# ---------- 1) Fresh login challenge (no cookies), wrong code, resend, validate ----------
@pytest.fixture(scope="module")
def fresh_challenge_data():
    """Login without cookies for user 221; expect email 2FA challenge."""
    s = requests.Session()
    r = _login(s, USER_B_EMAIL, USER_B_PASS)
    assert r.status_code == 200, r.text
    body = r.json()
    data = body.get("data") or body
    return {"session": s, "body": body, "data": data}


def test_login_requires_2fa_email(fresh_challenge_data):
    d = fresh_challenge_data["data"]
    assert d.get("requires_2fa") is True, d
    assert d.get("method") == "email"
    assert d.get("challenge_token"), "challenge_token missing"
    assert d.get("masked_email"), "masked_email missing"
    assert d.get("preview_otp"), "preview_otp missing (DISABLE_OUTBOUND_EMAIL should be true)"
    assert "accessToken" not in d and "accessToken" not in fresh_challenge_data["body"]


def test_wrong_code_returns_401(fresh_challenge_data):
    s = fresh_challenge_data["session"]
    ct = fresh_challenge_data["data"]["challenge_token"]
    r = s.post(f"{API}/user/2fa/validate", json={"challenge_token": ct, "token": "000000"})
    assert r.status_code == 401, r.text


def test_resend_and_immediate_resend_ratelimit(fresh_challenge_data):
    s = fresh_challenge_data["session"]
    ct = fresh_challenge_data["data"]["challenge_token"]
    r1 = s.post(f"{API}/user/2fa/resend", json={"challenge_token": ct})
    assert r1.status_code == 200, r1.text
    body1 = r1.json().get("data") or r1.json()
    assert body1.get("preview_otp")
    fresh_challenge_data["latest_otp"] = body1["preview_otp"]
    # second immediate resend should be rate-limited
    r2 = s.post(f"{API}/user/2fa/resend", json={"challenge_token": ct})
    assert r2.status_code == 429, r2.status_code


def test_validate_with_correct_otp_sets_cookie_and_30d_jwt(fresh_challenge_data):
    s = fresh_challenge_data["session"]
    ct = fresh_challenge_data["data"]["challenge_token"]
    otp = fresh_challenge_data.get("latest_otp") or fresh_challenge_data["data"]["preview_otp"]
    r = s.post(f"{API}/user/2fa/validate", json={"challenge_token": ct, "token": otp})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    assert d.get("accessToken"), d
    assert d.get("refreshToken"), d
    # dp_device cookie
    set_cookie = r.headers.get("set-cookie", "") or r.headers.get("Set-Cookie", "")
    assert "dp_device" in set_cookie.lower(), f"Missing dp_device Set-Cookie: {set_cookie[:400]}"
    # HttpOnly + Path=/api/user + Max-Age ~ 90d (7776000)
    sc_lower = set_cookie.lower()
    assert "httponly" in sc_lower
    assert "path=/api/user" in sc_lower
    # extract Max-Age
    import re
    m = re.search(r"max-age=(\d+)", sc_lower)
    if m:
        ma = int(m.group(1))
        assert 7000000 <= ma <= 8000000, ma
    # JWT exp - iat ≈ 30 days
    payload = _decode_jwt_payload(d["accessToken"])
    delta = payload["exp"] - payload["iat"]
    assert 29 * 86400 <= delta <= 31 * 86400, delta
    # persist for later
    fresh_challenge_data["access_token"] = d["accessToken"]
    fresh_challenge_data["cookie_jar"] = s.cookies


# ---------- 2) Re-login WITH cookie ----------
def test_relogin_with_trusted_device_cookie_skips_challenge(fresh_challenge_data):
    s = fresh_challenge_data["session"]  # keeps the dp_device cookie
    r = _login(s, USER_B_EMAIL, USER_B_PASS)
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    assert d.get("requires_2fa") in (None, False)
    assert d.get("accessToken"), d
    fresh_challenge_data["access_token"] = d["accessToken"]


def test_trusted_devices_list_current_true(fresh_challenge_data):
    tok = fresh_challenge_data["access_token"]
    s = fresh_challenge_data["session"]
    r = s.get(f"{API}/user/trusted-devices", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    devices = d.get("devices") if isinstance(d, dict) else d
    if devices is None and isinstance(d, list):
        devices = d
    assert devices and len(devices) >= 1, d
    cur = [x for x in devices if x.get("is_current")]
    assert cur, f"No is_current device in {devices}"
    fresh_challenge_data["current_device_id"] = cur[0].get("id") or cur[0].get("device_id")


def test_delete_specific_device_then_challenge_again(fresh_challenge_data):
    tok = fresh_challenge_data["access_token"]
    s = fresh_challenge_data["session"]
    did = fresh_challenge_data["current_device_id"]
    r = s.delete(f"{API}/user/trusted-devices/{did}", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    # login with same cookie jar → should challenge again
    r2 = _login(s, USER_B_EMAIL, USER_B_PASS)
    d = r2.json().get("data") or r2.json()
    assert d.get("requires_2fa") is True, d
    # validate again to get new token + cookie for downstream
    ct = d["challenge_token"]; otp = d["preview_otp"]
    r3 = s.post(f"{API}/user/2fa/validate", json={"challenge_token": ct, "token": otp})
    assert r3.status_code == 200, r3.text
    fresh_challenge_data["access_token"] = (r3.json().get("data") or r3.json())["accessToken"]


def test_delete_all_devices(fresh_challenge_data):
    tok = fresh_challenge_data["access_token"]
    s = fresh_challenge_data["session"]
    r = s.delete(f"{API}/user/trusted-devices", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text


# ---------- 3) Enforcement + status ----------
def test_enforcement_and_status(fresh_challenge_data):
    tok = fresh_challenge_data["access_token"]
    r1 = requests.get(f"{API}/user/2fa/enforcement", headers={"Authorization": f"Bearer {tok}"})
    assert r1.status_code == 200, r1.text
    d1 = r1.json().get("data") or r1.json()
    assert d1.get("enrolled") is True
    assert d1.get("method") == "email"
    assert d1.get("hard_wall") is False
    r2 = requests.get(f"{API}/user/2fa/status", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200, r2.text
    d2 = r2.json().get("data") or r2.json()
    assert d2.get("enabled") is True
    assert d2.get("method") == "email"


# ---------- 4) Hard wall + re-enrol ----------
def test_hard_wall_flow(fresh_challenge_data):
    # Force hard wall
    res = _pgq("update tbl_user_2fa set is_enabled=false where user_id=221; update tbl_user set mfa_deadline_at=now()-interval '1 day' where user_id=221")
    assert res.returncode == 0, res.stderr
    # Login (no challenge now — not enrolled)
    s = requests.Session()
    r = _login(s, USER_B_EMAIL, USER_B_PASS)
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    assert d.get("requires_2fa") in (None, False), d
    tok = d["accessToken"]
    # Enforcement
    e = requests.get(f"{API}/user/2fa/enforcement", headers={"Authorization": f"Bearer {tok}"}).json()
    ed = e.get("data") or e
    assert ed.get("enrolled") is False and ed.get("hard_wall") is True, ed
    assert ed.get("days_left") == 0
    # Gated wallet route → 403 MFA_ENROLLMENT_REQUIRED
    wr = requests.post(
        f"{API}/wallet/validateWalletAddress",
        headers={"Authorization": f"Bearer {tok}"},
        json={"wallet_type": "BTC", "wallet_address": "bc1qtest"},
    )
    assert wr.status_code == 403, wr.text
    wb = wr.json()
    code = wb.get("code") or (wb.get("data") or {}).get("code") or wb.get("error_code")
    assert code == "MFA_ENROLLMENT_REQUIRED", wb
    # Enrol email baseline
    r1 = requests.post(f"{API}/user/2fa/email/start", headers={"Authorization": f"Bearer {tok}"}, json={})
    assert r1.status_code == 200, r1.text
    otp = (r1.json().get("data") or r1.json()).get("preview_otp")
    assert otp
    r2 = s.post(f"{API}/user/2fa/email/verify", headers={"Authorization": f"Bearer {tok}"}, json={"code": otp})
    assert r2.status_code == 200, r2.text
    v = r2.json().get("data") or r2.json()
    assert isinstance(v.get("backup_codes"), list) and len(v["backup_codes"]) == 10, v
    sc = r2.headers.get("set-cookie", "") or r2.headers.get("Set-Cookie", "")
    assert "dp_device" in sc.lower(), sc
    # Now step-up gate should say STEPUP_REQUIRED not MFA_ENROLLMENT_REQUIRED
    wr2 = requests.post(
        f"{API}/wallet/validateWalletAddress",
        headers={"Authorization": f"Bearer {tok}"},
        json={"wallet_type": "BTC", "wallet_address": "bc1qtest"},
    )
    assert wr2.status_code == 403, wr2.text
    code2 = wr2.json().get("code") or (wr2.json().get("data") or {}).get("code")
    assert code2 == "STEPUP_REQUIRED", wr2.json()
    # Store bearer + cookie jar for reset test
    fresh_challenge_data["hardwall_cookies"] = s.cookies


# ---------- 5) Reset flow ----------
@pytest.fixture(scope="module")
def reset_ctx():
    return {}


def test_reset_request_and_ratelimit(reset_ctx):
    # Fresh no-cookie login to get a challenge_token
    s = requests.Session()
    r = _login(s, USER_B_EMAIL, USER_B_PASS)
    d = r.json().get("data") or r.json()
    assert d.get("requires_2fa") is True, d
    ct = d["challenge_token"]
    otp = d["preview_otp"]
    # reset/request
    r1 = s.post(f"{API}/user/2fa/reset/request", json={"challenge_token": ct})
    assert r1.status_code == 200, r1.text
    b1 = r1.json().get("data") or r1.json()
    assert b1.get("masked_email") and b1.get("preview_token"), b1
    # second within 60s → 429
    r2 = s.post(f"{API}/user/2fa/reset/request", json={"challenge_token": ct})
    assert r2.status_code == 429, r2.status_code
    reset_ctx["preview_token"] = b1["preview_token"]
    # Also obtain a valid bearer via /validate
    r3 = s.post(f"{API}/user/2fa/validate", json={"challenge_token": ct, "token": otp})
    assert r3.status_code == 200, r3.text
    reset_ctx["bearer"] = (r3.json().get("data") or r3.json())["accessToken"]
    reset_ctx["session"] = s


def test_reset_confirm_effects(reset_ctx):
    tok = reset_ctx["bearer"]
    ptok = reset_ctx["preview_token"]
    r = requests.post(f"{API}/user/2fa/reset/confirm",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"token": ptok})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    assert d.get("reset") is True and d.get("method") == "email", d
    assert d.get("wallet_frozen_until"), d
    # Old bearer → 401 (sessions revoked)
    r2 = requests.get(f"{API}/user/2fa/status", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 401, r2.status_code
    # Old cookie → challenge again (devices revoked)
    s = reset_ctx["session"]
    r3 = _login(s, USER_B_EMAIL, USER_B_PASS)
    d3 = r3.json().get("data") or r3.json()
    assert d3.get("requires_2fa") is True, d3
    # Reusing same reset token → 400
    r4 = requests.post(f"{API}/user/2fa/reset/confirm",
                       headers={"Authorization": f"Bearer {tok}"},
                       json={"token": ptok})
    assert r4.status_code in (400, 401), r4.status_code
    # Complete a fresh session for wallet security status check
    ct = d3["challenge_token"]; otp = d3["preview_otp"]
    r5 = s.post(f"{API}/user/2fa/validate", json={"challenge_token": ct, "token": otp})
    assert r5.status_code == 200, r5.text
    reset_ctx["new_bearer"] = (r5.json().get("data") or r5.json())["accessToken"]


def test_wallet_security_status_frozen(reset_ctx):
    tok = reset_ctx["new_bearer"]
    r = requests.get(f"{API}/wallet/security/status", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    assert d.get("frozen") is True, d
    assert d.get("until") or d.get("frozen_until"), d


# ---------- 6) Admin: list events + unfreeze ----------
@pytest.fixture(scope="module")
def admin_bearer():
    r = requests.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    return d.get("accessToken") or d.get("token")


def test_admin_security_events_and_unfreeze(admin_bearer, reset_ctx):
    h = {"Authorization": f"Bearer {admin_bearer}"}
    r = requests.get(f"{API}/admin/security/events", headers=h)
    assert r.status_code == 200, r.text
    d = r.json().get("data") or r.json()
    events = d.get("events") if isinstance(d, dict) else d
    if events is None and isinstance(d, list):
        events = d
    assert events, d
    latest = events[0]
    assert latest.get("event_type") in ("2fa_reset", "2fa-reset") or latest.get("type") in ("2fa_reset",), latest
    assert latest.get("user_id") == USER_B_ID or str(latest.get("user_id")) == str(USER_B_ID)
    assert latest.get("wallet_frozen") is True
    # unfreeze
    r2 = requests.post(f"{API}/admin/security/users/{USER_B_ID}/unfreeze", headers=h)
    assert r2.status_code == 200, r2.text
    # second unfreeze → 409
    r3 = requests.post(f"{API}/admin/security/users/{USER_B_ID}/unfreeze", headers=h)
    assert r3.status_code == 409, r3.status_code
    # new event for unfreeze
    r4 = requests.get(f"{API}/admin/security/events", headers=h)
    d4 = r4.json().get("data") or r4.json()
    ev = d4.get("events") if isinstance(d4, dict) else d4
    ev = ev or d4
    types = [(e.get("event_type") or e.get("type")) for e in ev[:5]]
    assert any("unfroz" in (t or "") or "unfreeze" in (t or "") for t in types), types


# ---------- Teardown: leave user 221 enrolled/email, not hard-walled ----------
def test_zzz_teardown_user_221_state():
    # Ensure 221 is enrolled via email. Fresh login → challenge → validate → email/start+verify if needed.
    s = requests.Session()
    r = _login(s, USER_B_EMAIL, USER_B_PASS)
    d = r.json().get("data") or r.json()
    if d.get("requires_2fa"):
        # Already enrolled — just leave it, but push deadline forward safely
        _pgq("update tbl_user set mfa_deadline_at=now()+interval '30 days' where user_id=221")
        return
    # else re-enrol email
    tok = d.get("accessToken")
    if not tok:
        return
    r1 = requests.post(f"{API}/user/2fa/email/start", headers={"Authorization": f"Bearer {tok}"}, json={})
    otp = (r1.json().get("data") or r1.json()).get("preview_otp")
    if otp:
        requests.post(f"{API}/user/2fa/email/verify", headers={"Authorization": f"Bearer {tok}"}, json={"code": otp})
    _pgq("update tbl_user set mfa_deadline_at=now()+interval '30 days' where user_id=221")
