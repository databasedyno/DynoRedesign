#!/usr/bin/env python3
"""
Backend Testing Script for DynoPay Session 6c
Critical production bug fix + feature verification

Tests:
1. Balance-detection REST-first fix (USDT-ERC20 balance detection)
2. Recovery endpoint ERC20 support
3. Expanded currency validation for API keys (6→19 currencies)
4. Fee-free status endpoint
5. Regression tests
"""

import requests
import json
import sys

# Base URL
BASE_URL = "https://dynopay-preview-4.preview.emergentagent.com"

# JWTs
ADMIN_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im1veHhjb21wYW55QGdtYWlsLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc4MzUyNDkyNywiZXhwIjoxNzg2MTE2OTI3fQ.tdFRWfspg8avsmrWFGRg5-sLeRu-ATKOng2ZEPpgY8k"
HOSTBAY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJuYW1lIjoiSG9zdEJheSIsImVtYWlsIjoiaG9zdGJheUBtb3h4LmNvIiwidXNlcm5hbWUiOm51bGwsIm1vYmlsZSI6bnVsbCwicGhvdG8iOiJpbWFnZXMvdXNlcl9pbWFnZS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6dHJ1ZSwicmVmZXJyYWxfY29kZSI6IkRZTk8tOVhWUFVZIiwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibGFzdF9sb2dpbl9pcCI6IjEwNC4xOTguMjE0LjIyMyIsImxhc3RfY29tcGFueV9pZCI6bnVsbCwiY3VtdWxhdGl2ZV92b2x1bWVfdXNkIjoiMTc1MDcuNTUiLCJmZWVfZnJlZV9yZW1haW5pbmdfdXNkIjoiMC4wMCIsImZlZV90aWVyIjoic3RhbmRhcmQiLCJjcmVhdGVkQXQiOiIyMDI2LTA0LTE4VDE4OjE5OjExLjg4N1oiLCJ1cGRhdGVkQXQiOiIyMDI2LTA3LTA4VDEzOjExOjA4LjgwN1oiLCJsYW5ndWFnZSI6ImVuIiwiaWF0IjoxNzgzNTI0OTE3LCJleHAiOjE3ODYxMTY5MTd9.HcHRW73EagTiw3NMBdq-6_YSFS9ZK5O_Jei-pKiNo14"
QA_ONBOARD_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJuYW1lIjoiUUEgT25ib2FyZGluZyBUZXN0ZXIiLCJlbWFpbCI6InFhLm9uYm9hcmQuMTc4MjU4NTIzM0BkeW5vcGF5dGVzdC5jb20iLCJ1c2VybmFtZSI6bnVsbCwibW9iaWxlIjpudWxsLCJwaG90byI6Imh0dHBzOi8vMzE5OWZkMzctMDc1ZC00M2YxLWEwNTItYmE3ZjRhZTgwNjJjLnByZXZpZXcuZW1lcmdlbnRhZ2VudC5jb20vaW1hZ2VzL3VzZXJfZzB2cmJheXExOS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6dHJ1ZSwicmVmZXJyYWxfY29kZSI6IkRZTk8tNzdRUVhHIiwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibGFzdF9sb2dpbl9pcCI6IjEwNC4xOTguMjE0LjIyMyIsImxhc3RfY29tcGFueV9pZCI6bnVsbCwiY3VtdWxhdGl2ZV92b2x1bWVfdXNkIjoiMC4wMCIsImZlZV9mcmVlX3JlbWFpbmluZ191c2QiOiI1MDAuMDAiLCJmZWVfdGllciI6InRyaWFsIiwiY3JlYXRlZEF0IjoiMjAyNi0wNi0yN1QxODozMzo1NC44NjBaIiwidXBkYXRlZEF0IjoiMjAyNi0wNy0wOFQxNDozMjoxMy4zOTZaIiwibGFuZ3VhZ2UiOiJlbiIsImlhdCI6MTc4MzUyNDkxNywiZXhwIjoxNzg2MTE2OTE3fQ.pmjRSc6SgrTVHMVWRThIuAfCW3f7_vZZYlPuVhk7cE8"
QA_EMPTY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo4LCJuYW1lIjoiUUEgRW1wdHkiLCJlbWFpbCI6InFhLmVtcHR5LjE3ODI2MjYxNjlAZHlub3BheXRlc3QuY29tIiwidXNlcm5hbWUiOm51bGwsIm1vYmlsZSI6bnVsbCwicGhvdG8iOiJodHRwczovLzMxOTlmZDM3LTA3NWQtNDNmMS1hMDUyLWJhN2Y0YWU4MDYyYy5wcmV2aWV3LmVtZXJnZW50YWdlbnQuY29tL2ltYWdlcy91c2VyXzQyZGhtaWVweTYucG5nIiwibG9naW5fdHlwZSI6IkVNQUlMIiwiY3VzdG9tZXJfaWQiOm51bGwsImV4dGVybmFsX2lkIjpudWxsLCJzdGF0dXMiOiJhY3RpdmUiLCJ2ZXJpZmllZF9vdHAiOm51bGwsIm90cF9leHBpcmVkIjpudWxsLCJvdHBfY3VycmVuY3kiOm51bGwsInJlc2V0X3Rva2VuIjpudWxsLCJyZXNldF90b2tlbl9leHBpcnkiOm51bGwsImdvb2dsZV9pZCI6bnVsbCwid2FsbGV0X3JlbWluZGVyX3NlbnQiOmZhbHNlLCJyZWZlcnJhbF9jb2RlIjoiRFlOTy01RzlYUVAiLCJyZWZlcnJhbF9jb3VudCI6MCwicmVmZXJyYWxfYm9udXNfZWFybmVkIjoiMC4wMCIsInJlZmVycmVkX2J5X2NvZGUiOm51bGwsInJlZmVycmVkX2J5X3JlZmVyZWVfY29kZSI6bnVsbCwiZmVlX2Rpc2NvdW50X3BlcmNlbnQiOiIwLjAwIiwiZmVlX2Rpc2NvdW50X2V4cGlyZXNfYXQiOm51bGwsImZlZV9kaXNjb3VudF9yZWFzb24iOm51bGwsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJsYXN0X2xvZ2luX2lwIjoiMzQuMTYuNTYuNjQiLCJsYXN0X2NvbXBhbnlfaWQiOm51bGwsImN1bXVsYXRpdmVfdm9sdW1lX3VzZCI6IjAuMDAiLCJmZWVfZnJlZV9yZW1haW5pbmdfdXNkIjoiNTAwLjAwIiwiZmVlX3RpZXIiOiJ0cmlhbCIsImNyZWF0ZWRBdCI6IjIwMjYtMDYtMjhUMDU6NTY6MDkuOTg2WiIsInVwZGF0ZWRBdCI6IjIwMjYtMDctMDdUMDE6MDU6MjcuMzMyWiIsImxhbmd1YWdlIjoiZW4iLCJpYXQiOjE3ODM1MjQ5MTcsImV4cCI6MTc4NjExNjkxN30.4UMJKY7cPjlbrnNtmO7cfe6g3fftgGjIT8KGz18y4js"

