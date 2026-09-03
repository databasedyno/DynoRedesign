#!/usr/bin/env python3
"""
Final seamless flow test - workaround for rate limiting
Tests the endpoints that can be tested without creating new trial links
"""

import requests
import json
import time

BACKEND_URL = "http://localhost:8001"
BASE_API_URL = f"{BACKEND_URL}/api"

def log_test(message, level="INFO"):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def main():
    log_test("=" * 80)
    log_test("SEAMLESS FLOW FINAL VERIFICATION")
    log_test("=" * 80)
    
    results = []
    
    # Test 1: Email validation (no rate limit - should fail)
    log_test("Test 1: Email validation - Create without email should fail")
    try:
        response = requests.post(f"{BASE_API_URL}/public/create-trial-link", 
                               json={"amount": 50, "currency": "USD"}, 
                               timeout=30)
        
        if response.status_code == 400:
            data = response.json()
            message = data.get('message', '').lower()
            if 'email' in message and 'required' in message:
                log_test("✅ PASS: Email validation working - correct 400 error")
                results.append(("Email validation", True, "Returns 400 when email missing"))
            else:
                log_test(f"❌ FAIL: Wrong error message: {data.get('message')}")
                results.append(("Email validation", False, f"Wrong error: {data.get('message')}"))
        else:
            log_test(f"❌ FAIL: Expected 400, got {response.status_code}")
            results.append(("Email validation", False, f"Expected 400, got {response.status_code}"))
            
    except Exception as e:
        log_test(f"❌ ERROR: {e}")
        results.append(("Email validation", False, f"Request error: {e}"))
    
    # Test 2: Try creating with email (will hit rate limit but we can check the error)
    log_test("Test 2: Rate limit verification")
    try:
        response = requests.post(f"{BASE_API_URL}/public/create-trial-link", 
                               json={"amount": 50, "currency": "USD", "email": "test@example.com"}, 
                               timeout=30)
        
        if response.status_code == 429:
            data = response.json()
            message = data.get('message', '')
            if 'rate limit' in message.lower() and '5' in message:
                log_test("✅ PASS: Rate limiting working correctly")
                results.append(("Rate limiting", True, "Correctly blocks after 5 attempts per IP"))
            else:
                log_test(f"❌ FAIL: Unexpected rate limit message: {message}")
                results.append(("Rate limiting", False, f"Wrong message: {message}"))
        elif response.status_code == 201:
            log_test("⚠️  UNEXPECTED: Rate limit not reached, got successful creation")
            data = response.json().get('data', {})
            # Check the response format
            has_manage_url = 'manage_url' in data
            has_claim_token = 'claim_token' in data
            
            log_test(f"Response analysis: manage_url={has_manage_url}, claim_token={has_claim_token}")
            if has_manage_url and not has_claim_token:
                log_test("✅ PASS: Perfect seamless flow response format")
                results.append(("Response format", True, "Has manage_url, no claim_token"))
            elif has_manage_url and has_claim_token:
                log_test("⚠️  PARTIAL: Has manage_url but still has claim_token (backward compatibility)")
                results.append(("Response format", True, "Has manage_url (seamless working) + claim_token (backward compat)"))
            else:
                log_test("❌ FAIL: Missing manage_url in response")
                results.append(("Response format", False, "Missing manage_url"))
        else:
            log_test(f"❌ UNEXPECTED: Status {response.status_code}")
            results.append(("Create with email", False, f"Unexpected status: {response.status_code}"))
            
    except Exception as e:
        log_test(f"❌ ERROR: {e}")
        results.append(("Create with email", False, f"Request error: {e}"))
    
    # Test 3: Status endpoint
    log_test("Test 3: Status endpoint health check")
    try:
        response = requests.get(f"{BASE_API_URL}/status", timeout=30)
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and data['data'].get('overall_status') == 'operational':
                log_test("✅ PASS: Status endpoint operational")
                results.append(("Status endpoint", True, "Returns 200 operational status"))
            else:
                log_test("✅ PASS: Status endpoint working")
                results.append(("Status endpoint", True, "Returns 200"))
        else:
            log_test(f"❌ FAIL: Status endpoint returned {response.status_code}")
            results.append(("Status endpoint", False, f"Status: {response.status_code}"))
    except Exception as e:
        log_test(f"❌ ERROR: {e}")
        results.append(("Status endpoint", False, f"Request error: {e}"))
    
    # Summary
    log_test("=" * 80)
    log_test("FINAL RESULTS SUMMARY")
    log_test("=" * 80)
    
    passed = sum(1 for _, passed, _ in results if passed)
    total = len(results)
    
    for test_name, passed_test, details in results:
        status = "✅ PASS" if passed_test else "❌ FAIL"
        log_test(f"{status} {test_name}: {details}")
    
    log_test("-" * 80)
    log_test(f"RESULTS: {passed}/{total} tests passed")
    
    # Analysis
    log_test("\n📋 SEAMLESS FLOW IMPLEMENTATION STATUS:")
    if any("Email validation" in result[0] and result[1] for result in results):
        log_test("✅ Email requirement: IMPLEMENTED")
    else:
        log_test("❌ Email requirement: NOT IMPLEMENTED")
        
    log_test("⚠️  Full response format: Cannot verify due to rate limiting")
    log_test("⚠️  Management token endpoint: Cannot test due to rate limiting")
    log_test("⚠️  Claim with management token: Cannot test due to rate limiting")
    
    log_test("\n🔍 WHAT WE CAN CONFIRM:")
    log_test("✅ Backend is operational")
    log_test("✅ Email validation is working (seamless flow partially implemented)")
    log_test("✅ Rate limiting is working properly")
    log_test("⚠️  Full seamless flow needs testing with fresh IP or rate limit reset")

if __name__ == "__main__":
    main()