#!/usr/bin/env python3
"""
Session 5 Backend Testing Script
Tests: Admin token fix + Email template redesign + Regression
"""

import requests
import json
import sys
import subprocess
import os
from pathlib import Path

# Configuration
BASE_URL = "https://a12ec985-3845-48d1-94ff-bae3784d76bd.preview.emergentagent.com/api"
HOSTBAY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJuYW1lIjoiSG9zdEJheSIsImVtYWlsIjoiaG9zdGJheUBtb3h4LmNvIiwidXNlcm5hbWUiOm51bGwsIm1vYmlsZSI6bnVsbCwicGhvdG8iOiJpbWFnZXMvdXNlcl9pbWFnZS5wbmciLCJsb2dpbl90eXBlIjoiRU1BSUwiLCJjdXN0b21lcl9pZCI6bnVsbCwiZXh0ZXJuYWxfaWQiOm51bGwsInN0YXR1cyI6ImFjdGl2ZSIsInZlcmlmaWVkX290cCI6bnVsbCwib3RwX2V4cGlyZWQiOm51bGwsIm90cF9jdXJyZW5jeSI6bnVsbCwicmVzZXRfdG9rZW4iOm51bGwsInJlc2V0X3Rva2VuX2V4cGlyeSI6bnVsbCwiZ29vZ2xlX2lkIjpudWxsLCJ3YWxsZXRfcmVtaW5kZXJfc2VudCI6dHJ1ZSwicmVmZXJyYWxfY29kZSI6IkRZTk8tOVhWUFVZIiwicmVmZXJyYWxfY291bnQiOjAsInJlZmVycmFsX2JvbnVzX2Vhcm5lZCI6IjAuMDAiLCJyZWZlcnJlZF9ieV9jb2RlIjpudWxsLCJyZWZlcnJlZF9ieV9yZWZlcmVlX2NvZGUiOm51bGwsImZlZV9kaXNjb3VudF9wZXJjZW50IjoiMC4wMCIsImZlZV9kaXNjb3VudF9leHBpcmVzX2F0IjpudWxsLCJmZWVfZGlzY291bnRfcmVhc29uIjpudWxsLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibGFzdF9sb2dpbl9pcCI6IjEwNC4xOTguMjE0LjIyMyIsImxhc3RfY29tcGFueV9pZCI6bnVsbCwiY3VtdWxhdGl2ZV92b2x1bWVfdXNkIjoiMTc0NzcuNTUiLCJmZWVfZnJlZV9yZW1haW5pbmdfdXNkIjoiMC4wMCIsImZlZV90aWVyIjoic3RhbmRhcmQiLCJjcmVhdGVkQXQiOiIyMDI2LTA0LTE4VDE4OjE5OjExLjg4N1oiLCJ1cGRhdGVkQXQiOiIyMDI2LTA3LTA4VDAzOjIxOjUwLjExOVoiLCJsYW5ndWFnZSI6ImVuIiwiaWF0IjoxNzgzNTE0Njc3LCJleHAiOjE3ODYxMDY2Nzd9.Gwbknnx-KFQUNMXmzwx6Qv4SG2cAcMz4LL89Jl-DDOw"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

AUTH_HEADERS = {
    **HEADERS,
    "Authorization": f"Bearer {HOSTBAY_TOKEN}"
}

# Test results
results = {
    "A_admin_token": {"status": "NOT_RUN", "details": []},
    "B_email_template": {"status": "NOT_RUN", "details": []},
    "C_regression": {"status": "NOT_RUN", "details": []}
}

def log(message, test_part=None):
    """Log message and optionally add to test details"""
    print(message)
    if test_part and test_part in results:
        results[test_part]["details"].append(message)

