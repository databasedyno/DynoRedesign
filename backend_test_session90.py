#!/usr/bin/env python3
"""
Backend Testing Script for Session 90: Creator Handle Reservation Feature
Tests server-side Redis-backed handle reservation with hard-lock during signup.

⚠️ SAFETY CRITICAL: 
- Merchant hostbay@moxx.co ALREADY HAS a handle on LIVE prod DB
- NEVER call PUT /api/user/creator/profile with a handle that would SUCCEED
- Only test the REJECT (409) path of finalize
"""

import requests
import json
import random
import string
import time
from typing import Dict, Any, Optional

# Base URL from review request
BASE_URL = "https://settlement-engine-16.preview.emergentagent.com"

# Test credentials (NO 2FA according to review request)
MERCHANT_EMAIL = "hostbay@moxx.co"
MERCHANT_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def generate_random_handle(prefix: str = "qa_res_") -> str:
    """Generate a random handle for testing"""
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{prefix}{random_suffix}"

def print_test_header(test_name: str):
    """Print formatted test header"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {test_name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_result(passed: bool, message: str):
    """Print test result"""
    status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
    print(f"{status}: {message}")

def print_json(data: Any, title: str = "Response"):
    """Pretty print JSON data"""
    print(f"\n{Colors.YELLOW}{title}:{Colors.RESET}")
    print(json.dumps(data, indent=2))

def login_merchant() -> Optional[str]:
    """Login as merchant and return Bearer token"""
    print_test_header("MERCHANT LOGIN")
    
    try:
        url = f"{BASE_URL}/api/user/login"
        payload = {
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PASSWORD
        }
        
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_json(data, "Login Response")
            
            # Extract token from response
            token = (
                data.get('token') or 
                data.get('data', {}).get('token') or
                data.get('data', {}).get('accessToken')
            )
            
            if token:
                print_result(True, f"Login successful, token obtained (length: {len(token)})")
                return token
            else:
                print_result(False, "Login response missing token")
                return None
        else:
            print_result(False, f"Login failed with status {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print_result(False, f"Login error: {str(e)}")
        return None

def test_1a_fresh_reserve() -> tuple[Optional[str], Optional[str]]:
    """Test 1a: Reserve a fresh unique handle"""
    print_test_header("TEST 1a: Fresh Handle Reservation")
    
    handle = generate_random_handle()
    print(f"Testing with handle: {handle}")
    
    try:
        url = f"{BASE_URL}/api/user/creator/reserve-handle"
        payload = {"handle": handle}
        
        print(f"POST {url} (NO auth header, NO CSRF token)")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        # Check response structure
        if response.status_code == 200:
            reserved = data.get('reserved') or data.get('data', {}).get('reserved')
            available = data.get('available') or data.get('data', {}).get('available')
            token = data.get('token') or data.get('data', {}).get('token')
            expires_in = data.get('expiresIn') or data.get('data', {}).get('expiresIn')
            
            passed = (
                reserved == True and
                available == True and
                token is not None and len(token) > 0 and
                expires_in == 3600
            )
            
            if passed:
                print_result(True, f"Fresh handle reserved successfully: reserved={reserved}, available={available}, token_length={len(token)}, expiresIn={expires_in}")
                return handle, token
            else:
                print_result(False, f"Response validation failed: reserved={reserved}, available={available}, token={token is not None}, expiresIn={expires_in}")
                return handle, token
        else:
            print_result(False, f"Request failed with status {response.status_code}")
            return handle, None
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
        return handle, None

def test_1b_same_handle_no_token(handle: str):
    """Test 1b: Try to reserve same handle without token"""
    print_test_header("TEST 1b: Same Handle Without Token")
    
    print(f"Testing with handle: {handle} (NO token)")
    
    try:
        url = f"{BASE_URL}/api/user/creator/reserve-handle"
        payload = {"handle": handle}
        
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        available = data.get('available') or data.get('data', {}).get('available')
        reason = data.get('reason') or data.get('data', {}).get('reason') or data.get('message', '')
        
        passed = (
            available == False and
            ('reserved' in reason.lower() or 'someone else' in reason.lower())
        )
        
        if passed:
            print_result(True, f"Correctly rejected: available={available}, reason='{reason}'")
        else:
            print_result(False, f"Unexpected response: available={available}, reason='{reason}'")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def test_1c_same_handle_with_token(handle: str, token: str):
    """Test 1c: Renew reservation with same token"""
    print_test_header("TEST 1c: Renew Reservation With Token")
    
    print(f"Testing with handle: {handle}, token: {token[:20]}...")
    
    try:
        url = f"{BASE_URL}/api/user/creator/reserve-handle"
        payload = {
            "handle": handle,
            "token": token
        }
        
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        reserved = data.get('reserved') or data.get('data', {}).get('reserved')
        
        passed = reserved == True
        
        if passed:
            print_result(True, f"Renewal successful: reserved={reserved}")
        else:
            print_result(False, f"Renewal failed: reserved={reserved}")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def test_1d_owned_handle():
    """Test 1d: Try to reserve already owned handle"""
    print_test_header("TEST 1d: Already Owned Handle")
    
    handle = "hostbay"
    print(f"Testing with handle: {handle} (already owned by merchant)")
    
    try:
        url = f"{BASE_URL}/api/user/creator/reserve-handle"
        payload = {"handle": handle}
        
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        available = data.get('available') or data.get('data', {}).get('available')
        reason = data.get('reason') or data.get('data', {}).get('reason') or data.get('message', '')
        
        passed = (
            available == False and
            'taken' in reason.lower()
        )
        
        if passed:
            print_result(True, f"Correctly rejected: available={available}, reason='{reason}'")
        else:
            print_result(False, f"Unexpected response: available={available}, reason='{reason}'")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def test_1e_invalid_handle():
    """Test 1e: Try to reserve invalid handle (too short)"""
    print_test_header("TEST 1e: Invalid Handle (Too Short)")
    
    handle = "ab"
    print(f"Testing with handle: {handle} (too short)")
    
    try:
        url = f"{BASE_URL}/api/user/creator/reserve-handle"
        payload = {"handle": handle}
        
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        available = data.get('available') or data.get('data', {}).get('available')
        reason = data.get('reason') or data.get('data', {}).get('reason') or data.get('message', '')
        
        passed = (
            available == False and
            ('validation' in reason.lower() or 'short' in reason.lower() or 'length' in reason.lower() or 'characters' in reason.lower())
        )
        
        if passed:
            print_result(True, f"Correctly rejected: available={available}, reason='{reason}'")
        else:
            print_result(False, f"Unexpected response: available={available}, reason='{reason}'")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def test_2a_check_handle_without_token(handle: str, token: str, auth_token: str):
    """Test 2a: Check reserved handle without token"""
    print_test_header("TEST 2a: Check Reserved Handle Without Token")
    
    print(f"Testing with handle: {handle} (reserved with token, but checking WITHOUT token)")
    
    try:
        url = f"{BASE_URL}/api/user/creator/check-handle?handle={handle}"
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        print(f"GET {url}")
        print(f"Headers: Authorization: Bearer {auth_token[:20]}...")
        
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        available = data.get('available') or data.get('data', {}).get('available')
        
        passed = available == False
        
        if passed:
            print_result(True, f"Correctly shows unavailable: available={available}")
        else:
            print_result(False, f"Should be unavailable: available={available}")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def test_2b_check_handle_with_token(handle: str, token: str, auth_token: str):
    """Test 2b: Check reserved handle with token"""
    print_test_header("TEST 2b: Check Reserved Handle With Token")
    
    print(f"Testing with handle: {handle}, token: {token[:20]}...")
    
    try:
        url = f"{BASE_URL}/api/user/creator/check-handle?handle={handle}&token={token}"
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        print(f"GET {url}")
        print(f"Headers: Authorization: Bearer {auth_token[:20]}...")
        
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        available = data.get('available') or data.get('data', {}).get('available')
        
        passed = available == True
        
        if passed:
            print_result(True, f"Correctly shows available: available={available}")
        else:
            print_result(False, f"Should be available: available={available}")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def test_2c_check_free_handle(auth_token: str):
    """Test 2c: Check random free handle"""
    print_test_header("TEST 2c: Check Random Free Handle")
    
    handle = generate_random_handle("free_")
    print(f"Testing with handle: {handle} (should be free)")
    
    try:
        url = f"{BASE_URL}/api/user/creator/check-handle?handle={handle}"
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        print(f"GET {url}")
        print(f"Headers: Authorization: Bearer {auth_token[:20]}...")
        
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        available = data.get('available') or data.get('data', {}).get('available')
        
        passed = available == True
        
        if passed:
            print_result(True, f"Correctly shows available: available={available}")
        else:
            print_result(False, f"Should be available: available={available}")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")

def get_merchant_profile(auth_token: str) -> Optional[str]:
    """Get merchant's current handle"""
    print_test_header("GET MERCHANT PROFILE")
    
    try:
        # Try multiple possible endpoints
        endpoints = [
            "/api/user/profile",
            "/api/user/creator/profile",
            "/api/user/me"
        ]
        
        for endpoint in endpoints:
            url = f"{BASE_URL}{endpoint}"
            headers = {"Authorization": f"Bearer {auth_token}"}
            
            print(f"Trying GET {url}")
            
            response = requests.get(url, headers=headers, timeout=30)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_json(data, "Profile Response")
                
                # Try to extract handle from various possible locations
                handle = (
                    data.get('handle') or 
                    data.get('data', {}).get('handle') or
                    data.get('user', {}).get('handle') or
                    data.get('creator_handle')
                )
                
                if handle:
                    print_result(True, f"Current handle: {handle}")
                    return handle
                else:
                    print(f"No handle found in response from {endpoint}")
            else:
                print(f"Failed with status {response.status_code}")
        
        print_result(False, "Could not retrieve merchant profile from any endpoint")
        return None
        
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
        return None

