#!/usr/bin/env python3
"""
Backend Test Script for Fee-Preview Endpoint with Fixed Tier Fees
Tests the updated GET /api/pay/fee-preview endpoint that now includes fixed per-tier fees
on top of the percentage fee (Session 2026-08-05 (b) - Item d)

For a $20 USD amount:
- Fixed tier fee = $1.00 (tier 1: $1-$100)
- Percent fee = $20 × 1.5% = $0.30
- Total fee = $1.30

Expected behavior:
- company: fee=1.3, you_receive=18.7, customer_pays=20, fee_payer=company; fee_info.fixed_fee=1, percent_fee_amount=0.3
- customer: fee=1.3, you_receive=20 (full), customer_pays=21.3, fee_payer=customer
- no fee_payer -> company default (you_receive=18.7)
- no auth -> 401; amount<=0 or non-numeric -> 400
"""

import requests
import json
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://gateway-config-1.preview.emergentagent.com"
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
    log("Logging in...")
    response = requests.post(
        f"{API_BASE}/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30
    )
    
    if response.status_code != 200:
        log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
        sys.exit(1)
    
    data = response.json()
    token = data.get("data", {}).get("accessToken")
    
    if not token:
        log("No access token in response", "ERROR")
        sys.exit(1)
    
    log("Login successful")
    return token

def test_1_fee_payer_company(token):
    """Test 1: fee_payer=company - merchant pays the fee"""
    log("\n=== TEST 1: fee_payer=company ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=20&currency=USD&fee_payer=company",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 1: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} - {response.text}", "ERROR")
        return
    
    data = response.json().get("data", {})
    
    # Expected values
    expected_fee = 1.3
    expected_you_receive = 18.7
    expected_customer_pays = 20
    expected_fee_payer = "company"
    expected_fixed_fee = 1
    expected_percent_fee = 0.3
    
    # Check fee
    actual_fee = data.get("fee")
    if abs(actual_fee - expected_fee) > 0.01:
        results["failed"].append(f"Test 1: fee should be {expected_fee}, got {actual_fee}")
        log(f"FAILED: fee = {actual_fee} (expected {expected_fee})", "ERROR")
        return
    
    # Check you_receive
    actual_you_receive = data.get("you_receive")
    if abs(actual_you_receive - expected_you_receive) > 0.01:
        results["failed"].append(f"Test 1: you_receive should be {expected_you_receive}, got {actual_you_receive}")
        log(f"FAILED: you_receive = {actual_you_receive} (expected {expected_you_receive})", "ERROR")
        return
    
    # Check customer_pays
    actual_customer_pays = data.get("customer_pays")
    if abs(actual_customer_pays - expected_customer_pays) > 0.01:
        results["failed"].append(f"Test 1: customer_pays should be {expected_customer_pays}, got {actual_customer_pays}")
        log(f"FAILED: customer_pays = {actual_customer_pays} (expected {expected_customer_pays})", "ERROR")
        return
    
    # Check fee_payer
    actual_fee_payer = data.get("fee_payer")
    if actual_fee_payer != expected_fee_payer:
        results["failed"].append(f"Test 1: fee_payer should be '{expected_fee_payer}', got '{actual_fee_payer}'")
        log(f"FAILED: fee_payer = '{actual_fee_payer}' (expected '{expected_fee_payer}')", "ERROR")
        return
    
    # Check fee_info.fixed_fee
    fee_info = data.get("fee_info", {})
    actual_fixed_fee = fee_info.get("fixed_fee")
    if abs(actual_fixed_fee - expected_fixed_fee) > 0.01:
        results["failed"].append(f"Test 1: fee_info.fixed_fee should be {expected_fixed_fee}, got {actual_fixed_fee}")
        log(f"FAILED: fee_info.fixed_fee = {actual_fixed_fee} (expected {expected_fixed_fee})", "ERROR")
        return
    
    # Check fee_info.percent_fee_amount
    actual_percent_fee = fee_info.get("percent_fee_amount")
    if abs(actual_percent_fee - expected_percent_fee) > 0.01:
        results["failed"].append(f"Test 1: fee_info.percent_fee_amount should be {expected_percent_fee}, got {actual_percent_fee}")
        log(f"FAILED: fee_info.percent_fee_amount = {actual_percent_fee} (expected {expected_percent_fee})", "ERROR")
        return
    
    results["passed"].append("Test 1: fee_payer=company")
    log(f"PASSED: fee={actual_fee}, you_receive={actual_you_receive}, customer_pays={actual_customer_pays}, fee_payer='{actual_fee_payer}'")
    log(f"  fee_info: fixed_fee={actual_fixed_fee}, percent_fee_amount={actual_percent_fee}")

