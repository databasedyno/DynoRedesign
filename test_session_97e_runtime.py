#!/usr/bin/env python3
"""
Test 5: Runtime endpoint verification for Session 97e
Tests the /api/notifications/payout-digest/preview endpoint
"""

import requests
import json

BASE_URL = "https://dynopay-setup-10.preview.emergentagent.com"

def test_payout_digest_preview():
    print("=== Test 5: Runtime Endpoint Verification ===\n")
    
    # Step 1: Get CSRF token
    print("Step 1: GET /api/csrf-token")
    csrf_response = requests.get(f"{BASE_URL}/api/csrf-token")
    print(f"Status: {csrf_response.status_code}")
    
    if csrf_response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {csrf_response.status_code}")
        return False
    
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get("csrf_token") or csrf_data.get("csrfToken")
    if not csrf_token:
        print(f"❌ FAIL: No CSRF token in response")
        print(f"Response: {json.dumps(csrf_data, indent=2)}")
        return False
    print(f"CSRF Token: {csrf_token[:20]}...")
    print(f"✅ CSRF token obtained\n")
    
    # Step 2: Login
    print("Step 2: POST /api/user/login")
    login_payload = {
        "email": "hostbay@moxx.co",
        "password": "Katiekendra123@"
    }
    login_headers = {
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json"
    }
    
    login_response = requests.post(
        f"{BASE_URL}/api/user/login",
        json=login_payload,
        headers=login_headers,
        cookies=csrf_response.cookies
    )
    print(f"Status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {login_response.status_code}")
        print(f"Response: {login_response.text}")
        return False
    
    login_data = login_response.json()
    access_token = login_data.get("data", {}).get("accessToken")
    
    if not access_token:
        print(f"❌ FAIL: No accessToken in response")
        print(f"Response: {json.dumps(login_data, indent=2)}")
        return False
    
    print(f"Access Token: {access_token[:20]}...")
    print(f"✅ Login successful\n")
    
    # Step 3: Test payout digest preview endpoint
    print("Step 3: POST /api/notifications/payout-digest/preview")
    preview_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    preview_response = requests.post(
        f"{BASE_URL}/api/notifications/payout-digest/preview",
        headers=preview_headers
    )
    print(f"Status: {preview_response.status_code}")
    
    if preview_response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {preview_response.status_code}")
        print(f"Response: {preview_response.text}")
        return False
    
    preview_data = preview_response.json()
    print(f"\nResponse preview:")
    print(json.dumps(preview_data, indent=2)[:500] + "...")
    
    # Verify expected fields
    data = preview_data.get("data", {})
    sent = data.get("sent")
    digest = data.get("digest", {})
    settled_volume = digest.get("settledVolume")
    
    print(f"\nVerification:")
    print(f"  data.sent: {sent} (expected: true)")
    print(f"  data.digest.settledVolume: {settled_volume} (expected: number)")
    
    if sent != True:
        print(f"❌ FAIL: data.sent is not true")
        return False
    
    if not isinstance(settled_volume, (int, float)):
        print(f"❌ FAIL: data.digest.settledVolume is not a number")
        return False
    
    print(f"\n✅ PASS: Endpoint returns HTTP 200 with correct data structure")
    print(f"✅ data.sent === true")
    print(f"✅ data.digest.settledVolume is a number (${settled_volume})")
    
    return True

if __name__ == "__main__":
    try:
        success = test_payout_digest_preview()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
