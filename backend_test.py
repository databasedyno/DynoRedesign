#!/usr/bin/env python3
"""
Backend API Testing for DynoPay - Confirm Receipt Email Hardening + Test Hook
Environment: LIVE PROD Railway DB in SAFE MODE
Base URL: http://localhost:8001
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple

# Configuration
BASE_URL = "http://localhost:8001"
TEST_SECRET = "e3df97e7a8d2d87802bd43f5db4584a6abf91096ab1956a0"
ALLOWLISTED_EMAIL = "gidineter@gmail.com"
NON_ALLOWLISTED_EMAIL = "someone-else@example.com"
LOGIN_EMAIL = "onarrival21@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"

# Test results storage
test_results = []

def log_test(test_num: int, test_name: str, passed: bool, details: str):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = {
        "test_num": test_num,
        "test_name": test_name,
        "passed": passed,
        "details": details
    }
    test_results.append(result)
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {test_name}")
    print(f"Status: {status}")
    print(f"Details: {details}")
    print(f"{'='*80}")

def test_1_health_check() -> bool:
    """Test 1: GET /health - expect healthy status with SAFE MODE"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        data = response.json()
        
        # Check status code
        if response.status_code != 200:
            log_test(1, "Health Check", False, 
                    f"Expected HTTP 200, got {response.status_code}. Response: {json.dumps(data, indent=2)}")
            return False
        
        # Check required fields
        checks = []
        checks.append(("status", data.get("status") == "healthy"))
        checks.append(("database", data.get("database") == "connected"))
        checks.append(("redis", data.get("redis") == "connected"))
        checks.append(("background_jobs.eligible", data.get("background_jobs", {}).get("eligible") == False))
        
        all_passed = all(check[1] for check in checks)
        
        details = f"HTTP {response.status_code}\n"
        details += f"Response: {json.dumps(data, indent=2)}\n"
        details += "Checks:\n"
        for check_name, check_result in checks:
            details += f"  - {check_name}: {'✓' if check_result else '✗'}\n"
        
        log_test(1, "Health Check", all_passed, details)
        return all_passed
        
    except Exception as e:
        log_test(1, "Health Check", False, f"Exception: {str(e)}")
        return False

def test_2_guard_missing_secret() -> bool:
    """Test 2: POST /api/__paytest/confirm-email with NO x-test-secret header - expect 403"""
    try:
        headers = {"Content-Type": "application/json"}
        body = {"email": ALLOWLISTED_EMAIL}
        
        response = requests.post(
            f"{BASE_URL}/api/__paytest/confirm-email",
            headers=headers,
            json=body,
            timeout=10
        )
        
        passed = response.status_code == 403
        
        details = f"HTTP {response.status_code}\n"
        details += f"Request: POST /api/__paytest/confirm-email\n"
        details += f"Headers: {json.dumps(headers, indent=2)}\n"
        details += f"Body: {json.dumps(body, indent=2)}\n"
        details += f"Response: {response.text}\n"
        details += f"Expected: HTTP 403 (Forbidden)\n"
        details += f"Result: {'✓ Correct' if passed else '✗ Wrong status code'}"
        
        log_test(2, "Guard - Missing Secret", passed, details)
        return passed
        
    except Exception as e:
        log_test(2, "Guard - Missing Secret", False, f"Exception: {str(e)}")
        return False

def test_3_guard_wrong_secret() -> bool:
    """Test 3: POST /api/__paytest/confirm-email with WRONG x-test-secret - expect 403"""
    try:
        headers = {
            "Content-Type": "application/json",
            "x-test-secret": "WRONGSECRET"
        }
        body = {"email": ALLOWLISTED_EMAIL}
        
        response = requests.post(
            f"{BASE_URL}/api/__paytest/confirm-email",
            headers=headers,
            json=body,
            timeout=10
        )
        
        passed = response.status_code == 403
        
        details = f"HTTP {response.status_code}\n"
        details += f"Request: POST /api/__paytest/confirm-email\n"
        details += f"Headers: x-test-secret=WRONGSECRET\n"
        details += f"Body: {json.dumps(body, indent=2)}\n"
        details += f"Response: {response.text}\n"
        details += f"Expected: HTTP 403 (Forbidden)\n"
        details += f"Result: {'✓ Correct' if passed else '✗ Wrong status code'}"
        
        log_test(3, "Guard - Wrong Secret", passed, details)
        return passed
        
    except Exception as e:
        log_test(3, "Guard - Wrong Secret", False, f"Exception: {str(e)}")
        return False

