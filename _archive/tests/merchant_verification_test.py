#!/usr/bin/env python3
"""
Merchant Verification Endpoint Testing Script for DynoPay
Tests the NEW read-only public endpoint: GET /api/public/merchant-verification

IMPORTANT: This is a READ-ONLY test against a LIVE PRODUCTION database.
No data will be created, updated, or deleted.
"""

import requests
import json
import re
import sys
from typing import Dict, Any, Optional
from urllib.parse import quote

# Configuration
BASE_URL = "https://lucid-mahavira-16.preview.emergentagent.com"
OWNER_EMAIL = "onarrival21@gmail.com"
OWNER_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(message: str, status: str = "INFO"):
    """Log test messages with color coding"""
    color = Colors.BLUE
    if status == "PASS":
        color = Colors.GREEN
    elif status == "FAIL":
        color = Colors.RED
    elif status == "WARN":
        color = Colors.YELLOW
    
    print(f"{color}[{status}]{Colors.RESET} {message}")

def login() -> Optional[str]:
    """Login and return access token"""
    log_test("Logging in as owner...", "INFO")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": OWNER_EMAIL,
                "password": OWNER_PASSWORD
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("data", {}).get("accessToken")
            if token:
                log_test(f"Login successful! Token length: {len(token)}", "PASS")
                return token
            else:
                log_test(f"Login response missing accessToken: {data}", "FAIL")
                return None
        else:
            log_test(f"Login failed: {response.status_code} - {response.text}", "FAIL")
            return None
    except Exception as e:
        log_test(f"Login exception: {str(e)}", "FAIL")
        return None

def test_case_1_known_handle() -> bool:
    """
    TEST CASE 1: Known verified merchant handle
    GET /api/public/merchant-verification?handle=devhub
    EXPECT: 200, verified=true, business_name="The Dev Store"
    """
    log_test("\n=== TEST CASE 1: Known Verified Handle (devhub) ===", "INFO")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/public/merchant-verification?handle=devhub",
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text}", "INFO")
        
        # Check HTTP status
        if response.status_code != 200:
            log_test(f"✗ Expected HTTP 200, got {response.status_code}", "FAIL")
            return False
        
        log_test(f"✓ HTTP status is 200", "PASS")
        
        # Parse JSON
        data = response.json()
        
        # Check structure
        if data.get("status") != "success":
            log_test(f"✗ Expected status='success', got '{data.get('status')}'", "FAIL")
            return False
        
        log_test(f"✓ Response status is 'success'", "PASS")
        
        response_data = data.get("data", {})
        verified = response_data.get("verified")
        business_name = response_data.get("business_name")
        
        # Check verified field
        if verified is not True:
            log_test(f"✗ Expected verified=true, got {verified}", "FAIL")
            return False
        
        log_test(f"✓ verified is true", "PASS")
        
        # Check business_name
        if business_name != "The Dev Store":
            log_test(f"✗ Expected business_name='The Dev Store', got '{business_name}'", "FAIL")
            return False
        
        log_test(f"✓ business_name is 'The Dev Store'", "PASS")
        
        return True
        
    except Exception as e:
        log_test(f"Exception: {str(e)}", "FAIL")
        return False

def test_case_2_nonexistent_handle() -> bool:
    """
    TEST CASE 2: Non-existent handle
    GET /api/public/merchant-verification?handle=zzz-nonexistent-999
    EXPECT: 200, verified=false
    """
    log_test("\n=== TEST CASE 2: Non-existent Handle ===", "INFO")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/public/merchant-verification?handle=zzz-nonexistent-999",
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text}", "INFO")
        
        # Check HTTP status
        if response.status_code != 200:
            log_test(f"✗ Expected HTTP 200, got {response.status_code}", "FAIL")
            return False
        
        log_test(f"✓ HTTP status is 200", "PASS")
        
        # Parse JSON
        data = response.json()
        
        # Check structure
        if data.get("status") != "success":
            log_test(f"✗ Expected status='success', got '{data.get('status')}'", "FAIL")
            return False
        
        log_test(f"✓ Response status is 'success'", "PASS")
        
        response_data = data.get("data", {})
        verified = response_data.get("verified")
        
        # Check verified field
        if verified is not False:
            log_test(f"✗ Expected verified=false, got {verified}", "FAIL")
            return False
        
        log_test(f"✓ verified is false", "PASS")
        
        return True
        
    except Exception as e:
        log_test(f"Exception: {str(e)}", "FAIL")
        return False

