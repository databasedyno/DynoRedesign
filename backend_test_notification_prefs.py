#!/usr/bin/env python3
"""
Backend test for notification preferences API - marketing_emails feature.
SAFE MODE: Only writes to owner test account (user 1) notification preferences.
MUST leave marketing_emails === true at the end.
"""

import subprocess
import json
import sys
import requests
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8001"
COMPANY_ID = 1  # The Dev Store (owner test account)

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(msg: str):
    print(f"{Colors.BLUE}[TEST]{Colors.RESET} {msg}")

def log_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS:{Colors.RESET} {msg}")

def log_fail(msg: str):
    print(f"{Colors.RED}✗ FAIL:{Colors.RESET} {msg}")

def log_info(msg: str):
    print(f"{Colors.YELLOW}[INFO]{Colors.RESET} {msg}")

def get_owner_token() -> str:
    """Mint access token for owner account using the helper script."""
    log_info("Minting access token for owner account (user 1)...")
    try:
        result = subprocess.run(
            ["node", "/app/scripts/qa/owner_login.cjs", BASE_URL],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            log_fail(f"owner_login.cjs failed: {result.stderr}")
            sys.exit(1)
        
        token = result.stdout.strip()
        if len(token) < 100:
            log_fail(f"Token too short (len={len(token)}), expected ~3151 chars")
            sys.exit(1)
        
        log_pass(f"Token acquired (length: {len(token)} chars)")
        return token
    except subprocess.TimeoutExpired:
        log_fail("Token acquisition timed out")
        sys.exit(1)
    except Exception as e:
        log_fail(f"Token acquisition error: {e}")
        sys.exit(1)

def make_request(
    method: str,
    endpoint: str,
    token: str,
    json_data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> tuple[int, Dict[str, Any]]:
    """Make HTTP request to the API."""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=json_data, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        try:
            data = response.json()
        except:
            data = {"error": "Non-JSON response", "text": response.text[:200]}
        
        return response.status_code, data
    except requests.exceptions.Timeout:
        log_fail(f"Request timeout: {method} {endpoint}")
        return 0, {"error": "timeout"}
    except Exception as e:
        log_fail(f"Request error: {e}")
        return 0, {"error": str(e)}

def test_1_initial_get(token: str) -> Dict[str, Any]:
    """
    TEST 1: GET /api/notifications/preferences?company_id=1
    Expected: data.marketing_emails === true (initial state)
    """
    log_test("TEST 1: GET initial preferences (marketing_emails should be true)")
    
    status, response = make_request(
        "GET",
        "/api/notifications/preferences",
        token,
        params={"company_id": COMPANY_ID}
    )
    
    if status != 200:
        log_fail(f"Expected HTTP 200, got {status}")
        log_fail(f"Response: {json.dumps(response, indent=2)}")
        return {}
    
    log_pass(f"HTTP 200 received")
    
    data = response.get("data", {})
    if not data:
        log_fail("Response missing 'data' field")
        log_fail(f"Response: {json.dumps(response, indent=2)}")
        return {}
    
    # Check for required fields
    required_fields = ["email_notifications", "transaction_updates", "marketing_emails"]
    missing = [f for f in required_fields if f not in data]
    if missing:
        log_fail(f"Missing required fields: {missing}")
        log_fail(f"Data: {json.dumps(data, indent=2)}")
        return {}
    
    log_pass(f"All required fields present: {required_fields}")
    
    # Check marketing_emails value
    marketing_emails = data.get("marketing_emails")
    if marketing_emails is True:
        log_pass(f"data.marketing_emails === true ✓")
    else:
        log_fail(f"data.marketing_emails === {marketing_emails}, expected true")
        log_fail(f"Data: {json.dumps(data, indent=2)}")
        return {}
    
    # Log other preference fields for context
    log_info(f"Other preferences:")
    log_info(f"  - email_notifications: {data.get('email_notifications')}")
    log_info(f"  - transaction_updates: {data.get('transaction_updates')}")
    log_info(f"  - weekly_summary: {data.get('weekly_summary')}")
    log_info(f"  - security_alerts: {data.get('security_alerts')}")
    log_info(f"  - sms_notifications: {data.get('sms_notifications')}")
    
    return data

def test_2_set_false(token: str) -> bool:
    """
    TEST 2: PUT /api/notifications/preferences with marketing_emails=false
    Then GET to verify it changed to false
    """
    log_test("TEST 2: PUT marketing_emails=false, then verify")
    
    # PUT request
    status, response = make_request(
        "PUT",
        "/api/notifications/preferences",
        token,
        json_data={"company_id": COMPANY_ID, "marketing_emails": False}
    )
    
    if status != 200:
        log_fail(f"PUT request failed: HTTP {status}")
        log_fail(f"Response: {json.dumps(response, indent=2)}")
        return False
    
    log_pass(f"PUT request successful (HTTP 200)")
    
    # GET to verify
    status, response = make_request(
        "GET",
        "/api/notifications/preferences",
        token,
        params={"company_id": COMPANY_ID}
    )
    
    if status != 200:
        log_fail(f"GET verification failed: HTTP {status}")
        return False
    
    data = response.get("data", {})
    marketing_emails = data.get("marketing_emails")
    
    if marketing_emails is False:
        log_pass(f"data.marketing_emails === false ✓ (successfully changed)")
    else:
        log_fail(f"data.marketing_emails === {marketing_emails}, expected false")
        log_fail(f"Data: {json.dumps(data, indent=2)}")
        return False
    
    return True

def test_3_reset_true(token: str) -> bool:
    """
    TEST 3: PUT /api/notifications/preferences with marketing_emails=true
    Then GET to verify it's back to true (RESET - MUST end true)
    """
    log_test("TEST 3: PUT marketing_emails=true (RESET), then verify")
    
    # PUT request
    status, response = make_request(
        "PUT",
        "/api/notifications/preferences",
        token,
        json_data={"company_id": COMPANY_ID, "marketing_emails": True}
    )
    
    if status != 200:
        log_fail(f"PUT request failed: HTTP {status}")
        log_fail(f"Response: {json.dumps(response, indent=2)}")
        return False
    
    log_pass(f"PUT request successful (HTTP 200)")
    
    # GET to verify
    status, response = make_request(
        "GET",
        "/api/notifications/preferences",
        token,
        params={"company_id": COMPANY_ID}
    )
    
    if status != 200:
        log_fail(f"GET verification failed: HTTP {status}")
        return False
    
    data = response.get("data", {})
    marketing_emails = data.get("marketing_emails")
    
    if marketing_emails is True:
        log_pass(f"data.marketing_emails === true ✓ (RESET SUCCESSFUL)")
    else:
        log_fail(f"data.marketing_emails === {marketing_emails}, expected true")
        log_fail(f"Data: {json.dumps(data, indent=2)}")
        return False
    
    return True

def test_4_regression(token: str, initial_prefs: Dict[str, Any]) -> bool:
    """
    TEST 4: Regression - verify other preference fields are intact
    After the marketing_emails updates, other fields should be unchanged
    """
    log_test("TEST 4: Regression - verify other fields intact after marketing_emails updates")
    
    status, response = make_request(
        "GET",
        "/api/notifications/preferences",
        token,
        params={"company_id": COMPANY_ID}
    )
    
    if status != 200:
        log_fail(f"GET request failed: HTTP {status}")
        return False
    
    data = response.get("data", {})
    
    # Check that other preference fields still exist
    expected_fields = [
        "email_notifications",
        "transaction_updates",
        "weekly_summary",
        "security_alerts",
        "sms_notifications"
    ]
    
    missing = [f for f in expected_fields if f not in data]
    if missing:
        log_fail(f"Missing preference fields after updates: {missing}")
        log_fail(f"Data: {json.dumps(data, indent=2)}")
        return False
    
    log_pass(f"All preference fields present: {expected_fields}")
    
    # Check for company routing fields (if they exist)
    if "company_notification_prefs" in data:
        log_pass(f"company_notification_prefs field present")
    
    # Verify values haven't been wiped (compare to initial if available)
    if initial_prefs:
        for field in expected_fields:
            initial_val = initial_prefs.get(field)
            current_val = data.get(field)
            if initial_val is not None and current_val != initial_val:
                log_fail(f"Field '{field}' changed: {initial_val} -> {current_val}")
                return False
        log_pass(f"All other preference fields unchanged from initial state")
    
    log_info(f"Final state:")
    log_info(f"  - marketing_emails: {data.get('marketing_emails')}")
    log_info(f"  - email_notifications: {data.get('email_notifications')}")
    log_info(f"  - transaction_updates: {data.get('transaction_updates')}")
    log_info(f"  - weekly_summary: {data.get('weekly_summary')}")
    log_info(f"  - security_alerts: {data.get('security_alerts')}")
    log_info(f"  - sms_notifications: {data.get('sms_notifications')}")
    
    return True

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: Notification Preferences - marketing_emails Feature")
    print("SAFE MODE: Only writes to owner test account (user 1)")
    print("MUST leave marketing_emails === true at the end")
    print("="*80 + "\n")
    
    # Get auth token
    token = get_owner_token()
    
    # Run tests
    results = {
        "test_1_initial_get": False,
        "test_2_set_false": False,
        "test_3_reset_true": False,
        "test_4_regression": False
    }
    
    initial_prefs = {}
    
    try:
        # TEST 1: Initial GET (should be true)
        initial_prefs = test_1_initial_get(token)
        results["test_1_initial_get"] = bool(initial_prefs and initial_prefs.get("marketing_emails") is True)
        
        if not results["test_1_initial_get"]:
            log_fail("TEST 1 failed, aborting remaining tests")
            sys.exit(1)
        
        print()
        
        # TEST 2: Set to false
        results["test_2_set_false"] = test_2_set_false(token)
        
        if not results["test_2_set_false"]:
            log_fail("TEST 2 failed, attempting to reset to true before exit...")
            test_3_reset_true(token)  # Try to reset anyway
            sys.exit(1)
        
        print()
        
        # TEST 3: Reset to true (CRITICAL - must succeed)
        results["test_3_reset_true"] = test_3_reset_true(token)
        
        if not results["test_3_reset_true"]:
            log_fail("TEST 3 CRITICAL FAILURE: Could not reset marketing_emails to true!")
            log_fail("MANUAL INTERVENTION REQUIRED: marketing_emails may be left as false")
            sys.exit(1)
        
        print()
        
        # TEST 4: Regression check
        results["test_4_regression"] = test_4_regression(token, initial_prefs)
        
        print()
        
    except KeyboardInterrupt:
        log_fail("\nTest interrupted by user")
        log_info("Attempting to reset marketing_emails to true...")
        test_3_reset_true(token)
        sys.exit(1)
    except Exception as e:
        log_fail(f"Unexpected error: {e}")
        log_info("Attempting to reset marketing_emails to true...")
        test_3_reset_true(token)
        sys.exit(1)
    
    # Summary
    print("="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed_flag else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        print(f"{status} - {test_name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print(f"{Colors.GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓{Colors.RESET}")
        print(f"{Colors.GREEN}marketing_emails successfully reset to true{Colors.RESET}")
        sys.exit(0)
    else:
        print(f"{Colors.RED}✗✗✗ SOME TESTS FAILED ✗✗✗{Colors.RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()