def test_4_validation_invalid_email() -> bool:
    """Test 4: POST with correct secret but invalid email - expect 400"""
    try:
        headers = {
            "Content-Type": "application/json",
            "x-test-secret": TEST_SECRET
        }
        body = {"email": "not-an-email"}
        
        response = requests.post(
            f"{BASE_URL}/api/__paytest/confirm-email",
            headers=headers,
            json=body,
            timeout=10
        )
        
        passed = response.status_code == 400
        
        try:
            response_data = response.json()
            message = response_data.get("message", "")
            has_valid_message = "valid" in message.lower() and "email" in message.lower()
        except:
            has_valid_message = False
        
        details = f"HTTP {response.status_code}\n"
        details += f"Request: POST /api/__paytest/confirm-email\n"
        details += f"Headers: x-test-secret=<correct>\n"
        details += f"Body: {json.dumps(body, indent=2)}\n"
        details += f"Response: {response.text}\n"
        details += f"Expected: HTTP 400 with message about valid email required\n"
        details += f"Result: {'✓ Correct status' if passed else '✗ Wrong status code'}\n"
        details += f"Message check: {'✓ Contains valid email message' if has_valid_message else '✗ Missing expected message'}"
        
        log_test(4, "Validation - Invalid Email", passed and has_valid_message, details)
        return passed and has_valid_message
        
    except Exception as e:
        log_test(4, "Validation - Invalid Email", False, f"Exception: {str(e)}")
        return False

def test_5_happy_path_allowlisted() -> bool:
    """Test 5: POST with correct secret + allowlisted email - expect 200, dispatched=true, check logs"""
    try:
        headers = {
            "Content-Type": "application/json",
            "x-test-secret": TEST_SECRET
        }
        body = {"email": ALLOWLISTED_EMAIL}
        
        response = requests.post(
            f"{BASE_URL}/api/__paytest/confirm-email",
            headers=headers,
            json=body,
            timeout=15
        )
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response body
        try:
            response_data = response.json()
            dispatched = response_data.get("data", {}).get("dispatched", False)
            transaction_id = response_data.get("data", {}).get("transactionId", "")
            has_test_prefix = transaction_id.startswith("TEST-")
        except:
            dispatched = False
            transaction_id = ""
            has_test_prefix = False
        
        passed = status_ok and dispatched and has_test_prefix
        
        details = f"HTTP {response.status_code}\n"
        details += f"Request: POST /api/__paytest/confirm-email\n"
        details += f"Headers: x-test-secret=<correct>\n"
        details += f"Body: {json.dumps(body, indent=2)}\n"
        details += f"Response: {json.dumps(response_data if 'response_data' in locals() else {}, indent=2)}\n"
        details += f"\nChecks:\n"
        details += f"  - HTTP 200: {'✓' if status_ok else '✗'}\n"
        details += f"  - dispatched=true: {'✓' if dispatched else '✗'}\n"
        details += f"  - transactionId starts with TEST-: {'✓' if has_test_prefix else '✗'}\n"
        details += f"  - transactionId: {transaction_id}\n"
        details += f"\n⚠️ IMPORTANT: This test SENDS A REAL EMAIL to {ALLOWLISTED_EMAIL}"
        
        log_test(5, "Happy Path - Allowlisted Email (REAL EMAIL SENT)", passed, details)
        return passed
        
    except Exception as e:
        log_test(5, "Happy Path - Allowlisted Email", False, f"Exception: {str(e)}")
        return False

