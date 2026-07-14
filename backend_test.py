#!/usr/bin/env python3
"""
Session 48 Backend Regression Test — NARROW scope
Only ONE backend endpoint changed: getTransactions in /app/backend/controller/companyController.ts
The SQL was extended with 3 new LEFT JOINs to add a canonical `source` object to each transaction row.

Test credentials:
- Merchant: hostbay@moxx.co / Katiekendra123@ (user_id=1, company_id=1)
- Preview URL: https://d053b132-1524-4c79-bbbb-8d16df49fb02.preview.emergentagent.com

5 assertions:
1. Auth + endpoint reachable (with CSRF token flow)
2. source shape on every row (KEY new behavior)
3. Type distribution — semantic correctness
4. No regressions on existing fields
5. Backward-compat quick smoke on unrelated endpoints
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Configuration
BASE_URL = "https://d053b132-1524-4c79-bbbb-8d16df49fb02.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials
MERCHANT_EMAIL = "hostbay@moxx.co"
MERCHANT_PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

# Valid source types
VALID_SOURCE_TYPES = {"payment_link", "contribution", "tip", "product", "direct"}

# Test results
test_results = []


def log_test(test_name: str, passed: bool, message: str):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}: {message}"
    print(result)
    test_results.append({"test": test_name, "passed": passed, "message": message})


def test_1_auth_and_endpoint():
    """
    Test 1: Auth + endpoint reachable
    - GET /api/csrf-token to get CSRF token
    - POST /api/user/login with CSRF token to get JWT
    - GET /api/company/getTransactions/1 with JWT
    - Verify response envelope structure
    """
    print("\n" + "="*80)
    print("TEST 1: Auth + endpoint reachable")
    print("="*80)
    
    try:
        # Step 1: Get CSRF token
        print("\n[1.1] Getting CSRF token...")
        session = requests.Session()
        csrf_response = session.get(f"{API_URL}/csrf-token")
        
        if csrf_response.status_code != 200:
            log_test("T1.1 - CSRF token", False, f"Failed to get CSRF token: {csrf_response.status_code}")
            return None, None
        
        csrf_data = csrf_response.json()
        csrf_token = csrf_data.get("csrf_token") or csrf_data.get("csrfToken")
        
        if not csrf_token:
            log_test("T1.1 - CSRF token", False, f"CSRF token not found in response: {csrf_data}")
            return None, None
        
        print(f"✓ CSRF token obtained: {csrf_token[:20]}...")
        log_test("T1.1 - CSRF token", True, "CSRF token obtained successfully")
        
        # Step 2: Login with CSRF token
        print("\n[1.2] Logging in with CSRF token...")
        login_payload = {
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        }
        
        login_response = session.post(
            f"{API_URL}/user/login",
            json=login_payload,
            headers={
                "x-csrf-token": csrf_token,
                "Content-Type": "application/json"
            }
        )
        
        if login_response.status_code != 200:
            log_test("T1.2 - Login", False, f"Login failed: {login_response.status_code} - {login_response.text[:200]}")
            return None, None
        
        login_data = login_response.json()
        jwt_token = login_data.get("data", {}).get("accessToken") or login_data.get("data", {}).get("token")
        
        if not jwt_token:
            log_test("T1.2 - Login", False, f"JWT token not found in login response. Keys: {list(login_data.get('data', {}).keys())}")
            return None, None
        
        print(f"✓ Login successful, JWT obtained: {jwt_token[:30]}...")
        log_test("T1.2 - Login", True, "Login successful, JWT obtained")
        
        # Step 3: Get transactions
        print("\n[1.3] Getting transactions...")
        transactions_response = session.get(
            f"{API_URL}/company/getTransactions/{COMPANY_ID}",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
        )
        
        if transactions_response.status_code != 200:
            log_test("T1.3 - Get transactions", False, f"Failed to get transactions: {transactions_response.status_code}")
            return None, None
        
        print(f"✓ Transactions endpoint returned 200")
        log_test("T1.3 - Get transactions", True, "Transactions endpoint returned 200")
        
        # Step 4: Verify response envelope
        print("\n[1.4] Verifying response envelope...")
        response_data = transactions_response.json()
        
        # Check top-level structure (status field is optional, HTTP status code is what matters)
        if "message" not in response_data:
            log_test("T1.4 - Response envelope", False, "Missing 'message' field in response")
            return None, None
        
        if "data" not in response_data:
            log_test("T1.4 - Response envelope", False, "Missing 'data' field in response")
            return None, None
        
        data = response_data.get("data", {})
        
        # Check data structure
        if "transactions" not in data:
            log_test("T1.4 - Response envelope", False, "Missing 'transactions' field in data")
            return None, None
        
        if "currency" not in data:
            log_test("T1.4 - Response envelope", False, "Missing 'currency' field in data")
            return None, None
        
        if "currency_info" not in data:
            log_test("T1.4 - Response envelope", False, "Missing 'currency_info' field in data")
            return None, None
        
        transactions = data.get("transactions", [])
        currency = data.get("currency")
        currency_info = data.get("currency_info", {})
        
        print(f"✓ Response envelope valid:")
        print(f"  - HTTP status: {transactions_response.status_code}")
        print(f"  - message: {response_data.get('message')}")
        print(f"  - transactions count: {len(transactions)}")
        print(f"  - currency: {currency}")
        print(f"  - currency_info keys: {list(currency_info.keys())}")
        
        log_test("T1.4 - Response envelope", True, f"Response envelope valid with {len(transactions)} transactions")
        
        return jwt_token, transactions
        
    except Exception as e:
        log_test("T1 - Auth and endpoint", False, f"Exception: {str(e)}")
        return None, None


def test_2_source_shape(transactions: List[Dict[str, Any]]):
    """
    Test 2: source shape on every row (KEY new behavior)
    - Iterate response.data.transactions[]
    - Assert EVERY row has a `source` object with keys: type, title, ref, link_id, link_type, parent_link_id, order_id, order_ref
    - Assert `source.type` is one of the 5 valid values: payment_link, contribution, tip, product, direct
    """
    print("\n" + "="*80)
    print("TEST 2: source shape on every row (KEY new behavior)")
    print("="*80)
    
    if not transactions:
        log_test("T2 - Source shape", False, "No transactions to test")
        return
    
    print(f"\n[2.1] Checking source object on {len(transactions)} transactions...")
    
    required_keys = {"type", "title", "ref", "link_id", "link_type", "parent_link_id", "order_id", "order_ref"}
    failed_rows = []
    invalid_types = []
    
    for idx, txn in enumerate(transactions):
        # Check if source exists
        if "source" not in txn:
            failed_rows.append(f"Row {idx}: Missing 'source' object")
            continue
        
        source = txn.get("source", {})
        
        # Check all required keys exist
        missing_keys = required_keys - set(source.keys())
        if missing_keys:
            failed_rows.append(f"Row {idx}: Missing keys in source: {missing_keys}")
            continue
        
        # Check source.type is valid
        source_type = source.get("type")
        if source_type not in VALID_SOURCE_TYPES:
            invalid_types.append(f"Row {idx}: Invalid source.type '{source_type}' (expected one of {VALID_SOURCE_TYPES})")
    
    if failed_rows:
        print(f"\n❌ Found {len(failed_rows)} rows with missing/invalid source:")
        for error in failed_rows[:5]:  # Show first 5 errors
            print(f"  - {error}")
        log_test("T2.1 - Source object presence", False, f"{len(failed_rows)} rows missing source or keys")
        return
    
    print(f"✓ All {len(transactions)} rows have complete source object with all required keys")
    log_test("T2.1 - Source object presence", True, f"All {len(transactions)} rows have complete source object")
    
    if invalid_types:
        print(f"\n❌ Found {len(invalid_types)} rows with invalid source.type:")
        for error in invalid_types[:5]:
            print(f"  - {error}")
        log_test("T2.2 - Source type validity", False, f"{len(invalid_types)} rows have invalid source.type")
        return
    
    print(f"✓ All {len(transactions)} rows have valid source.type")
    log_test("T2.2 - Source type validity", True, f"All {len(transactions)} rows have valid source.type")
    
    # Show sample source objects
    print("\n[2.3] Sample source objects:")
    for idx, txn in enumerate(transactions[:3]):
        source = txn.get("source", {})
        print(f"\n  Transaction {idx + 1}:")
        print(f"    - type: {source.get('type')}")
        print(f"    - title: {source.get('title')}")
        print(f"    - ref: {source.get('ref')}")
        print(f"    - link_id: {source.get('link_id')}")
        print(f"    - link_type: {source.get('link_type')}")
        print(f"    - parent_link_id: {source.get('parent_link_id')}")
        print(f"    - order_id: {source.get('order_id')}")
        print(f"    - order_ref: {source.get('order_ref')}")


def test_3_type_distribution(transactions: List[Dict[str, Any]]):
    """
    Test 3: Type distribution — semantic correctness
    - Group all rows by source.type and report count per type
    - For source.type='tip': assert source.parent_link_id is not null
    - For source.type='contribution': assert source.parent_link_id is not null
    - For source.type='product': assert source.order_id is not null
    - For source.type='payment_link': assert source.link_id is not null
    - For source.type='direct': it's OK for link_id/order_id to be null
    """
    print("\n" + "="*80)
    print("TEST 3: Type distribution — semantic correctness")
    print("="*80)
    
    if not transactions:
        log_test("T3 - Type distribution", False, "No transactions to test")
        return
    
    # Group by type
    type_counts = {}
    type_violations = []
    
    for idx, txn in enumerate(transactions):
        source = txn.get("source", {})
        source_type = source.get("type")
        
        # Count
        type_counts[source_type] = type_counts.get(source_type, 0) + 1
        
        # Semantic checks
        if source_type == "tip":
            if source.get("parent_link_id") is None:
                type_violations.append(f"Row {idx}: type='tip' but parent_link_id is null")
        
        elif source_type == "contribution":
            if source.get("parent_link_id") is None:
                type_violations.append(f"Row {idx}: type='contribution' but parent_link_id is null")
        
        elif source_type == "product":
            if source.get("order_id") is None:
                type_violations.append(f"Row {idx}: type='product' but order_id is null")
        
        elif source_type == "payment_link":
            if source.get("link_id") is None:
                type_violations.append(f"Row {idx}: type='payment_link' but link_id is null")
        
        # For 'direct', no checks needed (link_id/order_id can be null)
    
    # Report distribution
    print("\n[3.1] Type distribution histogram:")
    for source_type in sorted(type_counts.keys()):
        count = type_counts[source_type]
        percentage = (count / len(transactions)) * 100
        print(f"  - {source_type:15s}: {count:4d} ({percentage:5.1f}%)")
    
    log_test("T3.1 - Type distribution", True, f"Distribution: {dict(type_counts)}")
    
    # Report violations
    if type_violations:
        print(f"\n❌ Found {len(type_violations)} semantic violations:")
        for error in type_violations[:10]:  # Show first 10
            print(f"  - {error}")
        log_test("T3.2 - Semantic correctness", False, f"{len(type_violations)} violations found")
        
        # Show offending row details
        if type_violations:
            print("\n[3.3] Sample offending row:")
            # Extract row index from first violation
            first_violation = type_violations[0]
            row_idx = int(first_violation.split("Row ")[1].split(":")[0])
            offending_txn = transactions[row_idx]
            print(f"  Transaction ID: {offending_txn.get('id')}")
            print(f"  Source: {json.dumps(offending_txn.get('source'), indent=4)}")
    else:
        print(f"\n✓ All {len(transactions)} rows pass semantic correctness checks")
        log_test("T3.2 - Semantic correctness", True, f"All {len(transactions)} rows semantically correct")


def test_4_no_regressions(transactions: List[Dict[str, Any]]):
    """
    Test 4: No regressions on existing fields
    - Pick 3 random rows
    - Assert they still have: id, base_amount, base_currency, crypto_currency, crypto_amount, 
      usd_value, status, createdAt, customer_name, display_amount, display_currency, 
      amount_display, auto_converted, auto_convert
    """
    print("\n" + "="*80)
    print("TEST 4: No regressions on existing fields")
    print("="*80)
    
    if not transactions:
        log_test("T4 - No regressions", False, "No transactions to test")
        return
    
    # Required fields
    required_fields = {
        "id", "base_amount", "base_currency", "crypto_currency", "crypto_amount",
        "usd_value", "status", "createdAt", "customer_name", "display_amount",
        "display_currency", "amount_display", "auto_converted", "auto_convert"
    }
    
    # Pick up to 3 transactions
    sample_size = min(3, len(transactions))
    sample_transactions = transactions[:sample_size]
    
    print(f"\n[4.1] Checking {sample_size} sample transactions for required fields...")
    
    all_passed = True
    for idx, txn in enumerate(sample_transactions):
        missing_fields = required_fields - set(txn.keys())
        
        if missing_fields:
            print(f"\n❌ Transaction {idx + 1} (id={txn.get('id')}) missing fields: {missing_fields}")
            all_passed = False
        else:
            print(f"\n✓ Transaction {idx + 1} (id={txn.get('id')}) has all required fields")
            print(f"  - id: {txn.get('id')}")
            print(f"  - base_amount: {txn.get('base_amount')} {txn.get('base_currency')}")
            print(f"  - crypto: {txn.get('crypto_amount')} {txn.get('crypto_currency')}")
            print(f"  - usd_value: {txn.get('usd_value')}")
            print(f"  - status: {txn.get('status')}")
            print(f"  - createdAt: {txn.get('createdAt')}")
            print(f"  - customer_name: {txn.get('customer_name')}")
            print(f"  - display: {txn.get('amount_display')} ({txn.get('display_amount')} {txn.get('display_currency')})")
            print(f"  - auto_converted: {txn.get('auto_converted')}")
            print(f"  - auto_convert: {'present' if txn.get('auto_convert') else 'null'}")
    
    if all_passed:
        log_test("T4 - No regressions", True, f"All {sample_size} sample transactions have required fields")
    else:
        log_test("T4 - No regressions", False, "Some transactions missing required fields")


def test_5_backward_compat(jwt_token: str):
    """
    Test 5: Backward-compat quick smoke on unrelated endpoints
    - GET /api/user/profile → still returns 200
    - GET /api/status/uptime → 200 with uptime data
    """
    print("\n" + "="*80)
    print("TEST 5: Backward-compat quick smoke on unrelated endpoints")
    print("="*80)
    
    try:
        # Test 5.1: GET /api/user/profile
        print("\n[5.1] Testing GET /api/user/profile...")
        session = requests.Session()
        profile_response = session.get(
            f"{API_URL}/user/profile",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
        )
        
        if profile_response.status_code == 200:
            print(f"✓ GET /api/user/profile returned 200")
            log_test("T5.1 - /api/user/profile", True, "Endpoint returned 200")
        else:
            print(f"❌ GET /api/user/profile returned {profile_response.status_code}")
            log_test("T5.1 - /api/user/profile", False, f"Endpoint returned {profile_response.status_code}")
        
        # Test 5.2: GET /api/status/uptime
        print("\n[5.2] Testing GET /api/status/uptime...")
        uptime_response = requests.get(f"{API_URL}/status/uptime")
        
        if uptime_response.status_code != 200:
            print(f"❌ GET /api/status/uptime returned {uptime_response.status_code}")
            log_test("T5.2 - /api/status/uptime", False, f"Endpoint returned {uptime_response.status_code}")
            return
        
        uptime_data = uptime_response.json()
        print(f"✓ GET /api/status/uptime returned 200")
        
        # Check uptime data structure
        if "data" in uptime_data:
            data = uptime_data.get("data", {})
            print(f"  - uptime_percentage: {data.get('uptime_percentage')}%")
            print(f"  - period_days: {data.get('period_days')}")
            log_test("T5.2 - /api/status/uptime", True, "Endpoint returned 200 with uptime data")
        else:
            log_test("T5.2 - /api/status/uptime", False, "Missing 'data' field in response")
        
    except Exception as e:
        log_test("T5 - Backward compat", False, f"Exception: {str(e)}")


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SESSION 48 BACKEND REGRESSION TEST — NARROW SCOPE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Merchant: {MERCHANT_EMAIL}")
    print(f"Company ID: {COMPANY_ID}")
    print("="*80)
    
    # Test 1: Auth and endpoint
    jwt_token, transactions = test_1_auth_and_endpoint()
    
    if not jwt_token or transactions is None:
        print("\n❌ Test 1 failed, cannot proceed with remaining tests")
        print_summary()
        sys.exit(1)
    
    # Test 2: Source shape
    test_2_source_shape(transactions)
    
    # Test 3: Type distribution
    test_3_type_distribution(transactions)
    
    # Test 4: No regressions
    test_4_no_regressions(transactions)
    
    # Test 5: Backward compat
    test_5_backward_compat(jwt_token)
    
    # Print summary
    print_summary()


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    failed = sum(1 for r in test_results if not r["passed"])
    total = len(test_results)
    
    print(f"\nTotal tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    
    if failed > 0:
        print("\nFailed tests:")
        for result in test_results:
            if not result["passed"]:
                print(f"  ❌ {result['test']}: {result['message']}")
    
    print("\n" + "="*80)
    
    if failed == 0:
        print("✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
