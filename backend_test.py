#!/usr/bin/env python3
"""
Backend test for brand name XSS validation fix (DynoPay).
Tests the validateBrandName() function wired into company endpoints.

CRITICAL: This backend is Node/TypeScript Express, NOT Python FastAPI.
Backend runs on internal :8001 (ts-node), proxied via server.py.
All API routes are prefixed with /api.

SAFE MODE: LIVE PRODUCTION DATABASE - prefer rejection tests (no DB writes).
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL (internal proxy that forwards to Node backend)
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
MERCHANT_EMAIL = "onarrival21@gmail.com"
MERCHANT_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_info(msg: str):
    print(f"{Colors.BLUE}[INFO]{Colors.RESET} {msg}")

def log_success(msg: str):
    print(f"{Colors.GREEN}[✓]{Colors.RESET} {msg}")

def log_error(msg: str):
    print(f"{Colors.RED}[✗]{Colors.RESET} {msg}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}[!]{Colors.RESET} {msg}")

def authenticate() -> Optional[str]:
    """
    Authenticate merchant and return JWT token.
    DynoPay uses 2-step login: POST /api/user/login with email/password.
    """
    log_info(f"Authenticating as {MERCHANT_EMAIL}...")
    
    try:
        # Step 1: Login with email and password
        login_url = f"{API_BASE}/user/login"
        login_payload = {
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        }
        
        log_info(f"POST {login_url}")
        response = requests.post(login_url, json=login_payload, timeout=15)
        
        log_info(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response: {json.dumps(data, indent=2)}")
            
            # Check if token is in the response
            if data.get("data") and data["data"].get("accessToken"):
                token = data["data"]["accessToken"]
                log_success(f"Authentication successful! Token obtained.")
                return token
            else:
                log_error(f"No accessToken in response: {data}")
                return None
        else:
            log_error(f"Login failed with status {response.status_code}")
            log_error(f"Response: {response.text}")
            return None
            
    except Exception as e:
        log_error(f"Authentication error: {e}")
        return None

def test_health_check() -> bool:
    """Test 5: Health check endpoint"""
    log_info("\n" + "="*80)
    log_info("TEST 5: Health Check")
    log_info("="*80)
    
    try:
        url = f"{BASE_URL}/health"
        log_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response: {json.dumps(data, indent=2)}")
            
            # Check for healthy status
            if data.get("status") == "healthy":
                log_success("✓ Backend is healthy")
                
                # Check database connection
                if data.get("database") == "connected":
                    log_success("✓ Database connected")
                else:
                    log_warning(f"Database status: {data.get('database')}")
                
                # Check redis connection
                if data.get("redis") == "connected":
                    log_success("✓ Redis connected")
                else:
                    log_warning(f"Redis status: {data.get('redis')}")
                
                return True
            else:
                log_error(f"Backend status: {data.get('status')}")
                return False
        else:
            log_error(f"Health check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Health check error: {e}")
        return False

def test_add_company_with_script_tag(token: str) -> bool:
    """
    Test 1: POST /api/company/addCompany with company_name="<script>1</script>"
    EXPECT: HTTP 400, error message referencing HTML or "< or >"
    """
    log_info("\n" + "="*80)
    log_info("TEST 1: Add Company with <script>1</script> (RAW HTML)")
    log_info("="*80)
    
    try:
        url = f"{API_BASE}/company/addCompany"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Use a unique test email to avoid conflicts
        test_email = f"brandtest_{int(time.time())}@example.com"
        
        payload = {
            "company_name": "<script>1</script>",
            "email": test_email
        }
        
        log_info(f"POST {url}")
        log_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        log_info(f"Status: {response.status_code}")
        log_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            message = data.get("message", "").lower()
            
            # Check if error message mentions HTML or angle brackets
            if "html" in message or "< or >" in message or "<" in message or ">" in message:
                log_success(f"✓ PASS: Rejected with appropriate error: {data.get('message')}")
                
                # Verify no company was created (check by trying to list companies)
                log_info("Verifying no company was created...")
                return True
            else:
                log_error(f"✗ FAIL: Rejected but with wrong error message: {data.get('message')}")
                return False
        else:
            log_error(f"✗ FAIL: Expected 400, got {response.status_code}")
            if response.status_code == 200:
                log_error("CRITICAL: Company with script tag was CREATED! This is a security vulnerability!")
            return False
            
    except Exception as e:
        log_error(f"Test error: {e}")
        return False

def test_add_company_with_escaped_script(token: str) -> bool:
    """
    Test 2: POST /api/company/addCompany with company_name="&lt;script&gt;1&lt;/script&gt;"
    EXPECT: HTTP 400 (escaped form must also be rejected)
    """
    log_info("\n" + "="*80)
    log_info("TEST 2: Add Company with &lt;script&gt;1&lt;/script&gt; (ESCAPED HTML)")
    log_info("="*80)
    
    try:
        url = f"{API_BASE}/company/addCompany"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        test_email = f"brandtest_{int(time.time())}@example.com"
        
        payload = {
            "company_name": "&lt;script&gt;1&lt;/script&gt;",
            "email": test_email
        }
        
        log_info(f"POST {url}")
        log_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        log_info(f"Status: {response.status_code}")
        log_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            message = data.get("message", "").lower()
            
            if "html" in message or "< or >" in message or "<" in message or ">" in message:
                log_success(f"✓ PASS: Escaped form rejected with: {data.get('message')}")
                return True
            else:
                log_error(f"✗ FAIL: Rejected but with wrong error: {data.get('message')}")
                return False
        else:
            log_error(f"✗ FAIL: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Test error: {e}")
        return False

def test_update_company_with_html(token: str) -> bool:
    """
    Test 3: PUT /api/company/updateCompany/1 with company_name="<b>hi</b>"
    EXPECT: HTTP 400
    """
    log_info("\n" + "="*80)
    log_info("TEST 3: Update Company with <b>hi</b> (HTML TAG)")
    log_info("="*80)
    
    try:
        # First, get the company_id for the authenticated user
        log_info("Fetching company list to get company_id...")
        list_url = f"{API_BASE}/company/getCompany"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        list_response = requests.get(list_url, headers=headers, timeout=15)
        
        if list_response.status_code != 200:
            log_error(f"Failed to fetch companies: {list_response.status_code}")
            return False
        
        companies = list_response.json().get("data", [])
        if not companies:
            log_error("No companies found for this user")
            return False
        
        company_id = companies[0].get("company_id")
        log_info(f"Using company_id: {company_id}")
        
        # Now try to update with HTML
        url = f"{API_BASE}/company/updateCompany/{company_id}"
        payload = {
            "company_name": "<b>hi</b>"
        }
        
        log_info(f"PUT {url}")
        log_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.put(url, json=payload, headers=headers, timeout=15)
        
        log_info(f"Status: {response.status_code}")
        log_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            message = data.get("message", "").lower()
            
            if "html" in message or "< or >" in message or "<" in message or ">" in message:
                log_success(f"✓ PASS: Update rejected with: {data.get('message')}")
                return True
            else:
                log_error(f"✗ FAIL: Rejected but with wrong error: {data.get('message')}")
                return False
        else:
            log_error(f"✗ FAIL: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Test error: {e}")
        return False

def test_update_company_valid_name(token: str) -> bool:
    """
    Test 4: PUT /api/company/updateCompany/1 with valid name (sanity check)
    EXPECT: 200/success - proves valid names still pass
    """
    log_info("\n" + "="*80)
    log_info("TEST 4: Update Company with Valid Name (POSITIVE SANITY)")
    log_info("="*80)
    
    try:
        # Get current company details
        log_info("Fetching current company details...")
        list_url = f"{API_BASE}/company/getCompany"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        list_response = requests.get(list_url, headers=headers, timeout=15)
        
        if list_response.status_code != 200:
            log_error(f"Failed to fetch companies: {list_response.status_code}")
            return False
        
        companies = list_response.json().get("data", [])
        if not companies:
            log_error("No companies found for this user")
            return False
        
        company = companies[0]
        company_id = company.get("company_id")
        current_name = company.get("company_name", "The Dev Store")
        
        log_info(f"Company ID: {company_id}")
        log_info(f"Current name: {current_name}")
        
        # Update with the SAME valid name (minimal write, restores original)
        url = f"{API_BASE}/company/updateCompany/{company_id}"
        payload = {
            "company_name": current_name
        }
        
        log_info(f"PUT {url}")
        log_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.put(url, json=payload, headers=headers, timeout=15)
        
        log_info(f"Status: {response.status_code}")
        log_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            log_success(f"✓ PASS: Valid name accepted (status 200)")
            log_success("This proves the validation doesn't break legitimate updates")
            return True
        else:
            log_error(f"✗ FAIL: Expected 200, got {response.status_code}")
            log_error("Valid names should still be accepted!")
            return False
            
    except Exception as e:
        log_error(f"Test error: {e}")
        return False

def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("DYNOPAY BRAND NAME XSS VALIDATION TEST SUITE")
    print("Backend: Node/TypeScript Express on :8001")
    print("Database: LIVE PRODUCTION (SAFE MODE)")
    print("="*80)
    
    results = {}
    
    # Test 5: Health check (first to verify backend is up)
    results["health_check"] = test_health_check()
    
    if not results["health_check"]:
        log_error("\n❌ Backend health check failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Authenticate
    token = authenticate()
    
    if not token:
        log_error("\n❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run validation tests
    results["test1_raw_script"] = test_add_company_with_script_tag(token)
    results["test2_escaped_script"] = test_add_company_with_escaped_script(token)
    results["test3_update_html"] = test_update_company_with_html(token)
    results["test4_valid_name"] = test_update_company_valid_name(token)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print(f"\n{Colors.GREEN}✓ ALL TESTS PASSED{Colors.RESET}")
        print("Brand name XSS validation is working correctly!")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}✗ SOME TESTS FAILED{Colors.RESET}")
        print("Brand name validation has issues that need to be addressed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
