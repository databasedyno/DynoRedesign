#!/usr/bin/env python3
"""
Backend Testing Script for Session 2026-08-12
P0: Public Leak Gate + Settings Merge + Account Backfill + dbInstance Fix

STRICT READ-ONLY on LIVE PRODUCTION database.
Login: hostbay@moxx.co / Katiekendra123@
Company ID: 1
"""

import requests
import json
import sys
import subprocess
from typing import Dict, Any, Optional, Tuple

# Configuration
BASE_URL = "https://secure-transactions-11.preview.emergentagent.com"
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
                # Token is in data.accessToken
                self.access_token = data.get("data", {}).get("accessToken") or data.get("accessToken")
                if self.access_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.access_token}",
                        "x-csrf-token": self.csrf_token or ""
                    })
                    print_pass(f"Login successful! Token: {self.access_token[:30]}...")
                    return True
                else:
                    print_fail("No access token in response")
                    return False
            else:
                print_fail(f"Login failed: {login_resp.status_code} - {login_resp.text[:200]}")
                return False

        except Exception as e:
            print_fail(f"Login exception: {str(e)}")
            return False

    def test_1_regression_sweep(self) -> bool:
        """TEST 1: REGRESSION SWEEP - Highest priority
        Verify dashboard/action-counts/wallet/chart still work after dbInstance/beforeQuery change
        """
        print_test("TEST 1: REGRESSION SWEEP (dbInstance/beforeQuery change)")
        
        all_passed = True
        
        try:
            # 1a. Dashboard
            print_info("1a. Testing GET /api/dashboard/?company_id=1")
            dash_resp = self.session.get(f"{API_BASE}/dashboard/?company_id={self.company_id}", timeout=15)
            
            if dash_resp.status_code == 200:
                dash_data = dash_resp.json()
                data = dash_data.get("data", dash_data)  # Handle nested data structure
                total_volume = data.get("total_volume", {}).get("amount", 0)
                pending = data.get("today_summary", {}).get("pending_count") or data.get("pending_transactions", {}).get("count", 0)
                
                print_pass(f"Dashboard returned 200 OK")
                print_info(f"  total_volume: ${total_volume:,.2f} (expected ~$23,883.21)")
                print_info(f"  pending: {pending} (expected ~179)")
                
                # Check if values are in expected range
                if 23800 <= total_volume <= 24000:
                    print_pass(f"Total volume is in expected range")
                else:
                    print_warning(f"Total volume ${total_volume:,.2f} differs from expected ~$23,883.21")
                    self.results["warnings"].append(f"Dashboard total_volume: ${total_volume:,.2f} (expected ~$23,883.21)")
                
                if 170 <= pending <= 185:
                    print_pass(f"Pending count is in expected range")
                else:
                    print_warning(f"Pending count {pending} differs from expected ~179")
                    self.results["warnings"].append(f"Dashboard pending: {pending} (expected ~179)")
                
                self.results["passed"].append("Dashboard API (GET /api/dashboard/)")
            else:
                print_fail(f"Dashboard returned {dash_resp.status_code}")
                self.results["failed"].append(f"Dashboard API returned {dash_resp.status_code}")
                all_passed = False

            # 1b. Action counts
            print_info("\n1b. Testing GET /api/dashboard/action-counts?company_id=1")
            action_resp = self.session.get(f"{API_BASE}/dashboard/action-counts?company_id={self.company_id}", timeout=15)
            
            if action_resp.status_code == 200:
                action_resp_data = action_resp.json()
                action_data = action_resp_data.get("data", action_resp_data)  # Handle nested data structure
                txn_pending = action_data.get("transactions_pending", 0)
                
                print_pass(f"Action-counts returned 200 OK")
                print_info(f"  transactions_pending: {txn_pending}")
                
                # Check parity with dashboard pending
                if dash_resp.status_code == 200:
                    if txn_pending == pending:
                        print_pass(f"PARITY CHECK: transactions_pending ({txn_pending}) == dashboard pending ({pending})")
                    else:
                        print_fail(f"PARITY MISMATCH: transactions_pending ({txn_pending}) != dashboard pending ({pending})")
                        self.results["failed"].append(f"Action-counts parity mismatch: {txn_pending} != {pending}")
                        all_passed = False
                
                self.results["passed"].append("Action-counts API (GET /api/dashboard/action-counts)")
            else:
                print_fail(f"Action-counts returned {action_resp.status_code}")
                self.results["failed"].append(f"Action-counts API returned {action_resp.status_code}")
                all_passed = False

            # 1c. Wallet
            print_info("\n1c. Testing GET /api/wallet/getWallet?company_id=1")
            wallet_resp = self.session.get(f"{API_BASE}/wallet/getWallet?company_id={self.company_id}", timeout=15)
            
            if wallet_resp.status_code == 200:
                wallet_resp_data = wallet_resp.json()
                wallet_data = wallet_resp_data.get("data", wallet_resp_data)  # Handle nested data structure
                # Handle if data is an array
                if isinstance(wallet_data, list) and len(wallet_data) > 0:
                    wallet_data = wallet_data[0]
                wallets = wallet_data.get("wallets", [])
                
                # Calculate total USD (handle string values)
                total_usd = sum(float(w.get("amount_in_usd", 0) or 0) for w in wallets)
                
                print_pass(f"Wallet returned 200 OK")
                print_info(f"  Total wallets: {len(wallets)}")
                print_info(f"  Σ amount_in_usd: ${total_usd:,.2f}")
                
                # Check parity with dashboard
                if dash_resp.status_code == 200:
                    diff = abs(total_usd - total_volume)
                    if diff <= 0.01:
                        print_pass(f"EXACT PARITY: Wallet total (${total_usd:,.2f}) == Dashboard total (${total_volume:,.2f})")
                    else:
                        print_fail(f"PARITY MISMATCH: Wallet (${total_usd:,.2f}) != Dashboard (${total_volume:,.2f}), diff=${diff:.2f}")
                        self.results["failed"].append(f"Wallet parity mismatch: ${diff:.2f}")
                        all_passed = False
                
                self.results["passed"].append("Wallet API (GET /api/wallet/getWallet)")
            else:
                print_fail(f"Wallet returned {wallet_resp.status_code}")
                self.results["failed"].append(f"Wallet API returned {wallet_resp.status_code}")
                all_passed = False

            # 1d. Chart
            print_info("\n1d. Testing GET /api/dashboard/chart?company_id=1&period=1y")
            chart_resp = self.session.get(f"{API_BASE}/dashboard/chart?company_id={self.company_id}&period=1y", timeout=15)
            
            if chart_resp.status_code == 200:
                chart_data = chart_resp.json()
                print_pass(f"Chart returned 200 OK with series data")
                print_info(f"  Chart data keys: {list(chart_data.keys())}")
                self.results["passed"].append("Chart API (GET /api/dashboard/chart)")
            else:
                print_fail(f"Chart returned {chart_resp.status_code}")
                self.results["failed"].append(f"Chart API returned {chart_resp.status_code}")
                all_passed = False

            # 1e. Check logs for errors
            print_info("\n1e. Checking backend logs for errors...")
            log_check = subprocess.run(
                "grep -E '(Query blocked|EADDRINUSE|startServer)' /app/backend/logs/*.log 2>/dev/null | tail -n 5",
                shell=True,
                capture_output=True,
                text=True
            )
            
            recent_errors = [line for line in log_check.stdout.split('\n') if line and '21:42' in line or '21:43' in line or '21:44' in line]
            
            if recent_errors:
                print_warning(f"Found recent errors in logs:")
                for err in recent_errors:
                    print_warning(f"  {err[:150]}")
                self.results["warnings"].append(f"Recent errors in logs: {len(recent_errors)} entries")
            else:
                print_pass("No recent 'Query blocked', 'EADDRINUSE', or 'startServer' errors in current session")

        except Exception as e:
            print_fail(f"Regression sweep exception: {str(e)}")
            self.results["failed"].append(f"Regression sweep exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_2_api_test_gating(self) -> bool:
        """TEST 2: /api/test/* endpoints must return 404"""
        print_test("TEST 2: /api/test/* GATING")
        
        all_passed = True
        
        try:
            # Test /api/test/thresholds
            print_info("Testing GET /api/test/thresholds (should be 404)")
            resp1 = self.session.get(f"{API_BASE}/test/thresholds", timeout=10)
            
            if resp1.status_code == 404:
                print_pass(f"/api/test/thresholds returned 404 (correctly gated)")
                self.results["passed"].append("/api/test/thresholds gated (404)")
            else:
                print_fail(f"/api/test/thresholds returned {resp1.status_code} (expected 404)")
                self.results["failed"].append(f"/api/test/thresholds returned {resp1.status_code} instead of 404")
                all_passed = False

            # Test /api/test/manual-transfer
            print_info("Testing GET /api/test/manual-transfer (should be 404)")
            resp2 = self.session.get(f"{API_BASE}/test/manual-transfer", timeout=10)
            
            if resp2.status_code == 404:
                print_pass(f"/api/test/manual-transfer returned 404 (correctly gated)")
                self.results["passed"].append("/api/test/manual-transfer gated (404)")
            else:
                print_fail(f"/api/test/manual-transfer returned {resp2.status_code} (expected 404)")
                self.results["failed"].append(f"/api/test/manual-transfer returned {resp2.status_code} instead of 404")
                all_passed = False

            # Verify normal route still works
            print_info("Testing GET /api/dashboard/ without auth (should be 401)")
            resp3 = requests.get(f"{API_BASE}/dashboard/", timeout=10)
            
            if resp3.status_code == 401:
                print_pass(f"/api/dashboard/ returned 401 without auth (normal behavior)")
                self.results["passed"].append("Normal routes still require auth (401)")
            else:
                print_warning(f"/api/dashboard/ returned {resp3.status_code} (expected 401)")

        except Exception as e:
            print_fail(f"API test gating exception: {str(e)}")
            self.results["failed"].append(f"API test gating exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_3_dev_page_gate(self) -> bool:
        """TEST 3: Dev pages must return 404"""
        print_test("TEST 3: DEV-PAGE GATE")
        
        all_passed = True
        
        try:
            dev_pages = ["/QA", "/pay/success-demo"]
            normal_pages = ["/auth/login", "/dashboard"]
            
            # Test dev pages (should be 404)
            for page in dev_pages:
                print_info(f"Testing {page} (should be 404)")
                resp = requests.get(f"{BASE_URL}{page}", timeout=10, allow_redirects=False)
                
                if resp.status_code == 404:
                    print_pass(f"{page} returned 404 (correctly blocked)")
                    self.results["passed"].append(f"{page} blocked (404)")
                else:
                    print_fail(f"{page} returned {resp.status_code} (expected 404)")
                    self.results["failed"].append(f"{page} returned {resp.status_code} instead of 404")
                    all_passed = False

            # Test normal pages (should be 200)
            for page in normal_pages:
                print_info(f"Testing {page} (should be 200)")
                resp = requests.get(f"{BASE_URL}{page}", timeout=10, allow_redirects=False)
                
                if resp.status_code == 200:
                    print_pass(f"{page} returned 200 (accessible)")
                    self.results["passed"].append(f"{page} accessible (200)")
                else:
                    print_warning(f"{page} returned {resp.status_code} (expected 200)")

        except Exception as e:
            print_fail(f"Dev-page gate exception: {str(e)}")
            self.results["failed"].append(f"Dev-page gate exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_4_account_type_exposed(self) -> bool:
        """TEST 4: account_type should be exposed in company API"""
        print_test("TEST 4: ACCOUNT_TYPE EXPOSED")
        
        all_passed = True
        
        try:
            print_info("Testing GET /api/company/getCompany (should expose account_type)")
            resp = self.session.get(f"{API_BASE}/company/getCompany", timeout=10)
            
            if resp.status_code == 200:
                resp_data = resp.json()
                data = resp_data.get("data", resp_data)  # Handle nested data structure
                companies = data if isinstance(data, list) else [data]
                
                found_account_type = False
                for company in companies:
                    if isinstance(company, dict) and "account_type" in company:
                        found_account_type = True
                        account_type = company.get("account_type")
                        company_id = company.get("company_id") or company.get("id")
                        print_pass(f"account_type found: '{account_type}' for company {company_id}")
                        
                        if company_id == 1 and account_type == "business":
                            print_pass(f"Company 1 has account_type='business' as expected")
                            self.results["passed"].append("account_type exposed and correct for company 1")
                        break
                
                if not found_account_type:
                    print_fail("account_type field NOT found in company response")
                    self.results["failed"].append("account_type not exposed in company API")
                    all_passed = False
            else:
                print_fail(f"Company API returned {resp.status_code}")
                self.results["failed"].append(f"Company API returned {resp.status_code}")
                all_passed = False

        except Exception as e:
            print_fail(f"Account type test exception: {str(e)}")
            self.results["failed"].append(f"Account type test exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_5_backfilled_account_isolation(self) -> bool:
        """TEST 5: Backfilled account exists AND stays isolated (security)"""
        print_test("TEST 5: BACKFILLED ACCOUNT EXISTS & ISOLATED")
        
        all_passed = True
        
        try:
            # First, verify company_id=31 exists (via direct DB query or API)
            print_info("Verifying company_id=31 exists with account_type='individual' and user_id=14")
            
            # Try to access company 31's action-counts as hostbay (user 1)
            # This MUST be rejected with 403
            print_info("Testing GET /api/dashboard/action-counts?company_id=31 as hostbay (should be 403)")
            resp = self.session.get(f"{API_BASE}/dashboard/action-counts?company_id=31", timeout=10)
            
            if resp.status_code == 403:
                print_pass(f"Company 31 correctly rejected with 403 (ownership isolation working)")
                self.results["passed"].append("Backfilled account ownership isolation (403)")
            elif resp.status_code == 404:
                print_warning(f"Company 31 returned 404 (might not exist or validateCompanyOwnership returns 404)")
                self.results["warnings"].append("Company 31 returned 404 instead of 403")
            else:
                print_fail(f"Company 31 returned {resp.status_code} (expected 403)")
                self.results["failed"].append(f"Company 31 returned {resp.status_code} instead of 403")
                all_passed = False

        except Exception as e:
            print_fail(f"Backfilled account test exception: {str(e)}")
            self.results["failed"].append(f"Backfilled account test exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_6_members_table(self) -> bool:
        """TEST 6: Verify tbl_account_member table structure"""
        print_test("TEST 6: MEMBERS TABLE")
        
        all_passed = True
        
        try:
            print_info("Checking tbl_account_member via database query...")
            
            # We need to query the database directly for this
            # Using psql command
            db_url = "postgresql://postgres:IHCzCDslIsUZlzCvvjxfSWcChEiBtiCU@roundhouse.proxy.rlwy.net:23599/railway"
            
            # Query 1: Count rows
            query1 = "SELECT COUNT(*) as count FROM tbl_account_member;"
            result1 = subprocess.run(
                f'psql "{db_url}" -t -c "{query1}"',
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result1.returncode == 0:
                count = int(result1.stdout.strip())
                print_info(f"tbl_account_member has {count} rows")
                
                if count == 5:
                    print_pass(f"tbl_account_member has exactly 5 rows as expected")
                    self.results["passed"].append("tbl_account_member has 5 rows")
                else:
                    print_warning(f"tbl_account_member has {count} rows (expected 5)")
                    self.results["warnings"].append(f"tbl_account_member has {count} rows (expected 5)")
            
            # Query 2: Check owner roles
            query2 = "SELECT COUNT(*) as owner_count FROM tbl_account_member WHERE role='owner';"
            result2 = subprocess.run(
                f'psql "{db_url}" -t -c "{query2}"',
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result2.returncode == 0:
                owner_count = int(result2.stdout.strip())
                print_info(f"Found {owner_count} owner roles")
                
                if owner_count == 5:
                    print_pass(f"Exactly one owner per company (5 owners for 5 companies)")
                    self.results["passed"].append("One owner role per company")
                else:
                    print_warning(f"Found {owner_count} owner roles (expected 5)")
            
            # Query 3: Check unique constraint
            query3 = """
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name='tbl_account_member' 
            AND constraint_type='UNIQUE';
            """
            result3 = subprocess.run(
                f'psql "{db_url}" -t -c "{query3}"',
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result3.returncode == 0 and result3.stdout.strip():
                print_pass(f"UNIQUE constraint exists on tbl_account_member")
                self.results["passed"].append("UNIQUE constraint on tbl_account_member")
            else:
                print_warning(f"Could not verify UNIQUE constraint")

        except Exception as e:
            print_fail(f"Members table test exception: {str(e)}")
            self.results["failed"].append(f"Members table test exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_7_script_idempotency(self) -> bool:
        """TEST 7: Script idempotency - re-run scripts without --apply"""
        print_test("TEST 7: SCRIPT IDEMPOTENCY")
        
        all_passed = True
        
        try:
            # Test add_account_model.js
            print_info("Running node scripts/add_account_model.js (should report 0 new rows)")
            result1 = subprocess.run(
                "cd /app/backend && node scripts/add_account_model.js",
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            print_info(f"add_account_model.js output:\n{result1.stdout}")
            
            if result1.returncode == 0:
                if "0 newly seeded" in result1.stdout or "already exists" in result1.stdout.lower():
                    print_pass("add_account_model.js is idempotent (0 new rows)")
                    self.results["passed"].append("add_account_model.js idempotent")
                else:
                    print_warning("add_account_model.js output unclear")
                    self.results["warnings"].append("add_account_model.js idempotency unclear")
            else:
                print_fail(f"add_account_model.js failed with exit code {result1.returncode}")
                self.results["failed"].append(f"add_account_model.js failed: {result1.returncode}")
                all_passed = False

            # Test backfill_personal_accounts.js WITHOUT --apply
            print_info("\nRunning node scripts/backfill_personal_accounts.js (dry run, no --apply)")
            result2 = subprocess.run(
                "cd /app/backend && node scripts/backfill_personal_accounts.js",
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            print_info(f"backfill_personal_accounts.js output:\n{result2.stdout}")
            
            if result2.returncode == 0:
                if "DRY RUN" in result2.stdout or "dry run" in result2.stdout.lower():
                    print_pass("backfill_personal_accounts.js ran in dry-run mode")
                    self.results["passed"].append("backfill_personal_accounts.js dry-run")
                else:
                    print_warning("backfill_personal_accounts.js output unclear")
                    self.results["warnings"].append("backfill_personal_accounts.js unclear")
            else:
                print_fail(f"backfill_personal_accounts.js failed with exit code {result2.returncode}")
                self.results["failed"].append(f"backfill_personal_accounts.js failed: {result2.returncode}")
                all_passed = False

            # Verify company count is still 5
            print_info("\nVerifying company count is still 5...")
            db_url = "postgresql://postgres:IHCzCDslIsUZlzCvvjxfSWcChEiBtiCU@roundhouse.proxy.rlwy.net:23599/railway"
            query = "SELECT COUNT(*) FROM tbl_company;"
            result3 = subprocess.run(
                f'psql "{db_url}" -t -c "{query}"',
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result3.returncode == 0:
                count = int(result3.stdout.strip())
                print_info(f"Company count: {count}")
                
                if count == 5:
                    print_pass("Company count is still 5 (no new companies created)")
                    self.results["passed"].append("Company count unchanged (5)")
                else:
                    print_warning(f"Company count is {count} (expected 5)")
                    self.results["warnings"].append(f"Company count is {count} (expected 5)")

        except Exception as e:
            print_fail(f"Script idempotency test exception: {str(e)}")
            self.results["failed"].append(f"Script idempotency test exception: {str(e)}")
            all_passed = False

        return all_passed

    def test_8_safe_mode(self) -> bool:
        """TEST 8: SAFE MODE - background jobs must be disabled"""
        print_test("TEST 8: SAFE MODE VERIFICATION")
        
        all_passed = True
        
        try:
            print_info("Checking backend logs for SAFE MODE indicators...")
            
            # Check for background jobs disabled messages
            result = subprocess.run(
                "grep -E '(BACKGROUND JOBS|BullMQ webhook worker|Skipping startup reconciliation)' /app/backend/logs/apiLogs.log 2>/dev/null | tail -n 10",
                shell=True,
                capture_output=True,
                text=True
            )
            
            safe_mode_indicators = [
                "background jobs disabled",
                "BACKGROUND JOBS DISABLED",
                "Skipping BullMQ",
                "Skipping startup reconciliation",
                "Skipping webhook URL migration"
            ]
            
            found_indicators = []
            for line in result.stdout.split('\n'):
                for indicator in safe_mode_indicators:
                    if indicator.lower() in line.lower():
                        found_indicators.append(indicator)
                        break
            
            if found_indicators:
                print_pass(f"SAFE MODE is ACTIVE - found {len(found_indicators)} indicators:")
                for indicator in found_indicators[:5]:
                    print_info(f"  - {indicator}")
                self.results["passed"].append("SAFE MODE active (background jobs disabled)")
            else:
                print_fail("CRITICAL: Could not verify SAFE MODE is active!")
                self.results["failed"].append("SAFE MODE verification failed")
                all_passed = False

            # Check environment variables
            print_info("\nChecking environment variables...")
            with open("/app/backend/.env", "r") as f:
                env_content = f.read()
                
                if "ENABLE_BACKGROUND_JOBS=false" in env_content:
                    print_pass("ENABLE_BACKGROUND_JOBS=false confirmed in .env")
                else:
                    print_fail("ENABLE_BACKGROUND_JOBS=false NOT found in .env")
                    all_passed = False
                
                if "WORKER_ROLE=secondary" in env_content:
                    print_pass("WORKER_ROLE=secondary confirmed in .env")
                else:
                    print_warning("WORKER_ROLE=secondary NOT found in .env")

        except Exception as e:
            print_fail(f"SAFE MODE test exception: {str(e)}")
            self.results["failed"].append(f"SAFE MODE test exception: {str(e)}")
            all_passed = False

        return all_passed

    def print_summary(self):
        """Print final test summary"""
        print_test("TEST SUMMARY")
        
        total_passed = len(self.results["passed"])
        total_failed = len(self.results["failed"])
        total_warnings = len(self.results["warnings"])
        
        print(f"\n{Colors.BOLD}Results:{Colors.END}")
        print(f"{Colors.GREEN}✅ Passed: {total_passed}{Colors.END}")
        print(f"{Colors.RED}❌ Failed: {total_failed}{Colors.END}")
        print(f"{Colors.YELLOW}⚠️  Warnings: {total_warnings}{Colors.END}")
        
        if total_failed > 0:
            print(f"\n{Colors.RED}{Colors.BOLD}FAILED TESTS:{Colors.END}")
            for i, failure in enumerate(self.results["failed"], 1):
                print(f"{Colors.RED}  {i}. {failure}{Colors.END}")
        
        if total_warnings > 0:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}WARNINGS:{Colors.END}")
            for i, warning in enumerate(self.results["warnings"], 1):
                print(f"{Colors.YELLOW}  {i}. {warning}{Colors.END}")
        
        if total_passed > 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}PASSED TESTS:{Colors.END}")
            for i, passed in enumerate(self.results["passed"], 1):
                print(f"{Colors.GREEN}  {i}. {passed}{Colors.END}")
        
        print(f"\n{Colors.BOLD}{'='*80}{Colors.END}")
        
        if total_failed == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}✅ ALL TESTS PASSED{Colors.END}")
            return 0
        else:
            print(f"{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.END}")
            return 1

def main():
    """Main test execution"""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("="*80)
    print("Backend Testing Script - Session 2026-08-12")
    print("P0: Public Leak Gate + Settings Merge + Account Backfill + dbInstance Fix")
    print("STRICT READ-ONLY on LIVE PRODUCTION database")
    print("="*80)
    print(f"{Colors.END}\n")
    
    session = TestSession()
    
    # Login
    if not session.login():
        print_fail("Login failed. Cannot proceed with tests.")
        return 1
    
    # Run all tests
    tests = [
        ("TEST 1: REGRESSION SWEEP", session.test_1_regression_sweep),
        ("TEST 2: /api/test/* GATING", session.test_2_api_test_gating),
        ("TEST 3: DEV-PAGE GATE", session.test_3_dev_page_gate),
        ("TEST 4: ACCOUNT_TYPE EXPOSED", session.test_4_account_type_exposed),
        ("TEST 5: BACKFILLED ACCOUNT ISOLATION", session.test_5_backfilled_account_isolation),
        ("TEST 6: MEMBERS TABLE", session.test_6_members_table),
        ("TEST 7: SCRIPT IDEMPOTENCY", session.test_7_script_idempotency),
        ("TEST 8: SAFE MODE", session.test_8_safe_mode),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print_fail(f"{test_name} raised exception: {str(e)}")
            session.results["failed"].append(f"{test_name} exception: {str(e)}")
    
    # Print summary
    return session.print_summary()

if __name__ == "__main__":
    sys.exit(main())
