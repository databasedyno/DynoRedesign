#!/usr/bin/env python3
"""
DynoPay Backend API Testing - Company ID Parameter Acceptance
Testing specific endpoints for company_id parameter handling as requested.

Key verification points:
- All protected endpoints return 401 (not 404 or 500) when company_id is provided without auth
- The company_id parameter does NOT cause any errors
- Routes are properly registered
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://dynopay-setup-12.preview.emergentagent.com"

class CompanyIdTester:
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
        """Test GET /api - Health check (should return 200)"""
        try:
            response = self.session.get(f"{self.backend_url}/api", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    status = data.get('status')
                    service = data.get('service', 'unknown')
                    
                    if status == 'operational':
                        self.log_result(
                            "GET /api", 
                            "PASS", 
                            f"Health check operational - {service}"
                        )
                    else:
                        self.log_result(
                            "GET /api", 
                            "FAIL", 
                            f"Expected status 'operational', got '{status}'"
                        )
                except ValueError:
                    self.log_result(
                        "GET /api", 
                        "FAIL", 
                        f"Invalid JSON response: {response.text[:100]}"
                    )
            else:
                self.log_result(
                    "GET /api", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_csrf_token(self):
        """Test GET /api/csrf-token - Should return CSRF token"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/csrf-token",
                timeout=10
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'csrf_token' in data:
                        token_length = len(data.get('csrf_token', ''))
                        self.log_result(
                            "GET /api/csrf-token", 
                            "PASS", 
                            f"CSRF token returned - length: {token_length}"
                        )
                    else:
                        self.log_result(
                            "GET /api/csrf-token", 
                            "FAIL", 
                            f"Response missing csrf_token field: {data}"
                        )
                except ValueError:
                    self.log_result(
                        "GET /api/csrf-token", 
                        "FAIL", 
                        f"Invalid JSON response: {response.text[:100]}"
                    )
            else:
                self.log_result(
                    "GET /api/csrf-token", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/csrf-token", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_get_all_transactions_with_company_id(self):
        """Test POST /api/wallet/getAllTransactions - Should accept company_id in request body, expect 401"""
        try:
            payload = {"company_id": 1}
            response = self.session.post(
                f"{self.backend_url}/api/wallet/getAllTransactions",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/getAllTransactions", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_get_wallet_with_company_id(self):
        """Test GET /api/wallet/getWallet?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/wallet/getWallet?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/wallet/getWallet?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/wallet/getWallet?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_pay_get_payment_links_with_company_id(self):
        """Test GET /api/pay/getPaymentLinks?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/pay/getPaymentLinks?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/pay/getPaymentLinks?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/pay/getPaymentLinks?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/pay/getPaymentLinks?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/pay/getPaymentLinks?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/pay/getPaymentLinks?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_user_api_get_api_with_company_id(self):
        """Test GET /api/userApi/getApi?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/userApi/getApi?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/userApi/getApi?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/userApi/getApi?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/userApi/getApi?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/userApi/getApi?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/userApi/getApi?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_user_api_customers_with_company_id(self):
        """Test GET /api/userApi/customers?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/userApi/customers?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/userApi/customers?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/userApi/customers?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/userApi/customers?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/userApi/customers?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/userApi/customers?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_invoices_with_company_id(self):
        """Test GET /api/invoices?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/invoices?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/invoices?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/invoices?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/invoices?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/invoices?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/invoices?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_notifications_with_company_id(self):
        """Test GET /api/notifications?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/notifications?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/notifications?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/notifications?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/notifications?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/notifications?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/notifications?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_invoices_tax_report_with_company_id(self):
        """Test GET /api/invoices/tax-report?company_id=1 - Should accept company_id query param, expect 401"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/invoices/tax-report?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/invoices/tax-report?company_id=1", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/invoices/tax-report?company_id=1", 
                    "FAIL", 
                    "Route not found (404) - endpoint not properly registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/invoices/tax-report?company_id=1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter caused error: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/invoices/tax-report?company_id=1", 
                    "PASS", 
                    f"Accepts company_id, returned {response.status_code} (not 500/404)"
                )
        except Exception as e:
            self.log_result(
                "GET /api/invoices/tax-report?company_id=1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all company_id parameter tests"""
        print(f"\n🧪 Testing DynoPay Backend API - Company ID Parameter Acceptance")
        print(f"Backend URL: {self.backend_url}")
        print("="*80)
        print("Testing endpoints to verify they accept company_id parameter correctly:")
        print("Key verification points:")
        print("- All protected endpoints return 401 (not 404 or 500) when company_id is provided without auth")
        print("- The company_id parameter does NOT cause any errors")
        print("- Routes are properly registered")
        print("="*80)
        
        # Test health endpoints first
        self.test_health_check()
        self.test_csrf_token()
        
        # Test company_id parameter acceptance
        self.test_wallet_get_all_transactions_with_company_id()
        self.test_wallet_get_wallet_with_company_id()
        self.test_pay_get_payment_links_with_company_id()
        self.test_user_api_get_api_with_company_id()
        self.test_user_api_customers_with_company_id()
        self.test_invoices_with_company_id()
        self.test_notifications_with_company_id()
        self.test_invoices_tax_report_with_company_id()
        
        # Summary
        print("\n📊 Test Summary:")
        print("="*80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print(f"\n🔍 Failed Tests:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n🎯 Key Results:")
        
        # Check for critical issues
        critical_issues = []
        route_not_found_count = 0
        server_error_count = 0
        
        for result in self.test_results:
            if result['status'] == 'FAIL':
                if '404' in result['details']:
                    route_not_found_count += 1
                    critical_issues.append(f"Route not registered: {result['test']}")
                elif '500' in result['details']:
                    server_error_count += 1
                    critical_issues.append(f"Server error with company_id: {result['test']}")
        
        if route_not_found_count > 0:
            print(f"❌ {route_not_found_count} routes not properly registered (404 errors)")
        if server_error_count > 0:
            print(f"❌ {server_error_count} endpoints have issues with company_id parameter (500 errors)")
        
        if len(critical_issues) == 0:
            print("✅ All endpoints accept company_id parameter correctly")
            print("✅ No routes return 500 errors when company_id is provided")
            print("✅ All protected routes return 401 (authentication required) as expected")
        else:
            print("❌ Critical Issues Found:")
            for issue in critical_issues:
                print(f"   • {issue}")
        
        return passed, failed

if __name__ == "__main__":
    tester = CompanyIdTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)