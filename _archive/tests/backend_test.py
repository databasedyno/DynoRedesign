#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay
Tests KYC status and branded short-link E2E flow
"""

import requests
import json
import re
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8001"
OWNER_EMAIL = "onarrival21@gmail.com"
OWNER_PASSWORD = "Katiekendra123@"
TEST_EMAIL = "onarrival21+ptest@gmail.com"

# Read SERVER_URL and CHECKOUT_URL from backend/.env
SERVER_URL = "https://setup-vault-6.preview.emergentagent.com"
CHECKOUT_URL = "https://setup-vault-6.preview.emergentagent.com"

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

def test_health() -> bool:
    """Test health endpoint"""
    log_test("Testing health endpoint...", "INFO")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            if status == "healthy":
                log_test(f"Health check PASSED: {json.dumps(data, indent=2)}", "PASS")
                return True
            else:
                log_test(f"Health check status not 'healthy': {status}", "FAIL")
                return False
        else:
            log_test(f"Health check failed: {response.status_code} - {response.text}", "FAIL")
            return False
    except Exception as e:
        log_test(f"Health check exception: {str(e)}", "FAIL")
        return False

def test_kyc_status(token: str) -> bool:
    """Test KYC status endpoints"""
    log_test("\n=== TEST 1: KYC Status ===", "INFO")
    
    headers = {"Authorization": f"Bearer {token}"}
    all_passed = True
    
    # Test 1a: KYC status with company_id=1
    log_test("Testing GET /api/kyc/status?company_id=1", "INFO")
    try:
        response = requests.get(
            f"{BASE_URL}/api/kyc/status?company_id=1",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test(f"Response: {json.dumps(data, indent=2)}", "INFO")
            
            status = data.get("data", {}).get("status")
            can_process = data.get("data", {}).get("can_process_payments")
            
            if status == "approved":
                log_test(f"✓ KYC status is 'approved'", "PASS")
            else:
                log_test(f"✗ KYC status is '{status}', expected 'approved'", "FAIL")
                all_passed = False
            
            if can_process is True:
                log_test(f"✓ can_process_payments is true", "PASS")
            else:
                log_test(f"✗ can_process_payments is {can_process}, expected true", "FAIL")
                all_passed = False
        else:
            log_test(f"KYC status check failed: {response.status_code} - {response.text}", "FAIL")
            all_passed = False
    except Exception as e:
        log_test(f"KYC status check exception: {str(e)}", "FAIL")
        all_passed = False
    
    # Test 1b: KYC status without company_id (account-level)
    log_test("\nTesting GET /api/kyc/status (no company param)", "INFO")
    try:
        response = requests.get(
            f"{BASE_URL}/api/kyc/status",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test(f"Response: {json.dumps(data, indent=2)}", "INFO")
            
            status = data.get("data", {}).get("status")
            
            if status == "approved":
                log_test(f"✓ Account-level KYC status is 'approved'", "PASS")
            else:
                log_test(f"✗ Account-level KYC status is '{status}', expected 'approved'", "FAIL")
                all_passed = False
        else:
            log_test(f"Account-level KYC status check failed: {response.status_code} - {response.text}", "FAIL")
            all_passed = False
    except Exception as e:
        log_test(f"Account-level KYC status check exception: {str(e)}", "FAIL")
        all_passed = False
    
    return all_passed

def test_branded_short_link(token: str) -> bool:
    """Test E2E branded short-link creation"""
    log_test("\n=== TEST 2: E2E Branded Short-Link ===", "INFO")
    
    headers = {"Authorization": f"Bearer {token}"}
    link_id = None
    all_passed = True
    
    # Create payment link
    log_test("Creating payment link with 2+ crypto currencies...", "INFO")
    try:
        payload = {
            "amount": 25,
            "currency": "USD",
            "email": TEST_EMAIL,
            "description": "QA branded-link E2E",
            "crypto_currencies": ["BTC", "ETH"],
            "company_id": 1
        }
        
        log_test(f"Payload: {json.dumps(payload, indent=2)}", "INFO")
        
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        log_test(f"Response status: {response.status_code}", "INFO")
        log_test(f"Response body: {response.text[:500]}", "INFO")
        
        if response.status_code == 200:
            data = response.json()
            log_test(f"Full response: {json.dumps(data, indent=2)}", "INFO")
            
            response_data = data.get("data", {})
            short_link = response_data.get("short_link")
            payment_link = response_data.get("payment_link")
            link_id = response_data.get("link_id") or response_data.get("id")
            
            log_test(f"\nExtracted values:", "INFO")
            log_test(f"  short_link: {short_link}", "INFO")
            log_test(f"  payment_link: {payment_link}", "INFO")
            log_test(f"  link_id: {link_id}", "INFO")
            
            # Assertion a: short_link exists and format
            if short_link:
                # Extract ref from short_link (last path segment)
                short_link_match = re.match(r'^(.+)/([A-Za-z0-9]{6})$', short_link)
                
                if short_link_match:
                    base_url = short_link_match.group(1)
                    short_ref = short_link_match.group(2)
                    
                    if base_url == SERVER_URL:
                        log_test(f"✓ short_link base URL matches SERVER_URL: {SERVER_URL}", "PASS")
                    else:
                        log_test(f"✗ short_link base URL '{base_url}' != SERVER_URL '{SERVER_URL}'", "FAIL")
                        all_passed = False
                    
                    if "/pay?d=" not in short_link:
                        log_test(f"✓ short_link does NOT contain '/pay?d='", "PASS")
                    else:
                        log_test(f"✗ short_link contains '/pay?d=' (should be clean branded link)", "FAIL")
                        all_passed = False
                    
                    log_test(f"✓ short_link ref is 6 base62 chars: {short_ref}", "PASS")
                else:
                    log_test(f"✗ short_link format invalid: {short_link}", "FAIL")
                    all_passed = False
            else:
                log_test(f"✗ short_link is missing from response", "FAIL")
                all_passed = False
            
            # Assertion b: payment_link still contains /pay?d=<ref>
            if payment_link:
                payment_link_match = re.search(r'/pay\?d=([A-Za-z0-9]{6})', payment_link)
                
                if payment_link_match:
                    payment_ref = payment_link_match.group(1)
                    
                    if payment_link.startswith(CHECKOUT_URL):
                        log_test(f"✓ payment_link starts with CHECKOUT_URL: {CHECKOUT_URL}", "PASS")
                    else:
                        log_test(f"✗ payment_link doesn't start with CHECKOUT_URL", "FAIL")
                        all_passed = False
                    
                    log_test(f"✓ payment_link contains '/pay?d={payment_ref}'", "PASS")
                    
                    # Assertion c: refs match
                    if short_link and short_link_match:
                        if short_ref == payment_ref:
                            log_test(f"✓ short_link ref '{short_ref}' matches payment_link ref '{payment_ref}'", "PASS")
                        else:
                            log_test(f"✗ short_link ref '{short_ref}' != payment_link ref '{payment_ref}'", "FAIL")
                            all_passed = False
                else:
                    log_test(f"✗ payment_link format invalid (missing /pay?d=<ref>): {payment_link}", "FAIL")
                    all_passed = False
            else:
                log_test(f"✗ payment_link is missing from response", "FAIL")
                all_passed = False
            
        elif response.status_code == 400 or response.status_code == 403:
            # Check for specific error messages
            error_text = response.text.lower()
            
            if "kyc" in error_text or "kyc_required" in error_text:
                log_test(f"✗ CRITICAL: KYC error still present! Response: {response.text}", "FAIL")
                all_passed = False
            elif "api key" in error_text or "active api key" in error_text:
                log_test(f"⚠ 'An active API key is required' error (acceptable, different issue): {response.text}", "WARN")
                # This is acceptable per the review request
            else:
                log_test(f"✗ Payment link creation failed: {response.status_code} - {response.text}", "FAIL")
                all_passed = False
        else:
            log_test(f"✗ Payment link creation failed: {response.status_code} - {response.text}", "FAIL")
            all_passed = False
    except Exception as e:
        log_test(f"Payment link creation exception: {str(e)}", "FAIL")
        all_passed = False
    
    # Cleanup: Delete the payment link
    if link_id:
        log_test(f"\nCleaning up: Deleting payment link {link_id}...", "INFO")
        try:
            response = requests.delete(
                f"{BASE_URL}/api/pay/deletePaymentLink/{link_id}",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                log_test(f"✓ Payment link deleted successfully", "PASS")
            else:
                log_test(f"⚠ Payment link deletion returned {response.status_code}: {response.text}", "WARN")
        except Exception as e:
            log_test(f"⚠ Payment link deletion exception: {str(e)}", "WARN")
    else:
        log_test("⚠ No link_id to clean up", "WARN")
    
    return all_passed

def main():
    """Main test execution"""
    log_test("=" * 80, "INFO")
    log_test("DynoPay Backend Testing - KYC Status & Branded Short-Link", "INFO")
    log_test("=" * 80, "INFO")
    log_test(f"BASE_URL: {BASE_URL}", "INFO")
    log_test(f"SERVER_URL: {SERVER_URL}", "INFO")
    log_test(f"CHECKOUT_URL: {CHECKOUT_URL}", "INFO")
    log_test("=" * 80, "INFO")
    
    results = {
        "health": False,
        "login": False,
        "kyc_status": False,
        "branded_short_link": False
    }
    
    # Test health
    results["health"] = test_health()
    
    if not results["health"]:
        log_test("\n⚠ Health check failed, but continuing with tests...", "WARN")
    
    # Login
    token = login()
    if not token:
        log_test("\n✗ Login failed, cannot proceed with authenticated tests", "FAIL")
        sys.exit(1)
    
    results["login"] = True
    
    # Test KYC status
    results["kyc_status"] = test_kyc_status(token)
    
    # Test branded short-link
    results["branded_short_link"] = test_branded_short_link(token)
    
    # Summary
    log_test("\n" + "=" * 80, "INFO")
    log_test("TEST SUMMARY", "INFO")
    log_test("=" * 80, "INFO")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        log_test(f"{test_name.replace('_', ' ').title()}: {status}", status)
    
    log_test("=" * 80, "INFO")
    log_test(f"Total: {passed_tests}/{total_tests} tests passed", "INFO")
    log_test("=" * 80, "INFO")
    
    if passed_tests == total_tests:
        log_test("\n✓ ALL TESTS PASSED", "PASS")
        sys.exit(0)
    else:
        log_test(f"\n✗ {total_tests - passed_tests} TEST(S) FAILED", "FAIL")
        sys.exit(1)

if __name__ == "__main__":
    main()
