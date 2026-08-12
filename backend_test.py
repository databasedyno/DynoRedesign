#!/usr/bin/env python3
"""
DynoPay Backend API Testing - Lockfile Sync & Deployment Fix Verification
Tests for: https://payment-hub-709.preview.emergentagent.com
STRICT READ-ONLY on LIVE production database
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL for the preview environment
BASE_URL = "https://payment-hub-709.preview.emergentagent.com"
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

class DynoPayTester:
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
        """Perform 2-step login"""
        print_test("Performing 2-step login...")
        
        # Step 1: Check email
        try:
            headers = {}
            if self.csrf_token:
                headers['x-csrf-token'] = self.csrf_token
            
            response = self.session.post(
                f"{API_BASE}/user/checkEmail",
                json={"email": TEST_EMAIL},
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Email check failed: {response.status_code}")
                return False
            
            print_info(f"Email check passed for {TEST_EMAIL}")
            
        except Exception as e:
            print_fail(f"Exception during email check: {e}")
            return False

        # Step 2: Login with password
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
                self.access_token = data.get('accessToken')
                if self.access_token:
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.access_token}'
                    })
                    print_pass(f"Login successful, token: {self.access_token[:20]}...")
                    return True
                else:
                    print_fail("No access token in response")
                    return False
            else:
                print_fail(f"Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print_fail(f"Exception during login: {e}")
            return False

    def test_dashboard(self) -> Dict[str, Any]:
        """TEST 2a: GET /api/dashboard/?company_id=1"""
        print_test(f"Testing GET /api/dashboard/?company_id={self.company_id}")
        self.test_results["total"] += 1
        
        try:
            response = self.session.get(
                f"{API_BASE}/dashboard/",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Dashboard returned {response.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response.status_code}
            
            data = response.json()
            
            # Extract key metrics
            total_volume = data.get('total_volume', {})
            total_transactions = data.get('total_transactions', {})
            pending = data.get('pending_count') or data.get('pending', {}).get('count', 0)
            
            amount = total_volume.get('amount', 0)
            count = total_transactions.get('count', 0)
            
            print_pass("Dashboard API returned 200 OK")
            print_data("Total Volume Amount", f"${amount:,.2f}")
            print_data("Total Transactions Count", count)
            print_data("Pending Count", pending)
            
            # Expected values from the review request
            expected_volume = 23883.21
            expected_count = 377
            expected_pending = 178
            
            # Validate
            volume_match = abs(amount - expected_volume) < 1.0
            count_match = abs(count - expected_count) < 10
            pending_match = abs(pending - expected_pending) < 10
            
            if volume_match and count_match:
                print_pass(f"Dashboard metrics match expected values (volume ≈ ${expected_volume:,.2f}, count ≈ {expected_count})")
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "code": 200,
                    "total_volume": amount,
                    "total_count": count,
                    "pending_count": pending
                }
            else:
                print_fail(f"Dashboard metrics don't match expected (expected volume ≈ ${expected_volume:,.2f}, count ≈ {expected_count})")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "code": 200,
                    "total_volume": amount,
                    "total_count": count,
                    "pending_count": pending,
                    "reason": "Metrics mismatch"
                }
                
        except Exception as e:
            print_fail(f"Exception testing dashboard: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_dashboard_chart(self) -> Dict[str, Any]:
        """TEST 2b: GET /api/dashboard/chart?company_id=1&period=1y"""
        print_test(f"Testing GET /api/dashboard/chart?company_id={self.company_id}&period=1y")
        self.test_results["total"] += 1
        
        try:
            response = self.session.get(
                f"{API_BASE}/dashboard/chart",
                params={"company_id": self.company_id, "period": "1y"},
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Dashboard chart returned {response.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response.status_code}
            
            data = response.json()
            
            # Check for chart series data (this is the recharts data source)
            has_series = False
            chart_data = None
            
            if 'chartData' in data or 'series' in data or 'data' in data:
                has_series = True
                chart_data = data.get('chartData') or data.get('series') or data.get('data')
            
            # Check for period_summary or summary
            summary = data.get('period_summary') or data.get('chartSummary') or data.get('summary', {})
            
            print_pass("Dashboard chart API returned 200 OK")
            print_data("Has chart series data", has_series)
            
            if summary:
                total_volume = summary.get('total_volume', {})
                if isinstance(total_volume, dict):
                    amount = total_volume.get('amount', 0)
                else:
                    amount = total_volume
                print_data("Chart summary total_volume", f"${amount:,.2f}" if amount else "N/A")
            
            if has_series:
                print_pass("Chart contains series data (recharts data source)")
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "code": 200,
                    "has_series": True,
                    "summary": summary
                }
            else:
                print_fail("Chart missing series data")
                self.test_results["failed"] += 1
                return {
                    "status": "FAIL",
                    "code": 200,
                    "has_series": False,
                    "reason": "No chart series data"
                }
                
        except Exception as e:
            print_fail(f"Exception testing dashboard chart: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_wallet(self, dashboard_volume: float) -> Dict[str, Any]:
        """TEST 2c: GET /api/wallet/getWallet?company_id=1"""
        print_test(f"Testing GET /api/wallet/getWallet?company_id={self.company_id}")
        self.test_results["total"] += 1
        
        try:
            response = self.session.get(
                f"{API_BASE}/wallet/getWallet",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Wallet returned {response.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response.status_code}
            
            data = response.json()
            
            # Calculate sum of amount_in_usd across all wallets
            wallets = data if isinstance(data, list) else data.get('wallets', [])
            total_usd = sum(w.get('amount_in_usd', 0) for w in wallets)
            
            print_pass("Wallet API returned 200 OK")
            print_data("Total wallet amount_in_usd", f"${total_usd:,.2f}")
            print_data("Number of wallets", len(wallets))
            
            # Show non-zero wallets
            non_zero = [w for w in wallets if w.get('amount_in_usd', 0) > 0]
            if non_zero:
                print_info(f"Non-zero wallets ({len(non_zero)}):")
                for w in non_zero:
                    currency = w.get('currency') or w.get('symbol', 'UNKNOWN')
                    amount = w.get('amount_in_usd', 0)
                    print(f"    {currency}: ${amount:,.2f}")
            
            # Compare with dashboard volume
            if dashboard_volume:
                diff = abs(total_usd - dashboard_volume)
                tolerance = 0.01
                
                print_data("Dashboard total_volume", f"${dashboard_volume:,.2f}")
                print_data("Wallet total", f"${total_usd:,.2f}")
                print_data("Difference", f"${diff:,.2f}")
                
                if diff <= tolerance:
                    print_pass(f"Wallet total EXACTLY matches dashboard (diff ${diff:.2f} <= ${tolerance:.2f})")
                    self.test_results["passed"] += 1
                    return {
                        "status": "PASS",
                        "code": 200,
                        "wallet_total": total_usd,
                        "dashboard_total": dashboard_volume,
                        "difference": diff
                    }
                else:
                    print_fail(f"Wallet total doesn't match dashboard (diff ${diff:.2f} > ${tolerance:.2f})")
                    self.test_results["failed"] += 1
                    return {
                        "status": "FAIL",
                        "code": 200,
                        "wallet_total": total_usd,
                        "dashboard_total": dashboard_volume,
                        "difference": diff,
                        "reason": "Wallet/Dashboard mismatch"
                    }
            else:
                print_pass("Wallet API working (no dashboard comparison)")
                self.test_results["passed"] += 1
                return {
                    "status": "PASS",
                    "code": 200,
                    "wallet_total": total_usd
                }
                
        except Exception as e:
            print_fail(f"Exception testing wallet: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_fee_tiers(self) -> Dict[str, Any]:
        """TEST 2d: GET /api/dashboard/fee-tiers?company_id=1"""
        print_test(f"Testing GET /api/dashboard/fee-tiers?company_id={self.company_id}")
        self.test_results["total"] += 1
        
        try:
            response = self.session.get(
                f"{API_BASE}/dashboard/fee-tiers",
                params={"company_id": self.company_id},
                timeout=10
            )
            
            if response.status_code != 200:
                print_fail(f"Fee tiers returned {response.status_code}")
                self.test_results["failed"] += 1
                return {"status": "FAIL", "code": response.status_code}
            
            data = response.json()
            
            print_pass("Fee tiers API returned 200 OK")
            
            # Extract tier info
            if isinstance(data, dict):
                print_data("Response keys", list(data.keys()))
            
            self.test_results["passed"] += 1
            return {
                "status": "PASS",
                "code": 200,
                "data": data
            }
                
        except Exception as e:
            print_fail(f"Exception testing fee tiers: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def test_health(self) -> Dict[str, Any]:
        """TEST 3: Check backend health endpoint"""
        print_test("Testing backend health endpoint")
        self.test_results["total"] += 1
        
        try:
            # Try common health endpoint paths
            health_paths = ["/api/health", "/health", "/api/status"]
            
            for path in health_paths:
                try:
                    response = self.session.get(f"{BASE_URL}{path}", timeout=5)
                    if response.status_code == 200:
                        data = response.json()
                        print_pass(f"Health endpoint found at {path}")
                        print_data("Health data", json.dumps(data, indent=2))
                        
                        # Check for database, redis, tatum status
                        db_status = data.get('database') or data.get('db')
                        redis_status = data.get('redis')
                        tatum_status = data.get('tatum') or data.get('tatum_api')
                        
                        if db_status:
                            print_data("Database status", db_status)
                        if redis_status:
                            print_data("Redis status", redis_status)
                        if tatum_status:
                            print_data("Tatum status", tatum_status)
                        
                        self.test_results["passed"] += 1
                        return {
                            "status": "PASS",
                            "code": 200,
                            "path": path,
                            "data": data
                        }
                except Exception:
                    continue
            
            print_fail("No health endpoint found")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "reason": "No health endpoint found"}
                
        except Exception as e:
            print_fail(f"Exception testing health: {e}")
            self.test_results["failed"] += 1
            return {"status": "FAIL", "error": str(e)}

    def check_backend_logs(self) -> Dict[str, Any]:
        """TEST 3: Check backend logs for errors"""
        print_test("Checking backend logs for errors")
        
        try:
            import subprocess
            
            # Check backend error logs
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            err_log = result.stdout
            
            # Look for critical errors (excluding expected ones)
            critical_errors = []
            
            lines = err_log.split('\n')
            for line in lines:
                line_lower = line.lower()
                # Skip expected errors
                if 'binancews' in line_lower and '451' in line:
                    continue
                if 'unexpected server response: 451' in line_lower:
                    continue
                
                # Look for actual errors
                if any(keyword in line_lower for keyword in ['error', 'exception', 'failed', 'crash']):
                    if any(keyword in line_lower for keyword in ['database', 'redis', 'auth', '500']):
                        critical_errors.append(line)
            
            if critical_errors:
                print_fail(f"Found {len(critical_errors)} critical errors in logs")
                for err in critical_errors[:5]:  # Show first 5
                    print(f"  {err}")
                return {
                    "status": "FAIL",
                    "critical_errors": len(critical_errors),
                    "samples": critical_errors[:5]
                }
            else:
                print_pass("No critical errors found in backend logs")
                
                # Check for expected Binance 451 and Tatum fallback
                has_binance_451 = any('451' in line and 'binance' in line.lower() for line in lines)
                has_tatum_refresh = any('refreshed' in line.lower() and 'tatum' in line.lower() for line in lines)
                
                if has_binance_451:
                    print_info("✓ Expected Binance 451 error found (geo-blocked, harmless)")
                if has_tatum_refresh:
                    print_info("✓ Tatum rate refresh working (fallback active)")
                
                return {
                    "status": "PASS",
                    "critical_errors": 0,
                    "binance_451": has_binance_451,
                    "tatum_fallback": has_tatum_refresh
                }
                
        except Exception as e:
            print_fail(f"Exception checking logs: {e}")
            return {"status": "FAIL", "error": str(e)}

    def check_safe_mode(self) -> Dict[str, Any]:
        """TEST 4: Verify SAFE MODE is active"""
        print_test("Verifying SAFE MODE (background jobs disabled)")
        
        try:
            import subprocess
            
            # Check backend logs for safe mode indicators
            result = subprocess.run(
                ["tail", "-n", "200", "/var/log/supervisor/backend.out.log"],
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
                if 'skipping bullmq webhook worker' in line_lower and 'secondary' in line_lower:
                    safe_mode_indicators.append("BullMQ webhook worker skipped (secondary instance)")
                if 'worker_role=secondary' in line_lower or 'worker_role: secondary' in line_lower:
                    safe_mode_indicators.append("WORKER_ROLE=secondary detected")
                if 'background_jobs' in line_lower and ('false' in line_lower or 'disabled' in line_lower or 'eligible=false' in line_lower):
                    safe_mode_indicators.append("Background jobs disabled")
                if 'enable_background_jobs=false' in line_lower or 'enable_background_jobs: false' in line_lower:
                    safe_mode_indicators.append("ENABLE_BACKGROUND_JOBS=false detected")
                
                # Unsafe indicators (should NOT be present)
                if 'worker_role=primary' in line_lower or 'worker_role: primary' in line_lower:
                    unsafe_indicators.append("⚠️ WORKER_ROLE=primary detected!")
                if 'background_jobs' in line_lower and ('true' in line_lower or 'enabled' in line_lower or 'eligible=true' in line_lower):
                    if 'false' not in line_lower and 'disabled' not in line_lower:
                        unsafe_indicators.append("⚠️ Background jobs enabled!")
                if 'starting bullmq webhook worker' in line_lower:
                    unsafe_indicators.append("⚠️ BullMQ webhook worker started!")
            
            if unsafe_indicators:
                print_fail("CRITICAL: SAFE MODE NOT ACTIVE!")
                for indicator in unsafe_indicators:
                    print(f"  {Colors.RED}{indicator}{Colors.RESET}")
                return {
                    "status": "CRITICAL_FAIL",
                    "safe_mode": False,
                    "unsafe_indicators": unsafe_indicators
                }
            elif safe_mode_indicators:
                print_pass("SAFE MODE is active (background jobs disabled)")
                for indicator in safe_mode_indicators:
                    print_info(f"  ✓ {indicator}")
                return {
                    "status": "PASS",
                    "safe_mode": True,
                    "indicators": safe_mode_indicators
                }
            else:
                print_fail("Could not verify SAFE MODE status from logs")
                return {
                    "status": "UNKNOWN",
                    "safe_mode": None,
                    "reason": "No safe mode indicators found in logs"
                }
                
        except Exception as e:
            print_fail(f"Exception checking safe mode: {e}")
            return {"status": "FAIL", "error": str(e)}

    def run_all_tests(self):
        """Run all tests in sequence"""
        print_header("DynoPay Backend API Testing - Deployment Fix Verification")
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
        
        print_header("TEST 2: API Regression Tests (No regression from updated lockfiles)")
        
        # Test dashboard
        dashboard_result = self.test_dashboard()
        results['dashboard'] = dashboard_result
        dashboard_volume = dashboard_result.get('total_volume', 0)
        
        # Test dashboard chart
        chart_result = self.test_dashboard_chart()
        results['chart'] = chart_result
        
        # Test wallet
        wallet_result = self.test_wallet(dashboard_volume)
        results['wallet'] = wallet_result
        
        # Test fee tiers
        fee_tiers_result = self.test_fee_tiers()
        results['fee_tiers'] = fee_tiers_result
        
        print_header("TEST 3: Environment Setup Sanity")
        
        # Test health
        health_result = self.test_health()
        results['health'] = health_result
        
        # Check logs
        logs_result = self.check_backend_logs()
        results['logs'] = logs_result
        
        print_header("TEST 4: SAFE MODE Verification")
        
        # Check safe mode
        safe_mode_result = self.check_safe_mode()
        results['safe_mode'] = safe_mode_result
        
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
    tester = DynoPayTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    if tester.test_results["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
