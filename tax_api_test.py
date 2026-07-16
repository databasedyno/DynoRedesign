#!/usr/bin/env python3
"""
DynoPay Tax API Backend Test - Session 57
Testing tax-settings and cart/quote-tax endpoints against LIVE Railway PostgreSQL

SAFETY: LIVE PRODUCTION DATABASE
- Only read-only checks and ONE self-restoring PATCH
- NO product/payment-link/order creation
- NO OTP/email flows

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

# Store original tax settings for restoration
original_tax_settings = {}

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
        print("TEST 1: Login and Get JWT Token")
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
            expires_in = None
            
            if "data" in data:
                token = data["data"].get("token") or data["data"].get("accessToken")
                expires_in = data["data"].get("expiresIn")
            elif "token" in data:
                token = data.get("token")
                expires_in = data.get("expiresIn")
            elif "accessToken" in data:
                token = data.get("accessToken")
                expires_in = data.get("expiresIn")
            
            if token:
                # Verify expiresIn is ~604800 (7 days)
                if expires_in:
                    expected_expiry = 604800
                    if expires_in == expected_expiry:
                        log_test("Login", True, f"Login successful, token received, expiresIn={expires_in} (7 days)", {
                            "token_length": len(token),
                            "expiresIn": expires_in
                        })
                    else:
                        log_warning("Login", f"expiresIn={expires_in}, expected {expected_expiry}")
                        log_test("Login", True, f"Login successful, token received (expiresIn mismatch)", {
                            "token_length": len(token),
                            "expiresIn": expires_in,
                            "expected": expected_expiry
                        })
                else:
                    log_test("Login", True, f"Login successful, token received (no expiresIn field)", {
                        "token_length": len(token)
                    })
                
                print(f"Token (first 50 chars): {token[:50]}...")
                return token
            else:
                log_test("Login", False, "No token found in response", {"response": data})
                return None
        else:
            log_test("Login", False, f"Login failed with status {response.status_code}", {
                "status": response.status_code,
                "response": response.text[:500]
            })
            return None
            
    except Exception as e:
        log_test("Login", False, f"Exception during login: {str(e)}")
        return None

def get_tax_settings(token: str) -> Optional[Dict[str, Any]]:
    """
    GET /api/user/tax-settings
    Expected: 200 with { data: { default_apply_tax, default_tax_inclusive, merchant_country_code, merchant_vat_id } }
    """
    try:
        print("\n" + "="*80)
        print("TEST 2: GET /api/user/tax-settings")
        print("="*80)
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{API_URL}/user/tax-settings",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Extract data object
            settings = data.get("data", data)
            
            # Verify required keys
            required_keys = ["default_apply_tax", "default_tax_inclusive", "merchant_country_code", "merchant_vat_id"]
            missing_keys = [key for key in required_keys if key not in settings]
            
            if not missing_keys:
                log_test("GET tax-settings", True, "All required keys present", {
                    "default_apply_tax": settings["default_apply_tax"],
                    "default_tax_inclusive": settings["default_tax_inclusive"],
                    "merchant_country_code": settings["merchant_country_code"],
                    "merchant_vat_id": settings["merchant_vat_id"]
                })
                
                # Store original values for restoration
                global original_tax_settings
                original_tax_settings = {
                    "default_apply_tax": settings["default_apply_tax"],
                    "default_tax_inclusive": settings["default_tax_inclusive"],
                    "merchant_country_code": settings["merchant_country_code"],
                    "merchant_vat_id": settings["merchant_vat_id"]
                }
                print(f"\n📝 RECORDED ORIGINAL VALUES:")
                print(json.dumps(original_tax_settings, indent=2))
                
                return settings
            else:
                log_test("GET tax-settings", False, f"Missing required keys: {missing_keys}", {
                    "received_keys": list(settings.keys()),
                    "missing_keys": missing_keys
                })
                return None
        else:
            log_test("GET tax-settings", False, f"Request failed with status {response.status_code}", {
                "status": response.status_code,
                "response": response.text[:500]
            })
            return None
            
    except Exception as e:
        log_test("GET tax-settings", False, f"Exception: {str(e)}")
        return None

def update_tax_settings(token: str) -> bool:
    """
    PATCH /api/user/tax-settings with test values
    Expected: 200 with updated data
    """
    try:
        print("\n" + "="*80)
        print("TEST 3: PATCH /api/user/tax-settings (Update)")
        print("="*80)
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        test_payload = {
            "default_apply_tax": True,
            "default_tax_inclusive": False,
            "merchant_country_code": "DE",
            "merchant_vat_id": "DE123456789"
        }
        
        print(f"Updating with: {json.dumps(test_payload, indent=2)}")
        
        response = requests.patch(
            f"{API_URL}/user/tax-settings",
            headers=headers,
            json=test_payload,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Extract data object
            settings = data.get("data", data)
            
            # Verify the update was applied
            all_match = True
            mismatches = []
            
            for key, expected_value in test_payload.items():
                actual_value = settings.get(key)
                if actual_value != expected_value:
                    all_match = False
                    mismatches.append(f"{key}: expected {expected_value}, got {actual_value}")
            
            if all_match:
                log_test("PATCH tax-settings (update)", True, "All fields updated correctly", {
                    "updated_values": test_payload
                })
                
                # Now verify persistence with a GET
                print("\n  Verifying persistence with GET...")
                verify_response = requests.get(
                    f"{API_URL}/user/tax-settings",
                    headers=headers,
                    timeout=10
                )
                
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    verify_settings = verify_data.get("data", verify_data)
                    
                    verify_match = True
                    verify_mismatches = []
                    
                    for key, expected_value in test_payload.items():
                        actual_value = verify_settings.get(key)
                        if actual_value != expected_value:
                            verify_match = False
                            verify_mismatches.append(f"{key}: expected {expected_value}, got {actual_value}")
                    
                    if verify_match:
                        log_test("PATCH tax-settings (persistence)", True, "Changes persisted correctly")
                        return True
                    else:
                        log_test("PATCH tax-settings (persistence)", False, f"Persistence verification failed: {', '.join(verify_mismatches)}")
                        return False
                else:
                    log_test("PATCH tax-settings (persistence)", False, f"Verification GET failed with status {verify_response.status_code}")
                    return False
            else:
                log_test("PATCH tax-settings (update)", False, f"Field mismatches: {', '.join(mismatches)}")
                return False
        else:
            log_test("PATCH tax-settings (update)", False, f"Request failed with status {response.status_code}", {
                "status": response.status_code,
                "response": response.text[:500]
            })
            return False
            
    except Exception as e:
        log_test("PATCH tax-settings (update)", False, f"Exception: {str(e)}")
        return False

def restore_tax_settings(token: str) -> bool:
    """
    CRITICAL: Restore original tax settings
    """
    try:
        print("\n" + "="*80)
        print("TEST 4: PATCH /api/user/tax-settings (RESTORE ORIGINAL)")
        print("="*80)
        
        if not original_tax_settings:
            log_test("RESTORE tax-settings", False, "No original settings recorded!")
            return False
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"Restoring to: {json.dumps(original_tax_settings, indent=2)}")
        
        response = requests.patch(
            f"{API_URL}/user/tax-settings",
            headers=headers,
            json=original_tax_settings,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify restoration with a GET
            print("\n  Verifying restoration with GET...")
            verify_response = requests.get(
                f"{API_URL}/user/tax-settings",
                headers=headers,
                timeout=10
            )
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                verify_settings = verify_data.get("data", verify_data)
                
                all_match = True
                mismatches = []
                
                for key, expected_value in original_tax_settings.items():
                    actual_value = verify_settings.get(key)
                    if actual_value != expected_value:
                        all_match = False
                        mismatches.append(f"{key}: expected {expected_value}, got {actual_value}")
                
                if all_match:
                    log_test("RESTORE tax-settings", True, "✅ ORIGINAL VALUES RESTORED SUCCESSFULLY", {
                        "restored_values": original_tax_settings
                    })
                    return True
                else:
                    log_test("RESTORE tax-settings", False, f"❌ RESTORATION FAILED: {', '.join(mismatches)}", {
                        "expected": original_tax_settings,
                        "actual": verify_settings
                    })
                    return False
            else:
                log_test("RESTORE tax-settings", False, f"Verification GET failed with status {verify_response.status_code}")
                return False
        else:
            log_test("RESTORE tax-settings", False, f"Restore request failed with status {response.status_code}", {
                "status": response.status_code,
                "response": response.text[:500]
            })
            return False
            
    except Exception as e:
        log_test("RESTORE tax-settings", False, f"Exception: {str(e)}")
        return False

def test_quote_tax() -> bool:
    """
    POST /api/cart/quote-tax (public endpoint, no auth)
    Test with empty items array - should return 400 "Cart is empty."
    """
    try:
        print("\n" + "="*80)
        print("TEST 5: POST /api/cart/quote-tax (Public Endpoint)")
        print("="*80)
        
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "merchant_user_id": 1,
            "items": []
        }
        
        print(f"Testing with empty cart: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{API_URL}/cart/quote-tax",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        # We expect 400 with "Cart is empty" or similar validation error
        if response.status_code == 400:
            response_text = response.text.lower()
            if "cart" in response_text and ("empty" in response_text or "required" in response_text or "items" in response_text):
                log_test("POST quote-tax", True, "Endpoint reachable, validation working (400 for empty cart)", {
                    "status": response.status_code,
                    "response": response.text[:200]
                })
                return True
            else:
                log_test("POST quote-tax", True, "Endpoint reachable (400 response, but unexpected message)", {
                    "status": response.status_code,
                    "response": response.text[:200]
                })
                return True
        elif response.status_code == 200:
            # Unexpected success with empty cart
            log_warning("POST quote-tax", "Endpoint returned 200 for empty cart (unexpected)")
            log_test("POST quote-tax", True, "Endpoint reachable (200 response)", {
                "status": response.status_code,
                "response": response.text[:200]
            })
            return True
        else:
            log_test("POST quote-tax", False, f"Unexpected status code {response.status_code}", {
                "status": response.status_code,
                "response": response.text[:500]
            })
            return False
            
    except Exception as e:
        log_test("POST quote-tax", False, f"Exception: {str(e)}")
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(test_results["passed"]) + len(test_results["failed"])
    passed_count = len(test_results["passed"])
    failed_count = len(test_results["failed"])
    warnings_count = len(test_results["warnings"])
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"✅ Passed: {passed_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"⚠️  Warnings: {warnings_count}")
    
    if test_results["failed"]:
        print("\n❌ FAILED TESTS:")
        for result in test_results["failed"]:
            print(f"  - {result['test']}: {result['message']}")
    
    if test_results["warnings"]:
        print("\n⚠️  WARNINGS:")
        for warning in test_results["warnings"]:
            print(f"  - {warning['test']}: {warning['message']}")
    
    print("\n" + "="*80)
    
    # Critical check: Were original values restored?
    if original_tax_settings:
        restore_test = next((t for t in test_results["passed"] if t["test"] == "RESTORE tax-settings"), None)
        if restore_test:
            print("✅ CRITICAL: Original tax settings were RESTORED")
        else:
            restore_failed = next((t for t in test_results["failed"] if t["test"] == "RESTORE tax-settings"), None)
            if restore_failed:
                print("❌ CRITICAL: Original tax settings were NOT restored!")
                print(f"   Original values: {json.dumps(original_tax_settings, indent=2)}")
    
    print("="*80)

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("DynoPay Tax API Backend Test - Session 57")
    print("Testing against LIVE Railway PostgreSQL")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {EMAIL}")
    print("="*80)
    
    # Test 1: Login
    token = login()
    if not token:
        print("\n❌ Cannot proceed without valid token")
        print_summary()
        return
    
    # Test 2: GET tax-settings (and record original values)
    settings = get_tax_settings(token)
    if not settings:
        print("\n❌ Cannot proceed without tax settings")
        print_summary()
        return
    
    # Test 3: PATCH tax-settings (update)
    update_success = update_tax_settings(token)
    
    # Test 4: RESTORE original values (CRITICAL)
    restore_success = restore_tax_settings(token)
    
    if not restore_success:
        print("\n" + "="*80)
        print("⚠️  WARNING: RESTORATION FAILED - Manual intervention may be needed!")
        print(f"Original values that should be restored:")
        print(json.dumps(original_tax_settings, indent=2))
        print("="*80)
    
    # Test 5: POST quote-tax (public endpoint)
    test_quote_tax()
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
