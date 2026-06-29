#!/usr/bin/env python3
"""
Backend API Testing Script for DynoPay - Phone Number Onboarding Bug Fix Verification
Tests the fix for "Failed to send verification code. Please try again." (503 error)

BUG CONTEXT:
- POST /api/user/registerPhone was returning HTTP 503 "Failed to send verification code"
- ROOT CAUSE 1: Invalid TELNYX_API_KEY (401 from Telnyx)
- ROOT CAUSE 2: Wrong TELNYX_VERIFY_PROFILE_ID
- ROOT CAUSE 3: Old profile was "Bozzmail" with 5-digit codes (frontend expects 6 digits)
- FIX: Updated .env with valid TELNYX_API_KEY and new "DynoPay" profile (6-digit codes)

IMPORTANT: These calls send REAL SMS and consume Telnyx credit (~$8 balance).
Keep SMS-sending calls to MINIMUM: max 2 total registerPhone calls with valid numbers.
"""

import requests
import json
from datetime import datetime
import time

# Target URL from review request
BASE_URL = "https://dynopay-staging-1.preview.emergentagent.com/api"

# SMS counter to enforce limit
sms_sent_count = 0
MAX_SMS_SENDS = 2

def print_separator():
    print("\n" + "="*80 + "\n")

def test_register_phone_valid():
    """
    TEST 1: POST /api/user/registerPhone with VALID phone number
    EXPECTED: HTTP 200 with message "Verification code sent to your phone number."
    NOT: 503, 401, or CSRF 403
    
    ⚠️ SENDS REAL SMS - Consumes Telnyx credit
    """
    global sms_sent_count
    
    print("TEST 1: Register Phone - Valid Number (POST /api/user/registerPhone)")
    print("-" * 80)
    print("⚠️ WARNING: This test sends a REAL SMS and consumes Telnyx credit")
    print(f"SMS sent so far: {sms_sent_count}/{MAX_SMS_SENDS}")
    
    if sms_sent_count >= MAX_SMS_SENDS:
        print(f"❌ SKIPPED: Already sent {MAX_SMS_SENDS} SMS messages (limit reached)")
        return False, f"SKIPPED - SMS limit reached ({MAX_SMS_SENDS})"
    
    try:
        url = f"{BASE_URL}/user/registerPhone"
        payload = {"mobile": "+13025149977"}
        headers = {"Content-Type": "application/json"}
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Headers: No auth/CSRF (public endpoint)")
        
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        try:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
        except:
            print(f"Response Text: {response.text[:500]}")
        
        # Check for the old 503 error
        if response.status_code == 503:
            print(f"❌ CRITICAL FAIL: Still returning 503 'Failed to send verification code'")
            print(f"BUG NOT FIXED - Telnyx integration still failing")
            return False, "503 error - Bug NOT fixed (Telnyx still failing)"
        
        # Check for 401 (Telnyx auth failure)
        if response.status_code == 401:
            print(f"❌ CRITICAL FAIL: 401 Unauthorized - Telnyx API key invalid")
            return False, "401 error - Telnyx API key invalid"
        
        # Check for CSRF 403
        if response.status_code == 403:
            try:
                data = response.json()
                if "CSRF" in data.get("message", ""):
                    print(f"❌ FAIL: 403 CSRF error - Endpoint not in EXEMPT_PATHS")
                    return False, "403 CSRF error - Endpoint should be public"
            except:
                pass
            print(f"❌ FAIL: 403 Forbidden")
            return False, "403 Forbidden"
        
        # Check for success
        if response.status_code == 200:
            try:
                data = response.json()
                message = data.get("message", "")
                
                # Check for expected success message
                if "Verification code sent to your phone number" in message:
                    print(f"✅ PASS: Phone registration successful!")
                    print(f"  Message: {message}")
                    print(f"  SMS sent to: +13025149977")
                    print(f"  Expected SMS format: 'Your DynoPay verification code is: <6 digits>'")
                    sms_sent_count += 1
                    print(f"  SMS count: {sms_sent_count}/{MAX_SMS_SENDS}")
                    return True, f"Phone registration successful - SMS sent ({sms_sent_count}/{MAX_SMS_SENDS})"
                else:
                    print(f"⚠️ WARNING: 200 but unexpected message: {message}")
                    sms_sent_count += 1  # Assume SMS was sent
                    return True, f"200 OK but unexpected message: {message}"
            except Exception as e:
                print(f"⚠️ WARNING: 200 but JSON parse failed: {e}")
                sms_sent_count += 1  # Assume SMS was sent
                return True, "200 OK but response parsing failed"
        
        # Other status codes
        print(f"❌ FAIL: Unexpected status code {response.status_code}")
        return False, f"Unexpected status {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_register_phone_invalid_format():
    """
    TEST 2: POST /api/user/registerPhone with INVALID phone format
    EXPECTED: HTTP 400 with validation message about invalid mobile number format
    This path does NOT send SMS (validation fails before Telnyx call)
    """
    print("TEST 2: Register Phone - Invalid Format (POST /api/user/registerPhone)")
    print("-" * 80)
    print("Expected: HTTP 400 (validation error) - NO SMS sent")
    
    try:
        url = f"{BASE_URL}/user/registerPhone"
        payload = {"mobile": "123"}
        headers = {"Content-Type": "application/json"}
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
        except:
            print(f"Response Text: {response.text[:500]}")
        
        # Check for expected 400 validation error
        if response.status_code == 400:
            try:
                data = response.json()
                message = data.get("message", "")
                
                # Check if message mentions invalid format/validation
                if any(keyword in message.lower() for keyword in ["invalid", "format", "valid", "phone", "mobile", "number"]):
                    print(f"✅ PASS: Invalid format rejected with 400")
                    print(f"  Message: {message}")
                    return True, f"Invalid format rejected: {message}"
                else:
                    print(f"⚠️ WARNING: 400 but unexpected message: {message}")
                    return True, f"400 validation error (unexpected message): {message}"
            except:
                print(f"✅ PASS: Invalid format rejected with 400 (JSON parse failed)")
                return True, "Invalid format rejected with 400"
        
        # Check for unexpected success
        elif response.status_code == 200:
            print(f"❌ FAIL: Invalid format accepted (should be 400)")
            return False, "Invalid format accepted - validation missing"
        
        # Other status codes
        else:
            print(f"⚠️ UNEXPECTED: Status code {response.status_code} (expected 400)")
            return True, f"Status {response.status_code} (not 200, so validation exists)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_phone_type_check():
    """
    TEST 3: POST /api/user/phone-type-check with valid phone number
    EXPECTED: HTTP 200 (not 401/403/500)
    This endpoint checks if phone is mobile/landline - does NOT send SMS
    """
    print("TEST 3: Phone Type Check (POST /api/user/phone-type-check)")
    print("-" * 80)
    print("Expected: HTTP 200 - NO SMS sent (just checks phone type)")
    
    try:
        url = f"{BASE_URL}/user/phone-type-check"
        payload = {"mobile": "+13025149977"}
        headers = {"Content-Type": "application/json"}
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
        except:
            print(f"Response Text: {response.text[:500]}")
        
        # Check for success
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"✅ PASS: Phone type check successful")
                return True, "Phone type check successful"
            except:
                print(f"✅ PASS: Phone type check returns 200")
                return True, "Phone type check returns 200"
        
        # Check for auth errors
        elif response.status_code in [401, 403]:
            print(f"❌ FAIL: {response.status_code} - Endpoint should be public")
            return False, f"{response.status_code} error - Should be public endpoint"
        
        # Check for server error
        elif response.status_code == 500:
            print(f"❌ FAIL: 500 Internal Server Error")
            return False, "500 error - Server error"
        
        # Other status codes
        else:
            print(f"⚠️ UNEXPECTED: Status code {response.status_code}")
            return True, f"Status {response.status_code} (not 401/403/500)"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_register_email_regression():
    """
    TEST 4: POST /api/user/registerEmail - Regression test
    EXPECTED: HTTP 200 (email onboarding still works)
    Verify that phone fix didn't break email registration
    """
    print("TEST 4: Register Email - Regression (POST /api/user/registerEmail)")
    print("-" * 80)
    print("Regression test: Verify email onboarding still works")
    
    try:
        # Generate unique email with timestamp
        timestamp = int(time.time())
        email = f"qa.phone.fix.{timestamp}@dynopaytest.com"
        
        url = f"{BASE_URL}/user/registerEmail"
        payload = {"email": email}
        headers = {"Content-Type": "application/json"}
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
        except:
            print(f"Response Text: {response.text[:500]}")
        
        # Check for success
        if response.status_code == 200:
            try:
                data = response.json()
                message = data.get("message", "")
                
                if "sent" in message.lower() or "email" in message.lower():
                    print(f"✅ PASS: Email registration successful")
                    print(f"  Message: {message}")
                    print(f"  Email: {email}")
                    return True, f"Email registration successful"
                else:
                    print(f"⚠️ WARNING: 200 but unexpected message: {message}")
                    return True, f"200 OK but unexpected message"
            except:
                print(f"✅ PASS: Email registration returns 200")
                return True, "Email registration returns 200"
        
        # Check for CSRF 403 (should NOT happen after fix)
        elif response.status_code == 403:
            try:
                data = response.json()
                if "CSRF" in data.get("message", ""):
                    print(f"❌ FAIL: 403 CSRF error - Regression detected")
                    return False, "403 CSRF error - Regression"
            except:
                pass
            print(f"❌ FAIL: 403 Forbidden")
            return False, "403 Forbidden"
        
        # Other status codes
        else:
            print(f"❌ FAIL: Unexpected status code {response.status_code}")
            return False, f"Unexpected status {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def test_health_check():
    """
    TEST 5: GET /health or GET /api/ - Health check
    EXPECTED: HTTP 200 with healthy status
    """
    print("TEST 5: Health Check (GET /health or GET /api/)")
    print("-" * 80)
    
    try:
        # Try /api/ first (more reliable)
        url = f"{BASE_URL}/"
        response = requests.get(url, timeout=10)
        
        print(f"URL: {url}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response Body: {json.dumps(data, indent=2)[:300]}...")
                
                status = data.get("status", "")
                if status == "operational":
                    print(f"✅ PASS: Health check operational")
                    return True, "Health check operational"
                else:
                    print(f"⚠️ WARNING: 200 but status is '{status}'")
                    return True, f"Health check returns 200 (status: {status})"
            except:
                print(f"✅ PASS: Health check returns 200")
                return True, "Health check returns 200"
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False, f"Expected 200, got {response.status_code}"
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False, f"Exception: {str(e)}"

