"""
Profile Settings API Tests
Tests for:
- GET /api/user/profile (has_password field)
- POST /api/user/profile/request-password-otp
- POST /api/user/profile/set-password
- POST /api/user/addEmail
- POST /api/user/addPhone
"""
import pytest
import requests
import os
import json
import time
import subprocess

# Use localhost for testing (via Python proxy on port 8001)
BASE_URL = "http://localhost:8001"

# Test credentials
TEST_EMAIL = "qa.onboard.1782585233@dynopaytest.com"
TEST_PASSWORD = "QaOnboard#2026"

# Required headers
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_otp_from_redis(session_id: str) -> str:
    """Get OTP from Redis using Node.js ioredis"""
    script = f"""
const Redis = require('ioredis');
const redis = new Redis('redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794');
redis.get('login_otp:{session_id}:json').then(data => {{
  if (data) {{
    const parsed = JSON.parse(data);
    console.log(parsed.otp);
  }}
  redis.quit();
}}).catch(err => {{
  console.error('Error:', err);
  redis.quit();
}});
"""
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        cwd='/app/backend'
    )
    return result.stdout.strip()


def get_auth_token():
    """Get authentication token via login + OTP flow"""
    # Step 1: Login
    login_response = requests.post(
        f"{BASE_URL}/api/user/login",
        headers=HEADERS,
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if login_response.status_code == 429:
        pytest.skip(f"Rate limited: {login_response.json().get('message', 'Rate limit exceeded')}")
    
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    login_data = login_response.json().get('data', {})
    
    if login_data.get('requires_login_otp'):
        session_id = login_data.get('login_otp_session')
        
        # Step 2: Get OTP from Redis
        time.sleep(1)  # Wait for Redis to be updated
        otp = get_otp_from_redis(session_id)
        assert otp, f"Failed to get OTP from Redis for session {session_id}"
        
        # Step 3: Verify OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/user/verifyLoginOTP",
            headers=HEADERS,
            json={"login_otp_session": session_id, "otp": otp}
        )
        
        if verify_response.status_code == 429:
            pytest.skip(f"Rate limited on OTP verify: {verify_response.json().get('message', 'Rate limit exceeded')}")
        
        assert verify_response.status_code == 200, f"OTP verification failed: {verify_response.text}"
        verify_data = verify_response.json().get('data', {})
        return verify_data.get('accessToken')
    
    # Direct login (no OTP required)
    return login_data.get('accessToken')


