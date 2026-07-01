#!/usr/bin/env python3
"""
Telnyx API Key Rotation Verification Test
Tests the new TELNYX_API_KEY end-to-end through the backend.
CRITICAL: Makes AT MOST ONE registerPhone call (real SMS costs money).
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://terms-portugal.preview.emergentagent.com/api"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

def log_test(test_name, status, details):
    """Log test results"""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n{'='*80}")
    print(f"[{timestamp}] {test_name}")
    print(f"Status: {status}")
    print(f"Details: {details}")
    print(f"{'='*80}")

def test_health_check():
    """Test A: Regression - GET /api/"""
    print("\n" + "="*80)
    print("TEST A: Health Check (Regression)")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/", headers=HEADERS, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "operational":
                log_test("TEST A: Health Check", "✅ PASS", "API operational")
                return True
        
        log_test("TEST A: Health Check", "❌ FAIL", f"Unexpected response: {response.status_code}")
        return False
    except Exception as e:
        log_test("TEST A: Health Check", "❌ FAIL", f"Error: {str(e)}")
        return False

def test_register_phone_telnyx():
    """Test B: Single Telnyx SMS send via POST /api/user/registerPhone"""
    print("\n" + "="*80)
    print("TEST B: Telnyx API Key Verification (Single SMS Send)")
    print("="*80)
    print("⚠️  WARNING: This sends a REAL SMS and consumes Telnyx credit")
    print("⚠️  Making EXACTLY ONE call as per test constraints")
    print("="*80)
    
    payload = {
        "mobile": "13025141000",
        "calling_code": "+1",
        "country_code": "us"
    }
    
    try:
        print(f"\nRequest: POST {BASE_URL}/user/registerPhone")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/user/registerPhone",
            headers=HEADERS,
            json=payload,
            timeout=15
        )
        
        print(f"\nHTTP Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        
        data = response.json()
        
        # PASS CRITERIA (any of these = PASS):
        # - HTTP 200 with data.account_exists field present (true or false)
        # - HTTP 200/400 with a NON-Telnyx-related message
        
        # FAIL CRITERIA:
        # - HTTP 503 with "Failed to send verification code"
        # - Any response containing "Telnyx", "No key found matching the ID", or "Unauthorized"
        
        response_text = json.dumps(data).lower()
        
        # Check FAIL criteria first
        if response.status_code == 503:
            if "failed to send verification code" in response_text:
                log_test("TEST B: Telnyx Send", "❌ FAIL", "HTTP 503 - Failed to send verification code (Telnyx API key issue)")
                return False
        
        if any(keyword in response_text for keyword in ["telnyx", "no key found matching the id", "unauthorized"]):
            log_test("TEST B: Telnyx Send", "❌ FAIL", f"Response contains Telnyx auth error: {data}")
            return False
        
        # Check PASS criteria
        if response.status_code == 200:
            if "data" in data and "account_exists" in data.get("data", {}):
                account_exists = data["data"]["account_exists"]
                log_test("TEST B: Telnyx Send", "✅ PASS", f"HTTP 200 with account_exists={account_exists} (Telnyx key working)")
                return True
            elif "message" in data:
                # Non-Telnyx-related 200 response (e.g., validation, throttling)
                log_test("TEST B: Telnyx Send", "✅ PASS", f"HTTP 200 with non-Telnyx message: {data['message']}")
                return True
        
        if response.status_code == 400:
            # Non-Telnyx-related 400 (e.g., validation error)
            log_test("TEST B: Telnyx Send", "✅ PASS", f"HTTP 400 with non-Telnyx validation error: {data.get('message', 'Unknown')}")
            return True
        
        # Unexpected response
        log_test("TEST B: Telnyx Send", "⚠️  UNCLEAR", f"Unexpected response: HTTP {response.status_code}, body: {data}")
        return False
        
    except Exception as e:
        log_test("TEST B: Telnyx Send", "❌ FAIL", f"Request error: {str(e)}")
        return False

def check_backend_logs():
    """Check backend logs for Telnyx interaction"""
    print("\n" + "="*80)
    print("Backend Logs Check")
    print("="*80)
    
    import subprocess
    try:
        # Check backend output log
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            print("\n--- Backend Output Log (last 100 lines) ---")
            # Filter for relevant lines (Telnyx, OTP, registerPhone)
            lines = result.stdout.split('\n')
            relevant_lines = [line for line in lines if any(keyword in line.lower() for keyword in ['telnyx', 'otp', 'registerphone', 'sms', 'verification'])]
            
            if relevant_lines:
                print('\n'.join(relevant_lines[-20:]))  # Last 20 relevant lines
            else:
                print("No Telnyx-related log entries found in recent logs")
        
        # Check backend error log
        result_err = subprocess.run(
            ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result_err.returncode == 0 and result_err.stdout.strip():
            print("\n--- Backend Error Log (last 50 lines) ---")
            print(result_err.stdout)
        
    except Exception as e:
        print(f"Could not read backend logs: {str(e)}")

def main():
    print("\n" + "="*80)
    print("TELNYX API KEY ROTATION VERIFICATION TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Context: User reported old TELNYX_API_KEY wasn't working")
    print(f"New Key: KEY019F17786A3942870367BCDB8345F986_1WeiJWTqXGmIWnVV86YBPL")
    print(f"Profile ID: 4900019f-12c3-657a-8b57-54b129bb2a6b (DynoPay, code_length=6)")
    print("="*80)
    
    results = {}
    
    # Test A: Health Check
    results['health_check'] = test_health_check()
    
    # Test B: Telnyx Send (EXACTLY ONE CALL)
    results['telnyx_send'] = test_register_phone_telnyx()
    
    # Check backend logs
    check_backend_logs()
    
    # Final Verdict
    print("\n" + "="*80)
    print("FINAL VERDICT")
    print("="*80)
    
    print(f"\nTest A (Health Check): {'✅ PASS' if results['health_check'] else '❌ FAIL'}")
    print(f"Test B (Telnyx Send): {'✅ PASS' if results['telnyx_send'] else '❌ FAIL'}")
    
    if results['health_check'] and results['telnyx_send']:
        print("\n🎉 OVERALL: ✅ PASS")
        print("The new TELNYX_API_KEY is working correctly end-to-end through the backend.")
        print("POST /api/user/registerPhone does NOT return 503 and does NOT mention Telnyx auth failure.")
    else:
        print("\n❌ OVERALL: FAIL")
        if not results['health_check']:
            print("- Health check failed (API not operational)")
        if not results['telnyx_send']:
            print("- Telnyx send failed (API key issue or other error)")
    
    print("="*80)

if __name__ == "__main__":
    main()
