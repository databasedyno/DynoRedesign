#!/usr/bin/env python3
"""
DynoPay Onboarding Security Verification Tests
Tests the P0 security fix (connectSocial account-takeover bypass) + P1/P2 consistency
"""

import requests
import json
import time
import sys
from datetime import datetime

# Base URL for the preview environment
BASE_URL = "https://dynopay-setup-3.preview.emergentagent.com"

# Test results storage
test_results = []

def log_test(test_num, test_name, status, details):
    """Log test result"""
    result = {
        "test": test_num,
        "name": test_name,
        "status": status,
        "details": details,
        "timestamp": datetime.utcnow().isoformat()
    }
    test_results.append(result)
    
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"\n{status_symbol} Test {test_num}: {test_name}")
    print(f"   Status: {status}")
    print(f"   Details: {details}")
    
    return status == "PASS"

def get_csrf_token(session):
    """Get CSRF token for mutating requests"""
    try:
        response = session.get(f"{BASE_URL}/api/csrf-token", timeout=10)
        if response.status_code == 200:
            data = response.json()
            token = data.get('csrf_token') or data.get('csrfToken')
            print(f"   CSRF token obtained: {token[:20]}..." if token else "   No CSRF token in response")
            return token
        else:
            print(f"   Failed to get CSRF token: {response.status_code}")
            return None
    except Exception as e:
        print(f"   Error getting CSRF token: {str(e)}")
        return None

def test_1_connectSocial_new_email():
    """
    PRIMARY P0 Test 1: POST /api/user/connectSocial with NEW email
    MUST NOT return 200 with accessToken. Expect 404 or 410.
    """
    session = requests.Session()
    
    random_suffix = int(time.time())
    payload = {
        "name": "x",
        "email": f"attacker-probe-{random_suffix}@example.com",
        "provider": "google",
        "id": "0"
    }
    
    try:
        response = session.post(
            f"{BASE_URL}/api/user/connectSocial",
            json=payload,
            timeout=10
        )
        
        status_code = response.status_code
        
        # Check if response is JSON
        try:
            response_data = response.json()
        except Exception:
            response_data = {"text": response.text[:200]}
        
        # CRITICAL: Must NOT return 200 with accessToken
        if status_code == 200:
            has_access_token = False
            has_user_data = False
            
            if isinstance(response_data, dict):
                # Check for accessToken in various possible locations
                if 'data' in response_data:
                    has_access_token = 'accessToken' in response_data['data']
                    has_user_data = 'userData' in response_data['data']
                else:
                    has_access_token = 'accessToken' in response_data
                    has_user_data = 'userData' in response_data
            
            if has_access_token or has_user_data:
                return log_test(
                    1,
                    "connectSocial with NEW email (P0 CRITICAL)",
                    "FAIL",
                    f"CRITICAL SECURITY FAIL: HTTP 200 with accessToken={has_access_token}, userData={has_user_data}. This is the account-takeover vulnerability! Response: {json.dumps(response_data)[:300]}"
                )
            else:
                return log_test(
                    1,
                    "connectSocial with NEW email (P0 CRITICAL)",
                    "PASS",
                    f"HTTP 200 but NO accessToken or userData in response (acceptable). Response: {json.dumps(response_data)[:200]}"
                )
        
        # 404 or 410 are acceptable (route removed or disabled)
        elif status_code in [404, 410]:
            return log_test(
                1,
                "connectSocial with NEW email (P0 CRITICAL)",
                "PASS",
                f"HTTP {status_code} (route removed/disabled). Response: {json.dumps(response_data)[:200]}"
            )
        
        else:
            return log_test(
                1,
                "connectSocial with NEW email (P0 CRITICAL)",
                "PASS",
                f"HTTP {status_code} (not 200, no token issued). Response: {json.dumps(response_data)[:200]}"
            )
            
    except Exception as e:
        return log_test(
            1,
            "connectSocial with NEW email (P0 CRITICAL)",
            "FAIL",
            f"Exception: {str(e)}"
        )