def test_2_fee_payer_customer(token):
    """Test 2: fee_payer=customer - customer pays the fee"""
    log("\n=== TEST 2: fee_payer=customer ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=20&currency=USD&fee_payer=customer",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 2: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} - {response.text}", "ERROR")
        return
    
    data = response.json().get("data", {})
    
    # Expected values
    expected_fee = 1.3
    expected_you_receive = 20  # FULL amount - merchant gets full payment
    expected_customer_pays = 21.3  # amount + fee
    expected_fee_payer = "customer"
    expected_fixed_fee = 1
    expected_percent_fee = 0.3
    
    # Check fee
    actual_fee = data.get("fee")
    if abs(actual_fee - expected_fee) > 0.01:
        results["failed"].append(f"Test 2: fee should be {expected_fee}, got {actual_fee}")
        log(f"FAILED: fee = {actual_fee} (expected {expected_fee})", "ERROR")
        return
    
    # Check you_receive (CRITICAL: should be FULL amount)
    actual_you_receive = data.get("you_receive")
    if abs(actual_you_receive - expected_you_receive) > 0.01:
        results["failed"].append(f"Test 2: you_receive should be {expected_you_receive} (FULL amount), got {actual_you_receive}")
        log(f"FAILED: you_receive = {actual_you_receive} (expected {expected_you_receive} - FULL amount)", "ERROR")
        return
    
    # Check customer_pays
    actual_customer_pays = data.get("customer_pays")
    if abs(actual_customer_pays - expected_customer_pays) > 0.01:
        results["failed"].append(f"Test 2: customer_pays should be {expected_customer_pays}, got {actual_customer_pays}")
        log(f"FAILED: customer_pays = {actual_customer_pays} (expected {expected_customer_pays})", "ERROR")
        return
    
    # Check fee_payer
    actual_fee_payer = data.get("fee_payer")
    if actual_fee_payer != expected_fee_payer:
        results["failed"].append(f"Test 2: fee_payer should be '{expected_fee_payer}', got '{actual_fee_payer}'")
        log(f"FAILED: fee_payer = '{actual_fee_payer}' (expected '{expected_fee_payer}')", "ERROR")
        return
    
    # Check fee_info.fixed_fee
    fee_info = data.get("fee_info", {})
    actual_fixed_fee = fee_info.get("fixed_fee")
    if abs(actual_fixed_fee - expected_fixed_fee) > 0.01:
        results["failed"].append(f"Test 2: fee_info.fixed_fee should be {expected_fixed_fee}, got {actual_fixed_fee}")
        log(f"FAILED: fee_info.fixed_fee = {actual_fixed_fee} (expected {expected_fixed_fee})", "ERROR")
        return
    
    # Check fee_info.percent_fee_amount
    actual_percent_fee = fee_info.get("percent_fee_amount")
    if abs(actual_percent_fee - expected_percent_fee) > 0.01:
        results["failed"].append(f"Test 2: fee_info.percent_fee_amount should be {expected_percent_fee}, got {actual_percent_fee}")
        log(f"FAILED: fee_info.percent_fee_amount = {actual_percent_fee} (expected {expected_percent_fee})", "ERROR")
        return
    
    results["passed"].append("Test 2: fee_payer=customer")
    log(f"PASSED: fee={actual_fee}, you_receive={actual_you_receive} (FULL amount), customer_pays={actual_customer_pays}, fee_payer='{actual_fee_payer}'")
    log(f"  fee_info: fixed_fee={actual_fixed_fee}, percent_fee_amount={actual_percent_fee}")

