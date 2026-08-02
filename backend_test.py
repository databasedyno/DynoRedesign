#!/usr/bin/env python3
"""
Backend API Testing Script for Session 97d - DigitalOcean Build Fix Verification
Tests the payout digest preview endpoint after the errorResponseHelper fix
"""

import requests
import json
import sys

# Base URL from environment
BASE_URL = "https://4dfe167f-c2a7-4997-96aa-49f477041630.preview.emergentagent.com"

def print_test_header(test_num, description):
    """Print formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(passed, details):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}")
    print(f"Details: {details}")
    return passed

def test_1_csrf_token():
    """Test 1: Get CSRF token"""
    print_test_header(1, "Get CSRF Token")
    
    try:
        response = requests.get(f"{BASE_URL}/api/csrf-token", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            csrf_token = data.get('csrf_token') or data.get('csrfToken')
            print(f"CSRF Token: {csrf_token[:20]}..." if csrf_token else "No token")
            return print_result(True, f"CSRF token retrieved successfully"), csrf_token
        else:
            return print_result(False, f"Failed to get CSRF token: {response.status_code}"), None
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}"), None

def test_2_login(csrf_token):
    """Test 2: Login as merchant"""
    print_test_header(2, "Login as Merchant (hostbay@moxx.co)")
    
    if not csrf_token:
        return print_result(False, "No CSRF token available"), None
    
    try:
        # Login payload
        payload = {
            "email": "hostbay@moxx.co",
            "password": "Katiekendra123@"
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf_token
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get('data', {}).get('accessToken')
            if access_token:
                print(f"Access Token: {access_token[:30]}...")
                return print_result(True, "Login successful, access token retrieved"), access_token
            else:
                return print_result(False, "Login response missing accessToken"), None
        else:
            return print_result(False, f"Login failed with status {response.status_code}"), None
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}"), None

def test_3_payout_digest_happy_path(access_token):
    """Test 3: POST /api/notifications/payout-digest/preview with valid auth (CRITICAL)"""
    print_test_header(3, "Payout Digest Preview - Happy Path (CRITICAL)")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/payout-digest/preview",
            headers=headers,
            timeout=15
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get('message', '')
            sent = data.get('data', {}).get('sent', False)
            digest = data.get('data', {}).get('digest', {})
            settled_volume = digest.get('settledVolume')
            
            print(f"\nMessage: {message}")
            print(f"Sent: {sent}")
            print(f"Settled Volume: {settled_volume}")
            
            # Verify expected response structure
            if message == "Payout digest sent" and sent == True and isinstance(settled_volume, (int, float)):
                return print_result(True, f"Payout digest sent successfully. Settled volume: ${settled_volume}")
            else:
                return print_result(False, f"Response structure incorrect. Message: {message}, Sent: {sent}, Volume: {settled_volume}")
        else:
            return print_result(False, f"Expected HTTP 200, got {response.status_code}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_4_payout_digest_no_auth():
    """Test 4: POST /api/notifications/payout-digest/preview without auth (CRITICAL)"""
    print_test_header(4, "Payout Digest Preview - No Auth (CRITICAL)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/notifications/payout-digest/preview",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        # Should return 401 or 403, NOT 200 or 500
        if response.status_code in [401, 403]:
            return print_result(True, f"Correctly rejected with HTTP {response.status_code}")
        elif response.status_code == 500:
            return print_result(False, "Server crashed with 500 - auth middleware may be broken")
        elif response.status_code == 200:
            return print_result(False, "Security issue: endpoint allowed access without auth!")
        else:
            return print_result(False, f"Unexpected status code: {response.status_code}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_5_notification_preferences(access_token):
    """Test 5: GET /api/notifications/preferences - router sanity check (CRITICAL)"""
    print_test_header(5, "Notification Router Sanity Check (CRITICAL)")
    
    if not access_token:
        return print_result(False, "No access token available")
    
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        # Should return 200 or 404, NOT 500 (which would indicate module load error)
        if response.status_code in [200, 404]:
            return print_result(True, f"Router loaded cleanly (HTTP {response.status_code})")
        elif response.status_code == 500:
            return print_result(False, "Router may have module load error (HTTP 500)")
        else:
            return print_result(False, f"Unexpected status code: {response.status_code}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SESSION 97d - DIGITALOCEAN BUILD FIX VERIFICATION")
    print("Testing errorResponseHelper 4-arg → 3-arg fix")
    print("="*80)
    
    results = []
    
    # Test 1: Get CSRF token
    passed, csrf_token = test_1_csrf_token()
    results.append(("CSRF Token", passed))
    
    # Test 2: Login
    passed, access_token = test_2_login(csrf_token)
    results.append(("Login", passed))
    
    # Test 3: Happy path - payout digest with auth (CRITICAL)
    passed = test_3_payout_digest_happy_path(access_token)
    results.append(("Payout Digest Happy Path (CRITICAL)", passed))
    
    # Test 4: No auth - should reject (CRITICAL)
    passed = test_4_payout_digest_no_auth()
    results.append(("Payout Digest No Auth (CRITICAL)", passed))
    
    # Test 5: Router sanity check (CRITICAL)
    passed = test_5_notification_preferences(access_token)
    results.append(("Notification Router Sanity (CRITICAL)", passed))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed_count}/{total_count} tests passed ({passed_count*100//total_count}%)")
    
    # Critical tests
    critical_tests = [r for r in results if "CRITICAL" in r[0]]
    critical_passed = sum(1 for _, passed in critical_tests if passed)
    critical_total = len(critical_tests)
    
    print(f"Critical: {critical_passed}/{critical_total} tests passed")
    
    if critical_passed == critical_total:
        print("\n✅ ALL CRITICAL TESTS PASSED - DO BUILD FIX VERIFIED")
        return 0
    else:
        print("\n❌ SOME CRITICAL TESTS FAILED - ISSUE NOT FULLY RESOLVED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
