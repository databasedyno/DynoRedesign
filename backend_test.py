#!/usr/bin/env python3
"""
DynoPay Backend Testing Script
Tests the backend API after Railway PostgreSQL setup
Focus: Verify dashboard stats for hostbay@moxx.co (user with $18k+ transactions)
"""

import requests
import json
import redis
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://env-setup-preview-1.preview.emergentagent.com/api"
REDIS_URL = "redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# User-Agent header (required by backend)
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*80}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.RESET}")

def print_fail(message: str):
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.RESET}")

def print_response(response: requests.Response):
    print(f"\n{Colors.YELLOW}Response Status: {response.status_code}{Colors.RESET}")
    try:
        data = response.json()
        print(f"{Colors.YELLOW}Response Body:{Colors.RESET}")
        print(json.dumps(data, indent=2))
    except:
        print(f"{Colors.YELLOW}Response Body (raw):{Colors.RESET}")
        print(response.text[:500])

def test_health_check() -> bool:
    """Test 1: Health check (no auth)"""
    print_test("1. Health Check (GET /api/)")
    
    try:
        response = requests.get(f"{BASE_URL}/", headers={"User-Agent": HEADERS["User-Agent"]}, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "operational":
                print_pass("Health check returned 200 with status: operational")
                return True
            else:
                print_fail(f"Health check returned 200 but status is: {data.get('status')}")
                return False
        else:
            print_fail(f"Health check returned {response.status_code}, expected 200")
            return False
    except Exception as e:
        print_fail(f"Health check failed with exception: {str(e)}")
        return False

def get_redis_otp(session: str) -> Optional[str]:
    """Read OTP from Redis"""
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        key = f"login_otp:{session}:json"
        print_info(f"Reading Redis key: {key}")
        
        value = r.get(key)
        if value:
            data = json.loads(value)
            otp = data.get("otp")
            print_info(f"Found OTP in Redis: {otp}")
            return otp
        else:
            print_fail(f"No OTP found in Redis for key: {key}")
            return None
    except Exception as e:
        print_fail(f"Failed to read OTP from Redis: {str(e)}")
        return None

def test_login_flow() -> Optional[str]:
    """Test 2: Login flow for hostbay@moxx.co"""
    print_test("2. Login Flow for hostbay@moxx.co")
    
    try:
        # Step 1: POST /api/user/login
        print_info("Step 1: POST /api/user/login")
        login_payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = requests.post(
            f"{BASE_URL}/user/login",
            headers=HEADERS,
            json=login_payload,
            timeout=10
        )
        print_response(response)
        
        if response.status_code != 200:
            print_fail(f"Login request failed with status {response.status_code}")
            return None
        
        data = response.json()
        
        # Check if we got accessToken directly or need OTP flow
        if data.get("success") and "accessToken" in data.get("data", {}):
            access_token = data["data"]["accessToken"]
            print_pass(f"Login successful - got accessToken directly")
            return access_token
        
        # OTP flow
        data_obj = data.get("data", {})
        if "login_otp_session" in data_obj or "session" in data_obj:
            session = data_obj.get("login_otp_session") or data_obj.get("session")
            print_info(f"OTP flow required - session: {session}")
            
            # Step 2: Read OTP from Redis
            print_info("Step 2: Reading OTP from Redis")
            time.sleep(1)  # Wait a moment for Redis to be updated
            otp = get_redis_otp(session)
            
            if not otp:
                print_fail("Could not retrieve OTP from Redis")
                return None
            
            # Step 3: POST /api/user/verifyLoginOTP
            print_info("Step 3: POST /api/user/verifyLoginOTP")
            verify_payload = {
                "login_otp_session": session,
                "otp": otp
            }
            
            verify_response = requests.post(
                f"{BASE_URL}/user/verifyLoginOTP",
                headers=HEADERS,
                json=verify_payload,
                timeout=10
            )
            print_response(verify_response)
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                # Check both possible locations for accessToken
                access_token = None
                if "data" in verify_data:
                    if isinstance(verify_data["data"], dict):
                        access_token = verify_data["data"].get("accessToken")
                
                if access_token:
                    print_pass(f"OTP verification successful - got accessToken")
                    return access_token
                else:
                    print_fail("OTP verification response missing accessToken")
                    return None
            else:
                print_fail(f"OTP verification failed with status {verify_response.status_code}")
                return None
        
        print_fail("Login response format unexpected")
        return None
        
    except Exception as e:
        print_fail(f"Login flow failed with exception: {str(e)}")
        return None

def test_dashboard_stats(access_token: str) -> bool:
    """Test 3: Dashboard aggregate stats (KEY TEST)"""
    print_test("3. Dashboard Aggregate Stats (KEY TEST)")
    
    try:
        auth_headers = {
            **HEADERS,
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.get(
            f"{BASE_URL}/dashboard",
            headers=auth_headers,
            timeout=10
        )
        print_response(response)
        
        if response.status_code != 200:
            print_fail(f"Dashboard request failed with status {response.status_code}")
            return False
        
        data = response.json()
        
        # Check for required fields (backend doesn't always return "success" field)
        dashboard_data = data.get("data", {})
        
        # KEY CHECKS: total_transactions and total_volume
        total_transactions = dashboard_data.get("total_transactions", {})
        total_volume = dashboard_data.get("total_volume", {})
        
        print_info("\n=== KEY METRICS ===")
        print_info(f"total_transactions.count: {total_transactions.get('count')}")
        print_info(f"total_volume.amount: {total_volume.get('amount')}")
        print_info(f"total_volume.amount_formatted: {total_volume.get('amount_formatted')}")
        
        # Verify total_transactions.count > 0
        txn_count = total_transactions.get("count", 0)
        if txn_count > 0:
            print_pass(f"total_transactions.count = {txn_count} (> 0) ✓")
        else:
            print_fail(f"total_transactions.count = {txn_count} (expected > 0)")
            return False
        
        # Verify total_volume.amount > 0
        volume_amount = total_volume.get("amount", 0)
        if volume_amount > 0:
            print_pass(f"total_volume.amount = {volume_amount} (> 0) ✓")
        else:
            print_fail(f"total_volume.amount = {volume_amount} (expected > 0)")
            return False
        
        # Check other expected fields
        if "today_summary" in dashboard_data:
            print_pass("today_summary object present ✓")
        else:
            print_info("today_summary object missing (may be acceptable)")
        
        if "active_wallets" in dashboard_data:
            print_pass("active_wallets object present ✓")
        else:
            print_info("active_wallets object missing (may be acceptable)")
        
        print_pass("Dashboard stats test PASSED - user has transaction history")
        return True
        
    except Exception as e:
        print_fail(f"Dashboard stats test failed with exception: {str(e)}")
        return False

def test_get_companies(access_token: str) -> Optional[list]:
    """Test 4: Get companies for hostbay@moxx.co"""
    print_test("4. Get Companies")
    
    try:
        auth_headers = {
            **HEADERS,
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.get(
            f"{BASE_URL}/company/getCompany",
            headers=auth_headers,
            timeout=10
        )
        print_response(response)
        
        if response.status_code != 200:
            print_fail(f"Get companies request failed with status {response.status_code}")
            return None
        
        data = response.json()
        
        # Backend doesn't always return "success" field, check for data directly
        companies = data.get("data", [])
        print_info(f"\n=== COMPANIES ({len(companies)}) ===")
        for company in companies:
            company_id = company.get("company_id") or company.get("id")
            company_name = company.get("company_name") or company.get("name")
            print_info(f"  - ID: {company_id}, Name: {company_name}")
        
        print_pass(f"Found {len(companies)} companies")
        return companies
        
    except Exception as e:
        print_fail(f"Get companies test failed with exception: {str(e)}")
        return None

def test_recent_transactions(access_token: str) -> bool:
    """Test 5: Recent transactions"""
    print_test("5. Recent Transactions")
    
    try:
        auth_headers = {
            **HEADERS,
            "Authorization": f"Bearer {access_token}"
        }
        
        # Try /api/dashboard/recent-transactions first
        response = requests.get(
            f"{BASE_URL}/dashboard/recent-transactions",
            headers=auth_headers,
            timeout=10
        )
        
        print_info(f"Trying GET /api/dashboard/recent-transactions")
        print_response(response)
        
        if response.status_code == 404:
            print_info("Endpoint not found, trying alternative endpoints...")
            
            # Try /api/pay/getUserTransaction
            response = requests.get(
                f"{BASE_URL}/pay/getUserTransaction",
                headers=auth_headers,
                timeout=10
            )
            print_info(f"Trying GET /api/pay/getUserTransaction")
            print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            
            # Backend doesn't always return "success" field, check for data directly
            transactions_data = data.get("data", {})
            
            # Handle both array and object responses
            if isinstance(transactions_data, dict):
                transactions = transactions_data.get("transactions", [])
            else:
                transactions = transactions_data
            
            print_info(f"\n=== RECENT TRANSACTIONS ({len(transactions)}) ===")
            
            for i, txn in enumerate(transactions[:5], 1):
                status = txn.get("status", "unknown")
                amount = txn.get("amount") or txn.get("base_amount", 0)
                currency = txn.get("currency") or txn.get("base_currency", "")
                print_info(f"  {i}. Status: {status}, Amount: {amount} {currency}")
            
            print_pass(f"Found {len(transactions)} recent transactions")
            return True
        else:
            print_fail(f"Recent transactions request failed with status {response.status_code}")
            return False
        
    except Exception as e:
        print_fail(f"Recent transactions test failed with exception: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}DynoPay Backend Testing - Railway PostgreSQL Setup{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print(f"Redis: {REDIS_URL.split('@')[1]}")
    
    results = {}
    
    # Test 1: Health check
    results["health_check"] = test_health_check()
    
    # Test 2: Login flow
    access_token = test_login_flow()
    results["login_flow"] = access_token is not None
    
    if not access_token:
        print_fail("\n❌ Cannot proceed with authenticated tests - login failed")
        print_summary(results)
        return
    
    # Test 3: Dashboard stats (KEY TEST)
    results["dashboard_stats"] = test_dashboard_stats(access_token)
    
    # Test 4: Get companies
    companies = test_get_companies(access_token)
    results["get_companies"] = companies is not None
    
    # Test 5: Recent transactions
    results["recent_transactions"] = test_recent_transactions(access_token)
    
    # Print summary
    print_summary(results)

def print_summary(results: Dict[str, bool]):
    """Print test summary"""
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, passed_flag in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed_flag else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.BOLD}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED{Colors.RESET}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.RESET}")

if __name__ == "__main__":
    main()
