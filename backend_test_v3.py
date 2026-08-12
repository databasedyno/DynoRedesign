#!/usr/bin/env python3
"""
DynoPay API Backend Test - v3 Bug Fix Verification
STRICT READ-ONLY - LIVE PRODUCTION DATABASE

Verifies:
A) GET /api/dashboard/?company_id=1 → total_volume.amount ≈ $23,883.21 (settled lifetime)
B) GET /api/wallet/getWallet?company_id=1 → Σ amount_in_usd EXACTLY equals total_volume.amount (<= $0.01)
C) GET /api/dashboard/chart?company_id=1&period=1y → summary total_volume is SETTLED (not $26,378.21)
D) GET /api/dashboard/chart?company_id=1&period=30d → report total_volume (settled last-30d)
E) Confirm all endpoints return 200 with no server errors
"""

import requests
import json
from typing import Dict, Any, List

BASE_URL = "https://13e42067-64de-478e-a336-166a694ea757.preview.emergentagent.com"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

class DynoPayV3Tester:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token = None
        self.access_token = None
        self.company_id = 1  # hostbay company_id
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️"
        }.get(level, "ℹ️")
        print(f"{prefix} {message}")
        
    def get_csrf_token(self) -> bool:
        """Step 1: Get CSRF token"""
        try:
            self.log("Step 1: Getting CSRF token...")
            response = self.session.get(f"{BASE_URL}/api/csrf-token")
            
            if response.status_code != 200:
                self.log(f"CSRF token request failed: {response.status_code}", "ERROR")
                return False
                
            data = response.json()
            self.csrf_token = data.get('csrf_token')
            
            # Check for dynopay_csrf cookie
            csrf_cookie = self.session.cookies.get('dynopay_csrf')
            
            self.log(f"CSRF token obtained: {self.csrf_token[:20] if self.csrf_token else 'None'}...")
            self.log(f"CSRF cookie present: {csrf_cookie is not None}")
            return True
            
        except Exception as e:
            self.log(f"CSRF token error: {str(e)}", "ERROR")
            return False
    
    def check_email(self) -> bool:
        """Step 2: Check email"""
        try:
            self.log("Step 2: Checking email...")
            headers = {
                'Content-Type': 'application/json',
                'x-csrf-token': self.csrf_token
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/user/checkEmail",
                json={"email": EMAIL},
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Check email failed: {response.status_code} - {response.text[:200]}", "WARNING")
                # Continue anyway - this might not be required
            else:
                self.log("Email check successful")
            
            return True
            
        except Exception as e:
            self.log(f"Check email error: {str(e)}", "WARNING")
            return True  # Continue anyway
    
    def login(self) -> bool:
        """Step 3: Login and get JWT token"""
        try:
            self.log("Step 3: Logging in...")
            headers = {
                'Content-Type': 'application/json',
                'x-csrf-token': self.csrf_token
            }
            
            response = self.session.post(
                f"{BASE_URL}/api/user/login",
                json={"email": EMAIL, "password": PASSWORD},
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Login failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return False
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], dict):
                token_data = data['data']
            else:
                token_data = data
            
            self.access_token = token_data.get('accessToken') or token_data.get('access_token') or token_data.get('token')
            
            if not self.access_token:
                self.log("No access token in login response", "ERROR")
                self.log(f"Response structure: {json.dumps(data, indent=2)[:500]}", "ERROR")
                return False
                
            self.log(f"Login successful, access token obtained", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Login error: {str(e)}", "ERROR")
            return False
    
    def test_dashboard_total(self) -> Dict[str, Any]:
        """Test A: GET /api/dashboard/?company_id=1"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST A: Dashboard Total Volume (Settled Lifetime)")
            self.log("="*80)
            
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/dashboard/?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Dashboard request failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return {'success': False, 'status_code': response.status_code}
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], dict):
                dashboard_data = data['data']
            else:
                dashboard_data = data
            
            # Extract total_volume
            total_volume = dashboard_data.get('total_volume', {})
            
            amount = total_volume.get('amount', 0)
            amount_formatted = total_volume.get('amount_formatted', '')
            currency = total_volume.get('currency', 'USD')
            
            self.log(f"Dashboard Total Volume:")
            self.log(f"  amount: ${amount:,.2f}")
            self.log(f"  amount_formatted: {amount_formatted}")
            self.log(f"  currency: {currency}")
            
            # Check if it's the expected settled value (~$23,883.21)
            expected_settled = 23883.21
            old_all_status = 26378.21
            
            is_settled = abs(amount - expected_settled) < 100  # Allow some variance
            is_old_value = abs(amount - old_all_status) < 1
            
            if is_old_value:
                self.log(f"❌ FAIL: Dashboard shows old all-status value ${old_all_status:,.2f}", "ERROR")
                self.log(f"  Expected settled value: ~${expected_settled:,.2f}", "ERROR")
            elif is_settled:
                self.log(f"✅ PASS: Dashboard shows settled value ~${expected_settled:,.2f}", "SUCCESS")
            else:
                self.log(f"⚠️ WARNING: Dashboard shows ${amount:,.2f} (expected ~${expected_settled:,.2f})", "WARNING")
            
            return {
                'success': True,
                'status_code': 200,
                'amount': amount,
                'amount_formatted': amount_formatted,
                'currency': currency,
                'is_settled': is_settled,
                'is_old_value': is_old_value
            }
            
        except Exception as e:
            self.log(f"Dashboard test error: {str(e)}", "ERROR")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "ERROR")
            return {'success': False, 'error': str(e)}
    
    def test_wallet_total(self) -> Dict[str, Any]:
        """Test B: GET /api/wallet/getWallet?company_id=1"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST B: Wallet Total (Settled)")
            self.log("="*80)
            
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/wallet/getWallet?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Wallet request failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return {'success': False, 'status_code': response.status_code}
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], list):
                wallet_groups = data['data']
            elif 'data' in data and isinstance(data['data'], dict):
                wallet_groups = [data['data']]
            elif isinstance(data, list):
                wallet_groups = data
            else:
                wallet_groups = [data]
            
            # Calculate totals across all wallet groups
            s_usd = 0.0
            wallet_details = []
            
            for group in wallet_groups:
                # Get wallets from group
                wallets = group.get('wallets', [])
                
                for wallet in wallets:
                    # Handle both string and numeric amounts
                    amount_usd_raw = wallet.get('amount_in_usd', 0)
                    amount_usd = float(amount_usd_raw) if amount_usd_raw else 0.0
                    
                    currency = wallet.get('wallet_type', wallet.get('currency', 'UNKNOWN'))
                    
                    s_usd += amount_usd
                    
                    if amount_usd > 0:
                        wallet_details.append({
                            'currency': currency,
                            'amount_in_usd': amount_usd
                        })
            
            self.log(f"Wallet Totals:")
            self.log(f"  S_usd (Σ amount_in_usd): ${s_usd:,.2f}")
            self.log(f"  Number of non-zero wallets: {len(wallet_details)}")
            
            if wallet_details:
                self.log(f"\n  Per-wallet breakdown:")
                for wallet in wallet_details:
                    self.log(f"    {wallet['currency']}: ${wallet['amount_in_usd']:,.2f}")
            
            return {
                'success': True,
                'status_code': 200,
                's_usd': s_usd,
                'wallet_details': wallet_details
            }
            
        except Exception as e:
            self.log(f"Wallet test error: {str(e)}", "ERROR")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "ERROR")
            return {'success': False, 'error': str(e)}
    
    def test_chart_1y(self) -> Dict[str, Any]:
        """Test C: GET /api/dashboard/chart?company_id=1&period=1y"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST C: Dashboard Chart 1-Year Total Volume (Settled)")
            self.log("="*80)
            
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/dashboard/chart?company_id={self.company_id}&period=1y",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Chart 1y request failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return {'success': False, 'status_code': response.status_code}
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], dict):
                chart_data = data['data']
            else:
                chart_data = data
            
            # Look for total_volume in various possible locations
            total_volume = None
            location = None
            
            # Check period_summary.total_volume (v3 structure)
            if 'period_summary' in chart_data and isinstance(chart_data['period_summary'], dict):
                total_volume = chart_data['period_summary'].get('total_volume')
                location = 'period_summary.total_volume'
            
            # Check chartSummary.total_volume
            if total_volume is None and 'chartSummary' in chart_data and isinstance(chart_data['chartSummary'], dict):
                total_volume = chart_data['chartSummary'].get('total_volume')
                location = 'chartSummary.total_volume'
            
            # Check summary.total_volume
            if total_volume is None and 'summary' in chart_data and isinstance(chart_data['summary'], dict):
                total_volume = chart_data['summary'].get('total_volume')
                location = 'summary.total_volume'
            
            # Check top-level total_volume
            if total_volume is None:
                total_volume = chart_data.get('total_volume')
                location = 'total_volume'
            
            if total_volume is None:
                self.log(f"Could not find total_volume in chart response", "ERROR")
                self.log(f"Response keys: {list(chart_data.keys())}", "ERROR")
                return {'success': False, 'error': 'total_volume not found'}
            
            # Handle both numeric and object formats
            if isinstance(total_volume, dict):
                amount = total_volume.get('amount', 0)
            else:
                amount = float(total_volume)
            
            self.log(f"Chart 1-Year Total Volume:")
            self.log(f"  amount: ${amount:,.2f}")
            self.log(f"  location: {location}")
            
            # Check if it's settled (not the old all-status $26,378.21)
            expected_settled = 23883.21
            old_all_status = 26378.21
            
            is_settled = abs(amount - expected_settled) < 100  # Allow some variance
            is_old_value = abs(amount - old_all_status) < 1
            
            if is_old_value:
                self.log(f"❌ FAIL: Chart shows old all-status value ${old_all_status:,.2f}", "ERROR")
                self.log(f"  Expected settled value: ~${expected_settled:,.2f}", "ERROR")
            elif is_settled:
                self.log(f"✅ PASS: Chart shows settled value ~${expected_settled:,.2f}", "SUCCESS")
            else:
                self.log(f"⚠️ Chart shows ${amount:,.2f} (expected ~${expected_settled:,.2f} if all txns within 1y)", "WARNING")
            
            return {
                'success': True,
                'status_code': 200,
                'amount': amount,
                'location': location,
                'is_settled': is_settled,
                'is_old_value': is_old_value
            }
            
        except Exception as e:
            self.log(f"Chart 1y test error: {str(e)}", "ERROR")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "ERROR")
            return {'success': False, 'error': str(e)}
    
    def test_chart_30d(self) -> Dict[str, Any]:
        """Test D: GET /api/dashboard/chart?company_id=1&period=30d"""
        try:
            self.log("\n" + "="*80)
            self.log("TEST D: Dashboard Chart 30-Day Total Volume (Settled)")
            self.log("="*80)
            
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/dashboard/chart?company_id={self.company_id}&period=30d",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Chart 30d request failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return {'success': False, 'status_code': response.status_code}
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], dict):
                chart_data = data['data']
            else:
                chart_data = data
            
            # Look for total_volume in various possible locations
            total_volume = None
            location = None
            
            # Check period_summary.total_volume (v3 structure)
            if 'period_summary' in chart_data and isinstance(chart_data['period_summary'], dict):
                total_volume = chart_data['period_summary'].get('total_volume')
                location = 'period_summary.total_volume'
            
            # Check chartSummary.total_volume
            if total_volume is None and 'chartSummary' in chart_data and isinstance(chart_data['chartSummary'], dict):
                total_volume = chart_data['chartSummary'].get('total_volume')
                location = 'chartSummary.total_volume'
            
            # Check summary.total_volume
            if total_volume is None and 'summary' in chart_data and isinstance(chart_data['summary'], dict):
                total_volume = chart_data['summary'].get('total_volume')
                location = 'summary.total_volume'
            
            # Check top-level total_volume
            if total_volume is None:
                total_volume = chart_data.get('total_volume')
                location = 'total_volume'
            
            if total_volume is None:
                self.log(f"Could not find total_volume in chart response", "ERROR")
                self.log(f"Response keys: {list(chart_data.keys())}", "ERROR")
                return {'success': False, 'error': 'total_volume not found'}
            
            # Handle both numeric and object formats
            if isinstance(total_volume, dict):
                amount = total_volume.get('amount', 0)
            else:
                amount = float(total_volume)
            
            self.log(f"Chart 30-Day Total Volume:")
            self.log(f"  amount: ${amount:,.2f}")
            self.log(f"  location: {location}")
            self.log(f"  (This is last-30-days settled volume, sanity check only)")
            
            return {
                'success': True,
                'status_code': 200,
                'amount': amount,
                'location': location
            }
            
        except Exception as e:
            self.log(f"Chart 30d test error: {str(e)}", "ERROR")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "ERROR")
            return {'success': False, 'error': str(e)}
    
    def compare_dashboard_wallet(self, dashboard: Dict[str, Any], wallet: Dict[str, Any]) -> Dict[str, Any]:
        """Compare dashboard and wallet totals for exact parity"""
        try:
            self.log("\n" + "="*80)
            self.log("RECONCILIATION: Dashboard ↔ Wallet Parity Check")
            self.log("="*80)
            
            dashboard_amount = dashboard.get('amount', 0)
            wallet_s_usd = wallet.get('s_usd', 0)
            
            # Calculate difference
            difference = abs(dashboard_amount - wallet_s_usd)
            tolerance = 0.01  # $0.01 as specified
            
            # Determine pass/fail
            passed = difference <= tolerance
            
            self.log(f"\nDashboard Total Volume: ${dashboard_amount:,.2f}")
            self.log(f"Wallet S_usd (Σ amount_in_usd): ${wallet_s_usd:,.2f}")
            self.log(f"\nAbsolute difference: ${difference:,.2f}")
            self.log(f"Tolerance threshold: ${tolerance:,.2f}")
            
            if passed:
                self.log(f"\n✅ PASS - EXACT PARITY (|A - B| <= $0.01)", "SUCCESS")
            else:
                self.log(f"\n❌ FAIL - Difference ${difference:,.2f} exceeds tolerance ${tolerance:,.2f}", "ERROR")
            
            return {
                'passed': passed,
                'difference': difference,
                'tolerance': tolerance,
                'dashboard_amount': dashboard_amount,
                'wallet_s_usd': wallet_s_usd
            }
            
        except Exception as e:
            self.log(f"Comparison error: {str(e)}", "ERROR")
            return {'passed': False, 'error': str(e)}
    
    def run_full_test(self) -> Dict[str, Any]:
        """Run the complete v3 test suite"""
        self.log("="*80)
        self.log("DynoPay API v3 Bug Fix Verification")
        self.log("STRICT READ-ONLY - LIVE PRODUCTION DATABASE")
        self.log("="*80)
        self.log(f"Base URL: {BASE_URL}")
        self.log(f"Company ID: {self.company_id} (hostbay)")
        self.log("")
        
        # Authentication flow
        if not self.get_csrf_token():
            return {'success': False, 'error': 'CSRF token failed'}
        
        if not self.check_email():
            return {'success': False, 'error': 'Email check failed'}
        
        if not self.login():
            return {'success': False, 'error': 'Login failed'}
        
        # Run all tests
        dashboard = self.test_dashboard_total()
        if not dashboard.get('success'):
            return {'success': False, 'error': 'Dashboard test failed', 'dashboard': dashboard}
        
        wallet = self.test_wallet_total()
        if not wallet.get('success'):
            return {'success': False, 'error': 'Wallet test failed', 'wallet': wallet}
        
        chart_1y = self.test_chart_1y()
        if not chart_1y.get('success'):
            return {'success': False, 'error': 'Chart 1y test failed', 'chart_1y': chart_1y}
        
        chart_30d = self.test_chart_30d()
        if not chart_30d.get('success'):
            return {'success': False, 'error': 'Chart 30d test failed', 'chart_30d': chart_30d}
        
        # Compare dashboard and wallet
        comparison = self.compare_dashboard_wallet(dashboard, wallet)
        
        # Final summary
        self.log("\n" + "="*80)
        self.log("FINAL SUMMARY")
        self.log("="*80)
        
        all_passed = True
        
        self.log(f"\nTest A (Dashboard Total): ${dashboard.get('amount', 0):,.2f}")
        if dashboard.get('is_old_value'):
            self.log(f"  ❌ FAIL: Shows old all-status value $26,378.21", "ERROR")
            all_passed = False
        elif dashboard.get('is_settled'):
            self.log(f"  ✅ PASS: Shows settled value ~$23,883.21", "SUCCESS")
        else:
            self.log(f"  ⚠️ WARNING: Unexpected value", "WARNING")
        
        self.log(f"\nTest B (Wallet Total): ${wallet.get('s_usd', 0):,.2f}")
        self.log(f"  ✅ Retrieved successfully", "SUCCESS")
        
        self.log(f"\nTest A ↔ B Parity: |${dashboard.get('amount', 0):,.2f} - ${wallet.get('s_usd', 0):,.2f}| = ${comparison.get('difference', 0):,.2f}")
        if comparison.get('passed'):
            self.log(f"  ✅ PASS: Exact parity (<= $0.01)", "SUCCESS")
        else:
            self.log(f"  ❌ FAIL: Exceeds tolerance", "ERROR")
            all_passed = False
        
        self.log(f"\nTest C (Chart 1y Total): ${chart_1y.get('amount', 0):,.2f}")
        if chart_1y.get('is_old_value'):
            self.log(f"  ❌ FAIL: Shows old all-status value $26,378.21", "ERROR")
            all_passed = False
        elif chart_1y.get('is_settled'):
            self.log(f"  ✅ PASS: Shows settled value", "SUCCESS")
        else:
            self.log(f"  ⚠️ Reported (may be valid if not all txns within 1y)", "WARNING")
        
        self.log(f"\nTest D (Chart 30d Total): ${chart_30d.get('amount', 0):,.2f}")
        self.log(f"  ✅ Reported (sanity check only)", "SUCCESS")
        
        self.log(f"\nTest E (All endpoints 200 OK):")
        endpoints_ok = all([
            dashboard.get('status_code') == 200,
            wallet.get('status_code') == 200,
            chart_1y.get('status_code') == 200,
            chart_30d.get('status_code') == 200
        ])
        if endpoints_ok:
            self.log(f"  ✅ PASS: All endpoints returned 200", "SUCCESS")
        else:
            self.log(f"  ❌ FAIL: Some endpoints failed", "ERROR")
            all_passed = False
        
        self.log("\n" + "="*80)
        if all_passed:
            self.log("✅ ALL TESTS PASSED - V3 FIX VERIFIED", "SUCCESS")
        else:
            self.log("❌ SOME TESTS FAILED - V3 FIX NOT FULLY WORKING", "ERROR")
        self.log("="*80)
        
        return {
            'success': True,
            'all_passed': all_passed,
            'dashboard': dashboard,
            'wallet': wallet,
            'chart_1y': chart_1y,
            'chart_30d': chart_30d,
            'comparison': comparison
        }

if __name__ == "__main__":
    tester = DynoPayV3Tester()
    result = tester.run_full_test()
    
    # Exit with appropriate code
    if result.get('success') and result.get('all_passed'):
        exit(0)
    else:
        exit(1)
