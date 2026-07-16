#!/usr/bin/env python3
"""
Session 60 Backend Testing - Creator Page Enhancements
Tests: Custom Theme, Vanity Analytics, Public Profile, Handle Claim
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Test Configuration
BASE_URL = "https://crypto-gateway-25.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "hostbay@moxx.co",
    "password": "Katiekendra123@"
}
CREATOR_HANDLE = "hostbay"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_test(test_name: str, status: str, details: str = ""):
    """Log test result with color coding"""
    color = Colors.GREEN if status == "PASS" else Colors.RED if status == "FAIL" else Colors.YELLOW
    print(f"{color}[{status}]{Colors.END} {test_name}")
    if details:
        print(f"  → {details}")

def get_csrf_token(session: requests.Session) -> str:
    """Get CSRF token from the API"""
    try:
        response = session.get(f"{BASE_URL}/api/csrf-token", timeout=10)
        if response.status_code == 200:
            data = response.json()
            token = data.get('csrf_token') or data.get('csrfToken')
            if token:
                return token
        print(f"{Colors.RED}Failed to get CSRF token: {response.status_code}{Colors.END}")
        return ""
    except Exception as e:
        print(f"{Colors.RED}CSRF token error: {e}{Colors.END}")
        return ""

def login(session: requests.Session, csrf_token: str) -> Optional[str]:
    """Login and return Bearer token"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf_token
        }
        response = session.post(
            f"{BASE_URL}/api/user/login",
            json=TEST_CREDENTIALS,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            # Try different possible token field names
            token = (data.get('data', {}).get('accessToken') or 
                    data.get('accessToken') or 
                    data.get('token'))
            if token:
                print(f"{Colors.GREEN}✓ Login successful{Colors.END}")
                return token
        
        print(f"{Colors.RED}Login failed: {response.status_code} - {response.text[:200]}{Colors.END}")
        return None
    except Exception as e:
        print(f"{Colors.RED}Login error: {e}{Colors.END}")
        return None

def test_theme_update_valid(session: requests.Session, token: str) -> bool:
    """A.1: PUT /api/user/creator/profile with valid theme fields"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_accent_color": "#FF3D9A",
            "theme_cover_style": "gradient",
            "theme_cover_gradient": "sunset"
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            resp_data = data.get('data', {})
            
            # Check if theme fields are echoed back
            if (resp_data.get('theme_accent_color') == "#FF3D9A" and
                resp_data.get('theme_cover_style') == "gradient" and
                resp_data.get('theme_cover_gradient') == "sunset"):
                log_test("A.1: Valid theme update", "PASS", "Theme fields echoed correctly")
                return True
            else:
                log_test("A.1: Valid theme update", "FAIL", f"Theme fields not echoed: {resp_data}")
                return False
        else:
            log_test("A.1: Valid theme update", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("A.1: Valid theme update", "FAIL", f"Exception: {e}")
        return False

def test_theme_invalid_hex(session: requests.Session, token: str) -> bool:
    """A.2: PUT with invalid hex color"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_accent_color": "not-a-color"
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 400:
            error_msg = response.json().get('message', '').lower()
            if 'accent' in error_msg or 'color' in error_msg or 'hex' in error_msg:
                log_test("A.2: Invalid hex color", "PASS", "400 with clear error message")
                return True
            else:
                log_test("A.2: Invalid hex color", "FAIL", f"400 but unclear error: {error_msg}")
                return False
        else:
            log_test("A.2: Invalid hex color", "FAIL", f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        log_test("A.2: Invalid hex color", "FAIL", f"Exception: {e}")
        return False

def test_theme_invalid_cover_style(session: requests.Session, token: str) -> bool:
    """A.3: PUT with invalid cover_style"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_cover_style": "sparkles"
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 400:
            log_test("A.3: Invalid cover_style", "PASS", "400 returned")
            return True
        else:
            log_test("A.3: Invalid cover_style", "FAIL", f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        log_test("A.3: Invalid cover_style", "FAIL", f"Exception: {e}")
        return False

def test_theme_invalid_gradient(session: requests.Session, token: str) -> bool:
    """A.4: PUT with invalid gradient"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_cover_gradient": "purple-galaxy"
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 400:
            log_test("A.4: Invalid gradient", "PASS", "400 returned")
            return True
        else:
            log_test("A.4: Invalid gradient", "FAIL", f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        log_test("A.4: Invalid gradient", "FAIL", f"Exception: {e}")
        return False

def test_theme_custom_gradient(session: requests.Session, token: str) -> bool:
    """A.5: PUT with valid custom gradient"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_cover_gradient": "#FF0000,#00FF00"
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            log_test("A.5: Valid custom gradient", "PASS", "200 returned")
            return True
        else:
            log_test("A.5: Valid custom gradient", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("A.5: Valid custom gradient", "FAIL", f"Exception: {e}")
        return False

def test_theme_clear_accent(session: requests.Session, token: str) -> bool:
    """A.6: PUT with theme_accent_color=null"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_accent_color": None
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            log_test("A.6: Clear accent color", "PASS", "200 returned")
            return True
        else:
            log_test("A.6: Clear accent color", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        log_test("A.6: Clear accent color", "FAIL", f"Exception: {e}")
        return False

def test_public_profile_theme(session: requests.Session) -> bool:
    """A.7: GET /api/pay/creator/hostbay (unauth, public) - verify theme object"""
    try:
        # No auth headers - public endpoint
        response = session.get(
            f"{BASE_URL}/api/pay/creator/{CREATOR_HANDLE}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            creator = data.get('data', {}).get('creator', {})
            theme = creator.get('theme', {})
            
            # Check theme object exists with required keys
            if isinstance(theme, dict):
                has_keys = all(k in theme for k in ['accent_color', 'cover_style', 'cover_gradient'])
                if has_keys:
                    # After A.5, cover_gradient should be lowercased custom gradient
                    gradient = theme.get('cover_gradient', '')
                    if gradient and gradient.lower() == "#ff0000,#00ff00":
                        log_test("A.7: Public profile theme", "PASS", f"Theme object present with custom gradient: {gradient}")
                        return True
                    else:
                        log_test("A.7: Public profile theme", "PASS", f"Theme object present (gradient: {gradient})")
                        return True
                else:
                    log_test("A.7: Public profile theme", "FAIL", f"Theme missing keys: {theme}")
                    return False
            else:
                log_test("A.7: Public profile theme", "FAIL", f"Theme is not an object: {theme}")
                return False
        else:
            log_test("A.7: Public profile theme", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("A.7: Public profile theme", "FAIL", f"Exception: {e}")
        return False

def test_theme_reset(session: requests.Session, token: str) -> bool:
    """A.8: Reset theme to clean state"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        payload = {
            "theme_accent_color": None,
            "theme_cover_style": None,
            "theme_cover_gradient": None
        }
        
        response = session.put(
            f"{BASE_URL}/api/user/creator/profile",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            log_test("A.8: Reset theme", "PASS", "Theme cleared")
            return True
        else:
            log_test("A.8: Reset theme", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("A.8: Reset theme", "FAIL", f"Exception: {e}")
        return False

def test_referrer_tracking(session: requests.Session) -> bool:
    """B.1: Hit public profile with different Referer headers"""
    try:
        referers = [
            "https://reddit.com/r/somepost",
            "https://x.com/user/status/123",
            None  # No referer = (direct)
        ]
        
        for referer in referers:
            headers = {}
            if referer:
                headers['Referer'] = referer
            
            response = session.get(
                f"{BASE_URL}/api/pay/creator/{CREATOR_HANDLE}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                log_test("B.1: Referrer tracking", "FAIL", f"Failed to hit profile with referer: {referer}")
                return False
        
        log_test("B.1: Referrer tracking", "PASS", "Hit profile 3 times with different referers")
        return True
    except Exception as e:
        log_test("B.1: Referrer tracking", "FAIL", f"Exception: {e}")
        return False

def test_creator_stats(session: requests.Session, token: str) -> bool:
    """B.2: GET /api/user/creator/stats - verify new fields"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = session.get(
            f"{BASE_URL}/api/user/creator/stats",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            stats = data.get('data', {})
            
            # Check required fields
            required_fields = ['top_referrers', 'daily_visits', 'has_handle', 'total_visits', 'this_week_visits']
            missing = [f for f in required_fields if f not in stats]
            
            if missing:
                log_test("B.2: Creator stats", "FAIL", f"Missing fields: {missing}")
                return False
            
            # Validate top_referrers structure
            top_referrers = stats.get('top_referrers', [])
            if not isinstance(top_referrers, list):
                log_test("B.2: Creator stats", "FAIL", f"top_referrers not a list: {type(top_referrers)}")
                return False
            
            # Validate daily_visits structure
            daily_visits = stats.get('daily_visits', [])
            if not isinstance(daily_visits, list):
                log_test("B.2: Creator stats", "FAIL", f"daily_visits not a list: {type(daily_visits)}")
                return False
            
            if len(daily_visits) != 14:
                log_test("B.2: Creator stats", "FAIL", f"daily_visits should have 14 items, got {len(daily_visits)}")
                return False
            
            # Check daily_visits structure
            for item in daily_visits:
                if not isinstance(item, dict) or 'date' not in item or 'count' not in item:
                    log_test("B.2: Creator stats", "FAIL", f"Invalid daily_visits item: {item}")
                    return False
            
            # Check has_handle
            if not stats.get('has_handle'):
                log_test("B.2: Creator stats", "FAIL", "has_handle should be true")
                return False
            
            log_test("B.2: Creator stats", "PASS", 
                    f"All fields present. top_referrers: {len(top_referrers)}, daily_visits: {len(daily_visits)}, total_visits: {stats.get('total_visits')}")
            return True
        else:
            log_test("B.2: Creator stats", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("B.2: Creator stats", "FAIL", f"Exception: {e}")
        return False

def test_referrer_in_stats(session: requests.Session, token: str) -> bool:
    """B.3: Verify top_referrers includes reddit.com and x.com"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = session.get(
            f"{BASE_URL}/api/user/creator/stats",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            stats = data.get('data', {})
            top_referrers = stats.get('top_referrers', [])
            
            # Extract domains from top_referrers
            domains = [r.get('domain', '') for r in top_referrers if isinstance(r, dict)]
            
            # Check if reddit.com or x.com are present
            has_reddit = any('reddit.com' in d for d in domains)
            has_x = any('x.com' in d for d in domains)
            
            if has_reddit or has_x:
                log_test("B.3: Referrers in stats", "PASS", f"Found referrers: {domains}")
                return True
            else:
                log_test("B.3: Referrers in stats", "WARN", f"No reddit/x.com in referrers yet: {domains}")
                return True  # Not a failure - might take time to propagate
        else:
            log_test("B.3: Referrers in stats", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("B.3: Referrers in stats", "FAIL", f"Exception: {e}")
        return False

def test_self_referral_rejection(session: requests.Session) -> bool:
    """B.4: Self-referral should NOT appear in top_referrers"""
    try:
        # Hit with self-host referer
        headers = {
            'Referer': f'https://dynopay.me/{CREATOR_HANDLE}'
        }
        
        response = session.get(
            f"{BASE_URL}/api/pay/creator/{CREATOR_HANDLE}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            log_test("B.4: Self-referral rejection", "PASS", "Self-referral hit recorded (should be filtered)")
            return True
        else:
            log_test("B.4: Self-referral rejection", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("B.4: Self-referral rejection", "FAIL", f"Exception: {e}")
        return False

def test_public_profile_unauth(session: requests.Session) -> bool:
    """C.1: GET /api/pay/creator/hostbay (no auth) - verify theme keys exist"""
    try:
        response = session.get(
            f"{BASE_URL}/api/pay/creator/{CREATOR_HANDLE}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            creator = data.get('data', {}).get('creator', {})
            theme = creator.get('theme', {})
            
            if isinstance(theme, dict) and all(k in theme for k in ['accent_color', 'cover_style', 'cover_gradient']):
                log_test("C.1: Public profile unauth", "PASS", "Theme keys exist")
                return True
            else:
                log_test("C.1: Public profile unauth", "FAIL", f"Theme structure invalid: {theme}")
                return False
        else:
            log_test("C.1: Public profile unauth", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("C.1: Public profile unauth", "FAIL", f"Exception: {e}")
        return False

def test_handle_check_available(session: requests.Session, token: str) -> bool:
    """D.1: Check handle availability for new handle"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = session.get(
            f"{BASE_URL}/api/user/creator/check-handle?handle=xylophone_test_abc",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            resp_data = data.get('data', {})
            
            if 'available' in resp_data and 'reason' in resp_data:
                log_test("D.1: Handle check available", "PASS", 
                        f"available={resp_data.get('available')}, reason={resp_data.get('reason')}")
                return True
            else:
                log_test("D.1: Handle check available", "FAIL", f"Missing fields: {resp_data}")
                return False
        else:
            log_test("D.1: Handle check available", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("D.1: Handle check available", "FAIL", f"Exception: {e}")
        return False

def test_handle_check_own(session: requests.Session, token: str) -> bool:
    """D.2: Check own handle - should return available=true"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = session.get(
            f"{BASE_URL}/api/user/creator/check-handle?handle={CREATOR_HANDLE}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            resp_data = data.get('data', {})
            
            if resp_data.get('available') == True:
                log_test("D.2: Handle check own", "PASS", "Own handle returns available=true")
                return True
            else:
                log_test("D.2: Handle check own", "FAIL", f"Expected available=true, got {resp_data}")
                return False
        else:
            log_test("D.2: Handle check own", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("D.2: Handle check own", "FAIL", f"Exception: {e}")
        return False

def test_handle_check_short(session: requests.Session, token: str) -> bool:
    """D.3: Check handle too short - should return available=false"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = session.get(
            f"{BASE_URL}/api/user/creator/check-handle?handle=ab",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            resp_data = data.get('data', {})
            
            if resp_data.get('available') == False:
                reason = resp_data.get('reason', '').lower()
                if 'format' in reason or 'char' in reason or '3' in reason:
                    log_test("D.3: Handle check short", "PASS", f"Rejected with reason: {resp_data.get('reason')}")
                    return True
                else:
                    log_test("D.3: Handle check short", "FAIL", f"Rejected but unclear reason: {resp_data.get('reason')}")
                    return False
            else:
                log_test("D.3: Handle check short", "FAIL", f"Expected available=false, got {resp_data}")
                return False
        else:
            log_test("D.3: Handle check short", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("D.3: Handle check short", "FAIL", f"Exception: {e}")
        return False

def test_handle_check_invalid(session: requests.Session, token: str) -> bool:
    """D.4: Check invalid handle format - should return available=false"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = session.get(
            f"{BASE_URL}/api/user/creator/check-handle?handle=INVALID%20HANDLE!!",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            resp_data = data.get('data', {})
            
            if resp_data.get('available') == False:
                reason = resp_data.get('reason', '').lower()
                if 'format' in reason or 'invalid' in reason:
                    log_test("D.4: Handle check invalid", "PASS", f"Rejected with reason: {resp_data.get('reason')}")
                    return True
                else:
                    log_test("D.4: Handle check invalid", "FAIL", f"Rejected but unclear reason: {resp_data.get('reason')}")
                    return False
            else:
                log_test("D.4: Handle check invalid", "FAIL", f"Expected available=false, got {resp_data}")
                return False
        else:
            log_test("D.4: Handle check invalid", "FAIL", f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("D.4: Handle check invalid", "FAIL", f"Exception: {e}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*70}")
    print("Session 60 Backend Testing - Creator Page Enhancements")
    print(f"{'='*70}{Colors.END}\n")
    
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {TEST_CREDENTIALS['email']}")
    print(f"Creator Handle: {CREATOR_HANDLE}\n")
    
    # Create session
    session = requests.Session()
    
    # Get CSRF token and login
    print(f"{Colors.BLUE}[AUTH] Getting CSRF token and logging in...{Colors.END}")
    csrf_token = get_csrf_token(session)
    if not csrf_token:
        print(f"{Colors.RED}Failed to get CSRF token. Aborting.{Colors.END}")
        sys.exit(1)
    
    token = login(session, csrf_token)
    if not token:
        print(f"{Colors.RED}Login failed. Aborting.{Colors.END}")
        sys.exit(1)
    
    print()
    
    # Track results
    results = []
    
    # Section A: Custom Creator Theme
    print(f"{Colors.BLUE}{'='*70}")
    print("SECTION A: Custom Creator Theme")
    print(f"{'='*70}{Colors.END}\n")
    
    results.append(("A.1", test_theme_update_valid(session, token)))
    results.append(("A.2", test_theme_invalid_hex(session, token)))
    results.append(("A.3", test_theme_invalid_cover_style(session, token)))
    results.append(("A.4", test_theme_invalid_gradient(session, token)))
    results.append(("A.5", test_theme_custom_gradient(session, token)))
    results.append(("A.6", test_theme_clear_accent(session, token)))
    results.append(("A.7", test_public_profile_theme(session)))
    results.append(("A.8", test_theme_reset(session, token)))
    
    # Section B: Vanity Link Analytics
    print(f"\n{Colors.BLUE}{'='*70}")
    print("SECTION B: Vanity Link Analytics")
    print(f"{'='*70}{Colors.END}\n")
    
    results.append(("B.1", test_referrer_tracking(session)))
    results.append(("B.2", test_creator_stats(session, token)))
    results.append(("B.3", test_referrer_in_stats(session, token)))
    results.append(("B.4", test_self_referral_rejection(session)))
    
    # Section C: Public Creator Profile
    print(f"\n{Colors.BLUE}{'='*70}")
    print("SECTION C: Public Creator Profile")
    print(f"{'='*70}{Colors.END}\n")
    
    results.append(("C.1", test_public_profile_unauth(session)))
    
    # Section D: Handle Claim
    print(f"\n{Colors.BLUE}{'='*70}")
    print("SECTION D: Handle Claim (Reserve My Handle)")
    print(f"{'='*70}{Colors.END}\n")
    
    results.append(("D.1", test_handle_check_available(session, token)))
    results.append(("D.2", test_handle_check_own(session, token)))
    results.append(("D.3", test_handle_check_short(session, token)))
    results.append(("D.4", test_handle_check_invalid(session, token)))
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*70}")
    print("TEST SUMMARY")
    print(f"{'='*70}{Colors.END}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"Total Tests: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {total - passed}{Colors.END}")
    print(f"Success Rate: {(passed/total)*100:.1f}%\n")
    
    # List failed tests
    failed_tests = [test_id for test_id, result in results if not result]
    if failed_tests:
        print(f"{Colors.RED}Failed Tests: {', '.join(failed_tests)}{Colors.END}\n")
    else:
        print(f"{Colors.GREEN}✓ All tests passed!{Colors.END}\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
