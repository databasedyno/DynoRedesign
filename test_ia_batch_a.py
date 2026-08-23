#!/usr/bin/env python3
"""
Backend Testing Script for Session 2026-08-13
IA Batch A: Nav reveal-on-relevance backend change

STRICT READ-ONLY on LIVE PRODUCTION database.
Login: hostbay@moxx.co / Katiekendra123@
Company ID: 1

Tests the ONE backend change: getActionCounts now returns nav_reveal object.
"""

import requests
import json
import sys
import subprocess
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://payment-config-dev.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
LOGIN_EMAIL = "hostbay@moxx.co"
LOGIN_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test(msg: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{msg}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.END}")

def print_pass(msg: str):
    print(f"{Colors.GREEN}✅ PASS: {msg}{Colors.END}")

def print_fail(msg: str):
    print(f"{Colors.RED}❌ FAIL: {msg}{Colors.END}")

def print_info(msg: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {msg}{Colors.END}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  WARNING: {msg}{Colors.END}")

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token: Optional[str] = None
        self.access_token: Optional[str] = None
        self.company_id: int = 1
        self.results = {
            "passed": [],
            "failed": [],
            "warnings": []
        }

    def login(self) -> bool:
        """2-step login: checkEmail -> login with CSRF token"""
        print_test("AUTHENTICATION: 2-Step Login")
        
        try:
            # Step 1: Get CSRF token
            print_info("Step 1: Getting CSRF token...")
            csrf_resp = self.session.get(f"{API_BASE}/csrf-token", timeout=10)
            if csrf_resp.status_code == 200:
                data = csrf_resp.json()
                self.csrf_token = data.get("csrf_token")
                print_pass(f"CSRF token obtained: {self.csrf_token[:20]}...")
            else:
                print_fail(f"Failed to get CSRF token: {csrf_resp.status_code}")
                return False

            # Step 2: Check email
            print_info("Step 2: Checking email...")
            check_resp = self.session.get(
                f"{API_BASE}/user/checkEmail?email={LOGIN_EMAIL}",
                headers={"x-csrf-token": self.csrf_token} if self.csrf_token else {},
                timeout=10
            )
            if check_resp.status_code == 200:
                print_pass(f"Email check successful: {LOGIN_EMAIL}")
            else:
                print_fail(f"Email check failed: {check_resp.status_code}")
                return False

            # Step 3: Login with password
            print_info("Step 3: Logging in with password...")
            login_resp = self.session.post(
                f"{API_BASE}/user/login",
                json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
                headers={"x-csrf-token": self.csrf_token} if self.csrf_token else {},
                timeout=10
            )
            
            if login_resp.status_code == 200:
                data = login_resp.json()
                # Token is in data.data.accessToken
                if data.get("data", {}).get("accessToken"):
                    self.access_token = data["data"]["accessToken"]
                    print_pass(f"Login successful! Token: {self.access_token[:30]}...")
                    return True
                else:
                    print_fail(f"Login response missing accessToken: {json.dumps(data, indent=2)}")
                    return False
            else:
                print_fail(f"Login failed: {login_resp.status_code} - {login_resp.text}")
                return False

        except Exception as e:
            print_fail(f"Login exception: {str(e)}")
            return False

    def get_headers(self) -> Dict[str, str]:
        """Get headers with auth token"""
        headers = {
            "Content-Type": "application/json",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        if self.csrf_token:
            headers["x-csrf-token"] = self.csrf_token
        return headers

    def test_1_new_payload(self) -> bool:
        """Test 1: GET /api/dashboard/action-counts?company_id=1 -> 200 with nav_reveal"""
        print_test("TEST 1: New Payload - nav_reveal with 3 booleans")
        
        try:
            resp = self.session.get(
                f"{API_BASE}/dashboard/action-counts?company_id={self.company_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status Code: {resp.status_code}")
            
            if resp.status_code != 200:
                print_fail(f"Expected 200, got {resp.status_code}")
                print_info(f"Response: {resp.text}")
                self.results["failed"].append("Test 1: Status code not 200")
                return False
            
            data = resp.json()
            print_info(f"Raw JSON Response:\n{json.dumps(data, indent=2)}")
            
            # Get the payload (data field)
            payload = data.get("data", {})
            
            # Check for nav_reveal
            if "nav_reveal" not in payload:
                print_fail("Response missing 'nav_reveal' field")
                self.results["failed"].append("Test 1: Missing nav_reveal field")
                return False
            
            nav_reveal = payload["nav_reveal"]
            print_info(f"nav_reveal: {json.dumps(nav_reveal, indent=2)}")
            
            # Check that nav_reveal has 3 fields
            required_fields = ["receipts", "customers", "developers"]
            for field in required_fields:
                if field not in nav_reveal:
                    print_fail(f"nav_reveal missing '{field}' field")
                    self.results["failed"].append(f"Test 1: Missing {field} in nav_reveal")
                    return False
            
            # Check that all are booleans
            for field in required_fields:
                value = nav_reveal[field]
                if not isinstance(value, bool):
                    print_fail(f"nav_reveal.{field} is not a boolean (got {type(value).__name__}: {value})")
                    self.results["failed"].append(f"Test 1: {field} not boolean")
                    return False
            
            # For company 1, all three must be true
            all_true = all(nav_reveal[field] for field in required_fields)
            if not all_true:
                print_fail(f"For company 1, all nav_reveal fields must be true. Got: {nav_reveal}")
                self.results["failed"].append("Test 1: Not all nav_reveal fields are true for company 1")
                return False
            
            print_pass("nav_reveal contains 3 booleans (receipts, customers, developers)")
            print_pass(f"All three are TRUE for company 1: {nav_reveal}")
            self.results["passed"].append("Test 1: nav_reveal structure correct and all true")
            return True
            
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            self.results["failed"].append(f"Test 1: Exception - {str(e)}")
            return False

    def test_2_no_regression(self) -> bool:
        """Test 2: Verify no regression in existing counts and dashboard parity"""
        print_test("TEST 2: No Regression - Dashboard Parity Check")
        
        try:
            # Get action-counts
            action_resp = self.session.get(
                f"{API_BASE}/dashboard/action-counts?company_id={self.company_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if action_resp.status_code != 200:
                print_fail(f"action-counts returned {action_resp.status_code}")
                self.results["failed"].append("Test 2: action-counts not 200")
                return False
            
            action_data = action_resp.json().get("data", {})
            
            # Get dashboard
            dashboard_resp = self.session.get(
                f"{API_BASE}/dashboard/?company_id={self.company_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if dashboard_resp.status_code != 200:
                print_fail(f"dashboard returned {dashboard_resp.status_code}")
                self.results["failed"].append("Test 2: dashboard not 200")
                return False
            
            dashboard_data = dashboard_resp.json().get("data", {})
            
            # Extract counts
            transactions_pending = action_data.get("transactions_pending")
            paylinks_active = action_data.get("paylinks_active")
            paylinks_expired = action_data.get("paylinks_expired")
            products_out_of_stock = action_data.get("products_out_of_stock")
            referrals_pending = action_data.get("referrals_pending")
            
            # Dashboard pending count
            pending_count = dashboard_data.get("pending_transactions", {}).get("count")
            
            print_info("Action Counts:")
            print_info(f"  transactions_pending: {transactions_pending}")
            print_info(f"  paylinks_active: {paylinks_active}")
            print_info(f"  paylinks_expired: {paylinks_expired}")
            print_info(f"  products_out_of_stock: {products_out_of_stock}")
            print_info(f"  referrals_pending: {referrals_pending}")
            print_info(f"\nDashboard:")
            print_info(f"  pending_count: {pending_count}")
            
            # CRITICAL: Check parity
            if transactions_pending != pending_count:
                print_fail(f"PARITY FAILURE: transactions_pending ({transactions_pending}) != pending_count ({pending_count})")
                self.results["failed"].append(f"Test 2: Parity failure - {transactions_pending} != {pending_count}")
                return False
            
            print_pass(f"EXACT PARITY: transactions_pending ({transactions_pending}) == pending_count ({pending_count})")
            print_pass(f"All 5 counts reported: pending={transactions_pending}, active={paylinks_active}, expired={paylinks_expired}, out_of_stock={products_out_of_stock}, referrals={referrals_pending}")
            self.results["passed"].append("Test 2: Dashboard parity maintained")
            return True
            
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            self.results["failed"].append(f"Test 2: Exception - {str(e)}")
            return False

    def test_3_cache(self) -> bool:
        """Test 3: Call action-counts twice - both responses identical"""
        print_test("TEST 3: Cache - Two Calls Should Return Identical Data")
        
        try:
            # First call
            resp1 = self.session.get(
                f"{API_BASE}/dashboard/action-counts?company_id={self.company_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if resp1.status_code != 200:
                print_fail(f"First call returned {resp1.status_code}")
                self.results["failed"].append("Test 3: First call not 200")
                return False
            
            data1 = resp1.json().get("data", {})
            
            # Second call (should hit cache)
            resp2 = self.session.get(
                f"{API_BASE}/dashboard/action-counts?company_id={self.company_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if resp2.status_code != 200:
                print_fail(f"Second call returned {resp2.status_code}")
                self.results["failed"].append("Test 3: Second call not 200")
                return False
            
            data2 = resp2.json().get("data", {})
            
            # Remove generated_at for comparison (it will differ slightly)
            data1_compare = {k: v for k, v in data1.items() if k != "generated_at"}
            data2_compare = {k: v for k, v in data2.items() if k != "generated_at"}
            
            if data1_compare != data2_compare:
                print_fail("Two calls returned different data")
                print_info(f"First call: {json.dumps(data1_compare, indent=2)}")
                print_info(f"Second call: {json.dumps(data2_compare, indent=2)}")
                self.results["failed"].append("Test 3: Cache inconsistency")
                return False
            
            print_pass("Both calls returned identical data (cache working)")
            print_info(f"Cached data: {json.dumps(data1_compare, indent=2)}")
            self.results["passed"].append("Test 3: Cache consistency verified")
            return True
            
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            self.results["failed"].append(f"Test 3: Exception - {str(e)}")
            return False

    def test_4_ownership_isolation(self) -> bool:
        """Test 4: Ownership isolation - company_id=31 must be rejected"""
        print_test("TEST 4: Ownership Isolation - company_id=31 Must Be Rejected")
        
        try:
            resp = self.session.get(
                f"{API_BASE}/dashboard/action-counts?company_id=31",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status Code: {resp.status_code}")
            
            # Must be 403 or 4xx, NOT 200
            if resp.status_code == 200:
                print_fail("SECURITY ISSUE: company_id=31 returned 200 (should be rejected)")
                print_info(f"Response: {resp.text}")
                self.results["failed"].append("Test 4: Ownership isolation broken - returned 200")
                return False
            
            if resp.status_code in [403, 404]:
                print_pass(f"Correctly rejected with {resp.status_code}")
                self.results["passed"].append(f"Test 4: Ownership isolation working - {resp.status_code}")
                return True
            else:
                print_warning(f"Rejected with {resp.status_code} (expected 403/404, but rejection is correct)")
                self.results["passed"].append(f"Test 4: Ownership isolation working - {resp.status_code}")
                return True
            
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            self.results["failed"].append(f"Test 4: Exception - {str(e)}")
            return False

    def test_5_unscoped_call(self) -> bool:
        """Test 5: Unscoped call - no company_id parameter"""
        print_test("TEST 5: Unscoped Call - No company_id Parameter")
        
        try:
            resp = self.session.get(
                f"{API_BASE}/dashboard/action-counts",
                headers=self.get_headers(),
                timeout=10
            )
            
            print_info(f"Status Code: {resp.status_code}")
            
            if resp.status_code != 200:
                print_fail(f"Expected 200, got {resp.status_code}")
                print_info(f"Response: {resp.text}")
                self.results["failed"].append("Test 5: Unscoped call not 200")
                return False
            
            data = resp.json().get("data", {})
            
            # Check for nav_reveal
            if "nav_reveal" not in data:
                print_fail("Response missing 'nav_reveal' field")
                self.results["failed"].append("Test 5: Missing nav_reveal in unscoped call")
                return False
            
            nav_reveal = data["nav_reveal"]
            print_info(f"nav_reveal: {json.dumps(nav_reveal, indent=2)}")
            
            # Check structure
            required_fields = ["receipts", "customers", "developers"]
            for field in required_fields:
                if field not in nav_reveal:
                    print_fail(f"nav_reveal missing '{field}' field")
                    self.results["failed"].append(f"Test 5: Missing {field} in nav_reveal")
                    return False
                if not isinstance(nav_reveal[field], bool):
                    print_fail(f"nav_reveal.{field} is not a boolean")
                    self.results["failed"].append(f"Test 5: {field} not boolean")
                    return False
            
            print_pass("Unscoped call returned 200 with nav_reveal present")
            print_info(f"All counts: {json.dumps(data, indent=2)}")
            self.results["passed"].append("Test 5: Unscoped call working")
            return True
            
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            self.results["failed"].append(f"Test 5: Exception - {str(e)}")
            return False

    def test_6_safe_mode(self) -> bool:
        """Test 6: Verify SAFE MODE is active"""
        print_test("TEST 6: SAFE MODE - Background Jobs Must Be Disabled")
        
        try:
            # Check backend logs for SAFE MODE indicators
            print_info("Checking backend logs for SAFE MODE indicators...")
            
            # Check both out and err logs
            log_files = [
                "/var/log/supervisor/backend.out.log",
                "/var/log/supervisor/backend.err.log"
            ]
            
            log_content = ""
            for log_file in log_files:
                try:
                    result = subprocess.run(
                        ["tail", "-n", "1000", log_file],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    log_content += result.stdout
                except Exception as e:
                    print_warning(f"Could not read {log_file}: {str(e)}")
            
            # Look for SAFE MODE indicators
            safe_mode_indicators = [
                "BACKGROUND JOBS DISABLED",
                "background jobs disabled",
                "ENABLE_BACKGROUND_JOBS=false",
                "WORKER_ROLE=secondary",
                "Skipping BullMQ webhook worker",
                "Skipping startup reconciliation",
                "Skipping webhook URL migration",
                "Skipping error digest monitoring"
            ]
            
            found_indicators = []
            for indicator in safe_mode_indicators:
                if indicator in log_content:
                    found_indicators.append(indicator)
            
            if found_indicators:
                print_pass(f"SAFE MODE ACTIVE - Found {len(found_indicators)} indicators:")
                for ind in found_indicators:
                    print_info(f"  ✓ {ind}")
                self.results["passed"].append("Test 6: SAFE MODE active")
                return True
            else:
                print_fail("CRITICAL: No SAFE MODE indicators found in logs")
                print_warning("This could mean background jobs are ENABLED on LIVE prod DB!")
                self.results["failed"].append("Test 6: SAFE MODE not confirmed")
                return False
            
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            self.results["failed"].append(f"Test 6: Exception - {str(e)}")
            return False

    def print_summary(self):
        """Print test summary"""
        print_test("TEST SUMMARY")
        
        total = len(self.results["passed"]) + len(self.results["failed"])
        passed = len(self.results["passed"])
        failed = len(self.results["failed"])
        
        print(f"\n{Colors.BOLD}Total Tests: {total}{Colors.END}")
        print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {failed}{Colors.END}")
        
        if self.results["passed"]:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ PASSED TESTS:{Colors.END}")
            for test in self.results["passed"]:
                print(f"  {Colors.GREEN}✓ {test}{Colors.END}")
        
        if self.results["failed"]:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ FAILED TESTS:{Colors.END}")
            for test in self.results["failed"]:
                print(f"  {Colors.RED}✗ {test}{Colors.END}")
        
        if self.results["warnings"]:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠️  WARNINGS:{Colors.END}")
            for warning in self.results["warnings"]:
                print(f"  {Colors.YELLOW}⚠ {warning}{Colors.END}")
        
        return failed == 0

def main():
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("="*80)
    print("IA BATCH A BACKEND TESTING")
    print("Session 2026-08-13: Nav reveal-on-relevance")
    print("="*80)
    print(f"{Colors.END}")
    
    test = TestSession()
    
    # Login
    if not test.login():
        print_fail("Login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run all tests
    test.test_1_new_payload()
    test.test_2_no_regression()
    test.test_3_cache()
    test.test_4_ownership_isolation()
    test.test_5_unscoped_call()
    test.test_6_safe_mode()
    
    # Print summary
    success = test.print_summary()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
