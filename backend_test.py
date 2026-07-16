#!/usr/bin/env python3
"""
DynoPay Session Management Backend Test
Session 55: 7-day login + session list is_current flag + session revoke

Test account: hostbay@moxx.co / Katiekendra123@
Preview URL: https://multi-chain-pay-5.preview.emergentagent.com
"""

import requests
import json
import base64
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://multi-chain-pay-5.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log_test(test_name: str, passed: bool, message: str, details: Optional[Dict] = None):
    """Log test result"""
    result = {
        "test": test_name,
        "message": message,
        "details": details or {}
    }
    if passed:
        test_results["passed"].append(result)
        print(f"✅ {test_name}: {message}")
    else:
        test_results["failed"].append(result)
        print(f"❌ {test_name}: {message}")
    
    if details:
        print(f"   Details: {json.dumps(details, indent=2)}")

def log_warning(test_name: str, message: str):
    """Log warning"""
    test_results["warnings"].append({"test": test_name, "message": message})
    print(f"⚠️  {test_name}: {message}")

def get_csrf_token() -> Optional[str]:
    """Get CSRF token from /api/csrf-token"""
    try:
        response = requests.get(f"{API_URL}/csrf-token", timeout=10)
        if response.status_code == 200:
            data = response.json()
            csrf_token = data.get("csrf_token")
            print(f"✓ Got CSRF token: {csrf_token[:20]}...")
            return csrf_token
        else:
            print(f"✗ Failed to get CSRF token: HTTP {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"✗ Exception getting CSRF token: {e}")
        return None

def login(csrf_token: str) -> Optional[Dict[str, Any]]:
    """Login and return auth data"""
    try:
        headers = {
            "Content-Type": "application/json",
            "x-csrf-token": csrf_token
        }
        payload = {
            "email": EMAIL,
            "password": PASSWORD
        }
        
        response = requests.post(
            f"{API_URL}/user/login",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"  Full response: {json.dumps(data, indent=2)[:500]}")
            
            # Handle both possible response formats
            if "data" in data:
                auth_data = data["data"]
            elif "accessToken" in data:
                auth_data = data
            else:
                print(f"✗ Login failed: Unexpected response format")
                return None
            
            print(f"✓ Login successful")
            print(f"  accessToken: {auth_data.get('accessToken', '')[:30]}...")
            print(f"  refreshToken: {auth_data.get('refreshToken', '')[:30]}...")
            print(f"  expiresIn: {auth_data.get('expiresIn')}")
            return auth_data
        else:
            print(f"✗ Login failed: HTTP {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return None
    except Exception as e:
        print(f"✗ Exception during login: {e}")
        return None

def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT payload (without verification)"""
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Decode payload (add padding if needed)
        payload_b64 = parts[1]
        # Add padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes)
        return payload
    except Exception as e:
        print(f"✗ Failed to decode JWT: {e}")
        return None

def test_7_day_login(auth_data: Dict[str, Any]) -> bool:
    """Test 1: 7-day login persistence"""
    print("\n" + "="*80)
    print("TEST 1: 7-DAY LOGIN PERSISTENCE")
    print("="*80)
    
    all_passed = True
    
    # Check expiresIn in response
    expires_in = auth_data.get("expiresIn")
    if expires_in == 604800:
        log_test("1.1 expiresIn", True, f"expiresIn is 604800 (7 days)", {"expiresIn": expires_in})
    else:
        log_test("1.1 expiresIn", False, f"expiresIn is {expires_in}, expected 604800", {"expiresIn": expires_in})
        all_passed = False
    
    # Decode JWT and check exp - iat
    access_token = auth_data.get("accessToken")
    if access_token:
        payload = decode_jwt(access_token)
        if payload:
            exp = payload.get("exp")
            iat = payload.get("iat")
            if exp and iat:
                ttl = exp - iat
                ttl_days = ttl / 86400
                if ttl == 604800:
                    log_test("1.2 JWT TTL", True, f"JWT exp-iat is 604800 ({ttl_days:.1f} days)", 
                            {"exp": exp, "iat": iat, "ttl": ttl, "ttl_days": ttl_days})
                else:
                    log_test("1.2 JWT TTL", False, f"JWT exp-iat is {ttl} ({ttl_days:.1f} days), expected 604800", 
                            {"exp": exp, "iat": iat, "ttl": ttl, "ttl_days": ttl_days})
                    all_passed = False
            else:
                log_test("1.2 JWT TTL", False, "JWT missing exp or iat", {"payload": payload})
                all_passed = False
        else:
            log_test("1.2 JWT TTL", False, "Failed to decode JWT", {})
            all_passed = False
    else:
        log_test("1.2 JWT TTL", False, "No accessToken in response", {})
        all_passed = False
    
    return all_passed

def test_refresh_token(auth_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Test 1b: Refresh token rotation - returns new access token"""
    print("\n" + "="*80)
    print("TEST 1b: REFRESH TOKEN ROTATION")
    print("="*80)
    
    refresh_token = auth_data.get("refreshToken")
    if not refresh_token:
        log_test("1.3 Refresh token", False, "No refreshToken in login response", {})
        return False, None
    
    try:
        headers = {"Content-Type": "application/json"}
        payload = {"refresh_token": refresh_token}
        
        response = requests.post(
            f"{API_URL}/user/refresh-token",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Handle response format
            if "data" in data:
                new_data = data["data"]
            else:
                log_test("1.3 Refresh token", False, f"No data field in response", {"response": data})
                return False, None
            
            new_expires_in = new_data.get("expiresIn")
            new_access_token = new_data.get("accessToken")
            new_refresh_token = new_data.get("refreshToken")
            
            all_passed = True
            
            # Check expiresIn
            if new_expires_in == 604800:
                log_test("1.3 Refresh expiresIn", True, f"New expiresIn is 604800", {"expiresIn": new_expires_in})
            else:
                log_test("1.3 Refresh expiresIn", False, f"New expiresIn is {new_expires_in}, expected 604800", 
                        {"expiresIn": new_expires_in})
                all_passed = False
            
            # Check new accessToken
            if new_access_token and new_access_token != auth_data.get("accessToken"):
                log_test("1.4 New accessToken", True, "Received NEW accessToken", 
                        {"old": auth_data.get("accessToken", "")[:30], "new": new_access_token[:30]})
            else:
                log_test("1.4 New accessToken", False, "accessToken not rotated or missing", {})
                all_passed = False
            
            # Check new refreshToken
            if new_refresh_token and new_refresh_token != refresh_token:
                log_test("1.5 New refreshToken", True, "Received NEW refreshToken", 
                        {"old": refresh_token[:30], "new": new_refresh_token[:30]})
            else:
                log_test("1.5 New refreshToken", False, "refreshToken not rotated or missing", {})
                all_passed = False
            
            return all_passed, new_access_token
        else:
            log_test("1.3 Refresh token", False, f"HTTP {response.status_code}", 
                    {"response": response.text[:500]})
            return False, None
    except Exception as e:
        log_test("1.3 Refresh token", False, f"Exception: {e}", {})
        return False, None

def test_session_list(access_token: str) -> tuple[bool, Optional[list], Optional[str]]:
    """Test 2: Session list with is_current flag"""
    print("\n" + "="*80)
    print("TEST 2: SESSION LIST")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        
        response = requests.get(
            f"{API_URL}/user/sessions",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Handle response format
            if "data" in data:
                sessions = data["data"].get("sessions", [])
            else:
                log_test("2.1 Sessions list", False, "No data field in response", {"response": data})
                return False, None, None
            
            all_passed = True
            
            # Check sessions is non-empty array
            if isinstance(sessions, list) and len(sessions) > 0:
                log_test("2.1 Sessions array", True, f"Got {len(sessions)} sessions", {"count": len(sessions)})
            else:
                log_test("2.1 Sessions array", False, f"Sessions is empty or not an array", {"sessions": sessions})
                return False, None, None
            
            # Check exactly ONE is_current === true
            current_sessions = [s for s in sessions if s.get("is_current") is True]
            if len(current_sessions) == 1:
                log_test("2.2 is_current count", True, "Exactly ONE session has is_current === true", 
                        {"current_count": len(current_sessions)})
                current_session_id = current_sessions[0].get("session_id")
            else:
                log_test("2.2 is_current count", False, f"Found {len(current_sessions)} sessions with is_current === true, expected 1", 
                        {"current_count": len(current_sessions), "sessions": [s.get("session_id") for s in current_sessions]})
                all_passed = False
                current_session_id = current_sessions[0].get("session_id") if current_sessions else None
            
            # Check required fields on each session
            required_fields = ["session_id", "ip_address", "device_type", "device_name", "browser", "os", "last_activity"]
            sample_session = sessions[0]
            missing_fields = [f for f in required_fields if f not in sample_session]
            
            if not missing_fields:
                log_test("2.3 Required fields", True, "All required fields present", 
                        {"fields": required_fields, "sample": sample_session})
            else:
                log_test("2.3 Required fields", False, f"Missing fields: {missing_fields}", 
                        {"missing": missing_fields, "sample": sample_session})
                all_passed = False
            
            # CRITICAL: Check NO session_token field is leaked
            sessions_with_token = [s for s in sessions if "session_token" in s]
            if len(sessions_with_token) == 0:
                log_test("2.4 No session_token leak", True, "NO session contains session_token field", {})
            else:
                log_test("2.4 No session_token leak", False, f"{len(sessions_with_token)} sessions contain session_token field (SECURITY LEAK)", 
                        {"leaked_sessions": [s.get("session_id") for s in sessions_with_token]})
                all_passed = False
            
            return all_passed, sessions, current_session_id
        else:
            log_test("2.1 Sessions list", False, f"HTTP {response.status_code}", {"response": response.text[:500]})
            return False, None, None
    except Exception as e:
        log_test("2.1 Sessions list", False, f"Exception: {e}", {})
        return False, None, None

def test_revoke_one_session(access_token: str, sessions: list, current_session_id: str) -> bool:
    """Test 3: Revoke one non-current session"""
    print("\n" + "="*80)
    print("TEST 3: REVOKE ONE SESSION")
    print("="*80)
    
    # Find a non-current session
    non_current_sessions = [s for s in sessions if s.get("is_current") is not True]
    
    if not non_current_sessions:
        log_warning("3.1 Revoke one", "No non-current sessions available to revoke (only 1 session exists)")
        return True  # Not a failure, just no sessions to revoke
    
    target_session = non_current_sessions[0]
    target_session_id = target_session.get("session_id")
    
    print(f"  Target session to revoke: {target_session_id}")
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # DELETE the session
        response = requests.delete(
            f"{API_URL}/user/sessions/{target_session_id}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            log_test("3.1 Revoke session", True, f"Successfully revoked session {target_session_id}", 
                    {"session_id": target_session_id})
            
            # Wait a moment for the change to propagate
            time.sleep(1)
            
            # GET sessions again to verify
            response2 = requests.get(
                f"{API_URL}/user/sessions",
                headers=headers,
                timeout=10
            )
            
            if response2.status_code == 200:
                data2 = response2.json()
                
                # Handle response format
                if "data" in data2:
                    new_sessions = data2["data"].get("sessions", [])
                else:
                    log_test("3.2 Verify removal", False, "No data field in response", {"response": data2})
                    return False
                
                # Check target session is gone
                remaining_ids = [s.get("session_id") for s in new_sessions]
                if target_session_id not in remaining_ids:
                    log_test("3.2 Session removed", True, f"Session {target_session_id} is absent from list", 
                            {"remaining_count": len(new_sessions)})
                else:
                    log_test("3.2 Session removed", False, f"Session {target_session_id} still present", 
                            {"remaining_ids": remaining_ids})
                    return False
                
                # Check current session still present
                if current_session_id in remaining_ids:
                    log_test("3.3 Current session preserved", True, f"Current session {current_session_id} still present", {})
                else:
                    log_test("3.3 Current session preserved", False, f"Current session {current_session_id} was removed", 
                            {"remaining_ids": remaining_ids})
                    return False
                
                return True
            else:
                log_test("3.2 Verify removal", False, f"HTTP {response2.status_code}", {"response": response2.text[:500]})
                return False
        else:
            log_test("3.1 Revoke session", False, f"HTTP {response.status_code}", {"response": response.text[:500]})
            return False
    except Exception as e:
        log_test("3.1 Revoke session", False, f"Exception: {e}", {})
        return False

def test_revoke_all_others(access_token: str, current_session_id: str) -> bool:
    """Test 4: Revoke all other sessions"""
    print("\n" + "="*80)
    print("TEST 4: REVOKE ALL OTHER SESSIONS")
    print("="*80)
    
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        payload = {"current_session_id": current_session_id}
        
        # DELETE all other sessions
        response = requests.delete(
            f"{API_URL}/user/sessions",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            
            # Check for revoked count in message
            log_test("4.1 Revoke all others", True, f"Success: {message}", {"response": data})
            
            # Wait a moment
            time.sleep(1)
            
            # GET sessions again to verify
            response2 = requests.get(
                f"{API_URL}/user/sessions",
                headers=headers,
                timeout=10
            )
            
            if response2.status_code == 200:
                data2 = response2.json()
                
                # Handle response format
                if "data" in data2:
                    final_sessions = data2["data"].get("sessions", [])
                else:
                    log_test("4.2 Verify removal", False, "No data field in response", {"response": data2})
                    return False
                
                # Check only 1 session remains
                if len(final_sessions) == 1:
                    log_test("4.2 Only current remains", True, f"Only 1 session remains", {"count": len(final_sessions)})
                else:
                    log_test("4.2 Only current remains", False, f"{len(final_sessions)} sessions remain, expected 1", 
                            {"count": len(final_sessions), "sessions": [s.get("session_id") for s in final_sessions]})
                    return False
                
                # Check it's the current session
                remaining_session = final_sessions[0]
                if remaining_session.get("is_current") is True:
                    log_test("4.3 Remaining is current", True, "Remaining session has is_current === true", 
                            {"session_id": remaining_session.get("session_id")})
                else:
                    log_test("4.3 Remaining is current", False, "Remaining session does not have is_current === true", 
                            {"session": remaining_session})
                    return False
                
                return True
            else:
                log_test("4.2 Verify removal", False, f"HTTP {response2.status_code}", {"response": response2.text[:500]})
                return False
        else:
            log_test("4.1 Revoke all others", False, f"HTTP {response.status_code}", {"response": response.text[:500]})
            return False
    except Exception as e:
        log_test("4.1 Revoke all others", False, f"Exception: {e}", {})
        return False

def test_negative_cases(access_token: str) -> bool:
    """Test 5: Negative cases"""
    print("\n" + "="*80)
    print("TEST 5: NEGATIVE CASES")
    print("="*80)
    
    all_passed = True
    
    # Test 5.1: DELETE with bogus session ID
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.delete(
            f"{API_URL}/user/sessions/99999999",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 404:
            log_test("5.1 Bogus session ID", True, "DELETE bogus session returns HTTP 404", {"status": response.status_code})
        else:
            log_test("5.1 Bogus session ID", False, f"DELETE bogus session returns HTTP {response.status_code}, expected 404", 
                    {"status": response.status_code, "response": response.text[:200]})
            all_passed = False
    except Exception as e:
        log_test("5.1 Bogus session ID", False, f"Exception: {e}", {})
        all_passed = False
    
    # Test 5.2: GET sessions without Bearer token
    try:
        response = requests.get(
            f"{API_URL}/user/sessions",
            timeout=10
        )
        
        if response.status_code == 401:
            log_test("5.2 No Bearer token", True, "GET sessions without Bearer returns HTTP 401", {"status": response.status_code})
        else:
            log_test("5.2 No Bearer token", False, f"GET sessions without Bearer returns HTTP {response.status_code}, expected 401", 
                    {"status": response.status_code, "response": response.text[:200]})
            all_passed = False
    except Exception as e:
        log_test("5.2 No Bearer token", False, f"Exception: {e}", {})
        all_passed = False
    
    return all_passed

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_passed = len(test_results["passed"])
    total_failed = len(test_results["failed"])
    total_warnings = len(test_results["warnings"])
    total_tests = total_passed + total_failed
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"✅ Passed: {total_passed}")
    print(f"❌ Failed: {total_failed}")
    print(f"⚠️  Warnings: {total_warnings}")
    
    if total_failed > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results["failed"]:
            print(f"  - {result['test']}: {result['message']}")
    
    if total_warnings > 0:
        print("\n⚠️  WARNINGS:")
        for result in test_results["warnings"]:
            print(f"  - {result['test']}: {result['message']}")
    
    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n❌ {total_failed} TEST(S) FAILED")
    
    print("="*80)

def main():
    """Main test execution"""
    print("="*80)
    print("DynoPay Session Management Backend Test")
    print("Session 55: 7-day login + session list + session revoke")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    print(f"Test account: {EMAIL}")
    print("="*80)
    
    # Step 1: Get CSRF token
    print("\n[STEP 1] Getting CSRF token...")
    csrf_token = get_csrf_token()
    if not csrf_token:
        print("\n❌ FATAL: Cannot proceed without CSRF token")
        return
    
    # Step 2: Login
    print("\n[STEP 2] Logging in...")
    auth_data = login(csrf_token)
    if not auth_data:
        print("\n❌ FATAL: Cannot proceed without authentication")
        return
    
    access_token = auth_data.get("accessToken")
    if not access_token:
        print("\n❌ FATAL: No access token in response")
        return
    
    # Test 1: 7-day login
    test_7_day_login(auth_data)
    
    # Test 2: Session list (BEFORE refresh, so token matches)
    sessions_passed, sessions, current_session_id = test_session_list(access_token)
    
    # Test 1b: Refresh token (AFTER session list, so we don't invalidate the token)
    refresh_passed, new_access_token = test_refresh_token(auth_data)
    
    # Use the new access token for subsequent tests
    if new_access_token:
        access_token = new_access_token
        print(f"\n[INFO] Using new access token for remaining tests")
    
    # Test 3: Revoke one session (only if we have sessions)
    if sessions and current_session_id:
        test_revoke_one_session(access_token, sessions, current_session_id)
    
    # Test 4: Revoke all others (only if we have current_session_id)
    if current_session_id:
        test_revoke_all_others(access_token, current_session_id)
    
    # Test 5: Negative cases
    test_negative_cases(access_token)
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