def test_3_finalize_guard(auth_token: str):
    """Test 3: Finalize guard - REJECT PATH ONLY"""
    print_test_header("TEST 3: Finalize Guard (REJECT PATH ONLY)")
    
    # Step 3a: Reserve a fresh handle and discard token
    guard_handle = generate_random_handle("guardtest_")
    print(f"\nStep 3a: Reserving handle: {guard_handle}")
    
    try:
        url = f"{BASE_URL}/api/user/creator/reserve-handle"
        payload = {"handle": guard_handle}
        
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            reserved_token = data.get('token') or data.get('data', {}).get('token')
            print_result(True, f"Handle reserved, token obtained (DISCARDING IT)")
            print(f"Token (discarded): {reserved_token[:20] if reserved_token else 'None'}...")
        else:
            print_result(False, f"Failed to reserve handle: {response.status_code}")
            return
    except Exception as e:
        print_result(False, f"Error reserving handle: {str(e)}")
        return
    
    # Step 3b: Get merchant's current handle BEFORE attempting update
    print(f"\nStep 3b: Getting merchant's handle BEFORE update attempt")
    handle_before = get_merchant_profile(auth_token)
    
    if not handle_before:
        print_result(False, "Could not get merchant's handle before update")
        return
    
    print(f"\n{Colors.YELLOW}⚠️  MERCHANT HANDLE BEFORE: {handle_before}{Colors.RESET}")
    
    # Step 3c: Try to finalize with NO token (or wrong token) - should get 409
    print(f"\nStep 3c: Attempting to finalize with handle: {guard_handle} (NO/wrong token)")
    
    try:
        url = f"{BASE_URL}/api/user/creator/profile"
        headers = {"Authorization": f"Bearer {auth_token}"}
        payload = {
            "handle": guard_handle,
            # Deliberately NO handle_reservation_token or wrong one
            "handle_reservation_token": "wrong_token_12345"
        }
        
        print(f"PUT {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.put(url, json=payload, headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print_json(data, "Response")
        
        # Should get 409 with message about reserved by someone else
        if response.status_code == 409:
            message = data.get('message', '') or data.get('error', '')
            if 'reserved' in message.lower():
                print_result(True, f"Correctly rejected with 409: {message}")
            else:
                print_result(False, f"Got 409 but unexpected message: {message}")
        else:
            print_result(False, f"Expected 409, got {response.status_code}")
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
    
    # Step 3d: Verify merchant's handle is UNCHANGED
    print(f"\nStep 3d: Verifying merchant's handle is UNCHANGED")
    handle_after = get_merchant_profile(auth_token)
    
    if handle_after:
        print(f"\n{Colors.YELLOW}⚠️  MERCHANT HANDLE AFTER: {handle_after}{Colors.RESET}")
        
        if handle_before == handle_after:
            print_result(True, f"✅ CRITICAL: Merchant handle UNCHANGED: {handle_before} == {handle_after}")
        else:
            print_result(False, f"🚨 CRITICAL: Merchant handle CHANGED: {handle_before} != {handle_after}")
    else:
        print_result(False, "Could not verify merchant's handle after update")

def main():
    """Main test execution"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}SESSION 90: Creator Handle Reservation Backend Tests{Colors.RESET}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    # Login first
    auth_token = login_merchant()
    if not auth_token:
        print(f"\n{Colors.RED}❌ CRITICAL: Cannot proceed without authentication{Colors.RESET}")
        return
    
    print(f"\n{Colors.GREEN}✅ Authentication successful, proceeding with tests...{Colors.RESET}")
    
    # Test 1: Public reserve endpoint
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST GROUP 1: Public Reserve Endpoint (NO auth, NO CSRF){Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    # Test 1a: Fresh reserve
    handle, token = test_1a_fresh_reserve()
    
    if handle and token:
        # Test 1b: Same handle without token
        test_1b_same_handle_no_token(handle)
        
        # Test 1c: Same handle with token (renewal)
        test_1c_same_handle_with_token(handle, token)
    
    # Test 1d: Owned handle
    test_1d_owned_handle()
    
    # Test 1e: Invalid handle
    test_1e_invalid_handle()
    
    # Test 2: Check-handle endpoint (authenticated)
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST GROUP 2: Check-Handle Endpoint (Authenticated){Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    # Reserve a new handle for test 2
    handle2, token2 = test_1a_fresh_reserve()
    
    if handle2 and token2:
        # Test 2a: Check without token
        test_2a_check_handle_without_token(handle2, token2, auth_token)
        
        # Test 2b: Check with token
        test_2b_check_handle_with_token(handle2, token2, auth_token)
    
    # Test 2c: Check free handle
    test_2c_check_free_handle(auth_token)
    
    # Test 3: Finalize guard (REJECT PATH ONLY)
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST GROUP 3: Finalize Guard - REJECT PATH ONLY{Colors.RESET}")
    print(f"{Colors.BLUE}⚠️  SAFETY CRITICAL: Testing rejection only, NOT success path{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    test_3_finalize_guard(auth_token)
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}ALL TESTS COMPLETED{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")

if __name__ == "__main__":
    main()
