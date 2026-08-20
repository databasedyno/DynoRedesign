"""
Test suite for Password OTP Bug Fixes (Iteration 13)

Bug Fix 1: POST /api/user/profile/request-password-otp accepts optional { channel: 'email' | 'phone' }
Bug Fix 2: OTP dialog close (X) button overflow fix (frontend only - visual test)
Bug Fix 3: OTP button text changed to 'Verify' and auto-submit on 6 digits (frontend only)

Backend tests for Bug Fix 1 and set-password endpoint.
"""

import pytest
import requests
import redis
import json
import time
import os

# Base URL for API
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
REDIS_URL = "redis://default:REDACTED_REDIS_PASSWORD@nozomi.proxy.rlwy.net:15794"

# Test credentials
TEST_EMAIL = "qa.onboard.1782585233@dynopaytest.com"
TEST_PASSWORD = "QaOnboard#2026"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


@pytest.fixture(scope="module")
def redis_client():
    """Redis client for OTP retrieval"""
    return redis.from_url(REDIS_URL)


@pytest.fixture(scope="module")
def auth_token(redis_client):
    """Get authenticated JWT token via OTP-gated login"""
    # Step 1: Login
    login_resp = requests.post(
        f"{BASE_URL}/api/user/login",
        headers=HEADERS,
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    session = login_data.get('data', {}).get('login_otp_session')
    assert session, "No login_otp_session returned"
    
    # Step 2: Get OTP from Redis
    time.sleep(0.5)  # Small delay for Redis propagation
    otp_data = redis_client.get(f"login_otp:{session}:json")
    assert otp_data, f"No OTP found in Redis for session {session}"
    parsed = json.loads(otp_data)
    otp = parsed.get('otp')
    assert otp, "No OTP in Redis data"
    
    # Step 3: Verify OTP
    verify_resp = requests.post(
        f"{BASE_URL}/api/user/verifyLoginOTP",
        headers=HEADERS,
        json={"login_otp_session": session, "otp": otp}
    )
    assert verify_resp.status_code == 200, f"OTP verification failed: {verify_resp.text}"
    verify_data = verify_resp.json()
    token = verify_data.get('data', {}).get('accessToken')
    assert token, "No accessToken returned"
    
    return token


class TestRequestPasswordOtpEndpoint:
    """Tests for POST /api/user/profile/request-password-otp (Bug Fix 1)"""
    
    def test_request_otp_without_channel_defaults_to_email(self, auth_token):
        """Test that requesting OTP without channel defaults to email"""
        headers = {**HEADERS, "Authorization": f"Bearer {auth_token}"}
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=headers,
            json={}
        )
        assert resp.status_code == 200, f"Request failed: {resp.text}"
        data = resp.json()
        assert data.get('message') == "Verification code sent to your email"
        assert data.get('data', {}).get('sent_via') == "email"
        assert 'masked_contact' in data.get('data', {})
    
    def test_request_otp_with_email_channel(self, auth_token):
        """Test that requesting OTP with channel='email' sends to email"""
        headers = {**HEADERS, "Authorization": f"Bearer {auth_token}"}
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=headers,
            json={"channel": "email"}
        )
        assert resp.status_code == 200, f"Request failed: {resp.text}"
        data = resp.json()
        assert data.get('data', {}).get('sent_via') == "email"
    
    def test_request_otp_with_phone_channel_fallback(self, auth_token):
        """Test that requesting OTP with channel='phone' falls back to email if no phone"""
        # Test user has no phone, so should fall back to email
        headers = {**HEADERS, "Authorization": f"Bearer {auth_token}"}
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=headers,
            json={"channel": "phone"}
        )
        assert resp.status_code == 200, f"Request failed: {resp.text}"
        data = resp.json()
        # Should fall back to email since user has no phone
        assert data.get('data', {}).get('sent_via') == "email"
    
    def test_request_otp_requires_auth(self):
        """Test that requesting OTP without auth fails"""
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=HEADERS,
            json={}
        )
        # Should fail with 401 or 403
        assert resp.status_code in [401, 403], f"Expected auth error, got {resp.status_code}"


