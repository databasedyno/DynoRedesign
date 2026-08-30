#!/usr/bin/env python3
"""
Backend API Test for DynoPay Referral Leaderboard Endpoints
STRICTLY READ-ONLY - No data mutations, no login required for public endpoints
"""

import requests
import json
import sys

# Base URL from the review request
BASE_URL = "https://f4fac0c7-89cb-481b-b75e-9154e7929f58.preview.emergentagent.com"

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_public_leaderboard():
    """
    TEST 1 (PRIMARY): GET /api/referral/leaderboard/public
    Expected:
    - HTTP 200
    - JSON body has data.leaderboard which is an ARRAY
    - Each item contains ONLY: rank (integer) and referral_count (integer)
    - CRITICAL PRIVACY CHECK: items must NOT contain: name, user_id, email, total_earnings, referral_code
    - No Authorization header required
    - Empty array [] is acceptable/expected
    """
    print_section("TEST 1: Public Referral Leaderboard (NEW endpoint)")
    
    # Test 1a: Default limit
    print("TEST 1a: GET /api/referral/leaderboard/public (default limit)")
    url = f"{BASE_URL}/api/referral/leaderboard/public"
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ Status code 200 - PASSED")
        
        # Parse JSON
        try:
            data = response.json()
            print(f"\nResponse JSON structure:")
            print(json.dumps(data, indent=2))
        except json.JSONDecodeError as e:
            print(f"❌ FAILED: Invalid JSON response: {e}")
            return False
        
        # Check data.leaderboard exists and is an array
        if 'data' not in data:
            print("❌ FAILED: Response missing 'data' key")
            return False
        
        if 'leaderboard' not in data['data']:
            print("❌ FAILED: Response missing 'data.leaderboard' key")
            return False
        
        leaderboard = data['data']['leaderboard']
        
        if not isinstance(leaderboard, list):
            print(f"❌ FAILED: data.leaderboard is not an array, got {type(leaderboard)}")
            return False
        
        print(f"✅ data.leaderboard is an ARRAY - PASSED")
        print(f"   Array length: {len(leaderboard)}")
        
        # If empty, that's acceptable
        if len(leaderboard) == 0:
            print("✅ Empty leaderboard array [] - ACCEPTABLE (no referrers with count>0 in prod)")
            print("\n✅ TEST 1a PASSED (empty array is expected/acceptable)")
            return True
        
        # CRITICAL PRIVACY CHECK: Verify each item has ONLY rank and referral_count
        print(f"\nCRITICAL PRIVACY CHECK: Verifying items contain ONLY rank and referral_count...")
        
        forbidden_keys = ['name', 'user_id', 'email', 'total_earnings', 'referral_code']
        privacy_passed = True
        
        for i, item in enumerate(leaderboard):
            print(f"\n  Item {i+1}: {json.dumps(item)}")
            
            # Check required keys
            if 'rank' not in item:
                print(f"    ❌ FAILED: Missing 'rank' key")
                privacy_passed = False
            elif not isinstance(item['rank'], int):
                print(f"    ❌ FAILED: 'rank' is not an integer, got {type(item['rank'])}")
                privacy_passed = False
            else:
                print(f"    ✅ 'rank' present and is integer: {item['rank']}")
            
            if 'referral_count' not in item:
                print(f"    ❌ FAILED: Missing 'referral_count' key")
                privacy_passed = False
            elif not isinstance(item['referral_count'], int):
                print(f"    ❌ FAILED: 'referral_count' is not an integer, got {type(item['referral_count'])}")
                privacy_passed = False
            else:
                print(f"    ✅ 'referral_count' present and is integer: {item['referral_count']}")
            
            # Check for forbidden keys (PII/earnings)
            item_keys = set(item.keys())
            found_forbidden = item_keys.intersection(forbidden_keys)
            
            if found_forbidden:
                print(f"    ❌ CRITICAL PRIVACY VIOLATION: Found forbidden keys: {found_forbidden}")
                privacy_passed = False
            else:
                print(f"    ✅ No PII/earnings keys found")
            
            # Check for extra keys beyond rank and referral_count
            expected_keys = {'rank', 'referral_count'}
            extra_keys = item_keys - expected_keys
            
            if extra_keys:
                print(f"    ⚠️  WARNING: Extra keys found: {extra_keys}")
                privacy_passed = False
        
        if privacy_passed:
            print("\n✅ PRIVACY CHECK PASSED: All items contain ONLY rank and referral_count")
            print("✅ TEST 1a PASSED")
            return True
        else:
            print("\n❌ PRIVACY CHECK FAILED: Items contain forbidden or extra keys")
            print("❌ TEST 1a FAILED")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False

