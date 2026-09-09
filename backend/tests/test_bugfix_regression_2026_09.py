"""
Regression tests for DynoPay bugfix pass (Sep 2026):
  - JSON 404 catchall
  - Login + authenticated GETs
  - SSRF guard on webhook-settings PUT
  - OTP brute-force lockout
  - Atomic Redis sliding-window rate limiter (429 on 21st)

Ordering matters: OTP lockout MUST run before the rate-limit exhaustion
test (which burns the strict-limiter 20/15min for the pod IP).
"""
import os
import time
import uuid
import pytest
import requests

BASE = "https://backend-audit-14.preview.emergentagent.com"
INTERNAL = "http://localhost:8001"  # for /health (not routed via /api ingress)

EMAIL = "onarrival21@gmail.com"
PASSWORD = "Katiekendra123@"

TIMEOUT = 30


# ---------- fixtures ----------

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{BASE}/api/user/login",
                     json={"email": EMAIL, "password": PASSWORD},
                     timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    tok = r.json()["data"].get("accessToken")
    assert tok, f"no accessToken in login response: {r.text[:400]}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def company_id(session, auth_headers):
    r = session.get(f"{BASE}/api/company/getCompany", headers=auth_headers, timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    data = r.json().get("data") or r.json().get("companies") or []
    if isinstance(data, dict):
        data = data.get("companies") or data.get("data") or []
    assert data, f"no companies: {r.text[:400]}"
    cid = data[0].get("company_id") or data[0].get("id")
    assert cid, f"no company_id key: {data[0]}"
    return cid


# ---------- 1. health (internal, /health is NOT under /api) ----------

class TestHealth:
    def test_health_internal(self, session):
        r = session.get(f"{INTERNAL}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        j = r.json()
        assert j.get("status") == "healthy"
        assert j.get("database") == "connected"
        assert j.get("redis") == "connected"


# ---------- 2. JSON 404 catchall ----------

class TestJson404:
    def test_unknown_api_route_returns_json_404(self, session):
        r = session.get(f"{BASE}/api/this-route-does-not-exist-{uuid.uuid4().hex[:6]}",
                        timeout=TIMEOUT)
        assert r.status_code == 404
        ct = r.headers.get("content-type", "")
        assert "application/json" in ct, f"expected JSON, got {ct}; body: {r.text[:200]}"
        j = r.json()
        assert j.get("success") is False
        assert j.get("statusCode") == 404
        assert "not found" in str(j.get("message", "")).lower()


# ---------- 3. Login (also implicitly tested by token fixture) ----------

class TestLogin:
    def test_login_returns_access_token(self, token):
        assert isinstance(token, str) and len(token) > 20


# ---------- 4. Authenticated read endpoints ----------

class TestAuthenticatedGets:
    @pytest.mark.parametrize("path_tmpl", [
        "/api/company/getCompany",
        "/api/user/profile",
        "/api/notifications/unread-count",
    ])
    def test_no_company_id_gets(self, session, auth_headers, path_tmpl):
        r = session.get(f"{BASE}{path_tmpl}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"{path_tmpl}: {r.status_code} {r.text[:200]}"
        assert "application/json" in r.headers.get("content-type", "")

    @pytest.mark.parametrize("path_tmpl", [
        "/api/wallet/getWallet?company_id={cid}",
        "/api/dashboard?company_id={cid}",
        "/api/dashboard/recent-transactions?company_id={cid}",
        "/api/dashboard/fee-tiers?company_id={cid}",
        "/api/kyc/status?company_id={cid}",
        "/api/userApi/getApi?company_id={cid}",
        "/api/pay/getPaymentLinks?company_id={cid}",
    ])
    def test_company_scoped_gets(self, session, auth_headers, company_id, path_tmpl):
        url = f"{BASE}{path_tmpl.format(cid=company_id)}"
        r = session.get(url, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"{path_tmpl}: {r.status_code} {r.text[:200]}"
        assert "application/json" in r.headers.get("content-type", "")


# ---------- 5. SSRF guard on webhook-settings PUT (READ-ONLY: only sends BAD urls) ----------

class TestSsrfGuard:
    def _put(self, session, auth_headers, company_id, url):
        return session.put(
            f"{BASE}/api/company/webhook-settings/{company_id}",
            headers=auth_headers,
            json={"webhook_url": url},
            timeout=TIMEOUT,
        )

    def test_link_local_metadata_blocked(self, session, auth_headers, company_id):
        r = self._put(session, auth_headers, company_id, "http://169.254.169.254/latest/meta-data")
        # if 403 for permission reasons -> report but not fail per spec
        if r.status_code == 403:
            pytest.skip(f"403 permission (not SSRF): {r.text[:200]}")
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"
        msg = str(r.json()).lower()
        assert "private" in msg or "local" in msg, f"unexpected msg: {msg[:200]}"

    def test_private_10_net_blocked(self, session, auth_headers, company_id):
        r = self._put(session, auth_headers, company_id, "http://10.0.0.5/hook")
        if r.status_code == 403:
            pytest.skip(f"403 permission (not SSRF): {r.text[:200]}")
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"
        msg = str(r.json()).lower()
        assert "private" in msg or "local" in msg

    def test_non_http_scheme_blocked(self, session, auth_headers, company_id):
        r = self._put(session, auth_headers, company_id, "ftp://example.com/x")
        if r.status_code == 403:
            pytest.skip(f"403 permission (not SSRF): {r.text[:200]}")
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"
        msg = str(r.json()).lower()
        assert "http" in msg  # 'must use http or https'


# ---------- 6. OTP brute-force lockout (real merchant email but READ-ONLY effect) ----------
# Note: this consumes 1 strict-limiter hit on /forgot-password and 6 hits on
# /forgot-password/verify-otp (its own otpRateLimiter 10/15min per ip+email).

class TestOtpLockout:
    def test_otp_lockout_sequence(self, session):
        # (a) initiate
        r = session.post(f"{BASE}/api/user/forgot-password",
                         json={"email": EMAIL}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert "otp" in str(body).lower() or "email" in str(body).lower()

        # (b) 4 wrong attempts -> "Invalid OTP. Please try again."
        for i in range(4):
            r = session.post(f"{BASE}/api/user/forgot-password/verify-otp",
                             json={"email": EMAIL, "otp": "000000"}, timeout=TIMEOUT)
            assert r.status_code == 400, f"attempt {i+1}: {r.status_code} {r.text[:200]}"
            m = str(r.json().get("message", "")).lower()
            assert "invalid otp" in m, f"attempt {i+1} msg: {m}"

        # (c) 5th wrong -> "Too many incorrect attempts..."
        r = session.post(f"{BASE}/api/user/forgot-password/verify-otp",
                         json={"email": EMAIL, "otp": "000000"}, timeout=TIMEOUT)
        assert r.status_code == 400
        m5 = str(r.json().get("message", "")).lower()
        assert "too many" in m5, f"5th msg: {m5}"

        # (d) 6th -> "OTP expired or not found..."
        r = session.post(f"{BASE}/api/user/forgot-password/verify-otp",
                         json={"email": EMAIL, "otp": "000000"}, timeout=TIMEOUT)
        assert r.status_code == 400
        m6 = str(r.json().get("message", "")).lower()
        assert "expired" in m6 or "not found" in m6, f"6th msg: {m6}"


# ---------- 7. Atomic Redis sliding-window rate limiter (LAST — burns 20/15min) ----------

class TestRateLimiter:
    def test_429_after_20_forgot_password_hits(self, session):
        probe_email = f"rl-probe-{uuid.uuid4().hex[:8]}@example.com"
        limit_seen = None
        remaining_prev = None
        reset_seen = None
        last_status = None
        last_body = None
        got_429 = False
        retry_after_hdr = None

        # We've already consumed 1 hit from OTP test above for onarrival21@gmail.com.
        # Fire up to 30 more to guarantee 429 regardless of prior session count.
        for i in range(1, 31):
            r = session.post(f"{BASE}/api/user/forgot-password",
                             json={"email": probe_email}, timeout=TIMEOUT)
            last_status = r.status_code
            last_body = r.text[:200]
            lim = r.headers.get("X-RateLimit-Limit")
            rem = r.headers.get("X-RateLimit-Remaining")
            rst = r.headers.get("X-RateLimit-Reset")
            if lim is not None:
                limit_seen = lim
            if rem is not None:
                if remaining_prev is not None:
                    # decreasing (allow equal on 0 boundary)
                    assert int(rem) <= int(remaining_prev), \
                        f"remaining not decreasing: {remaining_prev} -> {rem}"
                remaining_prev = rem
            if rst is not None:
                reset_seen = rst
            if r.status_code == 429:
                got_429 = True
                retry_after_hdr = r.headers.get("Retry-After")
                try:
                    j = r.json()
                    assert "too many" in str(j.get("error", "")).lower() \
                        or "too many" in str(j.get("message", "")).lower(), \
                        f"429 body: {j}"
                    assert "retryAfter" in j or "retry_after" in j or retry_after_hdr, \
                        f"no retryAfter in 429 body/headers: {j}"
                except ValueError:
                    pytest.fail(f"429 body not JSON: {r.text[:200]}")
                break

        assert limit_seen == "20", f"X-RateLimit-Limit expected 20, got {limit_seen}"
        assert got_429, f"never hit 429 in 30 tries. last={last_status} body={last_body}"
        assert retry_after_hdr is not None, "Retry-After header missing on 429"
        assert reset_seen is not None, "X-RateLimit-Reset never appeared"
