#!/usr/bin/env python3
"""
DynoPay Backend API Testing Script - Review Request Specific Tests
Tests the exact endpoints requested in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://dynopay-preview-2.preview.emergentagent.com/api"
TIMEOUT = 30

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    Details: {details}")

def test_health_check():
    """Test 1: GET /api/ — Health check, should return 200 with operational status"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            log_test("GET /api/ (Health Check)", "PASS", 
                    f"HTTP {response.status_code} - Status: {data.get('status')}, Service: {data.get('service')}")
            return True, response.status_code, data
        else:
            log_test("GET /api/ (Health Check)", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            return False, response.status_code, response.text
            
    except Exception as e:
        log_test("GET /api/ (Health Check)", "FAIL", f"Exception: {str(e)}")
        return False, None, str(e)

def test_calculate_fees_no_body():
    """Test 2: POST /api/pay/calculateFees — Should return 400 with validation error (no body)"""
    try:
        # Send POST request with no body (empty JSON)
        response = requests.post(f"{BASE_URL}/pay/calculateFees", json={}, timeout=TIMEOUT)
        
        if response.status_code == 400:
            try:
                data = response.json()
                log_test("POST /api/pay/calculateFees (No Body)", "PASS", 
                        f"HTTP {response.status_code} - Validation error: {data}")
                return True, response.status_code, data
            except:
                log_test("POST /api/pay/calculateFees (No Body)", "PASS", 
                        f"HTTP {response.status_code} - Validation error: {response.text}")
                return True, response.status_code, response.text
        else:
            log_test("POST /api/pay/calculateFees (No Body)", "FAIL", 
                    f"Expected HTTP 400, got HTTP {response.status_code}: {response.text}")
            return False, response.status_code, response.text
            
    except Exception as e:
        log_test("POST /api/pay/calculateFees (No Body)", "FAIL", f"Exception: {str(e)}")
        return False, None, str(e)

def test_network_fees():
    """Test 3: GET /api/pay/network-fees — Should return 200 with fee data"""
    try:
        response = requests.get(f"{BASE_URL}/pay/network-fees", timeout=TIMEOUT)
        
        if response.status_code == 200:
            try:
                data = response.json()
                log_test("GET /api/pay/network-fees", "PASS", 
                        f"HTTP {response.status_code} - Fee data retrieved successfully")
                return True, response.status_code, data
            except:
                log_test("GET /api/pay/network-fees", "PASS", 
                        f"HTTP {response.status_code} - Fee data retrieved: {response.text}")
                return True, response.status_code, response.text
        else:
            log_test("GET /api/pay/network-fees", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            return False, response.status_code, response.text
            
    except Exception as e:
        log_test("GET /api/pay/network-fees", "FAIL", f"Exception: {str(e)}")
        return False, None, str(e)

def test_geo_detect():
    """Test 4: GET /api/geo-detect — Should return 200 with geo data"""
    try:
        response = requests.get(f"{BASE_URL}/geo-detect", timeout=TIMEOUT)
        
        if response.status_code == 200:
            try:
                data = response.json()
                log_test("GET /api/geo-detect", "PASS", 
                        f"HTTP {response.status_code} - Country: {data.get('country', 'Unknown')}")
                return True, response.status_code, data
            except:
                log_test("GET /api/geo-detect", "PASS", 
                        f"HTTP {response.status_code} - Geo data: {response.text}")
                return True, response.status_code, response.text
        else:
            log_test("GET /api/geo-detect", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            return False, response.status_code, response.text
            
    except Exception as e:
        log_test("GET /api/geo-detect", "FAIL", f"Exception: {str(e)}")
        return False, None, str(e)

def main():
    """Run all review request tests and report results"""
    print("=" * 80)
    print("DynoPay Backend API Testing - Review Request Specific Tests")
    print(f"Target URL: {BASE_URL}")
    print("=" * 80)
    
    test_results = []
    detailed_results = {}
    
    # Run all tests
    success, status_code, response_data = test_health_check()
    test_results.append(("GET /api/ (Health Check)", success))
    detailed_results["health_check"] = {"status_code": status_code, "response": response_data}
    
    success, status_code, response_data = test_calculate_fees_no_body()
    test_results.append(("POST /api/pay/calculateFees (No Body)", success))
    detailed_results["calculate_fees_no_body"] = {"status_code": status_code, "response": response_data}
    
    success, status_code, response_data = test_network_fees()
    test_results.append(("GET /api/pay/network-fees", success))
    detailed_results["network_fees"] = {"status_code": status_code, "response": response_data}
    
    success, status_code, response_data = test_geo_detect()
    test_results.append(("GET /api/geo-detect", success))
    detailed_results["geo_detect"] = {"status_code": status_code, "response": response_data}
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "PASS" if result else "FAIL"
        emoji = "✅" if result else "❌"
        print(f"{emoji} {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    # Detailed Results
    print("\n" + "=" * 80)
    print("DETAILED RESULTS")
    print("=" * 80)
    
    for endpoint, details in detailed_results.items():
        print(f"\n{endpoint.upper()}:")
        print(f"  Status Code: {details['status_code']}")
        if isinstance(details['response'], dict):
            print(f"  Response: {json.dumps(details['response'], indent=2)}")
        else:
            print(f"  Response: {details['response']}")
    
    if passed == total:
        print("\n🎉 ALL REVIEW REQUEST TESTS PASSED!")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED - Review results above")
        return 1

if __name__ == "__main__":
    sys.exit(main())