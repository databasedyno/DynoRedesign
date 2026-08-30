#!/usr/bin/env python3
"""
Session 97f Runtime Regression Tests
Tests login flow + checkout flow to verify type changes didn't break runtime behavior
"""

import requests
import json
import sys

BASE_URL = "https://gateway-config-1.preview.emergentagent.com"

def test_3a_csrf_token():
    """Test 3a: GET /api/csrf-token"""
    print("\n=== Test 3a: GET /api/csrf-token ===")
    
    session = requests.Session()
    response = session.get(f"{BASE_URL}/api/csrf-token")
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:200]}")
    
    if response.status_code != 200:
        print("❌ FAIL: Expected HTTP 200")
        return None, None
    
    data = response.json()
    csrf_token = data.get('csrfToken') or data.get('csrf_token')
    
    if not csrf_token:
        print("❌ FAIL: No csrfToken/csrf_token in response")
        return None, None
    
    print(f"✅ PASS: Got CSRF token: {csrf_token[:20]}...")
    return session, csrf_token


def test_3b_login(session, csrf_token):
    """Test 3b: POST /api/user/login"""
    print("\n=== Test 3b: POST /api/user/login ===")
    
    if not session or not csrf_token:
        print("❌ SKIP: No session/csrf from previous test")
        return None, None
    
    login_data = {
        "email": "hostbay@moxx.co",
        "password": "Katiekendra123@"
    }
    
    headers = {
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json"
    }
    
    response = session.post(
        f"{BASE_URL}/api/user/login",
        json=login_data,
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected HTTP 200, got {response.status_code}")
        return None, None
    
    data = response.json()
    access_token = data.get('data', {}).get('accessToken')
    user_id = data.get('data', {}).get('userData', {}).get('user_id')
    
    if not access_token:
        print("❌ FAIL: No accessToken in response")
        return None, None
    
    if user_id != 1:
        print(f"❌ FAIL: Expected user_id=1, got {user_id}")
        return None, None
    
    print(f"✅ PASS: Login successful, user_id={user_id}, token={access_token[:20]}...")
    return session, access_token


def test_3c_recent_transactions(session, access_token):
    """Test 3c: GET /api/dashboard/recent-transactions?limit=5"""
    print("\n=== Test 3c: GET /api/dashboard/recent-transactions?limit=5 ===")
    
    if not session or not access_token:
        print("❌ SKIP: No session/token from previous test")
        return False
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    response = session.get(
        f"{BASE_URL}/api/dashboard/recent-transactions?limit=5",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected HTTP 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    # Check for array in various possible locations
    transactions = None
    if isinstance(data.get('data', {}).get('transactions'), list):
        transactions = data['data']['transactions']
    elif isinstance(data.get('transactions'), list):
        transactions = data['transactions']
    elif isinstance(data.get('data'), list):
        transactions = data['data']
    
    if transactions is None:
        print(f"❌ FAIL: No transactions array found in response")
        print(f"Response keys: {list(data.keys())}")
        return False
    
    print(f"✅ PASS: Got transactions array with {len(transactions)} items")
    return True


def test_3d_payout_digest(session, access_token):
    """Test 3d: POST /api/notifications/payout-digest/preview"""
    print("\n=== Test 3d: POST /api/notifications/payout-digest/preview ===")
    
    if not session or not access_token:
        print("❌ SKIP: No session/token from previous test")
        return False
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    response = session.post(
        f"{BASE_URL}/api/notifications/payout-digest/preview",
        headers=headers,
        json={}
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:800]}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected HTTP 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    sent = data.get('data', {}).get('sent')
    settled_volume = data.get('data', {}).get('digest', {}).get('settledVolume')
    
    if sent != True:
        print(f"❌ FAIL: Expected data.sent === true, got {sent}")
        return False
    
    if not isinstance(settled_volume, (int, float)):
        print(f"❌ FAIL: Expected data.digest.settledVolume to be a number, got {type(settled_volume)}")
        return False
    
    print(f"✅ PASS: Payout digest sent={sent}, settledVolume={settled_volume}")
    return True


def main():
    print("=" * 80)
    print("SESSION 97f RUNTIME REGRESSION TESTS")
    print("=" * 80)
    
    # Test 3a
    session, csrf_token = test_3a_csrf_token()
    
    # Test 3b
    session, access_token = test_3b_login(session, csrf_token)
    
    # Test 3c
    test_3c_result = test_3c_recent_transactions(session, access_token)
    
    # Test 3d
    test_3d_result = test_3d_payout_digest(session, access_token)
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    all_passed = (
        session is not None and 
        csrf_token is not None and 
        access_token is not None and 
        test_3c_result and 
        test_3d_result
    )
    
    if all_passed:
        print("✅ ALL RUNTIME TESTS PASSED")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