def test_admin_token():
    """Test A: Admin token fix"""
    log("\n=== TEST A: Admin Token Fix ===", "A_admin_token")
    
    try:
        url = f"{BASE_URL}/userApi/getApi"
        log(f"GET {url}", "A_admin_token")
        
        response = requests.get(url, headers=AUTH_HEADERS, timeout=30)
        log(f"Status: {response.status_code}", "A_admin_token")
        
        if response.status_code != 200:
            results["A_admin_token"]["status"] = "FAIL"
            log(f"❌ Expected 200, got {response.status_code}", "A_admin_token")
            log(f"Response: {response.text[:500]}", "A_admin_token")
            return False
        
        data = response.json()
        
        # Check if data.all exists and has at least one item
        if "data" not in data or "all" not in data["data"] or len(data["data"]["all"]) == 0:
            results["A_admin_token"]["status"] = "FAIL"
            log(f"❌ No API keys found in response", "A_admin_token")
            log(f"Response structure: {json.dumps(data, indent=2)[:500]}", "A_admin_token")
            return False
        
        api_key = data["data"]["all"][0]
        log(f"API Key data: {json.dumps(api_key, indent=2)[:500]}", "A_admin_token")
        
        # Check adminToken is non-empty
        admin_token = api_key.get("adminToken")
        if not admin_token or not isinstance(admin_token, str) or len(admin_token) == 0:
            results["A_admin_token"]["status"] = "FAIL"
            log(f"❌ adminToken is empty or not a string: {admin_token}", "A_admin_token")
            return False
        
        log(f"✅ adminToken is non-empty string (length: {len(admin_token)})", "A_admin_token")
        
        # Check adminToken equals admin_token
        admin_token_col = api_key.get("admin_token")
        if admin_token != admin_token_col:
            results["A_admin_token"]["status"] = "FAIL"
            log(f"❌ adminToken != admin_token", "A_admin_token")
            log(f"   adminToken: {admin_token[:50]}...", "A_admin_token")
            log(f"   admin_token: {admin_token_col[:50] if admin_token_col else 'null'}...", "A_admin_token")
            return False
        
        log(f"✅ adminToken equals admin_token", "A_admin_token")
        
        # Check apiKey present
        if not api_key.get("apiKey"):
            results["A_admin_token"]["status"] = "FAIL"
            log(f"❌ apiKey is missing", "A_admin_token")
            return False
        
        log(f"✅ apiKey present", "A_admin_token")
        
        # Check apiKey_masked present
        if not api_key.get("apiKey_masked"):
            results["A_admin_token"]["status"] = "FAIL"
            log(f"❌ apiKey_masked is missing", "A_admin_token")
            return False
        
        log(f"✅ apiKey_masked present: {api_key.get('apiKey_masked')}", "A_admin_token")
        
        results["A_admin_token"]["status"] = "PASS"
        log("✅ TEST A PASSED", "A_admin_token")
        return True
        
    except Exception as e:
        results["A_admin_token"]["status"] = "ERROR"
        log(f"❌ Exception: {str(e)}", "A_admin_token")
        import traceback
        log(traceback.format_exc(), "A_admin_token")
        return False

