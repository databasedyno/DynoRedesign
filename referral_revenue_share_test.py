#!/usr/bin/env python3
"""
Referral Revenue-Share Phase 1 Backend Verification
STRICTLY READ-ONLY testing on LIVE prod Railway Postgres in SAFE MODE.
NO mutations, NO creating/redeeming referral codes, NO payments/emails.

Merchant login: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1)
Backend base URL: https://setup-credentials.preview.emergentagent.com
Health endpoint: localhost:8001 (NOT exposed via external ingress)
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BACKEND_BASE_URL = "https://setup-credentials.preview.emergentagent.com"
HEALTH_URL = "http://localhost:8001/health"
LOGIN_EMAIL = "onarrival21@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test(test_name: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}TEST: {test_name}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✓ PASS:{Colors.RESET} {message}")

def print_fail(message: str):
    print(f"{Colors.RED}✗ FAIL:{Colors.RESET} {message}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ INFO:{Colors.RESET} {message}")

def test_health_check() -> bool:
    """Test 1: GET /health -> expect healthy, database connected, redis connected, background_jobs.eligible=false"""
    print_test("1. Health Check (SAFE MODE verification)")
    
    try:
        response = requests.get(HEALTH_URL, timeout=10)
        
        if response.status_code != 200:
            print_fail(f"Health check returned status {response.status_code}")
            return False
        
        data = response.json()
        print_info(f"Health response: {json.dumps(data, indent=2)}")
        
        # Check status
        if data.get('status') != 'healthy':
            print_fail(f"Status is '{data.get('status')}', expected 'healthy'")
            return False
        print_pass("Status is 'healthy'")
        
        # Check database
        if data.get('database') != 'connected':
            print_fail(f"Database is '{data.get('database')}', expected 'connected'")
            return False
        print_pass("Database is 'connected'")
        
        # Check redis
        if data.get('redis') != 'connected':
            print_fail(f"Redis is '{data.get('redis')}', expected 'connected'")
            return False
        print_pass("Redis is 'connected'")
        
        # Check SAFE MODE (background_jobs.eligible should be false)
        bg_jobs = data.get('background_jobs', {})
        if bg_jobs.get('eligible') != False:
            print_fail(f"background_jobs.eligible is {bg_jobs.get('eligible')}, expected false (SAFE MODE)")
            return False
        print_pass("background_jobs.eligible is false (SAFE MODE confirmed)")
        
        return True
        
    except Exception as e:
        print_fail(f"Health check failed with exception: {str(e)}")
        return False

def test_login() -> Optional[str]:
    """Test 2: POST /api/user/login -> expect HTTP 200 with accessToken"""
    print_test("2. Login (Regression + get Bearer token)")
    
    try:
        url = f"{BACKEND_BASE_URL}/api/user/login"
        payload = {
            "email": LOGIN_EMAIL,
            "password": LOGIN_PASSWORD
        }
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code != 200:
            print_fail(f"Login returned status {response.status_code}")
            print_info(f"Response: {response.text}")
            return None
        
        data = response.json()
        
        # Check for accessToken
        access_token = data.get('data', {}).get('accessToken') or data.get('accessToken')
        
        if not access_token:
            print_fail("No accessToken in response")
            print_info(f"Response keys: {list(data.keys())}")
            return None
        
        print_pass(f"Login successful, accessToken received (length: {len(access_token)})")
        return access_token
        
    except Exception as e:
        print_fail(f"Login failed with exception: {str(e)}")
        return None

def test_referral_earnings(token: str) -> bool:
    """Test 3: GET /api/referral/earnings -> verify new commission block + backward compatibility"""
    print_test("3. GET /api/referral/earnings (NEW commission block + backward compatibility)")
    
    try:
        url = f"{BACKEND_BASE_URL}/api/referral/earnings"
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_fail(f"Earnings endpoint returned status {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
        
        data = response.json()
        print_info(f"Full response structure: {json.dumps(data, indent=2)}")
        
        # Extract the actual data object
        response_data = data.get('data', data)
        
        # Test 3a: Check NEW commission object
        print_info("\n--- Testing NEW commission object ---")
        commission = response_data.get('commission')
        
        if not commission:
            print_fail("No 'commission' object found in response.data")
            return False
        print_pass("'commission' object is present")
        
        # Check required keys in commission
        required_keys = [
            'rate_percent',
            'window_months',
            'total_accrued_usd',
            'total_paid_usd',
            'unpaid_balance_usd',
            'active_windows',
            'referrals'
        ]
        
        missing_keys = [key for key in required_keys if key not in commission]
        if missing_keys:
            print_fail(f"Missing keys in commission: {missing_keys}")
            return False
        print_pass(f"All required keys present in commission: {required_keys}")
        
        # Verify rate_percent = 25
        if commission.get('rate_percent') != 25:
            print_fail(f"rate_percent is {commission.get('rate_percent')}, expected 25")
            return False
        print_pass("rate_percent = 25")
        
        # Verify window_months = 12
        if commission.get('window_months') != 12:
            print_fail(f"window_months is {commission.get('window_months')}, expected 12")
            return False
        print_pass("window_months = 12")
        
        # Verify referrals is an array
        if not isinstance(commission.get('referrals'), list):
            print_fail(f"referrals is not an array, got type: {type(commission.get('referrals'))}")
            return False
        print_pass("referrals is an array")
        
        # NOTE: user_id=1 has NO referrals as referrer, so EMPTY array with zeroed totals is CORRECT
        referrals_count = len(commission.get('referrals', []))
        print_info(f"referrals array length: {referrals_count} (EMPTY is expected/correct for user_id=1)")
        
        # Display commission values
        print_info(f"Commission values:")
        print_info(f"  - total_accrued_usd: {commission.get('total_accrued_usd')}")
        print_info(f"  - total_paid_usd: {commission.get('total_paid_usd')}")
        print_info(f"  - unpaid_balance_usd: {commission.get('unpaid_balance_usd')}")
        print_info(f"  - active_windows: {commission.get('active_windows')}")
        
        # Test 3b: Check EXISTING summary object (backward compatibility)
        print_info("\n--- Testing EXISTING summary object (backward compatibility) ---")
        summary = response_data.get('summary')
        
        if not summary:
            print_fail("No 'summary' object found in response.data (backward compatibility broken)")
            return False
        print_pass("'summary' object is STILL present (backward compatible)")
        
        # Check expected keys in summary
        expected_summary_keys = [
            'total_earnings',
            'pending_earnings',
            'credited_earnings',
            'withdrawn_earnings'
        ]
        
        present_summary_keys = [key for key in expected_summary_keys if key in summary]
        print_pass(f"summary contains keys: {present_summary_keys}")
        
        # Test 3c: Check EXISTING rewards array (backward compatibility)
        print_info("\n--- Testing EXISTING rewards array (backward compatibility) ---")
        rewards = response_data.get('rewards')
        
        if rewards is None:
            print_fail("No 'rewards' array found in response.data (backward compatibility broken)")
            return False
        
        if not isinstance(rewards, list):
            print_fail(f"'rewards' is not an array, got type: {type(rewards)}")
            return False
        
        print_pass(f"'rewards' array is STILL present (backward compatible), length: {len(rewards)}")
        
        print_pass("\n✓ ALL CHECKS PASSED: commission block present, summary present, rewards present")
        return True
        
    except Exception as e:
        print_fail(f"Earnings endpoint failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_referral_my_code(token: str) -> bool:
    """Test 4: GET /api/referral/my-code -> expect HTTP 200 with referral_code and stats"""
    print_test("4. GET /api/referral/my-code (Regression)")
    
    try:
        url = f"{BACKEND_BASE_URL}/api/referral/my-code"
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_fail(f"my-code endpoint returned status {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
        
        data = response.json()
        response_data = data.get('data', data)
        
        # Check for referral_code
        if 'referral_code' not in response_data:
            print_fail("No 'referral_code' in response")
            return False
        print_pass(f"'referral_code' present: {response_data.get('referral_code')}")
        
        # Check for stats
        if 'stats' not in response_data:
            print_fail("No 'stats' in response")
            return False
        print_pass("'stats' present")
        
        return True
        
    except Exception as e:
        print_fail(f"my-code endpoint failed with exception: {str(e)}")
        return False

def test_referral_list(token: str) -> bool:
    """Test 5: GET /api/referral/list -> expect HTTP 200"""
    print_test("5. GET /api/referral/list (Regression)")
    
    try:
        url = f"{BACKEND_BASE_URL}/api/referral/list"
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            print_fail(f"list endpoint returned status {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
        
        print_pass("list endpoint returned HTTP 200")
        
        data = response.json()
        print_info(f"Response structure: {json.dumps(data, indent=2)}")
        
        return True
        
    except Exception as e:
        print_fail(f"list endpoint failed with exception: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BOLD}{'='*80}")
    print("Referral Revenue-Share Phase 1 Backend Verification")
    print("STRICTLY READ-ONLY testing on LIVE prod Railway Postgres")
    print(f"{'='*80}{Colors.RESET}\n")
    
    results = {
        'total': 5,
        'passed': 0,
        'failed': 0
    }
    
    # Test 1: Health check
    if test_health_check():
        results['passed'] += 1
    else:
        results['failed'] += 1
        print_fail("Health check failed - aborting remaining tests")
        sys.exit(1)
    
    # Test 2: Login
    access_token = test_login()
    if access_token:
        results['passed'] += 1
    else:
        results['failed'] += 1
        print_fail("Login failed - aborting remaining tests")
        sys.exit(1)
    
    # Test 3: Referral earnings (main test)
    if test_referral_earnings(access_token):
        results['passed'] += 1
    else:
        results['failed'] += 1
    
    # Test 4: My code
    if test_referral_my_code(access_token):
        results['passed'] += 1
    else:
        results['failed'] += 1
    
    # Test 5: List
    if test_referral_list(access_token):
        results['passed'] += 1
    else:
        results['failed'] += 1
    
    # Summary
    print(f"\n{Colors.BOLD}{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}{Colors.RESET}")
    print(f"Total tests: {results['total']}")
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.RESET}")
    
    if results['failed'] == 0:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ ALL TESTS PASSED{Colors.RESET}")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}✗ SOME TESTS FAILED{Colors.RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()
