#!/usr/bin/env python3
"""
DynoPay Backend API Testing - Review Request Validation

This test script verifies the specific requirements from the review request:
1. Backend Health: GET /api/status
2. Login: POST /api/user/login
3. Payment link #920 verification: GET /api/pay/getData
4. Create new payment link: POST /api/pay/createPaymentLink

Backend URL: http://localhost:8001
Login: nomadly@moxx.co / Katiekendra123@
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional


class DynoPayReviewTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.access_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, status: str, details: str = ""):
        """Log test result"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': timestamp
        }
        self.test_results.append(result)
        
        # Color coding for terminal output
        color = '\033[92m' if status == 'PASS' else '\033[91m' if status == 'FAIL' else '\033[93m'
        reset = '\033[0m'
        print(f"{color}[{timestamp}] {test_name}: {status}{reset}")
        if details:
            print(f"  → {details}")
    
    def test_backend_health(self) -> bool:
        """Test 1: Backend Health - GET /api/status"""
        try:
            url = f"{self.base_url}/api/status"
            response = self.session.get(url, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                # Check for overall_status in nested data structure
                overall_status = None
                if 'data' in data and 'overall_status' in data['data']:
                    overall_status = data['data']['overall_status']
                elif 'overall_status' in data:
                    overall_status = data['overall_status']
                
                if overall_status == 'operational':
                    self.log_test("Backend Health", "PASS", 
                                f"Status 200, overall_status: {overall_status}")
                    return True
                else:
                    self.log_test("Backend Health", "FAIL", 
                                f"Status 200 but overall_status not 'operational': {overall_status}")
                    return False
            else:
                self.log_test("Backend Health", "FAIL", 
                            f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Backend Health", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_login(self, email: str, password: str) -> bool:
        """Test 2: Login - POST /api/user/login"""
        try:
            url = f"{self.base_url}/api/user/login"
            payload = {
                "email": email,
                "password": password
            }
            
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if 'accessToken' in data or ('data' in data and 'accessToken' in data['data']):
                    # Extract token from response structure
                    if 'accessToken' in data:
                        self.access_token = data['accessToken']
                    else:
                        self.access_token = data['data']['accessToken']
                    
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.access_token}'
                    })
                    self.log_test("Login", "PASS", 
                                f"Status 200, accessToken received: {self.access_token[:20]}...")
                    return True
                else:
                    self.log_test("Login", "FAIL", 
                                f"Status 200 but no accessToken in response: {data}")
                    return False
            else:
                self.log_test("Login", "FAIL", 
                            f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Login", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_payment_link_920(self) -> bool:
        """Test 3: Payment link #920 verification"""
        try:
            url = f"{self.base_url}/api/pay/getData"
            # The specific reference from the review request
            ref_param = "11cf30c7f8fcc76dc274a3260727807e18ba2b4236cfc8da"
            
            # Use POST method as indicated by the review request
            payload = {"data": ref_param}
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                # Check if we have payment data and status
                if 'data' in data:
                    payment_data = data['data']
                    status = payment_data.get('status', 'unknown')
                    self.log_test("Payment Link #920", "PASS", 
                                f"Status 200, payment status: {status}")
                    return True
                else:
                    self.log_test("Payment Link #920", "FAIL", 
                                f"Status 200 but no data field: {data}")
                    return False
            else:
                self.log_test("Payment Link #920", "FAIL", 
                            f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Payment Link #920", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_create_payment_link(self) -> bool:
        """Test 4: Create new payment link"""
        if not self.access_token:
            self.log_test("Create Payment Link", "FAIL", "No access token available")
            return False
            
        try:
            url = f"{self.base_url}/api/pay/createPaymentLink"
            payload = {
                "amount": 10,
                "currency": "USD",
                "accepted_currencies": ["BTC"],
                "description": "Test Direct Pay link",
                "company_id": 3  # Adding company_id as required by the API
            }
            
            response = self.session.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if 'payment_link' in data or ('data' in data and 'payment_link' in data['data']):
                    # Extract payment_link URL
                    if 'payment_link' in data:
                        payment_link = data['payment_link']
                    else:
                        payment_link = data['data']['payment_link']
                    
                    self.log_test("Create Payment Link", "PASS", 
                                f"Status 200, payment_link: {payment_link}")
                    return True
                else:
                    self.log_test("Create Payment Link", "FAIL", 
                                f"Status 200 but no payment_link in response: {data}")
                    return False
            else:
                self.log_test("Create Payment Link", "FAIL", 
                            f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Payment Link", "FAIL", f"Exception: {str(e)}")
            return False
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed_tests = len([r for r in self.test_results if r['status'] == 'FAIL'])
        
        print("\n" + "="*60)
        print("DynoPay API TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: \033[92m{passed_tests}\033[0m")
        print(f"Failed: \033[91m{failed_tests}\033[0m")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\n" + "="*60)
        return failed_tests == 0


def main():
    """Main test execution"""
    print("DynoPay Backend API Testing - Review Request Validation")
    print("="*70)
    
    # Configuration from review request
    BACKEND_URL = "http://localhost:8001"
    LOGIN_EMAIL = "nomadly@moxx.co"
    LOGIN_PASSWORD = "Katiekendra123@"
    
    tester = DynoPayReviewTester(BACKEND_URL)
    
    print(f"\nTesting backend at: {BACKEND_URL}")
    print(f"Login credentials: {LOGIN_EMAIL}")
    print("-" * 70)
    
    # Execute tests in order from review request
    # Test 1: Backend Health
    tester.test_backend_health()
    
    # Test 2: Login
    login_success = tester.test_login(LOGIN_EMAIL, LOGIN_PASSWORD)
    
    # Test 3: Payment link #920 verification (requires login)
    if login_success:
        tester.test_payment_link_920()
    else:
        tester.log_test("Payment Link #920", "SKIP", "Login failed")
    
    # Test 4: Create new payment link (requires login)
    if login_success:
        tester.test_create_payment_link()
    else:
        tester.log_test("Create Payment Link", "SKIP", "Login failed")
    
    # Print summary and return result
    success = tester.print_summary()
    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)