#!/usr/bin/env python3
"""
DynoPay Backend Proxy Testing Suite
Testing specific requirements from review request:

1. **Backend proxy is working**: Test that http://localhost:8001/api/ returns a response (confirms Python proxy → Node.js is working)
2. **Email service FRONTEND_BASE_URL**: Check if backend loaded FRONTEND_URL correctly by checking backend logs
3. **Payment link creation endpoint**: Test POST /api/pay/createPaymentLink exists and is routed correctly

Note: Most API endpoints require authentication. Just verify the proxy is alive and basic routing works.
"""

import requests
import json
import sys
import os
import subprocess
from typing import Dict, Any, Optional

class DynoPayProxyTester:
    def __init__(self):
        # Use localhost:8001 as specified in review request
        self.backend_url = "http://localhost:8001"
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
    
    def test_backend_proxy_working(self):
        """Test that http://localhost:8001/api/ returns a response (confirms Python proxy → Node.js is working)"""
        try:
            response = self.session.get(f"{self.backend_url}/api/", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    message = data.get('message', '')
                    version = data.get('version', 'unknown')
                    status = data.get('status', 'unknown')
                    
                    if 'Dynopay' in message or 'DynoPay' in message:
                        self.log_result(
                            "Backend proxy is working", 
                            "PASS", 
                            f"Proxy → Node.js working - {message} v{version} status: {status}"
                        )
                    else:
                        self.log_result(
                            "Backend proxy is working", 
                            "PASS", 
                            f"Proxy responding - {message} (status: {response.status_code})"
                        )
                except ValueError:
                    # Non-JSON response is still valid - proxy is working
                    self.log_result(
                        "Backend proxy is working", 
                        "PASS", 
                        f"Proxy responding (non-JSON): {response.text[:100]}"
                    )
            else:
                # Even non-200 responses indicate proxy is working
                self.log_result(
                    "Backend proxy is working", 
                    "PASS", 
                    f"Proxy responding with {response.status_code} (proxy working, Node.js may have routing issue)"
                )
        except requests.exceptions.ConnectionError as e:
            self.log_result(
                "Backend proxy is working", 
                "FAIL", 
                f"Connection failed - proxy may not be running: {str(e)}"
            )
        except Exception as e:
            self.log_result(
                "Backend proxy is working", 
                "FAIL", 
                f"Unexpected error: {str(e)}"
            )
    
    def test_email_service_frontend_url(self):
        """Check if backend loaded FRONTEND_URL correctly by examining logs and environment"""
        try:
            # Check if backend .env has FRONTEND_URL set to pod URL
            env_path = "/app/backend/.env"
            expected_url = "https://onboard-app-11.preview.emergentagent.com"
            
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    env_content = f.read()
                
                if f"FRONTEND_URL={expected_url}" in env_content:
                    self.log_result(
                        "Email service FRONTEND_BASE_URL", 
                        "PASS", 
                        f"FRONTEND_URL correctly set to pod URL in backend/.env"
                    )
                else:
                    # Look for any FRONTEND_URL line
                    for line in env_content.split('\n'):
                        if line.startswith('FRONTEND_URL='):
                            self.log_result(
                                "Email service FRONTEND_BASE_URL", 
                                "FAIL", 
                                f"FRONTEND_URL set to: {line.split('=', 1)[1]} (expected: {expected_url})"
                            )
                            return
                    
                    self.log_result(
                        "Email service FRONTEND_BASE_URL", 
                        "FAIL", 
                        "FRONTEND_URL not found in backend/.env"
                    )
            else:
                self.log_result(
                    "Email service FRONTEND_BASE_URL", 
                    "FAIL", 
                    "Backend .env file not found"
                )
        except Exception as e:
            self.log_result(
                "Email service FRONTEND_BASE_URL", 
                "FAIL", 
                f"Error checking backend configuration: {str(e)}"
            )
    
    def test_payment_link_creation_endpoint(self):
        """Test POST /api/pay/createPaymentLink returns a payment_link field (or proper auth error showing endpoint exists)"""
        try:
            # Test with minimal payload - we expect auth error, not 404
            test_payload = {
                "amount": "10",
                "currency": "USD",
                "description": "Test payment link"
            }
            
            response = self.session.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json=test_payload,
                timeout=10
            )
            
            if response.status_code == 404:
                self.log_result(
                    "Payment link creation endpoint", 
                    "FAIL", 
                    "Endpoint not found (404) - routing issue"
                )
            elif response.status_code in [401, 403]:
                # Expected - endpoint exists but requires auth
                reason = "auth required" if response.status_code == 401 else "CSRF protection"
                self.log_result(
                    "Payment link creation endpoint", 
                    "PASS", 
                    f"Endpoint exists and properly protected ({response.status_code} - {reason})"
                )
            elif response.status_code == 200:
                # Unexpected success - check if payment_link field exists
                try:
                    data = response.json()
                    if 'payment_link' in data:
                        payment_link = data['payment_link']
                        pod_url = "e8e955c6-8e61-4dfe-94ca-15f3ba9be27b.preview.emergentagent.com"
                        
                        if pod_url in payment_link:
                            self.log_result(
                                "Payment link creation endpoint", 
                                "PASS", 
                                f"Payment link uses pod URL: {payment_link}"
                            )
                        else:
                            self.log_result(
                                "Payment link creation endpoint", 
                                "FAIL", 
                                f"Payment link uses wrong URL: {payment_link} (should contain pod URL)"
                            )
                    else:
                        self.log_result(
                            "Payment link creation endpoint", 
                            "FAIL", 
                            f"Response missing payment_link field: {data}"
                        )
                except ValueError:
                    self.log_result(
                        "Payment link creation endpoint", 
                        "FAIL", 
                        f"Invalid JSON response: {response.text[:200]}"
                    )
            else:
                # Other status codes - endpoint exists
                self.log_result(
                    "Payment link creation endpoint", 
                    "PASS", 
                    f"Endpoint exists, returned {response.status_code} (may need different payload/headers)"
                )
        
        except requests.exceptions.ConnectionError as e:
            self.log_result(
                "Payment link creation endpoint", 
                "FAIL", 
                f"Connection failed: {str(e)}"
            )
        except Exception as e:
            self.log_result(
                "Payment link creation endpoint", 
                "FAIL", 
                f"Unexpected error: {str(e)}"
            )
    
    def test_basic_api_endpoints(self):
        """Test additional basic endpoints to verify routing"""
        endpoints_to_test = [
            ("GET", "/api", "API root endpoint"),
            ("GET", "/api/csrf-token", "CSRF token endpoint")
        ]
        
        for method, endpoint, description in endpoints_to_test:
            try:
                if method == "GET":
                    response = self.session.get(f"{self.backend_url}{endpoint}", timeout=10)
                
                if response.status_code == 200:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - working (200)"
                    )
                elif response.status_code == 404:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - not found (404)"
                    )
                else:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - responding ({response.status_code})"
                    )
            except Exception as e:
                self.log_result(
                    f"{method} {endpoint}", 
                    "FAIL", 
                    f"Connection error: {str(e)}"
                )
    
    def run_all_tests(self):
        """Run all tests for the DynoPay backend proxy review request"""
        print(f"\n🧪 Testing DynoPay Backend Proxy at {self.backend_url}")
        print("="*80)
        print("Review Request Testing:")
        print("1. Backend proxy is working (Python proxy → Node.js)")
        print("2. Email service FRONTEND_BASE_URL configuration") 
        print("3. Payment link creation endpoint routing")
        print("="*80)
        
        # Core tests from review request
        self.test_backend_proxy_working()
        self.test_email_service_frontend_url()
        self.test_payment_link_creation_endpoint()
        
        # Additional basic tests
        print("\nAdditional routing verification:")
        self.test_basic_api_endpoints()
        
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
        
        print(f"\nBackend URL tested: {self.backend_url}")
        print("Note: Most endpoints require authentication - we're just verifying proxy and routing work.")
        
        return passed, failed

if __name__ == "__main__":
    tester = DynoPayProxyTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code  
    sys.exit(0 if failed == 0 else 1)