def test_3_no_fee_payer_default(token):
    """Test 3: no fee_payer parameter - should default to company"""
    log("\n=== TEST 3: no fee_payer (default to company) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=20&currency=USD",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 3: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} - {response.text}", "ERROR")
        return
    
    data = response.json().get("data", {})
    
    # Expected values (should default to company behavior)
    expected_fee = 1.3
    expected_you_receive = 18.7
    expected_customer_pays = 20
    expected_fee_payer = "company"
    
    # Check fee
    actual_fee = data.get("fee")
    if abs(actual_fee - expected_fee) > 0.01:
        results["failed"].append(f"Test 3: fee should be {expected_fee}, got {actual_fee}")
        log(f"FAILED: fee = {actual_fee} (expected {expected_fee})", "ERROR")
        return
    
    # Check you_receive
    actual_you_receive = data.get("you_receive")
    if abs(actual_you_receive - expected_you_receive) > 0.01:
        results["failed"].append(f"Test 3: you_receive should be {expected_you_receive}, got {actual_you_receive}")
        log(f"FAILED: you_receive = {actual_you_receive} (expected {expected_you_receive})", "ERROR")
        return
    
    # Check customer_pays
    actual_customer_pays = data.get("customer_pays")
    if abs(actual_customer_pays - expected_customer_pays) > 0.01:
        results["failed"].append(f"Test 3: customer_pays should be {expected_customer_pays}, got {actual_customer_pays}")
        log(f"FAILED: customer_pays = {actual_customer_pays} (expected {expected_customer_pays})", "ERROR")
        return
    
    # Check fee_payer defaults to company
    actual_fee_payer = data.get("fee_payer")
    if actual_fee_payer != expected_fee_payer:
        results["failed"].append(f"Test 3: fee_payer should default to '{expected_fee_payer}', got '{actual_fee_payer}'")
        log(f"FAILED: fee_payer = '{actual_fee_payer}' (expected default '{expected_fee_payer}')", "ERROR")
        return
    
    results["passed"].append("Test 3: no fee_payer (defaults to company)")
    log(f"PASSED: fee={actual_fee}, you_receive={actual_you_receive}, customer_pays={actual_customer_pays}, fee_payer='{actual_fee_payer}' (default)")

def test_4_no_auth_401():
    """Test 4: no Authorization header - should return 401"""
    log("\n=== TEST 4: no Authorization header (401) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=20&currency=USD",
        timeout=30
    )
    
    if response.status_code != 401:
        results["failed"].append(f"Test 4: Expected 401, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} (expected 401)", "ERROR")
        return
    
    results["passed"].append("Test 4: no auth returns 401")
    log("PASSED: 401 without Authorization header")

