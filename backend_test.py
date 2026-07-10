#!/usr/bin/env python3
"""
Backend Test Suite for Session 12: TronGrid API Fix
Tests the isRecipientActivatedForToken fix in tronEnergyService.ts

CRITICAL SAFETY: READ-ONLY testing only
- No DB writes, no sweeps, no crypto transfers
- Redis writes allowed ONLY for: test:* keys and tron:activated:* keys (natural behavior)
- TronGrid rate limit: 1 req/sec - sleep 2-3s between activation checks
"""

import requests
import time
import json
import sys
import subprocess

# Configuration
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"
ADMIN_FEE_WALLET = "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_test(test_name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def log_pass(message):
    print(f"{GREEN}✓ PASS: {message}{RESET}")

def log_fail(message):
    print(f"{RED}✗ FAIL: {message}{RESET}")

def log_info(message):
    print(f"{YELLOW}ℹ INFO: {message}{RESET}")

def log_result(test_name, passed, details=""):
    status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    print(f"\n{test_name}: {status}")
    if details:
        print(f"  {details}")
    return passed

# ============================================================================
# TEST A: TypeScript Compilation & Module Exports
# ============================================================================

def test_a_typescript_compilation():
    log_test("A) TypeScript Compilation & Module Exports")
    
    # A1: TypeScript compilation
    log_info("Running: cd /app/backend && node_modules/.bin/tsc --noEmit")
    result = subprocess.run(
        ["node_modules/.bin/tsc", "--noEmit"],
        cwd="/app/backend",
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        log_pass("TypeScript compilation successful (exit code 0)")
        tsc_pass = True
    else:
        log_fail(f"TypeScript compilation failed (exit code {result.returncode})")
        if result.stdout:
            print(f"STDOUT: {result.stdout}")
        if result.stderr:
            print(f"STDERR: {result.stderr}")
        tsc_pass = False
    
    # A2: Module exports check
    log_info("Checking module exports via ts-node...")
    result = subprocess.run(
        ["node_modules/.bin/ts-node", "--project", "tsconfig.test.json", "test_exports.cjs"],
        cwd="/app/backend",
        capture_output=True,
        text=True
    )
    
    if "ALL_EXPORTS_PRESENT" in result.stdout:
        log_pass("All required exports present: isRecipientActivatedForToken, markRecipientActivated, calculateOptimalFeeLimit, calculateDynamicTRC20Fee")
        exports_pass = True
    else:
        log_fail("Missing exports detected")
        print(f"Output: {result.stdout}")
        if result.stderr:
            print(f"STDERR: {result.stderr}")
        exports_pass = False
    
    return log_result("TEST A", tsc_pass and exports_pass)

# ============================================================================
# TEST B: Functional Activation Checks
# ============================================================================

def test_b_functional_activation():
    log_test("B) Functional Activation Checks")
    
    # B1: Binance hot wallet (should be activated - holds USDT)
    log_info("B1: Testing TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G (Binance hot wallet, should be TRUE)")
    
    result = subprocess.run(
        ["node_modules/.bin/ts-node", "--project", "tsconfig.test.json", "test_b1.cjs"],
        cwd="/app/backend",
        capture_output=True,
        text=True,
        timeout=30
    )
    
    b1_pass = False
    api_path_b1 = "unknown"
    if "RESULT: true" in result.stdout:
        log_pass("B1: TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G returned TRUE (activated)")
        # Check which API path was used
        if "via Tatum fallback" in result.stdout:
            api_path_b1 = "Tatum fallback"
            log_info("B1: Result via Tatum fallback (TronGrid 429 or error)")
        else:
            api_path_b1 = "TronGrid primary"
            log_info("B1: Result via TronGrid primary API")
        
        # Check that it's from real API, not warning default
        if "Could not check token activation" in result.stdout or "assuming NEW recipient" in result.stdout:
            log_fail("B1: Result came from warning default, not real API parse")
        else:
            log_pass("B1: Result from successful API parse (no warning default)")
            b1_pass = True
    else:
        log_fail(f"B1: Expected TRUE, got output: {result.stdout[:200]}")
        if result.stderr:
            print(f"STDERR: {result.stderr[:500]}")
    
    # Rate limit protection
    log_info("Sleeping 3 seconds (TronGrid rate limit: 1 req/sec)...")
    time.sleep(3)
    
    # B2: Admin fee wallet (should be NOT activated - 0 USDT currently)
    log_info("B2: Testing TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR (admin fee wallet, 0 USDT, should be FALSE)")
    
    result = subprocess.run(
        ["node_modules/.bin/ts-node", "--project", "tsconfig.test.json", "test_b2.cjs"],
        cwd="/app/backend",
        capture_output=True,
        text=True,
        timeout=30
    )
    
    b2_pass = False
    api_path_b2 = "unknown"
    if "RESULT: false" in result.stdout:
        log_pass("B2: TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR returned FALSE (not activated)")
        # Check which API path was used
        if "via Tatum fallback" in result.stdout:
            api_path_b2 = "Tatum fallback"
            log_info("B2: Result via Tatum fallback")
        else:
            api_path_b2 = "TronGrid primary"
            log_info("B2: Result via TronGrid primary API")
        
        # Check that it's from real API, not warning default
        if "Could not check token activation" in result.stdout:
            log_fail("B2: Result came from 'Could not check token activation' warning")
        else:
            log_pass("B2: Result from real API answer (no 'Could not check' warning)")
            b2_pass = True
    else:
        log_fail(f"B2: Expected FALSE, got output: {result.stdout[:200]}")
        if result.stderr:
            print(f"STDERR: {result.stderr[:500]}")
    
    # B3: Verify old endpoint is dead (404)
    log_info("B3: Verifying old TronGrid endpoint returns 404...")
    old_endpoint = f"https://api.trongrid.io/v1/accounts/{ADMIN_FEE_WALLET}/tokens/trc20"
    
    try:
        response = requests.get(old_endpoint, timeout=10)
        if response.status_code == 404:
            log_pass(f"B3: Old endpoint returns 404 (confirms it's dead)")
            b3_pass = True
        else:
            log_fail(f"B3: Old endpoint returned {response.status_code}, expected 404")
            b3_pass = False
    except Exception as e:
        log_fail(f"B3: Failed to check old endpoint: {e}")
        b3_pass = False
    
    details = f"B1: {b1_pass} ({api_path_b1}), B2: {b2_pass} ({api_path_b2}), B3: {b3_pass}"
    return log_result("TEST B", b1_pass and b2_pass and b3_pass, details)

# ============================================================================
# TEST C: calculateOptimalFeeLimit (READ-ONLY)
# ============================================================================

def test_c_calculate_optimal_fee_limit():
    log_test("C) calculateOptimalFeeLimit (READ-ONLY)")
    
    log_info("Testing calculateOptimalFeeLimit with known activated recipient...")
    log_info("Sender: TMHECc7emykw5XwX2njp5Y2K4FXLwsTZtC")
    log_info("Recipient: TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G (activated from B1)")
    log_info("Token: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
    
    result = subprocess.run(
        ["node_modules/.bin/ts-node", "--project", "tsconfig.test.json", "test_c.cjs"],
        cwd="/app/backend",
        capture_output=True,
        text=True,
        timeout=30
    )
    
    c_pass = False
    if result.returncode == 0:
        try:
            # Extract JSON from output - it starts after "RESULT: " on the same line
            output = result.stdout
            result_marker = "RESULT: "
            if result_marker in output:
                json_start_idx = output.index(result_marker) + len(result_marker)
                json_str = output[json_start_idx:].strip()
                fee_result = json.loads(json_str)
                
                log_info(f"Result: {json.dumps(fee_result, indent=2)}")
                
                if fee_result.get('isNewRecipient') == False:
                    log_pass("C: isNewRecipient === false (activated recipient, 65k energy path)")
                    log_pass(f"C: feeLimit = {fee_result.get('feeLimit')} TRX")
                    log_pass(f"C: energyNeeded = {fee_result.get('energyNeeded')}")
                    c_pass = True
                else:
                    log_fail(f"C: Expected isNewRecipient=false, got {fee_result.get('isNewRecipient')}")
            else:
                log_fail("C: Could not find RESULT marker in output")
                print(f"Output: {result.stdout[:500]}")
        except Exception as e:
            log_fail(f"C: Failed to parse result: {e}")
            print(f"Output: {result.stdout[:500]}")
    else:
        log_fail(f"C: Function call failed (exit code {result.returncode})")
        if result.stderr:
            print(f"STDERR: {result.stderr[:500]}")
    
    return log_result("TEST C", c_pass)

# ============================================================================
# TEST D: Core API Regression
# ============================================================================

def test_d_core_api_regression():
    log_test("D) Core API Regression")
    
    tests_passed = []
    
    # D1: GET /api/ (root health check)
    log_info("D1: GET /api/ (root health check)")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            log_pass("D1: GET /api/ returned 200")
            tests_passed.append(True)
        else:
            log_fail(f"D1: GET /api/ returned {response.status_code}")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"D1: GET /api/ failed: {e}")
        tests_passed.append(False)
    
    # D2: GET /api/csrf-token
    log_info("D2: GET /api/csrf-token")
    try:
        response = requests.get(f"{API_BASE}/csrf-token", timeout=10)
        if response.status_code == 200:
            log_pass("D2: GET /api/csrf-token returned 200")
            tests_passed.append(True)
        else:
            log_fail(f"D2: GET /api/csrf-token returned {response.status_code}")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"D2: GET /api/csrf-token failed: {e}")
        tests_passed.append(False)
    
    # D3: GET /health (internal :8001)
    log_info("D3: GET /health (internal :8001)")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            bg_jobs = data.get('background_jobs', {})
            if bg_jobs.get('eligible') == False:
                log_pass("D3: GET /health returned 200 with background_jobs.eligible=false")
                tests_passed.append(True)
            else:
                log_fail(f"D3: background_jobs.eligible={bg_jobs.get('eligible')}, expected false")
                tests_passed.append(False)
        else:
            log_fail(f"D3: GET /health returned {response.status_code}")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"D3: GET /health failed: {e}")
        tests_passed.append(False)
    
    # D4: POST /api/user/login with wrong credentials
    log_info("D4: POST /api/user/login with wrong credentials")
    try:
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        payload = {
            'email': 'wrong@example.com',
            'password': 'WrongPassword123!'
        }
        response = requests.post(f"{API_BASE}/user/login", json=payload, headers=headers, timeout=10)
        if response.status_code == 401:
            log_pass("D4: POST /api/user/login with wrong creds returned 401")
            tests_passed.append(True)
        else:
            log_fail(f"D4: POST /api/user/login returned {response.status_code}, expected 401")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"D4: POST /api/user/login failed: {e}")
        tests_passed.append(False)
    
    all_passed = all(tests_passed)
    return log_result("TEST D", all_passed, 
                     f"D1: {tests_passed[0] if len(tests_passed) > 0 else False}, "
                     f"D2: {tests_passed[1] if len(tests_passed) > 1 else False}, "
                     f"D3: {tests_passed[2] if len(tests_passed) > 2 else False}, "
                     f"D4: {tests_passed[3] if len(tests_passed) > 3 else False}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Backend Test Suite - Session 12: TronGrid API Fix{RESET}")
    print(f"{BLUE}Testing: /app/backend/services/tronEnergyService.ts{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    results = []
    
    # Run all tests
    results.append(("A: TypeScript Compilation", test_a_typescript_compilation()))
    results.append(("B: Functional Activation", test_b_functional_activation()))
    results.append(("C: calculateOptimalFeeLimit", test_c_calculate_optimal_fee_limit()))
    results.append(("D: Core API Regression", test_d_core_api_regression()))
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    for test_name, passed in results:
        status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        print(f"  {test_name}: {status}")
    
    total_passed = sum(1 for _, passed in results if passed)
    total_tests = len(results)
    
    print(f"\n{BLUE}Total: {total_passed}/{total_tests} tests passed{RESET}\n")
    
    if total_passed == total_tests:
        print(f"{GREEN}✓ ALL TESTS PASSED{RESET}\n")
        return 0
    else:
        print(f"{RED}✗ SOME TESTS FAILED{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
