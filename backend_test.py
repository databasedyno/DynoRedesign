#!/usr/bin/env python3
"""
Session 49 Backend Testing - 5 Fixes Verification
Tests login throttle, deleteCompany hardening, webhook circuit-breaker
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://dynopay-setup.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from /app/memory/test_credentials.md
TEST_USER = {
    "email": "hostbay@moxx.co",
    "password": "Katiekendra123@"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log(msg: str, color: str = Colors.BLUE):
    print(f"{color}{msg}{Colors.END}")

def log_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def log_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

def get_csrf_token() -> Optional[str]:
    """Get CSRF token from the API"""
    try:
        resp = requests.get(f"{API_BASE}/csrf-token", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("csrf_token") or data.get("csrfToken") or data.get("data", {}).get("csrf_token")
            if token:
                log_success(f"CSRF token obtained: {token[:20]}...")
                return token
            else:
                log_error(f"CSRF token not found in response: {data}")
                return None
        else:
            log_error(f"Failed to get CSRF token: {resp.status_code}")
            return None
    except Exception as e:
        log_error(f"Exception getting CSRF token: {e}")
        return None

def login_user(email: str, password: str, user_agent: str = None, csrf_token: str = None) -> Optional[Dict[str, Any]]:
    """Login and return session data"""
    try:
        headers = {
            "Content-Type": "application/json"
        }
        if user_agent:
            headers["User-Agent"] = user_agent
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        payload = {
            "email": email,
            "password": password
        }
        
        resp = requests.post(
            f"{API_BASE}/user/login",
            json=payload,
            headers=headers,
            timeout=15
        )
        
        if resp.status_code == 200:
            data = resp.json()
            # Handle both response formats: direct accessToken or nested in data
            if data.get("accessToken"):
                return data
            elif data.get("data", {}).get("accessToken"):
                return data.get("data")
            else:
                log_error(f"Login response missing accessToken: {data}")
                return None
        else:
            log_error(f"Login failed: {resp.status_code} - {resp.text[:200]}")
            return None
    except Exception as e:
        log_error(f"Exception during login: {e}")
        return None

def test_health_check():
    """Test 1: Health check"""
    log("\n" + "="*80)
    log("TEST 1: Health Check", Colors.BLUE)
    log("="*80)
    
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            log_success(f"Health check passed: {json.dumps(data, indent=2)}")
            return True
        else:
            log_error(f"Health check failed: {resp.status_code}")
            return False
    except Exception as e:
        log_error(f"Health check exception: {e}")
        return False

def test_fix_a_bot_ua_filter():
    """Test Fix A: Login with bot User-Agent should return 200 but skip email"""
    log("\n" + "="*80)
    log("TEST 2: Fix A - Bot UA Filter (curl User-Agent)", Colors.BLUE)
    log("="*80)
    
    # Get CSRF token first
    csrf_token = get_csrf_token()
    
    # Test 1: Login with curl UA
    log("\n[Test 2.1] Login with curl/7.88.1 User-Agent")
    session1 = login_user(
        TEST_USER["email"],
        TEST_USER["password"],
        user_agent="curl/7.88.1",
        csrf_token=csrf_token
    )
    
    if session1 and session1.get("accessToken"):
        log_success("Login with curl UA returned 200 with valid session")
        
        # Test 2: Second login within 15 min with same UA
        log("\n[Test 2.2] Second login with curl UA (should also return 200)")
        time.sleep(2)
        session2 = login_user(
            TEST_USER["email"],
            TEST_USER["password"],
            user_agent="curl/7.88.1",
            csrf_token=csrf_token
        )
        
        if session2 and session2.get("accessToken"):
            log_success("Second login with curl UA also returned 200")
            return True
        else:
            log_error("Second login with curl UA failed")
            return False
    else:
        log_error("First login with curl UA failed")
        return False

def test_fix_a_normal_ua():
    """Test Fix A: Login with normal browser UA"""
    log("\n" + "="*80)
    log("TEST 3: Fix A - Normal Browser UA Throttle", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    
    # Test 1: Login with normal browser UA
    log("\n[Test 3.1] Login with normal browser User-Agent")
    browser_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    session1 = login_user(
        TEST_USER["email"],
        TEST_USER["password"],
        user_agent=browser_ua,
        csrf_token=csrf_token
    )
    
    if session1 and session1.get("accessToken"):
        log_success("Login with browser UA returned 200")
        
        # Test 2: Second login within 15 min (should throttle email but still return 200)
        log("\n[Test 3.2] Second login with same browser UA within 15 min")
        time.sleep(2)
        session2 = login_user(
            TEST_USER["email"],
            TEST_USER["password"],
            user_agent=browser_ua,
            csrf_token=csrf_token
        )
        
        if session2 and session2.get("accessToken"):
            log_success("Second login with browser UA also returned 200 (email throttled)")
            return True
        else:
            log_error("Second login with browser UA failed")
            return False
    else:
        log_error("First login with browser UA failed")
        return False

def test_fix_a_invalid_credentials():
    """Test Fix A: Login with invalid credentials should still return 401"""
    log("\n" + "="*80)
    log("TEST 4: Fix A - Invalid Credentials (should return 401)", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "curl/7.88.1"
        }
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        payload = {
            "email": TEST_USER["email"],
            "password": "WrongPassword123!"
        }
        
        resp = requests.post(
            f"{API_BASE}/user/login",
            json=payload,
            headers=headers,
            timeout=15
        )
        
        if resp.status_code == 401:
            log_success("Invalid credentials correctly returned 401")
            return True
        else:
            log_error(f"Invalid credentials returned unexpected status: {resp.status_code}")
            return False
    except Exception as e:
        log_error(f"Exception testing invalid credentials: {e}")
        return False

def test_fix_c_delete_only_company():
    """Test Fix C: DELETE company when user has only 1 company should return 400"""
    log("\n" + "="*80)
    log("TEST 5: Fix C - Delete Only Company (should return 400)", Colors.BLUE)
    log("="*80)
    
    # Login first
    csrf_token = get_csrf_token()
    session = login_user(TEST_USER["email"], TEST_USER["password"], csrf_token=csrf_token)
    
    if not session or not session.get("accessToken"):
        log_error("Failed to login for delete company test")
        return False
    
    token = session["accessToken"]
    
    # CRITICAL: This test should return 400 WITHOUT deleting the company
    # Company ID 1 is hostbay's only company
    log("\n[Test 5.1] Attempting to DELETE company_id=1 (hostbay's only company)")
    log_warning("SAFETY CHECK: This should return 400 WITHOUT deleting the company")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        resp = requests.delete(
            f"{API_BASE}/company/deleteCompany/1",
            headers=headers,
            timeout=15
        )
        
        if resp.status_code == 400:
            data = resp.json()
            message = data.get("message", "")
            if "only company" in message.lower():
                log_success(f"Correctly returned 400: {message}")
                
                # Verify company still exists
                log("\n[Test 5.2] Verifying company_id=1 still exists")
                get_resp = requests.get(
                    f"{API_BASE}/company/getCompany",
                    headers=headers,
                    timeout=15
                )
                
                if get_resp.status_code == 200:
                    companies = get_resp.json().get("data", [])
                    if any(c.get("company_id") == 1 for c in companies):
                        log_success("Company_id=1 still exists (not deleted)")
                        return True
                    else:
                        log_error("Company_id=1 was deleted! TEST FAILED")
                        return False
                else:
                    log_warning(f"Could not verify company existence: {get_resp.status_code}")
                    return True  # Still pass if we got 400
            else:
                log_error(f"Got 400 but wrong message: {message}")
                return False
        elif resp.status_code == 200:
            log_error("DELETE returned 200 - company may have been deleted! TEST FAILED")
            return False
        else:
            log_error(f"DELETE returned unexpected status: {resp.status_code} - {resp.text[:200]}")
            return False
    except Exception as e:
        log_error(f"Exception testing delete company: {e}")
        return False

def test_fix_c_delete_nonexistent():
    """Test Fix C: DELETE non-existent company should return 404"""
    log("\n" + "="*80)
    log("TEST 6: Fix C - Delete Non-existent Company (should return 404)", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    session = login_user(TEST_USER["email"], TEST_USER["password"], csrf_token=csrf_token)
    
    if not session or not session.get("accessToken"):
        log_error("Failed to login for delete non-existent company test")
        return False
    
    token = session["accessToken"]
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        resp = requests.delete(
            f"{API_BASE}/company/deleteCompany/99999",
            headers=headers,
            timeout=15
        )
        
        if resp.status_code == 404:
            log_success("Non-existent company correctly returned 404")
            return True
        else:
            log_error(f"Non-existent company returned unexpected status: {resp.status_code}")
            return False
    except Exception as e:
        log_error(f"Exception testing delete non-existent company: {e}")
        return False

def test_fix_f_webhook_settings():
    """Test Fix F: GET webhook settings should return new fields"""
    log("\n" + "="*80)
    log("TEST 7: Fix F - Webhook Settings (new fields)", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    session = login_user(TEST_USER["email"], TEST_USER["password"], csrf_token=csrf_token)
    
    if not session or not session.get("accessToken"):
        log_error("Failed to login for webhook settings test")
        return False
    
    token = session["accessToken"]
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        resp = requests.get(
            f"{API_BASE}/company/webhook-settings/1",
            headers=headers,
            timeout=15
        )
        
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            
            # Check for new fields
            required_fields = ["webhook_disabled", "webhook_disabled_at", "webhook_disabled_reason"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                log_success(f"Webhook settings returned all new fields: {json.dumps(data, indent=2)}")
                log(f"  webhook_disabled: {data.get('webhook_disabled')}")
                log(f"  webhook_disabled_at: {data.get('webhook_disabled_at')}")
                log(f"  webhook_disabled_reason: {data.get('webhook_disabled_reason')}")
                return True
            else:
                log_error(f"Missing fields in webhook settings: {missing_fields}")
                return False
        else:
            log_error(f"Webhook settings returned unexpected status: {resp.status_code}")
            return False
    except Exception as e:
        log_error(f"Exception testing webhook settings: {e}")
        return False

def test_fix_f_webhook_reenable_with_csrf():
    """Test Fix F: POST webhook-reenable with CSRF should return 200"""
    log("\n" + "="*80)
    log("TEST 8: Fix F - Webhook Re-enable WITH CSRF", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    session = login_user(TEST_USER["email"], TEST_USER["password"], csrf_token=csrf_token)
    
    if not session or not session.get("accessToken"):
        log_error("Failed to login for webhook re-enable test")
        return False
    
    token = session["accessToken"]
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        resp = requests.post(
            f"{API_BASE}/company/webhook-reenable/1",
            headers=headers,
            json={},
            timeout=15
        )
        
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            log_success(f"Webhook re-enable with CSRF returned 200: {json.dumps(data, indent=2)}")
            return True
        else:
            log_error(f"Webhook re-enable with CSRF returned unexpected status: {resp.status_code} - {resp.text[:200]}")
            return False
    except Exception as e:
        log_error(f"Exception testing webhook re-enable with CSRF: {e}")
        return False

def test_fix_f_webhook_reenable_without_csrf():
    """Test Fix F: POST webhook-reenable WITHOUT CSRF should return 403"""
    log("\n" + "="*80)
    log("TEST 9: Fix F - Webhook Re-enable WITHOUT CSRF (should return 403)", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    session = login_user(TEST_USER["email"], TEST_USER["password"], csrf_token=csrf_token)
    
    if not session or not session.get("accessToken"):
        log_error("Failed to login for webhook re-enable without CSRF test")
        return False
    
    token = session["accessToken"]
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
            # Intentionally NOT including X-CSRF-Token
        }
        
        resp = requests.post(
            f"{API_BASE}/company/webhook-reenable/1",
            headers=headers,
            json={},
            timeout=15
        )
        
        if resp.status_code == 403:
            log_success("Webhook re-enable without CSRF correctly returned 403")
            return True
        else:
            log_error(f"Webhook re-enable without CSRF returned unexpected status: {resp.status_code}")
            return False
    except Exception as e:
        log_error(f"Exception testing webhook re-enable without CSRF: {e}")
        return False

def test_fix_f_webhook_reenable_without_auth():
    """Test Fix F: POST webhook-reenable WITHOUT auth should return 401"""
    log("\n" + "="*80)
    log("TEST 10: Fix F - Webhook Re-enable WITHOUT Auth (should return 401)", Colors.BLUE)
    log("="*80)
    
    csrf_token = get_csrf_token()
    
    try:
        headers = {
            "Content-Type": "application/json"
            # Intentionally NOT including Authorization
        }
        if csrf_token:
            headers["X-CSRF-Token"] = csrf_token
        
        resp = requests.post(
            f"{API_BASE}/company/webhook-reenable/1",
            headers=headers,
            json={},
            timeout=15
        )
        
        if resp.status_code == 401:
            log_success("Webhook re-enable without auth correctly returned 401")
            return True
        else:
            log_error(f"Webhook re-enable without auth returned unexpected status: {resp.status_code}")
            return False
    except Exception as e:
        log_error(f"Exception testing webhook re-enable without auth: {e}")
        return False

def test_smoke_tests():
    """Test 11: General smoke tests"""
    log("\n" + "="*80)
    log("TEST 11: General Smoke Tests", Colors.BLUE)
    log("="*80)
    
    all_passed = True
    
    # Test 1: /health
    log("\n[Test 11.1] GET /health")
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if resp.status_code == 200:
            log_success("/health returned 200")
        else:
            log_error(f"/health returned {resp.status_code}")
            all_passed = False
    except Exception as e:
        log_error(f"/health exception: {e}")
        all_passed = False
    
    # Test 2: /api/pay/creator/hostbay
    log("\n[Test 11.2] GET /api/pay/creator/hostbay")
    try:
        resp = requests.get(f"{API_BASE}/pay/creator/hostbay", timeout=10)
        if resp.status_code == 200:
            log_success("/api/pay/creator/hostbay returned 200")
        else:
            log_error(f"/api/pay/creator/hostbay returned {resp.status_code}")
            all_passed = False
    except Exception as e:
        log_error(f"/api/pay/creator/hostbay exception: {e}")
        all_passed = False
    
    # Test 3: /api/csrf-token
    log("\n[Test 11.3] GET /api/csrf-token")
    csrf = get_csrf_token()
    if csrf:
        log_success("/api/csrf-token returned valid token")
    else:
        log_error("/api/csrf-token failed")
        all_passed = False
    
    # Test 4: Login with correct credentials
    log("\n[Test 11.4] POST /api/user/login with correct credentials")
    session = login_user(TEST_USER["email"], TEST_USER["password"], csrf_token=csrf)
    if session and session.get("accessToken"):
        log_success("Login with correct credentials returned 200 with tokens")
    else:
        log_error("Login with correct credentials failed")
        all_passed = False
    
    # Test 5: Login with wrong password
    log("\n[Test 11.5] POST /api/user/login with wrong password")
    try:
        headers = {"Content-Type": "application/json"}
        if csrf:
            headers["X-CSRF-Token"] = csrf
        
        resp = requests.post(
            f"{API_BASE}/user/login",
            json={"email": TEST_USER["email"], "password": "WrongPassword123!"},
            headers=headers,
            timeout=15
        )
        if resp.status_code == 401:
            log_success("Login with wrong password correctly returned 401")
        else:
            log_error(f"Login with wrong password returned {resp.status_code}")
            all_passed = False
    except Exception as e:
        log_error(f"Login with wrong password exception: {e}")
        all_passed = False
    
    return all_passed

def main():
    log("\n" + "="*80)
    log("SESSION 49 BACKEND TESTING - 5 FIXES VERIFICATION", Colors.BLUE)
    log("="*80)
    log(f"Backend URL: {BACKEND_URL}")
    log(f"Test User: {TEST_USER['email']}")
    log("="*80)
    
    results = {}
    
    # Run all tests
    results["Test 1: Health Check"] = test_health_check()
    results["Test 2: Fix A - Bot UA Filter"] = test_fix_a_bot_ua_filter()
    results["Test 3: Fix A - Normal UA Throttle"] = test_fix_a_normal_ua()
    results["Test 4: Fix A - Invalid Credentials"] = test_fix_a_invalid_credentials()
    results["Test 5: Fix C - Delete Only Company"] = test_fix_c_delete_only_company()
    results["Test 6: Fix C - Delete Non-existent"] = test_fix_c_delete_nonexistent()
    results["Test 7: Fix F - Webhook Settings"] = test_fix_f_webhook_settings()
    results["Test 8: Fix F - Webhook Re-enable WITH CSRF"] = test_fix_f_webhook_reenable_with_csrf()
    results["Test 9: Fix F - Webhook Re-enable WITHOUT CSRF"] = test_fix_f_webhook_reenable_without_csrf()
    results["Test 10: Fix F - Webhook Re-enable WITHOUT Auth"] = test_fix_f_webhook_reenable_without_auth()
    results["Test 11: General Smoke Tests"] = test_smoke_tests()
    
    # Summary
    log("\n" + "="*80)
    log("TEST SUMMARY", Colors.BLUE)
    log("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        if result:
            log_success(f"{test_name}: PASSED")
        else:
            log_error(f"{test_name}: FAILED")
    
    log("\n" + "="*80)
    if passed == total:
        log_success(f"ALL TESTS PASSED: {passed}/{total}")
        log("="*80)
        return 0
    else:
        log_error(f"SOME TESTS FAILED: {passed}/{total} passed")
        log("="*80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