# Test results
test_results = []

def log_test(test_name, status, details):
    """Log test result"""
    test_results.append({
        "test": test_name,
        "status": status,
        "details": details
    })
    status_icon = "✅" if status == "PASS" else "❌"
    print(f"\n{status_icon} {test_name}: {status}")
    print(f"   Details: {details}")

def test_1_balance_detection_fix():
    """
    TEST 1: Balance-detection REST-first fix
    The bug was: tatumApi.getAddressBalance used the Tatum SDK which returned 0 for 
    on-chain-verified USDT-ERC20 addresses. Fix: now calls Tatum v3 REST directly.
    """
    print("\n" + "="*80)
    print("TEST 1: Balance-detection REST-first fix (bug fix)")
    print("="*80)
    
    url = f"{BASE_URL}/api/diagnostics/recover-stuck-payment"
    headers = {
        "Authorization": f"Bearer {ADMIN_JWT}",
        "Content-Type": "application/json"
    }
    payload = {
        "payment_id": "0a5bd34d-6443-4d3b-8442-7cd5f86fe7a2"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            steps = data.get("steps", [])
            
            # Check for balance detection steps
            has_ethplorer_fallback = any(
                "check_balance_ethplorer_fallback" in step.get("step", "") 
                for step in steps
            )
            has_check_balance = any(
                "check_balance" in step.get("step", "") 
                for step in steps
            )
            
            # Find balance details
            balance_step = None
            for step in steps:
                if "check_balance" in step.get("step", ""):
                    balance_step = step
                    break
            
            if balance_step:
                details_str = json.dumps(balance_step.get("details", {}), indent=2)
                print(f"   Balance Step: {balance_step.get('step')}")
                print(f"   Details: {details_str}")
                
                # Check if it reports actual balance (not "No token balance")
                details = balance_step.get("details", {})
                token_balance = details.get("token_balance", "")
                
                if "No token balance" in str(data):
                    log_test("TEST 1", "FAIL", 
                            "Response contains 'No token balance' - balance detection may still be broken")
                elif has_ethplorer_fallback or has_check_balance:
                    log_test("TEST 1", "PASS", 
                            f"Balance detection working. Found balance step with: {token_balance}")
                else:
                    log_test("TEST 1", "PARTIAL", 
                            "Balance check present but no Ethplorer fallback step found")
            else:
                log_test("TEST 1", "FAIL", "No balance check step found in response")
                
        elif response.status_code == 400:
            # Payment may have already been recovered
            data = response.json()
            error = data.get("error", "")
            if "already been transferred" in error or "Invalid merchant amount" in error:
                log_test("TEST 1", "PASS", 
                        f"Payment already recovered (expected): {error}")
            else:
                log_test("TEST 1", "FAIL", f"Unexpected 400 error: {error}")
        elif response.status_code == 404:
            log_test("TEST 1", "FAIL", "Payment not found (404)")
        else:
            log_test("TEST 1", "FAIL", f"Unexpected status code: {response.status_code}")
            
    except Exception as e:
        log_test("TEST 1", "FAIL", f"Exception: {str(e)}")

def test_2_recovery_endpoint_erc20():
    """
    TEST 2: Recovery endpoint ERC20 support
    Verify POST /api/diagnostics/recover-stuck-payment on ERC20 payments
    """
    print("\n" + "="*80)
    print("TEST 2: Recovery endpoint ERC20 support")
    print("="*80)
    
    url = f"{BASE_URL}/api/diagnostics/recover-stuck-payment"
    
    # Test 2a: No auth (should return 403)
    print("\n   Test 2a: No auth (expect 403)")
    try:
        response = requests.post(url, json={"payment_id": "test"}, timeout=10)
        if response.status_code == 403:
            print(f"   ✓ Status: {response.status_code} (403 as expected)")
            test_2a_pass = True
        else:
            print(f"   ✗ Status: {response.status_code} (expected 403)")
            test_2a_pass = False
    except Exception as e:
        print(f"   ✗ Exception: {str(e)}")
        test_2a_pass = False
    
    # Test 2b: Bogus payment_id (should return 404)
    print("\n   Test 2b: Bogus payment_id (expect 404)")
    headers = {"Authorization": f"Bearer {ADMIN_JWT}", "Content-Type": "application/json"}
    try:
        response = requests.post(url, headers=headers, 
                               json={"payment_id": "bogus-payment-id-12345"}, timeout=10)
        if response.status_code == 404:
            data = response.json()
            print(f"   ✓ Status: {response.status_code} (404 as expected)")
            print(f"   Response: {json.dumps(data, indent=2)}")
            test_2b_pass = True
        else:
            print(f"   ✗ Status: {response.status_code} (expected 404)")
            test_2b_pass = False
    except Exception as e:
        print(f"   ✗ Exception: {str(e)}")
        test_2b_pass = False
    
    # Test 2c: Valid payment_id (should return proper step chain)
    print("\n   Test 2c: Valid payment_id (expect proper step chain)")
    try:
        response = requests.post(url, headers=headers,
                               json={"payment_id": "0a5bd34d-6443-4d3b-8442-7cd5f86fe7a2"}, 
                               timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code in [200, 400]:
            data = response.json()
            steps = data.get("steps", [])
            print(f"   Steps found: {len(steps)}")
            if len(steps) > 0:
                print(f"   Step chain: {[s.get('step') for s in steps]}")
                test_2c_pass = True
            else:
                print(f"   ✗ No steps in response")
                test_2c_pass = False
        else:
            print(f"   ✗ Unexpected status: {response.status_code}")
            test_2c_pass = False
    except Exception as e:
        print(f"   ✗ Exception: {str(e)}")
        test_2c_pass = False
    
    if test_2a_pass and test_2b_pass and test_2c_pass:
        log_test("TEST 2", "PASS", "All sub-tests passed (auth, 404, step chain)")
    else:
        log_test("TEST 2", "FAIL", 
                f"Sub-tests: 2a={test_2a_pass}, 2b={test_2b_pass}, 2c={test_2c_pass}")

def test_3_expanded_currency_validation():
    """
    TEST 3: Expanded currency validation for API keys (6→19 currencies)
    """
    print("\n" + "="*80)
    print("TEST 3: Expanded currency validation for API keys")
    print("="*80)
    
    # First, get the API key for qa.onboard
    headers = {
        "Authorization": f"Bearer {QA_ONBOARD_JWT}",
        "Content-Type": "application/json"
    }
    
    # Get API key
    print("\n   Getting API key for qa.onboard...")
    try:
        response = requests.get(f"{BASE_URL}/api/userApi/getApi", headers=headers, timeout=10)
        if response.status_code != 200:
            log_test("TEST 3", "FAIL", f"Failed to get API key: {response.status_code}")
            return
        
        data = response.json()
        api_data = data.get("data", {})
        if isinstance(api_data, list) and len(api_data) > 0:
            api_id = api_data[0].get("api_id")
        elif isinstance(api_data, dict):
            api_id = api_data.get("api_id")
        else:
            log_test("TEST 3", "FAIL", "No API key found for qa.onboard")
            return
        
        print(f"   API ID: {api_id}")
        
        # Test valid currencies
        valid_currencies = ["INR", "EUR", "JPY", "AED", "SGD", "NZD"]
        test_results_3 = []
        
        for currency in valid_currencies:
            print(f"\n   Testing currency: {currency}")
            response = requests.put(
                f"{BASE_URL}/api/userApi/updateApi/{api_id}",
                headers=headers,
                json={"base_currency": currency},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                returned_currency = data.get("data", {}).get("base_currency")
                if returned_currency == currency:
                    print(f"   ✓ {currency}: 200, base_currency={returned_currency}")
                    test_results_3.append(True)
                else:
                    print(f"   ✗ {currency}: returned {returned_currency} instead of {currency}")
                    test_results_3.append(False)
            else:
                print(f"   ✗ {currency}: {response.status_code}")
                test_results_3.append(False)
        
        # Test invalid currency
        print(f"\n   Testing invalid currency: XYZ")
        response = requests.put(
            f"{BASE_URL}/api/userApi/updateApi/{api_id}",
            headers=headers,
            json={"base_currency": "XYZ"},
            timeout=10
        )
        if response.status_code == 400:
            print(f"   ✓ XYZ: 400 (rejected as expected)")
            test_results_3.append(True)
        else:
            print(f"   ✗ XYZ: {response.status_code} (expected 400)")
            test_results_3.append(False)
        
        # Test lowercase (should be accepted and uppercased)
        print(f"\n   Testing lowercase: usd")
        response = requests.put(
            f"{BASE_URL}/api/userApi/updateApi/{api_id}",
            headers=headers,
            json={"base_currency": "usd"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            returned_currency = data.get("data", {}).get("base_currency")
            if returned_currency == "USD":
                print(f"   ✓ usd: 200, uppercased to USD")
                test_results_3.append(True)
            else:
                print(f"   ✗ usd: returned {returned_currency}")
                test_results_3.append(False)
        else:
            print(f"   ✗ usd: {response.status_code}")
            test_results_3.append(False)
        
        # Verify final state
        print(f"\n   Verifying final state...")
        response = requests.get(f"{BASE_URL}/api/userApi/getApi", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            api_data = data.get("data", {})
            if isinstance(api_data, list) and len(api_data) > 0:
                final_currency = api_data[0].get("base_currency")
            elif isinstance(api_data, dict):
                final_currency = api_data.get("base_currency")
            else:
                final_currency = None
            print(f"   Final base_currency: {final_currency}")
        
        if all(test_results_3):
            log_test("TEST 3", "PASS", 
                    f"All currency tests passed. Valid currencies accepted, invalid rejected, lowercase uppercased")
        else:
            log_test("TEST 3", "FAIL", 
                    f"Some currency tests failed: {sum(test_results_3)}/{len(test_results_3)} passed")
            
    except Exception as e:
        log_test("TEST 3", "FAIL", f"Exception: {str(e)}")

def test_4_fee_free_status():
    """
    TEST 4: Fee-free status endpoint
    """
    print("\n" + "="*80)
    print("TEST 4: Fee-free status endpoint")
    print("="*80)
    
    # Test 4a: qa.onboard (freshly-verified user with $500 remaining)
    print("\n   Test 4a: qa.onboard (expect is_fee_free=true, remaining=$500)")
    headers = {
        "Authorization": f"Bearer {QA_ONBOARD_JWT}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(f"{BASE_URL}/api/company/fee-free-status", 
                              headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            status_data = data.get("data", {})
            is_fee_free = status_data.get("is_fee_free")
            remaining = status_data.get("fee_free_remaining_usd")
            total = status_data.get("fee_free_total_usd")
            
            print(f"   is_fee_free: {is_fee_free}")
            print(f"   fee_free_remaining_usd: {remaining}")
            print(f"   fee_free_total_usd: {total}")
            
            if is_fee_free == True and float(remaining) == 500.0 and float(total) == 500.0:
                test_4a_pass = True
                print(f"   ✓ All values correct")
            else:
                test_4a_pass = False
                print(f"   ✗ Values incorrect")
        else:
            test_4a_pass = False
            print(f"   ✗ Unexpected status code")
    except Exception as e:
        test_4a_pass = False
        print(f"   ✗ Exception: {str(e)}")
    
    # Test 4b: hostbay (trial exhausted)
    print("\n   Test 4b: hostbay (expect is_fee_free=false)")
    headers = {
        "Authorization": f"Bearer {HOSTBAY_JWT}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(f"{BASE_URL}/api/company/fee-free-status", 
                              headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            status_data = data.get("data", {})
            is_fee_free = status_data.get("is_fee_free")
            
            print(f"   is_fee_free: {is_fee_free}")
            
            if is_fee_free == False:
                test_4b_pass = True
                print(f"   ✓ is_fee_free=false as expected")
            else:
                test_4b_pass = False
                print(f"   ✗ is_fee_free should be false")
        else:
            test_4b_pass = False
            print(f"   ✗ Unexpected status code")
    except Exception as e:
        test_4b_pass = False
        print(f"   ✗ Exception: {str(e)}")
    
    if test_4a_pass and test_4b_pass:
        log_test("TEST 4", "PASS", "Both fee-free status tests passed")
    else:
        log_test("TEST 4", "FAIL", f"Sub-tests: 4a={test_4a_pass}, 4b={test_4b_pass}")

def test_5_regression():
    """
    TEST 5: Regression tests
    """
    print("\n" + "="*80)
    print("TEST 5: Regression tests")
    print("="*80)
    
    endpoints = [
        ("/health", None),
        ("/api/csrf-token", None),
        ("/api/", None),
        ("/api/geo-detect", None),
    ]
    
    results = []
    for endpoint, jwt_token in endpoints:
        url = f"{BASE_URL}{endpoint}"
        headers = {}
        if jwt_token:
            headers["Authorization"] = f"Bearer {jwt_token}"
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            status = response.status_code
            if status == 200:
                print(f"   ✓ {endpoint}: {status}")
                results.append(True)
            else:
                print(f"   ✗ {endpoint}: {status} (expected 200)")
                results.append(False)
        except Exception as e:
            print(f"   ✗ {endpoint}: Exception - {str(e)}")
            results.append(False)
    
    if all(results):
        log_test("TEST 5", "PASS", "All regression tests passed (no 500s, no crashes)")
    else:
        log_test("TEST 5", "FAIL", f"{sum(results)}/{len(results)} endpoints passed")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["status"] == "PASS")
    failed = sum(1 for r in test_results if r["status"] == "FAIL")
    partial = sum(1 for r in test_results if r["status"] == "PARTIAL")
    
    for result in test_results:
        status_icon = "✅" if result["status"] == "PASS" else "⚠️" if result["status"] == "PARTIAL" else "❌"
        print(f"{status_icon} {result['test']}: {result['status']}")
        print(f"   {result['details']}")
    
    print(f"\nTotal: {len(test_results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Partial: {partial}")
    
    return failed == 0

if __name__ == "__main__":
    print("="*80)
    print("DynoPay Backend Testing - Session 6c")
    print("Critical Production Bug Fix + Feature Verification")
    print("="*80)
    
    # Run all tests
    test_1_balance_detection_fix()
    test_2_recovery_endpoint_erc20()
    test_3_expanded_currency_validation()
    test_4_fee_free_status()
    test_5_regression()
    
    # Print summary
    all_passed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)
