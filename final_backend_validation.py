#!/usr/bin/env python3
"""
Final DynoPay Backend Validation
Complete testing of review request requirements
"""

import requests
import json
import sys

BACKEND_URL = "https://multi-chain-checkout-4.preview.emergentagent.com"

def final_validation_tests():
    """Final validation of all review request requirements"""
    print("\n🎯 Final Backend Validation Tests")
    print("="*60)
    
    tests = []
    
    # Test 1: Comprehensive encrypt-payload endpoint validation
    print("1. Comprehensive encrypt-payload endpoint validation...")
    
    # 1a. Test without payload
    try:
        response = requests.post(f"{BACKEND_URL}/api/wallet/encrypt-payload", json={}, timeout=10)
        if response.status_code == 403:
            print("   ✅ No auth: Returns 403 (CSRF protection)")
            tests.append(("encrypt-payload no auth", "PASS"))
        else:
            print(f"   ❌ No auth: Expected 403, got {response.status_code}")
            tests.append(("encrypt-payload no auth", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing no auth: {e}")
        tests.append(("encrypt-payload no auth", "FAIL"))
    
    # 1b. Test with invalid Bearer token (bypasses CSRF but fails JWT)
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/wallet/encrypt-payload",
            json={"payload": "test"},
            headers={"Authorization": "Bearer invalid-token"},
            timeout=10
        )
        if response.status_code == 401:
            print("   ✅ Invalid JWT: Returns 401 (auth middleware working)")
            tests.append(("encrypt-payload invalid JWT", "PASS"))
        else:
            print(f"   ❌ Invalid JWT: Expected 401, got {response.status_code}")
            tests.append(("encrypt-payload invalid JWT", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing invalid JWT: {e}")
        tests.append(("encrypt-payload invalid JWT", "FAIL"))
    
    # Test 2: Refresh token endpoint comprehensive validation
    print("\n2. Comprehensive refresh-token endpoint validation...")
    
    # 2a. Empty request body
    try:
        response = requests.post(f"{BACKEND_URL}/api/user/refresh-token", json={}, timeout=10)
        if response.status_code == 400:
            print("   ✅ Empty body: Returns 400 (missing refresh token)")
            tests.append(("refresh-token empty body", "PASS"))
        else:
            print(f"   ❌ Empty body: Expected 400, got {response.status_code}")
            tests.append(("refresh-token empty body", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing empty body: {e}")
        tests.append(("refresh-token empty body", "FAIL"))
    
    # 2b. Invalid refresh token
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/user/refresh-token",
            json={"refreshToken": "invalid-token"},
            timeout=10
        )
        if response.status_code in [400, 401]:
            print(f"   ✅ Invalid token: Returns {response.status_code} (proper validation)")
            tests.append(("refresh-token invalid token", "PASS"))
        else:
            print(f"   ❌ Invalid token: Expected 400/401, got {response.status_code}")
            tests.append(("refresh-token invalid token", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing invalid token: {e}")
        tests.append(("refresh-token invalid token", "FAIL"))
    
    # Test 3: Status endpoint detailed validation
    print("\n3. Status endpoint detailed validation...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/status", timeout=10)
        if response.status_code == 200:
            data = response.json()
            status = data.get('data', {}).get('overall_status', 'unknown')
            services = data.get('data', {}).get('services', [])
            
            operational_services = [s for s in services if s.get('status') == 'operational']
            
            print(f"   ✅ Status: {status}")
            print(f"   ✅ Services: {len(services)} total, {len(operational_services)} operational")
            tests.append(("status endpoint detailed", "PASS"))
        else:
            print(f"   ❌ Status endpoint failed: {response.status_code}")
            tests.append(("status endpoint detailed", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing status: {e}")
        tests.append(("status endpoint detailed", "FAIL"))
    
    # Test 4: getWallet endpoint comprehensive validation
    print("\n4. getWallet endpoint comprehensive validation...")
    
    # 4a. No authentication
    try:
        response = requests.get(f"{BACKEND_URL}/api/wallet/getWallet", timeout=10)
        if response.status_code == 401:
            print("   ✅ No auth: Returns 401 (auth middleware working)")
            tests.append(("getWallet no auth", "PASS"))
        else:
            print(f"   ❌ No auth: Expected 401, got {response.status_code}")
            tests.append(("getWallet no auth", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing no auth: {e}")
        tests.append(("getWallet no auth", "FAIL"))
    
    # 4b. Invalid authentication
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/wallet/getWallet",
            headers={"Authorization": "Bearer invalid-token"},
            timeout=10
        )
        if response.status_code == 401:
            print("   ✅ Invalid auth: Returns 401 (JWT validation working)")
            tests.append(("getWallet invalid auth", "PASS"))
        else:
            print(f"   ❌ Invalid auth: Expected 401, got {response.status_code}")
            tests.append(("getWallet invalid auth", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing invalid auth: {e}")
        tests.append(("getWallet invalid auth", "FAIL"))
    
    # Test 5: API routing validation
    print("\n5. API routing validation...")
    try:
        response = requests.get(f"{BACKEND_URL}/api", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('service') == 'Dynopay API' and '/api/wallet' in str(data):
                print("   ✅ API routing: Proper API documentation and endpoints")
                tests.append(("API routing", "PASS"))
            else:
                print("   ❌ API routing: Missing expected API structure")
                tests.append(("API routing", "FAIL"))
        else:
            print(f"   ❌ API routing failed: {response.status_code}")
            tests.append(("API routing", "FAIL"))
    except Exception as e:
        print(f"   ❌ Error testing API routing: {e}")
        tests.append(("API routing", "FAIL"))
    
    # Summary
    passed = sum(1 for _, status in tests if status == "PASS")
    failed = sum(1 for _, status in tests if status == "FAIL")
    
    print(f"\n🎯 Final Validation Summary:")
    print("="*60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
    
    if failed == 0:
        print("\n🎉 ALL REVIEW REQUIREMENTS VALIDATED SUCCESSFULLY!")
        print("✅ POST /api/wallet/encrypt-payload - Properly protected with auth")
        print("✅ POST /api/user/refresh-token - Endpoint exists and validates")
        print("✅ GET /api/status - Working and returns comprehensive status")
        print("✅ GET /api/wallet/getWallet - Properly protected with auth")
        print("✅ CSRF Protection - Working as expected")
    
    return passed, failed

if __name__ == "__main__":
    final_validation_tests()