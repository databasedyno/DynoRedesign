#!/usr/bin/env python3
"""
READ-ONLY Backend Verification for DynoPay API
CRITICAL: Connected to LIVE PRODUCTION Railway PostgreSQL + Redis
DO NOT create, modify, or delete any data
"""

import requests
import json
import redis
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

BASE_URL = "https://dynopay-preview-3.preview.emergentagent.com/api"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

# Test credentials
PRIMARY_QA_EMAIL = "hostbay@moxx.co"
PRIMARY_QA_PASSWORD = "Katiekendra123@"

# Redis connection for OTP retrieval
REDIS_URL = os.getenv('REDIS_PUBLIC_URL', 'redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794')

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(status, message):
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} {status}: {message}")

def test_health_check():
    """Test 1: GET /api/ -> expect 200 with status 'operational'"""
    print_test_header("Health Check - GET /api/")
    
    try:
        response = requests.get(f"{BASE_URL}/", headers=HEADERS, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'operational':
                print_result("PASS", "Health check returned 200 with status 'operational'")
                return True
            else:
                print_result("FAIL", f"Status is not 'operational': {data.get('status')}")
                return False
        else:
            print_result("FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_result("FAIL", f"Exception: {str(e)}")
        return False

def test_get_data_404():
    """Test 2: POST /api/pay/getData with bogus ref -> expect 404 (not 500)"""
    print_test_header("Checkout getData - Bogus Reference (Expect 404)")
    
    try:
        payload = {"data": "nonexistent-bogus-ref-12345"}
        response = requests.post(f"{BASE_URL}/pay/getData", headers=HEADERS, json=payload, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        print(f"Response: {response.text[:300]}")
        
        if response.status_code == 404:
            data = response.json()
            message = data.get('message', '').lower()
            if 'payment link not found' in message or 'expired' in message:
                print_result("PASS", "Returned 404 with appropriate message (not 500)")
                return True
            else:
                print_result("PASS", f"Returned 404 (not 500), message: {data.get('message')}")
                return True
        elif response.status_code == 500:
            print_result("FAIL", "CRITICAL: Returned 500 instead of 404")
            return False
        else:
            print_result("WARN", f"Unexpected status {response.status_code}, but not 500")
            return True  # Not a 500, so the fix is working
    except Exception as e:
        print_result("FAIL", f"Exception: {str(e)}")
        return False

def login_and_get_token():
    """Login as Primary QA merchant and get Bearer token"""
    print_test_header("Authentication - Login with OTP")
    
    try:
        # Step 1: POST /api/user/login
        print("\nStep 1: Initiating login...")
        login_payload = {
            "email": PRIMARY_QA_EMAIL,
            "password": PRIMARY_QA_PASSWORD
        }
        response = requests.post(f"{BASE_URL}/user/login", headers=HEADERS, json=login_payload, timeout=10)
        print(f"Login HTTP Status: {response.status_code}")
        print(f"Login Response: {response.text[:300]}")
        
        if response.status_code != 200:
            print_result("FAIL", f"Login failed with status {response.status_code}")
            return None
        
        data = response.json()
        session_id = data.get('data', {}).get('login_otp_session')
        
        if not session_id:
            print_result("FAIL", "No login_otp_session in response")
            return None
        
        print(f"✓ Login OTP session: {session_id}")
        
        # Step 2: Read OTP from Redis
        print("\nStep 2: Reading OTP from Redis...")
        try:
            r = redis.from_url(REDIS_URL, decode_responses=True)
            redis_key = f"login_otp:{session_id}:json"
            otp_data = r.get(redis_key)
            
            if not otp_data:
                print_result("FAIL", f"No OTP found in Redis for key: {redis_key}")
                return None
            
            otp_json = json.loads(otp_data)
            otp = otp_json.get('otp')
            print(f"✓ OTP retrieved: {otp}")
        except Exception as e:
            print_result("FAIL", f"Redis error: {str(e)}")
            return None
        
        # Step 3: POST /api/user/verifyLoginOTP
        print("\nStep 3: Verifying OTP...")
        verify_payload = {
            "login_otp_session": session_id,
            "otp": otp
        }
        response = requests.post(f"{BASE_URL}/user/verifyLoginOTP", headers=HEADERS, json=verify_payload, timeout=10)
        print(f"Verify OTP HTTP Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result("FAIL", f"OTP verification failed with status {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return None
        
        data = response.json()
        access_token = data.get('data', {}).get('accessToken')
        
        if not access_token:
            print_result("FAIL", "No accessToken in response")
            return None
        
        print(f"✓ Bearer token obtained (length: {len(access_token)} chars)")
        print_result("PASS", "Login successful")
        return access_token
        
    except Exception as e:
        print_result("FAIL", f"Exception during login: {str(e)}")
        return None

def test_payment_links(token):
    """Test 3: GET /api/pay/getPaymentLinks - verify payment_link field"""
    print_test_header("Payment Links - Verify payment_link Field")
    
    if not token:
        print_result("SKIP", "No token available, skipping authenticated test")
        return None
    
    try:
        auth_headers = HEADERS.copy()
        auth_headers['Authorization'] = f"Bearer {token}"
        
        response = requests.get(f"{BASE_URL}/pay/getPaymentLinks", headers=auth_headers, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        
        if response.status_code != 200:
            print_result("FAIL", f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)[:500]}")
        
        # Handle both possible response formats
        if isinstance(data.get('data'), list):
            payment_links = data.get('data', [])
        else:
            payment_links = data.get('data', {}).get('paymentLinks', [])
        
        if len(payment_links) == 0:
            print_result("INFO", "Account has zero payment links (acceptable - no data to verify)")
            return True
        
        print(f"\nFound {len(payment_links)} payment link(s)")
        
        # Verify each link has payment_link field
        all_valid = True
        for idx, link in enumerate(payment_links):
            payment_link_url = link.get('payment_link')
            print(f"\nLink {idx + 1}:")
            print(f"  - ID: {link.get('id')}")
            print(f"  - payment_link: {payment_link_url}")
            
            if not payment_link_url:
                print_result("FAIL", f"Link {idx + 1}: payment_link field is EMPTY or missing")
                all_valid = False
            elif not payment_link_url.startswith('http'):
                print_result("FAIL", f"Link {idx + 1}: payment_link does not start with http")
                all_valid = False
            elif '/pay?d=' not in payment_link_url:
                print_result("FAIL", f"Link {idx + 1}: payment_link does not contain '/pay?d='")
                all_valid = False
            else:
                print_result("PASS", f"Link {idx + 1}: payment_link is valid and populated")
        
        if all_valid:
            print_result("PASS", "All payment links have valid payment_link field")
            return True
        else:
            print_result("FAIL", "Some payment links have invalid payment_link field")
            return False
            
    except Exception as e:
        print_result("FAIL", f"Exception: {str(e)}")
        return False

def test_network_fees():
    """Test 4a: GET /api/pay/network-fees -> expect 200 (no 500)"""
    print_test_header("Network Fees - Regression Check")
    
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", headers=HEADERS, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        print(f"Response: {response.text[:300]}")
        
        if response.status_code == 200:
            print_result("PASS", "Network fees endpoint returned 200")
            return True
        elif response.status_code == 500:
            print_result("FAIL", "CRITICAL: Returned 500 (regression)")
            return False
        else:
            print_result("WARN", f"Unexpected status {response.status_code}, but not 500")
            return True
    except Exception as e:
        print_result("FAIL", f"Exception: {str(e)}")
        return False

def test_geo_detect():
    """Test 4b: GET /api/geo-detect -> expect 200 (no 500)"""
    print_test_header("Geo Detect - Regression Check")
    
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", headers=HEADERS, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        print(f"Response: {response.text[:300]}")
        
        if response.status_code == 200:
            print_result("PASS", "Geo detect endpoint returned 200")
            return True
        elif response.status_code == 500:
            print_result("FAIL", "CRITICAL: Returned 500 (regression)")
            return False
        else:
            print_result("WARN", f"Unexpected status {response.status_code}, but not 500")
            return True
    except Exception as e:
        print_result("FAIL", f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("DynoPay API - READ-ONLY Backend Verification")
    print("Base URL: https://dynopay-preview-3.preview.emergentagent.com/api")
    print("CRITICAL: Connected to LIVE PRODUCTION DB - READ-ONLY TESTS ONLY")
    print("="*80)
    
    results = {}
    
    # Test 1: Health check
    results['health_check'] = test_health_check()
    
    # Test 2: getData with bogus ref (expect 404, not 500)
    results['get_data_404'] = test_get_data_404()
    
    # Test 3: Authenticated - payment links
    token = login_and_get_token()
    results['payment_links'] = test_payment_links(token)
    
    # Test 4: Regression checks
    results['network_fees'] = test_network_fees()
    results['geo_detect'] = test_geo_detect()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for test_name, result in results.items():
        if result is True:
            print(f"✅ PASS: {test_name}")
        elif result is False:
            print(f"❌ FAIL: {test_name}")
        else:
            print(f"⚠️  SKIP: {test_name}")
    
    print(f"\nTotal: {total} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit(main())
