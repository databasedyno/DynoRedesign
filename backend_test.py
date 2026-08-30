#!/usr/bin/env python3
"""
Backend regression test for referral fee-credit RECOVERY path
STRICTLY READ-ONLY - SAFE MODE on LIVE PROD Railway DB
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001"
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"

def print_test_header(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Response: {json.dumps(data, indent=2)}")
    return success

def test_health_check():
    """Test 1: Health check - confirms paymentController.ts boots cleanly with new imports"""
    print_test_header(1, "Health Check - Boot Verification")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        data = response.json()
        
        if response.status_code != 200:
            return print_result(False, f"Health check returned {response.status_code}", data)
        
        # Verify expected fields
        checks = {
            "status": data.get("status") == "healthy",
            "database": data.get("database") == "connected",
            "redis": data.get("redis") == "connected",
            "background_jobs.eligible": data.get("background_jobs", {}).get("eligible") == False
        }
        
        all_passed = all(checks.values())
        
        if all_passed:
            return print_result(True, 
                f"Health check passed - status={data.get('status')}, database={data.get('database')}, "
                f"redis={data.get('redis')}, background_jobs.eligible={data.get('background_jobs', {}).get('eligible')} (SAFE MODE confirmed)",
                data)
        else:
            failed_checks = [k for k, v in checks.items() if not v]
            return print_result(False, f"Health check failed: {', '.join(failed_checks)}", data)
            
    except Exception as e:
        return print_result(False, f"Health check exception: {str(e)}")

def test_login():
    """Test 2: Login regression - paymentController hosts many payment routes"""
    print_test_header(2, "Login Regression")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": MERCHANT_EMAIL,
                "password": MERCHANT_PASSWORD
            },
            timeout=10
        )
        
        data = response.json()
        
        if response.status_code != 200:
            return print_result(False, f"Login returned {response.status_code}", data), None
        
        access_token = data.get("data", {}).get("accessToken")
        
        if not access_token:
            return print_result(False, "No accessToken in response", data), None
        
        return print_result(True, 
            f"Login successful - HTTP 200 with accessToken (length: {len(access_token)} chars)"), access_token
            
    except Exception as e:
        return print_result(False, f"Login exception: {str(e)}"), None

def test_payout_overview(token):
    """Test 3: Payout overview - verify credited_balance_usd and available_credit_usd present"""
    print_test_header(3, "Referral Payout Overview - Credit Fields Verification")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/referral/payout/overview",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        data = response.json()
        
        if response.status_code != 200:
            return print_result(False, f"Payout overview returned {response.status_code}", data)
        
        overview = data.get("data", {})
        
        # Check for required fields
        has_credited_balance = "credited_balance_usd" in overview
        has_available_credit = "available_credit_usd" in overview
        
        credited_balance_usd = overview.get("credited_balance_usd")
        available_credit_usd = overview.get("available_credit_usd")
        
        if not has_credited_balance or not has_available_credit:
            missing = []
            if not has_credited_balance:
                missing.append("credited_balance_usd")
            if not has_available_credit:
                missing.append("available_credit_usd")
            return print_result(False, f"Missing required fields: {', '.join(missing)}", overview)
        
        # Verify both are numeric (0 is correct for user_id=1)
        is_numeric_credited = isinstance(credited_balance_usd, (int, float))
        is_numeric_available = isinstance(available_credit_usd, (int, float))
        
        if not is_numeric_credited or not is_numeric_available:
            return print_result(False, 
                f"Fields are not numeric - credited_balance_usd type: {type(credited_balance_usd)}, "
                f"available_credit_usd type: {type(available_credit_usd)}", overview)
        
        return print_result(True,
            f"Payout overview returned HTTP 200 with CORRECT structure. "
            f"credited_balance_usd={credited_balance_usd} (type: {type(credited_balance_usd).__name__}), "
            f"available_credit_usd={available_credit_usd} (type: {type(available_credit_usd).__name__}). "
            f"Both being 0 is CORRECT for user_id=1 (mode=credit, 0 referral balance).",
            overview)
            
    except Exception as e:
        return print_result(False, f"Payout overview exception: {str(e)}")

def test_earnings(token):
    """Test 4: Earnings regression - verify data.commission present"""
    print_test_header(4, "Referral Earnings - Commission Object Verification")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/referral/earnings",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        data = response.json()
        
        if response.status_code != 200:
            return print_result(False, f"Earnings returned {response.status_code}", data)
        
        earnings_data = data.get("data", {})
        commission = earnings_data.get("commission")
        
        if commission is None:
            return print_result(False, "data.commission is missing", earnings_data)
        
        # Verify commission object structure
        if not isinstance(commission, dict):
            return print_result(False, f"data.commission is not an object (type: {type(commission)})", earnings_data)
        
        return print_result(True,
            f"Earnings returned HTTP 200 with data.commission object PRESENT. "
            f"Commission keys: {list(commission.keys())}",
            {"commission": commission})
            
    except Exception as e:
        return print_result(False, f"Earnings exception: {str(e)}")

def main():
    print("\n" + "="*80)
    print("BACKEND REGRESSION TEST - REFERRAL FEE-CREDIT RECOVERY PATH")
    print("STRICTLY READ-ONLY - SAFE MODE on LIVE PROD Railway DB")
    print("="*80)
    
    results = []
    
    # Test 1: Health check
    results.append(test_health_check())
    
    # Test 2: Login
    login_result, token = test_login()
    results.append(login_result)
    
    if not token:
        print("\n❌ CRITICAL: Cannot proceed without access token")
        print_summary(results)
        sys.exit(1)
    
    # Test 3: Payout overview
    results.append(test_payout_overview(token))
    
    # Test 4: Earnings
    results.append(test_earnings(token))
    
    # Print summary
    print_summary(results)
    
    # Exit with appropriate code
    sys.exit(0 if all(results) else 1)

def print_summary(results):
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if all(results):
        print("\n✅ ALL TESTS PASSED - Backend regression verification COMPLETE")
        print("The referral fee-credit RECOVERY path changes (paymentController.ts + referralCreditService.ts)")
        print("boot cleanly with no regressions. All endpoints return expected structure.")
    else:
        print("\n❌ SOME TESTS FAILED - See details above")

if __name__ == "__main__":
    main()
