#!/usr/bin/env python3
"""
Session 97h Runtime Verification Test
Tests login flow, dashboard endpoints, payout digest, and wallet list
"""

import requests
import json
import sys

BASE_URL = "https://4dfe167f-c2a7-4997-96aa-49f477041630.preview.emergentagent.com"
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

def test_login_flow():
    """Test 3a: Login flow with CSRF token"""
    print("\n" + "="*80)
    print("TEST 3a: Login Flow")
    print("="*80)
    
    session = requests.Session()
    
    # Step 1: Get CSRF token
    print("\n[1/2] Getting CSRF token...")
    csrf_response = session.get(f"{BASE_URL}/api/csrf-token")
    print(f"Status: {csrf_response.status_code}")
    
    if csrf_response.status_code != 200:
        print(f"❌ FAIL: CSRF endpoint returned {csrf_response.status_code}")
        return None, None
    
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get("csrf_token") or csrf_data.get("csrfToken")
    
    if not csrf_token:
        print(f"❌ FAIL: No CSRF token in response")
        print(f"Response: {csrf_data}")
        return None, None
    
    print(f"CSRF Token: {csrf_token[:20]}...")
    
    # Step 2: Login
    print("\n[2/2] Logging in...")
    login_payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    login_response = session.post(
        f"{BASE_URL}/api/user/login",
        json=login_payload,
        headers={"X-CSRF-Token": csrf_token}
    )
    
    print(f"Status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"❌ FAIL: Login returned {login_response.status_code}")
        print(f"Response: {login_response.text[:500]}")
        return None, None
    
    login_data = login_response.json()
    
    # Verify response structure
    user_data = login_data.get("data", {}).get("userData", {})
    access_token = login_data.get("data", {}).get("accessToken")
    
    user_id = user_data.get("user_id")
    
    print(f"\nUser ID: {user_id}")
    print(f"Access Token: {access_token[:30] if access_token else 'None'}...")
    
    # Verify expected values
    if user_id == 1 and access_token:
        print("\n✅ PASS: Login successful")
        print(f"   - user_id === 1: ✓")
        print(f"   - accessToken is non-empty string: ✓")
        return session, access_token
    else:
        print(f"\n❌ FAIL: Login response invalid")
        print(f"   - Expected user_id=1, got {user_id}")
        print(f"   - Expected non-empty accessToken, got {bool(access_token)}")
        return None, None


def test_dashboard_stats(session, token):
    """Test 3b: Dashboard stats endpoint"""
    print("\n" + "="*80)
    print("TEST 3b: Dashboard Stats")
    print("="*80)
    
    response = session.get(
        f"{BASE_URL}/api/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Dashboard stats returned {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    
    data = response.json()
    
    # Check for data object
    if "data" in data:
        print(f"\n✅ PASS: Dashboard stats returned HTTP 200 with data object")
        print(f"Sample keys: {list(data.get('data', {}).keys())[:5]}")
        return True
    else:
        print(f"\n❌ FAIL: No 'data' object in response")
        print(f"Response keys: {list(data.keys())}")
        return False


def test_recent_transactions(session, token):
    """Test 3b: Recent transactions endpoint"""
    print("\n" + "="*80)
    print("TEST 3b: Recent Transactions")
    print("="*80)
    
    response = session.get(
        f"{BASE_URL}/api/dashboard/recent-transactions?limit=5",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Recent transactions returned {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    
    data = response.json()
    
    # Check for transactions list (can be data.transactions, transactions, or data array)
    transactions = None
    if isinstance(data.get("data"), dict) and "transactions" in data["data"]:
        transactions = data["data"]["transactions"]
    elif "transactions" in data:
        transactions = data["transactions"]
    elif isinstance(data.get("data"), list):
        transactions = data["data"]
    
    if transactions is not None:
        print(f"\n✅ PASS: Recent transactions returned HTTP 200 with transaction list")
        print(f"Transaction count: {len(transactions)}")
        return True
    else:
        print(f"\n❌ FAIL: No transaction list found in response")
        print(f"Response structure: {json.dumps(data, indent=2)[:500]}")
        return False


def test_payout_digest(session, token):
    """Test 3c: Payout digest preview endpoint"""
    print("\n" + "="*80)
    print("TEST 3c: Payout Digest Preview")
    print("="*80)
    
    response = session.post(
        f"{BASE_URL}/api/notifications/payout-digest/preview",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Payout digest returned {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    
    data = response.json()
    
    # Verify expected structure
    sent = data.get("data", {}).get("sent")
    settled_volume = data.get("data", {}).get("digest", {}).get("settledVolume")
    
    print(f"\nResponse data:")
    print(f"  - data.sent: {sent}")
    print(f"  - data.digest.settledVolume: {settled_volume}")
    
    if sent is True and isinstance(settled_volume, (int, float)):
        print(f"\n✅ PASS: Payout digest preview successful")
        print(f"   - data.sent === true: ✓")
        print(f"   - data.digest.settledVolume is a number: ✓")
        return True
    else:
        print(f"\n❌ FAIL: Payout digest response invalid")
        print(f"   - Expected sent=true, got {sent}")
        print(f"   - Expected settledVolume as number, got {type(settled_volume)}")
        return False


def test_wallet_list(session, token):
    """Test 3d: Wallet list endpoint"""
    print("\n" + "="*80)
    print("TEST 3d: Wallet List")
    print("="*80)
    
    response = session.get(
        f"{BASE_URL}/api/wallet/getWalletAddresses",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Wallet list returned {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    
    data = response.json()
    
    # Check for wallet array
    wallets = data.get("data") or data.get("wallets") or data
    
    if isinstance(wallets, list):
        print(f"\n✅ PASS: Wallet list returned HTTP 200 with wallet array")
        print(f"Wallet count: {len(wallets)}")
        return True
    else:
        print(f"\n❌ FAIL: No wallet array found in response")
        print(f"Response type: {type(wallets)}")
        return False


def main():
    print("\n" + "="*80)
    print("SESSION 97h RUNTIME VERIFICATION TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    
    results = {
        "test_1_backend_build": None,
        "test_2_frontend_tsc": None,
        "test_3a_login": False,
        "test_3b_dashboard_stats": False,
        "test_3b_recent_transactions": False,
        "test_3c_payout_digest": False,
        "test_3d_wallet_list": False
    }
    
    # Test 3a: Login
    session, token = test_login_flow()
    if session and token:
        results["test_3a_login"] = True
        
        # Test 3b: Dashboard endpoints
        results["test_3b_dashboard_stats"] = test_dashboard_stats(session, token)
        results["test_3b_recent_transactions"] = test_recent_transactions(session, token)
        
        # Test 3c: Payout digest
        results["test_3c_payout_digest"] = test_payout_digest(session, token)
        
        # Test 3d: Wallet list
        results["test_3d_wallet_list"] = test_wallet_list(session, token)
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    test_3_results = [
        ("3a. Login Flow", results["test_3a_login"]),
        ("3b. Dashboard Stats", results["test_3b_dashboard_stats"]),
        ("3b. Recent Transactions", results["test_3b_recent_transactions"]),
        ("3c. Payout Digest Preview", results["test_3c_payout_digest"]),
        ("3d. Wallet List", results["test_3d_wallet_list"])
    ]
    
    passed = sum(1 for _, result in test_3_results if result)
    total = len(test_3_results)
    
    print(f"\nTest 3 (Runtime Happy Paths): {passed}/{total} passed")
    for name, result in test_3_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {name}")
    
    # Overall result
    all_passed = all(result for _, result in test_3_results)
    
    if all_passed:
        print("\n" + "="*80)
        print("✅ ALL RUNTIME TESTS PASSED")
        print("="*80)
        return 0
    else:
        print("\n" + "="*80)
        print("❌ SOME RUNTIME TESTS FAILED")
        print("="*80)
        return 1


if __name__ == "__main__":
    sys.exit(main())
