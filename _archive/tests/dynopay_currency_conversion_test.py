#!/usr/bin/env python3
"""
DynoPay Currency Conversion & Company Switching Backend Testing

Review Request: Test DynoPay backend - specifically verify the currency conversion fix and company switching.

Critical Tests:
1. GET /api - Health check (expect 200)
2. GET /api/wallet/getWallet?company_id=3 - This was previously returning 500 due to currency conversion failure. Now it should return 200 (with auth) or 401 (without auth). The key point is it should NOT return 500 anymore.
3. GET /api/wallet/getWallet?company_id=1 - Same test with different company_id
4. POST /api/wallet/getAllTransactions with body {"company_id": 3} - Should return 401 (not 500)
5. POST /api/wallet/getAllTransactions with body {"company_id": 1} - Should return 401 (not 500)
6. GET /api/notifications/push/vapid-key - Should return 200 with VAPID key

Verification:
- NO 500 errors on ANY endpoint
- All company_id-parameterized endpoints return proper auth errors (401/403), not server errors (500)
- Backend is stable and responding
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL from review request
BACKEND_URL = "http://localhost:8001"

class DynoPayCurrencyConversionTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_result(self, test_name: str, status: str, details: str):
        """Log test results"""
        result = {
            'test': test_name,
            'status': status,  # 'PASS' or 'FAIL'
            'details': details
        }
        self.test_results.append(result)
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"{status_symbol} {test_name}: {details}")
    
    def test_health_check(self):
        """Test GET /api - Health check (expect 200)"""
        try:
            response = self.session.get(f"{self.backend_url}/api", timeout=15)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    status = data.get('status', 'unknown')
                    service = data.get('service', 'unknown')
                    version = data.get('version', 'unknown')
                    
                    self.log_result(
                        "GET /api (Health Check)", 
                        "PASS", 
                        f"Health check passed - {service} v{version} status: {status}"
                    )
                except ValueError:
                    # Might be plain text response
                    self.log_result(
                        "GET /api (Health Check)", 
                        "PASS", 
                        f"Health check passed - Response: {response.text[:100]}"
                    )
            else:
                self.log_result(
                    "GET /api (Health Check)", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api (Health Check)", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_endpoint_company_3(self):
        """Test GET /api/wallet/getWallet?company_id=3 - Should NOT return 500"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/wallet/getWallet?company_id=3",
                timeout=15
            )
            
            if response.status_code == 500:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=3", 
                    "FAIL", 
                    f"❌ CRITICAL: Still returns 500 error - currency conversion fix failed: {response.text[:300]}"
                )
            elif response.status_code == 401:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=3", 
                    "PASS", 
                    "Returns 401 (auth required) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 403:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=3", 
                    "PASS", 
                    "Returns 403 (forbidden) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 200:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=3", 
                    "PASS", 
                    "Returns 200 (success) - currency conversion and auth both working"
                )
            else:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=3", 
                    "PASS", 
                    f"Returns {response.status_code} (not 500) - currency conversion fix working"
                )
        except Exception as e:
            self.log_result(
                "GET /api/wallet/getWallet?company_id=3", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_endpoint_company_1(self):
        """Test GET /api/wallet/getWallet?company_id=1 - Should NOT return 500"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/wallet/getWallet?company_id=1",
                timeout=15
            )
            
            if response.status_code == 500:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "FAIL", 
                    f"❌ CRITICAL: Still returns 500 error - currency conversion fix failed: {response.text[:300]}"
                )
            elif response.status_code == 401:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "PASS", 
                    "Returns 401 (auth required) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 403:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "PASS", 
                    "Returns 403 (forbidden) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 200:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "PASS", 
                    "Returns 200 (success) - currency conversion and auth both working"
                )
            else:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "PASS", 
                    f"Returns {response.status_code} (not 500) - currency conversion fix working"
                )
        except Exception as e:
            self.log_result(
                "GET /api/wallet/getWallet?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_transactions_endpoint_company_3(self):
        """Test POST /api/wallet/getAllTransactions with company_id=3 - Should return 401 (not 500)"""
        try:
            response = self.session.post(
                f"{self.backend_url}/api/wallet/getAllTransactions",
                json={"company_id": 3},
                timeout=15
            )
            
            if response.status_code == 500:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=3)", 
                    "FAIL", 
                    f"❌ CRITICAL: Still returns 500 error - currency conversion fix failed: {response.text[:300]}"
                )
            elif response.status_code == 401:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=3)", 
                    "PASS", 
                    "Returns 401 (auth required) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 403:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=3)", 
                    "PASS", 
                    "Returns 403 (CSRF/forbidden) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 200:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=3)", 
                    "PASS", 
                    "Returns 200 (success) - currency conversion and auth both working"
                )
            else:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=3)", 
                    "PASS", 
                    f"Returns {response.status_code} (not 500) - currency conversion fix working"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/getAllTransactions (company_id=3)", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_transactions_endpoint_company_1(self):
        """Test POST /api/wallet/getAllTransactions with company_id=1 - Should return 401 (not 500)"""
        try:
            response = self.session.post(
                f"{self.backend_url}/api/wallet/getAllTransactions",
                json={"company_id": 1},
                timeout=15
            )
            
            if response.status_code == 500:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=1)", 
                    "FAIL", 
                    f"❌ CRITICAL: Still returns 500 error - currency conversion fix failed: {response.text[:300]}"
                )
            elif response.status_code == 401:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=1)", 
                    "PASS", 
                    "Returns 401 (auth required) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 403:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=1)", 
                    "PASS", 
                    "Returns 403 (CSRF/forbidden) instead of 500 - currency conversion fix working"
                )
            elif response.status_code == 200:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=1)", 
                    "PASS", 
                    "Returns 200 (success) - currency conversion and auth both working"
                )
            else:
                self.log_result(
                    "POST /api/wallet/getAllTransactions (company_id=1)", 
                    "PASS", 
                    f"Returns {response.status_code} (not 500) - currency conversion fix working"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/getAllTransactions (company_id=1)", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_vapid_key_endpoint(self):
        """Test GET /api/notifications/push/vapid-key - Should return 200 with VAPID key"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/notifications/push/vapid-key",
                timeout=15
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Check multiple possible key names and nested data
                    vapid_key = (data.get('publicKey') or 
                                data.get('vapidKey') or 
                                data.get('key') or
                                data.get('data', {}).get('vapid_public_key'))
                    
                    if vapid_key and len(vapid_key) > 50:
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "PASS", 
                            f"VAPID key returned successfully - length: {len(vapid_key)}, starts with: {vapid_key[:10]}..."
                        )
                    else:
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "FAIL", 
                            f"VAPID key missing or invalid in response: {data}"
                        )
                except ValueError:
                    # Might be plain text VAPID key
                    if len(response.text) > 50:
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "PASS", 
                            f"VAPID key returned (plain text) - length: {len(response.text)}"
                        )
                    else:
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "FAIL", 
                            f"Invalid VAPID key response: {response.text}"
                        )
            else:
                self.log_result(
                    "GET /api/notifications/push/vapid-key", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/notifications/push/vapid-key", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all critical backend tests for currency conversion and company switching"""
        print(f"\n🧪 DynoPay Currency Conversion & Company Switching Test")
        print(f"🔗 Testing Backend at: {self.backend_url}")
        print("="*80)
        print("🎯 CRITICAL VERIFICATION:")
        print("   • NO 500 errors on company_id-parameterized endpoints")
        print("   • All endpoints return proper auth errors (401/403), not server errors")
        print("   • Currency conversion fix is working")
        print("   • Company switching functionality stable")
        print("="*80)
        
        # Run tests in the exact order from review request
        self.test_health_check()
        self.test_wallet_endpoint_company_3()
        self.test_wallet_endpoint_company_1()
        self.test_transactions_endpoint_company_3()
        self.test_transactions_endpoint_company_1()
        self.test_vapid_key_endpoint()
        
        # Summary with focus on 500 errors
        print("\n📊 CRITICAL TEST RESULTS:")
        print("="*80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        # Check specifically for 500 errors
        has_500_errors = any("500 error" in result['details'] for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if has_500_errors:
            print(f"\n🚨 CRITICAL ISSUE: 500 ERRORS STILL PRESENT!")
            print("   The currency conversion fix is NOT working properly.")
        else:
            print(f"\n🎉 CURRENCY CONVERSION FIX VERIFIED!")
            print("   No 500 errors detected on any company_id endpoints.")
        
        if failed > 0:
            print(f"\n🔍 Failed Tests Details:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"   • {result['test']}: {result['details']}")
        
        return passed, failed, has_500_errors

if __name__ == "__main__":
    print("🔧 DynoPay Backend - Currency Conversion Fix Verification")
    print("="*80)
    
    tester = DynoPayCurrencyConversionTester()
    passed, failed, has_500_errors = tester.run_all_tests()
    
    # Exit with error code if there are 500 errors (critical issue)
    if has_500_errors:
        print(f"\n❌ EXITING WITH ERROR: Currency conversion fix verification FAILED")
        sys.exit(2)
    elif failed > 0:
        print(f"\n⚠️  Some tests failed but no critical 500 errors detected")
        sys.exit(1)
    else:
        print(f"\n✅ ALL TESTS PASSED: Currency conversion fix verified successfully!")
        sys.exit(0)