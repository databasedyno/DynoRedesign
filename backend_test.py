#!/usr/bin/env python3
"""
DynoPay API Backend Test - Wallet/Dashboard Reconciliation Verification (v2)
STRICT READ-ONLY - LIVE PRODUCTION DATABASE
"""

import requests
import json
from typing import Dict, Any, List

BASE_URL = "https://13e42067-64de-478e-a336-166a694ea757.preview.emergentagent.com"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

class DynoPayAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token = None
        self.access_token = None
        self.company_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
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
            
            self.log(f"✓ CSRF token obtained: {self.csrf_token[:20]}...")
            self.log(f"✓ CSRF cookie present: {csrf_cookie is not None}")
            return True
            
        except Exception as e:
            self.log(f"CSRF token error: {str(e)}", "ERROR")
            return False
    
    def check_email(self) -> bool:
        """Step 2: Check email (optional - skip if not needed)"""
        try:
            self.log("Step 2: Checking email (skipping - not required for login)...")
            # The checkEmail endpoint is GET and not required for login flow
            # We can proceed directly to login
            return True
            
        except Exception as e:
            self.log(f"Check email error: {str(e)}", "ERROR")
            return False
    
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
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], dict):
                token_data = data['data']
            else:
                token_data = data
            
            self.access_token = token_data.get('accessToken') or token_data.get('access_token') or token_data.get('token')
            
            # Try to extract company_id from userData if available
            user_data = token_data.get('userData', {})
            if user_data and user_data.get('last_company_id'):
                self.company_id = user_data.get('last_company_id')
                self.log(f"✓ Company ID from login: {self.company_id}")
            
            if not self.access_token:
                self.log("No access token in login response", "ERROR")
                self.log(f"Response structure: {json.dumps(data, indent=2)[:500]}", "ERROR")
                return False
                
            self.log(f"✓ Login successful, access token obtained")
            return True
            
        except Exception as e:
            self.log(f"Login error: {str(e)}", "ERROR")
            return False
    
    def get_company_id(self) -> bool:
        """Step A: Get company_id"""
        try:
            # If we already have company_id from login, skip this step
            if self.company_id:
                self.log(f"\nStep A: Company ID already obtained from login: {self.company_id}")
                return True
                
            self.log("\nStep A: Getting company_id...")
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/company/getCompany",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Get company failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
            data = response.json()
            
            # Handle different response structures
            if isinstance(data, list) and len(data) > 0:
                self.company_id = data[0].get('id') or data[0].get('company_id')
            elif isinstance(data, dict):
                # Check if data is nested
                if 'data' in data:
                    companies = data['data']
                    if isinstance(companies, list) and len(companies) > 0:
                        self.company_id = companies[0].get('id') or companies[0].get('company_id')
                    elif isinstance(companies, dict):
                        self.company_id = companies.get('id') or companies.get('company_id')
                else:
                    self.company_id = data.get('id') or data.get('company_id')
            
            if not self.company_id:
                self.log(f"Could not extract company_id from response: {json.dumps(data, indent=2)}", "ERROR")
                return False
                
            self.log(f"✓ Company ID: {self.company_id}")
            return True
            
        except Exception as e:
            self.log(f"Get company error: {str(e)}", "ERROR")
            return False
    
    def get_dashboard_total(self) -> Dict[str, Any]:
        """Step B: Get dashboard total volume"""
        try:
            self.log("\nStep B: Getting dashboard total volume...")
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/dashboard/?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Get dashboard failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return {}
                
            data = response.json()
            
            # Handle nested response structure
            if 'data' in data and isinstance(data['data'], dict):
                dashboard_data = data['data']
            else:
                dashboard_data = data
            
            # Extract total_volume
            total_volume = dashboard_data.get('total_volume', {})
            
            amount = total_volume.get('amount', 0)
            currency = total_volume.get('currency', 'USD')
            
            self.log(f"✓ Dashboard Total Volume: ${amount:,.2f} {currency}")
            
            return {
                'amount': amount,
                'currency': currency,
                'raw_data': dashboard_data
            }
            
        except Exception as e:
            self.log(f"Get dashboard error: {str(e)}", "ERROR")
            return {}
    
    def get_wallet_totals(self) -> Dict[str, Any]:
        """Step C: Get wallet totals"""
        try:
            self.log("\nStep C: Getting wallet totals...")
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/wallet/getWallet?company_id={self.company_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Get wallet failed: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                return {}
                
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
            s_base = 0.0
            base_currency = None
            wallet_details = []
            
            for group in wallet_groups:
                # Get base currency from group
                if base_currency is None:
                    base_currency = group.get('base_currency', 'USD')
                
                # Get wallets from group
                wallets = group.get('wallets', [])
                
                for wallet in wallets:
                    # Handle both string and numeric amounts
                    amount_usd_raw = wallet.get('amount_in_usd', 0)
                    amount_base_raw = wallet.get('amount_in_base_currency', 0)
                    
                    amount_usd = float(amount_usd_raw) if amount_usd_raw else 0.0
                    amount_base = float(amount_base_raw) if amount_base_raw else 0.0
                    
                    currency = wallet.get('wallet_type', wallet.get('currency', 'UNKNOWN'))
                    
                    s_usd += amount_usd
                    s_base += amount_base
                    
                    wallet_details.append({
                        'currency': currency,
                        'amount_in_usd': amount_usd,
                        'amount_in_base_currency': amount_base
                    })
            
            # If no base_currency found, default to USD
            if base_currency is None:
                base_currency = 'USD'
            
            self.log(f"✓ Wallet Totals:")
            self.log(f"  - S_usd (sum of amount_in_usd): ${s_usd:,.2f}")
            self.log(f"  - S_base (sum of amount_in_base_currency): {s_base:,.2f} {base_currency}")
            self.log(f"  - Base currency: {base_currency}")
            self.log(f"  - Number of wallets: {len(wallet_details)}")
            
            # Show per-wallet breakdown
            self.log(f"\n  Per-wallet breakdown:")
            non_zero_count = 0
            for wallet in wallet_details:
                if wallet['amount_in_usd'] > 0:
                    self.log(f"    {wallet['currency']}: ${wallet['amount_in_usd']:,.2f}")
                    non_zero_count += 1
            
            if non_zero_count == 0:
                self.log(f"    (All wallets have zero balance)")
            
            return {
                's_usd': s_usd,
                's_base': s_base,
                'base_currency': base_currency,
                'wallet_details': wallet_details,
                'raw_data': wallet_groups
            }
            
        except Exception as e:
            self.log(f"Get wallet error: {str(e)}", "ERROR")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}", "ERROR")
            return {}
    
    def compare_totals(self, dashboard: Dict[str, Any], wallet: Dict[str, Any]) -> Dict[str, Any]:
        """Step D: Compare dashboard and wallet totals"""
        try:
            self.log("\n" + "="*80)
            self.log("STEP D: RECONCILIATION COMPARISON")
            self.log("="*80)
            
            dashboard_amount = dashboard.get('amount', 0)
            dashboard_currency = dashboard.get('currency', 'USD')
            
            wallet_s_usd = wallet.get('s_usd', 0)
            wallet_s_base = wallet.get('s_base', 0)
            wallet_currency = wallet.get('base_currency', 'USD')
            
            # Calculate difference
            difference = abs(wallet_s_base - dashboard_amount)
            tolerance = 0.01  # $0.01 as specified
            
            # Determine pass/fail
            passed = difference <= tolerance
            
            self.log(f"\nDashboard Total Volume:")
            self.log(f"  amount: ${dashboard_amount:,.2f}")
            self.log(f"  currency: {dashboard_currency}")
            
            self.log(f"\nWallet Totals:")
            self.log(f"  S_usd: ${wallet_s_usd:,.2f}")
            self.log(f"  S_base: {wallet_s_base:,.2f} {wallet_currency}")
            self.log(f"  base_currency: {wallet_currency}")
            
            self.log(f"\nReconciliation Analysis:")
            self.log(f"  Absolute difference: ${difference:,.2f}")
            self.log(f"  Tolerance threshold: ${tolerance:,.2f}")
            self.log(f"  Currency match: {dashboard_currency == wallet_currency}")
            
            if passed:
                self.log(f"\n✅ PASS - EXACT PARITY ACHIEVED (difference <= $0.01)", "SUCCESS")
            else:
                self.log(f"\n❌ FAIL - Difference ${difference:,.2f} exceeds tolerance ${tolerance:,.2f}", "ERROR")
            
            # Additional checks
            if dashboard_currency == 'USD':
                usd_match = abs(wallet_s_usd - dashboard_amount) <= tolerance
                self.log(f"\nUSD Check:")
                self.log(f"  S_usd vs dashboard: ${abs(wallet_s_usd - dashboard_amount):,.2f} difference")
                self.log(f"  USD match: {'✅ PASS' if usd_match else '❌ FAIL'}")
            
            # Expected value check
            expected_value = 23883.21
            expected_tolerance = 100.0  # Allow some variance
            is_expected = abs(dashboard_amount - expected_value) <= expected_tolerance
            
            self.log(f"\nExpected Value Check:")
            self.log(f"  Expected: ~${expected_value:,.2f} (settled transactions only)")
            self.log(f"  Actual: ${dashboard_amount:,.2f}")
            self.log(f"  Within expected range: {'✅ YES' if is_expected else '⚠️ NO (but may be valid)'}")
            
            return {
                'passed': passed,
                'difference': difference,
                'tolerance': tolerance,
                'dashboard_amount': dashboard_amount,
                'dashboard_currency': dashboard_currency,
                'wallet_s_usd': wallet_s_usd,
                'wallet_s_base': wallet_s_base,
                'wallet_currency': wallet_currency,
                'is_expected_value': is_expected
            }
            
        except Exception as e:
            self.log(f"Comparison error: {str(e)}", "ERROR")
            return {'passed': False, 'error': str(e)}
    
    def check_backend_logs(self):
        """Step F: Check backend logs for errors"""
        try:
            self.log("\n" + "="*80)
            self.log("STEP F: BACKEND LOG CHECK")
            self.log("="*80)
            self.log("Note: Backend logs will be checked separately via supervisor logs")
            
        except Exception as e:
            self.log(f"Log check error: {str(e)}", "ERROR")
    
    def run_full_test(self) -> Dict[str, Any]:
        """Run the complete test suite"""
        self.log("="*80)
        self.log("DynoPay API Backend Test - Wallet/Dashboard Reconciliation (v2)")
        self.log("STRICT READ-ONLY - LIVE PRODUCTION DATABASE")
        self.log("="*80)
        
        # Authentication flow
        if not self.get_csrf_token():
            return {'success': False, 'error': 'CSRF token failed'}
        
        if not self.check_email():
            return {'success': False, 'error': 'Email check failed'}
        
        if not self.login():
            return {'success': False, 'error': 'Login failed'}
        
        # Get company ID
        if not self.get_company_id():
            return {'success': False, 'error': 'Get company_id failed'}
        
        # Get dashboard and wallet data
        dashboard = self.get_dashboard_total()
        if not dashboard:
            return {'success': False, 'error': 'Get dashboard failed'}
        
        wallet = self.get_wallet_totals()
        if not wallet:
            return {'success': False, 'error': 'Get wallet failed'}
        
        # Compare totals
        comparison = self.compare_totals(dashboard, wallet)
        
        # Check logs
        self.check_backend_logs()
        
        self.log("\n" + "="*80)
        self.log("TEST COMPLETE")
        self.log("="*80)
        
        return {
            'success': True,
            'comparison': comparison,
            'dashboard': dashboard,
            'wallet': wallet
        }

if __name__ == "__main__":
    tester = DynoPayAPITester()
    result = tester.run_full_test()
    
    # Exit with appropriate code
    if result.get('success') and result.get('comparison', {}).get('passed'):
        exit(0)
    else:
        exit(1)
