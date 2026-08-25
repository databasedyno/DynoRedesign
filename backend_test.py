#!/usr/bin/env python3
"""
Backend API Testing for DynoPay Profile Photo & Brand Logo Bug Fix
===================================================================
PRODUCTION DATABASE - MINIMAL WRITES ONLY (1 photo + 1 logo upload max)

Test Cases:
1. Profile photo-only update (the core fix) - expect 200
2. Photo removal - expect 200
3. Invalid email format (regression check) - expect 400
4. Brand logo-only update - expect 200
"""

import requests
import io
from PIL import Image

# Base URL
BASE_URL = "https://dynopay-credentials.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

# Global token storage
access_token = None

def create_test_image(size=(100, 100), color=(255, 0, 0)):
    """Create a small test image in memory"""
    img = Image.new('RGB', size, color)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes

def login():
    """Login and get access token"""
    global access_token
    print("\n" + "="*70)
    print("AUTHENTICATION")
    print("="*70)
    
    url = f"{API_BASE}/user/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    print(f"\n[LOGIN] POST {url}")
    print(f"Payload: {payload}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'accessToken' in data['data']:
                access_token = data['data']['accessToken']
                print(f"✅ Login successful! Token obtained (length: {len(access_token)})")
                return True
            else:
                print(f"❌ Login response missing accessToken")
                return False
        else:
            print(f"❌ Login failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False

def test_profile_photo_only_update():
    """
    TEST CASE 1: Profile photo-only update (THE CORE BUG FIX)
    Expected: HTTP 200 with message "User updated successfully!"
    Bug was: returned 400 "Please enter proper values!" because validation required name+email
    """
    print("\n" + "="*70)
    print("TEST CASE 1: Profile Photo-Only Update (Core Bug Fix)")
    print("="*70)
    
    url = f"{API_BASE}/user/updateUser"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # Create a small test image
    img_bytes = create_test_image(size=(50, 50), color=(255, 100, 100))
    
    # Multipart form data: image file + empty data object
    files = {
        'image': ('test_profile.png', img_bytes, 'image/png')
    }
    data = {
        'data': '{}'  # Empty JSON object - no name, no email
    }
    
    print(f"\n[TEST 1] PUT {url}")
    print(f"Headers: Authorization: Bearer <token>")
    print(f"Files: image=test_profile.png (50x50 PNG)")
    print(f"Data: data={{}}")
    print(f"Expected: HTTP 200 with message 'User updated successfully!'")
    
    try:
        response = requests.put(url, headers=headers, files=files, data=data, timeout=15)
        print(f"\nActual Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            resp_json = response.json()
            message = resp_json.get('message', '')
            if 'User updated successfully' in message:
                print(f"✅ TEST 1 PASSED: Photo-only update returned 200 with correct message")
                return True
            else:
                print(f"⚠️ TEST 1 PARTIAL: Got 200 but message was: {message}")
                return True
        elif response.status_code == 400:
            resp_json = response.json()
            message = resp_json.get('message', '')
            if 'Please enter proper values' in message:
                print(f"❌ TEST 1 FAILED: BUG NOT FIXED - Still getting 400 'Please enter proper values!'")
                return False
            else:
                print(f"❌ TEST 1 FAILED: Got 400 with message: {message}")
                return False
        else:
            print(f"❌ TEST 1 FAILED: Unexpected status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {str(e)}")
        return False

def test_photo_removal():
    """
    TEST CASE 2: Photo removal
    Expected: HTTP 200 (photo cleared)
    """
    print("\n" + "="*70)
    print("TEST CASE 2: Photo Removal")
    print("="*70)
    
    url = f"{API_BASE}/user/updateUser"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # Multipart form data: no file, data with remove_photo flag
    data = {
        'data': '{"remove_photo":true}'
    }
    
    print(f"\n[TEST 2] PUT {url}")
    print(f"Headers: Authorization: Bearer <token>")
    print(f"Data: data={{\"remove_photo\":true}}")
    print(f"Expected: HTTP 200")
    
    try:
        response = requests.put(url, headers=headers, data=data, timeout=15)
        print(f"\nActual Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            print(f"✅ TEST 2 PASSED: Photo removal returned 200")
            return True
        else:
            print(f"❌ TEST 2 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {str(e)}")
        return False

def test_invalid_email_format():
    """
    TEST CASE 3: Invalid email format (regression check - validation should still work)
    Expected: HTTP 400 with validation message like "Please Enter Valid Email"
    """
    print("\n" + "="*70)
    print("TEST CASE 3: Invalid Email Format (Regression Check)")
    print("="*70)
    
    url = f"{API_BASE}/user/updateUser"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # Multipart form data: invalid email
    data = {
        'data': '{"email":"not-an-email"}'
    }
    
    print(f"\n[TEST 3] PUT {url}")
    print(f"Headers: Authorization: Bearer <token>")
    print(f"Data: data={{\"email\":\"not-an-email\"}}")
    print(f"Expected: HTTP 400 with validation message (e.g., 'Please Enter Valid Email')")
    
    try:
        response = requests.put(url, headers=headers, data=data, timeout=15)
        print(f"\nActual Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 400:
            resp_json = response.json()
            message = resp_json.get('message', '').lower()
            if 'email' in message or 'valid' in message:
                print(f"✅ TEST 3 PASSED: Invalid email correctly rejected with 400")
                return True
            else:
                print(f"⚠️ TEST 3 PARTIAL: Got 400 but message was: {resp_json.get('message', '')}")
                return True
        else:
            print(f"❌ TEST 3 FAILED: Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {str(e)}")
        return False

def test_brand_logo_update():
    """
    TEST CASE 4: Brand logo (company) logo-only update
    Expected: HTTP 200 with message "Company updated successfully!"
    """
    print("\n" + "="*70)
    print("TEST CASE 4: Brand Logo-Only Update")
    print("="*70)
    
    url = f"{API_BASE}/company/updateCompany/1"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # Create a small test image
    img_bytes = create_test_image(size=(50, 50), color=(100, 100, 255))
    
    # Multipart form data: image file + empty data object
    files = {
        'image': ('test_logo.png', img_bytes, 'image/png')
    }
    data = {
        'data': '{}'  # Empty JSON object
    }
    
    print(f"\n[TEST 4] PUT {url}")
    print(f"Headers: Authorization: Bearer <token>")
    print(f"Files: image=test_logo.png (50x50 PNG)")
    print(f"Data: data={{}}")
    print(f"Expected: HTTP 200 with message 'Company updated successfully!'")
    
    try:
        response = requests.put(url, headers=headers, files=files, data=data, timeout=15)
        print(f"\nActual Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            resp_json = response.json()
            message = resp_json.get('message', '')
            if 'Company updated successfully' in message:
                print(f"✅ TEST 4 PASSED: Logo-only update returned 200 with correct message")
                return True
            else:
                print(f"⚠️ TEST 4 PARTIAL: Got 200 but message was: {message}")
                return True
        else:
            print(f"❌ TEST 4 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("DYNOPAY BACKEND API TESTING")
    print("Profile Photo & Brand Logo Bug Fix Verification")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print("⚠️  PRODUCTION DATABASE - MINIMAL WRITES ONLY")
    print("="*70)
    
    # Step 1: Login
    if not login():
        print("\n❌ TESTING ABORTED: Login failed")
        return
    
    # Step 2: Run all test cases
    results = {
        "Test 1: Profile Photo-Only Update (Core Fix)": test_profile_photo_only_update(),
        "Test 2: Photo Removal": test_photo_removal(),
        "Test 3: Invalid Email Format (Regression)": test_invalid_email_format(),
        "Test 4: Brand Logo-Only Update": test_brand_logo_update()
    }
    
    # Step 3: Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}% pass rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Bug fix verified successfully!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - Bug fix incomplete or regression detected")
    
    print("="*70)

if __name__ == "__main__":
    main()