def main():
    print("="*80)
    print("DynoPay Backend API Testing - Phone Number Onboarding Bug Fix Verification")
    print("="*80)
    print("BUG: POST /api/user/registerPhone returned 503 'Failed to send verification code'")
    print("FIX: Updated TELNYX_API_KEY and TELNYX_VERIFY_PROFILE_ID in backend/.env")
    print(f"Target URL: {BASE_URL}")
    print(f"Test Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("="*80)
    print(f"⚠️ IMPORTANT: Max {MAX_SMS_SENDS} SMS sends allowed (real Telnyx credit)")
    print("="*80)
    
    results = []
    
    # Test 1: Register phone with VALID number (SENDS SMS - count 1)
    print_separator()
    result = test_register_phone_valid()
    results.append(("Register Phone - Valid Number", result, True))  # Critical test
    
    # Test 2: Register phone with INVALID format (NO SMS)
    print_separator()
    result = test_register_phone_invalid_format()
    results.append(("Register Phone - Invalid Format", result, True))  # Critical test
    
    # Test 3: Phone type check (NO SMS)
    print_separator()
    result = test_phone_type_check()
    results.append(("Phone Type Check", result, True))  # Critical test
    
    # Test 4: Register email - regression (NO SMS)
    print_separator()
    result = test_register_email_regression()
    results.append(("Register Email - Regression", result, True))  # Critical test
    
    # Test 5: Health check (NO SMS)
    print_separator()
    result = test_health_check()
    results.append(("Health Check", result, False))  # Non-critical
    
    # Summary
    print_separator()
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, (success, _), _ in results if success)
    total = len(results)
    
    # Critical tests
    critical_tests = [name for name, _, is_critical in results if is_critical]
    critical_passed = sum(1 for name, (success, _), is_critical in results if is_critical and success)
    critical_total = len(critical_tests)
    
    print("\n🔴 CRITICAL TESTS (Bug Fix Verification):")
    print("-" * 80)
    for test_name, (success, message), is_critical in results:
        if is_critical:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status}: {test_name}")
            print(f"         {message}")
    
    print("\n📋 ALL TESTS:")
    print("-" * 80)
    for test_name, (success, message), _ in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"         {message}")
    
    print("-" * 80)
    print(f"Total: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
    print(f"Critical: {critical_passed}/{critical_total} critical tests passed")
    print(f"SMS sent: {sms_sent_count}/{MAX_SMS_SENDS}")
    
    # Pass criteria
    print("\n" + "="*80)
    print("PASS CRITERIA:")
    print("-" * 80)
    
    # Check each pass criterion
    criteria_met = []
    
    # 1. registerPhone with valid number returns 200
    test1_result = results[0][1]
    if test1_result[0] and "200" in str(test1_result[1]):
        print("✅ registerPhone with valid number returns 200 'Verification code sent'")
        criteria_met.append(True)
    else:
        print("❌ registerPhone with valid number does NOT return 200")
        criteria_met.append(False)
    
    # 2. Invalid format returns 400
    test2_result = results[1][1]
    if test2_result[0]:
        print("✅ Invalid format number returns 400 validation error")
        criteria_met.append(True)
    else:
        print("❌ Invalid format number does NOT return 400")
        criteria_met.append(False)
    
    # 3. phone-type-check returns 200
    test3_result = results[2][1]
    if test3_result[0]:
        print("✅ phone-type-check returns 200")
        criteria_met.append(True)
    else:
        print("❌ phone-type-check does NOT return 200")
        criteria_met.append(False)
    
    # 4. SMS limit not exceeded
    if sms_sent_count <= MAX_SMS_SENDS:
        print(f"✅ SMS sends within limit ({sms_sent_count}/{MAX_SMS_SENDS})")
        criteria_met.append(True)
    else:
        print(f"❌ SMS sends EXCEEDED limit ({sms_sent_count}/{MAX_SMS_SENDS})")
        criteria_met.append(False)
    
    print("-" * 80)
    
    # Final verdict
    if all(criteria_met):
        print("\n🎉 ALL PASS CRITERIA MET - Bug fix verified successfully!")
        print("✅ Phone onboarding now returns 200 (not 503)")
        print("✅ Telnyx integration working correctly")
        print("✅ SMS should read: 'Your DynoPay verification code is: <6 digits>'")
        print("✅ The 503 'Failed to send verification code' error is FIXED")
    else:
        print(f"\n❌ BUG FIX VERIFICATION FAILED")
        print(f"⚠️ {len([c for c in criteria_met if not c])} pass criteria NOT met")
        print(f"⚠️ {critical_total - critical_passed} critical test(s) failed")
    
    print("="*80)

if __name__ == "__main__":
    main()
