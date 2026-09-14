#!/usr/bin/env python3
"""
BTC UTXO Fee Off-by-One Issue Fix Testing
Tests the 14 specific fixes for the BTC UTXO fee issue.
"""

import requests
import subprocess
import sys
import re

# Configuration
BASE_URL = "http://localhost:8001"

def run_command(command, cwd=None, capture_output=True):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            cwd=cwd, 
            capture_output=capture_output, 
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

def test_health_check():
    """TEST 1: Health check returns 200 with status healthy"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                return True, f"✅ Health check passed: {data}"
            else:
                return False, f"❌ Health status not healthy: {data}"
        else:
            return False, f"❌ Health check failed with status {response.status_code}"
    except Exception as e:
        return False, f"❌ Health check error: {str(e)}"

def test_typescript_compilation():
    """TEST 2: TypeScript compiles clean"""
    returncode, stdout, stderr = run_command("npx tsc --noEmit", cwd="/app/backend")
    if returncode == 0:
        return True, "✅ TypeScript compilation successful"
    else:
        return False, f"❌ TypeScript compilation failed: {stderr}"

def test_state_machine_tests():
    """TEST 3: State machine tests pass (132 tests)"""
    returncode, stdout, stderr = run_command(
        "npx jest __tests__/paymentStateMachine.test.ts --no-coverage --forceExit --silent", 
        cwd="/app/backend"
    )
    if returncode == 0:
        # Count test results
        test_count = len(re.findall(r'✓', stdout))
        return True, f"✅ State machine tests passed ({test_count} tests)"
    else:
        return False, f"❌ State machine tests failed: {stderr[:500]}"

def test_webhook_processor_tests():
    """TEST 4: Webhook processor tests pass (52 tests)"""
    returncode, stdout, stderr = run_command(
        "npx jest __tests__/webhookProcessor.test.ts --no-coverage --forceExit --silent", 
        cwd="/app/backend"
    )
    if returncode == 0:
        test_count = len(re.findall(r'✓', stdout))
        return True, f"✅ Webhook processor tests passed ({test_count} tests)"
    else:
        return False, f"❌ Webhook processor tests failed: {stderr[:500]}"

def test_truncate_decimals_math_round():
    """TEST 5: truncateDecimals uses Math.round"""
    returncode, stdout, stderr = run_command("grep 'Math.round' /app/backend/apis/tatumApi.ts")
    if returncode == 0 and "Math.round" in stdout:
        return True, f"✅ truncateDecimals uses Math.round: {stdout.strip()}"
    else:
        return False, f"❌ Math.round not found in truncateDecimals"

def test_no_math_floor_in_truncate_decimals():
    """TEST 6: No Math.floor in truncateDecimals"""
    returncode, stdout, stderr = run_command("grep -A2 'truncateDecimals' /app/backend/apis/tatumApi.ts")
    if returncode == 0:
        if "Math.round" in stdout and "Math.floor" not in stdout:
            return True, f"✅ truncateDecimals uses Math.round, not Math.floor"
        else:
            return False, f"❌ Found Math.floor or missing Math.round in truncateDecimals: {stdout}"
    else:
        return False, f"❌ Could not find truncateDecimals function"

def test_round_trip_fee_calc_multi_output():
    """TEST 7: Round-trip fee calc in multi-output"""
    returncode, stdout, stderr = run_command(
        "grep 'actualMerchantSats\\|actualAdminSats\\|actualFeeSats' /app/backend/controller/paymentController.ts"
    )
    if returncode == 0:
        occurrences = len(stdout.strip().split('\n'))
        if occurrences >= 6:
            return True, f"✅ Round-trip fee calc in multi-output ({occurrences} occurrences >= 6)"
        else:
            return False, f"❌ Insufficient round-trip fee calc patterns ({occurrences} < 6)"
    else:
        return False, f"❌ Round-trip fee calc patterns not found"

def test_round_trip_fee_calc_auto_convert():
    """TEST 8: Round-trip fee calc in auto-convert"""
    returncode, stdout, stderr = run_command(
        "grep 'actualOutputSats\\|actualFeeSats' /app/backend/controller/paymentController.ts"
    )
    if returncode == 0:
        occurrences = len(stdout.strip().split('\n'))
        if occurrences >= 4:
            return True, f"✅ Round-trip fee calc in auto-convert ({occurrences} occurrences >= 4)"
        else:
            return False, f"❌ Insufficient auto-convert fee calc patterns ({occurrences} < 4)"
    else:
        return False, f"❌ Auto-convert fee calc patterns not found"

def test_find_utxo_output_index_segwit():
    """TEST 9: findUtxoOutputIndex handles SegWit"""
    returncode, stdout, stderr = run_command(
        "grep 'scriptPubKey.*address' /app/backend/apis/tatumApi.ts"
    )
    if returncode == 0 and "scriptPubKey" in stdout and "address" in stdout:
        return True, f"✅ findUtxoOutputIndex handles SegWit: {stdout.strip()}"
    else:
        return False, f"❌ SegWit address handling not found"

def test_payment_failed_webhook():
    """TEST 10: payment.failed webhook exists"""
    returncode, stdout, stderr = run_command(
        "grep 'payment.failed' /app/backend/services/webhookProcessor.ts"
    )
    if returncode == 0:
        occurrences = len(stdout.strip().split('\n'))
        return True, f"✅ payment.failed webhook found ({occurrences} occurrences)"
    else:
        return False, f"❌ payment.failed webhook not found"

def test_payment_confirmed_webhook():
    """TEST 11: payment.confirmed webhook exists in normal path"""
    returncode, stdout, stderr = run_command(
        "grep 'payment.confirmed' /app/backend/services/webhookProcessor.ts"
    )
    if returncode == 0:
        occurrences = len(stdout.strip().split('\n'))
        if occurrences >= 2:
            return True, f"✅ payment.confirmed webhook found ({occurrences} occurrences >= 2)"
        else:
            return False, f"❌ Insufficient payment.confirmed occurrences ({occurrences} < 2)"
    else:
        return False, f"❌ payment.confirmed webhook not found"

def test_failed_payment_recovery():
    """TEST 12: Failed payment recovery logic"""
    returncode, stdout, stderr = run_command(
        "grep 'FAILED PAYMENT RECOVERY' /app/backend/services/webhookProcessor.ts"
    )
    if returncode == 0:
        return True, f"✅ Failed payment recovery logic found"
    else:
        return False, f"❌ Failed payment recovery logic not found"

def test_dust_threshold_check():
    """TEST 13: Dust threshold check"""
    returncode, stdout, stderr = run_command(
        "grep 'isDustShortfall\\|DUST_THRESHOLD' /app/backend/services/webhookProcessor.ts"
    )
    if returncode == 0:
        occurrences = len(stdout.strip().split('\n'))
        return True, f"✅ Dust threshold check found ({occurrences} occurrences)"
    else:
        return False, f"❌ Dust threshold check not found"

def test_failed_payment_resets_txid():
    """TEST 14: Failed payment resets txId"""
    returncode, stdout, stderr = run_command(
        "grep 'txId: undefined' /app/backend/services/webhookProcessor.ts"
    )
    if returncode == 0:
        return True, f"✅ Failed payment resets txId: {stdout.strip()}"
    else:
        return False, f"❌ Failed payment txId reset not found"

def main():
    print("🚀 Starting BTC UTXO Fee Off-by-One Issue Fix Testing\n")
    
    tests = [
        ("TEST 1: Backend Health Check", test_health_check),
        ("TEST 2: TypeScript Compilation", test_typescript_compilation),
        ("TEST 3: State Machine Tests", test_state_machine_tests),
        ("TEST 4: Webhook Processor Tests", test_webhook_processor_tests),
        ("TEST 5: truncateDecimals Math.round", test_truncate_decimals_math_round),
        ("TEST 6: No Math.floor in truncateDecimals", test_no_math_floor_in_truncate_decimals),
        ("TEST 7: Round-trip fee calc multi-output", test_round_trip_fee_calc_multi_output),
        ("TEST 8: Round-trip fee calc auto-convert", test_round_trip_fee_calc_auto_convert),
        ("TEST 9: findUtxoOutputIndex SegWit", test_find_utxo_output_index_segwit),
        ("TEST 10: payment.failed webhook", test_payment_failed_webhook),
        ("TEST 11: payment.confirmed webhook", test_payment_confirmed_webhook),
        ("TEST 12: Failed payment recovery", test_failed_payment_recovery),
        ("TEST 13: Dust threshold check", test_dust_threshold_check),
        ("TEST 14: Failed payment resets txId", test_failed_payment_resets_txid),
    ]
    
    passed = 0
    failed = 0
    results = []
    
    for test_name, test_func in tests:
        print(f"Running {test_name}...")
        try:
            success, message = test_func()
            if success:
                passed += 1
                print(f"  {message}")
                results.append((test_name, "PASS", message))
            else:
                failed += 1
                print(f"  {message}")
                results.append((test_name, "FAIL", message))
        except Exception as e:
            failed += 1
            error_msg = f"❌ Test error: {str(e)}"
            print(f"  {error_msg}")
            results.append((test_name, "ERROR", error_msg))
        print()
    
    # Summary
    print("="*80)
    print(f"📊 TEST SUMMARY: {passed}/{passed+failed} tests passed")
    print("="*80)
    
    for test_name, status, message in results:
        status_icon = "✅" if status == "PASS" else "❌"
        print(f"{status_icon} {test_name}: {status}")
    
    if failed == 0:
        print(f"\n🎉 ALL TESTS PASSED! BTC UTXO fee off-by-one fixes verified successfully.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review the failures above.")
        sys.exit(1)

if __name__ == "__main__":
    main()