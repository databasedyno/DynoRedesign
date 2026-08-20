"""
Test Login Activity Features - Iteration 11
Tests for:
- Login activity recording on verifyLoginOTP
- GET /api/user/login-activity (paginated history)
- POST /api/user/security/flag-login (public endpoint)
- Login notification email (fire-and-forget)
"""
import pytest
import requests
import os
import time
import redis

# Backend API base URL - use localhost:8001 for testing (Python proxy)
BASE_URL = "http://localhost:8001"

# Test credentials from test_credentials.md
TEST_EMAIL = "qa.onboard.1782585233@dynopaytest.com"
TEST_PASSWORD = "QaOnboard#2026"

# Redis connection for OTP retrieval
REDIS_URL = "redis://default:REDACTED_REDIS_PASSWORD@nozomi.proxy.rlwy.net:15794"

# Required User-Agent header
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


@pytest.fixture(scope="module")
def redis_client():
    """Redis client for OTP retrieval"""
    return redis.from_url(REDIS_URL, decode_responses=True)


@pytest.fixture(scope="module")
def api_session():
    """Shared requests session with required headers"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    })
    return session


@pytest.fixture(scope="module")
def auth_token(api_session, redis_client):
    """
    Perform full login flow to get auth token.
    This also triggers login activity recording.
    """
    # Step 1: POST /api/user/login to get login_otp_session
    login_resp = api_session.post(f"{BASE_URL}/api/user/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    
    if login_resp.status_code == 429:
        pytest.skip("Rate limited - too many login attempts. Wait 15 minutes.")
    
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    
    assert login_data.get("data", {}).get("requires_login_otp") == True, "Expected OTP-gated login"
    login_otp_session = login_data["data"]["login_otp_session"]
    
    # Step 2: Get OTP from Redis
    # Try both key formats (with and without :json suffix)
    redis_key = f"login_otp:{login_otp_session}"
    redis_key_json = f"login_otp:{login_otp_session}:json"
    import json
    otp_data_raw = redis_client.get(redis_key) or redis_client.get(redis_key_json)
    
    if not otp_data_raw:
        pytest.skip("Could not retrieve OTP from Redis - session may have expired")
    
    otp_data = json.loads(otp_data_raw) if isinstance(otp_data_raw, str) else otp_data_raw
    otp = otp_data.get("otp")
    
    assert otp, "OTP not found in Redis data"
    
    # Step 3: POST /api/user/verifyLoginOTP
    verify_resp = api_session.post(f"{BASE_URL}/api/user/verifyLoginOTP", json={
        "login_otp_session": login_otp_session,
        "otp": otp,
    })
    
    assert verify_resp.status_code == 200, f"OTP verification failed: {verify_resp.text}"
    verify_data = verify_resp.json()
    
    token = verify_data.get("data", {}).get("accessToken")
    assert token, "No access token returned"
    
    return token


class TestLoginActivityRecording:
    """Tests for login activity being recorded on successful login"""
    
    def test_login_records_activity(self, api_session, auth_token):
        """
        Verify that login activity is recorded after verifyLoginOTP.
        The auth_token fixture already performed a login, so we should have at least one entry.
        """
        api_session.headers["Authorization"] = f"Bearer {auth_token}"
        
        resp = api_session.get(f"{BASE_URL}/api/user/login-activity?page=1&limit=5")
        assert resp.status_code == 200, f"Failed to get login activity: {resp.text}"
        
        data = resp.json().get("data", {})
        activities = data.get("activities", [])
        
        assert len(activities) > 0, "Expected at least one login activity entry"
        
        # Verify the most recent entry has expected fields
        latest = activities[0]
        assert "id" in latest, "Missing id field"
        assert "ip_address" in latest, "Missing ip_address field"
        assert "device" in latest, "Missing device field"
        assert "browser" in latest, "Missing browser field"
        assert "os" in latest, "Missing os field"
        assert "location" in latest, "Missing location field (can be null)"
        assert "flagged" in latest, "Missing flagged field"
        assert "login_at" in latest, "Missing login_at field"
        
        print(f"✓ Login activity recorded: {latest['device']} / {latest['browser']} / {latest['os']}")
        print(f"  IP: {latest['ip_address']}, Location: {latest['location']}")


class TestGetLoginActivity:
    """Tests for GET /api/user/login-activity endpoint"""
    
    def test_get_login_activity_requires_auth(self, api_session):
        """Verify endpoint requires authentication"""
        # Remove auth header
        headers = {"Content-Type": "application/json", "User-Agent": USER_AGENT}
        resp = requests.get(f"{BASE_URL}/api/user/login-activity", headers=headers)
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print("✓ GET /api/user/login-activity requires auth (401 without token)")
    
    def test_get_login_activity_returns_paginated_data(self, api_session, auth_token):
        """Verify paginated response structure"""
        api_session.headers["Authorization"] = f"Bearer {auth_token}"
        
        resp = api_session.get(f"{BASE_URL}/api/user/login-activity?page=1&limit=10")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        
        data = resp.json().get("data", {})
        
        # Check pagination structure
        pagination = data.get("pagination", {})
        assert "page" in pagination, "Missing page in pagination"
        assert "limit" in pagination, "Missing limit in pagination"
        assert "total" in pagination, "Missing total in pagination"
        assert "totalPages" in pagination, "Missing totalPages in pagination"
        
        assert pagination["page"] == 1
        assert pagination["limit"] == 10
        
        print(f"✓ Pagination: page={pagination['page']}, limit={pagination['limit']}, total={pagination['total']}")
    
    def test_get_login_activity_fields(self, api_session, auth_token):
        """Verify each activity entry has required fields"""
        api_session.headers["Authorization"] = f"Bearer {auth_token}"
        
        resp = api_session.get(f"{BASE_URL}/api/user/login-activity?page=1&limit=20")
        assert resp.status_code == 200
        
        activities = resp.json().get("data", {}).get("activities", [])
        
        required_fields = ["id", "ip_address", "device", "browser", "os", "location", "flagged", "login_at"]
        
        for activity in activities:
            for field in required_fields:
                assert field in activity, f"Missing field '{field}' in activity {activity.get('id')}"
        
        print(f"✓ All {len(activities)} activities have required fields")


class TestFlagLogin:
    """Tests for POST /api/user/security/flag-login endpoint"""
    
    def test_flag_login_rejects_missing_token(self, api_session):
        """Verify endpoint rejects request without token"""
        resp = api_session.post(f"{BASE_URL}/api/user/security/flag-login", json={})
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✓ flag-login rejects missing token (400)")
    
    def test_flag_login_rejects_invalid_token(self, api_session):
        """Verify endpoint rejects invalid/non-existent token"""
        resp = api_session.post(f"{BASE_URL}/api/user/security/flag-login", json={
            "token": "invalid_token_that_does_not_exist_12345"
        })
        assert resp.status_code == 404, f"Expected 404 for invalid token, got {resp.status_code}"
        
        data = resp.json()
        assert "invalid" in data.get("message", "").lower() or "already" in data.get("message", "").lower()
        print("✓ flag-login rejects invalid token (404)")
    
    def test_flag_login_is_public_endpoint(self, api_session):
        """Verify endpoint doesn't require auth (CSRF-exempt)"""
        # This should return 400 (missing token) or 404 (invalid token), not 401
        resp = api_session.post(f"{BASE_URL}/api/user/security/flag-login", json={
            "token": "test_token_123"
        })
        # Should NOT be 401 (unauthorized) since it's a public endpoint
        assert resp.status_code != 401, "flag-login should be public (CSRF-exempt)"
        assert resp.status_code in [400, 404], f"Expected 400 or 404, got {resp.status_code}"
        print("✓ flag-login is public endpoint (no auth required)")


