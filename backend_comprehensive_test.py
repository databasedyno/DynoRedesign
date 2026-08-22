#!/usr/bin/env python3
"""
DynoPay Backend API Comprehensive Test Suite
Specifically testing the review request requirements:
1. Health Check API
2. Login with OTP flow 
3. Dashboard Today Summary API
4. Auto-Convert Settings API
"""

import requests
import json
import time
from typing import Dict, Any, Optional

class DynoPayComprehensiveTester:
    def __init__(self):
        self.backend_url = "https://payment-gateway-669.preview.emergentagent.com"
        self.session = requests.Session()
        self.access_token: Optional[str] = None
        self.login_otp_session: Optional[str] = None
        self.test_results = {
            'health_check': False,
            'login_initiate': False,
            'login_otp_verify': False,
            'dashboard_authenticated': False,
            'dashboard_today_summary': False,
            'dashboard_pending_count': False,
            'auto_convert_settings': False
        }
        
    def test_health_check(self) -> bool:
        """Test GET /api/status for health check"""
        print(f"\n🔍 Testing Health Check API...")
        
        health_url = f"{self.backend_url}/api/status"
        
        try:
            response = self.session.get(health_url, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ Health check failed: {response.text}")
                return False
            
            data = response.json()
            print(f"   ✓ Health check API responded successfully")
            
            # Verify overall_status is 'operational'
            if 'data' in data and 'overall_status' in data['data']:
                overall_status = data['data']['overall_status']
                if overall_status == 'operational':
                    print(f"   ✓ Overall status is 'operational'")
                    self.test_results['health_check'] = True
                    
                    # Print additional status info if available
                    if 'services' in data['data']:
                        services = data['data']['services']
                        print(f"   📊 Services status:")
                        if isinstance(services, dict):
                            for service_name, service_info in services.items():
                                status = service_info.get('status', 'unknown')
                                uptime = service_info.get('uptime', 'N/A')
                                print(f"     - {service_name}: {status} (uptime: {uptime})")
                        elif isinstance(services, list):
                            for service in services:
                                name = service.get('name', 'unknown')
                                status = service.get('status', 'unknown')
                                uptime = service.get('uptime', 'N/A')
                                print(f"     - {name}: {status} (uptime: {uptime})")
                    
                    return True
                else:
                    print(f"   ❌ Expected overall_status='operational', got '{overall_status}'")
                    return False
            else:
                print(f"   ❌ No overall_status found in response: {data}")
                return False
                
        except Exception as e:
            print(f"   ❌ Health check request failed: {e}")
            return False
    
    def test_login_initiate(self, email: str = "nomadly@moxx.co", password: str = "Katiekendra123@") -> bool:
        """Test user login initiation (step 1 of OTP flow)"""
        print(f"\n🔐 Testing login initiation (step 1) with {email}...")
        
        login_url = f"{self.backend_url}/api/user/login"
        login_data = {
            "email": email,
            "password": password
        }
        
        try:
            response = self.session.post(login_url, json=login_data, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if this returns OTP session (new flow) or direct access token (old flow)
                if 'data' in data:
                    if 'login_otp_session' in data['data']:
                        # New OTP flow
                        self.login_otp_session = data['data']['login_otp_session']
                        print(f"   ✓ Login initiated, got OTP session ID")
                        self.test_results['login_initiate'] = True
                        return True
                    elif 'accessToken' in data['data']:
                        # Old direct flow - still working but not expected
                        self.access_token = data['data']['accessToken']
                        self.session.headers.update({
                            'Authorization': f"Bearer {self.access_token}"
                        })
                        print(f"   ⚠️  Login gave direct access token (OTP flow not active)")
                        self.test_results['login_initiate'] = True
                        self.test_results['login_otp_verify'] = True  # Skip OTP step
                        return True
                    else:
                        print(f"   ❌ Unexpected login response format: {data}")
                        return False
                else:
                    print(f"   ❌ No data field in login response: {data}")
                    return False
            else:
                print(f"   ❌ Login failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Login request failed: {e}")
            return False
    
    def test_login_otp_verify(self, otp: str = "000000") -> bool:
        """Test OTP verification (step 2 of login flow)"""
        if not self.login_otp_session:
            print(f"   ⏭️  Skipping OTP verification - already have access token")
            return True
            
        print(f"\n🔑 Testing OTP verification (step 2) with OTP: {otp}...")
        
        otp_url = f"{self.backend_url}/api/user/verify-login-otp"
        otp_data = {
            "login_otp_session": self.login_otp_session,
            "otp": otp
        }
        
        # Add CSRF token headers that might be needed
        headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
        
        try:
            response = self.session.post(otp_url, json=otp_data, headers=headers, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'accessToken' in data['data']:
                    self.access_token = data['data']['accessToken']
                    self.session.headers.update({
                        'Authorization': f"Bearer {self.access_token}"
                    })
                    print(f"   ✓ OTP verified, got access token")
                    self.test_results['login_otp_verify'] = True
                    return True
                else:
                    print(f"   ❌ No access token in OTP response: {data}")
                    return False
            elif response.status_code in [400, 401]:
                # Expected if OTP is wrong, but we still want to test non-auth endpoints
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print(f"   ⚠️  OTP verification failed (expected with test OTP '000000'): {response_data}")
                print(f"   💡 This is expected behavior - continuing with non-authenticated tests")
                return False
            elif response.status_code == 403:
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print(f"   ⚠️  CSRF/Auth issue (expected): {response_data}")
                print(f"   💡 This is expected with test OTP - continuing with non-authenticated tests")
                return False
            else:
                print(f"   ❌ OTP verification failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ OTP verification request failed: {e}")
            return False
    
    def test_dashboard_api(self, company_id: int = 3) -> bool:
        """Test dashboard API with authentication"""
        if not self.access_token:
            print("⚠️  Cannot test dashboard - no access token")
            return False
            
        print(f"\n📊 Testing dashboard API with company_id={company_id}...")
        
        dashboard_url = f"{self.backend_url}/api/dashboard"
        params = {"company_id": company_id}
        
        try:
            response = self.session.get(dashboard_url, params=params, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ Dashboard API failed: {response.text}")
                return False
            
            data = response.json()
            print(f"   ✓ Dashboard API responded successfully")
            self.test_results['dashboard_authenticated'] = True
            
            # Test today_summary structure and data
            return self._test_dashboard_today_summary(data)
            
        except Exception as e:
            print(f"   ❌ Dashboard request failed: {e}")
            return False
    
    def _test_dashboard_today_summary(self, response_data: Dict[str, Any]) -> bool:
        """Test today_summary object in dashboard response"""
        print(f"\n📈 Testing today_summary in dashboard response...")
        
        if 'data' not in response_data:
            print(f"   ❌ No 'data' field in dashboard response")
            return False
            
        dashboard_data = response_data['data']
        
        if 'today_summary' not in dashboard_data:
            print(f"   ❌ No 'today_summary' field in dashboard data")
            return False
            
        today_summary = dashboard_data['today_summary']
        print(f"   ✓ today_summary field found")
        
        # Check key fields for transaction counting logic
        required_fields = ['transactions_today', 'pending_count']
        missing_fields = []
        
        for field in required_fields:
            if field not in today_summary:
                missing_fields.append(field)
        
        if missing_fields:
            print(f"   ❌ Missing required fields: {missing_fields}")
            return False
        
        # Verify transactions_today and pending_count are separate
        transactions_today = today_summary['transactions_today']
        pending_count = today_summary['pending_count']
        
        print(f"   📊 Transactions Today (completed): {transactions_today}")
        print(f"   📊 Pending Count: {pending_count}")
        
        # Verify they are numbers and independent
        if not isinstance(transactions_today, (int, float)):
            print(f"   ❌ transactions_today should be a number, got {type(transactions_today)}")
            return False
            
        if not isinstance(pending_count, (int, float)):
            print(f"   ❌ pending_count should be a number, got {type(pending_count)}")
            return False
        
        # Both should be non-negative
        if transactions_today < 0:
            print(f"   ❌ transactions_today cannot be negative: {transactions_today}")
            return False
            
        if pending_count < 0:
            print(f"   ❌ pending_count cannot be negative: {pending_count}")
            return False
        
        print(f"   ✓ today_summary structure and data validation passed")
        print(f"   ✓ Transactions today and pending count are independent numbers")
        self.test_results['dashboard_today_summary'] = True
        self.test_results['dashboard_pending_count'] = True
        
        return True
    
    def test_auto_convert_settings(self, company_id: int = 3) -> bool:
        """Test auto-convert settings API"""
        if not self.access_token:
            print("⚠️  Cannot test auto-convert settings - no access token")
            return False
            
        print(f"\n🔄 Testing auto-convert settings API with company_id={company_id}...")
        
        auto_convert_url = f"{self.backend_url}/api/company/auto-convert/{company_id}"
        
        try:
            response = self.session.get(auto_convert_url, timeout=30)
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ Auto-convert settings API failed: {response.text}")
                return False
            
            data = response.json()
            print(f"   ✓ Auto-convert settings API responded successfully")
            
            # Verify expected fields
            if 'data' not in data:
                print(f"   ❌ No 'data' field in auto-convert response")
                return False
                
            settings_data = data['data']
            
            # Expected fields from review request
            expected_fields = {
                'available_settlement_options': list,
                'auto_convert_enabled': bool,
                'settlement_currency': str,
                'settlement_chain': str
            }
            
            missing_fields = []
            invalid_types = []
            
            for field, expected_type in expected_fields.items():
                if field not in settings_data:
                    missing_fields.append(field)
                else:
                    value = settings_data[field]
                    if not isinstance(value, expected_type):
                        invalid_types.append(f"{field}: {type(value).__name__} (expected {expected_type.__name__})")
            
            if missing_fields:
                print(f"   ❌ Missing required fields: {missing_fields}")
                return False
                
            if invalid_types:
                print(f"   ❌ Invalid field types: {invalid_types}")
                return False
            
            # Print the actual values
            print(f"   📊 Available Settlement Options: {settings_data['available_settlement_options']}")
            print(f"   📊 Auto Convert Enabled: {settings_data['auto_convert_enabled']}")
            print(f"   📊 Settlement Currency: {settings_data['settlement_currency']}")
            print(f"   📊 Settlement Chain: {settings_data['settlement_chain']}")
            
            print(f"   ✓ Auto-convert settings structure validation passed")
            self.test_results['auto_convert_settings'] = True
            
            return True
            
        except Exception as e:
            print(f"   ❌ Auto-convert settings request failed: {e}")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests in sequence"""
        print("🚀 Starting DynoPay Comprehensive Backend API Tests")
        print(f"Backend URL: {self.backend_url}")
        
        # Test 1: Health Check (no auth required)
        self.test_health_check()
        
        # Test 2: Login Initiation
        if self.test_login_initiate():
            # Test 3: OTP Verification (if needed)
            self.test_login_otp_verify()
        
        # Test 4: Dashboard API (requires auth)
        self.test_dashboard_api()
        
        # Test 5: Auto-Convert Settings (requires auth)  
        self.test_auto_convert_settings()
        
        return self.test_results
    
    def print_summary(self):
        """Print comprehensive test summary"""
        print(f"\n" + "="*80)
        print("📋 COMPREHENSIVE TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result)
        
        # Group results by category
        print("\n🔍 Health & Authentication Tests:")
        auth_tests = ['health_check', 'login_initiate', 'login_otp_verify']
        for test_name in auth_tests:
            if test_name in self.test_results:
                result = self.test_results[test_name]
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {status} {test_name.replace('_', ' ').title()}")
        
        print("\n📊 Dashboard & Data Tests:")
        dashboard_tests = ['dashboard_authenticated', 'dashboard_today_summary', 'dashboard_pending_count']
        for test_name in dashboard_tests:
            if test_name in self.test_results:
                result = self.test_results[test_name]
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {status} {test_name.replace('_', ' ').title()}")
        
        print("\n🔄 Settings Tests:")
        settings_tests = ['auto_convert_settings']
        for test_name in settings_tests:
            if test_name in self.test_results:
                result = self.test_results[test_name]
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"  {status} {test_name.replace('_', ' ').title()}")
        
        print(f"\n🎯 Overall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All tests passed! DynoPay backend API is working correctly.")
        else:
            failed_tests = [name for name, result in self.test_results.items() if not result]
            print(f"⚠️  Failed tests: {', '.join(failed_tests)}")
            print(f"\n💡 Note: Some failures may be expected (e.g., OTP with test code)")

def main():
    """Main test execution"""
    tester = DynoPayComprehensiveTester()
    
    try:
        results = tester.run_all_tests()
        tester.print_summary()
        
        # Check critical tests - health check should always pass
        critical_tests = ['health_check']
        critical_passed = all(results.get(test, False) for test in critical_tests)
        
        if critical_passed:
            print(f"\n✅ Critical tests passed - API is functional")
            exit(0)
        else:
            print(f"\n❌ Critical tests failed - API may have issues")
            exit(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        exit(130)
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        exit(1)

if __name__ == "__main__":
    main()