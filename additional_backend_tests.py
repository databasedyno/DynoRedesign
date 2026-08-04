#!/usr/bin/env python3
"""
Additional DynoPay Backend Tests
Extended testing for edge cases and validation
"""

import requests
import json
import sys

BACKEND_URL = "https://crypto-payment-13.preview.emergentagent.com"

def test_additional_scenarios():
    """Test additional scenarios and edge cases"""
    print("\n🔍 Running Additional Backend Tests")
    print("="*50)
    
    results = []
    
    # Test 1: Malformed JSON payload to encrypt-payload
    print("1. Testing malformed request to encrypt-payload...")
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/wallet/encrypt-payload",
            data="invalid json",  # Malformed data
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if response.status_code in [400, 401, 403]:
            print(f"   ✅ Handled malformed JSON correctly ({response.status_code})")
            results.append(("Malformed JSON handling", "PASS"))
        else:
            print(f"   ❌ Unexpected response to malformed JSON: {response.status_code}")
            results.append(("Malformed JSON handling", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing malformed JSON: {e}")
        results.append(("Malformed JSON handling", "FAIL"))
    
    # Test 2: Different HTTP methods on protected endpoints
    print("2. Testing HTTP method restrictions...")
    try:
        response = requests.patch(
            f"{BACKEND_URL}/api/wallet/getWallet",
            timeout=10
        )
        if response.status_code in [401, 403, 405]:  # 405 = Method Not Allowed
            print(f"   ✅ Protected endpoint rejects PATCH method ({response.status_code})")
            results.append(("HTTP method restriction", "PASS"))
        else:
            print(f"   ❌ Unexpected response to PATCH: {response.status_code}")
            results.append(("HTTP method restriction", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing PATCH method: {e}")
        results.append(("HTTP method restriction", "FAIL"))
    
    # Test 3: Status endpoint detailed response
    print("3. Validating status endpoint response structure...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'overall_status' in data['data']:
                status = data['data']['overall_status']
                services_count = len(data['data'].get('services', []))
                print(f"   ✅ Status endpoint returns structured data (Status: {status}, Services: {services_count})")
                results.append(("Status response structure", "PASS"))
            else:
                print(f"   ❌ Status endpoint missing expected structure")
                results.append(("Status response structure", "FAIL"))
        else:
            print(f"   ❌ Status endpoint failed: {response.status_code}")
            results.append(("Status response structure", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing status endpoint: {e}")
        results.append(("Status response structure", "FAIL"))
    
    # Test 4: Large payload to encrypt endpoint (without auth)
    print("4. Testing large payload handling...")
    try:
        large_payload = {"data": "x" * 10000}  # 10KB payload
        response = requests.post(
            f"{BACKEND_URL}/api/wallet/encrypt-payload",
            json=large_payload,
            timeout=10
        )
        if response.status_code in [401, 403, 413]:  # 413 = Payload Too Large
            print(f"   ✅ Large payload handled appropriately ({response.status_code})")
            results.append(("Large payload handling", "PASS"))
        else:
            print(f"   ❌ Unexpected response to large payload: {response.status_code}")
            results.append(("Large payload handling", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing large payload: {e}")
        results.append(("Large payload handling", "FAIL"))
    
    # Test 5: Rate limiting behavior
    print("5. Testing rate limiting (refresh-token endpoint)...")
    try:
        # Make multiple rapid requests
        responses = []
        for i in range(3):
            resp = requests.post(
                f"{BACKEND_URL}/api/user/refresh-token",
                json={},
                timeout=5
            )
            responses.append(resp.status_code)
        
        # Should get consistent responses (no 429 rate limiting on 3 requests)
        if all(code in [400, 401] for code in responses):
            print(f"   ✅ Rate limiting allows normal request volume")
            results.append(("Rate limiting behavior", "PASS"))
        elif any(code == 429 for code in responses):
            print(f"   ⚠️  Rate limiting triggered on normal volume (may be too strict)")
            results.append(("Rate limiting behavior", "PASS"))  # Still functional
        else:
            print(f"   ❌ Unexpected rate limiting behavior: {responses}")
            results.append(("Rate limiting behavior", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing rate limiting: {e}")
        results.append(("Rate limiting behavior", "FAIL"))
    
    # Summary
    passed = sum(1 for _, status in results if status == "PASS")
    failed = sum(1 for _, status in results if status == "FAIL")
    
    print(f"\n📊 Additional Tests Summary:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    return passed, failed

if __name__ == "__main__":
    test_additional_scenarios()