#!/usr/bin/env python3
"""
DynoPay Tax & Invoice System Backend Testing
Testing specific TAX and INVOICE endpoints from review request:

1. **Health Check**: GET /api → should return status: "operational"

2. **Tax Endpoints** (test routing exists):
   - GET /api/tax/rates?country=US → should return tax rate data (may return 401 if auth needed, but not 404)
   - GET /api/tax/acronyms → should return tax acronyms data (may return 401 if auth needed, but not 404)

3. **Invoice Endpoints** (auth-protected):
   - GET /api/invoices → should return 401 without auth (not 404)
   - GET /api/invoices/tax-report → should return 401 without auth (not 404)
   - GET /api/invoices/tax-report/csv → should return 401 without auth (not 404)

4. **Customer Endpoints** (auth-protected):
   - GET /api/userApi/customers → should return 401 without auth (not 404)

5. **Verify NO 500 errors** — all endpoints should return clean error responses, not server errors

Key validations:
- Tax routes are properly registered
- Invoice routes are properly registered 
- No 404s on any of these endpoints (meaning routes ARE registered)
- No 500 internal server errors
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://crypto-gateway-24.preview.emergentagent.com"

class TaxInvoiceBackendTester:
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
        """Test GET /api - Should return status: 'operational'"""
        try:
            response = self.session.get(f"{self.backend_url}/api", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    status = data.get('status')
                    
                    if status == 'operational':
                        self.log_result(
                            "Health Check - GET /api", 
                            "PASS", 
                            f"Status: operational - {data.get('service', 'DynoPay')} v{data.get('version', 'unknown')}"
                        )
                    else:
                        self.log_result(
                            "Health Check - GET /api", 
                            "FAIL", 
                            f"Expected status 'operational', got '{status}'"
                        )
                except ValueError:
                    self.log_result(
                        "Health Check - GET /api", 
                        "FAIL", 
                        f"Invalid JSON response: {response.text[:100]}"
                    )
            else:
                self.log_result(
                    "Health Check - GET /api", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "Health Check - GET /api", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_tax_endpoints(self):
        """Test tax endpoints - should be routed correctly (not 404)"""
        endpoints = [
            ("GET", "/api/tax/rate/US", "Tax rates endpoint (correct format: /rate/:countryCode)"),
            ("GET", "/api/tax/acronyms", "Tax acronyms endpoint")
        ]
        
        for method, endpoint, description in endpoints:
            try:
                response = self.session.get(f"{self.backend_url}{endpoint}", timeout=10)
                
                if response.status_code == 404:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - Route not registered (404)"
                    )
                elif response.status_code == 500:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - Server error (500): {response.text[:200]}"
                    )
                elif response.status_code in [200, 401, 403]:
                    # 200 = working, 401/403 = auth required (acceptable)
                    status_desc = {200: "working", 401: "auth required", 403: "auth/CSRF required"}
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - Route registered ({response.status_code}: {status_desc.get(response.status_code, 'protected')})"
                    )
                else:
                    # Other status codes (but route exists)
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - Route registered (returned {response.status_code})"
                    )
            except Exception as e:
                self.log_result(
                    f"{method} {endpoint}", 
                    "FAIL", 
                    f"Connection error: {str(e)}"
                )
    
    def test_invoice_endpoints(self):
        """Test invoice endpoints - should return 401 without auth (not 404)"""
        endpoints = [
            ("GET", "/api/invoices", "Invoice list endpoint"),
            ("GET", "/api/invoices/tax-report", "Invoice tax report endpoint"),
            ("GET", "/api/invoices/tax-report/csv", "Invoice tax report CSV export")
        ]
        
        for method, endpoint, description in endpoints:
            try:
                response = self.session.get(f"{self.backend_url}{endpoint}", timeout=10)
                
                if response.status_code == 404:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - Route not registered (404)"
                    )
                elif response.status_code == 500:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - Server error (500): {response.text[:200]}"
                    )
                elif response.status_code == 401:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - Route registered, auth required (401)"
                    )
                elif response.status_code == 403:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - Route registered, auth/CSRF required (403)"
                    )
                elif response.status_code == 200:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - Route working (200)"
                    )
                else:
                    # Other status codes (but route exists)
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - Route registered (returned {response.status_code})"
                    )
            except Exception as e:
                self.log_result(
                    f"{method} {endpoint}", 
                    "FAIL", 
                    f"Connection error: {str(e)}"
                )
    
    def test_customer_endpoint(self):
        """Test customer endpoint - should return 401 without auth (not 404)"""
        try:
            response = self.session.get(f"{self.backend_url}/api/userApi/customers", timeout=10)
            
            if response.status_code == 404:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "FAIL", 
                    "Customer endpoint - Route not registered (404)"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "FAIL", 
                    f"Customer endpoint - Server error (500): {response.text[:200]}"
                )
            elif response.status_code == 401:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "PASS", 
                    "Customer endpoint - Route registered, auth required (401)"
                )
            elif response.status_code == 403:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "PASS", 
                    "Customer endpoint - Route registered, auth/CSRF required (403)"
                )
            elif response.status_code == 200:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "PASS", 
                    "Customer endpoint - Route working (200)"
                )
            else:
                # Other status codes (but route exists)
                self.log_result(
                    "GET /api/userApi/customers", 
                    "PASS", 
                    f"Customer endpoint - Route registered (returned {response.status_code})"
                )
        except Exception as e:
            self.log_result(
                "GET /api/userApi/customers", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all tax and invoice system tests"""
        print(f"\n🧪 Testing DynoPay TAX & INVOICE System at {self.backend_url}")
        print("="*70)
        print("Review Request Focus: TAX and INVOICE system changes")
        print("Key Requirements:")
        print("  - Tax routes properly registered (no 404s)")
        print("  - Invoice routes properly registered (no 404s)")
        print("  - Auth-protected endpoints return 401 (not 404)")
        print("  - No 500 internal server errors")
        print("="*70)
        
        # Test in order matching review request
        print("\n1. Health Check:")
        self.test_health_check()
        
        print("\n2. Tax Endpoints:")
        self.test_tax_endpoints()
        
        print("\n3. Invoice Endpoints:")
        self.test_invoice_endpoints()
        
        print("\n4. Customer Endpoints:")
        self.test_customer_endpoint()
        
        # Summary
        print("\n📊 Test Summary:")
        print("="*70)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        # Check for critical issues
        critical_issues = []
        route_404s = []
        server_500s = []
        
        for result in self.test_results:
            if result['status'] == 'FAIL':
                if '404' in result['details']:
                    route_404s.append(result['test'])
                elif '500' in result['details']:
                    server_500s.append(result['test'])
                else:
                    critical_issues.append(result)
        
        if route_404s:
            print(f"\n🚨 ROUTE NOT REGISTERED (404 errors):")
            for test in route_404s:
                print(f"  • {test}")
        
        if server_500s:
            print(f"\n🔥 SERVER ERRORS (500 errors):")
            for test in server_500s:
                print(f"  • {test}")
        
        if critical_issues:
            print(f"\n🔍 Other Failed Tests:")
            for result in critical_issues:
                print(f"  • {result['test']}: {result['details']}")
        
        # Final validation
        print(f"\n🎯 Review Request Validation:")
        print(f"  ✅ Tax routes registered: {len(route_404s) == 0}")
        print(f"  ✅ Invoice routes registered: {len(route_404s) == 0}")
        print(f"  ✅ No 500 server errors: {len(server_500s) == 0}")
        print(f"  ✅ Proper auth responses: {'Yes' if failed == 0 else 'Check failed tests'}")
        
        return passed, failed, route_404s, server_500s

if __name__ == "__main__":
    tester = TaxInvoiceBackendTester()
    passed, failed, route_404s, server_500s = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)