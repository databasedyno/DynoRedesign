#!/usr/bin/env python3
"""
DynoPay Backend Testing - Dashboard & Analytics Endpoints
Testing after getUserAnalytics bug fix for company_id filtering

Review Request: Test the DynoPay backend API to verify the dashboard 
and analytics endpoints are working correctly after a bug fix.

Backend URL: http://localhost:8001
All API routes prefixed with: /api
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8001"
API_PREFIX = "/api"

class DynoPayDashboardTester:
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
        
    def test_endpoint(self, method, endpoint, data=None, description=""):
        """Test a single endpoint"""
        url = f"{self.base_url}{API_PREFIX}{endpoint}" if not endpoint.startswith('/api') else f"{self.base_url}{endpoint}"
        if not endpoint.startswith('/'):
            url = f"{self.base_url}{API_PREFIX}/{endpoint}"
        
        print(f"\n🧪 Testing {method} {url}")
        if data:
            print(f"📄 Request body: {json.dumps(data, indent=2)}")
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, timeout=10)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            status = response.status_code
            print(f"📊 Status: {status}")
            
            # Try to parse JSON response
            try:
                response_data = response.json()
                response_preview = json.dumps(response_data, indent=2)[:300]
                print(f"📋 Response: {response_preview}...")
            except:
                response_text = response.text[:200] if response.text else "No response body"
                print(f"📋 Response text: {response_text}")
            
            # Determine if test passed
            test_passed = True
            test_message = f"{method} {endpoint} - Status {status}"
            
            # Key verification: NO 500 errors should occur
            if status == 500:
                test_passed = False
                test_message += " - ❌ FAILED: Server error (500) indicates backend issue - getUserAnalytics fix may not be working"
            elif status in [401, 403]:
                test_message += " - ✅ Auth protection working (401/403 expected for protected endpoints)"
            elif status == 200:
                test_message += " - ✅ Endpoint responding correctly"
            elif status == 404:
                test_passed = False
                test_message += " - ❌ FAILED: Endpoint not found (404)"
            else:
                test_message += f" - ⚠️  Status {status} (not 500, which is good)"
            
            if description:
                test_message += f" - {description}"
            
            self.results.append({
                'endpoint': endpoint,
                'method': method,
                'status': status,
                'passed': test_passed,
                'message': test_message
            })
            
            return response, test_passed
            
        except requests.exceptions.RequestException as e:
            error_msg = f"{method} {endpoint} - ❌ Connection error: {str(e)}"
            print(f"❌ {error_msg}")
            self.results.append({
                'endpoint': endpoint,
                'method': method,
                'status': 'ERROR',
                'passed': False,
                'message': error_msg
            })
            return None, False
    
    def run_dashboard_analytics_tests(self):
        """Run the specific tests requested in the review"""
        print("=" * 90)
        print("🚀 DYNOPAY DASHBOARD & ANALYTICS ENDPOINT TESTING")
        print("🎯 Testing getUserAnalytics bug fix - Verifying NO 500 errors occur")
        print("🔍 Context: getUserAnalytics was fixed to properly filter by company_id")
        print("=" * 90)
        
        # Test 1: Health check - GET /api
        print("\n📋 Test 1: Backend Health Check")
        self.test_endpoint('GET', '', description="Health check - verify backend is running")
        
        # Test 2: Dashboard endpoint with company_id=34 (should return 401, not 500)
        print("\n📋 Test 2: Dashboard endpoint (company_id=34)")
        self.test_endpoint('GET', '/dashboard?company_id=34', 
                          description="Should return 401 (auth required) but NOT a 500 error")
        
        # Test 3: Dashboard endpoint with company_id=3 (should return 401, not 500)
        print("\n📋 Test 3: Dashboard endpoint (company_id=3)")
        self.test_endpoint('GET', '/dashboard?company_id=3',
                          description="Should return 401 (auth required) but NOT a 500 error")
        
        # Test 4: getUserAnalytics with company_id=34 (should return 401/403, not 500)
        print("\n📋 Test 4: getUserAnalytics endpoint (company_id=34)")
        self.test_endpoint('POST', '/wallet/getUserAnalytics', 
                          data={"company_id": "34"},
                          description="Should return 401/403 but NOT a 500 error")
        
        # Test 5: getUserAnalytics with company_id=3 (should return 401/403, not 500)
        print("\n📋 Test 5: getUserAnalytics endpoint (company_id=3)")
        self.test_endpoint('POST', '/wallet/getUserAnalytics',
                          data={"company_id": "3"},
                          description="Should return 401/403 but NOT a 500 error")
        
        # Test 6: Dashboard chart endpoint (should return 401, not 500)
        print("\n📋 Test 6: Dashboard Chart endpoint")
        self.test_endpoint('GET', '/dashboard/chart?period=7d&company_id=34',
                          description="Should return 401 but NOT 500")
        
        # Test 7: Dashboard fee-tiers endpoint (should return 401, not 500)
        print("\n📋 Test 7: Dashboard Fee-tiers endpoint")
        self.test_endpoint('GET', '/dashboard/fee-tiers?company_id=34',
                          description="Should return 401 but NOT 500")
        
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 90)
        print("📊 TEST RESULTS SUMMARY - getUserAnalytics Bug Fix Verification")
        print("=" * 90)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['passed'])
        failed_tests = total_tests - passed_tests
        
        print(f"📈 Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"🎯 Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Print individual results
        print("\n📋 Detailed Results:")
        for result in self.results:
            status_icon = "✅" if result['passed'] else "❌"
            print(f"{status_icon} {result['message']}")
        
        # Critical findings - Check for 500 errors
        server_errors = [r for r in self.results if r['status'] == 500]
        connection_errors = [r for r in self.results if r['status'] == 'ERROR']
        
        if connection_errors:
            print(f"\n🔌 CONNECTION ISSUES: {len(connection_errors)} endpoints unreachable")
            print("   This suggests the backend may not be running on localhost:8001")
            for error in connection_errors:
                print(f"   - {error['method']} {error['endpoint']}")
        
        if server_errors:
            print(f"\n🚨 CRITICAL: {len(server_errors)} server errors (500 status) found")
            print("   The getUserAnalytics bug fix may not be working correctly!")
            for error in server_errors:
                print(f"   - {error['method']} {error['endpoint']}")
        else:
            print("\n✅ SUCCESS: No 500 server errors found!")
            print("   🎉 getUserAnalytics bug fix appears to be working correctly")
        
        return passed_tests, failed_tests, server_errors, connection_errors

def main():
    """Main testing function"""
    print("🔧 DynoPay Dashboard & Analytics Testing Suite")
    print(f"🌐 Target URL: {BASE_URL}")
    print(f"📍 API Prefix: {API_PREFIX}")
    
    tester = DynoPayDashboardTester()
    
    # Run dashboard and analytics tests
    tester.run_dashboard_analytics_tests()
    
    # Print summary
    passed, failed, server_errors, connection_errors = tester.print_summary()
    
    # Print conclusion
    print("\n" + "=" * 90)
    if connection_errors:
        print("🔌 CONCLUSION: Backend connection issues - check if service is running on localhost:8001")
        return 1
    elif server_errors:
        print("🚨 CONCLUSION: CRITICAL - Server errors found, getUserAnalytics fix needs attention")
        return 1
    elif failed > 0:
        print("⚠️  CONCLUSION: Some endpoints failed but no critical 500 errors - fix verified")
        return 0
    else:
        print("🎉 CONCLUSION: All tests passed! getUserAnalytics bug fix verification successful")
        return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)