#!/usr/bin/env python3
"""
Backend test for DynoPay payment email rendering diagnostics endpoint.
Tests the /api/diagnostics/payment-email-preview endpoint with various parameters.
SAFE MODE: READ-ONLY, no payments created, no data mutations.
"""

import requests
import time
import json
import sys
import re

# Backend URL (external preview origin with /api prefix)
BASE_URL = "https://vault-auth-demo-1.preview.emergentagent.com"

# Admin credentials for diagnostics endpoint
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"

def log(msg):
    """Print timestamped log message"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def admin_login():
    """
    Login as admin to get JWT token.
    Returns: (success: bool, token: str or None, error: str or None)
    """
    log("\n=== ADMIN LOGIN ===")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=30
        )
        log(f"Login status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "data" in data and "accessToken" in data["data"]:
                token = data["data"]["accessToken"]
                log(f"✓ Admin JWT token obtained (length: {len(token)})")
                return True, token, None
            else:
                log(f"✗ No accessToken in response: {data}")
                return False, None, "No accessToken in response"
        else:
            log(f"✗ Login failed: {response.status_code} - {response.text[:200]}")
            return False, None, f"HTTP {response.status_code}"
    except Exception as e:
        log(f"✗ Login exception: {e}")
        return False, None, str(e)

def test_wrong_password():
    """
    Test that wrong password returns auth error (not a token).
    """
    log("\n=== TEST: Wrong Password ===")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": ADMIN_EMAIL,
                "password": "WrongPassword123@"
            },
            timeout=30
        )
        log(f"Wrong password status: {response.status_code}")
        
        # Should be 401 or 403, NOT 200
        if response.status_code in [401, 403, 400]:
            log(f"✓ PASS: Wrong password correctly rejected with {response.status_code}")
            return True, None
        elif response.status_code == 200:
            data = response.json()
            if "data" in data and "accessToken" in data["data"]:
                log(f"✗ FAIL: Wrong password returned a token!")
                return False, "Wrong password returned token"
            else:
                log(f"✓ PASS: Wrong password returned 200 but no token")
                return True, None
        else:
            log(f"⚠ Unexpected status: {response.status_code}")
            return True, None  # Still pass if it's not 200 with token
    except Exception as e:
        log(f"✗ Exception: {e}")
        return False, str(e)

def test_no_auth_token():
    """
    Test that diagnostics endpoint without Bearer token returns 403.
    """
    log("\n=== TEST: No Auth Token ===")
    try:
        response = requests.get(
            f"{BASE_URL}/api/diagnostics/payment-email-preview",
            params={"type": "settled", "source": "paymentLink", "overpay": "1"},
            timeout=30
        )
        log(f"No auth status: {response.status_code}")
        
        # Should be 401 or 403
        if response.status_code in [401, 403]:
            log(f"✓ PASS: No auth token correctly rejected with {response.status_code}")
            return True, None
        else:
            log(f"✗ FAIL: Expected 401/403, got {response.status_code}")
            return False, f"Expected 401/403, got {response.status_code}"
    except Exception as e:
        log(f"✗ Exception: {e}")
        return False, str(e)

def test_email_preview(token, test_name, params, must_contain=None, must_not_contain=None):
    """
    Test the diagnostics endpoint with given parameters.
    
    Args:
        token: Admin JWT token
        test_name: Name of the test case
        params: Query parameters dict
        must_contain: List of strings that MUST be in the HTML (case-insensitive)
        must_not_contain: List of strings that MUST NOT be in the HTML (case-insensitive)
    
    Returns: (success: bool, error: str or None)
    """
    log(f"\n=== TEST: {test_name} ===")
    log(f"Params: {params}")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/diagnostics/payment-email-preview",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        log(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"✗ FAIL: Expected 200, got {response.status_code}")
            log(f"Response: {response.text[:500]}")
            return False, f"HTTP {response.status_code}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type.lower():
            log(f"⚠ Warning: Content-Type is {content_type}, expected text/html")
        
        html = response.text
        log(f"HTML length: {len(html)} characters")
        
        # Convert to lowercase for case-insensitive matching
        html_lower = html.lower()
        
        # Check must_contain
        if must_contain:
            for substring in must_contain:
                substring_lower = substring.lower()
                if substring_lower in html_lower:
                    log(f"✓ Found: '{substring}'")
                else:
                    log(f"✗ FAIL: Missing required substring: '{substring}'")
                    # Show context around where it should be
                    log(f"HTML preview (first 1000 chars): {html[:1000]}")
                    return False, f"Missing required substring: '{substring}'"
        
        # Check must_not_contain
        if must_not_contain:
            for substring in must_not_contain:
                substring_lower = substring.lower()
                if substring_lower not in html_lower:
                    log(f"✓ Correctly absent: '{substring}'")
                else:
                    log(f"✗ FAIL: Found forbidden substring: '{substring}'")
                    # Find and show context
                    idx = html_lower.find(substring_lower)
                    context_start = max(0, idx - 100)
                    context_end = min(len(html), idx + len(substring) + 100)
                    log(f"Context: ...{html[context_start:context_end]}...")
                    return False, f"Found forbidden substring: '{substring}'"
        
        log(f"✓ PASS: All assertions passed")
        return True, None
        
    except Exception as e:
        log(f"✗ Exception: {e}")
        return False, str(e)

def run_all_tests():
    """
    Run all test cases and return results.
    """
    results = {
        "wrong_password": {"pass": False, "error": None},
        "no_auth_token": {"pass": False, "error": None},
        "test_1_settled_paymentlink_overpay": {"pass": False, "error": None},
        "test_2_settled_api_no_overpay": {"pass": False, "error": None},
        "test_3_pending_productorder": {"pass": False, "error": None},
        "test_4_confirming_donation": {"pass": False, "error": None},
        "test_5_settled_spanish": {"pass": False, "error": None},
    }
    
    # Test 1: Wrong password
    success, error = test_wrong_password()
    results["wrong_password"]["pass"] = success
    results["wrong_password"]["error"] = error
    
    # Test 2: No auth token
    success, error = test_no_auth_token()
    results["no_auth_token"]["pass"] = success
    results["no_auth_token"]["error"] = error
    
    # Login as admin
    login_success, token, login_error = admin_login()
    if not login_success:
        log(f"\n✗✗✗ CRITICAL: Admin login failed, cannot proceed with email tests")
        results["admin_login"] = {"pass": False, "error": login_error}
        return results
    
    # Test 3: settled + paymentLink + overpay=1
    # Must contain: "Received via", "Payment link", "A buyer overpaid by 0.00000234 BTC"
    success, error = test_email_preview(
        token,
        "Test 1: Settled + Payment Link + Overpay",
        {"type": "settled", "source": "paymentLink", "overpay": "1"},
        must_contain=["Received via", "Payment link", "A buyer overpaid by 0.00000234 BTC"],
        must_not_contain=None
    )
    results["test_1_settled_paymentlink_overpay"]["pass"] = success
    results["test_1_settled_paymentlink_overpay"]["error"] = error
    
    # Test 4: settled + api + overpay=0
    # Must contain: "Received via", "API"
    # Must NOT contain: "A buyer overpaid"
    success, error = test_email_preview(
        token,
        "Test 2: Settled + API + No Overpay",
        {"type": "settled", "source": "api", "overpay": "0"},
        must_contain=["Received via", "API"],
        must_not_contain=["A buyer overpaid"]
    )
    results["test_2_settled_api_no_overpay"]["pass"] = success
    results["test_2_settled_api_no_overpay"]["error"] = error
    
    # Test 5: pending + productOrder
    # Must contain: "Received via", "Store"
    success, error = test_email_preview(
        token,
        "Test 3: Pending + Product Order",
        {"type": "pending", "source": "productOrder"},
        must_contain=["Received via", "Store"],
        must_not_contain=None
    )
    results["test_3_pending_productorder"]["pass"] = success
    results["test_3_pending_productorder"]["error"] = error
    
    # Test 6: confirming + donation
    # Must contain: "Received via", "Donation"
    success, error = test_email_preview(
        token,
        "Test 4: Confirming + Donation",
        {"type": "confirming", "source": "donation"},
        must_contain=["Received via", "Donation"],
        must_not_contain=None
    )
    results["test_4_confirming_donation"]["pass"] = success
    results["test_4_confirming_donation"]["error"] = error
    
    # Test 7: settled + paymentLink + lang=es
    # Must contain: "Recibido vía" (Spanish for "Received via")
    success, error = test_email_preview(
        token,
        "Test 5: Settled + Spanish Localization",
        {"type": "settled", "source": "paymentLink", "lang": "es"},
        must_contain=["Recibido vía"],
        must_not_contain=None
    )
    results["test_5_settled_spanish"]["pass"] = success
    results["test_5_settled_spanish"]["error"] = error
    
    return results

def print_summary(results):
    """
    Print test summary and return overall pass/fail.
    """
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    total_tests = 0
    passed_tests = 0
    
    for test_name, result in results.items():
        total_tests += 1
        status = "✓ PASS" if result["pass"] else "✗ FAIL"
        log(f"{test_name}: {status}")
        if result["error"]:
            log(f"  Error: {result['error']}")
        if result["pass"]:
            passed_tests += 1
    
    log("\n" + "="*80)
    log(f"RESULTS: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        log("OVERALL: ✓✓✓ ALL TESTS PASSED ✓✓✓")
    else:
        log("OVERALL: ✗✗✗ SOME TESTS FAILED ✗✗✗")
    log("="*80)
    
    return passed_tests == total_tests

if __name__ == "__main__":
    log("Starting DynoPay email rendering diagnostics tests")
    log(f"Target: {BASE_URL}")
    log(f"Admin: {ADMIN_EMAIL}")
    log("Mode: SAFE (READ-ONLY, no payments, no mutations)")
    
    results = run_all_tests()
    all_pass = print_summary(results)
    
    # Write results to file
    with open("/app/email_diagnostics_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    log("\nResults written to /app/email_diagnostics_test_results.json")
    
    sys.exit(0 if all_pass else 1)