def test_public_leaderboard_with_limit():
    """
    TEST 1b: GET /api/referral/leaderboard/public?limit=5
    Same checks as TEST 1a but with limit parameter
    """
    print_section("TEST 1b: Public Referral Leaderboard with limit=5")
    
    url = f"{BASE_URL}/api/referral/leaderboard/public?limit=5"
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ Status code 200 - PASSED")
        
        # Parse JSON
        try:
            data = response.json()
            print(f"\nResponse JSON structure:")
            print(json.dumps(data, indent=2))
        except json.JSONDecodeError as e:
            print(f"❌ FAILED: Invalid JSON response: {e}")
            return False
        
        # Check data.leaderboard exists and is an array
        if 'data' not in data or 'leaderboard' not in data['data']:
            print("❌ FAILED: Response missing 'data.leaderboard'")
            return False
        
        leaderboard = data['data']['leaderboard']
        
        if not isinstance(leaderboard, list):
            print(f"❌ FAILED: data.leaderboard is not an array")
            return False
        
        print(f"✅ data.leaderboard is an ARRAY - PASSED")
        print(f"   Array length: {len(leaderboard)}")
        
        # Verify limit is respected (max 5 items)
        if len(leaderboard) > 5:
            print(f"❌ FAILED: Limit not respected, got {len(leaderboard)} items (expected max 5)")
            return False
        
        print(f"✅ Limit respected (≤5 items) - PASSED")
        
        # If empty, that's acceptable
        if len(leaderboard) == 0:
            print("✅ Empty leaderboard array [] - ACCEPTABLE")
            print("\n✅ TEST 1b PASSED")
            return True
        
        # Quick privacy check on first item
        print(f"\nQuick privacy check on first item:")
        item = leaderboard[0]
        print(f"  Item: {json.dumps(item)}")
        
        forbidden_keys = ['name', 'user_id', 'email', 'total_earnings', 'referral_code']
        item_keys = set(item.keys())
        found_forbidden = item_keys.intersection(forbidden_keys)
        
        if found_forbidden:
            print(f"  ❌ CRITICAL PRIVACY VIOLATION: Found forbidden keys: {found_forbidden}")
            print("❌ TEST 1b FAILED")
            return False
        
        expected_keys = {'rank', 'referral_count'}
        if item_keys != expected_keys:
            print(f"  ❌ FAILED: Keys mismatch. Expected {expected_keys}, got {item_keys}")
            print("❌ TEST 1b FAILED")
            return False
        
        print(f"  ✅ Privacy check passed")
        print("\n✅ TEST 1b PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False

def test_existing_leaderboard():
    """
    TEST 2 (REGRESSION): GET /api/referral/leaderboard?limit=3
    Expected:
    - HTTP 200
    - data.leaderboard array (usual shape)
    - This existing endpoint MAY include name/total_earnings (that's fine)
    - Just confirms we didn't break the existing endpoint
    """
    print_section("TEST 2: Existing Referral Leaderboard (REGRESSION)")
    
    url = f"{BASE_URL}/api/referral/leaderboard?limit=3"
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ Status code 200 - PASSED")
        
        # Parse JSON
        try:
            data = response.json()
            print(f"\nResponse JSON structure:")
            print(json.dumps(data, indent=2))
        except json.JSONDecodeError as e:
            print(f"❌ FAILED: Invalid JSON response: {e}")
            return False
        
        # Check data.leaderboard exists and is an array
        if 'data' not in data or 'leaderboard' not in data['data']:
            print("❌ FAILED: Response missing 'data.leaderboard'")
            return False
        
        leaderboard = data['data']['leaderboard']
        
        if not isinstance(leaderboard, list):
            print(f"❌ FAILED: data.leaderboard is not an array")
            return False
        
        print(f"✅ data.leaderboard is an ARRAY - PASSED")
        print(f"   Array length: {len(leaderboard)}")
        
        # Verify limit is respected (max 3 items)
        if len(leaderboard) > 3:
            print(f"❌ FAILED: Limit not respected, got {len(leaderboard)} items (expected max 3)")
            return False
        
        print(f"✅ Limit respected (≤3 items) - PASSED")
        
        # If empty, that's acceptable
        if len(leaderboard) == 0:
            print("✅ Empty leaderboard array [] - ACCEPTABLE")
            print("\n✅ TEST 2 PASSED (regression check - endpoint still works)")
            return True
        
        # Show structure of first item (this endpoint MAY include name/earnings - that's fine)
        print(f"\nFirst item structure (this endpoint MAY include name/earnings - that's OK):")
        item = leaderboard[0]
        print(f"  Keys: {list(item.keys())}")
        print(f"  Item: {json.dumps(item)}")
        
        # Just verify it has rank and referral_count at minimum
        if 'rank' not in item or 'referral_count' not in item:
            print(f"  ❌ FAILED: Missing required keys (rank, referral_count)")
            print("❌ TEST 2 FAILED")
            return False
        
        print(f"  ✅ Has required keys (rank, referral_count)")
        print("\n✅ TEST 2 PASSED (regression check - endpoint still works)")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  BACKEND API TEST: Referral Leaderboard Endpoints")
    print("  STRICTLY READ-ONLY - No data mutations")
    print("="*80)
    print(f"\nBase URL: {BASE_URL}")
    print(f"Testing endpoints:")
    print(f"  1. GET /api/referral/leaderboard/public (NEW - privacy-safe)")
    print(f"  2. GET /api/referral/leaderboard/public?limit=5 (NEW - with limit)")
    print(f"  3. GET /api/referral/leaderboard?limit=3 (EXISTING - regression)")
    
    results = {
        "TEST 1a: Public leaderboard (default)": test_public_leaderboard(),
        "TEST 1b: Public leaderboard (limit=5)": test_public_leaderboard_with_limit(),
        "TEST 2: Existing leaderboard (regression)": test_existing_leaderboard(),
    }
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