def test_2_connectSocial_existing_email():
    """
    PRIMARY P0 Test 2: POST /api/user/connectSocial with EXISTING email
    This was the account-takeover vector. MUST NOT return session/accessToken.
    """
    session = requests.Session()
    
    payload = {
        "email": "hostbay@moxx.co",
        "provider": "google",
        "id": "0"
    }
    
    try:
        response = session.post(
            f"{BASE_URL}/api/user/connectSocial",
            json=payload,
            timeout=10
        )
        
        status_code = response.status_code
        
        try:
            response_data = response.json()
        except Exception:
            response_data = {"text": response.text[:200]}
        
        # CRITICAL: Must NOT return 200 with accessToken
        if status_code == 200:
            has_access_token = False
            has_user_data = False
            
            if isinstance(response_data, dict):
                if 'data' in response_data:
                    has_access_token = 'accessToken' in response_data['data']
                    has_user_data = 'userData' in response_data['data']
                else:
                    has_access_token = 'accessToken' in response_data
                    has_user_data = 'userData' in response_data
            
            if has_access_token or has_user_data:
                return log_test(
                    2,
                    "connectSocial with EXISTING email (P0 CRITICAL - account takeover vector)",
                    "FAIL",
                    f"CRITICAL SECURITY FAIL: HTTP 200 with accessToken={has_access_token}, userData={has_user_data}. This is the EXACT account-takeover vulnerability! Response: {json.dumps(response_data)[:300]}"
                )
            else:
                return log_test(
                    2,
                    "connectSocial with EXISTING email (P0 CRITICAL - account takeover vector)",
                    "PASS",
                    f"HTTP 200 but NO accessToken or userData (acceptable). Response: {json.dumps(response_data)[:200]}"
                )
        
        elif status_code in [404, 410]:
            return log_test(
                2,
                "connectSocial with EXISTING email (P0 CRITICAL - account takeover vector)",
                "PASS",
                f"HTTP {status_code} (route removed/disabled). Response: {json.dumps(response_data)[:200]}"
            )
        
        else:
            return log_test(
                2,
                "connectSocial with EXISTING email (P0 CRITICAL - account takeover vector)",
                "PASS",
                f"HTTP {status_code} (not 200, no token issued). Response: {json.dumps(response_data)[:200]}"
            )
            
    except Exception as e:
        return log_test(
            2,
            "connectSocial with EXISTING email (P0 CRITICAL - account takeover vector)",
            "FAIL",
            f"Exception: {str(e)}"
        )

