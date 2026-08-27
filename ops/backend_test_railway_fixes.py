#!/usr/bin/env python3
"""
Railway Production Bug Fixes Test Suite
Tests the 3 specific fixes mentioned in the review request:
1. generateOTP 500 errors - Telnyx SMS retry with email fallback
2. BinanceWS code=1006 disconnections - keepalive tuning (30s ping + 10s pong timeout + 90s stale detection)  
3. WordPress scanner bot protection - bot protection middleware with auto-IP-blocking
"""

import os
import sys
import json
import subprocess
import requests
import time
import re
from urllib.parse import urljoin

# Get the backend URL from frontend .env
def get_backend_url():
    """Read REACT_APP_BACKEND_URL from frontend/.env"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    url = line.split('=', 1)[1].strip().strip('"\'')
                    return url
        return 'http://localhost:8001'  # fallback
    except:
        return 'http://localhost:8001'  # fallback

BASE_URL = get_backend_url()

class RailwayBugFixesTestSuite:
    def __init__(self):
        self.passed_tests = 0
        self.total_tests = 0
        self.results = []

    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log a test result"""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        
        print(result)
        self.results.append((test_name, passed, details))

    def test_backend_health(self):
        """Test: Backend Health Check"""
        try:
            # Use localhost:8001 directly since that's where server runs
            health_url = "http://localhost:8001/health"
            response = requests.get(health_url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_test("Backend Health", True, f"Status: {data['status']}, Service: {data.get('service', 'N/A')}")
                else:
                    self.log_test("Backend Health", False, f"Status: {data.get('status', 'unknown')}")
            else:
                self.log_test("Backend Health", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Backend Health", False, f"Exception: {str(e)}")

    def test_typescript_compilation(self):
        """Test: TypeScript Compilation"""
        try:
            result = subprocess.run(
                ['npx', 'tsc', '--noEmit', '--skipLibCheck'],
                cwd='/app/backend',
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                self.log_test("TypeScript Compilation", True, "Clean compilation with no errors")
            else:
                self.log_test("TypeScript Compilation", False, f"Compilation errors: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            self.log_test("TypeScript Compilation", False, "Compilation timed out after 60s")
        except Exception as e:
            self.log_test("TypeScript Compilation", False, f"Exception: {str(e)}")

    def test_telnyx_env_vars_updated(self):
        """Test: Telnyx environment variables are updated"""
        try:
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
            
            # Check TELNYX_API_KEY does NOT contain the old key (old key is in ACCESS_TOKEN which is OK)
            # The important check is that TELNYX_API_KEY itself has the new key
            telnyx_key_match = re.search(r'TELNYX_API_KEY=([^\n]+)', env_content)
            if telnyx_key_match:
                telnyx_key = telnyx_key_match.group(1).strip()
                old_key_pattern = "KEY019_REDACTED"
                if old_key_pattern in telnyx_key:
                    self.log_test("Telnyx ENV Updated", False, f"TELNYX_API_KEY still contains old key: {old_key_pattern}")
                    return
            else:
                self.log_test("Telnyx ENV Updated", False, "TELNYX_API_KEY not found in .env")
                return
            
            # Check TELNYX_VERIFY_PROFILE_ID is the correct new one
            expected_profile_id = "4900019c-9984-0124-cb64-0c4f1557ec72"
            if f"TELNYX_VERIFY_PROFILE_ID={expected_profile_id}" in env_content:
                self.log_test("Telnyx ENV Updated", True, f"TELNYX_VERIFY_PROFILE_ID correctly set to {expected_profile_id}")
            else:
                # Check if it exists but is wrong
                profile_match = re.search(r'TELNYX_VERIFY_PROFILE_ID=([^\n]+)', env_content)
                if profile_match:
                    actual_profile = profile_match.group(1).strip()
                    if actual_profile == "env-checker-1":
                        self.log_test("Telnyx ENV Updated", False, f"TELNYX_VERIFY_PROFILE_ID still set to old value: {actual_profile}")
                    else:
                        self.log_test("Telnyx ENV Updated", False, f"TELNYX_VERIFY_PROFILE_ID set to unexpected value: {actual_profile}")
                else:
                    self.log_test("Telnyx ENV Updated", False, "TELNYX_VERIFY_PROFILE_ID not found in .env")
        except Exception as e:
            self.log_test("Telnyx ENV Updated", False, f"Exception: {str(e)}")

    def test_generateotp_sendtelnyx_sms_helper(self):
        """Test FIX 1: generateOTP sendTelnyxSMS helper with retry logic"""
        try:
            with open('/app/backend/controller/userController.ts', 'r') as f:
                content = f.read()
            
            fixes_found = 0
            details = []
            
            # Check for sendTelnyxSMS function with maxRetries parameter
            if 'sendTelnyxSMS = async (mobile: string, maxRetries: number = 1)' in content:
                fixes_found += 1
                details.append("sendTelnyxSMS function with maxRetries")
            
            # Check for retry loop with attempt < maxRetries
            if 'for (let attempt = 0; attempt <= maxRetries; attempt++)' in content:
                fixes_found += 1
                details.append("retry loop with maxRetries")
            
            # Check for sendEmailOTP helper function
            if 'sendEmailOTP = async (email: string, name: string)' in content:
                fixes_found += 1
                details.append("sendEmailOTP helper function")
            
            # Check for email fallback logic
            if 'SMS unavailable. OTP sent to your registered email instead' in content:
                fixes_found += 1
                details.append("email fallback message")
            
            # Check for 503 error instead of 500
            if 'Unable to send OTP at this time. Please try again shortly' in content and '503' in content:
                fixes_found += 1
                details.append("503 error code for failed OTP")
            
            if fixes_found >= 4:
                self.log_test("FIX 1: generateOTP Telnyx SMS Retry + Email Fallback", True, f"Found {fixes_found}/5 components: {', '.join(details)}")
            else:
                self.log_test("FIX 1: generateOTP Telnyx SMS Retry + Email Fallback", False, f"Only {fixes_found}/5 components found: {', '.join(details)}")
        except Exception as e:
            self.log_test("FIX 1: generateOTP Telnyx SMS Retry + Email Fallback", False, f"Exception: {str(e)}")

    def test_registerphonestep1_uses_sendtelnyx_sms(self):
        """Test: registerPhoneStep1 uses new sendTelnyxSMS helper"""
        try:
            with open('/app/backend/controller/userController.ts', 'r') as f:
                content = f.read()
            
            # Find registerPhoneStep1 function and check if it uses sendTelnyxSMS
            registerPhoneStep1_start = content.find('const registerPhoneStep1')
            if registerPhoneStep1_start == -1:
                self.log_test("registerPhoneStep1 uses sendTelnyxSMS", False, "registerPhoneStep1 function not found")
                return
            
            # Find the next function to get the boundary
            next_function = content.find('const registerPhoneStep2', registerPhoneStep1_start)
            if next_function == -1:
                registerPhoneStep1_content = content[registerPhoneStep1_start:registerPhoneStep1_start + 2000]  # Take a chunk
            else:
                registerPhoneStep1_content = content[registerPhoneStep1_start:next_function]
            
            # Check for sendTelnyxSMS usage (without parentheses to match the call)
            if 'sendTelnyxSMS(mobile)' in registerPhoneStep1_content:
                self.log_test("registerPhoneStep1 uses sendTelnyxSMS", True, "registerPhoneStep1 uses new sendTelnyxSMS helper")
            elif 'sendTelnyxSMS' in registerPhoneStep1_content:
                self.log_test("registerPhoneStep1 uses sendTelnyxSMS", True, "registerPhoneStep1 references sendTelnyxSMS helper")
            else:
                self.log_test("registerPhoneStep1 uses sendTelnyxSMS", False, "registerPhoneStep1 does not use sendTelnyxSMS helper")
        except Exception as e:
            self.log_test("registerPhoneStep1 uses sendTelnyxSMS", False, f"Exception: {str(e)}")

    def test_binancews_keepalive_tuning(self):
        """Test FIX 2: BinanceWS keepalive tuning (30s ping + 10s pong timeout + 90s stale detection)"""
        try:
            with open('/app/backend/services/binanceWebSocketService.ts', 'r') as f:
                content = f.read()
            
            fixes_found = 0
            details = []
            
            # Check for 30 second ping interval
            if '30 * 1000' in content and 'setInterval' in content:
                # More specific check for ping context
                if 'ws.ping()' in content:
                    fixes_found += 1
                    details.append("30s ping interval")
            
            # Check for 10s pong timeout
            if '10000' in content and 'pongTimeoutTimer' in content:
                fixes_found += 1
                details.append("10s pong timeout")
            
            # Check for 90s stale detection
            if '90 * 1000' in content:
                fixes_found += 1
                details.append("90s stale detection")
            
            # Check for lastPongTime tracking
            if 'lastPongTime = Date.now()' in content:
                fixes_found += 1
                details.append("lastPongTime tracking")
            
            # Check for new timer cleanups
            if 'clearTimeout(pongTimeoutTimer' in content and 'clearInterval(staleCheckTimer' in content:
                fixes_found += 1
                details.append("timer cleanup in stopBinanceWebSocket")
            
            # Check that old 3-minute ping is removed
            old_ping_pattern = '3 * 60 * 1000'
            if old_ping_pattern not in content:
                fixes_found += 1
                details.append("old 3-minute ping removed")
            
            if fixes_found >= 5:
                self.log_test("FIX 2: BinanceWS Keepalive Tuning", True, f"Found {fixes_found}/6 components: {', '.join(details)}")
            else:
                self.log_test("FIX 2: BinanceWS Keepalive Tuning", False, f"Only {fixes_found}/6 components found: {', '.join(details)}")
        except Exception as e:
            self.log_test("FIX 2: BinanceWS Keepalive Tuning", False, f"Exception: {str(e)}")

    def test_bot_protection_middleware_exists(self):
        """Test FIX 3: Bot protection middleware exists"""
        try:
            # Check if botProtection.ts file exists
            if not os.path.exists('/app/backend/middleware/botProtection.ts'):
                self.log_test("FIX 3: Bot Protection Middleware File", False, "botProtection.ts file does not exist")
                return
            
            with open('/app/backend/middleware/botProtection.ts', 'r') as f:
                content = f.read()
            
            components_found = 0
            details = []
            
            # Check for SCANNER_PATH_PATTERNS
            if 'SCANNER_PATH_PATTERNS' in content and 'wp-admin' in content and 'xmlrpc.php' in content:
                components_found += 1
                details.append("SCANNER_PATH_PATTERNS with WordPress probes")
            
            # Check for IP tracking
            if 'ipTracker' in content and 'AUTO_BLOCK_THRESHOLD = 5' in content:
                components_found += 1
                details.append("IP tracking with 5-hit threshold")
            
            # Check for 10-minute window and 1-hour block
            if '10 * 60 * 1000' in content and '60 * 60 * 1000' in content:
                components_found += 1
                details.append("10-min window, 1-hour block duration")
            
            # Check for loopback exemption
            if '127.0.0.1' in content and 'localhost' in content:
                components_found += 1
                details.append("loopback IP exemption")
            
            if components_found >= 3:
                self.log_test("FIX 3: Bot Protection Middleware File", True, f"Found {components_found}/4 components: {', '.join(details)}")
            else:
                self.log_test("FIX 3: Bot Protection Middleware File", False, f"Only {components_found}/4 components found: {', '.join(details)}")
        except Exception as e:
            self.log_test("FIX 3: Bot Protection Middleware File", False, f"Exception: {str(e)}")

    def test_bot_protection_registered_in_server(self):
        """Test: Bot protection middleware is registered in server.ts"""
        try:
            with open('/app/backend/server.ts', 'r') as f:
                content = f.read()
            
            # Check for import
            if 'import botProtectionMiddleware from "./middleware/botProtection"' in content:
                # Check for usage before requestLoggerMiddleware
                lines = content.split('\n')
                bot_protection_line = -1
                request_logger_line = -1
                
                for i, line in enumerate(lines):
                    if 'app.use(botProtectionMiddleware)' in line:
                        bot_protection_line = i
                    if 'app.use(requestLoggerMiddleware)' in line:
                        request_logger_line = i
                
                if bot_protection_line != -1 and request_logger_line != -1:
                    if bot_protection_line < request_logger_line:
                        self.log_test("FIX 3: Bot Protection Registered in Server", True, "Bot protection middleware registered before requestLogger")
                    else:
                        self.log_test("FIX 3: Bot Protection Registered in Server", False, "Bot protection middleware registered after requestLogger")
                elif bot_protection_line != -1:
                    self.log_test("FIX 3: Bot Protection Registered in Server", True, "Bot protection middleware registered (requestLogger position unclear)")
                else:
                    self.log_test("FIX 3: Bot Protection Registered in Server", False, "Bot protection middleware imported but not used")
            else:
                self.log_test("FIX 3: Bot Protection Registered in Server", False, "Bot protection middleware not imported")
        except Exception as e:
            self.log_test("FIX 3: Bot Protection Registered in Server", False, f"Exception: {str(e)}")

    def test_scanner_paths_return_403(self):
        """Test: Scanner paths return 403 Forbidden"""
        scanner_paths = [
            '/wp-admin',
            '/xmlrpc.php', 
            '/wp-includes/wlwmanifest.xml',
            '/.env',
            '/phpmyadmin'
        ]
        
        passed_paths = 0
        failed_paths = []
        
        for path in scanner_paths:
            try:
                # Use localhost:8001 directly since that's where the server is running
                url = f"http://localhost:8001{path}"
                response = requests.get(url, timeout=5)
                if response.status_code == 403:
                    passed_paths += 1
                else:
                    failed_paths.append(f"{path}:{response.status_code}")
            except Exception as e:
                failed_paths.append(f"{path}:error")
        
        if passed_paths == len(scanner_paths):
            self.log_test("Scanner Paths Return 403", True, f"All {len(scanner_paths)} scanner paths blocked")
        else:
            self.log_test("Scanner Paths Return 403", False, f"Only {passed_paths}/{len(scanner_paths)} paths blocked. Failed: {', '.join(failed_paths)}")

    def test_legitimate_paths_work(self):
        """Test: Legitimate paths still work"""
        try:
            # Test /health endpoint (use localhost:8001 directly)
            health_response = requests.get("http://localhost:8001/health", timeout=5)
            health_ok = health_response.status_code == 200
            
            # Test /api/docs endpoint (should redirect)
            docs_response = requests.get("http://localhost:8001/api/docs", timeout=5, allow_redirects=False)
            docs_ok = docs_response.status_code in [200, 301, 302]
            
            if health_ok and docs_ok:
                self.log_test("Legitimate Paths Work", True, f"/health: {health_response.status_code}, /api/docs: {docs_response.status_code}")
            else:
                self.log_test("Legitimate Paths Work", False, f"/health: {health_response.status_code}, /api/docs: {docs_response.status_code}")
        except Exception as e:
            self.log_test("Legitimate Paths Work", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests and return results"""
        print("🚂 RAILWAY PRODUCTION BUG FIXES - BACKEND TESTING")
        print("=" * 60)
        print(f"Backend URL: {BASE_URL}")
        print()

        # Core system tests
        self.test_backend_health()
        self.test_typescript_compilation()
        self.test_telnyx_env_vars_updated()
        
        print("\n--- FIX 1: generateOTP 500 errors (Telnyx SMS retry + email fallback) ---")
        self.test_generateotp_sendtelnyx_sms_helper()
        self.test_registerphonestep1_uses_sendtelnyx_sms()
        
        print("\n--- FIX 2: BinanceWS code=1006 disconnections (keepalive tuning) ---")
        self.test_binancews_keepalive_tuning()
        
        print("\n--- FIX 3: WordPress scanner bot protection ---")
        self.test_bot_protection_middleware_exists()
        self.test_bot_protection_registered_in_server()
        self.test_scanner_paths_return_403()
        self.test_legitimate_paths_work()

        # Summary
        print()
        print("=" * 60)
        print(f"TEST RESULTS: {self.passed_tests}/{self.total_tests} tests passed")
        
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        
        if success_rate >= 90:
            print(f"🎉 EXCELLENT! {success_rate:.1f}% of Railway production bug fixes verified!")
            return True
        elif success_rate >= 75:
            print(f"✅ GOOD! {success_rate:.1f}% of Railway production bug fixes verified.")
            return True
        else:
            print(f"❌ NEEDS WORK: Only {success_rate:.1f}% of tests passed. Check the Railway bug fixes.")
            return False

if __name__ == "__main__":
    suite = RailwayBugFixesTestSuite()
    success = suite.run_all_tests()
    sys.exit(0 if success else 1)