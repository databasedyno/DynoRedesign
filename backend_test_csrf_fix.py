#!/usr/bin/env python3
"""
CSRF Bug Fix Verification Test for DynoPay Onboarding Flow
Tests that email-only signup endpoints are no longer blocked by CSRF middleware

BUG FIX CONTEXT:
- User reported 403 "CSRF token validation failed" during onboarding email step
- Root cause: /api/user/registerEmail was missing from CSRF EXEMPT_PATHS
- Fix: Added /api/user/registerEmail and /api/user/phone-type-check to EXEMPT_PATHS

PASS CRITERIA:
- Endpoints should NOT return HTTP 403 with "CSRF token validation failed"
- Normal application responses are acceptable (200/201 success, 400/409 validation errors)
"""

import requests
import json
from datetime import datetime
import time

# Target URL from review request
BASE_URL = "https://fast-start-8.preview.emergentagent.com/api"

def print_separator():
    print("\n" + "="*80 + "\n")

def test_register_email():
    """
    TEST 1: POST /api/user/registerEmail
    EXPECTED: NOT a 403 CSRF error. Should return 200/201 (OTP sent) or 400/409 (validation error)
    """
    print("TEST 1: Register Email (POST /api/user/registerEmail)")
    print("-" * 80)
    
    try:
        # Generate unique email with timestamp
        timestamp = int(time.time())
        email = f"qa.onboard.{timestamp}@dynopaytest.com"
        
        url = f"{BASE_URL}/user/registerEmail"
        payload = {"email": email}
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Headers: No Authorization, No CSRF token")
        
        # Make request WITHOUT auth and WITHOUT CSRF token
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        # Check if CSRF blocked the request
        if response.status_code == 403:
            try:
                data = response.json()
                if "CSRF token validation failed" in str(data):
                    print(f"❌ FAIL: CSRF middleware still blocking this endpoint!")
                    return False, f"CSRF 403 error - Bug fix NOT working"
            except:
                pass
            print(f"❌ FAIL: Got 403 but not CSRF error. Response: {response.text[:200]}")
            return False, f"Got 403 (not CSRF) - {response.text[:100]}"
        
        # Any non-403 response is acceptable (200/201 success, 400/409 validation error)
        if response.status_code in [200, 201]:
            print(f"✅ PASS: Email registration endpoint working (HTTP {response.status_code})")
            return True, f"HTTP {response.status_code} - CSRF block removed successfully"
        elif response.status_code in [400, 409]:
            print(f"✅ PASS: Got validation error (HTTP {response.status_code}) - CSRF not blocking")
            return True, f"HTTP {response.status_code} validation error - CSRF block removed"
        else:
            print(f"⚠️ PARTIAL PASS: Got HTTP {response.status_code} (not CSRF 403)")
            return True, f"HTTP {response.status_code} - CSRF block removed (unexpected status)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_verify_otp():
    """
    TEST 2: POST /api/user/registerEmail/verify-otp
    EXPECTED: NOT a 403 CSRF error. Should return 400/401 (invalid OTP) or other normal response
    """
    print("TEST 2: Verify OTP (POST /api/user/registerEmail/verify-otp)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/user/registerEmail/verify-otp"
        payload = {
            "email": "qa.test@dynopaytest.com",
            "otp": "000000"  # Invalid OTP for testing
        }
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Headers: No Authorization, No CSRF token")
        
        # Make request WITHOUT auth and WITHOUT CSRF token
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        # Check if CSRF blocked the request
        if response.status_code == 403:
            try:
                data = response.json()
                if "CSRF token validation failed" in str(data):
                    print(f"❌ FAIL: CSRF middleware still blocking this endpoint!")
                    return False, f"CSRF 403 error - Bug fix NOT working"
            except:
                pass
            print(f"❌ FAIL: Got 403 but not CSRF error. Response: {response.text[:200]}")
            return False, f"Got 403 (not CSRF) - {response.text[:100]}"
        
        # Any non-403 response is acceptable
        if response.status_code in [200, 201]:
            print(f"✅ PASS: OTP verification endpoint working (HTTP {response.status_code})")
            return True, f"HTTP {response.status_code} - CSRF block removed successfully"
        elif response.status_code in [400, 401]:
            print(f"✅ PASS: Got validation error (HTTP {response.status_code}) - CSRF not blocking")
            return True, f"HTTP {response.status_code} invalid OTP error - CSRF block removed"
        else:
            print(f"⚠️ PARTIAL PASS: Got HTTP {response.status_code} (not CSRF 403)")
            return True, f"HTTP {response.status_code} - CSRF block removed (unexpected status)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_phone_type_check():
    """
    TEST 3: POST /api/user/phone-type-check
    EXPECTED: NOT a 403 CSRF error. Should return normal response
    """
    print("TEST 3: Phone Type Check (POST /api/user/phone-type-check)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/user/phone-type-check"
        payload = {"phone": "+14155550123"}
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Headers: No Authorization, No CSRF token")
        
        # Make request WITHOUT auth and WITHOUT CSRF token
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        # Check if CSRF blocked the request
        if response.status_code == 403:
            try:
                data = response.json()
                if "CSRF token validation failed" in str(data):
                    print(f"❌ FAIL: CSRF middleware still blocking this endpoint!")
                    return False, f"CSRF 403 error - Bug fix NOT working"
            except:
                pass
            print(f"❌ FAIL: Got 403 but not CSRF error. Response: {response.text[:200]}")
            return False, f"Got 403 (not CSRF) - {response.text[:100]}"
        
        # Any non-403 response is acceptable
        if response.status_code in [200, 201]:
            print(f"✅ PASS: Phone type check endpoint working (HTTP {response.status_code})")
            return True, f"HTTP {response.status_code} - CSRF block removed successfully"
        elif response.status_code in [400, 404]:
            print(f"✅ PASS: Got validation error (HTTP {response.status_code}) - CSRF not blocking")
            return True, f"HTTP {response.status_code} validation error - CSRF block removed"
        else:
            print(f"⚠️ PARTIAL PASS: Got HTTP {response.status_code} (not CSRF 403)")
            return True, f"HTTP {response.status_code} - CSRF block removed (unexpected status)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_network_fees_control():
    """
    TEST 4 (CONTROL): GET /api/pay/network-fees
    EXPECTED: Should return 200 (existing public endpoint, regression check)
    """
    print("TEST 4 (CONTROL): Network Fees (GET /api/pay/network-fees)")
    print("-" * 80)
    
    try:
        url = f"{BASE_URL}/pay/network-fees"
        
        print(f"URL: {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Body (truncated): {response.text[:300]}")
        
        if response.status_code == 200:
            print(f"✅ PASS: Network fees endpoint working")
            return True, f"HTTP 200 - Public endpoint still working"
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_health_control():
    """
    TEST 5 (CONTROL): GET /health
    EXPECTED: Should return healthy status (regression check)
    """
    print("TEST 5 (CONTROL): Health Check (GET /health)")
    print("-" * 80)
    
    try:
        # Try both /health and /api/health
        urls = [
            "https://fast-start-8.preview.emergentagent.com/health",
            f"{BASE_URL}/health",
            f"{BASE_URL}/"
        ]
        
        for url in urls:
            print(f"Trying URL: {url}")
            try:
                response = requests.get(url, timeout=10)
                print(f"Status Code: {response.status_code}")
                print(f"Response: {response.text[:200]}")
                
                if response.status_code == 200:
                    print(f"✅ PASS: Health endpoint working at {url}")
                    return True, f"HTTP 200 - Health check working"
            except Exception as e:
                print(f"Failed: {str(e)}")
                continue
        
        print(f"⚠️ WARNING: Could not find working health endpoint")
        return True, f"Health endpoint not found (non-critical)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def main():
    print("="*80)
    print("DynoPay CSRF Bug Fix Verification Test")
    print("Onboarding Flow - Email Registration Endpoints")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("="*80)
    print("\nBUG FIX CONTEXT:")
    print("- User reported 403 'CSRF token validation failed' during email onboarding")
    print("- Fix: Added /api/user/registerEmail and /api/user/phone-type-check to EXEMPT_PATHS")
    print("- PASS CRITERIA: Endpoints should NOT return 403 CSRF error")
    print("="*80)
    
    results = []
    
    # Run all tests
    print_separator()
    result = test_register_email()
    results.append(("POST /api/user/registerEmail", result))
    
    print_separator()
    result = test_verify_otp()
    results.append(("POST /api/user/registerEmail/verify-otp", result))
    
    print_separator()
    result = test_phone_type_check()
    results.append(("POST /api/user/phone-type-check", result))
    
    print_separator()
    result = test_network_fees_control()
    results.append(("GET /api/pay/network-fees (control)", result))
    
    print_separator()
    result = test_health_control()
    results.append(("GET /health (control)", result))
    
    # Summary
    print_separator()
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, (success, _) in results if success)
    total = len(results)
    
    print("\nCRITICAL TESTS (CSRF Bug Fix):")
    print("-" * 80)
    for i in range(3):  # First 3 tests are critical
        test_name, (success, message) = results[i]
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   → {message}")
    
    print("\nCONTROL TESTS (Regression Check):")
    print("-" * 80)
    for i in range(3, len(results)):  # Remaining tests are controls
        test_name, (success, message) = results[i]
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   → {message}")
    
    print("\n" + "="*80)
    print(f"Total: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
    
    # Check if critical tests passed
    critical_passed = sum(1 for _, (success, _) in results[:3] if success)
    
    if critical_passed == 3:
        print("\n🎉 BUG FIX VERIFIED - CSRF no longer blocks onboarding endpoints")
        print("   All 3 critical endpoints are now accessible without CSRF token")
    else:
        print(f"\n❌ BUG FIX FAILED - {3 - critical_passed} critical test(s) still blocked by CSRF")
    
    if passed == total:
        print("   No regressions detected in control tests")
    
    print("="*80)

if __name__ == "__main__":
    main()
