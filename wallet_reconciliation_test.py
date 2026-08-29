#!/usr/bin/env python3
"""
DynoPay Backend API Test - Wallet/Dashboard Reconciliation Verification
STRICT READ-ONLY testing on LIVE PRODUCTION database
"""

import requests
import json
from typing import Dict, Any, Tuple

# Base URL
BASE_URL = "https://dynopay-preview-14.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

class DynoPayWalletReconciliationTester:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token = None
        self.access_token = None
        self.company_id = None
        
    def get_csrf_token(self) -> bool:
        """Step 1: Get CSRF token"""
        print("\n=== STEP 1: Getting CSRF Token ===")
        try:
            response = self.session.get(f"{API_BASE}/csrf-token")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.csrf_token = data.get('csrf_token')
                print(f"✓ CSRF Token obtained: {self.csrf_token[:20]}...")
                print(f"✓ Cookie 'dynopay_csrf' set: {self.session.cookies.get('dynopay_csrf', 'NOT FOUND')[:20]}...")
                return True
            else:
                print(f"✗ Failed to get CSRF token: {response.text}")
                return False
        except Exception as e:
            print(f"✗ Exception getting CSRF token: {e}")
            return False
    
    def check_email(self) -> bool:
        """Step 2: Check email (optional, skip if not needed)"""
        print("\n=== STEP 2: Checking Email (Optional) ===")
        try:
            # Try GET request with email as query param
            response = self.session.get(
                f"{API_BASE}/user/checkEmail?email={EMAIL}"
            )
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Email check response: {json.dumps(data, indent=2)}")
                return True
            else:
                print(f"⚠ Email check endpoint not available or failed: {response.status_code}")
                print(f"  Skipping email check and proceeding to login...")
                return True  # Don't fail, just skip
        except Exception as e:
            print(f"⚠ Exception checking email: {e}")
            print(f"  Skipping email check and proceeding to login...")
            return True  # Don't fail, just skip
    
    def login(self) -> bool:
        """Step 3: Login to get JWT access token"""
        print("\n=== STEP 3: Logging In ===")
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-csrf-token': self.csrf_token
            }
            payload = {
                "email": EMAIL,
                "password": PASSWORD
            }
            
            response = self.session.post(
                f"{API_BASE}/user/login",
                json=payload,
                headers=headers
            )
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                # Try to get accessToken from different possible locations
                self.access_token = data.get('accessToken') or data.get('data', {}).get('accessToken')
                
                # Try to get company_id from login response
                user_data = data.get('data', {}).get('userData', {})
                if user_data.get('last_company_id'):
                    self.company_id = user_data.get('last_company_id')
                    print(f"✓ Company ID from login: {self.company_id}")
                
                if self.access_token:
                    print(f"✓ Login successful, JWT obtained: {self.access_token[:30]}...")
                    return True
                else:
                    print(f"✗ No accessToken in response: {json.dumps(data, indent=2)}")
                    return False
            else:
                print(f"✗ Login failed: {response.text}")
                return False
        except Exception as e:
            print(f"✗ Exception during login: {e}")
            return False
    
    def get_company_id(self) -> bool:
        """Step A: Get company ID (if not already obtained from login)"""
        if self.company_id:
            print(f"\n=== STEP A: Company ID Already Obtained ===")
            print(f"✓ Using company_id from login: {self.company_id}")
            return True
            
        print("\n=== STEP A: Getting Company ID ===")
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{API_BASE}/company/getCompany",
                headers=headers
            )
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Company response: {json.dumps(data, indent=2)[:500]}...")
                
                # Extract company_id - handle different response structures
                if isinstance(data, list) and len(data) > 0:
                    self.company_id = data[0].get('company_id') or data[0].get('id')
                elif isinstance(data, dict):
                    # Check if it's a wrapper with data field
                    if 'data' in data:
                        companies = data['data']
                        if isinstance(companies, list) and len(companies) > 0:
                            self.company_id = companies[0].get('company_id') or companies[0].get('id')
                        elif isinstance(companies, dict):
                            self.company_id = companies.get('company_id') or companies.get('id')
                    else:
                        self.company_id = data.get('company_id') or data.get('id')
                
                if self.company_id:
                    print(f"✓ Company ID obtained: {self.company_id}")
                    return True
                else:
                    print(f"✗ Could not extract company_id from response")
                    return False
            else:
                print(f"✗ Failed to get company: {response.text}")
                return False
        except Exception as e:
            print(f"✗ Exception getting company: {e}")
            return False
    
    def get_dashboard_total(self) -> Tuple[bool, Dict[str, Any]]:
        """Step B: Get dashboard total volume"""
        print("\n=== STEP B: Getting Dashboard Total Volume ===")
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{API_BASE}/dashboard/?company_id={self.company_id}",
                headers=headers
            )
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Dashboard response (first 1000 chars): {json.dumps(data, indent=2)[:1000]}...")
                
                # Handle wrapped response
                if 'data' in data:
                    data = data['data']
                
                total_volume = data.get('total_volume', {})
                amount = total_volume.get('amount')
                currency = total_volume.get('currency')
                current_month = total_volume.get('current_month')
                
                result = {
                    'amount': amount,
                    'currency': currency,
                    'current_month': current_month
                }
                
                print(f"\n✓ Dashboard Total Volume:")
                print(f"  - Amount: {amount}")
                print(f"  - Currency: {currency}")
                if current_month:
                    print(f"  - Current Month: {current_month}")
                
                return True, result
            else:
                print(f"✗ Failed to get dashboard: {response.text}")
                return False, {}
        except Exception as e:
            print(f"✗ Exception getting dashboard: {e}")
            import traceback
            traceback.print_exc()
            return False, {}
    
    def get_wallet_totals(self) -> Tuple[bool, Dict[str, Any]]:
        """Step C: Get wallet totals"""
        print("\n=== STEP C: Getting Wallet Totals ===")
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            response = self.session.get(
                f"{API_BASE}/wallet/getWallet?company_id={self.company_id}",
                headers=headers
            )
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                response_data = response.json()
                print(f"Wallet response structure: {type(response_data)}")
                
                # Handle wrapped response
                if isinstance(response_data, dict) and 'data' in response_data:
                    data = response_data['data']
                else:
                    data = response_data
                
                # The response is an array of company groups, each with a wallets array
                s_usd = 0.0
                s_base = 0.0
                wallet_details = []
                base_currency = None
                
                if isinstance(data, list):
                    print(f"Number of wallet groups: {len(data)}")
                    
                    for group_idx, group in enumerate(data):
                        print(f"\nGroup {group_idx + 1}:")
                        if 'base_currency' in group:
                            base_currency = group['base_currency']
                            print(f"  Base Currency: {base_currency}")
                        
                        wallets = group.get('wallets', [])
                        print(f"  Number of wallets: {len(wallets)}")
                        
                        for wallet in wallets:
                            wallet_type = wallet.get('wallet_type', 'unknown')
                            amount_usd = float(wallet.get('amount_in_usd', 0))
                            amount_base = float(wallet.get('amount_in_base_currency', 0))
                            
                            s_usd += amount_usd
                            s_base += amount_base
                            
                            wallet_details.append({
                                'wallet_type': wallet_type,
                                'amount_in_usd': amount_usd,
                                'amount_in_base_currency': amount_base
                            })
                            
                            print(f"    - {wallet_type}: USD={amount_usd:.2f}, Base={amount_base:.2f}")
                elif isinstance(data, dict):
                    # Single group response
                    print(f"Single wallet group response")
                    if 'base_currency' in data:
                        base_currency = data['base_currency']
                        print(f"  Base Currency: {base_currency}")
                    
                    wallets = data.get('wallets', [])
                    print(f"  Number of wallets: {len(wallets)}")
                    
                    for wallet in wallets:
                        wallet_type = wallet.get('wallet_type', 'unknown')
                        amount_usd = float(wallet.get('amount_in_usd', 0))
                        amount_base = float(wallet.get('amount_in_base_currency', 0))
                        
                        s_usd += amount_usd
                        s_base += amount_base
                        
                        wallet_details.append({
                            'wallet_type': wallet_type,
                            'amount_in_usd': amount_usd,
                            'amount_in_base_currency': amount_base
                        })
                        
                        print(f"    - {wallet_type}: USD={amount_usd:.2f}, Base={amount_base:.2f}")
                
                result = {
                    's_usd': s_usd,
                    's_base': s_base,
                    'base_currency': base_currency,
                    'wallet_details': wallet_details
                }
                
                print(f"\n✓ Wallet Totals Computed:")
                print(f"  - S_usd (Σ amount_in_usd): ${s_usd:.2f}")
                print(f"  - S_base (Σ amount_in_base_currency): {s_base:.2f} {base_currency or ''}")
                print(f"  - Total wallets: {len(wallet_details)}")
                
                return True, result
            else:
                print(f"✗ Failed to get wallet: {response.text}")
                return False, {}
        except Exception as e:
            print(f"✗ Exception getting wallet: {e}")
            import traceback
            traceback.print_exc()
            return False, {}
    
    def compare_totals(self, dashboard_data: Dict[str, Any], wallet_data: Dict[str, Any]) -> bool:
        """Step D: Compare and report PASS/FAIL"""
        print("\n" + "="*80)
        print("=== STEP D: COMPARISON & RECONCILIATION ===")
        print("="*80)
        
        total_volume_amount = dashboard_data.get('amount', 0)
        total_volume_currency = dashboard_data.get('currency', 'UNKNOWN')
        s_usd = wallet_data.get('s_usd', 0)
        s_base = wallet_data.get('s_base', 0)
        base_currency = wallet_data.get('base_currency', 'UNKNOWN')
        
        print(f"\nDashboard Total Volume:")
        print(f"  - Amount: {total_volume_amount}")
        print(f"  - Currency: {total_volume_currency}")
        
        print(f"\nWallet Totals:")
        print(f"  - S_usd: ${s_usd:.2f}")
        print(f"  - S_base: {s_base:.2f} {base_currency}")
        
        # Calculate difference
        difference = abs(s_base - total_volume_amount)
        
        # Calculate tolerance: max($1, 0.5%)
        tolerance_fixed = 1.0
        tolerance_percent = abs(total_volume_amount * 0.005)  # 0.5%
        tolerance = max(tolerance_fixed, tolerance_percent)
        
        # Calculate percentage difference
        if total_volume_amount != 0:
            percent_diff = (difference / abs(total_volume_amount)) * 100
        else:
            percent_diff = 0 if difference == 0 else float('inf')
        
        print(f"\n" + "-"*80)
        print("RECONCILIATION ANALYSIS:")
        print("-"*80)
        print(f"Absolute Difference: {difference:.2f} {total_volume_currency}")
        print(f"Percentage Difference: {percent_diff:.4f}%")
        print(f"Tolerance Threshold: {tolerance:.2f} {total_volume_currency} (max of $1 or 0.5%)")
        
        # Check if currencies match
        currency_match = (base_currency == total_volume_currency) or (base_currency is None)
        if not currency_match:
            print(f"\n⚠ WARNING: Currency mismatch - Dashboard: {total_volume_currency}, Wallet: {base_currency}")
        
        # PASS/FAIL determination
        passed = difference <= tolerance
        
        print("\n" + "="*80)
        if passed:
            print("✅ PASS - RECONCILIATION SUCCESSFUL")
            print(f"The wallet total (S_base={s_base:.2f}) matches the dashboard total")
            print(f"(total_volume.amount={total_volume_amount:.2f}) within tolerance.")
        else:
            print("❌ FAIL - RECONCILIATION FAILED")
            print(f"The wallet total (S_base={s_base:.2f}) does NOT match the dashboard total")
            print(f"(total_volume.amount={total_volume_amount:.2f}).")
            print(f"Difference of {difference:.2f} exceeds tolerance of {tolerance:.2f}.")
        print("="*80)
        
        # Additional checks for USD currency
        if total_volume_currency == 'USD' or base_currency == 'USD':
            usd_diff = abs(s_usd - total_volume_amount)
            print(f"\nAdditional USD Check:")
            print(f"  S_usd vs total_volume.amount: difference = ${usd_diff:.2f}")
            if usd_diff <= tolerance:
                print(f"  ✓ S_usd also matches within tolerance")
            else:
                print(f"  ✗ S_usd does NOT match within tolerance")
        
        # Check for zero or unattributed wallets
        print(f"\nWallet Details:")
        wallet_details = wallet_data.get('wallet_details', [])
        zero_wallets = [w for w in wallet_details if w['amount_in_base_currency'] == 0]
        if zero_wallets:
            print(f"  ⚠ Found {len(zero_wallets)} wallet(s) with zero balance:")
            for w in zero_wallets:
                print(f"    - {w['wallet_type']}")
        else:
            print(f"  ✓ No zero-balance wallets found")
        
        print(f"\n  Total wallets analyzed: {len(wallet_details)}")
        
        return passed
    
    def check_backend_logs(self) -> bool:
        """Step F: Check backend logs for errors"""
        print("\n=== STEP F: Checking Backend Logs ===")
        try:
            import subprocess
            result = subprocess.run(
                ['tail', '-n', '50', '/var/log/supervisor/backend.err.log'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                logs = result.stdout
                if logs.strip():
                    # Check for errors related to wallet/getWallet
                    if 'getWallet' in logs or 'wallet' in logs.lower():
                        print("Recent backend logs (wallet-related):")
                        print(logs[-1000:])  # Last 1000 chars
                        
                        if 'error' in logs.lower() or 'exception' in logs.lower():
                            print("\n⚠ WARNING: Errors found in backend logs")
                            return False
                    else:
                        print("✓ No wallet-related errors in recent backend logs")
                else:
                    print("✓ Backend error log is empty (no errors)")
                return True
            else:
                print(f"Could not read backend logs: {result.stderr}")
                return True  # Don't fail the test if we can't read logs
        except Exception as e:
            print(f"Could not check backend logs: {e}")
            return True  # Don't fail the test if we can't read logs
    
    def run_full_test(self) -> bool:
        """Run the complete test flow"""
        print("\n" + "="*80)
        print("DYNOPAY WALLET/DASHBOARD RECONCILIATION TEST")
        print("STRICT READ-ONLY on LIVE PRODUCTION DATABASE")
        print("="*80)
        
        # Authentication flow
        if not self.get_csrf_token():
            return False
        
        if not self.check_email():
            return False
        
        if not self.login():
            return False
        
        # Get company ID
        if not self.get_company_id():
            return False
        
        # Get dashboard data
        success, dashboard_data = self.get_dashboard_total()
        if not success:
            return False
        
        # Get wallet data
        success, wallet_data = self.get_wallet_totals()
        if not success:
            return False
        
        # Compare and determine PASS/FAIL
        passed = self.compare_totals(dashboard_data, wallet_data)
        
        # Check backend logs
        self.check_backend_logs()
        
        return passed


if __name__ == "__main__":
    tester = DynoPayWalletReconciliationTester()
    success = tester.run_full_test()
    
    print("\n" + "="*80)
    print("TEST EXECUTION COMPLETE")
    print("="*80)
    
    exit(0 if success else 1)
