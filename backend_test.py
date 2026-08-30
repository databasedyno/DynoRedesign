#!/usr/bin/env python3
"""
Backend API Testing for Referral Fee-Credit Phase 2/3 + F1
STRICTLY READ-ONLY verification on LIVE PROD Railway DB (SAFE MODE)
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001"
LOGIN_EMAIL = "onarrival21@gmail.com"
LOGIN_PASSWORD = "Katiekendra123@"

def print_test_header(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Response data: {json.dumps(data, indent=2)}")

def test_health():
    """Test 1: GET /health - verify SAFE MODE and clean boot"""
    print_test_header(1, "Health Check - SAFE MODE Verification")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check required fields
        checks = {
            "status='healthy'": data.get('status') == 'healthy',
            "database='connected'": data.get('database') == 'connected',
            "redis='connected'": data.get('redis') == 'connected',
            "background_jobs.eligible=false": data.get('background_jobs', {}).get('eligible') == False
        }
        
        all_passed = all(checks.values())
        for check, passed in checks.items():
            print(f"  {'✅' if passed else '❌'} {check}")
        
        if all_passed:
            print_result(True, "Health check confirms SAFE MODE and clean boot")
        else:
            print_result(False, "Health check failed some assertions")
        
        return all_passed
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_login():
    """Test 2: POST /api/user/login - regression test"""
    print_test_header(2, "Login Regression Test")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        access_token = data.get('data', {}).get('accessToken')
        
        if access_token:
            print_result(True, f"Login successful, accessToken received (length: {len(access_token)} chars)")
            return access_token
        else:
            print_result(False, "No accessToken in response")
            print(f"Response: {json.dumps(data, indent=2)}")
            return None
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return None

def test_payout_overview(token):
    """Test 3: GET /api/referral/payout/overview - PRIMARY TEST"""
    print_test_header(3, "Referral Payout Overview - PRIMARY TEST (credited_balance_usd + available_credit_usd)")
    
    if not token:
        print_result(False, "No access token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/referral/payout/overview",
            headers=headers,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Full Response: {json.dumps(data, indent=2)}")
        
        # Check for the new keys
        response_data = data.get('data', {})
        
        has_credited_balance = 'credited_balance_usd' in response_data
        has_available_credit = 'available_credit_usd' in response_data
        
        print(f"\n  {'✅' if has_credited_balance else '❌'} credited_balance_usd present: {has_credited_balance}")
        if has_credited_balance:
            print(f"      Value: {response_data['credited_balance_usd']} (type: {type(response_data['credited_balance_usd']).__name__})")
        
        print(f"  {'✅' if has_available_credit else '❌'} available_credit_usd present: {has_available_credit}")
        if has_available_credit:
            print(f"      Value: {response_data['available_credit_usd']} (type: {type(response_data['available_credit_usd']).__name__})")
        
        # For user_id=1, both should be 0 (that's correct)
        if has_credited_balance and has_available_credit:
            credited_val = response_data['credited_balance_usd']
            available_val = response_data['available_credit_usd']
            
            # Check if they're numeric
            is_credited_numeric = isinstance(credited_val, (int, float))
            is_available_numeric = isinstance(available_val, (int, float))
            
            print(f"\n  {'✅' if is_credited_numeric else '❌'} credited_balance_usd is numeric: {is_credited_numeric}")
            print(f"  {'✅' if is_available_numeric else '❌'} available_credit_usd is numeric: {is_available_numeric}")
            
            if is_credited_numeric and is_available_numeric:
                print(f"\n  ℹ️  For user_id=1 (mode=credit, 0 referral balance), both values being 0 is CORRECT")
                print_result(True, "Payout overview includes credited_balance_usd and available_credit_usd (both numeric)")
                return True
            else:
                print_result(False, "Keys present but not numeric")
                return False
        else:
            print_result(False, "Missing required keys: credited_balance_usd and/or available_credit_usd")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_earnings(token):
    """Test 4: GET /api/referral/earnings - regression test"""
    print_test_header(4, "Referral Earnings - Regression Test (data.commission present)")
    
    if not token:
        print_result(False, "No access token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/referral/earnings",
            headers=headers,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Full Response: {json.dumps(data, indent=2)}")
        
        response_data = data.get('data', {})
        has_commission = 'commission' in response_data
        
        print(f"\n  {'✅' if has_commission else '❌'} data.commission present: {has_commission}")
        
        if has_commission:
            commission = response_data['commission']
            print(f"      Commission object: {json.dumps(commission, indent=2)}")
            print_result(True, "Earnings endpoint returns data.commission (backward compatible)")
            return True
        else:
            print_result(False, "data.commission key missing")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_my_code(token):
    """Test 5: GET /api/referral/my-code - regression test"""
    print_test_header(5, "Referral My Code - Regression Test")
    
    if not token:
        print_result(False, "No access token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=headers,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        print_result(True, "My-code endpoint returns 200")
        return True
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("REFERRAL FEE-CREDIT PHASE 2/3 + F1 - BACKEND VERIFICATION")
    print("STRICTLY READ-ONLY on LIVE PROD Railway DB (SAFE MODE)")
    print("="*80)
    
    results = {}
    
    # Test 1: Health check
    results['health'] = test_health()
    
    # Test 2: Login
    access_token = test_login()
    results['login'] = access_token is not None
    
    # Test 3: Payout overview (PRIMARY TEST)
    results['payout_overview'] = test_payout_overview(access_token)
    
    # Test 4: Earnings
    results['earnings'] = test_earnings(access_token)
    
    # Test 5: My code
    results['my_code'] = test_my_code(access_token)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Backend verification COMPLETE")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
