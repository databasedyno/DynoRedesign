"""
Email Template Refactoring Tests - Iteration 12
Tests for standardized email templates with dark mode support and helper functions.
"""
import pytest
import requests
import os
import redis
import json
import time

# Use localhost:8001 for testing (Python proxy)
BASE_URL = "http://localhost:8001"

# Test credentials
TEST_EMAIL = "qa.onboard.1782585233@dynopaytest.com"
TEST_PASSWORD = "QaOnboard#2026"

# Redis connection for OTP retrieval
REDIS_URL = "redis://default:REDACTED_REDIS_PASSWORD@nozomi.proxy.rlwy.net:15794"

# Required headers
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


@pytest.fixture(scope="module")
def redis_client():
    """Create Redis client for OTP retrieval"""
    return redis.from_url(REDIS_URL, decode_responses=True)


@pytest.fixture(scope="module")
def auth_token(redis_client):
    """Complete login flow and return auth token"""
    # Step 1: Login to get OTP session
    login_response = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers=HEADERS
    )
    
    if login_response.status_code != 200:
        pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    login_data = login_response.json()
    if not login_data.get("data", {}).get("requires_login_otp"):
        pytest.skip("Login did not require OTP as expected")
    
    session_id = login_data["data"]["login_otp_session"]
    
    # Step 2: Get OTP from Redis
    redis_key = f"login_otp:{session_id}:json"
    otp_data_raw = redis_client.get(redis_key)
    
    if not otp_data_raw:
        # Try without :json suffix
        redis_key = f"login_otp:{session_id}"
        otp_data_raw = redis_client.get(redis_key)
    
    if not otp_data_raw:
        pytest.skip(f"Could not retrieve OTP from Redis for session {session_id}")
    
    try:
        otp_data = json.loads(otp_data_raw) if isinstance(otp_data_raw, str) else otp_data_raw
        otp = otp_data.get("otp")
    except:
        pytest.skip(f"Could not parse OTP data: {otp_data_raw}")
    
    if not otp:
        pytest.skip("OTP not found in Redis data")
    
    # Step 3: Verify OTP
    verify_response = requests.post(
        f"{BASE_URL}/api/user/verifyLoginOTP",
        json={"login_otp_session": session_id, "otp": str(otp)},
        headers=HEADERS
    )
    
    if verify_response.status_code != 200:
        pytest.skip(f"OTP verification failed: {verify_response.status_code} - {verify_response.text}")
    
    verify_data = verify_response.json()
    token = verify_data.get("data", {}).get("accessToken")
    
    if not token:
        pytest.skip("No access token in verify response")
    
    return token