def test_5_invalid_amount_zero(token):
    """Test 5: amount=0 - should return 400"""
    log("\n=== TEST 5: amount=0 (400) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=0&currency=USD",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 400:
        results["failed"].append(f"Test 5: Expected 400, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} (expected 400)", "ERROR")
        return
    
    results["passed"].append("Test 5: amount=0 returns 400")
    log("PASSED: 400 for amount=0")

def test_6_invalid_amount_non_numeric(token):
    """Test 6: amount=abc - should return 400"""
    log("\n=== TEST 6: amount=abc (400) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=abc&currency=USD",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 400:
        results["failed"].append(f"Test 6: Expected 400, got {response.status_code}")
        log(f"FAILED: Status {response.status_code} (expected 400)", "ERROR")
        return
    
    results["passed"].append("Test 6: amount=abc returns 400")
    log("PASSED: 400 for non-numeric amount")

def test_7_internal_consistency_company(token):
    """Test 7: Internal consistency check for company fee_payer"""
    log("\n=== TEST 7: Internal consistency (company) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=20&currency=USD&fee_payer=company",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 7: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code}", "ERROR")
        return
    
    data = response.json().get("data", {})
    fee_info = data.get("fee_info", {})
    
    # Check: fee = fixed_fee + percent_fee_amount
    fee = data.get("fee")
    fixed_fee = fee_info.get("fixed_fee")
    percent_fee = fee_info.get("percent_fee_amount")
    calculated_fee = fixed_fee + percent_fee
    
    if abs(fee - calculated_fee) > 0.01:
        results["failed"].append(f"Test 7: fee ({fee}) != fixed_fee ({fixed_fee}) + percent_fee_amount ({percent_fee})")
        log(f"FAILED: fee consistency - {fee} != {fixed_fee} + {percent_fee}", "ERROR")
        return
    
    # Check: you_receive = amount - fee (for company)
    amount = 20
    you_receive = data.get("you_receive")
    expected_you_receive = amount - fee
    
    if abs(you_receive - expected_you_receive) > 0.01:
        results["failed"].append(f"Test 7: you_receive ({you_receive}) != amount ({amount}) - fee ({fee})")
        log(f"FAILED: you_receive consistency - {you_receive} != {amount} - {fee}", "ERROR")
        return
    
    # Check: customer_pays = amount (for company)
    customer_pays = data.get("customer_pays")
    if abs(customer_pays - amount) > 0.01:
        results["failed"].append(f"Test 7: customer_pays ({customer_pays}) != amount ({amount})")
        log(f"FAILED: customer_pays consistency - {customer_pays} != {amount}", "ERROR")
        return
    
    results["passed"].append("Test 7: Internal consistency (company)")
    log(f"PASSED: fee={fee} = fixed_fee({fixed_fee}) + percent_fee({percent_fee}), you_receive={you_receive} = amount({amount}) - fee({fee}), customer_pays={customer_pays} = amount({amount})")

def test_8_internal_consistency_customer(token):
    """Test 8: Internal consistency check for customer fee_payer"""
    log("\n=== TEST 8: Internal consistency (customer) ===")
    
    response = requests.get(
        f"{API_BASE}/pay/fee-preview?amount=20&currency=USD&fee_payer=customer",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    if response.status_code != 200:
        results["failed"].append(f"Test 8: Expected 200, got {response.status_code}")
        log(f"FAILED: Status {response.status_code}", "ERROR")
        return
    
    data = response.json().get("data", {})
    fee_info = data.get("fee_info", {})
    
    # Check: fee = fixed_fee + percent_fee_amount
    fee = data.get("fee")
    fixed_fee = fee_info.get("fixed_fee")
    percent_fee = fee_info.get("percent_fee_amount")
    calculated_fee = fixed_fee + percent_fee
    
    if abs(fee - calculated_fee) > 0.01:
        results["failed"].append(f"Test 8: fee ({fee}) != fixed_fee ({fixed_fee}) + percent_fee_amount ({percent_fee})")
        log(f"FAILED: fee consistency - {fee} != {fixed_fee} + {percent_fee}", "ERROR")
        return
    
    # Check: you_receive = amount (for customer - merchant gets FULL amount)
    amount = 20
    you_receive = data.get("you_receive")
    
    if abs(you_receive - amount) > 0.01:
        results["failed"].append(f"Test 8: you_receive ({you_receive}) != amount ({amount}) - should be FULL amount")
        log(f"FAILED: you_receive consistency - {you_receive} != {amount} (FULL amount)", "ERROR")
        return
    
    # Check: customer_pays = amount + fee (for customer)
    customer_pays = data.get("customer_pays")
    expected_customer_pays = amount + fee
    
    if abs(customer_pays - expected_customer_pays) > 0.01:
        results["failed"].append(f"Test 8: customer_pays ({customer_pays}) != amount ({amount}) + fee ({fee})")
        log(f"FAILED: customer_pays consistency - {customer_pays} != {amount} + {fee}", "ERROR")
        return
    
    results["passed"].append("Test 8: Internal consistency (customer)")
    log(f"PASSED: fee={fee} = fixed_fee({fixed_fee}) + percent_fee({percent_fee}), you_receive={you_receive} = amount({amount}) (FULL), customer_pays={customer_pays} = amount({amount}) + fee({fee})")

def main():
    """Main test runner"""
    log("=" * 80)
    log("Fee-Preview Endpoint Regression Test (Fixed Tier Fees)")
    log("Session 2026-08-05 (b) - Item d")
    log("=" * 80)
    
    try:
        # Login
        token = login()
        
        # Run tests
        test_1_fee_payer_company(token)
        test_2_fee_payer_customer(token)
        test_3_no_fee_payer_default(token)
        test_4_no_auth_401()
        test_5_invalid_amount_zero(token)
        test_6_invalid_amount_non_numeric(token)
        test_7_internal_consistency_company(token)
        test_8_internal_consistency_customer(token)
        
        # Print summary
        log("\n" + "=" * 80)
        log("TEST SUMMARY")
        log("=" * 80)
        
        log(f"\n✅ PASSED: {len(results['passed'])}")
        for test in results["passed"]:
            log(f"  ✓ {test}")
        
        if results["failed"]:
            log(f"\n❌ FAILED: {len(results['failed'])}")
            for test in results["failed"]:
                log(f"  ✗ {test}", "ERROR")
        
        if results["warnings"]:
            log(f"\n⚠️  WARNINGS: {len(results['warnings'])}")
            for test in results["warnings"]:
                log(f"  ! {test}", "WARN")
        
        log("\n" + "=" * 80)
        
        if results["failed"]:
            log(f"RESULT: {len(results['failed'])} test(s) FAILED", "ERROR")
            sys.exit(1)
        else:
            log(f"RESULT: ALL TESTS PASSED ({len(results['passed'])} passed, {len(results['warnings'])} warnings)", "INFO")
            sys.exit(0)
    
    except Exception as e:
        log(f"FATAL ERROR: {str(e)}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