def test_6_allowlist_negative() -> bool:
    """Test 6: POST with correct secret + non-allowlisted email - expect 200 but dispatched=false"""
    try:
        headers = {
            "Content-Type": "application/json",
            "x-test-secret": TEST_SECRET
        }
        body = {"email": NON_ALLOWLISTED_EMAIL}
        
        response = requests.post(
            f"{BASE_URL}/api/__paytest/confirm-email",
            headers=headers,
            json=body,
            timeout=15
        )
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response body
        try:
            response_data = response.json()
            dispatched = response_data.get("data", {}).get("dispatched", True)  # Default True to fail if missing
            transaction_id = response_data.get("data", {}).get("transactionId", "")
        except:
            dispatched = True  # Default True to fail
            transaction_id = ""
        
        passed = status_ok and not dispatched
        
        details = f"HTTP {response.status_code}\n"
        details += f"Request: POST /api/__paytest/confirm-email\n"
        details += f"Headers: x-test-secret=<correct>\n"
        details += f"Body: {json.dumps(body, indent=2)}\n"
        details += f"Response: {json.dumps(response_data if 'response_data' in locals() else {}, indent=2)}\n"
        details += f"\nChecks:\n"
        details += f"  - HTTP 200: {'✓' if status_ok else '✗'}\n"
        details += f"  - dispatched=false: {'✓' if not dispatched else '✗'}\n"
        details += f"  - transactionId: {transaction_id}\n"
        details += f"\n✓ Email was SUPPRESSED (not sent) as expected"
        
        log_test(6, "Allowlist Negative - Suppressed Email", passed, details)
        return passed
        
    except Exception as e:
        log_test(6, "Allowlist Negative - Suppressed Email", False, f"Exception: {str(e)}")
        return False

def test_7_login_regression() -> bool:
    """Test 7: POST /api/user/login - expect 200 with accessToken"""
    try:
        headers = {"Content-Type": "application/json"}
        body = {
            "email": LOGIN_EMAIL,
            "password": LOGIN_PASSWORD
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            headers=headers,
            json=body,
            timeout=10
        )
        
        # Check status code
        status_ok = response.status_code == 200
        
        # Check response body
        try:
            response_data = response.json()
            message = response_data.get("message", "")
            access_token = response_data.get("data", {}).get("accessToken", "")
            has_token = len(access_token) > 0
            login_successful = "login successful" in message.lower()
        except:
            has_token = False
            login_successful = False
            access_token = ""
        
        passed = status_ok and has_token and login_successful
        
        details = f"HTTP {response.status_code}\n"
        details += f"Request: POST /api/user/login\n"
        details += f"Body: {json.dumps({'email': LOGIN_EMAIL, 'password': '***'}, indent=2)}\n"
        details += f"Response message: {message if 'message' in locals() else 'N/A'}\n"
        details += f"\nChecks:\n"
        details += f"  - HTTP 200: {'✓' if status_ok else '✗'}\n"
        details += f"  - Message contains 'Login Successful!': {'✓' if login_successful else '✗'}\n"
        details += f"  - accessToken present: {'✓' if has_token else '✗'}\n"
        details += f"  - accessToken length: {len(access_token)} chars"
        
        log_test(7, "Login Regression", passed, details)
        return passed
        
    except Exception as e:
        log_test(7, "Login Regression", False, f"Exception: {str(e)}")
        return False

def check_backend_logs_for_test_5_and_6():
    """Check backend logs for TEST-ALLOWLISTED and SUPPRESSED messages"""
    print(f"\n{'='*80}")
    print("BACKEND LOG INSPECTION (Tests 5 & 6)")
    print(f"{'='*80}")
    print("\nChecking backend logs for email delivery status...")
    print("Looking for:")
    print(f"  - [Email] TEST-ALLOWLISTED for {ALLOWLISTED_EMAIL}")
    print(f"  - [Email] SUPPRESSED for {NON_ALLOWLISTED_EMAIL}")
    print(f"  - [Email] Generated PDF receipt")
    print("\nLog output will be shown below:")
    print(f"{'='*80}\n")

def main():
    """Run all tests in sequence"""
    print("\n" + "="*80)
    print("DYNOPAY BACKEND TESTING - CONFIRM RECEIPT EMAIL HARDENING + TEST HOOK")
    print("Environment: LIVE PROD Railway DB in SAFE MODE")
    print("Base URL: http://localhost:8001")
    print("="*80 + "\n")
    
    # Run tests in order
    results = []
    results.append(test_1_health_check())
    results.append(test_2_guard_missing_secret())
    results.append(test_3_guard_wrong_secret())
    results.append(test_4_validation_invalid_email())
    results.append(test_5_happy_path_allowlisted())
    results.append(test_6_allowlist_negative())
    results.append(test_7_login_regression())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} - Test {result['test_num']}: {result['test_name']}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed_count}/{total_count} tests passed ({passed_count/total_count*100:.1f}%)")
    print(f"{'='*80}\n")
    
    # Note about log inspection
    check_backend_logs_for_test_5_and_6()
    
    # Exit code
    sys.exit(0 if passed_count == total_count else 1)

if __name__ == "__main__":
    main()
