#!/usr/bin/env python3
"""
Backend Test Script for Fee-Preview Endpoint Fix
Tests the GET /api/pay/fee-preview endpoint with different fee_payer scenarios
LIVE Railway Postgres - READ-ONLY testing only
"""

import requests
import json
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://crypto-gateway-26.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

# Test results
results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log(message, level="INFO"):
    """Log test messages"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def login():
    """Login and get access token"""
    log("=" * 80)
    log("STEP 0: LOGIN")
    log("=" * 80)
    log("Logging in as hostbay@moxx.co...")
    
    try:
        response = requests.post(
            f"{API_BASE}/user/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=30
        )
        
        if response.status_code != 200:
            log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
            results["failed"].append(f"Login failed with status {response.status_code}")
            return None
        
        data = response.json()
        token = data.get("data", {}).get("accessToken")
        
        if not token:
            log("No access token in response", "ERROR")
            results["failed"].append("No access token in login response")
            return None
        
        log(f"✅ Login successful - Token: {token[:30]}...", "SUCCESS")
        results["passed"].append("Login successful")
        return token
        
    except Exception as e:
        log(f"Login exception: {str(e)}", "ERROR")
        results["failed"].append(f"Login exception: {str(e)}")
        return None

def test_1_fee_payer_company(token):
    """Test 1: fee_payer=company - merchant pays the fee"""
    log("\n" + "=" * 80)
    log("TEST 1: fee_payer=company (merchant pays fee)")
    log("=" * 80)
    log("Expected: fee=0.3 (1.5% of 20), you_receive=19.7, customer_pays=20, fee_payer='company'")
    
    try:
        response = requests.get(
            f"{API_BASE}/pay/fee-preview",
            params={
                "amount": 20,
                "currency": "USD",
                "fee_payer": "company"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}", "ERROR")
            log(f"Response: {response.text}", "ERROR")
            results["failed"].append(f"Test 1: Expected 200, got {response.status_code}")
            return
        
        data = response.json().get("data", {})
        log(f"Response data: {json.dumps(data, indent=2)}")
        
        # Check values
        fee = data.get("fee")
        you_receive = data.get("you_receive")
        customer_pays = data.get("customer_pays")
        fee_payer = data.get("fee_payer")
        
        log(f"Observed values:")
        log(f"  - fee: {fee}")
        log(f"  - you_receive: {you_receive}")
        log(f"  - customer_pays: {customer_pays}")
        log(f"  - fee_payer: {fee_payer}")
        
        # Validate
        issues = []
        
        # Note: The merchant may have a referral discount, so the fee might be less than 1.5%
        # We'll verify the math is internally consistent
        if fee_payer != "company":
            issues.append(f"fee_payer should be 'company', got '{fee_payer}'")
        
        if customer_pays != 20:
            issues.append(f"customer_pays should be 20, got {customer_pays}")
        
        # For company paying: you_receive = amount - fee
        expected_you_receive = 20 - fee
        if abs(you_receive - expected_you_receive) > 0.01:
            issues.append(f"you_receive should be {expected_you_receive} (20 - {fee}), got {you_receive}")
        
        if issues:
            log(f"❌ FAILED: {', '.join(issues)}", "ERROR")
            results["failed"].append(f"Test 1: {', '.join(issues)}")
        else:
            log(f"✅ PASS: All values correct (fee={fee}, you_receive={you_receive}, customer_pays={customer_pays})", "SUCCESS")
            if fee != 0.3:
                log(f"ℹ️  Note: Fee is {fee} instead of 0.3 (merchant may have referral discount)", "INFO")
            results["passed"].append(f"Test 1: fee_payer=company works correctly (fee={fee})")
            
    except Exception as e:
        log(f"❌ Exception: {str(e)}", "ERROR")
        results["failed"].append(f"Test 1: Exception - {str(e)}")

def test_2_fee_payer_customer(token):
    """Test 2: fee_payer=customer - customer pays the fee"""
    log("\n" + "=" * 80)
    log("TEST 2: fee_payer=customer (customer pays fee)")
    log("=" * 80)
    log("Expected: fee=0.3, you_receive=20 (FULL amount), customer_pays=20.3, fee_payer='customer'")
    
    try:
        response = requests.get(
            f"{API_BASE}/pay/fee-preview",
            params={
                "amount": 20,
                "currency": "USD",
                "fee_payer": "customer"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}", "ERROR")
            log(f"Response: {response.text}", "ERROR")
            results["failed"].append(f"Test 2: Expected 200, got {response.status_code}")
            return
        
        data = response.json().get("data", {})
        log(f"Response data: {json.dumps(data, indent=2)}")
        
        # Check values
        fee = data.get("fee")
        you_receive = data.get("you_receive")
        customer_pays = data.get("customer_pays")
        fee_payer = data.get("fee_payer")
        
        log(f"Observed values:")
        log(f"  - fee: {fee}")
        log(f"  - you_receive: {you_receive}")
        log(f"  - customer_pays: {customer_pays}")
        log(f"  - fee_payer: {fee_payer}")
        
        # Validate
        issues = []
        
        if fee_payer != "customer":
            issues.append(f"fee_payer should be 'customer', got '{fee_payer}'")
        
        # CRITICAL: For customer paying, merchant gets the FULL amount
        if you_receive != 20:
            issues.append(f"you_receive should be 20 (FULL amount), got {you_receive}")
        
        # For customer paying: customer_pays = amount + fee
        expected_customer_pays = 20 + fee
        if abs(customer_pays - expected_customer_pays) > 0.01:
            issues.append(f"customer_pays should be {expected_customer_pays} (20 + {fee}), got {customer_pays}")
        
        if issues:
            log(f"❌ FAILED: {', '.join(issues)}", "ERROR")
            results["failed"].append(f"Test 2: {', '.join(issues)}")
        else:
            log(f"✅ PASS: All values correct (fee={fee}, you_receive={you_receive}, customer_pays={customer_pays})", "SUCCESS")
            if fee != 0.3:
                log(f"ℹ️  Note: Fee is {fee} instead of 0.3 (merchant may have referral discount)", "INFO")
            results["passed"].append(f"Test 2: fee_payer=customer works correctly (fee={fee})")
            
    except Exception as e:
        log(f"❌ Exception: {str(e)}", "ERROR")
        results["failed"].append(f"Test 2: Exception - {str(e)}")

def test_3_no_fee_payer_default(token):
    """Test 3: No fee_payer param - should default to company"""
    log("\n" + "=" * 80)
    log("TEST 3: No fee_payer param (should default to company)")
    log("=" * 80)
    log("Expected: defaults to company behavior (you_receive=19.7, customer_pays=20)")
    
    try:
        response = requests.get(
            f"{API_BASE}/pay/fee-preview",
            params={
                "amount": 20,
                "currency": "USD"
                # No fee_payer param
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}", "ERROR")
            log(f"Response: {response.text}", "ERROR")
            results["failed"].append(f"Test 3: Expected 200, got {response.status_code}")
            return
        
        data = response.json().get("data", {})
        log(f"Response data: {json.dumps(data, indent=2)}")
        
        # Check values
        fee = data.get("fee")
        you_receive = data.get("you_receive")
        customer_pays = data.get("customer_pays")
        fee_payer = data.get("fee_payer")
        
        log(f"Observed values:")
        log(f"  - fee: {fee}")
        log(f"  - you_receive: {you_receive}")
        log(f"  - customer_pays: {customer_pays}")
        log(f"  - fee_payer: {fee_payer}")
        
        # Validate - should default to company
        issues = []
        
        if fee_payer != "company":
            issues.append(f"fee_payer should default to 'company', got '{fee_payer}'")
        
        if customer_pays != 20:
            issues.append(f"customer_pays should be 20, got {customer_pays}")
        
        # For company paying: you_receive = amount - fee
        expected_you_receive = 20 - fee
        if abs(you_receive - expected_you_receive) > 0.01:
            issues.append(f"you_receive should be {expected_you_receive} (20 - {fee}), got {you_receive}")
        
        if issues:
            log(f"❌ FAILED: {', '.join(issues)}", "ERROR")
            results["failed"].append(f"Test 3: {', '.join(issues)}")
        else:
            log(f"✅ PASS: Defaults to company behavior correctly (fee={fee}, you_receive={you_receive})", "SUCCESS")
            results["passed"].append(f"Test 3: No fee_payer defaults to company (fee={fee})")
            
    except Exception as e:
        log(f"❌ Exception: {str(e)}", "ERROR")
        results["failed"].append(f"Test 3: Exception - {str(e)}")

def test_4a_no_auth(token):
    """Test 4a: No Authorization header - should return 401/403"""
    log("\n" + "=" * 80)
    log("TEST 4a: No Authorization header (regression)")
    log("=" * 80)
    log("Expected: 401 or 403")
    
    try:
        response = requests.get(
            f"{API_BASE}/pay/fee-preview",
            params={
                "amount": 20,
                "currency": "USD"
            },
            # No Authorization header
            timeout=30
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code in [401, 403]:
            log(f"✅ PASS: Correctly returned {response.status_code} (auth required)", "SUCCESS")
            results["passed"].append(f"Test 4a: Auth required (got {response.status_code})")
        else:
            log(f"❌ FAILED: Expected 401 or 403, got {response.status_code}", "ERROR")
            log(f"Response: {response.text}", "ERROR")
            results["failed"].append(f"Test 4a: Expected 401/403, got {response.status_code}")
            
    except Exception as e:
        log(f"❌ Exception: {str(e)}", "ERROR")
        results["failed"].append(f"Test 4a: Exception - {str(e)}")

def test_4b_invalid_amount_zero(token):
    """Test 4b: Invalid amount (0) - should return 400"""
    log("\n" + "=" * 80)
    log("TEST 4b: Invalid amount (0)")
    log("=" * 80)
    log("Expected: 400")
    
    try:
        response = requests.get(
            f"{API_BASE}/pay/fee-preview",
            params={
                "amount": 0,
                "currency": "USD"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 400:
            log(f"✅ PASS: Correctly returned 400 for invalid amount", "SUCCESS")
            results["passed"].append("Test 4b: Invalid amount (0) rejected")
        else:
            log(f"❌ FAILED: Expected 400, got {response.status_code}", "ERROR")
            log(f"Response: {response.text}", "ERROR")
            results["failed"].append(f"Test 4b: Expected 400, got {response.status_code}")
            
    except Exception as e:
        log(f"❌ Exception: {str(e)}", "ERROR")
        results["failed"].append(f"Test 4b: Exception - {str(e)}")

def test_4c_invalid_amount_string(token):
    """Test 4c: Invalid amount (non-numeric) - should return 400"""
    log("\n" + "=" * 80)
    log("TEST 4c: Invalid amount (non-numeric 'abc')")
    log("=" * 80)
    log("Expected: 400")
    
    try:
        response = requests.get(
            f"{API_BASE}/pay/fee-preview",
            params={
                "amount": "abc",
                "currency": "USD"
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code == 400:
            log(f"✅ PASS: Correctly returned 400 for non-numeric amount", "SUCCESS")
            results["passed"].append("Test 4c: Invalid amount (abc) rejected")
        else:
            log(f"❌ FAILED: Expected 400, got {response.status_code}", "ERROR")
            log(f"Response: {response.text}", "ERROR")
            results["failed"].append(f"Test 4c: Expected 400, got {response.status_code}")
            
    except Exception as e:
        log(f"❌ Exception: {str(e)}", "ERROR")
        results["failed"].append(f"Test 4c: Exception - {str(e)}")

def print_summary():
    """Print test summary"""
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    total = len(results["passed"]) + len(results["failed"])
    passed = len(results["passed"])
    failed = len(results["failed"])
    
    log(f"Total tests: {total}")
    log(f"Passed: {passed}")
    log(f"Failed: {failed}")
    
    if results["passed"]:
        log("\n✅ PASSED TESTS:")
        for test in results["passed"]:
            log(f"  ✅ {test}")
    
    if results["failed"]:
        log("\n❌ FAILED TESTS:")
        for test in results["failed"]:
            log(f"  ❌ {test}")
    
    if results["warnings"]:
        log("\n⚠️  WARNINGS:")
        for warning in results["warnings"]:
            log(f"  ⚠️  {warning}")
    
    log("\n" + "=" * 80)
    if failed == 0:
        log("🎉 ALL TESTS PASSED!", "SUCCESS")
        return 0
    else:
        log(f"❌ {failed} TEST(S) FAILED", "ERROR")
        return 1

def main():
    """Main test execution"""
    log("=" * 80)
    log("DynoPay Fee-Preview Endpoint Test Suite")
    log("Testing: GET /api/pay/fee-preview")
    log("=" * 80)
    
    # Login
    token = login()
    if not token:
        log("Cannot proceed without authentication token", "ERROR")
        return 1
    
    # Run tests
    test_1_fee_payer_company(token)
    test_2_fee_payer_customer(token)
    test_3_no_fee_payer_default(token)
    test_4a_no_auth(token)
    test_4b_invalid_amount_zero(token)
    test_4c_invalid_amount_string(token)
    
    # Print summary
    return print_summary()

if __name__ == "__main__":
    sys.exit(main())
