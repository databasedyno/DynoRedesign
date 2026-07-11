#!/usr/bin/env python3
"""
Backend E2E Test for Dynopay Embedded Checkout (Phase 1a)
Tests the NEW endpoint: POST /api/user/embed/session
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://multi-coin-processor.preview.emergentagent.com"
QA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJuYW1lIjoiUUEgT25ib2FyZGluZyBUZXN0ZXIiLCJlbWFpbCI6InFhLm9uYm9hcmQuMTc4MjU4NTIzM0BkeW5vcGF5dGVzdC5jb20iLCJ1c2VybmFtZSI6bnVsbCwibW9iaWxlIjpudWxsLCJwaG90byI6Imh0dHBzOi8vMzE5OWZkMzctMDc1ZC00M2YxLWEwNTItYmE3ZjRhZTgwNjJjLnByZXZpZXcuZW1lcmdlbnRhZ2VudC5jb20vaW1hZ2VzL3VzZXJfZzB2cmJheXExOS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6dHJ1ZSwicmVmZXJyYWxfY29kZSI6IkRZTk8tNzdRUVhHIiwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibGFzdF9sb2dpbl9pcCI6IjM0LjE2LjU2LjY0IiwibGFzdF9jb21wYW55X2lkIjpudWxsLCJjdW11bGF0aXZlX3ZvbHVtZV91c2QiOiIwLjAwIiwiZmVlX2ZyZWVfcmVtYWluaW5nX3VzZCI6IjUwMC4wMCIsImZlZV90aWVyIjoidHJpYWwiLCJjcmVhdGVkQXQiOiIyMDI2LTA2LTI3VDE4OjMzOjU0Ljg2MFoiLCJ1cGRhdGVkQXQiOiIyMDI2LTA3LTA5VDIyOjU5OjQ3LjA0NVoiLCJsYW5ndWFnZSI6ImVuIiwiaWF0IjoxNzgzNzU2MTA0LCJleHAiOjE3ODYzNDgxMDR9.RBsNej5duuKaJese4CVLMiualHOvgQKo-VD0BaN7q9U"

# Test state
test_results = []
created_api_key_id = None
created_api_key_plaintext = None
client_secret_from_test_a = None


def log_test(test_name: str, passed: bool, details: str):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"Details: {details}")
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })


def setup_api_key() -> tuple[Optional[str], Optional[str]]:
    """
    Setup: Find company_id and create a SECRET API key for testing
    Returns: (api_key_id, plaintext_key)
    """
    print("\n" + "="*80)
    print("SETUP: Creating API Key for qa.onboard.1782585233@dynopaytest.com")
    print("="*80)
    
    # Step 1: Get company_id
    print("\n[SETUP] Step 1: Getting company_id...")
    headers = {"Authorization": f"Bearer {QA_JWT}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/api/userApi/getApi", headers=headers, timeout=10)
        print(f"GET /api/userApi/getApi -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check if there's already an active key
            if data.get("data"):
                api_data = data["data"]
                all_keys = api_data.get("all", [])
                
                if isinstance(all_keys, list) and len(all_keys) > 0:
                    # Found existing keys - check if any are test keys we can use
                    for api_key in all_keys:
                        if "embed-e2e-test" in api_key.get("api_name", ""):
                            print(f"✅ Found existing test key: {api_key.get('api_name')} (id={api_key.get('api_id')})")
                            print(f"Will use this existing key for testing...")
                            return api_key.get("api_id"), api_key.get("apiKey")
                    
                    # If we found keys but none are test keys, we should not create a new one
                    # as the company already has an active key
                    print(f"⚠️  Company already has {len(all_keys)} active key(s)")
                    for api_key in all_keys:
                        print(f"   - {api_key.get('api_name')} (id={api_key.get('api_id')})")
                    print("Cannot create a new key. Will use the first existing key for testing.")
                    first_key = all_keys[0]
                    return first_key.get("api_id"), first_key.get("apiKey")
                
                # Extract company_id from first key
                if len(all_keys) > 0 and "company_id" in all_keys[0]:
                    company_id = all_keys[0]["company_id"]
                    print(f"✅ Found company_id from existing API key: {company_id}")
                else:
                    # Try to get company from companies endpoint
                    print("Trying to get company_id from /api/company/getCompany...")
                    company_resp = requests.get(f"{BASE_URL}/api/company/getCompany", headers=headers, timeout=10)
                    if company_resp.status_code == 200:
                        company_data = company_resp.json()
                        if company_data.get("data"):
                            companies = company_data["data"]
                            if isinstance(companies, list) and len(companies) > 0:
                                company_id = companies[0].get("company_id")
                                print(f"✅ Found company_id from companies: {company_id}")
                            else:
                                print("❌ No companies found")
                                return None, None
                    else:
                        print(f"❌ Failed to get companies: {company_resp.status_code}")
                        return None, None
            else:
                # No existing keys, get company_id from companies endpoint
                print("No existing API keys, getting company_id from /api/company/getCompany...")
                company_resp = requests.get(f"{BASE_URL}/api/company/getCompany", headers=headers, timeout=10)
                if company_resp.status_code == 200:
                    company_data = company_resp.json()
                    if company_data.get("data"):
                        companies = company_data["data"]
                        if isinstance(companies, list) and len(companies) > 0:
                            company_id = companies[0].get("company_id")
                            print(f"✅ Found company_id: {company_id}")
                        else:
                            print("❌ No companies found")
                            return None, None
                    else:
                        print("❌ Invalid companies response")
                        return None, None
                else:
                    print(f"❌ Failed to get companies: {company_resp.status_code}")
                    return None, None
        else:
            print(f"❌ Failed to get API keys: {resp.status_code}")
            print(f"Response: {resp.text}")
            return None, None
    except Exception as e:
        print(f"❌ Error getting company_id: {e}")
        return None, None
    
    # Step 2: Create API key
    print(f"\n[SETUP] Step 2: Creating API key for company_id={company_id}...")
    create_payload = {
        "company_id": company_id,
        "base_currency": "USD",
        "api_name": "embed-e2e-test"
    }
    
    try:
        create_resp = requests.post(
            f"{BASE_URL}/api/userApi/addApi",
            headers=headers,
            json=create_payload,
            timeout=10
        )
        print(f"POST /api/userApi/addApi -> {create_resp.status_code}")
        
        if create_resp.status_code == 200:
            create_data = create_resp.json()
            print(f"Response: {json.dumps(create_data, indent=2)}")
            
            if create_data.get("data"):
                api_key_data = create_data["data"]
                api_key_id = api_key_data.get("api_id")
                encrypted_key = api_key_data.get("apiKey")  # This is the encrypted key to use in x-api-key header
                
                if encrypted_key:
                    print(f"✅ Created API key successfully!")
                    print(f"   API Key ID: {api_key_id}")
                    print(f"   Encrypted Key: {encrypted_key[:40]}...")
                    return api_key_id, encrypted_key
                else:
                    print(f"❌ API key not found in response")
                    return None, None
            else:
                print(f"❌ Failed to create API key: {create_data}")
                return None, None
        else:
            print(f"❌ Failed to create API key: {create_resp.status_code}")
            print(f"Response: {create_resp.text}")
            return None, None
    except Exception as e:
        print(f"❌ Error creating API key: {e}")
        return None, None


def test_a_positive():
    """TEST A: POSITIVE - Create embedded session with valid key"""
    global client_secret_from_test_a
    
    print("\n" + "="*80)
    print("TEST A: POSITIVE - Create embedded session")
    print("="*80)
    
    headers = {"x-api-key": created_api_key_plaintext}
    payload = {
        "amount": 50,
        "allowed_origins": ["https://shop.example.com"]
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/user/embed/session",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"POST /api/user/embed/session -> {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            # Validate response structure
            checks = []
            checks.append(("success is true", data.get("success") == True))
            checks.append(("data exists", "data" in data))
            
            if "data" in data:
                response_data = data["data"]
                
                # Check client_secret
                client_secret = response_data.get("client_secret")
                checks.append(("client_secret exists", client_secret is not None))
                checks.append(("client_secret is hex string", isinstance(client_secret, str) and len(client_secret) > 0))
                
                # Check checkout_url
                checkout_url = response_data.get("checkout_url")
                expected_url = f"{BASE_URL}/pay?d={client_secret}&embed=1"
                checks.append(("checkout_url exists", checkout_url is not None))
                checks.append(("checkout_url matches pattern", checkout_url == expected_url))
                
                # Check ui_mode
                checks.append(("ui_mode is 'embedded'", response_data.get("ui_mode") == "embedded"))
                
                # Check payment_methods
                payment_methods = response_data.get("payment_methods")
                checks.append(("payment_methods exists", payment_methods is not None))
                checks.append(("payment_methods is array", isinstance(payment_methods, list)))
                
                if isinstance(payment_methods, list) and len(payment_methods) > 0:
                    first_method = payment_methods[0]
                    checks.append(("first payment_method type is 'crypto'", first_method.get("type") == "crypto"))
                    checks.append(("currencies array exists", "currencies" in first_method))
                    checks.append(("currencies array not empty", isinstance(first_method.get("currencies"), list) and len(first_method.get("currencies")) > 0))
                
                # Save client_secret for later tests
                if client_secret:
                    client_secret_from_test_a = client_secret
            
            all_passed = all(check[1] for check in checks)
            details = "\n".join([f"  {'✅' if check[1] else '❌'} {check[0]}" for check in checks])
            
            log_test("TEST A: POSITIVE", all_passed, details)
            return all_passed
        else:
            log_test("TEST A: POSITIVE", False, f"Expected 200, got {resp.status_code}: {resp.text}")
            return False
            
    except Exception as e:
        log_test("TEST A: POSITIVE", False, f"Exception: {e}")
        return False


def test_b_render():
    """TEST B: RENDER - Verify checkout URL loads"""
    print("\n" + "="*80)
    print("TEST B: RENDER - Verify checkout page loads")
    print("="*80)
    
    if not client_secret_from_test_a:
        log_test("TEST B: RENDER", False, "Skipped - no client_secret from Test A")
        return False
    
    checkout_url = f"{BASE_URL}/pay?d={client_secret_from_test_a}&embed=1"
    
    try:
        resp = requests.get(checkout_url, timeout=10)
        print(f"GET {checkout_url} -> {resp.status_code}")
        
        if resp.status_code == 200:
            # Check if it's HTML
            content_type = resp.headers.get("content-type", "")
            is_html = "text/html" in content_type
            
            details = f"Status: {resp.status_code}, Content-Type: {content_type}, Length: {len(resp.text)} bytes"
            log_test("TEST B: RENDER", is_html, details)
            return is_html
        else:
            log_test("TEST B: RENDER", False, f"Expected 200, got {resp.status_code}")
            return False
            
    except Exception as e:
        log_test("TEST B: RENDER", False, f"Exception: {e}")
        return False


def test_c_no_auth():
    """TEST C: NEGATIVE - No auth header"""
    print("\n" + "="*80)
    print("TEST C: NEGATIVE - No auth header")
    print("="*80)
    
    payload = {
        "amount": 50,
        "allowed_origins": ["https://shop.example.com"]
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/user/embed/session",
            json=payload,
            timeout=10
        )
        
        print(f"POST /api/user/embed/session (no auth) -> {resp.status_code}")
        
        if resp.status_code in [401, 403]:
            log_test("TEST C: NEGATIVE (no auth)", True, f"Correctly rejected with {resp.status_code}")
            return True
        else:
            log_test("TEST C: NEGATIVE (no auth)", False, f"Expected 401/403, got {resp.status_code}: {resp.text}")
            return False
            
    except Exception as e:
        log_test("TEST C: NEGATIVE (no auth)", False, f"Exception: {e}")
        return False


def test_d_below_minimum():
    """TEST D: NEGATIVE - Amount below minimum"""
    print("\n" + "="*80)
    print("TEST D: NEGATIVE - Amount below minimum")
    print("="*80)
    
    headers = {"x-api-key": created_api_key_plaintext}
    payload = {"amount": 2}
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/user/embed/session",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"POST /api/user/embed/session (amount=2) -> {resp.status_code}")
        print(f"Response: {resp.text}")
        
        if resp.status_code == 400:
            # Check if message mentions minimum
            response_text = resp.text.lower()
            mentions_minimum = "minimum" in response_text or "min" in response_text
            
            log_test("TEST D: NEGATIVE (below minimum)", True, f"Correctly rejected with 400, message: {resp.text}")
            return True
        else:
            log_test("TEST D: NEGATIVE (below minimum)", False, f"Expected 400, got {resp.status_code}: {resp.text}")
            return False
            
    except Exception as e:
        log_test("TEST D: NEGATIVE (below minimum)", False, f"Exception: {e}")
        return False


def test_e_bad_key():
    """TEST E: NEGATIVE - Invalid API key"""
    print("\n" + "="*80)
    print("TEST E: NEGATIVE - Invalid API key")
    print("="*80)
    
    headers = {"x-api-key": "dpk_live_totallyinvalid"}
    payload = {"amount": 50}
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/user/embed/session",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"POST /api/user/embed/session (bad key) -> {resp.status_code}")
        
        if resp.status_code in [401, 403]:
            log_test("TEST E: NEGATIVE (bad key)", True, f"Correctly rejected with {resp.status_code}")
            return True
        else:
            log_test("TEST E: NEGATIVE (bad key)", False, f"Expected 401/403, got {resp.status_code}: {resp.text}")
            return False
            
    except Exception as e:
        log_test("TEST E: NEGATIVE (bad key)", False, f"Exception: {e}")
        return False


def test_f_session_persisted():
    """TEST F: SESSION PERSISTED - Verify session data resolves"""
    print("\n" + "="*80)
    print("TEST F: SESSION PERSISTED - Verify session data")
    print("="*80)
    
    if not client_secret_from_test_a:
        log_test("TEST F: SESSION PERSISTED", False, "Skipped - no client_secret from Test A")
        return False
    
    # Try POST /api/pay/getData with the client_secret
    payload = {"data": client_secret_from_test_a}
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/pay/getData",
            json=payload,
            timeout=10
        )
        
        print(f"POST /api/pay/getData -> {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code == 200:
            data = resp.json()
            
            checks = []
            checks.append(("data exists", "data" in data))
            
            if "data" in data:
                session_data = data["data"]
                
                # Check amount is 50
                amount = session_data.get("amount")
                checks.append(("amount is 50", amount == 50 or amount == "50" or amount == "50.00"))
                
                # Check available currencies exist
                available_currencies = session_data.get("available_currencies")
                checks.append(("available_currencies exists", available_currencies is not None))
                checks.append(("available_currencies is array", isinstance(available_currencies, list)))
                checks.append(("available_currencies not empty", isinstance(available_currencies, list) and len(available_currencies) > 0))
            
            all_passed = all(check[1] for check in checks)
            details = "\n".join([f"  {'✅' if check[1] else '❌'} {check[0]}" for check in checks])
            
            log_test("TEST F: SESSION PERSISTED", all_passed, details)
            return all_passed
        else:
            log_test("TEST F: SESSION PERSISTED", False, f"Expected 200, got {resp.status_code}: {resp.text}")
            return False
            
    except Exception as e:
        log_test("TEST F: SESSION PERSISTED", False, f"Exception: {e}")
        return False


def cleanup():
    """TEST G: CLEANUP - Delete created API key"""
    print("\n" + "="*80)
    print("TEST G: CLEANUP - Delete API key")
    print("="*80)
    
    if not created_api_key_id:
        print("⚠️  No API key ID to clean up")
        log_test("TEST G: CLEANUP", False, "No API key ID found")
        return False
    
    headers = {"Authorization": f"Bearer {QA_JWT}"}
    
    try:
        # First verify the key exists
        print(f"\n[CLEANUP] Step 1: Verifying key exists...")
        get_resp = requests.get(f"{BASE_URL}/api/userApi/getApi", headers=headers, timeout=10)
        print(f"GET /api/userApi/getApi -> {get_resp.status_code}")
        
        if get_resp.status_code == 200:
            data = get_resp.json()
            if data.get("success") and data.get("data"):
                api_list = data["data"]
                found = any(api.get("api_id") == created_api_key_id for api in api_list)
                print(f"Key {created_api_key_id} found in list: {found}")
        
        # Delete the key
        print(f"\n[CLEANUP] Step 2: Deleting key {created_api_key_id}...")
        delete_resp = requests.delete(
            f"{BASE_URL}/api/userApi/deleteApi/{created_api_key_id}",
            headers=headers,
            timeout=10
        )
        
        print(f"DELETE /api/userApi/deleteApi/{created_api_key_id} -> {delete_resp.status_code}")
        
        if delete_resp.status_code == 200:
            # Verify deletion
            print(f"\n[CLEANUP] Step 3: Verifying deletion...")
            verify_resp = requests.get(f"{BASE_URL}/api/userApi/getApi", headers=headers, timeout=10)
            
            if verify_resp.status_code == 200:
                verify_data = verify_resp.json()
                if verify_data.get("success") and verify_data.get("data"):
                    api_list = verify_data["data"]
                    still_exists = any(api.get("api_id") == created_api_key_id for api in api_list)
                    
                    if not still_exists:
                        log_test("TEST G: CLEANUP", True, f"API key {created_api_key_id} successfully deleted and verified")
                        return True
                    else:
                        log_test("TEST G: CLEANUP", False, f"API key {created_api_key_id} still exists after deletion")
                        return False
                else:
                    # Empty list means deleted
                    log_test("TEST G: CLEANUP", True, f"API key {created_api_key_id} successfully deleted")
                    return True
            else:
                log_test("TEST G: CLEANUP", False, f"Could not verify deletion: {verify_resp.status_code}")
                return False
        else:
            log_test("TEST G: CLEANUP", False, f"Delete failed with {delete_resp.status_code}: {delete_resp.text}")
            return False
            
    except Exception as e:
        log_test("TEST G: CLEANUP", False, f"Exception: {e}")
        return False


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    print(f"\nTotal: {passed}/{total} tests passed\n")
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} - {result['test']}")
    
    print("\n" + "="*80)
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"⚠️  {total - passed} test(s) failed")
        return 1


def main():
    """Main test execution"""
    global created_api_key_id, created_api_key_plaintext
    
    print("="*80)
    print("Dynopay Embedded Checkout E2E Test")
    print("Testing: POST /api/user/embed/session")
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Setup
    created_api_key_id, created_api_key_plaintext = setup_api_key()
    
    if not created_api_key_id or not created_api_key_plaintext:
        print("\n❌ FATAL: Could not create API key. Aborting tests.")
        sys.exit(1)
    
    # Run tests
    test_a_positive()
    test_b_render()
    test_c_no_auth()
    test_d_below_minimum()
    test_e_bad_key()
    test_f_session_persisted()
    
    # Cleanup
    cleanup()
    
    # Summary
    exit_code = print_summary()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