class TestLoginFlowEndToEnd:
    """Test login flow works end-to-end"""
    
    def test_login_returns_otp_session(self):
        """Login with valid credentials returns OTP session"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers=HEADERS
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("data", {}).get("requires_login_otp") == True
        assert "login_otp_session" in data.get("data", {})
        print(f"✅ Login returns OTP session: {data['data']['login_otp_session'][:20]}...")
    
    def test_verify_login_otp_success(self, redis_client):
        """Verify login OTP completes login successfully"""
        # Step 1: Login
        login_response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers=HEADERS
        )
        assert login_response.status_code == 200
        session_id = login_response.json()["data"]["login_otp_session"]
        
        # Step 2: Get OTP from Redis
        redis_key = f"login_otp:{session_id}"
        otp_data_raw = redis_client.get(redis_key)
        
        if not otp_data_raw:
            pytest.skip("OTP not found in Redis")
        
        otp_data = json.loads(otp_data_raw) if isinstance(otp_data_raw, str) else otp_data_raw
        otp = otp_data.get("otp")
        
        # Step 3: Verify OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/user/verifyLoginOTP",
            json={"login_otp_session": session_id, "otp": str(otp)},
            headers=HEADERS
        )
        
        assert verify_response.status_code == 200, f"Verify failed: {verify_response.text}"
        data = verify_response.json()
        assert "accessToken" in data.get("data", {}), "No access token returned"
        assert "userData" in data.get("data", {}), "No user data returned"
        print(f"✅ Login OTP verification successful, token received")


class TestLoginActivityAPI:
    """Test login activity endpoints"""
    
    def test_get_login_activity_requires_auth(self):
        """GET /api/user/login-activity requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/user/login-activity",
            headers=HEADERS
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Login activity endpoint requires auth")
    
    def test_get_login_activity_returns_data(self, auth_token):
        """GET /api/user/login-activity returns paginated data"""
        auth_headers = {**HEADERS, "Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/user/login-activity",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "data" in data
        assert "activities" in data["data"]
        # Pagination is nested under 'pagination' key
        assert "pagination" in data["data"]
        assert "page" in data["data"]["pagination"]
        assert "total" in data["data"]["pagination"]
        print(f"✅ Login activity returns {len(data['data']['activities'])} activities")


class TestFlagLoginEndpoint:
    """Test flag login security endpoint"""
    
    def test_flag_login_rejects_missing_token(self):
        """POST /api/user/security/flag-login rejects missing token"""
        response = requests.post(
            f"{BASE_URL}/api/user/security/flag-login",
            json={},
            headers=HEADERS
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Flag login rejects missing token")
    
    def test_flag_login_rejects_invalid_token(self):
        """POST /api/user/security/flag-login rejects invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/user/security/flag-login",
            json={"token": "invalid-token-12345"},
            headers=HEADERS
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Flag login rejects invalid token")
    
    def test_flag_login_is_public_endpoint(self):
        """POST /api/user/security/flag-login is CSRF-exempt (no auth required)"""
        # This endpoint should NOT return 401 or 403 CSRF error
        response = requests.post(
            f"{BASE_URL}/api/user/security/flag-login",
            json={"token": "test-token"},
            headers=HEADERS
        )
        # Should be 400 (missing/invalid) or 404 (not found), NOT 401/403
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print("✅ Flag login is public (CSRF-exempt)")


class TestEmailTemplateCodeQuality:
    """Code quality checks for email template refactoring"""
    
    def test_no_inter_font_in_email_service(self):
        """emailService.ts should not reference 'Inter' font"""
        with open("/app/backend/services/emailService.ts", "r") as f:
            content = f.read()
        
        # Check for Inter font references (case-insensitive)
        inter_count = content.lower().count("'inter'") + content.lower().count('"inter"')
        assert inter_count == 0, f"Found {inter_count} 'Inter' font references"
        print("✅ No 'Inter' font references in emailService.ts")
    
    def test_dyno_pay_greeting_template_not_called(self):
        """dynoPayGreetingTemplate should not be called (only defined)"""
        with open("/app/backend/services/emailService.ts", "r") as f:
            content = f.read()
        
        # Count calls to dynoPayGreetingTemplate (excluding definition and export)
        lines = content.split('\n')
        call_count = 0
        for line in lines:
            # Skip definition line and export line
            if "export const dynoPayGreetingTemplate" in line:
                continue
            if "dynoPayGreetingTemplate," in line:  # export line
                continue
            if "dynoPayGreetingTemplate(" in line:
                call_count += 1
        
        assert call_count == 0, f"Found {call_count} calls to dynoPayGreetingTemplate"
        print("✅ dynoPayGreetingTemplate is not called (only defined for backwards compat)")
    
    def test_helper_functions_exist_in_template(self):
        """All required helper functions exist in emailTemplate.ts"""
        with open("/app/backend/utils/emailTemplate.ts", "r") as f:
            content = f.read()
        
        required_helpers = [
            "warnText", "alertBox", "errorBox", "successBox", "neutralBox",
            "statCard", "twoColumnStats", "feeRow", "feeTotalRow", "feeTable", "mono"
        ]
        
        missing = []
        for helper in required_helpers:
            if f"export const {helper}" not in content:
                missing.append(helper)
        
        assert len(missing) == 0, f"Missing helper functions: {missing}"
        print(f"✅ All {len(required_helpers)} helper functions exist in emailTemplate.ts")
    
    def test_dark_mode_css_classes_exist(self):
        """Dark mode CSS covers all required element types"""
        with open("/app/backend/utils/emailTemplate.ts", "r") as f:
            content = f.read()
        
        required_classes = [
            ".stat-card", ".neutral-box", ".otp-code", ".warn-text",
            ".fee-row", ".fee-total", ".mono"
        ]
        
        missing = []
        for cls in required_classes:
            if cls not in content:
                missing.append(cls)
        
        assert len(missing) == 0, f"Missing dark mode CSS classes: {missing}"
        print(f"✅ All {len(required_classes)} dark mode CSS classes exist")
    
    def test_system_font_stack_used(self):
        """Email templates use system font stack instead of Inter"""
        with open("/app/backend/utils/emailTemplate.ts", "r") as f:
            content = f.read()
        
        # Check for system font stack
        assert "-apple-system" in content, "System font stack not found"
        assert "BlinkMacSystemFont" in content, "BlinkMacSystemFont not found"
        assert "'Segoe UI'" in content, "Segoe UI not found"
        print("✅ System font stack is used in email templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
