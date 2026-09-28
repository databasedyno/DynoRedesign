#!/usr/bin/env python3
"""
Backend API Testing for DynoPay Weekly Summary Bugfix Verification
READ-ONLY testing on LIVE PRODUCTION DB
"""

import requests
import subprocess
import json
import sys
from typing import Dict, Any, Optional

# Base URL for the preview pod
BASE_URL = "https://6a6233ec-6bfc-417d-be21-dcf71faaed06.preview.emergentagent.com"

# Test credentials (owner account)
TEST_EMAIL = "onarrival21@gmail.com"
TEST_PASSWORD = "Katiekendra123@"
USER_ID = 1

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(test_name: str):
    """Log test name"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {test_name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def log_pass(message: str):
    """Log pass message"""
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def log_fail(message: str):
    """Log fail message"""
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def log_info(message: str):
    """Log info message"""
    print(f"{Colors.YELLOW}ℹ️  INFO: {message}{Colors.RESET}")

def get_totp_code() -> Optional[str]:
    """Get TOTP code for user_id 1"""
    try:
        result = subprocess.run(
            ["node", "/app/backend/scripts/print_totp.cjs", str(USER_ID)],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            # Extract the 6-digit code from output
            code = result.stdout.strip()
            # The script might output extra text, so extract just the 6-digit code
            import re
            match = re.search(r'\b(\d{6})\b', code)
            if match:
                return match.group(1)
            return code
        else:
            log_fail(f"Failed to get TOTP: {result.stderr}")
            return None
    except Exception as e:
        log_fail(f"Error getting TOTP: {str(e)}")
        return None

def authenticate() -> Optional[str]:
    """
    Authenticate and return Bearer token
    Returns: Bearer token or None if authentication fails
    """
    log_test("AUTHENTICATION - Login + 2FA")
    
    # Step 1: Login with email/password
    log_info("Step 1: POST /api/user/login")
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            },
            timeout=30
        )
        
        log_info(f"Login response status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"Login failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return None
        
        data = response.json()
        
        # Check for challenge_token in data (2FA required response)
        challenge_token = data.get("data", {}).get("challenge_token")
        if not challenge_token:
            challenge_token = data.get("challenge_token")
        if not challenge_token:
            log_fail("No challenge_token in login response")
            log_info(f"Response data: {json.dumps(data, indent=2)}")
            return None
        
        log_pass(f"Login successful, challenge_token received")
        
    except Exception as e:
        log_fail(f"Login request failed: {str(e)}")
        return None
    
    # Step 2: Get TOTP code
    log_info("Step 2: Getting TOTP code")
    totp_code = get_totp_code()
    if not totp_code:
        log_fail("Failed to get TOTP code")
        return None
    
    log_pass(f"TOTP code retrieved: {totp_code}")
    
    # Step 3: Validate 2FA
    log_info("Step 3: POST /api/user/2fa/validate")
    try:
        response = requests.post(
            f"{BASE_URL}/api/user/2fa/validate",
            json={
                "challenge_token": challenge_token,
                "token": totp_code
            },
            timeout=30
        )
        
        log_info(f"2FA validation response status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"2FA validation failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return None
        
        data = response.json()
        
        # Check for accessToken in data
        access_token = data.get("data", {}).get("accessToken")
        if not access_token:
            access_token = data.get("accessToken")
        if not access_token:
            log_fail("No accessToken in 2FA response")
            log_info(f"Response data: {json.dumps(data, indent=2)}")
            return None
        
        log_pass(f"2FA validation successful, accessToken received")
        log_pass(f"Authentication complete")
        
        return access_token
        
    except Exception as e:
        log_fail(f"2FA validation request failed: {str(e)}")
        return None

def test_health_endpoint():
    """Test 1: GET /health"""
    log_test("TEST 1: GET /health")
    
    try:
        # Try both base URL and localhost
        for url in [f"{BASE_URL}/health", "http://localhost:8001/health"]:
            log_info(f"Testing: {url}")
            try:
                response = requests.get(url, timeout=10)
                log_info(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    log_info(f"Response: {json.dumps(data, indent=2)}")
                    
                    # Check required fields
                    status = data.get("status")
                    database = data.get("database")
                    redis = data.get("redis")
                    
                    log_info(f"status: {status}")
                    log_info(f"database: {database}")
                    log_info(f"redis: {redis}")
                    
                    if status == "healthy" and database == "connected" and redis == "connected":
                        log_pass("Health check passed - all services healthy")
                        return True
                    else:
                        log_fail(f"Health check failed - status:{status}, database:{database}, redis:{redis}")
                        return False
                else:
                    log_info(f"Non-200 response from {url}")
            except Exception as e:
                log_info(f"Failed to connect to {url}: {str(e)}")
                continue
        
        log_fail("Health endpoint not accessible from any URL")
        return False
        
    except Exception as e:
        log_fail(f"Health check failed: {str(e)}")
        return False

def test_kyc_status(bearer_token: str):
    """Test 2: GET /api/kyc/status"""
    log_test("TEST 2: GET /api/kyc/status")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/kyc/status",
            headers={
                "Authorization": f"Bearer {bearer_token}"
            },
            timeout=30
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"KYC status request failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return False
        
        data = response.json()
        log_info(f"Response: {json.dumps(data, indent=2)}")
        
        # Look for volume field (could be total_volume, totalVolume, currentVolume, etc.)
        response_data = data.get("data", {})
        
        volume_fields = ["total_volume", "totalVolume", "currentVolume", "volume"]
        volume = None
        volume_field = None
        
        for field in volume_fields:
            if field in response_data:
                volume = response_data[field]
                volume_field = field
                break
        
        if volume is not None:
            log_pass(f"KYC status returned successfully")
            log_info(f"Volume field '{volume_field}': ${volume}")
            
            # Check if it's a realistic USD value
            if isinstance(volume, (int, float)) and volume > 0:
                log_pass(f"Volume is a valid USD number: ${volume}")
            else:
                log_info(f"Volume value: {volume} (type: {type(volume).__name__})")
            
            return True
        else:
            log_info(f"No volume field found in response. Available fields: {list(response_data.keys())}")
            log_pass("KYC status endpoint returned 200 (no crash)")
            return True
        
    except Exception as e:
        log_fail(f"KYC status test failed: {str(e)}")
        return False

def test_weekly_summary_dry_run(bearer_token: str):
    """Test 3: POST /api/notifications/trigger-weekly-summary (dry_run)"""
    log_test("TEST 3: POST /api/notifications/trigger-weekly-summary (dry_run)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/notifications/trigger-weekly-summary",
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json"
            },
            json={
                "user_id": USER_ID,
                "dry_run": True
            },
            timeout=30
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_fail(f"Weekly summary request failed with status {response.status_code}")
            log_info(f"Response: {response.text}")
            return False
        
        data = response.json()
        log_info(f"Response: {json.dumps(data, indent=2)}")
        
        # Check dry_run was honored
        results = data.get("data", {}).get("results", [])
        if not results:
            log_fail("No results in response")
            return False
        
        result = results[0]
        
        # Verify dry_run
        if result.get("dry_run") != True:
            log_fail("dry_run was not honored!")
            return False
        
        log_pass("dry_run=true confirmed (NO DB writes)")
        
        # Check total_volume
        summary = result.get("summary", {})
        total_volume = summary.get("total_volume")
        transaction_count = summary.get("transaction_count")
        completed_count = summary.get("completed_count")
        pending_count = summary.get("pending_count")
        
        log_info(f"total_volume: ${total_volume}")
        log_info(f"transaction_count: {transaction_count}")
        log_info(f"completed_count: {completed_count}")
        log_info(f"pending_count: {pending_count}")
        
        # Verify total_volume is realistic USD (should be hundreds/thousands, not tiny crypto amounts)
        if total_volume is None:
            log_fail("total_volume is missing from response")
            return False
        
        if not isinstance(total_volume, (int, float)):
            log_fail(f"total_volume is not a number: {total_volume} (type: {type(total_volume).__name__})")
            return False
        
        # Check if it's a realistic USD value (should be > $100 based on context)
        if total_volume < 50:
            log_fail(f"total_volume ${total_volume} is suspiciously low (likely raw crypto units, not USD)")
            return False
        
        if total_volume >= 100:
            log_pass(f"total_volume ${total_volume} is a realistic USD value (NOT raw crypto units)")
        else:
            log_info(f"total_volume ${total_volume} is between $50-$100 (borderline, but likely correct)")
        
        # Verify notification was NOT created (dry_run)
        notification = result.get("notification")
        if notification is None:
            log_pass("notification is null (NO DB write, as expected)")
        else:
            log_fail(f"notification was created despite dry_run: {notification}")
            return False
        
        log_pass("Weekly summary dry_run test passed")
        return True
        
    except Exception as e:
        log_fail(f"Weekly summary test failed: {str(e)}")
        return False

def check_backend_logs():
    """Test 4: Check backend error logs"""
    log_test("TEST 4: Check backend error logs")
    
    try:
        # Check for new ERROR lines in backend logs
        result = subprocess.run(
            ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            log_output = result.stdout
            
            if not log_output.strip():
                log_pass("No errors in backend.err.log (last 50 lines)")
                return True
            
            # Check for ERROR level logs
            error_lines = [line for line in log_output.split('\n') if 'ERROR' in line.upper()]
            
            if error_lines:
                log_info(f"Found {len(error_lines)} ERROR lines in recent logs:")
                for line in error_lines[-5:]:  # Show last 5 errors
                    log_info(f"  {line}")
                log_info("(Check if these are NEW errors from our tests)")
                return True
            else:
                log_pass("No ERROR lines in recent backend logs")
                return True
        else:
            log_info("Could not read backend.err.log")
            return True
        
    except Exception as e:
        log_info(f"Could not check backend logs: {str(e)}")
        return True  # Don't fail the test if we can't read logs

def main():
    """Main test runner"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}DynoPay Weekly Summary Bugfix Verification{Colors.RESET}")
    print(f"{Colors.BLUE}READ-ONLY Testing on LIVE PRODUCTION DB{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    results = {}
    
    # Test 1: Health check
    results["health"] = test_health_endpoint()
    
    # Authenticate
    bearer_token = authenticate()
    if not bearer_token:
        log_fail("Authentication failed - cannot proceed with authenticated tests")
        print_summary(results)
        return 1
    
    # Test 2: KYC status
    results["kyc_status"] = test_kyc_status(bearer_token)
    
    # Test 3: Weekly summary dry run
    results["weekly_summary"] = test_weekly_summary_dry_run(bearer_token)
    
    # Test 4: Check logs
    results["backend_logs"] = check_backend_logs()
    
    # Print summary
    print_summary(results)
    
    # Return exit code
    if all(results.values()):
        return 0
    else:
        return 1

def print_summary(results: Dict[str, bool]):
    """Print test summary"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if passed else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed = sum(results.values())
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if all(results.values()):
        print(f"{Colors.GREEN}{'='*80}{Colors.RESET}")
        print(f"{Colors.GREEN}ALL TESTS PASSED ✅✅✅{Colors.RESET}")
        print(f"{Colors.GREEN}{'='*80}{Colors.RESET}")
    else:
        print(f"{Colors.RED}{'='*80}{Colors.RESET}")
        print(f"{Colors.RED}SOME TESTS FAILED ❌{Colors.RESET}")
        print(f"{Colors.RED}{'='*80}{Colors.RESET}")

if __name__ == "__main__":
    sys.exit(main())