class TestSetPasswordEndpoint:
    """Tests for POST /api/user/profile/set-password"""
    
    def test_set_password_with_invalid_otp(self, auth_token):
        """Test that set-password with invalid OTP fails"""
        headers = {**HEADERS, "Authorization": f"Bearer {auth_token}"}
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=headers,
            json={"otp": "000000", "newPassword": "NewPassword#2026"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        data = resp.json()
        assert "Invalid OTP" in data.get('message', '') or "otp" in data.get('message', '').lower()
    
    def test_set_password_requires_auth(self):
        """Test that set-password without auth fails"""
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=HEADERS,
            json={"otp": "123456", "newPassword": "NewPassword#2026"}
        )
        assert resp.status_code in [401, 403], f"Expected auth error, got {resp.status_code}"
    
    def test_set_password_requires_otp_and_password(self, auth_token):
        """Test that set-password requires both otp and newPassword"""
        headers = {**HEADERS, "Authorization": f"Bearer {auth_token}"}
        
        # Missing newPassword
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=headers,
            json={"otp": "123456"}
        )
        assert resp.status_code == 400, f"Expected 400 for missing newPassword, got {resp.status_code}"
        
        # Missing otp
        resp = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=headers,
            json={"newPassword": "NewPassword#2026"}
        )
        assert resp.status_code == 400, f"Expected 400 for missing otp, got {resp.status_code}"


class TestCodeReview:
    """Code review tests to verify bug fixes are in place"""
    
    def test_update_password_has_no_old_password_field(self):
        """Verify UpdatePassword.tsx has no old/current password field"""
        with open('/app/Components/Page/Profile/UpdatePassword.tsx', 'r') as f:
            content = f.read().lower()
        
        # Should NOT contain old password field references
        assert 'oldpassword' not in content, "Found oldPassword reference"
        assert 'currentpassword' not in content, "Found currentPassword reference"
        assert 'old_password' not in content, "Found old_password reference"
        assert 'current_password' not in content, "Found current_password reference"
    
    def test_update_password_has_required_data_testids(self):
        """Verify UpdatePassword.tsx has all required data-testid attributes"""
        with open('/app/Components/Page/Profile/UpdatePassword.tsx', 'r') as f:
            content = f.read()
        
        required_testids = [
            'request-password-otp-btn',
            'choose-email-btn',
            'choose-phone-btn',
            'new-password-input',
            'confirm-password-input',
            'set-password-submit-btn'
        ]
        
        for testid in required_testids:
            assert f'data-testid="{testid}"' in content, f"Missing data-testid: {testid}"
    
    def test_otp_dialog_has_overflow_visible(self):
        """Verify OtpDialog has overflow: visible for close button fix"""
        with open('/app/Components/UI/OtpDialog/index.tsx', 'r') as f:
            content = f.read()
        
        assert 'overflow: "visible"' in content, "Missing overflow: visible in OtpDialog"
    
    def test_otp_dialog_has_verify_label(self):
        """Verify OtpDialog uses 'Verify' as button label"""
        with open('/app/Components/UI/OtpDialog/index.tsx', 'r') as f:
            content = f.read()
        
        # Should have the verify label with fallback
        assert 't("verify")' in content or '"Verify"' in content, "Missing Verify label"
    
    def test_otp_dialog_auto_submit_ignores_submit_disable(self):
        """Verify attemptAutoSubmit only checks loadingFlag, not submitDisable"""
        with open('/app/Components/UI/OtpDialog/index.tsx', 'r') as f:
            content = f.read()
        
        # Find the attemptAutoSubmit function
        import re
        match = re.search(r'const attemptAutoSubmit = React\.useCallback\(\s*\((.*?)\)', content)
        assert match, "Could not find attemptAutoSubmit function"
        
        params = match.group(1)
        # Should have _submitDisable (unused) parameter
        assert '_submitDisable' in params, "submitDisable should be prefixed with _ to indicate unused"


class TestBackendControllerCode:
    """Verify backend controller has the channel parameter handling"""
    
    def test_request_password_otp_accepts_channel(self):
        """Verify requestPasswordOtp function accepts channel from req.body"""
        with open('/app/backend/controller/userController.ts', 'r') as f:
            content = f.read()
        
        # Should have channel extraction from req.body
        assert 'channel' in content, "Missing channel handling in userController"
        # Should have requestPasswordOtp function
        assert 'requestPasswordOtp' in content or 'request-password-otp' in content, "Missing requestPasswordOtp function"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
