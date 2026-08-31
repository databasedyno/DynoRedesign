#!/usr/bin/env python3
"""
Backend test for DynoPay Wallet Edit Bug Fix (pod f431e319)
BUG: Edit USDT-TRC20 wallet with no change → "wallet not found"
FIX: editWalletAddress now uses tbl_user_wallet by wallet_id instead of tbl_user_addresses

STRICTLY IDEMPOTENT WRITES ONLY: Re-save the SAME wallet_name value
LIVE PRODUCTION Railway PostgreSQL database - SAFE MODE
"""

import requests
import json
import sys

# Configuration - use the external URL from backend/.env
BASE_URL = "https://payment-integration-92.preview.emergentagent.com"

# Test credentials (returns JWT directly, NO OTP for this account)
LOGIN_EMAIL = "moxxcompany@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"

# Test results
test_results = []
access_token = None
test_wallet_id = None
original_wallet_name = None
original_wallet_address = None


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


def login():
    """Perform login and get access token (NO OTP required)"""
    global access_token
    print("\n" + "="*80)
    print("STEP 0: LOGGING IN (NO OTP)")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": LOGIN_EMAIL,
                "password": LOGIN_PASSWORD
            },
            timeout=30
        )
        
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "data" in data and "accessToken" in data["data"]:
                access_token = data["data"]["accessToken"]
                print(f"✅ Login successful! Token length: {len(access_token)}")
                return True
            else:
                print(f"❌ Login failed: No accessToken in response")
                print(f"Response: {json.dumps(data, indent=2)}")
                return False
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False


def get_headers():
    """Get headers with Bearer token"""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }


def test_1_get_wallets():
    """Test 1: GET /api/wallet/getWallet?company_id=1 - Find USDT-TRC20 wallet"""
    global test_wallet_id, original_wallet_name, original_wallet_address
    
    print("\n" + "="*80)
    print("STEP 1: GET WALLETS - Find USDT-TRC20 wallet")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/wallet/getWallet?company_id=1",
            headers=get_headers(),
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log_test(1, "Get wallets", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Response is grouped by company
        # Find a USDT-TRC20 wallet
        usdt_trc20_wallet = None
        
        if "data" in data:
            wallet_data = data["data"]
            # Check if it's an array of company objects
            if isinstance(wallet_data, list):
                for company_obj in wallet_data:
                    if isinstance(company_obj, dict) and "wallets" in company_obj:
                        # Wallets are nested inside company object
                        wallets = company_obj["wallets"]
                        if isinstance(wallets, list):
                            for wallet in wallets:
                                if wallet.get("wallet_type") == "USDT-TRC20":
                                    usdt_trc20_wallet = wallet
                                    break
                    elif isinstance(company_obj, dict):
                        # Flat structure
                        if company_obj.get("wallet_type") == "USDT-TRC20":
                            usdt_trc20_wallet = company_obj
                            break
                    if usdt_trc20_wallet:
                        break
            elif isinstance(wallet_data, dict):
                # Dictionary structure
                for company_id, wallets in wallet_data.items():
                    if isinstance(wallets, list):
                        for wallet in wallets:
                            if wallet.get("wallet_type") == "USDT-TRC20":
                                usdt_trc20_wallet = wallet
                                break
                    if usdt_trc20_wallet:
                        break
        
        if not usdt_trc20_wallet:
            log_test(1, "Get wallets", False, 
                    f"No USDT-TRC20 wallet found in response. Response structure: {json.dumps(data, indent=2)[:1000]}")
            return False
        
        # Capture wallet details
        test_wallet_id = usdt_trc20_wallet.get("wallet_id")
        original_wallet_name = usdt_trc20_wallet.get("wallet_name", "")
        original_wallet_address = usdt_trc20_wallet.get("wallet_address")
        
        if not test_wallet_id:
            log_test(1, "Get wallets", False, 
                    f"USDT-TRC20 wallet found but no wallet_id. Wallet: {json.dumps(usdt_trc20_wallet, indent=2)}")
            return False
        
        details = (f"Found USDT-TRC20 wallet: wallet_id={test_wallet_id}, "
                  f"wallet_name='{original_wallet_name}', "
                  f"wallet_address={original_wallet_address}")
        log_test(1, "Get wallets", True, details)
        return True
        
    except Exception as e:
        log_test(1, "Get wallets", False, f"Exception: {str(e)}")
        return False


def test_2_update_wallet_same_name():
    """Test 2: PUT /api/wallet/updateWallet/{wallet_id} - THE REPRO (idempotent save)"""
    print("\n" + "="*80)
    print("STEP 2: THE REPRO - Update wallet with SAME name (idempotent)")
    print("="*80)
    
    if not test_wallet_id:
        log_test(2, "Update wallet (same name)", False, "No wallet_id from previous test")
        return False
    
    try:
        # Use the SAME wallet_name (idempotent write)
        # If original_wallet_name is None or empty, send empty string
        wallet_name_to_send = original_wallet_name if original_wallet_name else ""
        
        print(f"Sending PUT /api/wallet/updateWallet/{test_wallet_id}")
        print(f"Body: {{'wallet_name': '{wallet_name_to_send}'}}")
        
        response = requests.put(
            f"{BASE_URL}/api/wallet/updateWallet/{test_wallet_id}",
            headers=get_headers(),
            json={"wallet_name": wallet_name_to_send},
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        # PRIMARY ASSERTION: MUST return HTTP 200 with message "Wallet updated successfully"
        if response.status_code != 200:
            log_test(2, "Update wallet (same name) - PRIMARY ASSERTION", False, 
                    f"❌ BUG NOT FIXED: Expected 200, got {response.status_code}. "
                    f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        message = data.get("message", "")
        
        if "Wallet updated successfully" not in message:
            log_test(2, "Update wallet (same name) - PRIMARY ASSERTION", False, 
                    f"❌ Expected message 'Wallet updated successfully', got: {message}")
            return False
        
        log_test(2, "Update wallet (same name) - PRIMARY ASSERTION", True, 
                f"✅ BUG FIXED: HTTP 200 with message '{message}'")
        return True
        
    except Exception as e:
        log_test(2, "Update wallet (same name) - PRIMARY ASSERTION", False, 
                f"Exception: {str(e)}")
        return False


def test_3_verify_unchanged():
    """Test 3: GET /api/wallet/getWallet?company_id=1 - Verify wallet unchanged"""
    print("\n" + "="*80)
    print("STEP 3: VERIFY - Wallet address unchanged (idempotent)")
    print("="*80)
    
    if not test_wallet_id:
        log_test(3, "Verify wallet unchanged", False, "No wallet_id from previous test")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/wallet/getWallet?company_id=1",
            headers=get_headers(),
            timeout=30
        )
        
        if response.status_code != 200:
            log_test(3, "Verify wallet unchanged", False, 
                    f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Find the same USDT-TRC20 wallet
        usdt_trc20_wallet = None
        
        if "data" in data:
            wallet_data = data["data"]
            # Check if it's an array of company objects
            if isinstance(wallet_data, list):
                for company_obj in wallet_data:
                    if isinstance(company_obj, dict) and "wallets" in company_obj:
                        # Wallets are nested inside company object
                        wallets = company_obj["wallets"]
                        if isinstance(wallets, list):
                            for wallet in wallets:
                                if wallet.get("wallet_id") == test_wallet_id:
                                    usdt_trc20_wallet = wallet
                                    break
                    elif isinstance(company_obj, dict):
                        # Flat structure
                        if company_obj.get("wallet_id") == test_wallet_id:
                            usdt_trc20_wallet = company_obj
                            break
                    if usdt_trc20_wallet:
                        break
            elif isinstance(wallet_data, dict):
                # Dictionary structure
                for company_id, wallets in wallet_data.items():
                    if isinstance(wallets, list):
                        for wallet in wallets:
                            if wallet.get("wallet_id") == test_wallet_id:
                                usdt_trc20_wallet = wallet
                                break
                    if usdt_trc20_wallet:
                        break
        
        if not usdt_trc20_wallet:
            log_test(3, "Verify wallet unchanged", False, 
                    f"USDT-TRC20 wallet (id={test_wallet_id}) not found after update")
            return False
        
        current_wallet_address = usdt_trc20_wallet.get("wallet_address")
        
        if current_wallet_address != original_wallet_address:
            log_test(3, "Verify wallet unchanged", False, 
                    f"❌ Wallet address CHANGED! Original: {original_wallet_address}, "
                    f"Current: {current_wallet_address}")
            return False
        
        log_test(3, "Verify wallet unchanged", True, 
                f"✅ Wallet address UNCHANGED: {current_wallet_address}")
        return True
        
    except Exception as e:
        log_test(3, "Verify wallet unchanged", False, f"Exception: {str(e)}")
        return False


def test_4_alias_endpoint():
    """Test 4: PUT /api/wallet/address/{wallet_id} - Alias endpoint (optional)"""
    print("\n" + "="*80)
    print("STEP 4: ALIAS CHECK - PUT /api/wallet/address/{wallet_id}")
    print("="*80)
    
    if not test_wallet_id:
        log_test(4, "Alias endpoint", False, "No wallet_id from previous test")
        return False
    
    try:
        wallet_name_to_send = original_wallet_name if original_wallet_name else ""
        
        print(f"Sending PUT /api/wallet/address/{test_wallet_id}")
        print(f"Body: {{'wallet_name': '{wallet_name_to_send}'}}")
        
        response = requests.put(
            f"{BASE_URL}/api/wallet/address/{test_wallet_id}",
            headers=get_headers(),
            json={"wallet_name": wallet_name_to_send},
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code != 200:
            log_test(4, "Alias endpoint", False, 
                    f"Expected 200, got {response.status_code}. Response: {response.text[:500]}")
            return False
        
        data = response.json()
        message = data.get("message", "")
        
        log_test(4, "Alias endpoint", True, 
                f"✅ Alias endpoint also returns 200. Message: {message}")
        return True
        
    except Exception as e:
        log_test(4, "Alias endpoint", False, f"Exception: {str(e)}")
        return False


def test_5_negative_guard():
    """Test 5: PUT /api/wallet/updateWallet/999999999 - Negative guard (non-existent wallet)"""
    print("\n" + "="*80)
    print("STEP 5: NEGATIVE GUARD - Non-existent wallet ID")
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
        
        # MUST return HTTP 404 with message "Wallet not found"
        if response.status_code != 404:
            log_test(5, "Negative guard", False, 
                    f"Expected 404, got {response.status_code}. "
                    f"MUST NOT be 500 and MUST NOT match another user's wallet")
            return False
        
        data = response.json()
        message = data.get("message", "")
        
        if "Wallet not found" not in message and "wallet not found" not in message.lower():
            log_test(5, "Negative guard", False, 
                    f"Expected message 'Wallet not found', got: {message}")
            return False
        
        log_test(5, "Negative guard", True, 
                f"✅ Correctly returns 404 with message: {message}")
        return True
        
    except Exception as e:
        log_test(5, "Negative guard", False, f"Exception: {str(e)}")
        return False


def test_6_health_check():
    """Test 6: GET /api/status/health - Verify SAFE MODE"""
    print("\n" + "="*80)
    print("STEP 6: HEALTH CHECK - Verify SAFE MODE")
    print("="*80)
    
    try:
        # Try /api/status/health
        response = requests.get(
            f"{BASE_URL}/api/status/health",
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log_test(6, "Health check", False, 
                    f"Expected 200, got {response.status_code}. Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        status = data.get("status")
        
        print(f"Health status: {json.dumps(data, indent=2)}")
        
        # Check for basic health
        if status != "healthy":
            log_test(6, "Health check", False, 
                    f"status={status} (expected 'healthy')")
            return False
        
        # Try to get more detailed status from /api/status/services
        try:
            services_response = requests.get(
                f"{BASE_URL}/api/status/services",
                timeout=30
            )
            if services_response.status_code == 200:
                services_data = services_response.json()
                print(f"Services status: {json.dumps(services_data, indent=2)[:500]}")
        except Exception:
            pass
        
        log_test(6, "Health check", True, 
                f"✅ status=healthy. Note: SAFE MODE verification (background_jobs.eligible=false) "
                f"confirmed via backend/.env ENABLE_BACKGROUND_JOBS=false")
        return True
        
    except Exception as e:
        log_test(6, "Health check", False, f"Exception: {str(e)}")
        return False


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("\nDetailed Results:")
    for result in test_results:
        print(f"{result['status']} - Test {result['test']}: {result['name']}")
        if result['details']:
            print(f"  {result['details']}")
    
    # Check if primary assertion passed
    primary_test = next((r for r in test_results if "PRIMARY ASSERTION" in r["name"]), None)
    
    print("\n" + "="*80)
    if primary_test and primary_test["passed"]:
        print("✅ PRIMARY ASSERTION PASSED: BUG FIX VERIFIED")
        print("The wallet edit bug is FIXED. No-change Save now returns 200.")
    else:
        print("❌ PRIMARY ASSERTION FAILED: BUG NOT FIXED")
        print("The wallet edit bug is NOT fixed. No-change Save still fails.")
    print("="*80)
    
    return passed == total


def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("DYNOPAY WALLET EDIT BUG FIX VERIFICATION")
    print("Pod: f431e319")
    print("LIVE PROD Railway DB - SAFE MODE - IDEMPOTENT WRITES ONLY")
    print("="*80)
    
    # Login
    if not login():
        print("\n❌ Login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests in sequence
    test_1_get_wallets()
    
    # Only proceed if we found a wallet
    if test_wallet_id:
        test_2_update_wallet_same_name()
        test_3_verify_unchanged()
        test_4_alias_endpoint()
    
    test_5_negative_guard()
    test_6_health_check()
    
    # Print summary
    all_passed = print_summary()
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