def test_case_3_no_params() -> bool:
    """
    TEST CASE 3: No query parameters
    GET /api/public/merchant-verification
    EXPECT: 200, verified=false, business_name=null
    """
    log_test("\n=== TEST CASE 3: No Query Parameters ===", "INFO")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/public/merchant-verification",
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text}", "INFO")
        
        # Check HTTP status
        if response.status_code != 200:
            log_test(f"✗ Expected HTTP 200, got {response.status_code}", "FAIL")
            return False
        
        log_test(f"✓ HTTP status is 200", "PASS")
        
        # Parse JSON
        data = response.json()
        
        # Check structure
        if data.get("status") != "success":
            log_test(f"✗ Expected status='success', got '{data.get('status')}'", "FAIL")
            return False
        
        log_test(f"✓ Response status is 'success'", "PASS")
        
        response_data = data.get("data", {})
        verified = response_data.get("verified")
        business_name = response_data.get("business_name")
        
        # Check verified field
        if verified is not False:
            log_test(f"✗ Expected verified=false, got {verified}", "FAIL")
            return False
        
        log_test(f"✓ verified is false", "PASS")
        
        # Check business_name is null
        if business_name is not None:
            log_test(f"✗ Expected business_name=null, got '{business_name}'", "FAIL")
            return False
        
        log_test(f"✓ business_name is null", "PASS")
        
        return True
        
    except Exception as e:
        log_test(f"Exception: {str(e)}", "FAIL")
        return False

def test_case_4_bogus_linkref() -> bool:
    """
    TEST CASE 4: Bogus linkRef
    GET /api/public/merchant-verification?linkRef=ZZZZZZ
    EXPECT: 200, verified=false
    """
    log_test("\n=== TEST CASE 4: Bogus linkRef ===", "INFO")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/public/merchant-verification?linkRef=ZZZZZZ",
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text}", "INFO")
        
        # Check HTTP status
        if response.status_code != 200:
            log_test(f"✗ Expected HTTP 200, got {response.status_code}", "FAIL")
            return False
        
        log_test(f"✓ HTTP status is 200", "PASS")
        
        # Parse JSON
        data = response.json()
        
        # Check structure
        if data.get("status") != "success":
            log_test(f"✗ Expected status='success', got '{data.get('status')}'", "FAIL")
            return False
        
        log_test(f"✓ Response status is 'success'", "PASS")
        
        response_data = data.get("data", {})
        verified = response_data.get("verified")
        
        # Check verified field
        if verified is not False:
            log_test(f"✗ Expected verified=false, got {verified}", "FAIL")
            return False
        
        log_test(f"✓ verified is false", "PASS")
        
        return True
        
    except Exception as e:
        log_test(f"Exception: {str(e)}", "FAIL")
        return False

