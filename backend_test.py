#!/usr/bin/env python3
"""
Account-Enumeration Protection Verification for DynoPay Backend
================================================================
Tests that login/OTP/forgot-password flows NEVER reveal whether an email or phone is registered.

SAFETY RULES (CRITICAL):
- Do NOT call generateOTP or confirmOTP with REAL registered phone numbers
- Do NOT attempt real-account password more than ONCE
- Do NOT register new accounts or modify data
- Use fake unregistered numbers like 15550001111

Base URL: https://payment-gateway-init-2.preview.emergentagent.com/api
"""

import requests
import json
import random
import string
from typing import Dict, Any, Tuple

BASE_URL = "https://payment-gateway-init-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
EXISTING_EMAIL = "onarrival21@gmail.com"  # user_id=1, "Hostbay"

# Generate random test data
def random_email():
    """Generate a random non-existent email"""
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"noone-{rand}@example.com"

def random_phone():
    """Generate a random fake phone number (US format, clearly fake)"""
    return f"1555000{random.randint(1000, 9999)}"

def print_test(step: str, description: str):
    """Print test step header"""
    print(f"\n{'='*80}")
    print(f"STEP {step}: {description}")
    print('='*80)

def print_result(passed: bool, message: str, details: str = ""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"  Details: {details}")

def compare_responses(resp1: Dict, resp2: Dict, name1: str, name2: str) -> Tuple[bool, str]:
    """Compare two responses to ensure they're identical in shape"""
    # Compare status codes
    if resp1.get('status') != resp2.get('status'):
        return False, f"Status codes differ: {name1}={resp1.get('status')}, {name2}={resp2.get('status')}"
    
    # Compare response structure (keys)
    keys1 = set(resp1.get('data', {}).keys())
    keys2 = set(resp2.get('data', {}).keys())
    if keys1 != keys2:
        return False, f"Response keys differ: {name1}={keys1}, {name2}={keys2}"
    
    return True, "Responses are identical in shape"

def test_health():
    """Test backend health endpoint"""
    print_test("0", "Backend Health Check")
    try:
        # Use localhost:8001 as the backend runs internally on this port
        resp = requests.get("http://localhost:8001/health", timeout=10)
        data = resp.json()
        
        if resp.status_code == 200 and data.get('status') == 'healthy':
            print_result(True, "Backend is healthy", 
                        f"DB: {data.get('database')}, Redis: {data.get('redis')}, BG Jobs: {data.get('background_jobs', {}).get('eligible')}")
            return True
        else:
            print_result(False, f"Backend unhealthy: {resp.status_code}", str(data))
            return False
    except Exception as e:
        print_result(False, f"Health check failed: {str(e)}")
        return False

def test_check_email():
    """Test 1: GET /api/user/checkEmail - must not reveal email existence"""
    print_test("1", "GET /api/user/checkEmail - Account Enumeration Protection")
    
    # Test with non-existent email
    nonexistent_email = random_email()
    print(f"\n1a. Testing with NON-EXISTENT email: {nonexistent_email}")
    try:
        resp1 = requests.get(f"{API_BASE}/user/checkEmail", 
                            params={'email': nonexistent_email}, 
                            timeout=10)
        data1 = resp1.json()
        print(f"  Status: {resp1.status_code}")
        print(f"  Response: {json.dumps(data1, indent=2)}")
        
        # Check for PII leakage
        has_pii = any(key in str(data1).lower() for key in ['mobile', 'phone', 'name', 'user_id'])
        if has_pii:
            print_result(False, "Response contains PII (mobile/phone/name/user_id)", str(data1))
            return False
        
        # Should return validEmail: true (masked)
        if data1.get('data', {}).get('validEmail') != True:
            print_result(False, f"Expected validEmail=true, got {data1.get('data', {}).get('validEmail')}")
            return False
        
        print_result(True, "Non-existent email returns validEmail=true with no PII")
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False
    
    # Test with existing email
    print(f"\n1b. Testing with EXISTING email: {EXISTING_EMAIL}")
    try:
        resp2 = requests.get(f"{API_BASE}/user/checkEmail", 
                            params={'email': EXISTING_EMAIL}, 
                            timeout=10)
        data2 = resp2.json()
        print(f"  Status: {resp2.status_code}")
        print(f"  Response: {json.dumps(data2, indent=2)}")
        
        # Check for PII leakage
        has_pii = any(key in str(data2).lower() for key in ['mobile', 'phone', 'name', 'user_id'])
        if has_pii:
            print_result(False, "Response contains PII (mobile/phone/name/user_id)", str(data2))
            return False
        
        # Should return validEmail: true (masked)
        if data2.get('data', {}).get('validEmail') != True:
            print_result(False, f"Expected validEmail=true, got {data2.get('data', {}).get('validEmail')}")
            return False
        
        print_result(True, "Existing email returns validEmail=true with no PII")
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False
    
    # Compare responses
    print(f"\n1c. Comparing responses (must be identical)")
    identical, msg = compare_responses(
        {'status': resp1.status_code, 'data': data1.get('data', {})},
        {'status': resp2.status_code, 'data': data2.get('data', {})},
        "non-existent", "existing"
    )
    print_result(identical, msg)
    
    return identical

