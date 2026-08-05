#!/usr/bin/env python3
"""
Backend Test for Dashboard Chart Endpoint - Custom Date Range Feature
Session: 2026-08-04 - Dashboard chart custom date range testing

TEST SCOPE: GET /api/dashboard/chart with custom startDate & endDate params
- Named periods (7d, 30d, 90d, 1y) with expected group_by mappings
- Custom date range with period="custom"
- Custom span → groupBy logic (≤31 days→day, ≤180→week, >180→month)
- endDate upper bound enforcement (no data after custom endDate)
- Fallback/edge cases (invalid dates, start>end, missing params)
- Regression check on dashboard stats endpoint

SAFETY: READ-ONLY GET endpoint testing. LIVE production DB but safe.
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple, List
from datetime import datetime, date

# Preview URL from review request
BASE_URL = "https://multi-chain-gateway.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from review request
MERCHANT_EMAIL = "hostbay@moxx.co"
MERCHANT_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'

def print_section(name: str):
    print(f"\n{Colors.CYAN}{'='*100}{Colors.END}")
    print(f"{Colors.CYAN}{name}{Colors.END}")
    print(f"{Colors.CYAN}{'='*100}{Colors.END}")

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'─'*100}{Colors.END}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'─'*100}{Colors.END}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.END}")

def print_fail(message: str):
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.END}")

def print_data(label: str, data: Any):
    print(f"{Colors.MAGENTA}{label}:{Colors.END}")
    if isinstance(data, (dict, list)):
        print(json.dumps(data, indent=2))
    else:
        print(data)

def login() -> Tuple[bool, str]:
    """Login and get access token"""
    print_test("Login as hostbay@moxx.co")
    
    try:
        login_data = {
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        }
        
        response = requests.post(
            f"{API_BASE}/user/login",
            json=login_data,
            timeout=10
        )
        
        print_info(f"Login Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Extract token from various possible locations
            token = None
            if isinstance(data, dict):
                token = (data.get("token") or 
                        data.get("accessToken") or 
                        data.get("data", {}).get("token") or 
                        data.get("data", {}).get("accessToken"))
            
            if token:
                print_pass(f"Login successful, token: {token[:30]}...")
                return True, token
            else:
                print_fail("Login response missing token")
                print_data("Response", data)
                return False, ""
        else:
            print_fail(f"Login failed: {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return False, ""
            
    except Exception as e:
        print_fail(f"Login exception: {str(e)}")
        return False, ""

def test_chart_endpoint(token: str, params: Dict[str, str], test_name: str, expected: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    """
    Test the chart endpoint with given params
    Returns (success, response_data)
    """
    print_test(test_name)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Build query string
        query_parts = []
        for key, value in params.items():
            if value is not None:
                query_parts.append(f"{key}={value}")
        query_string = "&".join(query_parts)
        
        url = f"{API_BASE}/dashboard/chart"
        if query_string:
            url += f"?{query_string}"
        
        print_info(f"URL: {url}")
        
        response = requests.get(url, headers=headers, timeout=15)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return False, {}
        
        data = response.json()
        result = data.get("data", {})
        
        # Extract key fields
        period = result.get("period")
        group_by = result.get("group_by")
        start_date = result.get("start_date")
        end_date = result.get("end_date")
        chart_data = result.get("chart_data", [])
        
        print_info(f"period: {period}")
        print_info(f"group_by: {group_by}")
        print_info(f"start_date: {start_date}")
        print_info(f"end_date: {end_date}")
        print_info(f"chart_data length: {len(chart_data)}")
        
        # Validate expected values
        all_checks_pass = True
        
        if "period" in expected:
            if period == expected["period"]:
                print_pass(f"period matches: {period}")
            else:
                print_fail(f"period mismatch: expected {expected['period']}, got {period}")
                all_checks_pass = False
        
        if "group_by" in expected:
            if group_by == expected["group_by"]:
                print_pass(f"group_by matches: {group_by}")
            else:
                print_fail(f"group_by mismatch: expected {expected['group_by']}, got {group_by}")
                all_checks_pass = False
        
        if "start_date" in expected:
            if start_date == expected["start_date"]:
                print_pass(f"start_date matches: {start_date}")
            else:
                print_fail(f"start_date mismatch: expected {expected['start_date']}, got {start_date}")
                all_checks_pass = False
        
        if "end_date" in expected:
            if end_date == expected["end_date"]:
                print_pass(f"end_date matches: {end_date}")
            else:
                print_fail(f"end_date mismatch: expected {expected['end_date']}, got {end_date}")
                all_checks_pass = False
        
        # Check chart_data is array
        if not isinstance(chart_data, list):
            print_fail(f"chart_data is not an array: {type(chart_data)}")
            all_checks_pass = False
        else:
            print_pass(f"chart_data is an array with {len(chart_data)} items")
        
        # Check for required fields in response
        if "chart_data" not in result:
            print_fail("Missing chart_data in response")
            all_checks_pass = False
        
        if all_checks_pass:
            print_pass(f"All checks passed for {test_name}")
        
        return all_checks_pass, result
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False, {}

def test_enddate_upper_bound(token: str) -> bool:
    """
    Test that endDate upper bound is enforced - no chart_data points after endDate
    """
    print_test("TEST 4: endDate upper bound enforcement")
    
    params = {
        "startDate": "2026-06-01",
        "endDate": "2026-06-05"
    }
    
    expected = {
        "period": "custom",
        "end_date": "2026-06-05"
    }
    
    success, result = test_chart_endpoint(token, params, "Custom range with endDate=2026-06-05", expected)
    
    if not success:
        return False
    
    # Check that no chart_data points are after 2026-06-05
    chart_data = result.get("chart_data", [])
    end_date_limit = date.fromisoformat("2026-06-05")
    
    violations = []
    for point in chart_data:
        point_date_str = point.get("date")
        if point_date_str:
            try:
                point_date = date.fromisoformat(point_date_str)
                if point_date > end_date_limit:
                    violations.append(point_date_str)
            except (ValueError, TypeError):
                pass
    
    if violations:
        print_fail(f"Found {len(violations)} chart_data points after endDate 2026-06-05: {violations}")
        return False
    else:
        print_pass("No chart_data points found after endDate 2026-06-05")
        return True

def test_dashboard_stats(token: str) -> bool:
    """
    Regression test: Confirm the primary dashboard stats endpoint still returns 200
    """
    print_test("REGRESSION: Dashboard stats endpoint")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try common dashboard stats endpoints
        endpoints = [
            "/api/dashboard",
            "/api/dashboard/stats"
        ]
        
        for endpoint in endpoints:
            url = f"{BASE_URL}{endpoint}"
            print_info(f"Testing: {url}")
            
            response = requests.get(url, headers=headers, timeout=15)
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                print_pass(f"Dashboard stats endpoint {endpoint} returns 200")
                return True
            elif response.status_code == 404:
                print_info(f"Endpoint {endpoint} not found, trying next...")
                continue
            else:
                print_fail(f"Dashboard stats endpoint {endpoint} returned {response.status_code}")
                return False
        
        print_fail("No dashboard stats endpoint found")
        return False
        
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return False

def check_backend_logs():
    """
    Check backend logs for SQL errors or unhandled exceptions
    """
    print_test("Check backend logs for errors")
    
    try:
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            log_content = result.stdout
            
            # Look for SQL errors or exceptions
            error_keywords = ["ERROR", "Exception", "SQL", "error", "failed"]
            errors_found = []
            
            for line in log_content.split('\n'):
                if any(keyword in line for keyword in error_keywords):
                    errors_found.append(line)
            
            if errors_found:
                print_info(f"Found {len(errors_found)} potential error lines in backend logs")
                for error in errors_found[-10:]:  # Show last 10
                    print_info(f"  {error[:200]}")
            else:
                print_pass("No obvious errors in backend logs")
        else:
            print_info("Could not read backend logs")
    
    except Exception as e:
        print_info(f"Could not check logs: {str(e)}")

def main():
    print_section("DASHBOARD CHART ENDPOINT - CUSTOM DATE RANGE TEST")
    print(f"{Colors.YELLOW}Preview URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.YELLOW}Test Type: READ-ONLY GET endpoint testing{Colors.END}")
    print(f"{Colors.YELLOW}Feature: Custom startDate & endDate query params{Colors.END}\n")
    
    results = {}
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 0: Login
    # ═══════════════════════════════════════════════════════════════════════
    print_section("STEP 0: LOGIN")
    success, token = login()
    if not success:
        print_fail("Login failed, cannot continue")
        return 1
    results["login"] = True
    
    # ═══════════════════════════════════════════════════════════════════════
    # TEST 1: Named periods (7d, 30d, 90d, 1y)
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST 1: Named Periods")
    
    named_period_tests = [
        {
            "params": {"period": "7d"},
            "expected": {"period": "7d", "group_by": "day"},
            "name": "period=7d"
        },
        {
            "params": {"period": "30d"},
            "expected": {"period": "30d", "group_by": "day"},
            "name": "period=30d"
        },
        {
            "params": {"period": "90d"},
            "expected": {"period": "90d", "group_by": "week"},
            "name": "period=90d"
        },
        {
            "params": {"period": "1y"},
            "expected": {"period": "1y", "group_by": "month"},
            "name": "period=1y"
        }
    ]
    
    for test in named_period_tests:
        success, _ = test_chart_endpoint(token, test["params"], test["name"], test["expected"])
        results[f"test1_{test['name']}"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # TEST 2: Custom range (normal)
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST 2: Custom Range (Normal)")
    
    success, _ = test_chart_endpoint(
        token,
        {"startDate": "2026-06-01", "endDate": "2026-06-30"},
        "Custom range 2026-06-01 to 2026-06-30 (30 days)",
        {
            "period": "custom",
            "start_date": "2026-06-01",
            "end_date": "2026-06-30",
            "group_by": "day"
        }
    )
    results["test2_custom_30days"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # TEST 3: Custom span → groupBy logic
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST 3: Custom Span → groupBy Logic")
    
    # 3a: >31 days and ≤180 days → week
    success, _ = test_chart_endpoint(
        token,
        {"startDate": "2026-01-01", "endDate": "2026-05-01"},
        "Custom range 2026-01-01 to 2026-05-01 (>31 days, ≤180 days)",
        {
            "period": "custom",
            "group_by": "week"
        }
    )
    results["test3a_week_grouping"] = success
    
    # 3b: >180 days → month
    success, _ = test_chart_endpoint(
        token,
        {"startDate": "2025-01-01", "endDate": "2026-06-30"},
        "Custom range 2025-01-01 to 2026-06-30 (>180 days)",
        {
            "period": "custom",
            "group_by": "month"
        }
    )
    results["test3b_month_grouping"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # TEST 4: endDate upper bound enforcement
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST 4: endDate Upper Bound Enforcement")
    
    success = test_enddate_upper_bound(token)
    results["test4_enddate_bound"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # TEST 5: Fallback/edge cases
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST 5: Fallback/Edge Cases")
    
    edge_cases = [
        {
            "params": {"startDate": "notadate", "endDate": "2026-06-30"},
            "name": "Invalid startDate (should fallback to named period)",
            "check_not_custom": True
        },
        {
            "params": {"startDate": "2026-06-30", "endDate": "2026-06-01"},
            "name": "start > end (should fallback to named period)",
            "check_not_custom": True
        },
        {
            "params": {"startDate": "2026-06-01"},
            "name": "Only startDate, no endDate (should fallback to named period)",
            "check_not_custom": True
        }
    ]
    
    for test in edge_cases:
        print_test(test["name"])
        
        try:
            headers = {"Authorization": f"Bearer {token}"}
            query_parts = []
            for key, value in test["params"].items():
                query_parts.append(f"{key}={value}")
            query_string = "&".join(query_parts)
            url = f"{API_BASE}/dashboard/chart?{query_string}"
            
            print_info(f"URL: {url}")
            
            response = requests.get(url, headers=headers, timeout=15)
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                result = data.get("data", {})
                period = result.get("period")
                
                print_info(f"period: {period}")
                
                if test.get("check_not_custom"):
                    if period != "custom":
                        print_pass(f"Correctly fell back to named period: {period}")
                        results[f"test5_{test['name'][:20]}"] = True
                    else:
                        print_fail(f"Should have fallen back but got period=custom")
                        results[f"test5_{test['name'][:20]}"] = False
                else:
                    print_pass("Endpoint returned 200 (no 500 error)")
                    results[f"test5_{test['name'][:20]}"] = True
            elif response.status_code == 500:
                print_fail(f"Got 500 error (should not happen)")
                results[f"test5_{test['name'][:20]}"] = False
            else:
                print_info(f"Got {response.status_code} (acceptable if not 500)")
                results[f"test5_{test['name'][:20]}"] = True
                
        except Exception as e:
            print_fail(f"Exception: {str(e)}")
            results[f"test5_{test['name'][:20]}"] = False
    
    # ═══════════════════════════════════════════════════════════════════════
    # TEST 6: Regression - Dashboard stats endpoint
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST 6: Regression Check")
    
    success = test_dashboard_stats(token)
    results["test6_dashboard_stats"] = success
    
    # ═══════════════════════════════════════════════════════════════════════
    # Check backend logs
    # ═══════════════════════════════════════════════════════════════════════
    print_section("BACKEND LOGS CHECK")
    check_backend_logs()
    
    # ═══════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════════════════════
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\n{Colors.BLUE}Results by Test:{Colors.END}\n")
    for test_name, result in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if result else f"{Colors.RED}✗ FAIL{Colors.END}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.CYAN}{'='*100}{Colors.END}")
    print(f"\n{Colors.BLUE}Overall: {passed}/{total} tests passed ({int(passed/total*100)}%){Colors.END}\n")
    
    if passed == total:
        print(f"{Colors.GREEN}✓ ALL TESTS PASSED{Colors.END}")
        print(f"{Colors.GREEN}✓ Named periods (7d/30d/90d/1y) work with correct group_by{Colors.END}")
        print(f"{Colors.GREEN}✓ Custom date range works with period='custom'{Colors.END}")
        print(f"{Colors.GREEN}✓ Custom span → groupBy logic works (day/week/month){Colors.END}")
        print(f"{Colors.GREEN}✓ endDate upper bound is enforced{Colors.END}")
        print(f"{Colors.GREEN}✓ Edge cases fallback correctly (no 500 errors){Colors.END}")
        print(f"{Colors.GREEN}✓ Dashboard stats endpoint still works{Colors.END}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}✗ SOME TESTS FAILED{Colors.END}")
        print(f"{Colors.YELLOW}Total: {passed}/{total} tests passed{Colors.END}")
        print(f"{Colors.CYAN}{'='*100}{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