def test_case_5_real_linkref(token: str) -> bool:
    """
    TEST CASE 5: Real active payment-link ref
    a. Login (already done)
    b. GET /api/pay/getPaymentLinks?company_id=1 with Bearer token
    c. Extract a ref from payment_link
    d. GET /api/public/merchant-verification?linkRef=<ref>
    EXPECT: 200, verified=true (user_id=1 is KYC-approved)
    """
    log_test("\n=== TEST CASE 5: Real Active Payment-Link Ref ===", "INFO")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Step b: Get payment links
        log_test("Step b: Fetching payment links for company_id=1...", "INFO")
        response = requests.get(
            f"{BASE_URL}/api/pay/getPaymentLinks?company_id=1",
            headers=headers,
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        
        if response.status_code != 200:
            log_test(f"✗ Failed to fetch payment links: {response.status_code} - {response.text}", "FAIL")
            return False
        
        data = response.json()
        log_test(f"✓ Successfully fetched payment links", "PASS")
        
        # Step c: Extract a ref from payment_link
        payment_links = data.get("data", [])
        
        if not payment_links:
            log_test(f"⚠ No payment links found for company_id=1", "WARN")
            return False
        
        log_test(f"Found {len(payment_links)} payment link(s)", "INFO")
        
        # Extract ref from first payment link
        ref = None
        for link in payment_links:
            payment_link = link.get("payment_link", "")
            # Look for ?d=<ref> pattern
            match = re.search(r'\?d=([A-Za-z0-9]{6})', payment_link)
            if match:
                ref = match.group(1)
                log_test(f"Extracted ref: {ref} from payment_link: {payment_link}", "INFO")
                break
        
        if not ref:
            log_test(f"✗ Could not extract ref from payment links", "FAIL")
            log_test(f"First payment link: {payment_links[0] if payment_links else 'N/A'}", "INFO")
            return False
        
        log_test(f"✓ Extracted ref: {ref}", "PASS")
        
        # Step d: Test merchant-verification with this ref
        log_test(f"Step d: Testing merchant-verification with linkRef={ref}...", "INFO")
        response = requests.get(
            f"{BASE_URL}/api/public/merchant-verification?linkRef={ref}",
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text}", "INFO")
        
        # Check HTTP status
        if response.status_code != 200:
            log_test(f"✗ Expected HTTP 200, got {response.status_code}", "FAIL")
            return False
        
        log_test(f"✓ HTTP status is 200", "PASS")
        
        # Parse JSON
        data = response.json()
        
        # Check structure
        if data.get("status") != "success":
            log_test(f"✗ Expected status='success', got '{data.get('status')}'", "FAIL")
            return False
        
        log_test(f"✓ Response status is 'success'", "PASS")
        
        response_data = data.get("data", {})
        verified = response_data.get("verified")
        
        # Check verified field (should be true for user_id=1 who is KYC-approved)
        if verified is not True:
            log_test(f"✗ Expected verified=true (user_id=1 is KYC-approved), got {verified}", "FAIL")
            return False
        
        log_test(f"✓ verified is true (merchant is KYC-approved)", "PASS")
        
        return True
        
    except Exception as e:
        log_test(f"Exception: {str(e)}", "FAIL")
        return False

def test_case_6_sql_injection() -> bool:
    """
    TEST CASE 6: SQL injection attempt
    GET /api/public/merchant-verification?handle=%27%20OR%201=1--
    EXPECT: 200 (no 500), verified=false
    Confirms parameterized queries / no injection vulnerability
    """
    log_test("\n=== TEST CASE 6: SQL Injection Safety ===", "INFO")
    
    try:
        # URL-encoded SQL injection string: ' OR 1=1--
        injection_string = quote("' OR 1=1--")
        
        log_test(f"Testing with injection string: ' OR 1=1--", "INFO")
        log_test(f"URL-encoded: {injection_string}", "INFO")
        
        response = requests.get(
            f"{BASE_URL}/api/public/merchant-verification?handle={injection_string}",
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text}", "INFO")
        
        # Check HTTP status (must be 200, not 500)
        if response.status_code == 500:
            log_test(f"✗ CRITICAL: SQL injection caused 500 error!", "FAIL")
            return False
        
        if response.status_code != 200:
            log_test(f"✗ Expected HTTP 200, got {response.status_code}", "FAIL")
            return False
        
        log_test(f"✓ HTTP status is 200 (no 500 error)", "PASS")
        
        # Parse JSON
        data = response.json()
        
        # Check structure
        if data.get("status") != "success":
            log_test(f"✗ Expected status='success', got '{data.get('status')}'", "FAIL")
            return False
        
        log_test(f"✓ Response status is 'success'", "PASS")
        
        response_data = data.get("data", {})
        verified = response_data.get("verified")
        
        # Check verified field (should be false, not exploited)
        if verified is not False:
            log_test(f"✗ CRITICAL: SQL injection may have succeeded! verified={verified}", "FAIL")
            return False
        
        log_test(f"✓ verified is false (SQL injection blocked)", "PASS")
        log_test(f"✓ Endpoint is safe from SQL injection", "PASS")
        
        return True
        
    except Exception as e:
        log_test(f"Exception: {str(e)}", "FAIL")
        return False

def main():
    """Main test execution"""
    log_test("=" * 80, "INFO")
    log_test("DynoPay Merchant Verification Endpoint Testing", "INFO")
    log_test("READ-ONLY tests against LIVE PRODUCTION database", "INFO")
    log_test("=" * 80, "INFO")
    log_test(f"BASE_URL: {BASE_URL}", "INFO")
    log_test(f"Endpoint: GET /api/public/merchant-verification", "INFO")
    log_test("=" * 80, "INFO")
    
    results = {
        "test_case_1_known_handle": False,
        "test_case_2_nonexistent_handle": False,
        "test_case_3_no_params": False,
        "test_case_4_bogus_linkref": False,
        "test_case_5_real_linkref": False,
        "test_case_6_sql_injection": False
    }
    
    # Run test cases 1-4 (no auth required)
    results["test_case_1_known_handle"] = test_case_1_known_handle()
    results["test_case_2_nonexistent_handle"] = test_case_2_nonexistent_handle()
    results["test_case_3_no_params"] = test_case_3_no_params()
    results["test_case_4_bogus_linkref"] = test_case_4_bogus_linkref()
    
    # Login for test case 5
    log_test("\n" + "=" * 80, "INFO")
    log_test("Logging in for authenticated test case...", "INFO")
    log_test("=" * 80, "INFO")
    
    token = login()
    if not token:
        log_test("\n✗ Login failed, cannot proceed with test case 5", "FAIL")
        results["test_case_5_real_linkref"] = False
    else:
        results["test_case_5_real_linkref"] = test_case_5_real_linkref(token)
    
    # Run test case 6 (no auth required)
    results["test_case_6_sql_injection"] = test_case_6_sql_injection()
    
    # Summary
    log_test("\n" + "=" * 80, "INFO")
    log_test("TEST SUMMARY", "INFO")
    log_test("=" * 80, "INFO")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        display_name = test_name.replace("_", " ").title()
        log_test(f"{display_name}: {status}", status)
    
    log_test("=" * 80, "INFO")
    log_test(f"Total: {passed_tests}/{total_tests} tests passed", "INFO")
    log_test("=" * 80, "INFO")
    
    # Additional verification
    log_test("\n" + "=" * 80, "INFO")
    log_test("ENDPOINT REQUIREMENTS VERIFICATION", "INFO")
    log_test("=" * 80, "INFO")
    
    # Check if endpoint ALWAYS returned 200
    all_200 = all([
        results["test_case_1_known_handle"],
        results["test_case_2_nonexistent_handle"],
        results["test_case_3_no_params"],
        results["test_case_4_bogus_linkref"],
        results["test_case_6_sql_injection"]
    ])
    
    if all_200:
        log_test("✓ Endpoint ALWAYS returns HTTP 200 (never 4xx/5xx)", "PASS")
    else:
        log_test("✗ Endpoint did NOT always return HTTP 200", "FAIL")
    
    if results["test_case_6_sql_injection"]:
        log_test("✓ Endpoint is safe from SQL injection", "PASS")
    else:
        log_test("✗ Endpoint may be vulnerable to SQL injection", "FAIL")
    
    log_test("=" * 80, "INFO")
    
    if passed_tests == total_tests:
        log_test("\n✓ ALL TESTS PASSED", "PASS")
        log_test("✓ Endpoint is working correctly and safely", "PASS")
        sys.exit(0)
    else:
        log_test(f"\n✗ {total_tests - passed_tests} TEST(S) FAILED", "FAIL")
        sys.exit(1)

if __name__ == "__main__":
    main()