def test_check_phone():
    """Test 2: GET /api/user/checkPhone - must not reveal phone existence"""
    print_test("2", "GET /api/user/checkPhone - Account Enumeration Protection")
    
    # Test with non-existent phone
    nonexistent_phone = random_phone()
    print(f"\nTesting with NON-EXISTENT phone: {nonexistent_phone}")
    try:
        resp = requests.get(f"{API_BASE}/user/checkPhone", 
                           params={'phone': nonexistent_phone}, 
                           timeout=10)
        data = resp.json()
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Check for PII leakage
        has_pii = any(key in str(data).lower() for key in ['email', 'name', 'user_id'])
        if has_pii:
            print_result(False, "Response contains PII (email/name/user_id)", str(data))
            return False
        
        # Should return validPhone: true (masked)
        if data.get('data', {}).get('validPhone') != True:
            print_result(False, f"Expected validPhone=true, got {data.get('data', {}).get('validPhone')}")
            return False
        
        # Must not return validPhone: false
        if data.get('data', {}).get('validPhone') == False:
            print_result(False, "Response reveals phone doesn't exist (validPhone=false)")
            return False
        
        print_result(True, "Non-existent phone returns validPhone=true with no PII")
        return True
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_login():
    """Test 3: POST /api/user/login - must return generic error"""
    print_test("3", "POST /api/user/login - Generic Error Messages")
    
    # Test with non-existent email
    nonexistent_email = random_email()
    print(f"\n3a. Testing with NON-EXISTENT email: {nonexistent_email}")
    try:
        resp1 = requests.post(f"{API_BASE}/user/login", 
                             json={'email': nonexistent_email, 'password': 'anypassword123'},
                             timeout=10)
        data1 = resp1.json()
        print(f"  Status: {resp1.status_code}")
        print(f"  Response: {json.dumps(data1, indent=2)}")
        
        if resp1.status_code != 401:
            print_result(False, f"Expected 401, got {resp1.status_code}")
            return False
        
        message1 = data1.get('message', '').lower()
        # Check for account-revealing messages
        bad_phrases = ['no account', 'not registered', 'user not found', 'does not exist', 'not exist']
        if any(phrase in message1 for phrase in bad_phrases):
            print_result(False, f"Message reveals account doesn't exist: {data1.get('message')}")
            return False
        
        # Should be generic like "Invalid email or password"
        if 'invalid' not in message1 or ('email' in message1 or 'password' in message1):
            print_result(True, f"Generic error message: {data1.get('message')}")
        else:
            print_result(False, f"Message not generic enough: {data1.get('message')}")
            return False
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False
    
    # Test with existing email + wrong password (ONLY ONCE per safety rules)
    print(f"\n3b. Testing with EXISTING email + WRONG password: {EXISTING_EMAIL}")
    print("  ⚠️  SAFETY: Attempting ONLY ONCE to avoid account lockout")
    try:
        resp2 = requests.post(f"{API_BASE}/user/login", 
                             json={'email': EXISTING_EMAIL, 'password': 'WrongPassword999!'},
                             timeout=10)
        data2 = resp2.json()
        print(f"  Status: {resp2.status_code}")
        print(f"  Response: {json.dumps(data2, indent=2)}")
        
        if resp2.status_code != 401:
            print_result(False, f"Expected 401, got {resp2.status_code}")
            return False
        
        message2 = data2.get('message', '').lower()
        
        # Should be same generic message
        if message1 == message2:
            print_result(True, "Both errors are identical (generic)")
        else:
            print_result(False, f"Error messages differ: '{data1.get('message')}' vs '{data2.get('message')}'")
            return False
        
        return True
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_generate_otp_email():
    """Test 4: POST /api/user/generateOTP (email) - must return masked success"""
    print_test("4", "POST /api/user/generateOTP (email) - Masked Success")
    
    nonexistent_email = random_email()
    print(f"\nTesting with NON-EXISTENT email: {nonexistent_email}")
    try:
        resp = requests.post(f"{API_BASE}/user/generateOTP", 
                            json={'email': nonexistent_email},
                            timeout=10)
        data = resp.json()
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Should return 200 success (masked)
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
        
        message = data.get('message', '').lower()
        
        # Must NOT return 404 or "registered" wording
        if resp.status_code == 404 or 'registered' in message or 'not found' in message:
            print_result(False, f"Response reveals email doesn't exist: {resp.status_code} - {data.get('message')}")
            return False
        
        # Should say something like "OTP sent successfully"
        if 'otp' in message and 'sent' in message:
            print_result(True, f"Masked success message: {data.get('message')}")
            return True
        else:
            print_result(False, f"Unexpected message: {data.get('message')}")
            return False
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_generate_otp_mobile():
    """Test 5: POST /api/user/generateOTP (mobile) - must return masked success"""
    print_test("5", "POST /api/user/generateOTP (mobile) - Masked Success")
    
    fake_phone = random_phone()
    print(f"\nTesting with FAKE/unregistered phone: {fake_phone}")
    print("  ⚠️  SAFETY: Using clearly fake number (15550xxxxx) - will NOT send real SMS")
    try:
        resp = requests.post(f"{API_BASE}/user/generateOTP", 
                            json={'mobile': fake_phone},
                            timeout=10)
        data = resp.json()
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Should return 200 success (masked)
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
        
        message = data.get('message', '').lower()
        
        # Must NOT return 404 or "registered" wording
        if resp.status_code == 404 or 'registered' in message or 'not found' in message:
            print_result(False, f"Response reveals phone doesn't exist: {resp.status_code} - {data.get('message')}")
            return False
        
        # Should say something like "OTP sent successfully via SMS"
        if 'otp' in message and 'sent' in message:
            print_result(True, f"Masked success message: {data.get('message')}")
            return True
        else:
            print_result(False, f"Unexpected message: {data.get('message')}")
            return False
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_confirm_otp():
    """Test 6: POST /api/user/confirmOTP - must return generic error"""
    print_test("6", "POST /api/user/confirmOTP - Generic Error")
    
    nonexistent_email = random_email()
    print(f"\nTesting with NON-EXISTENT email: {nonexistent_email}")
    try:
        resp = requests.post(f"{API_BASE}/user/confirmOTP", 
                            json={'email': nonexistent_email, 'otp': '000000'},
                            timeout=10)
        data = resp.json()
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Should return 400 (not 404)
        if resp.status_code == 404:
            print_result(False, "Returns 404 (reveals account doesn't exist)")
            return False
        
        if resp.status_code != 400:
            print_result(False, f"Expected 400, got {resp.status_code}")
            return False
        
        message = data.get('message', '').lower()
        
        # Check for account-revealing messages (NOT OTP-related messages)
        # "OTP expired or not found" is ACCEPTABLE - it's about the OTP, not the account
        bad_phrases = ['account not found', 'user not found', 'not registered', 'account does not exist', 'user does not exist']
        if any(phrase in message for phrase in bad_phrases):
            print_result(False, f"Message reveals account doesn't exist: {data.get('message')}")
            return False
        
        # Should be generic like "OTP expired or not found" or "OTP did not match"
        # These messages are about the OTP itself, not about account existence
        if 'otp' in message and ('expired' in message or 'not found' in message or 'not match' in message or 'invalid' in message):
            print_result(True, f"Generic error message: {data.get('message')}")
            return True
        else:
            print_result(False, f"Unexpected message: {data.get('message')}")
            return False
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_forgot_password():
    """Test 7: POST /api/user/forgot-password - must return masked success"""
    print_test("7", "POST /api/user/forgot-password - Masked Success")
    
    nonexistent_email = random_email()
    print(f"\nTesting with NON-EXISTENT email: {nonexistent_email}")
    try:
        resp = requests.post(f"{API_BASE}/user/forgot-password", 
                            json={'email': nonexistent_email},
                            timeout=10)
        data = resp.json()
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Should return 200 success (masked)
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            return False
        
        message = data.get('message', '').lower()
        
        # Should be masked like "If the email exists, an OTP has been sent"
        if 'if' in message and 'email' in message and ('otp' in message or 'sent' in message):
            print_result(True, f"Masked success message: {data.get('message')}")
            return True
        elif 'otp' in message and 'sent' in message:
            # Also accept generic "OTP sent" without "if exists" (still masked)
            print_result(True, f"Masked success message: {data.get('message')}")
            return True
        else:
            print_result(False, f"Message not properly masked: {data.get('message')}")
            return False
        
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("ACCOUNT-ENUMERATION PROTECTION VERIFICATION")
    print("DynoPay Backend - Node/Express")
    print("="*80)
    print(f"\nBase URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"\nExisting test email: {EXISTING_EMAIL}")
    print("\n⚠️  SAFETY MODE: LIVE PRODUCTION DATABASE")
    print("  - Using fake emails/phones for non-existent tests")
    print("  - Real account password attempt: ONLY ONCE")
    print("  - NO data mutations, NO account creation")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results['health'] = test_health()
    results['checkEmail'] = test_check_email()
    results['checkPhone'] = test_check_phone()
    results['login'] = test_login()
    results['generateOTP_email'] = test_generate_otp_email()
    results['generateOTP_mobile'] = test_generate_otp_mobile()
    results['confirmOTP'] = test_confirm_otp()
    results['forgotPassword'] = test_forgot_password()
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Account-enumeration protection is WORKING CORRECTLY")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED - Account-enumeration protection has issues")
        return 1

if __name__ == "__main__":
    exit(main())
