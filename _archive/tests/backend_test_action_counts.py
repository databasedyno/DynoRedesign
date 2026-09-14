#!/usr/bin/env python3
"""
DynoPay Backend API Testing - Action Counts Endpoint Verification
Tests for: GET /api/dashboard/action-counts?company_id=1
STRICT READ-ONLY on LIVE production database
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL for the preview environment
BASE_URL = "https://cred-manager-29.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*80}{Colors.RESET}\n")

def print_test(text: str):
    print(f"{Colors.BOLD}{Colors.BLUE}[TEST] {text}{Colors.RESET}")

def print_pass(text: str):
    print(f"{Colors.GREEN}✅ PASS: {text}{Colors.RESET}")

def print_fail(text: str):
    print(f"{Colors.RED}❌ FAIL: {text}{Colors.RESET}")

def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {text}{Colors.RESET}")

def print_data(label: str, value: Any):
    print(f"  {Colors.CYAN}{label}:{Colors.RESET} {value}")

class ActionCountsTester:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token = None
        self.access_token = None
        self.company_id = COMPANY_ID
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "total": 0
        }

    def get_csrf_token(self) -> bool:
        """Get CSRF token from the API"""
        print_test("Getting CSRF token...")
        try:
            response = self.session.get(f"{API_BASE}/csrf-token", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.csrf_token = data.get('csrf_token')
                print_pass(f"CSRF token obtained: {self.csrf_token[:20]}...")
                return True
            else:
                print_fail(f"Failed to get CSRF token: {response.status_code}")
                return False
        except Exception as e:
            print_fail(f"Exception getting CSRF token: {e}")
            return False

    def login(self) -> bool:
        """Perform login"""
        print_test("Performing login...")
        
        try:
            headers = {}
            if self.csrf_token:
                headers['x-csrf-token'] = self.csrf_token
            
            response = self.session.post(
                f"{API_BASE}/user/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check if data is nested under 'data' key
                if 'data' in data:
                    data = data['data']
                
                self.access_token = data.get('accessToken')
                if self.access_token:
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.access_token}'
                    })
                    print_pass(f"Login successful, token: {self.access_token[:20]}...")
                    return True
                else:
                    print_fail("No access token in response")
                    print_info(f"Response: {json.dumps(data, indent=2)}")
                    return False
            else:
                print_fail(f"Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print_fail(f"Exception during login: {e}")
            return False

    def test_1_happy_path(self) -> Dict[str, Any]:
        """TEST 1: Happy path - GET /api/dashboard/action-counts?company_id=1"""
        print_header("TEST 1: Happy Path - Action Counts Endpoint")
        print_test(f"GET /api/dashboard/action-counts?company_id={self.company_id}")
        self.test_results["total"] += 1
        
        try:
            response = self.session.get(
                f"{API_BASE}/dashboard/action-counts",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Action counts returned {response.status_code}")
                print_info(f"Response: {response.text}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response.status_code, "response": response.text}
            
            response_data = response.json()
            
            print_pass("Action counts API returned 200 OK")
            print_info("FULL PAYLOAD:")
            print(json.dumps(response_data, indent=2))
            
            # Extract data (might be nested under 'data' key)
            if 'data' in response_data:
                data = response_data['data']
            else:
                data = response_data
            
            # Expected fields
            expected_fields = [
                'transactions_pending',
                'paylinks_active',
                'paylinks_expired',
                'products_out_of_stock',
                'referrals_pending',
                'generated_at'
            ]
            
            # Check all expected fields are present
            missing_fields = [f for f in expected_fields if f not in data]
            
            if missing_fields:
                print_fail(f"Missing expected fields: {missing_fields}")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "code": 200,
                    "data": data,
                    "missing_fields": missing_fields
                }
            
            # Report all field values
            print_info("Field values:")
            for field in expected_fields:
                print_data(field, data.get(field))
            
            print_pass("All expected fields present in response")
            self.test_results["passed"] += 1
            return {
                "status": "PASS",
                "code": 200,
                "data": data
            }
                
        except Exception as e:
            print_fail(f"Exception testing action counts: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_2_parity_with_dashboard(self, action_counts_data: Dict[str, Any]) -> Dict[str, Any]:
        """TEST 2: CRITICAL - Parity check with dashboard pending count"""
        print_header("TEST 2: CRITICAL - Parity Check with Dashboard")
        print_test("Comparing action-counts.transactions_pending with dashboard.pending_count")
        self.test_results["total"] += 1
        
        try:
            # Get dashboard data
            response = self.session.get(
                f"{API_BASE}/dashboard/",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Dashboard returned {response.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response.status_code}
            
            response_data = response.json()
            
            # Extract data (might be nested under 'data' key)
            if 'data' in response_data:
                dashboard_data = response_data['data']
            else:
                dashboard_data = response_data
            
            # Extract pending count from dashboard
            dashboard_pending = dashboard_data.get('pending_count')
            if dashboard_pending is None:
                # Try alternative locations
                pending_obj = dashboard_data.get('pending_transactions', {})
                if isinstance(pending_obj, dict):
                    dashboard_pending = pending_obj.get('count')
                elif isinstance(pending_obj, int):
                    dashboard_pending = pending_obj
                
                # Also check today_summary
                if dashboard_pending is None:
                    today_summary = dashboard_data.get('today_summary', {})
                    dashboard_pending = today_summary.get('pending_count')
            
            # Get action counts pending
            action_counts_pending = action_counts_data.get('transactions_pending')
            
            print_data("Dashboard pending_count", dashboard_pending)
            print_data("Action-counts transactions_pending", action_counts_pending)
            
            # Both should be around 179
            expected_pending = 179
            
            if dashboard_pending is None or action_counts_pending is None:
                print_fail("Could not extract pending counts from one or both endpoints")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "dashboard_pending": dashboard_pending,
                    "action_counts_pending": action_counts_pending,
                    "reason": "Missing pending count"
                }
            
            # Check if they match EXACTLY
            if dashboard_pending == action_counts_pending:
                print_pass(f"EXACT PARITY: Both show {dashboard_pending} pending transactions")
                
                # Also check if it's around the expected value
                if abs(dashboard_pending - expected_pending) <= 5:
                    print_pass(f"Value is around expected {expected_pending} (within ±5)")
                else:
                    print_info(f"Value differs from expected {expected_pending}, but parity is maintained")
                
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "dashboard_pending": dashboard_pending,
                    "action_counts_pending": action_counts_pending,
                    "match": True
                }
            else:
                print_fail(f"PARITY MISMATCH: Dashboard={dashboard_pending}, Action-counts={action_counts_pending}")
                print_fail("This is a CRITICAL FAILURE - both must use the same SQL expression")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "dashboard_pending": dashboard_pending,
                    "action_counts_pending": action_counts_pending,
                    "match": False,
                    "difference": abs(dashboard_pending - action_counts_pending)
                }
                
        except Exception as e:
            print_fail(f"Exception testing parity: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_3_removed_field(self, action_counts_data: Dict[str, Any]) -> Dict[str, Any]:
        """TEST 3: Assert invoices_unpaid field is NOT present"""
        print_header("TEST 3: Verify Removed Field (invoices_unpaid)")
        print_test("Checking that 'invoices_unpaid' is NOT in the response")
        self.test_results["total"] += 1
        
        if 'invoices_unpaid' in action_counts_data:
            print_fail("FAIL: 'invoices_unpaid' field found in response (should be removed)")
            print_info(f"Value: {action_counts_data['invoices_unpaid']}")
            self.test_results["failed"] += 1
            return {
                "status": "FAIL",
                "has_invoices_unpaid": True,
                "value": action_counts_data['invoices_unpaid']
            }
        else:
            print_pass("'invoices_unpaid' field is NOT present (correct)")
            self.test_results["passed"] += 1
            return {
                "status": "PASS",
                "has_invoices_unpaid": False
            }

    def test_4_sanity_check(self, action_counts_data: Dict[str, Any]) -> Dict[str, Any]:
        """TEST 4: Sanity check against live data"""
        print_header("TEST 4: Sanity Check Against Live Data")
        print_test("Verifying counts are within expected ranges")
        self.test_results["total"] += 1
        
        # Expected ranges
        expected = {
            'paylinks_active': (20, 30),  # ~26
            'paylinks_expired': (5, 15),  # ~10
            'products_out_of_stock': (0, 2),  # 0 or 1
            'referrals_pending': (0, 1)  # 0 (table is empty)
        }
        
        issues = []
        
        for field, (min_val, max_val) in expected.items():
            actual = action_counts_data.get(field)
            if actual is None:
                issues.append(f"{field}: missing from response")
            elif actual < min_val or actual > max_val:
                issues.append(f"{field}: {actual} (expected {min_val}-{max_val})")
                print_fail(f"{field} = {actual} is outside expected range {min_val}-{max_val}")
            else:
                print_pass(f"{field} = {actual} (within expected range {min_val}-{max_val})")
        
        if issues:
            print_fail(f"Sanity check failed: {len(issues)} issue(s)")
            self.test_results["failed"] += 1
            return {
                "status": "FAIL",
                "issues": issues
            }
        else:
            print_pass("All counts are within expected ranges")
            self.test_results["passed"] += 1
            return {
                "status": "PASS"
            }

    def test_5_auth(self) -> Dict[str, Any]:
        """TEST 5: Auth - call without Authorization header"""
        print_header("TEST 5: Authentication Check")
        print_test("Calling endpoint WITHOUT Authorization header")
        self.test_results["total"] += 1
        
        try:
            # Create a new session without auth
            unauth_session = requests.Session()
            
            response = unauth_session.get(
                f"{API_BASE}/dashboard/action-counts",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            print_data("Response status", response.status_code)
            
            if response.status_code in [401, 403]:
                print_pass(f"Correctly rejected with {response.status_code}")
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "code": response.status_code
                }
            elif response.status_code == 200:
                print_fail("SECURITY ISSUE: Endpoint returned 200 without auth!")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "code": 200,
                    "reason": "Endpoint accessible without authentication"
                }
            elif response.status_code == 500:
                print_fail("Endpoint threw 500 error (should return 401/403)")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "code": 500,
                    "reason": "Server error instead of auth rejection"
                }
            else:
                print_fail(f"Unexpected status code: {response.status_code}")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "code": response.status_code,
                    "reason": "Unexpected status code"
                }
                
        except Exception as e:
            print_fail(f"Exception testing auth: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_6_ownership_scoping(self) -> Dict[str, Any]:
        """TEST 6: Ownership scoping - try other company IDs"""
        print_header("TEST 6: Ownership Scoping (Security)")
        print_test("Attempting to access other companies' data")
        self.test_results["total"] += 1
        
        # Try company IDs that hostbay does NOT own
        test_company_ids = [2, 3, 4]
        results = {}
        all_rejected = True
        
        for company_id in test_company_ids:
            print_test(f"Trying company_id={company_id}")
            
            try:
                response = self.session.get(
                    f"{API_BASE}/dashboard/action-counts",
                    params={"company_id": company_id},
                    timeout=10
                )
                
                print_data(f"Company {company_id} status", response.status_code)
                
                if response.status_code == 200:
                    print_fail(f"SECURITY ISSUE: Got 200 for company_id={company_id} (should be rejected)")
                    all_rejected = False
                    results[company_id] = {
                        "status": "FAIL",
                        "code": 200,
                        "reason": "Access granted to unowned company"
                    }
                elif response.status_code in [401, 403]:
                    print_pass(f"Correctly rejected company_id={company_id} with {response.status_code}")
                    results[company_id] = {
                        "status": "PASS",
                        "code": response.status_code
                    }
                else:
                    print_info(f"Company {company_id} returned {response.status_code}")
                    results[company_id] = {
                        "status": "UNKNOWN",
                        "code": response.status_code
                    }
                    
            except Exception as e:
                print_fail(f"Exception testing company_id={company_id}: {e}")
                results[company_id] = {
                    "status": "ERROR",
                    "error": str(e)
                }
                all_rejected = False
        
        if all_rejected:
            print_pass("All unauthorized company IDs were correctly rejected")
            self.test_results["passed"] += 1
            return {
                "status": "PASS",
                "results": results
            }
        else:
            print_fail("Some unauthorized company IDs were not rejected")
            self.test_results["failed"] += 1
            return {
                "status": "FAIL",
                "results": results
            }

    def test_7_caching_and_no_company_id(self) -> Dict[str, Any]:
        """TEST 7: Caching + no company_id parameter"""
        print_header("TEST 7: Caching and Missing company_id")
        self.test_results["total"] += 1
        
        try:
            # Test 7a: Call twice to check caching
            print_test("Calling endpoint twice to check caching (60s TTL)")
            
            response1 = self.session.get(
                f"{API_BASE}/dashboard/action-counts",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response1.status_code != 200:
                print_fail(f"First call failed: {response1.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response1.status_code}
            
            data1 = response1.json()
            print_pass("First call successful")
            
            # Second call (should be cache hit)
            response2 = self.session.get(
                f"{API_BASE}/dashboard/action-counts",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response2.status_code != 200:
                print_fail(f"Second call failed: {response2.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response2.status_code}
            
            data2 = response2.json()
            print_pass("Second call successful")
            
            # Compare data (should be identical for cache hit)
            if data1 == data2:
                print_pass("Second call returned identical data (likely cache hit)")
            else:
                print_info("Second call returned different data (cache miss or data changed)")
            
            # Test 7b: Call with no company_id parameter
            print_test("Calling endpoint with NO company_id parameter")
            
            response3 = self.session.get(
                f"{API_BASE}/dashboard/action-counts",
                timeout=10
            )
            
            print_data("No company_id status", response3.status_code)
            
            if response3.status_code == 200:
                data3 = response3.json()
                print_pass("Endpoint returned 200 with no company_id (falls back to user's companies)")
                print_info(f"Response: {json.dumps(data3, indent=2)}")
            else:
                print_info(f"Endpoint returned {response3.status_code} with no company_id")
            
            # Check backend logs for errors
            print_test("Checking backend logs for errors from these calls")
            
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            err_log = result.stdout
            recent_errors = []
            
            for line in err_log.split('\n')[-20:]:  # Last 20 lines
                if any(keyword in line.lower() for keyword in ['error', 'exception']) and 'action-counts' in line.lower():
                    recent_errors.append(line)
            
            if recent_errors:
                print_fail(f"Found {len(recent_errors)} errors related to action-counts")
                for err in recent_errors:
                    print(f"  {err}")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "errors": recent_errors
                }
            else:
                print_pass("No errors found in backend logs")
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "cache_test": "identical" if data1 == data2 else "different",
                    "no_company_id_status": response3.status_code
                }
                
        except Exception as e:
            print_fail(f"Exception testing caching: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_8_safe_mode(self) -> Dict[str, Any]:
        """TEST 8: Confirm SAFE MODE is still active"""
        print_header("TEST 8: SAFE MODE Verification")
        print_test("Verifying background jobs / cron / BullMQ webhook worker are DISABLED")
        self.test_results["total"] += 1
        
        try:
            import subprocess
            
            # Check backend logs for safe mode indicators
            result = subprocess.run(
                ["tail", "-n", "500", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            out_log = result.stdout
            lines = out_log.split('\n')
            
            # Look for safe mode indicators
            safe_mode_indicators = []
            unsafe_indicators = []
            
            for line in lines:
                line_lower = line.lower()
                
                # Safe mode indicators
                if 'skipping bullmq webhook worker' in line_lower:
                    safe_mode_indicators.append("BullMQ webhook worker skipped")
                if 'background jobs' in line_lower and 'disabled' in line_lower:
                    safe_mode_indicators.append("Background jobs disabled")
                if 'enable_background_jobs=false' in line_lower:
                    safe_mode_indicators.append("ENABLE_BACKGROUND_JOBS=false")
                if 'worker_role=secondary' in line_lower:
                    safe_mode_indicators.append("WORKER_ROLE=secondary")
                if 'skipping startup reconciliation' in line_lower:
                    safe_mode_indicators.append("Startup reconciliation skipped")
                if 'skipping webhook url migration' in line_lower:
                    safe_mode_indicators.append("Webhook URL migration skipped")
                if 'skipping error digest monitoring' in line_lower:
                    safe_mode_indicators.append("Error digest monitoring skipped")
                
                # Unsafe indicators (should NOT be present)
                if 'worker_role=primary' in line_lower:
                    unsafe_indicators.append("⚠️ WORKER_ROLE=primary detected!")
                if 'starting bullmq webhook worker' in line_lower and 'skipping' not in line_lower:
                    unsafe_indicators.append("⚠️ BullMQ webhook worker started!")
            
            if unsafe_indicators:
                print_fail("CRITICAL: SAFE MODE NOT ACTIVE!")
                for indicator in unsafe_indicators:
                    print(f"  {Colors.RED}{indicator}{Colors.RESET}")
                self.test_results["failed"] += 1
                return {
                    "status": "CRITICAL_FAIL",
                    "safe_mode": False,
                    "unsafe_indicators": unsafe_indicators
                }
            elif safe_mode_indicators:
                print_pass("SAFE MODE is active (background jobs disabled)")
                for indicator in safe_mode_indicators:
                    print_info(f"  ✓ {indicator}")
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "safe_mode": True,
                    "indicators": safe_mode_indicators
                }
            else:
                print_fail("Could not verify SAFE MODE status from logs")
                self.test_results["failed"] += 1
                return {
                    "status": "UNKNOWN",
                    "safe_mode": None,
                    "reason": "No safe mode indicators found in logs"
                }
                
        except Exception as e:
            print_fail(f"Exception checking safe mode: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def run_all_tests(self):
        """Run all tests in sequence"""
        print_header("DynoPay Action Counts Endpoint Testing")
        print_info(f"Testing against: {BASE_URL}")
        print_info(f"Test account: {TEST_EMAIL}")
        print_info("STRICT READ-ONLY mode on LIVE production database")
        
        results = {}
        
        # Get CSRF token
        if not self.get_csrf_token():
            print_fail("Failed to get CSRF token, aborting tests")
            return results
        
        # Login
        if not self.login():
            print_fail("Login failed, aborting tests")
            return results
        
        # TEST 1: Happy path
        test1_result = self.test_1_happy_path()
        results['test1_happy_path'] = test1_result
        
        if test1_result['status'] != 'PASS':
            print_fail("TEST 1 failed, cannot proceed with remaining tests")
            return results
        
        action_counts_data = test1_result.get('data', {})
        
        # TEST 2: Parity check (CRITICAL)
        test2_result = self.test_2_parity_with_dashboard(action_counts_data)
        results['test2_parity'] = test2_result
        
        # TEST 3: Removed field
        test3_result = self.test_3_removed_field(action_counts_data)
        results['test3_removed_field'] = test3_result
        
        # TEST 4: Sanity check
        test4_result = self.test_4_sanity_check(action_counts_data)
        results['test4_sanity'] = test4_result
        
        # TEST 5: Auth
        test5_result = self.test_5_auth()
        results['test5_auth'] = test5_result
        
        # TEST 6: Ownership scoping
        test6_result = self.test_6_ownership_scoping()
        results['test6_ownership'] = test6_result
        
        # TEST 7: Caching
        test7_result = self.test_7_caching_and_no_company_id()
        results['test7_caching'] = test7_result
        
        # TEST 8: Safe mode
        test8_result = self.test_8_safe_mode()
        results['test8_safe_mode'] = test8_result
        
        # Print summary
        print_header("TEST SUMMARY")
        print_data("Total tests", self.test_results["total"])
        print_data("Passed", f"{Colors.GREEN}{self.test_results['passed']}{Colors.RESET}")
        print_data("Failed", f"{Colors.RED}{self.test_results['failed']}{Colors.RESET}")
        
        if self.test_results["failed"] == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ ALL TESTS PASSED{Colors.RESET}\n")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.RESET}\n")
        
        return results

def main():
    tester = ActionCountsTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    if tester.test_results["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
