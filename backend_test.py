#!/usr/bin/env python3
"""
Backend API Test Suite for GitHub OAuth Sign-In
Tests the new GitHub OAuth endpoint with CSRF protection
"""

import requests
import json
import sys

# Base URL from the test request
BASE_URL = "https://a12ec985-3845-48d1-94ff-bae3784d76bd.preview.emergentagent.com/api"

# User-Agent header as specified in the test request
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def print_test_header(test_name):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(passed, message, details=None):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {details}")

def get_csrf_token():
    """Get CSRF token from the API"""
    print_test_header("Getting CSRF Token")
    try:
        response = requests.get(
            f"{BASE_URL}/csrf-token",
            headers={"User-Agent": USER_AGENT},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            csrf_token = data.get("csrf_token")
            cookies = response.cookies
            
            if csrf_token and "dynopay_csrf" in cookies:
                print_result(True, f"CSRF token obtained: {csrf_token[:20]}...")
                return csrf_token, cookies
            else:
                print_result(False, "CSRF token or cookie missing in response", data)
                return None, None
        else:
            print_result(False, f"Failed to get CSRF token: {response.status_code}", response.text)
            return None, None
    except Exception as e:
        print_result(False, f"Exception getting CSRF token: {str(e)}")
        return None, None

def test_case_a(csrf_token, cookies):
    """
    Test Case A: POST /api/user/github-signin with empty body
    Expected: 400 "GitHub authorization code is required"
    """
    print_test_header("Case A: Empty body (no code)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/user/github-signin",
            json={},
            headers={
                "User-Agent": USER_AGENT,
                "x-csrf-token": csrf_token,
                "Content-Type": "application/json"
            },
            cookies=cookies,
            timeout=10
        )
        
        status_code = response.status_code
        try:
            response_data = response.json()
            message = response_data.get("message", "")
        except:
            message = response.text
        
        expected_status = 400
        expected_message = "GitHub authorization code is required"
        
        passed = (status_code == expected_status and expected_message in message)
        
        print_result(
            passed,
            f"Status: {status_code} (expected {expected_status}), Message: '{message}'",
            f"Full response: {response.text[:200]}"
        )
        
        return passed
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_case_b(csrf_token, cookies):
    """
    Test Case B: POST /api/user/github-signin with fake code
    Expected: 401 "Invalid GitHub authorization code"
    """
    print_test_header("Case B: Fake authorization code")
    
    try:
        response = requests.post(
            f"{BASE_URL}/user/github-signin",
            json={"code": "fake_code_123"},
            headers={
                "User-Agent": USER_AGENT,
                "x-csrf-token": csrf_token,
                "Content-Type": "application/json"
            },
            cookies=cookies,
            timeout=10
        )
        
        status_code = response.status_code
        try:
            response_data = response.json()
            message = response_data.get("message", "")
        except:
            message = response.text
        
        expected_status = 401
        expected_message = "Invalid GitHub authorization code"
        
        passed = (status_code == expected_status and expected_message in message)
        
        print_result(
            passed,
            f"Status: {status_code} (expected {expected_status}), Message: '{message}'",
            f"Full response: {response.text[:200]}"
        )
        
        return passed
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_case_c():
    """
    Test Case C: POST /api/user/github-signin without CSRF header
    Expected: 403 CSRF error
    """
    print_test_header("Case C: Missing CSRF header")
    
    try:
        response = requests.post(
            f"{BASE_URL}/user/github-signin",
            json={"code": "x"},
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/json"
                # Intentionally NOT including x-csrf-token header
            },
            timeout=10
        )
        
        status_code = response.status_code
        try:
            response_data = response.json()
            message = response_data.get("message", "")
        except:
            message = response.text
        
        expected_status = 403
        
        # CSRF error messages can vary, but status code should be 403
        passed = (status_code == expected_status)
        
        print_result(
            passed,
            f"Status: {status_code} (expected {expected_status}), Message: '{message}'",
            f"Full response: {response.text[:200]}"
        )
        
        return passed
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_case_d_regression(csrf_token, cookies):
    """
    Test Case D: Regression tests
    D1: GET /api/ → 200
    D2: POST /api/user/google-signin with fake token → 401 "Invalid Google access token"
    """
    print_test_header("Case D: Regression Tests")
    
    results = []
    
    # D1: GET /api/
    print("\n--- D1: GET /api/ ---")
    try:
        response = requests.get(
            f"{BASE_URL}/",
            headers={"User-Agent": USER_AGENT},
            timeout=10
        )
        
        status_code = response.status_code
        passed = (status_code == 200)
        
        print_result(
            passed,
            f"GET /api/ returned {status_code} (expected 200)",
            f"Response: {response.text[:100]}"
        )
        results.append(passed)
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        results.append(False)
    
    # D2: POST /api/user/google-signin with fake token
    print("\n--- D2: POST /api/user/google-signin ---")
    try:
        response = requests.post(
            f"{BASE_URL}/user/google-signin",
            json={"accessToken": "fake"},
            headers={
                "User-Agent": USER_AGENT,
                "x-csrf-token": csrf_token,
                "Content-Type": "application/json"
            },
            cookies=cookies,
            timeout=10
        )
        
        status_code = response.status_code
        try:
            response_data = response.json()
            message = response_data.get("message", "")
        except:
            message = response.text
        
        expected_status = 401
        expected_message = "Invalid Google access token"
        
        passed = (status_code == expected_status and expected_message in message)
        
        print_result(
            passed,
            f"Status: {status_code} (expected {expected_status}), Message: '{message}'",
            f"Full response: {response.text[:200]}"
        )
        results.append(passed)
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        results.append(False)
    
    return all(results)

def main():
    """Run all test cases"""
    print("\n" + "="*80)
    print("GitHub OAuth Sign-In Backend API Tests")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Date: 2026-07-08")
    print("="*80)
    
    # Get CSRF token first
    csrf_token, cookies = get_csrf_token()
    if not csrf_token or not cookies:
        print("\n❌ FATAL: Could not obtain CSRF token. Aborting tests.")
        sys.exit(1)
    
    # Run all test cases
    results = {
        "Case A (Empty body)": test_case_a(csrf_token, cookies),
        "Case B (Fake code)": test_case_b(csrf_token, cookies),
        "Case C (No CSRF)": test_case_c(),
        "Case D (Regression)": test_case_d_regression(csrf_token, cookies)
    }
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total_tests = len(results)
    passed_tests = sum(1 for p in results.values() if p)
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
