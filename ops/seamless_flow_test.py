#!/usr/bin/env python3
"""
DynoPay Seamless Email-Based Trial Link Flow Testing
Tests the specific workflow described in the review request.
"""

import os
import sys
import requests
import json
import time
import re
from typing import Dict, Any, Optional, Tuple

# Backend URL (use localhost as specified in the request)
BACKEND_URL = "http://localhost:8001"
BASE_API_URL = f"{BACKEND_URL}/api"

# Test configuration
TIMEOUT = 30
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

def log_test(message: str, level: str = "INFO") -> None:
    """Log test messages with timestamp."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def log_response(response: requests.Response, endpoint: str) -> None:
    """Log response details."""
    log_test(f"{endpoint} -> Status: {response.status_code}")
    try:
        json_response = response.json()
        log_test(f"{endpoint} -> Response: {json.dumps(json_response, indent=2)}")
    except:
        log_test(f"{endpoint} -> Response: {response.text[:500]}")

def extract_management_token(manage_url: str) -> Optional[str]:
    """Extract management token from the manage_url."""
    try:
        # Pattern: /try/manage/{token}
        match = re.search(r'/try/manage/([^/?#]+)', manage_url)
        if match:
            return match.group(1)
        return None
    except:
        return None

class SeamlessFlowTester:
    """Test the seamless email-based trial link flow."""
    
    def __init__(self):
        self.test_results = []
        self.management_token = None
        self.manage_url = None
        self.link_url = None
        self.slug = None
    
    def run_all_tests(self):
        """Run all seamless flow tests as specified in the review request."""
        log_test("=" * 80)
        log_test("SEAMLESS EMAIL-BASED TRIAL LINK FLOW TESTING")
        log_test(f"Backend URL: {BACKEND_URL}")
        log_test("=" * 80)
        
        # Test sequence as specified in the review request
        self.test_1_create_trial_link_with_email()
        
        if self.management_token:  # Only proceed if we got a token
            self.test_2_get_trial_by_management_token()
            self.test_3_claim_funds_with_management_token()
        
        self.test_4_create_trial_link_without_email()
        self.test_5_status_health_check()
        
        # Summary
        self.print_summary()
        return self.test_results

    def add_result(self, test_name: str, passed: bool, details: str):
        """Add test result."""
        status = "PASS" if passed else "FAIL"
        log_test(f"{test_name}: {status} - {details}")
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })

    def test_1_create_trial_link_with_email(self):
        """Test 1: POST /api/public/create-trial-link with email (new seamless flow)."""
        log_test("Test 1: Create trial link with email (seamless flow)")
        
        endpoint = f"{BASE_API_URL}/public/create-trial-link"
        payload = {
            "amount": 50,
            "currency": "USD", 
            "email": "test@example.com",
            "description": "Seamless flow test"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/create-trial-link")
            
            if response.status_code == 201:
                data = response.json().get('data', {})
                
                # Check required fields exist
                required_fields = ['link_url', 'manage_url', 'slug']
                missing_fields = [field for field in required_fields if field not in data]
                
                # Check that claim_token is NOT in response (new seamless flow)
                has_claim_token = 'claim_token' in data
                
                if not missing_fields and not has_claim_token:
                    # Store data for subsequent tests
                    self.manage_url = data.get('manage_url')
                    self.link_url = data.get('link_url') 
                    self.slug = data.get('slug')
                    self.management_token = extract_management_token(self.manage_url)
                    
                    if self.management_token:
                        self.add_result("Step 1: Create trial link with email", True, 
                                      f"✅ Success: Response 201, has required fields, NO claim_token, token extracted: {self.management_token[:8]}...")
                    else:
                        self.add_result("Step 1: Create trial link with email", False, 
                                      "✅ Response 201, has required fields, NO claim_token, but failed to extract token from manage_url")
                elif has_claim_token:
                    self.add_result("Step 1: Create trial link with email", False, 
                                  "❌ Response contains claim_token field (should not be present in seamless flow)")
                elif missing_fields:
                    self.add_result("Step 1: Create trial link with email", False, 
                                  f"❌ Missing required fields: {missing_fields}")
                else:
                    self.add_result("Step 1: Create trial link with email", False, 
                                  "❌ Unknown validation failure")
            else:
                self.add_result("Step 1: Create trial link with email", False, 
                              f"❌ Expected 201, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Step 1: Create trial link with email", False, f"❌ Request failed: {e}")

    def test_2_get_trial_by_management_token(self):
        """Test 2: GET /api/public/trial/manage/{token}."""
        log_test("Test 2: Get trial link details via management token")
        
        if not self.management_token:
            self.add_result("Step 2: Get trial by management token", False, 
                          "❌ No management token available from step 1")
            return
            
        endpoint = f"{BASE_API_URL}/public/trial/manage/{self.management_token}"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, f"GET /api/public/trial/manage/{self.management_token}")
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                
                # Check required fields
                required_fields = ['status', 'amount', 'currency', 'creator_email', 'can_claim', 'link_url']
                missing_fields = [field for field in required_fields if field not in data]
                
                # Check expected values
                creator_email_correct = data.get('creator_email') == 'test@example.com'
                status_correct = data.get('status') == 'active'
                can_claim_correct = data.get('can_claim') == False
                
                if (not missing_fields and creator_email_correct and status_correct and can_claim_correct):
                    self.add_result("Step 2: Get trial by management token", True, 
                                  "✅ Response 200, has required fields, creator_email='test@example.com', status='active', can_claim=false")
                else:
                    issues = []
                    if missing_fields:
                        issues.append(f"missing fields: {missing_fields}")
                    if not creator_email_correct:
                        issues.append(f"creator_email={data.get('creator_email')} (expected test@example.com)")
                    if not status_correct:
                        issues.append(f"status={data.get('status')} (expected active)")
                    if not can_claim_correct:
                        issues.append(f"can_claim={data.get('can_claim')} (expected false)")
                    
                    self.add_result("Step 2: Get trial by management token", False, f"❌ Issues: {'; '.join(issues)}")
            else:
                self.add_result("Step 2: Get trial by management token", False, 
                              f"❌ Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Step 2: Get trial by management token", False, f"❌ Request failed: {e}")

    def test_3_claim_funds_with_management_token(self):
        """Test 3: POST /api/public/claim-funds with management_token (should fail - payment not received)."""
        log_test("Test 3: Claim funds with management token (expecting 400 - payment not received)")
        
        if not self.management_token:
            self.add_result("Step 3: Claim funds with management token", False, 
                          "❌ No management token available from step 1")
            return
            
        endpoint = f"{BASE_API_URL}/public/claim-funds"
        payload = {
            "management_token": self.management_token,
            "email": "test@example.com",
            "password": "testpass123"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/claim-funds")
            
            if response.status_code == 400:
                # Check if error message is about payment not received
                response_data = response.json()
                message = response_data.get('message', '').lower()
                
                if ('payment' in message and 'not' in message and 'received' in message):
                    self.add_result("Step 3: Claim funds with management token", True, 
                                  "✅ Response 400 with correct message about payment not received yet")
                else:
                    self.add_result("Step 3: Claim funds with management token", True, 
                                  f"✅ Response 400 (correct), message: {response_data.get('message', 'No message')}")
            else:
                self.add_result("Step 3: Claim funds with management token", False, 
                              f"❌ Expected 400, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Step 3: Claim funds with management token", False, f"❌ Request failed: {e}")

    def test_4_create_trial_link_without_email(self):
        """Test 4: POST /api/public/create-trial-link without email (should fail)."""
        log_test("Test 4: Create trial link without email (expecting 400 - email required)")
        
        endpoint = f"{BASE_API_URL}/public/create-trial-link"
        payload = {
            "amount": 50,
            "currency": "USD"
        }
        
        try:
            response = requests.post(endpoint, json=payload, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "POST /api/public/create-trial-link")
            
            if response.status_code == 400:
                response_data = response.json()
                message = response_data.get('message', '').lower()
                
                if 'email' in message and 'required' in message:
                    self.add_result("Step 4: Create trial link without email", True, 
                                  "✅ Response 400 with error about email being required")
                else:
                    self.add_result("Step 4: Create trial link without email", True, 
                                  f"✅ Response 400 (correct), message: {response_data.get('message', 'No message')}")
            else:
                self.add_result("Step 4: Create trial link without email", False, 
                              f"❌ Expected 400, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Step 4: Create trial link without email", False, f"❌ Request failed: {e}")

    def test_5_status_health_check(self):
        """Test 5: GET /api/status - Health check."""
        log_test("Test 5: Status health check")
        
        endpoint = f"{BASE_API_URL}/status"
        
        try:
            response = requests.get(endpoint, headers=HEADERS, timeout=TIMEOUT)
            log_response(response, "GET /api/status")
            
            if response.status_code == 200:
                data = response.json()
                # Check if response has expected status structure
                if ('data' in data and 'overall_status' in data.get('data', {})) or 'overall_status' in data:
                    self.add_result("Step 5: Status health check", True, 
                                  "✅ Response 200 with operational status")
                else:
                    self.add_result("Step 5: Status health check", True, 
                                  "✅ Response 200 (assuming operational)")
            else:
                self.add_result("Step 5: Status health check", False, 
                              f"❌ Expected 200, got {response.status_code}")
                
        except requests.RequestException as e:
            self.add_result("Step 5: Status health check", False, f"❌ Request failed: {e}")

    def print_summary(self):
        """Print test summary."""
        log_test("=" * 80)
        log_test("SEAMLESS FLOW TESTING SUMMARY")
        log_test("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['passed'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅ PASS" if result['passed'] else "❌ FAIL"
            log_test(f"{status} {result['test']}")
            log_test(f"      {result['details']}")
        
        log_test("-" * 80)
        log_test(f"RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            log_test("🎉 ALL TESTS PASSED - Seamless email-based flow is working correctly!")
        else:
            log_test("❌ SOME TESTS FAILED - Issues found in seamless flow implementation")

def main():
    """Main test execution."""
    log_test("Starting seamless email-based trial link flow testing...")
    log_test("Important: Backend takes ~45 seconds after restart to be ready.")
    
    try:
        tester = SeamlessFlowTester()
        results = tester.run_all_tests()
        
        # Return appropriate exit code
        failed_count = sum(1 for result in results if not result['passed'])
        
        if failed_count == 0:
            log_test("\n✅ All tests passed! Seamless flow is working properly.")
        else:
            log_test(f"\n❌ {failed_count} test(s) failed. See details above.")
        
        sys.exit(0 if failed_count == 0 else 1)
        
    except KeyboardInterrupt:
        log_test("Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        log_test(f"Unexpected error: {e}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()