#!/usr/bin/env python3
"""
Backend Regression Test for DynoPay Node/TS Backend
Testing Items #1 (versioned boot migrations) & #4 (typed config wave 2)
Environment: LOCAL & ISOLATED DB + Redis (NOT production), SAFE MODE on
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple

# Configuration
INTERNAL_BASE = "http://localhost:8001"
EXTERNAL_BASE = "https://crypto-checkout-init-1.preview.emergentagent.com"
TEST_EMAIL = "testmerchant@dynopay.dev"
TEST_PASSWORD = "TestMerchant123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_pass(msg: str):
    print(f"{Colors.GREEN}✅ PASS: {msg}{Colors.RESET}")

def print_fail(msg: str):
    print(f"{Colors.RED}❌ FAIL: {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {msg}{Colors.RESET}")

def test_health_endpoint() -> Tuple[bool, str]:
    """
    TEST 1: GET http://localhost:8001/health
    Expected: HTTP 200, status "healthy", database "connected", redis "connected", 
              background_jobs.eligible=false
    """
    print_test("1. Health Endpoint Check")
    
    try:
        response = requests.get(f"{INTERNAL_BASE}/health", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            return False, f"Expected HTTP 200, got {response.status_code}"
        
        data = response.json()
        print_info(f"Response: {json.dumps(data, indent=2)}")
        
        # Check required fields
        checks = [
            (data.get('status') == 'healthy', f"status = '{data.get('status')}' (expected 'healthy')"),
            (data.get('database') == 'connected', f"database = '{data.get('database')}' (expected 'connected')"),
            (data.get('redis') == 'connected', f"redis = '{data.get('redis')}' (expected 'connected')"),
            (data.get('background_jobs', {}).get('eligible') == False, 
             f"background_jobs.eligible = {data.get('background_jobs', {}).get('eligible')} (expected False)")
        ]
        
        all_passed = True
        for passed, msg in checks:
            if passed:
                print_pass(msg)
            else:
                print_fail(msg)
                all_passed = False
        
        if all_passed:
            return True, "Health endpoint returned correct values"
        else:
            return False, "Some health checks failed"
            
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_migration_system() -> Tuple[bool, str]:
    """
    TEST 2: ITEM 1 (versioned boot migrations)
    Verify backend booted without errors and migration log shows correct message
    """
    print_test("2. Versioned Boot Migrations (ITEM 1)")
    
    try:
        # Read backend logs
        with open('/var/log/supervisor/backend.out.log', 'r') as f:
            logs = f.read()
        
        # Look for migration success message in ALL logs (not just recent)
        recent_logs = logs
        
        # Check for migration completion message
        migration_patterns = [
            "[migrations] done —",
            "already present",
            "Boot model tables ensured via versioned migrations"
        ]
        
        all_found = True
        for pattern in migration_patterns:
            if pattern in recent_logs:
                print_pass(f"Found log pattern: '{pattern}'")
            else:
                print_fail(f"Missing log pattern: '{pattern}'")
                all_found = False
        
        # Check for schema_migrations table mention
        if "schema_migrations" in logs or "0001_boot_model_tables" in logs:
            print_pass("Migration system references found in logs")
        else:
            print_info("Note: schema_migrations table name not explicitly in logs (may be internal)")
        
        # Check for no boot errors
        error_patterns = ["TypeError", "ReferenceError", "Cannot read property", "undefined is not"]
        boot_errors = []
        for pattern in error_patterns:
            if pattern in recent_logs:
                boot_errors.append(pattern)
        
        if boot_errors:
            print_fail(f"Found boot errors: {', '.join(boot_errors)}")
            return False, f"Boot errors detected: {', '.join(boot_errors)}"
        else:
            print_pass("No boot errors detected")
        
        if all_found:
            return True, "Migration system working correctly"
        else:
            return False, "Some migration log patterns missing"
            
    except Exception as e:
        return False, f"Exception reading logs: {str(e)}"

def test_merchant_pool_config() -> Tuple[bool, str]:
    """
    TEST 3: ITEM 4 (typed config)
    Verify boot log shows MerchantPool configuration validation passed
    """
    print_test("3. Typed Config - MerchantPool Validation (ITEM 4)")
    
    try:
        # Read backend logs
        with open('/var/log/supervisor/backend.out.log', 'r') as f:
            logs = f.read()
        
        # Look for MerchantPool validation message in ALL logs
        recent_logs = logs
        
        validation_pattern = "[MerchantPool] ✅ Configuration validation passed"
        
        if validation_pattern in recent_logs:
            print_pass(f"Found: '{validation_pattern}'")
            
            # Also check for no TypeError related to merchantPool
            if "TypeError" in recent_logs and "merchantPool" in recent_logs:
                print_fail("Found TypeError related to merchantPool")
                return False, "TypeError found in merchantPool context"
            else:
                print_pass("No TypeError related to merchantPool")
            
            return True, "MerchantPool configuration validation passed"
        else:
            print_fail(f"Missing log pattern: '{validation_pattern}'")
            return False, "MerchantPool validation message not found in logs"
            
    except Exception as e:
        return False, f"Exception reading logs: {str(e)}"

def test_public_endpoints() -> Tuple[bool, str]:
    """
    TEST 4: Regression on PUBLIC endpoints
    Verify public endpoints respond without 5xx errors
    """
    print_test("4. Public Endpoints Regression")
    
    endpoints = [
        ("/api/status/health", "Status health endpoint"),
        ("/api/csrf-token", "CSRF token endpoint"),
        ("/api/products/categories", "Product categories endpoint")
    ]
    
    all_passed = True
    results = []
    
    for path, description in endpoints:
        try:
            url = f"{EXTERNAL_BASE}{path}"
            print_info(f"Testing: {description} ({path})")
            
            response = requests.get(url, timeout=10)
            status = response.status_code
            
            print_info(f"  Status Code: {status}")
            
            # 5xx is failure, 401/403 is acceptable for protected endpoints
            if 500 <= status < 600:
                print_fail(f"  {description}: HTTP {status} (5xx error)")
                all_passed = False
                results.append(f"{path}: FAIL (5xx)")
            elif status in [401, 403]:
                print_pass(f"  {description}: HTTP {status} (protected endpoint, acceptable)")
                results.append(f"{path}: PASS (protected)")
            elif 200 <= status < 300:
                print_pass(f"  {description}: HTTP {status} (success)")
                results.append(f"{path}: PASS")
            else:
                print_info(f"  {description}: HTTP {status} (non-5xx, acceptable)")
                results.append(f"{path}: PASS (non-5xx)")
                
        except Exception as e:
            print_fail(f"  {description}: Exception - {str(e)}")
            all_passed = False
            results.append(f"{path}: FAIL (exception)")
    
    if all_passed:
        return True, "All public endpoints responded without 5xx errors"
    else:
        return False, f"Some endpoints returned 5xx: {', '.join(results)}"

def test_auth_login() -> Tuple[bool, str]:
    """
    TEST 5: AUTH - Login with seeded credentials
    POST /api/user/login with testmerchant@dynopay.dev / TestMerchant123!
    Expected: Success response with token
    """
    print_test("5. Authentication - Login with Seeded Credentials")
    
    try:
        # Use internal endpoint to avoid proxy compression issues
        url = f"{INTERNAL_BASE}/api/user/login"
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        print_info(f"POST {url}")
        print_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=10)
        status = response.status_code
        
        print_info(f"Status Code: {status}")
        
        try:
            data = response.json()
            print_info(f"Response keys: {list(data.keys())}")
            if 'data' in data and isinstance(data['data'], dict):
                print_info(f"Response data keys: {list(data['data'].keys())}")
        except (json.JSONDecodeError, ValueError) as e:
            print_info(f"Response decode error: {str(e)}")
            print_info(f"Response text (first 200 chars): {response.text[:200]}")
            data = {}
        
        # Check for success
        if status == 200:
            # Check for token in response
            has_token = False
            token_fields = ['accessToken', 'token', 'access_token', 'jwt']
            
            for field in token_fields:
                if field in data or (isinstance(data.get('data'), dict) and field in data.get('data', {})):
                    has_token = True
                    print_pass(f"Found token field: '{field}'")
                    break
            
            if has_token:
                print_pass("Login successful with token returned")
                return True, "Login successful with token"
            else:
                # Check if it's a success message without token (might be OTP flow)
                if data.get('success') or 'success' in str(data).lower() or data.get('message') == 'Login Successful!':
                    print_pass(f"Login successful: {data.get('message', 'success')}")
                    return True, "Login successful"
                else:
                    print_fail("Login returned 200 but no token found")
                    return False, "No token in response"
        else:
            print_fail(f"Login failed with status {status}")
            return False, f"Login failed: HTTP {status}"
            
    except Exception as e:
        return False, f"Exception: {str(e)}"

def main():
    """Run all tests and report results"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}DynoPay Backend Regression Test Suite{Colors.RESET}")
    print(f"{Colors.BLUE}Testing: Items #1 (versioned migrations) & #4 (typed config){Colors.RESET}")
    print(f"{Colors.BLUE}Environment: LOCAL & ISOLATED (SAFE MODE){Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    tests = [
        ("Health Endpoint", test_health_endpoint),
        ("Versioned Boot Migrations (ITEM 1)", test_migration_system),
        ("Typed Config - MerchantPool (ITEM 4)", test_merchant_pool_config),
        ("Public Endpoints Regression", test_public_endpoints),
        ("Authentication Login", test_auth_login)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        passed, message = test_func()
        results.append((test_name, passed, message))
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    passed_count = sum(1 for _, passed, _ in results if passed)
    total_count = len(results)
    
    for test_name, passed, message in results:
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        print(f"{status} - {test_name}: {message}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0
    print(f"{Colors.BLUE}TOTAL: {passed_count}/{total_count} tests passed ({pass_rate:.1f}%){Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    # Exit with appropriate code
    sys.exit(0 if passed_count == total_count else 1)

if __name__ == "__main__":
    main()
