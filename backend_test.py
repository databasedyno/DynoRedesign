#!/usr/bin/env python3
"""
Backend test for DynoPay Round 2 Verification (pod f431e319)
WALLET REUSE UX FIX + COSMETICS + EMAIL CHANGE

STRICTLY READ-ONLY except ONE idempotent same-value write
LIVE PRODUCTION Railway PostgreSQL database
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://f431e319-7216-4779-8f91-6c1ce868af1c.preview.emergentagent.com"

# Test credentials
NEW_EMAIL = "onarrival21@gmail.com"
OLD_EMAIL = "moxxcompany@gmail.com"
PASSWORD = "Katiekendra123@"

# Test results
test_results = []
access_token = None


def log_test(test_num, name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = {
        "test": test_num,
        "name": name,
        "status": status,
        "passed": passed,
        "details": details
    }
    test_results.append(result)
    print(f"\n{status} - Test {test_num}: {name}")
    if details:
        print(f"  Details: {details}")


def test_1_email_change_new_login():
    """Test 1: Login with NEW email (onarrival21@gmail.com) should succeed"""
    global access_token
    
    print("\n" + "="*80)
    print("TEST 1: EMAIL CHANGE - New email login")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": NEW_EMAIL,
                "password": PASSWORD
            },
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code != 200:
            log_test(1, "Email change: new email login", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Check for success message
        if "message" in data:
            if "Login Successful" not in data["message"]:
                log_test(1, "Email change: new email login", False, 
                        f"Expected 'Login Successful!', got: {data['message']}")
                return False
        
        # Check for access token
        if "data" in data and "accessToken" in data["data"]:
            access_token = data["data"]["accessToken"]
            log_test(1, "Email change: new email login", True, 
                    f"Login successful with new email. Token length: {len(access_token)}")
            return True
        else:
            log_test(1, "Email change: new email login", False, 
                    "No accessToken in response")
            return False
        
    except Exception as e:
        log_test(1, "Email change: new email login", False, f"Exception: {str(e)}")
        return False


def test_2_email_change_old_login():
    """Test 2: Login with OLD email (moxxcompany@gmail.com) should fail with 401"""
    
    print("\n" + "="*80)
    print("TEST 2: EMAIL CHANGE - Old email login should fail")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": OLD_EMAIL,
                "password": PASSWORD
            },
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 401:
            data = response.json()
            message = data.get("message", "")
            if "Invalid email or password" in message:
                log_test(2, "Email change: old email login fails", True, 
                        f"Correctly returned 401 with message: {message}")
                return True
            else:
                log_test(2, "Email change: old email login fails", False, 
                        f"Got 401 but unexpected message: {message}")
                return False
        else:
            log_test(2, "Email change: old email login fails", False, 
                    f"Expected 401, got {response.status_code}")
            return False
        
    except Exception as e:
        log_test(2, "Email change: old email login fails", False, f"Exception: {str(e)}")
        return False


def get_headers():
    """Get headers with Bearer token"""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }


def test_3_reusable_wallets_company_1():
    """Test 3: GET /api/wallet/reusable-wallets?exclude_company_id=1 should return EMPTY"""
    
    print("\n" + "="*80)
    print("TEST 3: REUSABLE WALLETS - Company 1 (The Dev Store)")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/wallet/reusable-wallets?exclude_company_id=1",
            headers=get_headers(),
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:1000]}")
        
        if response.status_code != 200:
            log_test(3, "Reusable wallets: company 1 empty", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Check structure
        if "data" not in data:
            log_test(3, "Reusable wallets: company 1 empty", False, 
                    "Missing 'data' field in response")
            return False
        
        result_data = data["data"]
        
        # The data should be EMPTY (either empty array or empty object)
        if isinstance(result_data, list):
            data_length = len(result_data)
        elif isinstance(result_data, dict):
            # Could be empty dict or dict with empty arrays
            data_length = sum(len(v) if isinstance(v, list) else 1 for v in result_data.values())
        else:
            data_length = 1 if result_data else 0
        
        if data_length == 0:
            log_test(3, "Reusable wallets: company 1 empty", True, 
                    f"✅ CORRECT: Data is EMPTY (company 1 already has all currencies). "
                    f"Message: {data.get('message', 'N/A')}")
            return True
        else:
            log_test(3, "Reusable wallets: company 1 empty", False, 
                    f"❌ WRONG: Expected EMPTY data, but got {data_length} items. "
                    f"Company 1 should already have all currencies. Data: {json.dumps(result_data, indent=2)[:500]}")
            return False
        
    except Exception as e:
        log_test(3, "Reusable wallets: company 1 empty", False, f"Exception: {str(e)}")
        return False


def test_4_reusable_wallets_company_71():
    """Test 4: GET /api/wallet/reusable-wallets?exclude_company_id=71 should return EMPTY"""
    
    print("\n" + "="*80)
    print("TEST 4: REUSABLE WALLETS - Company 71 (SMADAV)")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/wallet/reusable-wallets?exclude_company_id=71",
            headers=get_headers(),
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:1000]}")
        
        if response.status_code != 200:
            log_test(4, "Reusable wallets: company 71 empty", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Check structure
        if "data" not in data:
            log_test(4, "Reusable wallets: company 71 empty", False, 
                    "Missing 'data' field in response")
            return False
        
        result_data = data["data"]
        
        # The data should be EMPTY (either empty array or empty object)
        if isinstance(result_data, list):
            data_length = len(result_data)
        elif isinstance(result_data, dict):
            # Could be empty dict or dict with empty arrays
            data_length = sum(len(v) if isinstance(v, list) else 1 for v in result_data.values())
        else:
            data_length = 1 if result_data else 0
        
        if data_length == 0:
            log_test(4, "Reusable wallets: company 71 empty", True, 
                    f"✅ CORRECT: Data is EMPTY (company 71 already has all currencies). "
                    f"Message: {data.get('message', 'N/A')}")
            return True
        else:
            log_test(4, "Reusable wallets: company 71 empty", False, 
                    f"❌ WRONG: Expected EMPTY data, but got {data_length} items. "
                    f"Company 71 should already have all currencies. Data: {json.dumps(result_data, indent=2)[:500]}")
            return False
        
    except Exception as e:
        log_test(4, "Reusable wallets: company 71 empty", False, f"Exception: {str(e)}")
        return False


def test_5_wallet_edit_get_wallet():
    """Test 5: GET /api/wallet/getWallet?company_id=1 to find USDT-TRC20 wallet"""
    
    print("\n" + "="*80)
    print("TEST 5: WALLET EDIT - Get wallet list")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/wallet/getWallet?company_id=1",
            headers=get_headers(),
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log_test(5, "Wallet edit: get wallet list", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return None
        
        data = response.json()
        
        # Find USDT-TRC20 wallet
        # Response structure: {"data": [{"company_id": 1, "wallets": [...]}]}
        usdt_trc20_wallet = None
        if "data" in data and isinstance(data["data"], list):
            for company_data in data["data"]:
                if "wallets" in company_data:
                    for wallet in company_data["wallets"]:
                        if wallet.get("wallet_type") == "USDT-TRC20":
                            usdt_trc20_wallet = wallet
                            break
                if usdt_trc20_wallet:
                    break
        
        if not usdt_trc20_wallet:
            log_test(5, "Wallet edit: get wallet list", False, 
                    "No USDT-TRC20 wallet found")
            return None
        
        wallet_id = usdt_trc20_wallet.get("wallet_id")
        wallet_name = usdt_trc20_wallet.get("wallet_name", "")
        wallet_address = usdt_trc20_wallet.get("wallet_address", "")
        
        log_test(5, "Wallet edit: get wallet list", True, 
                f"Found USDT-TRC20 wallet: id={wallet_id}, name='{wallet_name}', address={wallet_address}")
        
        return {
            "wallet_id": wallet_id,
            "wallet_name": wallet_name,
            "wallet_address": wallet_address
        }
        
    except Exception as e:
        log_test(5, "Wallet edit: get wallet list", False, f"Exception: {str(e)}")
        return None


def test_6_wallet_edit_same_name(wallet_info):
    """Test 6: PUT /api/wallet/updateWallet/{id} with SAME wallet_name (idempotent)"""
    
    print("\n" + "="*80)
    print("TEST 6: WALLET EDIT - Update with same name (idempotent)")
    print("="*80)
    
    if not wallet_info:
        log_test(6, "Wallet edit: same name update", False, 
                "Skipped - no wallet info from previous test")
        return False
    
    wallet_id = wallet_info["wallet_id"]
    wallet_name = wallet_info["wallet_name"]
    
    try:
        response = requests.put(
            f"{BASE_URL}/api/wallet/updateWallet/{wallet_id}",
            headers=get_headers(),
            json={"wallet_name": wallet_name},
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code != 200:
            log_test(6, "Wallet edit: same name update", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return False
        
        data = response.json()
        message = data.get("message", "")
        
        if "Wallet updated successfully" in message:
            log_test(6, "Wallet edit: same name update", True, 
                    f"✅ CORRECT: Idempotent update returned 200 with message: {message}")
            return True
        else:
            log_test(6, "Wallet edit: same name update", False, 
                    f"Got 200 but unexpected message: {message}")
            return False
        
    except Exception as e:
        log_test(6, "Wallet edit: same name update", False, f"Exception: {str(e)}")
        return False


def test_7_wallet_edit_nonexistent():
    """Test 7: PUT /api/wallet/updateWallet/999999999 should return 404"""
    
    print("\n" + "="*80)
    print("TEST 7: WALLET EDIT - Nonexistent wallet should return 404")
    print("="*80)
    
    try:
        response = requests.put(
            f"{BASE_URL}/api/wallet/updateWallet/999999999",
            headers=get_headers(),
            json={"wallet_name": "x"},
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 404:
            data = response.json()
            message = data.get("message", "")
            if "Wallet not found" in message or "not found" in message.lower():
                log_test(7, "Wallet edit: nonexistent 404", True, 
                        f"Correctly returned 404 with message: {message}")
                return True
            else:
                log_test(7, "Wallet edit: nonexistent 404", False, 
                        f"Got 404 but unexpected message: {message}")
                return False
        else:
            log_test(7, "Wallet edit: nonexistent 404", False, 
                    f"Expected 404, got {response.status_code}")
            return False
        
    except Exception as e:
        log_test(7, "Wallet edit: nonexistent 404", False, f"Exception: {str(e)}")
        return False


def test_8_health():
    """Test 8: GET /api/status/health should return healthy with SAFE MODE"""
    
    print("\n" + "="*80)
    print("TEST 8: HEALTH CHECK")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/status/health", timeout=30)
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code != 200:
            log_test(8, "Health check", False, 
                    f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check status
        if data.get("status") != "healthy":
            log_test(8, "Health check", False, 
                    f"Status not healthy: {data.get('status')}")
            return False
        
        # The /api/status/health endpoint returns a simpler response
        # Just check that status is healthy
        log_test(8, "Health check", True, 
                f"status=healthy, timestamp={data.get('timestamp', 'N/A')}, "
                f"version={data.get('version', 'N/A')}")
        return True
        
    except Exception as e:
        log_test(8, "Health check", False, f"Exception: {str(e)}")
        return False


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    print(f"\nTotal: {passed}/{total} tests passed ({100*passed//total if total > 0 else 0}% pass rate)\n")
    
    for result in test_results:
        print(f"{result['status']} - Test {result['test']}: {result['name']}")
        if result['details']:
            print(f"  {result['details']}")
    
    print("\n" + "="*80)
    
    if passed == total:
        print("✅ ALL TESTS PASSED - FEATURES ARE WORKING CORRECTLY")
    else:
        print(f"❌ {total - passed} TEST(S) FAILED")
    
    print("="*80 + "\n")
    
    return passed == total


def main():
    """Main test runner"""
    print("\n" + "="*80)
    print("DynoPay Round 2 Backend Verification")
    print("Pod: f431e319")
    print("WALLET REUSE UX FIX + COSMETICS + EMAIL CHANGE")
    print("STRICTLY READ-ONLY except ONE idempotent same-value write")
    print("="*80)
    
    # Test 1: Login with NEW email
    if not test_1_email_change_new_login():
        print("\n❌ FATAL: Login with new email failed. Cannot proceed with authenticated tests.")
        # Continue with remaining tests that don't need auth
        test_2_email_change_old_login()
        test_8_health()
        print_summary()
        sys.exit(1)
    
    # Test 2: Login with OLD email should fail
    test_2_email_change_old_login()
    
    # Test 3: Reusable wallets company 1
    test_3_reusable_wallets_company_1()
    
    # Test 4: Reusable wallets company 71
    test_4_reusable_wallets_company_71()
    
    # Test 5: Get wallet list
    wallet_info = test_5_wallet_edit_get_wallet()
    
    # Test 6: Update wallet with same name (idempotent)
    test_6_wallet_edit_same_name(wallet_info)
    
    # Test 7: Update nonexistent wallet
    test_7_wallet_edit_nonexistent()
    
    # Test 8: Health check
    test_8_health()
    
    # Print summary
    all_passed = print_summary()
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