def test_email_template():
    """Test B: Email template render"""
    log("\n=== TEST B: Email Template Render ===", "B_email_template")
    
    try:
        # Create output directory
        output_dir = Path("/tmp/email_preview")
        output_dir.mkdir(parents=True, exist_ok=True)
        log(f"✅ Created directory: {output_dir}", "B_email_template")
        
        # Run the render script
        log("Running: node_modules/.bin/ts-node --transpile-only scripts/render_email_previews.ts", "B_email_template")
        result = subprocess.run(
            ["node_modules/.bin/ts-node", "--transpile-only", "scripts/render_email_previews.ts"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        log(f"Exit code: {result.returncode}", "B_email_template")
        if result.stdout:
            log(f"STDOUT: {result.stdout}", "B_email_template")
        if result.stderr:
            log(f"STDERR: {result.stderr}", "B_email_template")
        
        if result.returncode != 0:
            results["B_email_template"]["status"] = "FAIL"
            log(f"❌ Script exited with code {result.returncode}", "B_email_template")
            return False
        
        log("✅ Script exited with code 0", "B_email_template")
        
        # Check for 3 files
        expected_files = ["otp.html", "payment.html", "welcome.html"]
        for filename in expected_files:
            filepath = output_dir / filename
            if not filepath.exists():
                results["B_email_template"]["status"] = "FAIL"
                log(f"❌ Missing file: {filename}", "B_email_template")
                return False
            log(f"✅ Found file: {filename}", "B_email_template")
        
        # Verify each file
        all_checks_passed = True
        for filename in expected_files:
            filepath = output_dir / filename
            content = filepath.read_text()
            
            log(f"\n--- Checking {filename} ---", "B_email_template")
            
            # Check for #CCFF00
            if "#CCFF00" not in content:
                log(f"❌ {filename}: Missing #CCFF00", "B_email_template")
                all_checks_passed = False
            else:
                count = content.count("#CCFF00")
                log(f"✅ {filename}: Contains #CCFF00 ({count} occurrences)", "B_email_template")
            
            # Check for #050505
            if "#050505" not in content:
                log(f"❌ {filename}: Missing #050505", "B_email_template")
                all_checks_passed = False
            else:
                count = content.count("#050505")
                log(f"✅ {filename}: Contains #050505 ({count} occurrences)", "B_email_template")
            
            # Check balanced <table> tags
            table_open = content.count("<table")
            table_close = content.count("</table>")
            if table_open != table_close:
                log(f"❌ {filename}: Unbalanced <table> tags (open: {table_open}, close: {table_close})", "B_email_template")
                all_checks_passed = False
            else:
                log(f"✅ {filename}: Balanced <table> tags ({table_open} pairs)", "B_email_template")
            
            # Check NO #0d1f5c
            if "#0d1f5c" in content:
                count = content.count("#0d1f5c")
                log(f"❌ {filename}: Contains old color #0d1f5c ({count} occurrences)", "B_email_template")
                all_checks_passed = False
            else:
                log(f"✅ {filename}: No #0d1f5c found", "B_email_template")
            
            # Check NO #4F46E5
            if "#4F46E5" in content:
                count = content.count("#4F46E5")
                log(f"❌ {filename}: Contains old color #4F46E5 ({count} occurrences)", "B_email_template")
                all_checks_passed = False
            else:
                log(f"✅ {filename}: No #4F46E5 found", "B_email_template")
            
            # Check CTA button wrapped in its own table (payment.html and welcome.html)
            if filename in ["payment.html", "welcome.html"]:
                cta_table_pattern = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"'
                if cta_table_pattern not in content:
                    log(f"❌ {filename}: CTA button not wrapped in its own table", "B_email_template")
                    all_checks_passed = False
                else:
                    log(f"✅ {filename}: CTA button wrapped in its own table", "B_email_template")
        
        if all_checks_passed:
            results["B_email_template"]["status"] = "PASS"
            log("\n✅ TEST B PASSED", "B_email_template")
            return True
        else:
            results["B_email_template"]["status"] = "FAIL"
            log("\n❌ TEST B FAILED - Some checks did not pass", "B_email_template")
            return False
        
    except Exception as e:
        results["B_email_template"]["status"] = "ERROR"
        log(f"❌ Exception: {str(e)}", "B_email_template")
        import traceback
        log(traceback.format_exc(), "B_email_template")
        return False

def test_regression():
    """Test C: Regression tests"""
    log("\n=== TEST C: Regression Tests ===", "C_regression")
    
    all_passed = True
    
    # Test 1: GET /api/
    try:
        url = f"{BASE_URL}/"
        log(f"\n1. GET {url}", "C_regression")
        response = requests.get(url, headers=HEADERS, timeout=30)
        log(f"   Status: {response.status_code}", "C_regression")
        if response.status_code == 200:
            log(f"   ✅ PASS", "C_regression")
        else:
            log(f"   ❌ FAIL - Expected 200", "C_regression")
            all_passed = False
    except Exception as e:
        log(f"   ❌ ERROR: {str(e)}", "C_regression")
        all_passed = False
    
    # Test 2: GET /api/csrf-token
    try:
        url = f"{BASE_URL}/csrf-token"
        log(f"\n2. GET {url}", "C_regression")
        response = requests.get(url, headers=HEADERS, timeout=30)
        log(f"   Status: {response.status_code}", "C_regression")
        if response.status_code == 200:
            log(f"   ✅ PASS", "C_regression")
        else:
            log(f"   ❌ FAIL - Expected 200", "C_regression")
            all_passed = False
    except Exception as e:
        log(f"   ❌ ERROR: {str(e)}", "C_regression")
        all_passed = False
    
    # Test 3: GET /api/dashboard (Bearer)
    try:
        url = f"{BASE_URL}/dashboard"
        log(f"\n3. GET {url} (with Bearer token)", "C_regression")
        response = requests.get(url, headers=AUTH_HEADERS, timeout=30)
        log(f"   Status: {response.status_code}", "C_regression")
        if response.status_code == 200:
            log(f"   ✅ PASS", "C_regression")
        else:
            log(f"   ❌ FAIL - Expected 200", "C_regression")
            log(f"   Response: {response.text[:200]}", "C_regression")
            all_passed = False
    except Exception as e:
        log(f"   ❌ ERROR: {str(e)}", "C_regression")
        all_passed = False
    
    # Test 4: GET /api/dashboard/fee-tiers (Bearer)
    try:
        url = f"{BASE_URL}/dashboard/fee-tiers"
        log(f"\n4. GET {url} (with Bearer token)", "C_regression")
        response = requests.get(url, headers=AUTH_HEADERS, timeout=30)
        log(f"   Status: {response.status_code}", "C_regression")
        if response.status_code == 200:
            log(f"   ✅ PASS", "C_regression")
        else:
            log(f"   ❌ FAIL - Expected 200", "C_regression")
            log(f"   Response: {response.text[:200]}", "C_regression")
            all_passed = False
    except Exception as e:
        log(f"   ❌ ERROR: {str(e)}", "C_regression")
        all_passed = False
    
    # Test 5: POST /api/pay/calculateFees
    try:
        url = f"{BASE_URL}/pay/calculateFees"
        payload = {"amount": 1000, "currency": "USD", "cryptocurrency": "BTC"}
        log(f"\n5. POST {url}", "C_regression")
        log(f"   Payload: {json.dumps(payload)}", "C_regression")
        response = requests.post(url, headers=HEADERS, json=payload, timeout=30)
        log(f"   Status: {response.status_code}", "C_regression")
        
        if response.status_code != 200:
            log(f"   ❌ FAIL - Expected 200", "C_regression")
            log(f"   Response: {response.text[:200]}", "C_regression")
            all_passed = False
        else:
            data = response.json()
            platform_fee_percent = data.get("data", {}).get("fee_breakdown", {}).get("platform_fee_percent")
            log(f"   platform_fee_percent: {platform_fee_percent}", "C_regression")
            
            if platform_fee_percent == 1.5:
                log(f"   ✅ PASS - platform_fee_percent is 1.5", "C_regression")
            else:
                log(f"   ❌ FAIL - Expected platform_fee_percent=1.5, got {platform_fee_percent}", "C_regression")
                all_passed = False
    except Exception as e:
        log(f"   ❌ ERROR: {str(e)}", "C_regression")
        all_passed = False
    
    if all_passed:
        results["C_regression"]["status"] = "PASS"
        log("\n✅ TEST C PASSED", "C_regression")
        return True
    else:
        results["C_regression"]["status"] = "FAIL"
        log("\n❌ TEST C FAILED - Some regression tests failed", "C_regression")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("SESSION 5 BACKEND TESTING")
    print("Admin token fix + Email template redesign + Regression")
    print("=" * 80)
    
    # Run tests
    test_a_passed = test_admin_token()
    test_b_passed = test_email_template()
    test_c_passed = test_regression()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"A) Admin Token Fix:      {results['A_admin_token']['status']}")
    print(f"B) Email Template:       {results['B_email_template']['status']}")
    print(f"C) Regression Tests:     {results['C_regression']['status']}")
    print("=" * 80)
    
    all_passed = test_a_passed and test_b_passed and test_c_passed
    
    if all_passed:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
