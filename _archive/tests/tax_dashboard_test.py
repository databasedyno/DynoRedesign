#!/usr/bin/env python3
"""
DynoPay Tax Dashboard & Quote-Tax Backend Test - Session 57 B.4 + Phase C
Testing dashboard tax_collected field and cart/quote-tax validation against LIVE Railway PostgreSQL

SAFETY: LIVE PRODUCTION DATABASE - READ-ONLY ONLY
- NO product/order/merchant settings creation or modification
- Only GET requests and one POST to quote-tax with empty cart (validation check)

Test account: hostbay@moxx.co / Katiekendra123@ (user_id=1, company_id=1)
Base URL: http://localhost:8001 (internal)
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8001"
API_URL = f"{BASE_URL}/api"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log_test(test_name: str, passed: bool, message: str, details: Optional[Dict] = None):
    """Log test result"""
    result = {
        "test": test_name,
        "message": message,
        "details": details or {}
    }
    if passed:
        test_results["passed"].append(result)
        print(f"✅ {test_name}: {message}")
    else:
        test_results["failed"].append(result)
        print(f"❌ {test_name}: {message}")
    
    if details:
        print(f"   Details: {json.dumps(details, indent=2)}")

def log_warning(test_name: str, message: str):
    """Log warning"""
    test_results["warnings"].append({"test": test_name, "message": message})
    print(f"⚠️  {test_name}: {message}")

def login() -> Optional[str]:
    """
    Login and return JWT token
    Expected response: { data: { token: "...", expiresIn: 604800 } }
    """
    try:
        print("\n" + "="*80)
        print("TEST: Login and Get JWT Token")
        print("="*80)
        
        headers = {
            "Content-Type": "application/json"
        }
        payload = {
            "email": EMAIL,
            "password": PASSWORD
        }
        
        response = requests.post(
            f"{API_URL}/user/login",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Extract token from response
            token = None
            
            if "data" in data:
                token = data["data"].get("token") or data["data"].get("accessToken")
            elif "token" in data:
                token = data.get("token")
            elif "accessToken" in data:
                token = data.get("accessToken")
            
            if token:
                log_test("Login", True, f"Successfully logged in. Token length: {len(token)} chars")
                return token
            else:
                log_test("Login", False, "No token found in response", {"response": data})
                return None
        else:
            log_test("Login", False, f"Login failed with status {response.status_code}", 
                    {"response": response.text})
            return None
            
    except Exception as e:
        log_test("Login", False, f"Login exception: {str(e)}")
        return None

def test_dashboard_tax_collected(token: str, wait_for_cache: bool = False):
    """
    Test 1: GET /api/dashboard
    Verify that the response data object contains a tax_collected object with:
    - amount (number)
    - amount_formatted (string)
    - current_month (number)
    - current_month_formatted (string)
    - currency (string)
    
    Note: This endpoint is Redis-cached for 120 seconds. If tax_collected is missing
    on first call, wait ~125 seconds and try again.
    """
    try:
        print("\n" + "="*80)
        print("TEST 1: GET /api/dashboard - Verify tax_collected field")
        print("="*80)
        
        if wait_for_cache:
            print("⏳ Waiting 125 seconds for Redis cache to refresh...")
            time.sleep(125)
            print("✅ Cache wait complete. Making request...")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{API_URL}/dashboard",
            headers=headers,
            timeout=15
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            log_test("Dashboard Tax Collected", False, 
                    f"Dashboard endpoint returned {response.status_code}", 
                    {"response": response.text[:500]})
            return False
        
        data = response.json()
        
        # Check if data object exists
        if "data" not in data:
            log_test("Dashboard Tax Collected", False, 
                    "Response missing 'data' object", 
                    {"response_keys": list(data.keys())})
            return False
        
        response_data = data["data"]
        
        # Check if tax_collected exists
        if "tax_collected" not in response_data:
            if not wait_for_cache:
                log_warning("Dashboard Tax Collected", 
                           "tax_collected field missing - may need cache refresh")
                print("🔄 Retrying after cache refresh...")
                return test_dashboard_tax_collected(token, wait_for_cache=True)
            else:
                log_test("Dashboard Tax Collected", False, 
                        "tax_collected field missing even after cache refresh", 
                        {"data_keys": list(response_data.keys())})
                return False
        
        tax_collected = response_data["tax_collected"]
        
        # Verify all required fields
        required_fields = {
            "amount": (int, float),
            "amount_formatted": str,
            "current_month": (int, float),
            "current_month_formatted": str,
            "currency": str
        }
        
        missing_fields = []
        invalid_types = []
        
        for field, expected_type in required_fields.items():
            if field not in tax_collected:
                missing_fields.append(field)
            else:
                value = tax_collected[field]
                if isinstance(expected_type, tuple):
                    if not isinstance(value, expected_type):
                        invalid_types.append(f"{field} (expected {expected_type}, got {type(value).__name__})")
                else:
                    if not isinstance(value, expected_type):
                        invalid_types.append(f"{field} (expected {expected_type.__name__}, got {type(value).__name__})")
        
        if missing_fields:
            log_test("Dashboard Tax Collected", False, 
                    f"Missing required fields: {', '.join(missing_fields)}", 
                    {"tax_collected": tax_collected})
            return False
        
        if invalid_types:
            log_test("Dashboard Tax Collected", False, 
                    f"Invalid field types: {', '.join(invalid_types)}", 
                    {"tax_collected": tax_collected})
            return False
        
        # Success - log the actual values
        details = {
            "tax_collected": tax_collected,
            "cache_wait_needed": wait_for_cache
        }
        
        log_test("Dashboard Tax Collected", True, 
                f"tax_collected field present and well-formed. " +
                f"Amount: {tax_collected['amount_formatted']}, " +
                f"Current month: {tax_collected['current_month_formatted']}, " +
                f"Currency: {tax_collected['currency']}", 
                details)
        
        return True
        
    except Exception as e:
        log_test("Dashboard Tax Collected", False, f"Exception: {str(e)}")
        return False

def test_quote_tax_empty_cart(token: str):
    """
    Test 2: POST /api/cart/quote-tax
    Verify that posting with empty items array returns 400 with "Cart is empty." message
    This is a public endpoint but we'll use auth for consistency
    """
    try:
        print("\n" + "="*80)
        print("TEST 2: POST /api/cart/quote-tax - Empty cart validation")
        print("="*80)
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Test with merchant_handle
        payload = {
            "merchant_handle": "hostbay",
            "items": []
        }
        
        print(f"Testing with payload: {json.dumps(payload)}")
        
        response = requests.post(
            f"{API_URL}/cart/quote-tax",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            log_test("Quote Tax Empty Cart", False, 
                    f"Expected 400 status, got {response.status_code}", 
                    {"response": response.text})
            return False
        
        data = response.json()
        
        # Check for error message
        message = data.get("message", "")
        
        if "cart is empty" in message.lower() or "empty" in message.lower():
            log_test("Quote Tax Empty Cart", True, 
                    f"Correct validation response: '{message}'", 
                    {"full_response": data})
            return True
        else:
            log_test("Quote Tax Empty Cart", False, 
                    f"Unexpected error message: '{message}'", 
                    {"full_response": data})
            return False
        
    except Exception as e:
        log_test("Quote Tax Empty Cart", False, f"Exception: {str(e)}")
        return False

def test_quote_tax_with_merchant_user_id():
    """
    Test 2b: POST /api/cart/quote-tax with merchant_user_id
    Alternative test if merchant_handle doesn't resolve
    """
    try:
        print("\n" + "="*80)
        print("TEST 2b: POST /api/cart/quote-tax - Empty cart with merchant_user_id")
        print("="*80)
        
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "merchant_user_id": 1,
            "items": []
        }
        
        print(f"Testing with payload: {json.dumps(payload)}")
        
        response = requests.post(
            f"{API_URL}/cart/quote-tax",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            log_test("Quote Tax Empty Cart (user_id)", False, 
                    f"Expected 400 status, got {response.status_code}", 
                    {"response": response.text})
            return False
        
        data = response.json()
        message = data.get("message", "")
        
        if "cart is empty" in message.lower() or "empty" in message.lower():
            log_test("Quote Tax Empty Cart (user_id)", True, 
                    f"Correct validation response: '{message}'", 
                    {"full_response": data})
            return True
        else:
            log_test("Quote Tax Empty Cart (user_id)", False, 
                    f"Unexpected error message: '{message}'", 
                    {"full_response": data})
            return False
        
    except Exception as e:
        log_test("Quote Tax Empty Cart (user_id)", False, f"Exception: {str(e)}")
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results["passed"]) + len(test_results["failed"])
    passed = len(test_results["passed"])
    failed = len(test_results["failed"])
    warnings = len(test_results["warnings"])
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Warnings: {warnings}")
    
    if test_results["failed"]:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for result in test_results["failed"]:
            print(f"\n❌ {result['test']}")
            print(f"   {result['message']}")
            if result.get('details'):
                print(f"   Details: {json.dumps(result['details'], indent=2)}")
    
    if test_results["warnings"]:
        print("\n" + "="*80)
        print("WARNINGS:")
        print("="*80)
        for warning in test_results["warnings"]:
            print(f"\n⚠️  {warning['test']}")
            print(f"   {warning['message']}")
    
    print("\n" + "="*80)
    if failed == 0:
        print("✅ ALL TESTS PASSED")
    else:
        print(f"❌ {failed} TEST(S) FAILED")
    print("="*80)
    
    return failed == 0

def main():
    """Main test execution"""
    print("="*80)
    print("DynoPay Tax Dashboard & Quote-Tax Backend Test")
    print("Session 57 B.4 + Phase C Verification")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {EMAIL}")
    print(f"Database: LIVE Railway PostgreSQL (READ-ONLY)")
    print("="*80)
    
    # Step 1: Login
    token = login()
    if not token:
        print("\n❌ Cannot proceed without authentication token")
        return False
    
    # Step 2: Test dashboard tax_collected field
    test_dashboard_tax_collected(token)
    
    # Step 3: Test quote-tax empty cart validation
    test_quote_tax_empty_cart(token)
    
    # Step 3b: Test with merchant_user_id as alternative
    test_quote_tax_with_merchant_user_id()
    
    # Print summary
    success = print_summary()
    
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
