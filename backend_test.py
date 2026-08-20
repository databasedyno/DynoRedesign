#!/usr/bin/env python3
"""
Backend Regression Test for R2 Refactor
Tests refactored auth, wallet, and settlement endpoints
READ-ONLY testing on LIVE production database
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8001"
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name: str, passed: bool, details: str = ""):
    status = f"{Colors.GREEN}✅ PASS{Colors.END}" if passed else f"{Colors.RED}❌ FAIL{Colors.END}"
    print(f"{status} - {name}")
    if details:
        print(f"  {details}")

def print_section(name: str):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")

# Step 6: Health Check
def test_health():
    print_section("STEP 6: Health Check")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        data = response.json()
        
        passed = (
            response.status_code == 200 and
            data.get("status") == "healthy" and
            data.get("database") == "connected" and
            data.get("redis") == "connected" and
            data.get("background_jobs", {}).get("eligible") == False
        )
        
        details = f"Status: {data.get('status')}, DB: {data.get('database')}, Redis: {data.get('redis')}, BG Jobs: {data.get('background_jobs', {}).get('eligible')}"
        print_test("GET /health", passed, details)
        return passed
    except Exception as e:
        print_test("GET /health", False, f"Error: {str(e)}")
        return False

# Step 7: Status Check
def test_status():
    print_section("STEP 7: Status Check")
    try:
        response = requests.get(f"{BASE_URL}/api/status", timeout=10)
        data = response.json()
        
        passed = (
            response.status_code == 200 and
            data.get("data", {}).get("overall_status") == "operational"
        )
        
        details = f"Overall Status: {data.get('data', {}).get('overall_status')}"
        print_test("GET /api/status", passed, details)
        return passed
    except Exception as e:
        print_test("GET /api/status", False, f"Error: {str(e)}")
        return False

# Step 8: Refactored Auth Path
def test_auth():
    print_section("STEP 8: Refactored Auth Path (userController)")
    
    # Step 8a: Check Email
    try:
        response = requests.get(
            f"{BASE_URL}/api/user/checkEmail",
            params={"email": TEST_EMAIL},
            timeout=10
        )
        data = response.json()
        
        passed_check = (
            response.status_code == 200 and
            data.get("data", {}).get("validEmail") == True
        )
        
        details = f"Valid Email: {data.get('data', {}).get('validEmail')}"
        print_test("GET /api/user/checkEmail", passed_check, details)
        
        if not passed_check:
            return None
    except Exception as e:
        print_test("GET /api/user/checkEmail", False, f"Error: {str(e)}")
        return None
    
    # Step 8b: Login (2-step flow)
    try:
        # Get CSRF token first
        csrf_response = requests.get(f"{BASE_URL}/api/csrf-token", timeout=10)
        csrf_token = csrf_response.json().get("csrf_token")
        
        # Login with email and password
        login_response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            },
            headers={
                "X-CSRF-Token": csrf_token,
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        login_data = login_response.json()
        
        passed_login = (
            login_response.status_code == 200 and
            "accessToken" in login_data.get("data", {})
        )
        
        token = login_data.get("data", {}).get("accessToken") if passed_login else None
        details = f"Token received: {bool(token)}"
        print_test("POST /api/user/login", passed_login, details)
        
        if not passed_login or not token:
            return None
            
    except Exception as e:
        print_test("POST /api/user/login", False, f"Error: {str(e)}")
        return None
    
    # Step 8c: Get Profile with Bearer Token
    try:
        profile_response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        profile_data = profile_response.json()
        
        passed_profile = (
            profile_response.status_code == 200 and
            profile_data.get("data", {}).get("email") == TEST_EMAIL
        )
        
        details = f"Email: {profile_data.get('data', {}).get('email')}, Name: {profile_data.get('data', {}).get('name')}"
        print_test("GET /api/user/profile", passed_profile, details)
        
        return token if passed_profile else None
        
    except Exception as e:
        print_test("GET /api/user/profile", False, f"Error: {str(e)}")
        return None

# Step 9: Refactored Wallet Path
def test_wallet(token: str):
    print_section("STEP 9: Refactored Wallet Path (walletController)")
    
    # Step 9a: Get Wallet List
    try:
        wallet_response = requests.get(
            f"{BASE_URL}/api/wallet/getWallet",
            params={"company_id": 1},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        wallet_data = wallet_response.json()
        # Response structure: { "data": [ { "wallets": [...] } ] }
        wallets = []
        if isinstance(wallet_data.get("data"), list) and len(wallet_data.get("data", [])) > 0:
            wallets = wallet_data["data"][0].get("wallets", [])
        
        passed_wallet = (
            wallet_response.status_code == 200 and
            len(wallets) > 0
        )
        
        details = f"Wallets count: {len(wallets)} (expected ~13)"
        print_test("GET /api/wallet/getWallet", passed_wallet, details)
        
        if not passed_wallet:
            return False
            
    except Exception as e:
        print_test("GET /api/wallet/getWallet", False, f"Error: {str(e)}")
        return False
    
    # Step 9b: Get Transactions List
    try:
        tx_response = requests.post(
            f"{BASE_URL}/api/wallet/getAllTransactions",
            json={
                "company_id": 1,
                "rowsPerPage": 10,
                "page": 1
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        tx_data = tx_response.json()
        transactions = tx_data.get("data", {}).get("customers_transactions", [])
        
        passed_tx = (
            tx_response.status_code == 200 and
            isinstance(transactions, list)
        )
        
        details = f"Transactions returned: {len(transactions)}"
        print_test("POST /api/wallet/getAllTransactions", passed_tx, details)
        
        return passed_tx
        
    except Exception as e:
        print_test("POST /api/wallet/getAllTransactions", False, f"Error: {str(e)}")
        return False

# Step 10: Settlement Facade Auth Gate
def test_settlement_auth():
    print_section("STEP 10: Settlement Facade Auth Gate")
    
    # Test with no auth
    try:
        response = requests.post(
            f"{BASE_URL}/api/pay/receipt",
            json={"address": "test"},
            timeout=10
        )
        
        passed = response.status_code in [403, 401]
        
        details = f"Status: {response.status_code} (expected 403/401)"
        print_test("POST /api/pay/receipt (no auth)", passed, details)
        
        if not passed:
            return False
            
    except Exception as e:
        print_test("POST /api/pay/receipt (no auth)", False, f"Error: {str(e)}")
        return False
    
    # Test with invalid token
    try:
        response = requests.post(
            f"{BASE_URL}/api/pay/receipt",
            json={"address": "test"},
            headers={
                "Authorization": "Bearer invalid.token.here",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        passed = response.status_code in [403, 401]
        
        details = f"Status: {response.status_code} (expected 403/401)"
        print_test("POST /api/pay/receipt (invalid token)", passed, details)
        
        return passed
        
    except Exception as e:
        print_test("POST /api/pay/receipt (invalid token)", False, f"Error: {str(e)}")
        return False

# Step 11: Tickers/Rates Endpoint
def test_rates():
    print_section("STEP 11: Tickers/Rates Endpoint")
    
    try:
        response = requests.get(f"{BASE_URL}/api/public/tickers", timeout=10)
        data = response.json()
        
        # The response structure is { "BTC": { "usd": 123.45, ... }, ... }
        passed = (
            response.status_code == 200 and
            isinstance(data, dict) and
            len(data) > 0
        )
        
        details = f"Tickers count: {len(data)}, Sample currencies: {list(data.keys())[:5]}"
        print_test("GET /api/public/tickers", passed, details)
        
        return passed
        
    except Exception as e:
        print_test("GET /api/public/tickers", False, f"Error: {str(e)}")
        return False

def main():
    print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
    print(f"{Colors.YELLOW}Backend Regression Test - R2 Refactor Verification{Colors.END}")
    print(f"{Colors.YELLOW}READ-ONLY testing on LIVE production database{Colors.END}")
    print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
    
    results = {}
    
    # Run all tests
    results['health'] = test_health()
    results['status'] = test_status()
    
    token = test_auth()
    results['auth'] = token is not None
    
    if token:
        results['wallet'] = test_wallet(token)
    else:
        print(f"\n{Colors.RED}Skipping wallet tests - auth failed{Colors.END}")
        results['wallet'] = False
    
    results['settlement'] = test_settlement_auth()
    results['rates'] = test_rates()
    
    # Summary
    print_section("SUMMARY")
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    print(f"\nTotal Tests: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {total - passed}{Colors.END}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}✅ ALL TESTS PASSED{Colors.END}")
        return 0
    else:
        print(f"\n{Colors.RED}❌ SOME TESTS FAILED{Colors.END}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
