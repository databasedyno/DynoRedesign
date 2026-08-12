#!/usr/bin/env python3
"""
Session 97i Runtime Regression Test
Tests HTTP endpoints to ensure no runtime regressions after strict TS flip
"""

import requests
import json
import sys

BASE_URL = "https://payment-hub-test-2.preview.emergentagent.com"

def test_3a_login():
    """Test 3a: Login flow with CSRF + credentials"""
    print("\n" + "="*80)
    print("TEST 3a: Login Flow (CSRF → POST /api/user/login)")
    print("="*80)
    
    session = requests.Session()
    
    # Step 1: Get CSRF token
    print("\n[Step 1] Getting CSRF token...")
    csrf_response = session.get(f"{BASE_URL}/api/csrf-token")
    print(f"  Status: {csrf_response.status_code}")
    
    if csrf_response.status_code != 200:
        print(f"  ❌ FAIL: Expected 200, got {csrf_response.status_code}")
        return None, None
    
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get("csrf_token")
    
    if not csrf_token:
        print(f"  ❌ FAIL: No CSRF token in response")
        print(f"  Response: {json.dumps(csrf_data, indent=2)}")
        return None, None
    
    print(f"  ✅ CSRF token obtained: {csrf_token[:20]}...")
    
    # Step 2: Login with credentials
    print("\n[Step 2] Logging in with hostbay@moxx.co...")
    login_payload = {
        "email": "hostbay@moxx.co",
        "password": "Katiekendra123@"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf_token
    }
    
    login_response = session.post(
        f"{BASE_URL}/api/user/login",
        json=login_payload,
        headers=headers
    )
    
    print(f"  Status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"  ❌ FAIL: Expected 200, got {login_response.status_code}")
        print(f"  Response: {login_response.text[:500]}")
        return None, None
    
    login_data = login_response.json()
    
    # Verify response structure
    if "data" not in login_data:
        print(f"  ❌ FAIL: Missing 'data' in response")
        print(f"  Response: {json.dumps(login_data, indent=2)[:500]}")
        return None, None
    
    user_data = login_data["data"].get("userData", {})
    access_token = login_data["data"].get("accessToken")
    
    user_id = user_data.get("user_id")
    
    print(f"  User ID: {user_id}")
    print(f"  Access Token: {access_token[:30] if access_token else 'None'}...")
    
    # Verify expected values
    if user_id != 1:
        print(f"  ❌ FAIL: Expected user_id === 1, got {user_id}")
        return None, None
    
    if not access_token:
        print(f"  ❌ FAIL: accessToken is empty")
        return None, None
    
    print(f"  ✅ PASS: Login successful, user_id === 1, accessToken present")
    
    return access_token, session


def test_3b_dashboard_stats(access_token, session):
    """Test 3b: Dashboard stats endpoint"""
    print("\n" + "="*80)
    print("TEST 3b: Dashboard Stats (GET /api/dashboard)")
    print("="*80)
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    print("\n[Request] GET /api/dashboard with Bearer token...")
    response = session.get(f"{BASE_URL}/api/dashboard", headers=headers)
    
    print(f"  Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        return False
    
    data = response.json()
    
    if "data" not in data:
        print(f"  ❌ FAIL: Missing 'data' object in response")
        print(f"  Response: {json.dumps(data, indent=2)[:500]}")
        return False
    
    print(f"  ✅ PASS: HTTP 200 with data object")
    print(f"  Data preview: {json.dumps(data['data'], indent=2)[:300]}...")
    
    return True


def test_3c_payout_digest(access_token, session):
    """Test 3c: Payout digest preview endpoint"""
    print("\n" + "="*80)
    print("TEST 3c: Payout Digest Preview (POST /api/notifications/payout-digest/preview)")
    print("="*80)
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    print("\n[Request] POST /api/notifications/payout-digest/preview with Bearer token...")
    response = session.post(
        f"{BASE_URL}/api/notifications/payout-digest/preview",
        headers=headers,
        json={}
    )
    
    print(f"  Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        return False
    
    data = response.json()
    
    # Verify response structure
    if "data" not in data:
        print(f"  ❌ FAIL: Missing 'data' in response")
        print(f"  Response: {json.dumps(data, indent=2)[:500]}")
        return False
    
    sent = data["data"].get("sent")
    digest = data["data"].get("digest", {})
    settled_volume = digest.get("settledVolume")
    
    print(f"  data.sent: {sent}")
    print(f"  data.digest.settledVolume: {settled_volume}")
    
    # Verify expected values
    if sent != True:
        print(f"  ❌ FAIL: Expected data.sent === true, got {sent}")
        return False
    
    if not isinstance(settled_volume, (int, float)):
        print(f"  ❌ FAIL: Expected data.digest.settledVolume to be a number, got {type(settled_volume)}")
        return False
    
    print(f"  ✅ PASS: HTTP 200, data.sent === true, data.digest.settledVolume is a number")
    print(f"  Full digest preview:")
    print(json.dumps(digest, indent=2))
    
    return True


def main():
    print("\n" + "="*80)
    print("SESSION 97i RUNTIME REGRESSION TEST")
    print("Verify strict `next build` succeeds + no runtime regression")
    print("="*80)
    
    results = {
        "3a_login": False,
        "3b_dashboard": False,
        "3c_payout_digest": False
    }
    
    # Test 3a: Login
    access_token, session = test_3a_login()
    if access_token:
        results["3a_login"] = True
    else:
        print("\n❌ Login failed, cannot proceed with remaining tests")
        print_summary(results)
        sys.exit(1)
    
    # Test 3b: Dashboard stats
    results["3b_dashboard"] = test_3b_dashboard_stats(access_token, session)
    
    # Test 3c: Payout digest
    results["3c_payout_digest"] = test_3c_payout_digest(access_token, session)
    
    # Print summary
    print_summary(results)
    
    # Exit with appropriate code
    if all(results.values()):
        sys.exit(0)
    else:
        sys.exit(1)


def print_summary(results):
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASS" if passed_flag else "❌ FAIL"
        print(f"  {test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if all(results.values()):
        print("\n✅ ALL RUNTIME TESTS PASSED - NO REGRESSIONS DETECTED")
    else:
        print("\n❌ SOME TESTS FAILED - RUNTIME REGRESSIONS DETECTED")


if __name__ == "__main__":
    main()
