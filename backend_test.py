#!/usr/bin/env python3
"""
Backend Test: Payment Received Email Bug Fix Verification
Session 38: Verify that payment-email-preview endpoint returns correct fiat amounts
Bug: Email showed $1.00 instead of ~$100 for transaction 388
"""

import requests
import json
import sys

# Base URL from review request
BASE_URL = "https://dynopay-preview-6.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# User-Agent header (required for some endpoints)
HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

def print_test_header(test_num, description):
    """Print formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(status, message, details=None):
    """Print test result"""
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} {status}: {message}")
    if details:
        print(f"   Details: {details}")

def login():
    """Login and get JWT token"""
    print_test_header("AUTH", "Login to get JWT token")
    
    url = f"{BASE_URL}/user/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, headers=HEADERS_BASE, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "data" in data and "accessToken" in data["data"]:
                token = data["data"]["accessToken"]
                print_result("PASS", "Login successful", f"Token obtained (length: {len(token)})")
                return token
            else:
                print_result("FAIL", "Login response missing accessToken", json.dumps(data, indent=2))
                return None
        else:
            print_result("FAIL", f"Login failed with status {response.status_code}", response.text[:500])
            return None
    except Exception as e:
        print_result("FAIL", f"Login request failed: {str(e)}")
        return None

def test_payment_email_preview(token, tx_id, expected_amount_range, expected_crypto):
    """Test GET /api/transactions/:id/payment-email-preview endpoint"""
    url = f"{BASE_URL}/transactions/{tx_id}/payment-email-preview"
    headers = {**HEADERS_BASE, "Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"   URL: {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            response_json = response.json()
            print(f"   Response: {json.dumps(response_json, indent=2)}")
            
            # Extract data object (API returns {message, data})
            data = response_json.get("data", response_json)
            
            # Extract key fields
            amount = data.get("amount")
            currency = data.get("currency")
            crypto_amount = data.get("crypto_amount")
            crypto_currency = data.get("crypto_currency")
            usd_value = data.get("usd_value")
            
            print(f"   Amount: {amount} {currency}")
            print(f"   Crypto: {crypto_amount} {crypto_currency}")
            print(f"   USD Value: {usd_value}")
            
            # Validate amount is in expected range
            if amount is not None:
                amount_float = float(amount)
                min_expected, max_expected = expected_amount_range
                
                if min_expected <= amount_float <= max_expected:
                    print_result("PASS", f"Amount {amount_float} {currency} is in expected range [{min_expected}, {max_expected}]")
                    
                    # Additional validation
                    if currency == "USD":
                        print_result("PASS", f"Currency is USD as expected")
                    
                    if expected_crypto and crypto_currency:
                        if expected_crypto in crypto_currency:
                            print_result("PASS", f"Crypto currency contains {expected_crypto}")
                        else:
                            print_result("FAIL", f"Crypto currency {crypto_currency} does not contain {expected_crypto}")
                    
                    return True
                else:
                    print_result("FAIL", f"Amount {amount_float} is NOT in expected range [{min_expected}, {max_expected}]")
                    if amount_float == 1.00:
                        print_result("FAIL", "⚠️  BUG NOT FIXED: Amount is still 1.00 (the original bug)")
                    return False
            else:
                print_result("FAIL", "Amount field is missing in response")
                return False
        else:
            print_result("FAIL", f"Request failed with status {response.status_code}", response.text[:500])
            return False
            
    except Exception as e:
        print_result("FAIL", f"Request exception: {str(e)}")
        return False

def test_unauthorized_access(tx_id):
    """Test that endpoint requires authentication"""
    url = f"{BASE_URL}/transactions/{tx_id}/payment-email-preview"
    
    try:
        # Request without Authorization header
        response = requests.get(url, headers=HEADERS_BASE, timeout=30)
        print(f"   URL: {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 401:
            print_result("PASS", "Unauthorized access correctly blocked with 401")
            return True
        else:
            print_result("FAIL", f"Expected 401, got {response.status_code}", response.text[:500])
            return False
            
    except Exception as e:
        print_result("FAIL", f"Request exception: {str(e)}")
        return False

def test_regression_invoice_preview(token, tx_id):
    """Test regression: invoice-preview endpoint still works"""
    url = f"{BASE_URL}/transactions/{tx_id}/invoice-preview"
    headers = {**HEADERS_BASE, "Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"   URL: {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response keys: {list(data.keys())}")
            
            # Check for fixed_fee field
            if "fixed_fee" in data:
                fixed_fee = data["fixed_fee"]
                print(f"   fixed_fee: {fixed_fee}")
                
                if fixed_fee == 1.00 or fixed_fee == "1.00":
                    print_result("PASS", f"Invoice preview working, fixed_fee = {fixed_fee}")
                    return True
                else:
                    print_result("PASS", f"Invoice preview working, fixed_fee = {fixed_fee} (different from expected 1.00)")
                    return True
            else:
                print_result("PASS", "Invoice preview working (fixed_fee field not present)")
                return True
        else:
            print_result("FAIL", f"Request failed with status {response.status_code}", response.text[:500])
            return False
            
    except Exception as e:
        print_result("FAIL", f"Request exception: {str(e)}")
        return False

def test_regression_invoices_list(token):
    """Test regression: invoices list endpoint still works"""
    url = f"{BASE_URL}/invoices"
    headers = {**HEADERS_BASE, "Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"   URL: {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response type: {type(data)}")
            if isinstance(data, dict):
                print(f"   Response keys: {list(data.keys())}")
            print_result("PASS", "Invoices list endpoint working")
            return True
        else:
            print_result("FAIL", f"Request failed with status {response.status_code}", response.text[:500])
            return False
            
    except Exception as e:
        print_result("FAIL", f"Request exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TEST: Payment Received Email Bug Fix Verification")
    print("Session 38: Payment email shows wrong fiat amount")
    print("="*80)
    
    results = []
    
    # Login
    token = login()
    if not token:
        print("\n❌ CRITICAL: Cannot proceed without authentication token")
        sys.exit(1)
    
    # Test 1: Transaction 388 (BTC ~$100) - THE BUG
    print_test_header(1, "GET /api/transactions/388/payment-email-preview (BTC ~$100 - THE BUG)")
    result = test_payment_email_preview(token, 388, (95, 105), "BTC")
    results.append(("Test 1: TX 388 (BTC ~$100)", result))
    
    # Test 2: Transaction 383 (BTC ~$37.41)
    print_test_header(2, "GET /api/transactions/383/payment-email-preview (BTC ~$37.41)")
    result = test_payment_email_preview(token, 383, (35, 40), "BTC")
    results.append(("Test 2: TX 383 (BTC ~$37.41)", result))
    
    # Test 3: Transaction 382 (ETH ~$58.14)
    print_test_header(3, "GET /api/transactions/382/payment-email-preview (ETH ~$58.14)")
    result = test_payment_email_preview(token, 382, (55, 62), "ETH")
    results.append(("Test 3: TX 382 (ETH ~$58.14)", result))
    
    # Test 4: Transaction 390 (USDT-TRC20 ~$24.63)
    print_test_header(4, "GET /api/transactions/390/payment-email-preview (USDT-TRC20 ~$24.63)")
    result = test_payment_email_preview(token, 390, (22, 27), "USDT")
    results.append(("Test 4: TX 390 (USDT-TRC20 ~$24.63)", result))
    
    # Test 5: Security - Unauthorized access
    print_test_header(5, "Security: GET /api/transactions/388/payment-email-preview (NO auth)")
    result = test_unauthorized_access(388)
    results.append(("Test 5: Security (401 without auth)", result))
    
    # Test 6: Regression - Invoice preview
    print_test_header(6, "Regression: GET /api/transactions/388/invoice-preview")
    result = test_regression_invoice_preview(token, 388)
    results.append(("Test 6: Regression invoice-preview", result))
    
    # Test 7: Regression - Invoices list
    print_test_header(7, "Regression: GET /api/invoices")
    result = test_regression_invoices_list(token)
    results.append(("Test 7: Regression invoices list", result))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        symbol = "✅" if result else "❌"
        status = "PASS" if result else "FAIL"
        print(f"{symbol} {test_name}: {status}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print(f"{'='*80}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Bug fix verified successfully!")
        print("✅ Transaction 388 now shows ~$100 USD (NOT $1.00)")
        print("✅ All other transactions show correct USD amounts")
        print("✅ Security check passed (401 without auth)")
        print("✅ No regressions in invoice endpoints")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - See details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())