def test_3_registerUser_duplicate_email():
    """
    P1/P2 Test 3: POST /api/user/registerUser with EXISTING email
    Expect HTTP 409 with "Account Already Exists!" and NO token. NO DB write.
    """
    session = requests.Session()
    
    # Get CSRF token
    csrf_token = get_csrf_token(session)
    if not csrf_token:
        return log_test(
            3,
            "registerUser with duplicate email (P1/P2)",
            "FAIL",
            "Could not obtain CSRF token"
        )
    
    payload = {
        "name": "Dup Test",
        "email": "hostbay@moxx.co",
        "password": "ZzSwrTest#2026"
    }
    
    headers = {
        "x-csrf-token": csrf_token,
        "Content-Type": "application/json"
    }
    
    try:
        response = session.post(
            f"{BASE_URL}/api/user/registerUser",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        status_code = response.status_code
        
        try:
            response_data = response.json()
        except Exception:
            response_data = {"text": response.text[:200]}
        
        # Expect 409 with "Account Already Exists!" message
        if status_code == 409:
            message = ""
            if isinstance(response_data, dict):
                message = response_data.get('message', '') or response_data.get('error', '')
            
            # Check that NO token was issued
            has_token = False
            if isinstance(response_data, dict):
                if 'data' in response_data:
                    has_token = 'accessToken' in response_data['data'] or 'token' in response_data['data']
                else:
                    has_token = 'accessToken' in response_data or 'token' in response_data
            
            if has_token:
                return log_test(
                    3,
                    "registerUser with duplicate email (P1/P2)",
                    "FAIL",
                    f"HTTP 409 but TOKEN was issued (should not happen). Response: {json.dumps(response_data)[:200]}"
                )
            
            if "already exists" in message.lower() or "account already" in message.lower():
                return log_test(
                    3,
                    "registerUser with duplicate email (P1/P2)",
                    "PASS",
                    f"HTTP 409 with correct message: '{message}'. No token issued."
                )
            else:
                return log_test(
                    3,
                    "registerUser with duplicate email (P1/P2)",
                    "PASS",
                    f"HTTP 409 (correct status). Message: '{message}'. No token issued."
                )
        
        else:
            return log_test(
                3,
                "registerUser with duplicate email (P1/P2)",
                "FAIL",
                f"Expected HTTP 409, got {status_code}. Response: {json.dumps(response_data)[:200]}"
            )
            
    except Exception as e:
        return log_test(
            3,
            "registerUser with duplicate email (P1/P2)",
            "FAIL",
            f"Exception: {str(e)}"
        )

def test_4_registerUser_new_account():
    """
    P1/P2 Test 4: POST /api/user/registerUser with NEW email
    THE ONLY ALLOWED WRITE. Expect 200 with token + referral_code starting "DYNO-".
    Then verify profile has referral_code and wallet_count > 0.
    """
    session = requests.Session()
    
    # Get CSRF token
    csrf_token = get_csrf_token(session)
    if not csrf_token:
        return log_test(
            4,
            "registerUser with NEW email + wallet/referral verification (P1/P2)",
            "FAIL",
            "Could not obtain CSRF token"
        )
    
    timestamp = int(time.time())
    email = f"zz-swr-onboard-{timestamp}@dynopaytest.com"
    
    payload = {
        "name": "ZZ SWR Onboard Test",
        "email": email,
        "password": "ZzSwrTest#2026"
    }
    
    headers = {
        "x-csrf-token": csrf_token,
        "Content-Type": "application/json"
    }
    
    try:
        # Step 1: Register user
        response = session.post(
            f"{BASE_URL}/api/user/registerUser",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        status_code = response.status_code
        
        try:
            response_data = response.json()
        except Exception:
            return log_test(
                4,
                "registerUser with NEW email + wallet/referral verification (P1/P2)",
                "FAIL",
                f"HTTP {status_code}, non-JSON response: {response.text[:200]}"
            )
        
        if status_code != 200:
            return log_test(
                4,
                "registerUser with NEW email + wallet/referral verification (P1/P2)",
                "FAIL",
                f"Expected HTTP 200, got {status_code}. Response: {json.dumps(response_data)[:200]}"
            )
        
        # Extract token and referral_code
        access_token = None
        referral_code = None
        user_id = None
        
        if isinstance(response_data, dict):
            if 'data' in response_data:
                data = response_data['data']
                access_token = data.get('accessToken') or data.get('token')
                referral_code = data.get('referral_code')
                if 'userData' in data:
                    user_id = data['userData'].get('user_id') or data['userData'].get('id')
                elif 'user' in data:
                    user_id = data['user'].get('user_id') or data['user'].get('id')
            else:
                access_token = response_data.get('accessToken') or response_data.get('token')
                referral_code = response_data.get('referral_code')
        
        if not access_token:
            return log_test(
                4,
                "registerUser with NEW email + wallet/referral verification (P1/P2)",
                "FAIL",
                f"HTTP 200 but no accessToken in response. Response: {json.dumps(response_data)[:300]}"
            )
        
        # Check referral_code starts with "DYNO-"
        referral_check = "NOT FOUND"
        if referral_code:
            if referral_code.startswith("DYNO-"):
                referral_check = f"✓ {referral_code}"
            else:
                referral_check = f"✗ {referral_code} (does not start with DYNO-)"
        
        print(f"   Registration successful: token={access_token[:20]}..., referral_code={referral_check}, user_id={user_id}")
        
        # Step 2: Get profile to verify referral_code
        profile_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        profile_response = session.get(
            f"{BASE_URL}/api/user/profile",
            headers=profile_headers,
            timeout=10
        )
        
        profile_data = None
        try:
            profile_data = profile_response.json()
        except Exception:
            pass
        
        profile_referral = None
        if profile_response.status_code == 200 and profile_data:
            if isinstance(profile_data, dict):
                if 'data' in profile_data:
                    profile_referral = profile_data['data'].get('referral_code')
                else:
                    profile_referral = profile_data.get('referral_code')
        
        print(f"   Profile referral_code: {profile_referral}")
        
        # Step 3: Get onboarding status to verify wallet creation
        onboarding_response = session.get(
            f"{BASE_URL}/api/user/onboarding-status",
            headers=profile_headers,
            timeout=10
        )
        
        wallet_count = None
        has_wallet = None
        onboarding_data = None
        
        try:
            onboarding_data = onboarding_response.json()
        except Exception:
            pass
        
        if onboarding_response.status_code == 200 and onboarding_data:
            if isinstance(onboarding_data, dict):
                if 'data' in onboarding_data:
                    data = onboarding_data['data']
                else:
                    data = onboarding_data
                
                # Look for wallet_setup info
                if 'wallet_setup' in data:
                    wallet_setup = data['wallet_setup']
                    wallet_count = wallet_setup.get('wallet_count')
                    has_wallet = wallet_setup.get('has_wallet')
                elif 'wallets' in data:
                    wallets = data['wallets']
                    if isinstance(wallets, list):
                        wallet_count = len(wallets)
                        has_wallet = wallet_count > 0
        
        print(f"   Wallet status: wallet_count={wallet_count}, has_wallet={has_wallet}")
        
        # Compile results
        issues = []
        
        if not referral_code or not referral_code.startswith("DYNO-"):
            issues.append(f"referral_code in registration response: {referral_code or 'MISSING'}")
        
        if not profile_referral:
            issues.append(f"referral_code in profile: MISSING")
        
        if wallet_count is None or wallet_count == 0:
            issues.append(f"wallet_count: {wallet_count} (expected > 0)")
        
        if issues:
            return log_test(
                4,
                "registerUser with NEW email + wallet/referral verification (P1/P2)",
                "FAIL",
                f"Registration succeeded but verification failed: {', '.join(issues)}. Created user: email={email}, user_id={user_id}, referral_code={referral_code}"
            )
        
        return log_test(
            4,
            "registerUser with NEW email + wallet/referral verification (P1/P2)",
            "PASS",
            f"✓ Registration: token issued, referral_code={referral_code}. ✓ Profile: referral_code={profile_referral}. ✓ Wallets: wallet_count={wallet_count}, has_wallet={has_wallet}. Created user: email={email}, user_id={user_id}"
        )
        
    except Exception as e:
        return log_test(
            4,
            "registerUser with NEW email + wallet/referral verification (P1/P2)",
            "FAIL",
            f"Exception: {str(e)}"
        )

def test_5_google_signin_invalid_token():
    """
    REGRESSION Test 5: POST /api/user/google-signin with bogus token
    Expect 401 "Invalid Google access token" (proves server-side verification)
    """
    session = requests.Session()
    
    payload = {
        "accessToken": "bogus-token"
    }
    
    try:
        response = session.post(
            f"{BASE_URL}/api/user/google-signin",
            json=payload,
            timeout=10
        )
        
        status_code = response.status_code
        
        try:
            response_data = response.json()
        except Exception:
            response_data = {"text": response.text[:200]}
        
        # Expect 401 with message about invalid token
        if status_code == 401:
            message = ""
            if isinstance(response_data, dict):
                message = response_data.get('message', '') or response_data.get('error', '')
            
            if "invalid" in message.lower() and "google" in message.lower():
                return log_test(
                    5,
                    "google-signin with invalid token (REGRESSION)",
                    "PASS",
                    f"HTTP 401 with correct message: '{message}'"
                )
            else:
                return log_test(
                    5,
                    "google-signin with invalid token (REGRESSION)",
                    "PASS",
                    f"HTTP 401 (correct status). Message: '{message}'"
                )
        
        else:
            return log_test(
                5,
                "google-signin with invalid token (REGRESSION)",
                "FAIL",
                f"Expected HTTP 401, got {status_code}. Response: {json.dumps(response_data)[:200]}"
            )
            
    except Exception as e:
        return log_test(
            5,
            "google-signin with invalid token (REGRESSION)",
            "FAIL",
            f"Exception: {str(e)}"
        )

def test_6_github_signin_no_code():
    """
    REGRESSION Test 6: POST /api/user/github-signin with no code
    Expect 400 "GitHub authorization code is required"
    """
    session = requests.Session()
    
    # Get CSRF token (github-signin may require it)
    csrf_token = get_csrf_token(session)
    
    payload = {}
    
    headers = {}
    if csrf_token:
        headers["x-csrf-token"] = csrf_token
    
    try:
        response = session.post(
            f"{BASE_URL}/api/user/github-signin",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        status_code = response.status_code
        
        try:
            response_data = response.json()
        except Exception:
            response_data = {"text": response.text[:200]}
        
        # Expect 400 with message about required code
        if status_code == 400:
            message = ""
            if isinstance(response_data, dict):
                message = response_data.get('message', '') or response_data.get('error', '')
            
            if "github" in message.lower() and ("code" in message.lower() or "required" in message.lower()):
                return log_test(
                    6,
                    "github-signin with no code (REGRESSION)",
                    "PASS",
                    f"HTTP 400 with correct message: '{message}'"
                )
            else:
                return log_test(
                    6,
                    "github-signin with no code (REGRESSION)",
                    "PASS",
                    f"HTTP 400 (correct status). Message: '{message}'"
                )
        
        else:
            return log_test(
                6,
                "github-signin with no code (REGRESSION)",
                "FAIL",
                f"Expected HTTP 400, got {status_code}. Response: {json.dumps(response_data)[:200]}"
            )
            
    except Exception as e:
        return log_test(
            6,
            "github-signin with no code (REGRESSION)",
            "FAIL",
            f"Exception: {str(e)}"
        )

def test_7_regression_endpoints():
    """
    REGRESSION Test 7: Verify existing endpoints still work
    - GET /api/user/checkEmail?email=hostbay@moxx.co -> {validEmail:true}
    - GET /api/user/creator/check-handle-public?handle=zzswrtesthandle -> available:true/false
    - GET /health -> status healthy
    """
    session = requests.Session()
    
    results = []
    all_pass = True
    
    # Test 7a: checkEmail
    try:
        response = session.get(
            f"{BASE_URL}/api/user/checkEmail?email=hostbay@moxx.co",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            # Response structure: {"message":"...","data":{"validEmail":true,...}}
            valid_email = None
            if 'data' in data:
                valid_email = data['data'].get('validEmail')
            else:
                valid_email = data.get('validEmail')
            
            if valid_email is True:
                results.append("✓ checkEmail: validEmail=true")
            else:
                results.append(f"✗ checkEmail: validEmail={valid_email} (expected true)")
                all_pass = False
        else:
            results.append(f"✗ checkEmail: HTTP {response.status_code}")
            all_pass = False
    except Exception as e:
        results.append(f"✗ checkEmail: {str(e)}")
        all_pass = False
    
    # Test 7b: check-handle-public
    try:
        response = session.get(
            f"{BASE_URL}/api/user/creator/check-handle-public?handle=zzswrtesthandle",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            # Response structure: {"message":"checked","data":{"available":true,...}}
            available = None
            if 'data' in data:
                available = data['data'].get('available')
            else:
                available = data.get('available')
            
            if available is not None:
                results.append(f"✓ check-handle-public: available={available}")
            else:
                results.append(f"✗ check-handle-public: no 'available' field in response")
                all_pass = False
        else:
            results.append(f"✗ check-handle-public: HTTP {response.status_code}")
            all_pass = False
    except Exception as e:
        results.append(f"✗ check-handle-public: {str(e)}")
        all_pass = False
    
    # Test 7c: health
    try:
        response = session.get(
            f"{BASE_URL}/api/status/health",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            status = data.get('status')
            if status == 'healthy':
                results.append("✓ /api/status/health: status=healthy")
            else:
                results.append(f"✗ /api/status/health: status={status} (expected healthy)")
                all_pass = False
        else:
            results.append(f"✗ /api/status/health: HTTP {response.status_code}")
            all_pass = False
    except Exception as e:
        results.append(f"✗ /api/status/health: {str(e)}")
        all_pass = False
    
    status = "PASS" if all_pass else "FAIL"
    details = "; ".join(results)
    
    return log_test(
        7,
        "Regression endpoints (checkEmail, check-handle-public, health)",
        status,
        details
    )

def main():
    """Run all tests"""
    print("=" * 80)
    print("DynoPay Onboarding Security Verification Tests")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Started: {datetime.utcnow().isoformat()}")
    print("=" * 80)
    
    # Run all tests
    test_1_connectSocial_new_email()
    test_2_connectSocial_existing_email()
    test_3_registerUser_duplicate_email()
    test_4_registerUser_new_account()
    test_5_google_signin_invalid_token()
    test_6_github_signin_no_code()
    test_7_regression_endpoints()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in test_results if r['status'] == 'PASS')
    failed = sum(1 for r in test_results if r['status'] == 'FAIL')
    total = len(test_results)
    
    print(f"Total: {total} tests")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Pass rate: {(passed/total*100):.1f}%")
    
    # P0 security check
    p0_tests = [r for r in test_results if r['test'] in [1, 2]]
    p0_passed = all(r['status'] == 'PASS' for r in p0_tests)
    
    print("\n" + "=" * 80)
    if p0_passed:
        print("✅ P0 SECURITY: ACCOUNT-TAKEOVER BYPASS IS CLOSED")
        print("   Tests 1 & 2 both passed - /connectSocial does NOT issue tokens")
    else:
        print("❌ P0 SECURITY: ACCOUNT-TAKEOVER BYPASS STILL OPEN")
        print("   CRITICAL: Tests 1 or 2 failed - /connectSocial may still issue tokens")
    print("=" * 80)
    
    # Save results to file
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.utcnow().isoformat(),
            'base_url': BASE_URL,
            'summary': {
                'total': total,
                'passed': passed,
                'failed': failed,
                'pass_rate': f"{(passed/total*100):.1f}%",
                'p0_security_closed': p0_passed
            },
            'tests': test_results
        }, f, indent=2)
    
    print(f"\nDetailed results saved to: /app/backend_test_results.json")
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
