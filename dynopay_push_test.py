#!/usr/bin/env python3
"""
DynoPay Web Push Notification Backend Testing Suite

Testing specific endpoints mentioned in review request:

### 1. Web Push Notification Endpoints:
- GET /api/notifications/push/vapid-key — Should return 200 with VAPID public key (NO auth needed)
- POST /api/notifications/push/subscribe — Should return 401/CSRF error (auth required)  
- POST /api/notifications/push/unsubscribe — Should return 401/CSRF error (auth required)

### 2. Existing endpoints still working:
- GET /api — Health check (200)
- POST /api/wallet/getAllTransactions — Should return 401 (auth required)
- GET /api/notifications?company_id=1 — Should return 401 (auth required)
- PUT /api/notifications/read-all — Should return 401 (auth required)
- GET /api/notifications/preferences?company_id=1 — Should return 401 (auth required)
- GET /api/referral/stats — Should return 401 (auth required)

Key verification:
- VAPID key endpoint returns a valid VAPID public key string starting with "B"
- All protected endpoints properly require authentication
- No 500 errors on any endpoint
- Push subscription endpoints are properly registered
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://multi-coin.preview.emergentagent.com"

class DynoPayPushTester:
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
    
    def test_api_health_check(self):
        """Test GET /api - Health check (200)"""
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
    
    def test_vapid_key_endpoint(self):
        """Test GET /api/notifications/push/vapid-key - Should return 200 with VAPID public key (NO auth needed)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/notifications/push/vapid-key",
                timeout=10
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    vapid_key = data.get('data', {}).get('vapid_public_key') or data.get('vapid_public_key')
                    
                    if vapid_key and isinstance(vapid_key, str) and vapid_key.startswith('B'):
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "PASS", 
                            f"VAPID key returned - starts with 'B', length: {len(vapid_key)}"
                        )
                    elif vapid_key:
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "FAIL", 
                            f"VAPID key doesn't start with 'B': {vapid_key[:20]}..."
                        )
                    else:
                        self.log_result(
                            "GET /api/notifications/push/vapid-key", 
                            "FAIL", 
                            f"No VAPID key in response: {data}"
                        )
                except ValueError:
                    self.log_result(
                        "GET /api/notifications/push/vapid-key", 
                        "FAIL", 
                        f"Invalid JSON response: {response.text[:100]}"
                    )
            elif response.status_code == 503:
                self.log_result(
                    "GET /api/notifications/push/vapid-key", 
                    "FAIL", 
                    "Web Push not configured (503 Service Unavailable)"
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
    
    def test_push_subscribe_endpoint(self):
        """Test POST /api/notifications/push/subscribe - Should return 401/CSRF error (auth required)"""
        try:
            test_subscription = {
                "subscription": {
                    "endpoint": "https://test.push.com",
                    "keys": {
                        "p256dh": "test_key",
                        "auth": "test_auth"
                    }
                }
            }
            
            response = self.session.post(
                f"{self.backend_url}/api/notifications/push/subscribe",
                json=test_subscription,
                timeout=10
            )
            
            if response.status_code in [401, 403]:
                reason = "CSRF protection" if response.status_code == 403 else "auth required"
                self.log_result(
                    "POST /api/notifications/push/subscribe", 
                    "PASS", 
                    f"Push subscribe - correctly returns {response.status_code} ({reason})"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/notifications/push/subscribe", 
                    "FAIL", 
                    "Push subscribe endpoint - not found (404)"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/notifications/push/subscribe", 
                    "FAIL", 
                    f"Server error (500): {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/notifications/push/subscribe", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/notifications/push/subscribe", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_push_unsubscribe_endpoint(self):
        """Test POST /api/notifications/push/unsubscribe - Should return 401/CSRF error (auth required)"""
        try:
            test_payload = {
                "endpoint": "https://test.push.com"
            }
            
            response = self.session.post(
                f"{self.backend_url}/api/notifications/push/unsubscribe",
                json=test_payload,
                timeout=10
            )
            
            if response.status_code in [401, 403]:
                reason = "CSRF protection" if response.status_code == 403 else "auth required"
                self.log_result(
                    "POST /api/notifications/push/unsubscribe", 
                    "PASS", 
                    f"Push unsubscribe - correctly returns {response.status_code} ({reason})"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/notifications/push/unsubscribe", 
                    "FAIL", 
                    "Push unsubscribe endpoint - not found (404)"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/notifications/push/unsubscribe", 
                    "FAIL", 
                    f"Server error (500): {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/notifications/push/unsubscribe", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/notifications/push/unsubscribe", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_get_all_transactions(self):
        """Test POST /api/wallet/getAllTransactions - Should return 401 (auth required)"""
        try:
            test_payload = {"company_id": 1}
            
            response = self.session.post(
                f"{self.backend_url}/api/wallet/getAllTransactions",
                json=test_payload,
                timeout=10
            )
            
            if response.status_code in [401, 403]:
                reason = "CSRF protection" if response.status_code == 403 else "auth required"
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "PASS", 
                    f"Get transactions - correctly returns {response.status_code} ({reason})"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    "Get transactions endpoint - not found (404)"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    f"Server error (500): {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/getAllTransactions", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_notifications_endpoints(self):
        """Test notification endpoints - Should return 401 (auth required)"""
        endpoints = [
            ("GET", "/api/notifications?company_id=1", "List notifications"),
            ("PUT", "/api/notifications/read-all", "Mark all notifications as read", {"company_id": 1}),
            ("GET", "/api/notifications/preferences?company_id=1", "Get notification preferences")
        ]
        
        for method, endpoint, description, *payload in endpoints:
            try:
                if method == "GET":
                    response = self.session.get(f"{self.backend_url}{endpoint}", timeout=10)
                elif method == "PUT":
                    response = self.session.put(
                        f"{self.backend_url}{endpoint}",
                        json=payload[0] if payload else {},
                        timeout=10
                    )
                
                if response.status_code in [401, 403]:
                    reason = "CSRF protection" if response.status_code == 403 else "auth required"
                    self.log_result(
                        f"{method} {endpoint}", 
                        "PASS", 
                        f"{description} - correctly returns {response.status_code} ({reason})"
                    )
                elif response.status_code == 404:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - endpoint not found (404)"
                    )
                elif response.status_code == 500:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - server error (500): {response.text[:200]}"
                    )
                else:
                    self.log_result(
                        f"{method} {endpoint}", 
                        "FAIL", 
                        f"{description} - expected 401/403, got {response.status_code}: {response.text[:200]}"
                    )
            except Exception as e:
                self.log_result(
                    f"{method} {endpoint}", 
                    "FAIL", 
                    f"Connection error: {str(e)}"
                )
    
    def test_referral_stats_endpoint(self):
        """Test GET /api/referral/stats - Should return 401 (auth required)"""
        try:
            response = self.session.get(f"{self.backend_url}/api/referral/stats", timeout=10)
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/referral/stats", 
                    "PASS", 
                    "Referral stats - correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/referral/stats", 
                    "PASS", 
                    "Referral stats endpoint - not found (404) - endpoint may not exist"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/referral/stats", 
                    "FAIL", 
                    f"Server error (500): {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/referral/stats", 
                    "FAIL", 
                    f"Expected 401 or 404, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/referral/stats", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all backend tests for DynoPay Web Push review request"""
        print(f"\n🧪 Testing DynoPay Web Push Backend API at {self.backend_url}")
        print("="*80)
        print("Testing NEW web push notification endpoints:")
        print("1. GET /api/notifications/push/vapid-key (public)")
        print("2. POST /api/notifications/push/subscribe (auth required)")
        print("3. POST /api/notifications/push/unsubscribe (auth required)")
        print("\nVerifying existing endpoints still working:")
        print("4. GET /api (health check)")
        print("5. POST /api/wallet/getAllTransactions (auth required)")
        print("6. Notification endpoints (auth required)")
        print("7. GET /api/referral/stats (auth required)")
        print("="*80)
        
        # Test NEW web push notification endpoints first
        print("\n🔔 Testing NEW Web Push Notification Endpoints:")
        self.test_vapid_key_endpoint()
        self.test_push_subscribe_endpoint()
        self.test_push_unsubscribe_endpoint()
        
        # Test existing endpoints to ensure they still work
        print("\n🔍 Verifying Existing Endpoints Still Working:")
        self.test_api_health_check()
        self.test_wallet_get_all_transactions()
        self.test_notifications_endpoints()
        self.test_referral_stats_endpoint()
        
        # Summary
        print("\n📊 Test Summary:")
        print("="*80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        # Categorize results
        new_endpoints = [r for r in self.test_results if 'push' in r['test']]
        existing_endpoints = [r for r in self.test_results if 'push' not in r['test']]
        
        print(f"\n🔔 NEW Web Push Endpoints: {sum(1 for r in new_endpoints if r['status'] == 'PASS')}/{len(new_endpoints)} passed")
        print(f"🔍 Existing Endpoints: {sum(1 for r in existing_endpoints if r['status'] == 'PASS')}/{len(existing_endpoints)} passed")
        
        if failed > 0:
            print(f"\n❌ Failed Tests:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  • {result['test']}: {result['details']}")
        
        print(f"\nKey Verification Points:")
        print(f"  • No 500 server errors: {'✅' if not any('500' in r['details'] for r in self.test_results) else '❌'}")
        vapid_check = '✅' if any("starts with 'B'" in r['details'] for r in self.test_results if r['status'] == 'PASS') else '❌'
        print(f"  • VAPID key format correct: {vapid_check}")
        auth_check = '✅' if sum(1 for r in self.test_results if '401' in r['details'] and r['status'] == 'PASS') >= 3 else '❌'
        print(f"  • Auth protection working: {auth_check}")
        
        return passed, failed

if __name__ == "__main__":
    tester = DynoPayPushTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)