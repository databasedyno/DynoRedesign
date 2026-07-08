#!/usr/bin/env python3
"""
Backend API Testing for Password Login OTP Removal + Fee-Free Welcome Popup
Test Date: 2026-07-08
Base URL: https://a12ec985-3845-48d1-94ff-bae3784d76bd.preview.emergentagent.com/api
Test Account: qa.onboard.1782585233@dynopaytest.com / QaOnboard#2026
"""

import requests
import json
from typing import Dict, Any

BASE_URL = "https://a12ec985-3845-48d1-94ff-bae3784d76bd.preview.emergentagent.com/api"
TEST_EMAIL = "qa.onboard.1782585233@dynopaytest.com"
TEST_PASSWORD = "QaOnboard#2026"
WRONG_PASSWORD = "WrongPass#123"

# User-Agent header as specified
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def add_result(self, test_name: str, passed: bool, details: str):
        self.results.append({
            "test": test_name,
            "status": "✅ PASS" if passed else "❌ FAIL",
            "details": details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        for result in self.results:
            print(f"\n{result['status']} - {result['test']}")
            print(f"   {result['details']}")
        print("\n" + "="*80)
        print(f"TOTAL: {self.passed} passed, {self.failed} failed out of {len(self.results)} tests")
        print("="*80 + "\n")

def get_csrf_token(session: requests.Session) -> str:
    """Get CSRF token from the API"""
    print("\n🔐 Getting CSRF token...")
    response = session.get(f"{BASE_URL}/csrf-token", headers=HEADERS)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        csrf_token = data.get("csrf_token")
        print(f"   CSRF Token: {csrf_token[:20]}..." if csrf_token else "   No token in response")
        print(f"   Cookies: {session.cookies.get_dict()}")
        return csrf_token
    else:
        print(f"   ERROR: {response.text}")
        return None

def test_a_correct_login(session: requests.Session, csrf_token: str, results: TestResults):
    """Test A: POST /api/user/login with correct credentials"""
    print("\n" + "="*80)
    print("TEST A: Login with CORRECT password (Bug Fix Verification)")
    print("="*80)
    
    headers = HEADERS.copy()
    headers["x-csrf-token"] = csrf_token
    
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    print(f"POST {BASE_URL}/user/login")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = session.post(f"{BASE_URL}/user/login", json=payload, headers=headers)
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    try:
        data = response.json()
        
        # Check status code
        if response.status_code != 200:
            results.add_result(
                "Test A: Correct Login",
                False,
                f"Expected 200, got {response.status_code}. Response: {data}"
            )
            return None
        
        # Check message
        message = data.get("message", "")
        if "Login Successful" not in message:
            results.add_result(
                "Test A: Correct Login",
                False,
                f"Expected 'Login Successful!' message, got: {message}"
            )
            return None
        
        # Check userData present
        user_data = data.get("data", {}).get("userData")
        if not user_data:
            results.add_result(
                "Test A: Correct Login",
                False,
                "userData not present in response"
            )
            return None
        
        # Check accessToken present
        access_token = data.get("data", {}).get("accessToken")
        if not access_token:
            results.add_result(
                "Test A: Correct Login",
                False,
                "accessToken not present in response"
            )
            return None
        
        # THE BUG FIX: Check NO requires_login_otp field
        requires_login_otp = data.get("data", {}).get("requires_login_otp")
        login_otp_session = data.get("data", {}).get("login_otp_session")
        
        if requires_login_otp is not None or login_otp_session is not None:
            results.add_result(
                "Test A: Correct Login - BUG FIX",
                False,
                f"❌ BUG NOT FIXED: Found requires_login_otp={requires_login_otp} or login_otp_session={login_otp_session}. Password login should NOT require OTP!"
            )
            return None
        
        results.add_result(
            "Test A: Correct Login - BUG FIX",
            True,
            f"✅ Login successful with direct session. userData present, accessToken present, NO requires_login_otp field. BUG FIXED!"
        )
        
        return access_token
        
    except Exception as e:
        results.add_result(
            "Test A: Correct Login",
            False,
            f"Exception: {str(e)}"
        )
        return None

def test_b_wrong_password(session: requests.Session, csrf_token: str, results: TestResults):
    """Test B: POST /api/user/login with wrong password (ONE attempt only)"""
    print("\n" + "="*80)
    print("TEST B: Login with WRONG password (ONE attempt)")
    print("="*80)
    
    headers = HEADERS.copy()
    headers["x-csrf-token"] = csrf_token
    
    payload = {
        "email": TEST_EMAIL,
        "password": WRONG_PASSWORD
    }
    
    print(f"POST {BASE_URL}/user/login")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = session.post(f"{BASE_URL}/user/login", json=payload, headers=headers)
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    try:
        data = response.json()
        
        # Check status code is 401
        if response.status_code != 401:
            results.add_result(
                "Test B: Wrong Password",
                False,
                f"Expected 401, got {response.status_code}. Response: {data}"
            )
            return
        
        # Check error message contains "Invalid email or password"
        message = data.get("message", "")
        if "Invalid email or password" in message or "remaining attempts" in message.lower():
            results.add_result(
                "Test B: Wrong Password",
                True,
                f"Correctly rejected with 401: {message}"
            )
        else:
            results.add_result(
                "Test B: Wrong Password",
                False,
                f"Got 401 but unexpected message: {message}"
            )
            
    except Exception as e:
        results.add_result(
            "Test B: Wrong Password",
            False,
            f"Exception: {str(e)}"
        )
    
    # Now re-login with CORRECT password to clear failed attempt counter
    print("\n⚠️  Re-logging in with CORRECT password to clear failed attempt counter...")
    payload_correct = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    response_correct = session.post(f"{BASE_URL}/user/login", json=payload_correct, headers=headers)
    print(f"   Re-login Status: {response_correct.status_code}")
    if response_correct.status_code == 200:
        print("   ✅ Failed attempt counter cleared")
    else:
        print(f"   ⚠️  Re-login response: {response_correct.text}")

def test_c_missing_password_and_otp_regression(session: requests.Session, csrf_token: str, results: TestResults):
    """Test C: Missing password + OTP verification regression"""
    print("\n" + "="*80)
    print("TEST C: Missing password + OTP verification regression")
    print("="*80)
    
    headers = HEADERS.copy()
    headers["x-csrf-token"] = csrf_token
    
    # C1: Missing password
    print("\nC1: POST /api/user/login with missing password")
    payload_no_password = {
        "email": TEST_EMAIL
    }
    
    response = session.post(f"{BASE_URL}/user/login", json=payload_no_password, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 400:
        results.add_result(
            "Test C1: Missing Password",
            True,
            f"Correctly returned 400 for missing password"
        )
    else:
        results.add_result(
            "Test C1: Missing Password",
            False,
            f"Expected 400, got {response.status_code}"
        )
    
    # C2: Bogus OTP verification
    print("\nC2: POST /api/user/verifyLoginOTP with bogus session")
    payload_bogus_otp = {
        "login_otp_session": "bogus-session",
        "otp": "123456"
    }
    
    response = session.post(f"{BASE_URL}/user/verifyLoginOTP", json=payload_bogus_otp, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    try:
        data = response.json()
        message = data.get("message", "")
        
        if response.status_code == 400 and ("OTP expired" in message or "invalid session" in message.lower()):
            results.add_result(
                "Test C2: Bogus OTP Verification",
                True,
                f"Correctly returned 400 with message: {message}"
            )
        else:
            results.add_result(
                "Test C2: Bogus OTP Verification",
                False,
                f"Expected 400 with 'OTP expired or invalid session', got {response.status_code}: {message}"
            )
    except Exception as e:
        results.add_result(
            "Test C2: Bogus OTP Verification",
            False,
            f"Exception: {str(e)}"
        )

def test_d_fee_free_status(session: requests.Session, access_token: str, results: TestResults):
    """Test D: GET /api/company/fee-free-status"""
    print("\n" + "="*80)
    print("TEST D: Fee-Free Status Endpoint")
    print("="*80)
    
    if not access_token:
        results.add_result(
            "Test D: Fee-Free Status",
            False,
            "Cannot test - no access token from Test A"
        )
        return
    
    headers = HEADERS.copy()
    headers["Authorization"] = f"Bearer {access_token}"
    
    print(f"GET {BASE_URL}/company/fee-free-status")
    print(f"Authorization: Bearer {access_token[:20]}...")
    
    response = session.get(f"{BASE_URL}/company/fee-free-status", headers=headers)
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    try:
        data = response.json()
        
        if response.status_code != 200:
            results.add_result(
                "Test D: Fee-Free Status",
                False,
                f"Expected 200, got {response.status_code}. Response: {data}"
            )
            return
        
        response_data = data.get("data", {})
        is_fee_free = response_data.get("is_fee_free")
        fee_free_remaining = response_data.get("fee_free_remaining_usd")
        
        # Check is_fee_free is true
        if is_fee_free != True:
            results.add_result(
                "Test D: Fee-Free Status",
                False,
                f"Expected is_fee_free=true, got {is_fee_free}"
            )
            return
        
        # Check fee_free_remaining_usd is 500 or "500.00"
        if fee_free_remaining in [500, "500", "500.00", "500.0"]:
            results.add_result(
                "Test D: Fee-Free Status",
                True,
                f"✅ is_fee_free=true, fee_free_remaining_usd={fee_free_remaining}"
            )
        else:
            results.add_result(
                "Test D: Fee-Free Status",
                False,
                f"Expected fee_free_remaining_usd=500, got {fee_free_remaining}"
            )
            
    except Exception as e:
        results.add_result(
            "Test D: Fee-Free Status",
            False,
            f"Exception: {str(e)}"
        )

def test_e_regression(session: requests.Session, csrf_token: str, results: TestResults):
    """Test E: Regression tests"""
    print("\n" + "="*80)
    print("TEST E: Regression Tests")
    print("="*80)
    
    # E1: GET /api/
    print("\nE1: GET /api/")
    response = session.get(f"{BASE_URL}/", headers=HEADERS)
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        results.add_result(
            "Test E1: GET /api/",
            True,
            "Root endpoint returns 200"
        )
    else:
        results.add_result(
            "Test E1: GET /api/",
            False,
            f"Expected 200, got {response.status_code}"
        )
    
    # E2: POST /api/user/github-signin with fake code
    print("\nE2: POST /api/user/github-signin with fake code")
    headers = HEADERS.copy()
    headers["x-csrf-token"] = csrf_token
    
    payload = {"code": "fake_code"}
    response = session.post(f"{BASE_URL}/user/github-signin", json=payload, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    try:
        data = response.json()
        message = data.get("message", "")
        
        if response.status_code == 401 and "Invalid GitHub authorization code" in message:
            results.add_result(
                "Test E2: GitHub Signin Regression",
                True,
                f"Correctly returned 401: {message}"
            )
        else:
            results.add_result(
                "Test E2: GitHub Signin Regression",
                False,
                f"Expected 401 with 'Invalid GitHub authorization code', got {response.status_code}: {message}"
            )
    except Exception as e:
        results.add_result(
            "Test E2: GitHub Signin Regression",
            False,
            f"Exception: {str(e)}"
        )

def main():
    print("="*80)
    print("BACKEND API TESTING")
    print("Password Login OTP Removal + Fee-Free Welcome Popup")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    print("="*80)
    
    results = TestResults()
    session = requests.Session()
    
    # Get CSRF token
    csrf_token = get_csrf_token(session)
    if not csrf_token:
        print("\n❌ FATAL: Could not get CSRF token. Aborting tests.")
        return
    
    # Run tests
    access_token = test_a_correct_login(session, csrf_token, results)
    test_b_wrong_password(session, csrf_token, results)
    test_c_missing_password_and_otp_regression(session, csrf_token, results)
    test_d_fee_free_status(session, access_token, results)
    test_e_regression(session, csrf_token, results)
    
    # Print summary
    results.print_summary()
    
    # Return exit code
    return 0 if results.failed == 0 else 1

if __name__ == "__main__":
    exit(main())