class TestProfileAPI:
    """Test profile-related API endpoints"""
    
    # Use hardcoded token from successful login (valid for 30 days)
    # Token obtained via login + OTP verification for qa.onboard.1782585233@dynopaytest.com
    AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJuYW1lIjoiUUEgT25ib2FyZGluZyBUZXN0ZXIiLCJlbWFpbCI6InFhLm9uYm9hcmQuMTc4MjU4NTIzM0BkeW5vcGF5dGVzdC5jb20iLCJ1c2VybmFtZSI6bnVsbCwibW9iaWxlIjpudWxsLCJwaG90byI6Imh0dHBzOi8vMzE5OWZkMzctMDc1ZC00M2YxLWEwNTItYmE3ZjRhZTgwNjJjLnByZXZpZXcuZW1lcmdlbnRhZ2VudC5jb20vaW1hZ2VzL3VzZXJfZzB2cmJheXExOS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6ZmFsc2UsInJlZmVycmFsX2NvZGUiOiJEWU5PLTc3UVFYRyIsInJlZmVycmFsX2NvdW50IjowLCJyZWZlcnJhbF9ib251c19lYXJuZWQiOiIwLjAwIiwicmVmZXJyZWRfYnlfY29kZSI6bnVsbCwicmVmZXJyZWRfYnlfcmVmZXJlZV9jb2RlIjpudWxsLCJmZWVfZGlzY291bnRfcGVyY2VudCI6IjAuMDAiLCJmZWVfZGlzY291bnRfZXhwaXJlc19hdCI6bnVsbCwiZmVlX2Rpc2NvdW50X3JlYXNvbiI6bnVsbCwiZW1haWxfdmVyaWZpZWQiOnRydWUsImxhc3RfbG9naW5faXAiOiI6OmZmZmY6MTI3LjAuMC4xIiwibGFzdF9jb21wYW55X2lkIjpudWxsLCJjdW11bGF0aXZlX3ZvbHVtZV91c2QiOiIwLjAwIiwiZmVlX2ZyZWVfcmVtYWluaW5nX3VzZCI6IjUwMC4wMCIsImZlZV90aWVyIjoidHJpYWwiLCJjcmVhdGVkQXQiOiIyMDI2LTA2LTI3VDE4OjMzOjU0Ljg2MFoiLCJ1cGRhdGVkQXQiOiIyMDI2LTA2LTI4VDE3OjM4OjA4LjkwMFoiLCJpYXQiOjE3ODI2Njg3MTQsImV4cCI6MTc4NTI2MDcxNH0.bLqEvZ0PDsIzoXZ2Wn057EdO4WAQpGShf6PNWIlnBng"
    
    @pytest.fixture
    def auth_headers(self):
        """Headers with auth token"""
        return {
            **HEADERS,
            "Authorization": f"Bearer {self.AUTH_TOKEN}"
        }
    
    def test_get_profile_returns_has_password(self, auth_headers):
        """Test GET /api/user/profile returns has_password boolean field"""
        response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        data = response.json().get('data', {})
        
        # Verify has_password field exists and is boolean
        assert 'has_password' in data, "has_password field missing from profile response"
        assert isinstance(data['has_password'], bool), f"has_password should be boolean, got {type(data['has_password'])}"
        
        # For our test user, has_password should be True
        assert data['has_password'], "Test user should have has_password=True"
        
        print(f"✓ Profile has_password: {data['has_password']}")
        print(f"✓ Profile email: {data.get('email')}")
        print(f"✓ Profile mobile: {data.get('mobile')}")
    
    def test_request_password_otp_success(self, auth_headers):
        """Test POST /api/user/profile/request-password-otp sends OTP and returns sent_via, masked_contact"""
        response = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=auth_headers
        )
        
        if response.status_code == 429:
            pytest.skip(f"Rate limited: {response.json().get('message', 'Rate limit exceeded')}")
        
        assert response.status_code == 200, f"Request password OTP failed: {response.text}"
        data = response.json().get('data', {})
        
        # Verify response structure
        assert 'sent_via' in data, "sent_via field missing from response"
        assert 'masked_contact' in data, "masked_contact field missing from response"
        
        # sent_via should be 'email' or 'phone'
        assert data['sent_via'] in ['email', 'phone'], f"sent_via should be 'email' or 'phone', got {data['sent_via']}"
        
        # masked_contact should be a non-empty string
        assert isinstance(data['masked_contact'], str), "masked_contact should be a string"
        assert len(data['masked_contact']) > 0, "masked_contact should not be empty"
        
        print(f"✓ OTP sent via: {data['sent_via']}")
        print(f"✓ Masked contact: {data['masked_contact']}")
    
    def test_set_password_rejects_wrong_otp(self, auth_headers):
        """Test POST /api/user/profile/set-password rejects wrong OTP"""
        # First request OTP
        otp_response = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=auth_headers
        )
        
        if otp_response.status_code == 429:
            pytest.skip(f"Rate limited: {otp_response.json().get('message', 'Rate limit exceeded')}")
        
        # Try to set password with wrong OTP
        response = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=auth_headers,
            json={"otp": "000000", "newPassword": "NewPassword#123"}
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400 for wrong OTP, got {response.status_code}: {response.text}"
        
        message = response.json().get('message', '').lower()
        assert 'otp' in message or 'invalid' in message, f"Error message should mention OTP: {message}"
        
        print(f"✓ Wrong OTP correctly rejected: {response.json().get('message')}")
    
    def test_set_password_rejects_weak_password(self, auth_headers):
        """Test POST /api/user/profile/set-password rejects weak password"""
        # First request OTP
        otp_response = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=auth_headers
        )
        
        if otp_response.status_code == 429:
            pytest.skip(f"Rate limited: {otp_response.json().get('message', 'Rate limit exceeded')}")
        
        # Get the actual OTP from Redis
        # For this test, we'll use a weak password with a valid OTP format
        # The password validation should fail before OTP validation
        
        response = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=auth_headers,
            json={"otp": "123456", "newPassword": "weak"}  # Weak password
        )
        
        # Should fail with 400 for weak password
        assert response.status_code == 400, f"Expected 400 for weak password, got {response.status_code}: {response.text}"
        
        message = response.json().get('message', '').lower()
        # Should mention password requirements
        assert any(word in message for word in ['password', 'character', 'uppercase', 'lowercase', 'number', 'special']), \
            f"Error message should mention password requirements: {message}"
        
        print(f"✓ Weak password correctly rejected: {response.json().get('message')}")
    
    def test_add_email_sends_otp(self, auth_headers):
        """Test POST /api/user/addEmail sends OTP to new email"""
        # Use a test email that won't conflict
        test_new_email = f"test.profile.{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/user/addEmail",
            headers=auth_headers,
            json={"email": test_new_email}
        )
        
        if response.status_code == 429:
            pytest.skip(f"Rate limited: {response.json().get('message', 'Rate limit exceeded')}")
        
        assert response.status_code == 200, f"Add email failed: {response.text}"
        
        message = response.json().get('message', '').lower()
        assert 'otp' in message or 'verification' in message or 'sent' in message, \
            f"Response should mention OTP/verification sent: {message}"
        
        print(f"✓ Add email OTP sent: {response.json().get('message')}")
    
    def test_add_email_rejects_invalid_format(self, auth_headers):
        """Test POST /api/user/addEmail rejects invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/user/addEmail",
            headers=auth_headers,
            json={"email": "invalid-email"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid email, got {response.status_code}: {response.text}"
        
        message = response.json().get('message', '').lower()
        assert 'email' in message or 'invalid' in message or 'format' in message, \
            f"Error message should mention email format: {message}"
        
        print(f"✓ Invalid email correctly rejected: {response.json().get('message')}")
    
    def test_add_phone_sends_otp(self, auth_headers):
        """Test POST /api/user/addPhone sends OTP to new phone"""
        # Use a test phone number
        test_phone = "13025141000"  # US format
        
        response = requests.post(
            f"{BASE_URL}/api/user/addPhone",
            headers=auth_headers,
            json={"phone": test_phone}
        )
        
        if response.status_code == 429:
            pytest.skip(f"Rate limited: {response.json().get('message', 'Rate limit exceeded')}")
        
        # Could be 200 (OTP sent) or 503 (SMS service unavailable)
        if response.status_code == 503:
            print(f"⚠ SMS service unavailable: {response.json().get('message')}")
            pytest.skip("SMS service unavailable")
        
        assert response.status_code == 200, f"Add phone failed: {response.text}"
        
        message = response.json().get('message', '').lower()
        assert 'otp' in message or 'verification' in message or 'sent' in message, \
            f"Response should mention OTP/verification sent: {message}"
        
        print(f"✓ Add phone OTP sent: {response.json().get('message')}")
    
    def test_add_phone_rejects_invalid_format(self, auth_headers):
        """Test POST /api/user/addPhone rejects invalid phone format"""
        response = requests.post(
            f"{BASE_URL}/api/user/addPhone",
            headers=auth_headers,
            json={"phone": "123"}  # Too short
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid phone, got {response.status_code}: {response.text}"
        
        message = response.json().get('message', '').lower()
        assert 'phone' in message or 'invalid' in message or 'format' in message or 'digit' in message, \
            f"Error message should mention phone format: {message}"
        
        print(f"✓ Invalid phone correctly rejected: {response.json().get('message')}")


class TestProfileAPINoAuth:
    """Test profile endpoints without authentication"""
    
    def test_profile_requires_auth(self):
        """Test GET /api/user/profile requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers=HEADERS
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Profile endpoint correctly requires authentication (status: {response.status_code})")
    
    def test_request_password_otp_requires_auth(self):
        """Test POST /api/user/profile/request-password-otp requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/user/profile/request-password-otp",
            headers=HEADERS
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Request password OTP endpoint correctly requires authentication (status: {response.status_code})")
    
    def test_set_password_requires_auth(self):
        """Test POST /api/user/profile/set-password requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/user/profile/set-password",
            headers=HEADERS,
            json={"otp": "123456", "newPassword": "Test#123"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Set password endpoint correctly requires authentication (status: {response.status_code})")
    
    def test_add_email_requires_auth(self):
        """Test POST /api/user/addEmail requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/user/addEmail",
            headers=HEADERS,
            json={"email": "test@example.com"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Add email endpoint correctly requires authentication (status: {response.status_code})")
    
    def test_add_phone_requires_auth(self):
        """Test POST /api/user/addPhone requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/user/addPhone",
            headers=HEADERS,
            json={"phone": "13025141000"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Add phone endpoint correctly requires authentication (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
