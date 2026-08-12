#!/usr/bin/env python3
"""
DynoPay Consistency Fixes Verification (a+b+c)
STRICT READ-ONLY testing on LIVE PRODUCTION database
Tests: settled-basis for counts + fee-tier endpoint + unified status set
"""

import requests
import json
from typing import Dict, Any, Optional

# Use internal URL since we're testing from within the container
# The backend proxy is on port 8001, which routes to the Node backend on 3300
BASE_URL = "http://localhost:8001"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"
COMPANY_ID = 1

class DynoPayTester:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token = None
        self.access_token = None
        self.results = {
            "test_a_dashboard": {},
            "test_b_wallet": {},
            "test_c_fee_tiers": {},
            "test_d_status_codes": {},
            "reconciliation": {},
            "critical_checks": {}
        }
    
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        prefix = "✅" if level == "PASS" else "❌" if level == "FAIL" else "ℹ️"
        print(f"{prefix} {message}")
    
    def step_1_get_csrf_token(self) -> bool:
        """Step 1: GET /api/csrf-token"""
        try:
            self.log("STEP 1: Getting CSRF token...")
            response = self.session.get(f"{BASE_URL}/api/csrf-token", timeout=30)
            
            if response.status_code != 200:
                self.log(f"CSRF token request failed: {response.status_code}", "FAIL")
                return False
            
            data = response.json()
            self.csrf_token = data.get("csrf_token") or data.get("csrfToken")
            
            if not self.csrf_token:
                self.log(f"No CSRF token in response: {data}", "FAIL")
                return False
            
            self.log(f"CSRF token obtained: {self.csrf_token[:20]}...")
            return True
            
        except Exception as e:
            self.log(f"CSRF token error: {str(e)}", "FAIL")
            return False
    
    def step_2_check_email(self) -> bool:
        """Step 2: POST /api/user/checkEmail (CSRF exempt)"""
        try:
            self.log("STEP 2: Checking email...")
            headers = {
                "Content-Type": "application/json"
            }
            payload = {"email": EMAIL}
            
            response = self.session.post(
                f"{BASE_URL}/api/user/checkEmail",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                self.log(f"checkEmail failed: {response.status_code} - {response.text}", "FAIL")
                return False
            
            data = response.json()
            self.log(f"Email check response: {data}")
            return True
            
        except Exception as e:
            self.log(f"checkEmail error: {str(e)}", "FAIL")
            return False
    
    def step_3_login(self) -> bool:
        """Step 3: POST /api/user/login (CSRF exempt)"""
        try:
            self.log("STEP 3: Logging in...")
            headers = {
                "Content-Type": "application/json"
            }
            payload = {
                "email": EMAIL,
                "password": PASSWORD
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/user/login",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                self.log(f"Login failed: {response.status_code} - {response.text}", "FAIL")
                return False
            
            data = response.json()
            # Access token can be at top level or nested in data
            self.access_token = (data.get("accessToken") or 
                               data.get("access_token") or
                               data.get("data", {}).get("accessToken") or
                               data.get("data", {}).get("access_token"))
            
            if not self.access_token:
                self.log(f"No access token in login response: {list(data.keys())}", "FAIL")
                return False
            
            self.log(f"Login successful, access token obtained: {self.access_token[:20]}...")
            return True
            
        except Exception as e:
            self.log(f"Login error: {str(e)}", "FAIL")
            return False
    
    def test_a_dashboard(self) -> bool:
        """TEST A: GET /api/dashboard/?company_id=1"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST A: Dashboard Total Volume & Transaction Counts")
            self.log("="*80)
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{BASE_URL}/api/dashboard/?company_id={COMPANY_ID}",
                headers=headers,
                timeout=30
            )
            
            self.results["test_d_status_codes"]["dashboard"] = response.status_code
            
            if response.status_code != 200:
                self.log(f"Dashboard request failed: {response.status_code} - {response.text}", "FAIL")
                return False
            
            resp_data = response.json()
            # Handle nested data field
            data = resp_data.get("data", resp_data)
            
            self.log(f"Dashboard response keys: {list(data.keys())}")
            
            # Extract total_volume
            total_volume = data.get("total_volume") or data.get("totalVolume")
            if total_volume:
                amount = total_volume.get("amount")
                currency = total_volume.get("currency")
                self.results["test_a_dashboard"]["total_volume_amount"] = amount
                self.results["test_a_dashboard"]["total_volume_currency"] = currency
                self.log(f"Total Volume: {amount} {currency}")
                
                # Check if it's the expected settled value (~$23,883.21)
                if amount and abs(float(amount) - 23883.21) < 100:
                    self.log(f"✅ Total volume is settled value (~$23,883.21): ${amount}", "PASS")
                    self.results["critical_checks"]["dashboard_settled_volume"] = True
                elif amount and abs(float(amount) - 26378.21) < 100:
                    self.log(f"❌ Total volume is OLD all-status value ($26,378.21): ${amount}", "FAIL")
                    self.results["critical_checks"]["dashboard_settled_volume"] = False
                else:
                    self.log(f"⚠️ Total volume is unexpected: ${amount}")
                    self.results["critical_checks"]["dashboard_settled_volume"] = None
            
            # Extract transaction counts
            total_transactions = data.get("total_transactions") or data.get("totalTransactions")
            if total_transactions:
                count = total_transactions.get("count")
                self.results["test_a_dashboard"]["total_transactions_count"] = count
                self.log(f"Total Transactions Count: {count}")
                
                # Check if it's the expected settled count (~377, NOT ~556)
                if count and 370 <= count <= 385:
                    self.log(f"✅ Transaction count is SETTLED (~377, excludes pending): {count}", "PASS")
                    self.results["critical_checks"]["counts_exclude_pending"] = True
                elif count and 550 <= count <= 560:
                    self.log(f"❌ Transaction count is OLD all-status (~556, includes pending): {count}", "FAIL")
                    self.results["critical_checks"]["counts_exclude_pending"] = False
                else:
                    self.log(f"⚠️ Transaction count is unexpected: {count}")
                    self.results["critical_checks"]["counts_exclude_pending"] = None
            
            # Look for pending count - check multiple possible locations
            pending_count = None
            
            # Check pending_transactions object
            pending_transactions = data.get("pending_transactions") or data.get("pendingTransactions")
            if pending_transactions:
                pending_count = pending_transactions.get("count")
            
            # Check today_summary
            if pending_count is None:
                today_summary = data.get("today_summary") or data.get("todaySummary")
                if today_summary:
                    pending_count = today_summary.get("pending_count") or today_summary.get("pendingCount")
            
            # Check top level
            if pending_count is None:
                pending_count = data.get("pending_count") or data.get("pendingCount") or data.get("pending")
            
            if pending_count is not None:
                self.results["test_a_dashboard"]["pending_count"] = pending_count
                self.log(f"Pending Count: {pending_count}")
                
                # Check if pending count is in expected range (~178-179)
                if 170 <= pending_count <= 185:
                    self.log(f"✅ Pending count is in expected range (~178-179): {pending_count}", "PASS")
                    self.results["critical_checks"]["pending_shown_separately"] = True
                else:
                    self.log(f"⚠️ Pending count outside expected range: {pending_count}")
                    self.results["critical_checks"]["pending_shown_separately"] = None
            else:
                self.log("⚠️ No pending count field found in dashboard response")
                self.results["critical_checks"]["pending_shown_separately"] = False
            
            # Store full response for debugging
            self.results["test_a_dashboard"]["full_response"] = resp_data
            
            return True
            
        except Exception as e:
            self.log(f"Dashboard test error: {str(e)}", "FAIL")
            return False
    
    def test_b_wallet(self) -> bool:
        """TEST B: GET /api/wallet/getWallet?company_id=1"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST B: Wallet Total (Sum of amount_in_usd)")
            self.log("="*80)
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{BASE_URL}/api/wallet/getWallet?company_id={COMPANY_ID}",
                headers=headers,
                timeout=30
            )
            
            self.results["test_d_status_codes"]["wallet"] = response.status_code
            
            if response.status_code != 200:
                self.log(f"Wallet request failed: {response.status_code} - {response.text}", "FAIL")
                return False
            
            resp_data = response.json()
            # Handle nested data field - data is an array of company wallet groups
            data_array = resp_data.get("data", [])
            
            # Calculate sum of amount_in_usd across all companies and wallets
            s_usd = 0.0
            wallet_details = []
            total_wallet_count = 0
            
            for company_group in data_array:
                wallets = company_group.get("wallets", [])
                total_wallet_count += len(wallets)
                
                for wallet in wallets:
                    # amount_in_usd can be a string or number
                    amount_in_usd = wallet.get("amount_in_usd") or wallet.get("amountInUsd") or wallet.get("amount_in_base_currency") or 0
                    if isinstance(amount_in_usd, str):
                        amount_in_usd = float(amount_in_usd) if amount_in_usd else 0
                    
                    currency = wallet.get("wallet_type") or wallet.get("currency") or wallet.get("crypto_currency") or "UNKNOWN"
                    
                    if amount_in_usd > 0:
                        wallet_details.append(f"{currency}: ${amount_in_usd:.2f}")
                        s_usd += float(amount_in_usd)
            
            self.results["test_b_wallet"]["s_usd"] = s_usd
            self.results["test_b_wallet"]["wallet_count"] = total_wallet_count
            self.results["test_b_wallet"]["non_zero_wallets"] = len(wallet_details)
            self.results["test_b_wallet"]["wallet_details"] = wallet_details
            
            self.log(f"Found {total_wallet_count} wallets across {len(data_array)} company group(s)")
            self.log(f"Wallet Total (S_usd): ${s_usd:.2f}")
            if wallet_details:
                self.log(f"Non-zero wallets ({len(wallet_details)}):")
                for detail in wallet_details:
                    self.log(f"  - {detail}")
            else:
                self.log("No non-zero wallets found")
            
            return True
            
        except Exception as e:
            self.log(f"Wallet test error: {str(e)}", "FAIL")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "FAIL")
            return False
    
    def test_c_fee_tiers(self) -> bool:
        """TEST C: GET /api/dashboard/fee-tiers?company_id=1"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST C: Fee Tiers Volume (Should be SETTLED)")
            self.log("="*80)
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(
                f"{BASE_URL}/api/dashboard/fee-tiers?company_id={COMPANY_ID}",
                headers=headers,
                timeout=30
            )
            
            self.results["test_d_status_codes"]["fee_tiers"] = response.status_code
            
            if response.status_code != 200:
                self.log(f"Fee tiers request failed: {response.status_code} - {response.text}", "FAIL")
                return False
            
            resp_data = response.json()
            # Handle nested data field
            data = resp_data.get("data", resp_data)
            
            self.log(f"Fee tiers response keys: {list(data.keys())}")
            
            # Look for volume fields in user_tier or at top level
            fee_tier_volume = None
            volume_field_name = None
            
            # Check user_tier first
            user_tier = data.get("user_tier") or data.get("userTier")
            if user_tier:
                volume_fields = [
                    "total_volume", "totalVolume", "cumulative_volume", "cumulativeVolume",
                    "current_volume", "currentVolume", "volume", "processed_volume"
                ]
                for field in volume_fields:
                    if field in user_tier:
                        fee_tier_volume = user_tier[field]
                        volume_field_name = f"user_tier.{field}"
                        break
            
            # If not found, check top level
            if fee_tier_volume is None:
                volume_fields = [
                    "total_volume", "totalVolume", "cumulative_volume", "cumulativeVolume",
                    "current_volume", "currentVolume", "volume", "processed_volume"
                ]
                for field in volume_fields:
                    if field in data:
                        fee_tier_volume = data[field]
                        volume_field_name = field
                        break
            
            # If volume is an object, extract amount
            if isinstance(fee_tier_volume, dict):
                fee_tier_volume = fee_tier_volume.get("amount") or fee_tier_volume.get("value")
            
            if fee_tier_volume is not None:
                self.results["test_c_fee_tiers"]["volume"] = fee_tier_volume
                self.results["test_c_fee_tiers"]["volume_field"] = volume_field_name
                self.log(f"Fee Tier Volume (field: {volume_field_name}): ${fee_tier_volume}")
                
                # Check if it's the expected settled value (~$23,883.21)
                if abs(float(fee_tier_volume) - 23883.21) < 100:
                    self.log(f"✅ Fee tier volume is SETTLED value (~$23,883.21): ${fee_tier_volume}", "PASS")
                    self.results["critical_checks"]["fee_tier_settled"] = True
                elif abs(float(fee_tier_volume) - 26378.21) < 100:
                    self.log(f"❌ Fee tier volume is OLD all-status value ($26,378.21): ${fee_tier_volume}", "FAIL")
                    self.results["critical_checks"]["fee_tier_settled"] = False
                else:
                    self.log(f"⚠️ Fee tier volume is unexpected: ${fee_tier_volume}")
                    self.results["critical_checks"]["fee_tier_settled"] = None
            else:
                self.log("⚠️ Could not find volume field in fee tiers response")
                self.results["critical_checks"]["fee_tier_settled"] = None
            
            # Extract current tier info
            current_tier = None
            if user_tier:
                current_tier = user_tier.get("current_tier") or user_tier.get("currentTier")
            if not current_tier:
                current_tier = data.get("current_tier") or data.get("currentTier")
            
            if current_tier:
                self.results["test_c_fee_tiers"]["current_tier"] = current_tier
                self.log(f"Current Tier: {current_tier}")
            
            # Extract next tier threshold
            next_tier_threshold = None
            if user_tier:
                next_tier_threshold = user_tier.get("amount_to_next_tier") or user_tier.get("amountToNextTier")
            if not next_tier_threshold:
                next_tier = data.get("next_tier") or data.get("nextTier")
                if next_tier:
                    next_tier_threshold = next_tier.get("threshold") or next_tier.get("min_volume")
            
            if next_tier_threshold:
                self.results["test_c_fee_tiers"]["next_tier_threshold"] = next_tier_threshold
                self.log(f"Next Tier Threshold: ${next_tier_threshold}")
            
            # Store full response
            self.results["test_c_fee_tiers"]["full_response"] = resp_data
            
            return True
            
        except Exception as e:
            self.log(f"Fee tiers test error: {str(e)}", "FAIL")
            return False
    
    def reconcile_dashboard_wallet(self):
        """Reconcile dashboard total_volume with wallet sum"""
        try:
            self.log("\n" + "="*80)
            self.log("RECONCILIATION: Dashboard ↔ Wallet")
            self.log("="*80)
            
            dashboard_amount = self.results["test_a_dashboard"].get("total_volume_amount")
            wallet_sum = self.results["test_b_wallet"].get("s_usd")
            
            if dashboard_amount is None or wallet_sum is None:
                self.log("⚠️ Cannot reconcile: missing dashboard or wallet data", "FAIL")
                return False
            
            dashboard_amount = float(dashboard_amount)
            wallet_sum = float(wallet_sum)
            
            difference = abs(dashboard_amount - wallet_sum)
            
            self.results["reconciliation"]["dashboard_amount"] = dashboard_amount
            self.results["reconciliation"]["wallet_sum"] = wallet_sum
            self.results["reconciliation"]["difference"] = difference
            
            self.log(f"Dashboard Total Volume: ${dashboard_amount:.2f}")
            self.log(f"Wallet Sum (S_usd): ${wallet_sum:.2f}")
            self.log(f"Absolute Difference: ${difference:.2f}")
            
            # Check if within tolerance (<= $0.01)
            if difference <= 0.01:
                self.log(f"✅ EXACT PARITY: Difference ${difference:.2f} <= $0.01 tolerance", "PASS")
                self.results["critical_checks"]["exact_parity"] = True
                return True
            else:
                self.log(f"❌ PARITY FAILED: Difference ${difference:.2f} > $0.01 tolerance", "FAIL")
                self.results["critical_checks"]["exact_parity"] = False
                return False
            
        except Exception as e:
            self.log(f"Reconciliation error: {str(e)}", "FAIL")
            return False
    
    def check_backend_logs(self):
        """Check backend logs for errors"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST D: Backend Logs Check")
            self.log("="*80)
            
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                error_log = result.stdout
                if error_log.strip():
                    # Look for recent errors related to our endpoints
                    recent_errors = [line for line in error_log.split('\n') 
                                   if any(keyword in line.lower() for keyword in 
                                         ['error', 'exception', 'dashboard', 'wallet', 'fee-tier'])]
                    
                    if recent_errors:
                        self.log(f"⚠️ Found {len(recent_errors)} potential error lines in backend logs")
                        for line in recent_errors[-5:]:  # Show last 5
                            self.log(f"  {line}")
                    else:
                        self.log("✅ No errors found in backend logs", "PASS")
                        self.results["critical_checks"]["no_backend_errors"] = True
                else:
                    self.log("✅ Backend error log is empty", "PASS")
                    self.results["critical_checks"]["no_backend_errors"] = True
            else:
                self.log("⚠️ Could not read backend logs")
                
        except Exception as e:
            self.log(f"Backend log check error: {str(e)}")
    
    def print_summary(self):
        """Print comprehensive test summary"""
        self.log("\n" + "="*80)
        self.log("COMPREHENSIVE TEST SUMMARY")
        self.log("="*80)
        
        # Test A Summary
        self.log("\n📊 TEST A - Dashboard Total Volume & Counts:")
        dashboard = self.results["test_a_dashboard"]
        self.log(f"  Total Volume: ${dashboard.get('total_volume_amount')} {dashboard.get('total_volume_currency')}")
        self.log(f"  Total Transactions Count: {dashboard.get('total_transactions_count')}")
        self.log(f"  Pending Count: {dashboard.get('pending_count')}")
        
        # Test B Summary
        self.log("\n💰 TEST B - Wallet Total:")
        wallet = self.results["test_b_wallet"]
        self.log(f"  S_usd (Sum of amount_in_usd): ${wallet.get('s_usd', 0):.2f}")
        self.log(f"  Total Wallets: {wallet.get('wallet_count')}")
        self.log(f"  Non-zero Wallets: {wallet.get('non_zero_wallets')}")
        if wallet.get('wallet_details'):
            for detail in wallet['wallet_details']:
                self.log(f"    - {detail}")
        
        # Test C Summary
        self.log("\n🎯 TEST C - Fee Tiers Volume:")
        fee_tiers = self.results["test_c_fee_tiers"]
        self.log(f"  Volume: ${fee_tiers.get('volume')}")
        self.log(f"  Current Tier: {fee_tiers.get('current_tier')}")
        self.log(f"  Next Tier Threshold: ${fee_tiers.get('next_tier_threshold')}")
        
        # Reconciliation Summary
        self.log("\n🔄 RECONCILIATION (Dashboard ↔ Wallet):")
        recon = self.results["reconciliation"]
        self.log(f"  Dashboard: ${recon.get('dashboard_amount', 0):.2f}")
        self.log(f"  Wallet: ${recon.get('wallet_sum', 0):.2f}")
        self.log(f"  Difference: ${recon.get('difference', 0):.2f}")
        
        # Status Codes
        self.log("\n📡 TEST D - HTTP Status Codes:")
        status_codes = self.results["test_d_status_codes"]
        for endpoint, code in status_codes.items():
            status = "✅" if code == 200 else "❌"
            self.log(f"  {status} {endpoint}: {code}")
        
        # Critical Checks
        self.log("\n🎯 CRITICAL CHECKS:")
        checks = self.results["critical_checks"]
        
        check_items = [
            ("dashboard_settled_volume", "Dashboard uses SETTLED volume (~$23,883.21, NOT $26,378.21)"),
            ("counts_exclude_pending", "Transaction counts EXCLUDE pending (~377, NOT ~556)"),
            ("pending_shown_separately", "Pending count shown separately (~178-179)"),
            ("fee_tier_settled", "Fee tier uses SETTLED volume (~$23,883.21, NOT $26,378.21)"),
            ("exact_parity", "Dashboard ↔ Wallet EXACT parity (difference <= $0.01)"),
            ("no_backend_errors", "No backend errors in logs")
        ]
        
        all_pass = True
        for key, description in check_items:
            value = checks.get(key)
            if value is True:
                self.log(f"  ✅ PASS: {description}")
            elif value is False:
                self.log(f"  ❌ FAIL: {description}")
                all_pass = False
            else:
                self.log(f"  ⚠️ UNKNOWN: {description}")
                all_pass = False
        
        # Final Verdict
        self.log("\n" + "="*80)
        if all_pass:
            self.log("🎉 OVERALL RESULT: ✅ ALL TESTS PASS", "PASS")
            self.log("The consistency fixes (a+b+c) are FULLY WORKING.")
        else:
            self.log("⚠️ OVERALL RESULT: ❌ SOME TESTS FAILED", "FAIL")
            self.log("Review the critical checks above for details.")
        self.log("="*80)
        
        return all_pass
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("="*80)
        self.log("DynoPay Consistency Fixes Verification (a+b+c)")
        self.log("STRICT READ-ONLY on LIVE PRODUCTION database")
        self.log("="*80)
        
        # Authentication (login endpoint is CSRF-exempt, skip checkEmail)
        if not self.step_3_login():
            return False
        
        # Run tests
        self.test_a_dashboard()
        self.test_b_wallet()
        self.test_c_fee_tiers()
        
        # Reconciliation
        self.reconcile_dashboard_wallet()
        
        # Check logs
        self.check_backend_logs()
        
        # Print summary
        return self.print_summary()


if __name__ == "__main__":
    tester = DynoPayTester()
    success = tester.run_all_tests()
    
    # Save results to file
    with open("/app/backend_test_results.json", "w") as f:
        json.dump(tester.results, f, indent=2)
    
    print("\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    exit(0 if success else 1)