class TestGetProfile:
    """Tests for GET /api/user/profile - verify has_password field"""
    
    def test_profile_returns_has_password(self, api_session, auth_token):
        """Verify profile endpoint still returns has_password field"""
        api_session.headers["Authorization"] = f"Bearer {auth_token}"
        
        resp = api_session.get(f"{BASE_URL}/api/user/profile")
        assert resp.status_code == 200, f"Failed to get profile: {resp.text}"
        
        data = resp.json().get("data", {})
        
        assert "has_password" in data, "Missing has_password field in profile"
        assert data["has_password"] == True, f"Expected has_password=True for test user, got {data['has_password']}"
        
        print(f"✓ Profile returns has_password: {data['has_password']}")


class TestLoginActivityWithFreshLogin:
    """
    Test that performs a fresh login and verifies the security_token is generated.
    This is needed to test the flag-login flow with a valid token.
    """
    
    def test_fresh_login_creates_activity_with_security_token(self, api_session, redis_client):
        """
        Perform a fresh login and verify activity is created.
        Note: We can't directly access security_token from API (it's not returned),
        but we can verify the activity is created.
        """
        # Step 1: Login
        login_resp = api_session.post(f"{BASE_URL}/api/user/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        
        if login_resp.status_code == 429:
            pytest.skip("Rate limited")
        
        assert login_resp.status_code == 200
        login_otp_session = login_resp.json()["data"]["login_otp_session"]
        
        # Step 2: Get OTP (try both key formats)
        import json
        redis_key = f"login_otp:{login_otp_session}"
        redis_key_json = f"login_otp:{login_otp_session}:json"
        otp_data_raw = redis_client.get(redis_key) or redis_client.get(redis_key_json)
        if not otp_data_raw:
            pytest.skip("OTP not found in Redis")
        
        otp_data = json.loads(otp_data_raw) if isinstance(otp_data_raw, str) else otp_data_raw
        otp = otp_data.get("otp")
        
        # Step 3: Verify OTP (this creates the login activity)
        verify_resp = api_session.post(f"{BASE_URL}/api/user/verifyLoginOTP", json={
            "login_otp_session": login_otp_session,
            "otp": otp,
        })
        
        assert verify_resp.status_code == 200
        token = verify_resp.json()["data"]["accessToken"]
        
        # Step 4: Check login activity was created
        api_session.headers["Authorization"] = f"Bearer {token}"
        activity_resp = api_session.get(f"{BASE_URL}/api/user/login-activity?page=1&limit=1")
        
        assert activity_resp.status_code == 200
        activities = activity_resp.json()["data"]["activities"]
        
        assert len(activities) > 0, "No login activity found after fresh login"
        
        latest = activities[0]
        # Verify it's a recent login (within last minute)
        from datetime import datetime, timezone
        login_time = datetime.fromisoformat(latest["login_at"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff_seconds = (now - login_time).total_seconds()
        
        assert diff_seconds < 120, f"Latest login activity is too old ({diff_seconds}s ago)"
        
        print(f"✓ Fresh login created activity (ID: {latest['id']}, {diff_seconds:.0f}s ago)")
        print(f"  Device: {latest['device']}, Browser: {latest['browser']}, OS: {latest['os']}")


class TestCSRFExemption:
    """Verify flag-login is in CSRF exempt paths"""
    
    def test_flag_login_no_csrf_required(self, api_session):
        """
        Verify POST to flag-login doesn't require CSRF token.
        If CSRF was required, we'd get 403 without the token.
        """
        # Make request without CSRF token
        resp = api_session.post(
            f"{BASE_URL}/api/user/security/flag-login",
            json={"token": "test"},
            headers={
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                # No x-csrf-token header
            }
        )
        
        # Should NOT be 403 (CSRF failure)
        assert resp.status_code != 403, "flag-login should be CSRF-exempt"
        # Should be 404 (invalid token) or 400 (missing token)
        assert resp.status_code in [400, 404]
        print("✓ flag-login is CSRF-exempt (no 403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
