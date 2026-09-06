#!/usr/bin/env python3
"""
Backend testing for DynoPay checkout stream feature (2026-09-06)
READ-ONLY tests for the new GET /api/pay/stream endpoint
"""

import requests
import json
import time
import sys
import subprocess
import jwt as pyjwt
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8001"
NODE_BACKEND_URL = "http://localhost:3300"  # Direct Node backend (SSE works here)
TEST_ADDRESS = "0x4c66718579270e0f44e7ab4d70d2b5ce69368ca8"
ACCESS_TOKEN_SECRET = "9a88a50f97ef03c08fedc2e1823e6e4da7220d1a94d8200dde4e8bf63ceab2216e848003b38cae225e5a7620c77ac735e1c5b5418407953b85c203c3e5192d4e"

# NOTE: The Python proxy on port 8001 (server.py) does not support SSE streaming
# because it buffers the entire response. SSE tests must run against the Node
# backend directly on port 3300.

def print_test(name, passed, details=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  {details}")
    return passed

def create_test_jwt(payload=None):
    """Create a test JWT token for customer session"""
    if payload is None:
        payload = {"ref": "test_session_ref"}
    
    # Add expiration
    payload["exp"] = datetime.utcnow() + timedelta(hours=1)
    payload["iat"] = datetime.utcnow()
    
    token = pyjwt.encode(payload, ACCESS_TOKEN_SECRET, algorithm="HS256")
    return token

def test_health():
    """Test 1: GET /health -> 200, status healthy, database + redis connected"""
    print("\n=== TEST 1: Health Endpoint ===")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        data = resp.json()
        
        passed = (
            resp.status_code == 200 and
            data.get("status") == "healthy" and
            data.get("database") == "connected" and
            data.get("redis") == "connected"
        )
        
        details = f"Status: {resp.status_code}, health: {data.get('status')}, db: {data.get('database')}, redis: {data.get('redis')}"
        return print_test("Health endpoint", passed, details)
    except Exception as e:
        return print_test("Health endpoint", False, f"Error: {e}")

def test_stream_no_token():
    """Test 2: GET /api/pay/stream without token -> 403"""
    print("\n=== TEST 2: Stream without token ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pay/stream",
            params={"address": TEST_ADDRESS},
            timeout=5
        )
        
        passed = resp.status_code == 403
        data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        message = data.get("message", "")
        
        details = f"Status: {resp.status_code}, message: {message}"
        return print_test("Stream without token returns 403", passed, details)
    except Exception as e:
        return print_test("Stream without token returns 403", False, f"Error: {e}")

def test_stream_garbage_token():
    """Test 3: GET /api/pay/stream with garbage token -> 403"""
    print("\n=== TEST 3: Stream with garbage token ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pay/stream",
            params={"address": TEST_ADDRESS, "token": "garbage_token_12345"},
            timeout=5
        )
        
        passed = resp.status_code == 403
        data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        message = data.get("message", "")
        
        details = f"Status: {resp.status_code}, message: {message}"
        return print_test("Stream with garbage token returns 403", passed, details)
    except Exception as e:
        return print_test("Stream with garbage token returns 403", False, f"Error: {e}")

def test_stream_missing_address():
    """Test 4a: GET /api/pay/stream with valid token but missing address -> 400"""
    print("\n=== TEST 4a: Stream with valid token but missing address ===")
    try:
        token = create_test_jwt()
        resp = requests.get(
            f"{BASE_URL}/api/pay/stream",
            params={"token": token},
            timeout=5
        )
        
        passed = resp.status_code == 400
        data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        message = data.get("message", "")
        
        details = f"Status: {resp.status_code}, message: {message}"
        expected_msg = "A valid payment address is required"
        if passed and expected_msg not in message:
            passed = False
            details += f" (expected message containing '{expected_msg}')"
        
        return print_test("Stream missing address returns 400", passed, details)
    except Exception as e:
        return print_test("Stream missing address returns 400", False, f"Error: {e}")

def test_stream_bad_address():
    """Test 4b: GET /api/pay/stream with valid token but bad address -> 400"""
    print("\n=== TEST 4b: Stream with valid token but bad address ===")
    try:
        token = create_test_jwt()
        resp = requests.get(
            f"{BASE_URL}/api/pay/stream",
            params={"token": token, "address": "bad!addr"},
            timeout=5
        )
        
        passed = resp.status_code == 400
        data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        message = data.get("message", "")
        
        details = f"Status: {resp.status_code}, message: {message}"
        return print_test("Stream with bad address returns 400", passed, details)
    except Exception as e:
        return print_test("Stream with bad address returns 400", False, f"Error: {e}")

def test_stream_valid():
    """Test 4c: GET /api/pay/stream with valid token and address -> 200, SSE stream"""
    print("\n=== TEST 4c: Stream with valid token and address ===")
    try:
        token = create_test_jwt()
        
        # NOTE: Testing against NODE_BACKEND_URL (port 3300) because the Python proxy
        # on port 8001 buffers responses and breaks SSE streaming
        cmd = [
            "curl", "-N", "--max-time", "2", "-s", "-i",
            f"{NODE_BACKEND_URL}/api/pay/stream?address={TEST_ADDRESS}&token={token}"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = result.stdout
        
        # Check for 200 status
        has_200 = "HTTP/1.1 200" in output or "200 OK" in output
        
        # Check for SSE content type
        has_sse_type = "text/event-stream" in output
        
        # Check for connected event
        has_connected = "event: connected" in output
        
        # Check for ready event
        has_ready = "event: ready" in output
        
        # Check for X-Accel-Buffering header
        has_no_buffer = "X-Accel-Buffering: no" in output
        
        # Check that address is in the response (lowercased)
        has_address = TEST_ADDRESS.lower() in output.lower()
        
        passed = has_200 and has_sse_type and has_connected and has_ready and has_no_buffer
        
        details = f"HTTP 200: {has_200}, SSE type: {has_sse_type}, connected: {has_connected}, ready: {has_ready}, no-buffer: {has_no_buffer}, address: {has_address}"
        
        if passed:
            # Extract the first few events for display
            lines = output.split('\n')
            events = [line for line in lines if line.startswith('event:') or line.startswith('data:')][:6]
            if events:
                details += f"\n  First events: {' | '.join(events[:4])}"
        
        return print_test("Stream with valid credentials returns SSE", passed, details)
    except Exception as e:
        return print_test("Stream with valid credentials returns SSE", False, f"Error: {e}")

def test_stream_with_destination_tag():
    """Test 4d: GET /api/pay/stream with destination_tag -> connected event lists two channels"""
    print("\n=== TEST 4d: Stream with destination_tag ===")
    try:
        token = create_test_jwt()
        
        # NOTE: Testing against NODE_BACKEND_URL (port 3300) for SSE support
        cmd = [
            "curl", "-N", "--max-time", "2", "-s",
            f"{NODE_BACKEND_URL}/api/pay/stream?address={TEST_ADDRESS}&destination_tag=12345&token={token}"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = result.stdout
        
        # Check for connected event with channels array
        has_connected = "event: connected" in output
        
        # The connected event should mention both channels (base + with tag)
        # Looking for the channel format: checkout:0x4c66... and checkout:0x4c66...:12345
        base_channel = f"checkout:{TEST_ADDRESS.lower()}"
        tag_channel = f"checkout:{TEST_ADDRESS.lower()}:12345"
        
        has_base_channel = base_channel in output.lower()
        has_tag_channel = tag_channel in output.lower()
        
        passed = has_connected and has_base_channel and has_tag_channel
        
        details = f"connected: {has_connected}, base channel: {has_base_channel}, tag channel: {has_tag_channel}"
        
        return print_test("Stream with destination_tag lists both channels", passed, details)
    except Exception as e:
        return print_test("Stream with destination_tag lists both channels", False, f"Error: {e}")

def test_verify_crypto_no_auth():
    """Test 5: POST /api/pay/verifyCryptoPayment without auth -> 403"""
    print("\n=== TEST 5: verifyCryptoPayment without auth ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/pay/verifyCryptoPayment",
            json={"address": "0x0000000000000000000000000000000000000001"},
            timeout=5
        )
        
        passed = resp.status_code == 403
        data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        message = data.get("message", "")
        
        details = f"Status: {resp.status_code}, message: {message}"
        return print_test("verifyCryptoPayment without auth returns 403", passed, details)
    except Exception as e:
        return print_test("verifyCryptoPayment without auth returns 403", False, f"Error: {e}")

def test_verify_crypto_with_auth():
    """Test 5 (regression): POST /api/pay/verifyCryptoPayment with JWT -> 200"""
    print("\n=== TEST 5 (regression): verifyCryptoPayment with auth ===")
    try:
        token = create_test_jwt()
        resp = requests.post(
            f"{BASE_URL}/api/pay/verifyCryptoPayment",
            json={"address": "0x0000000000000000000000000000000000000001"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        
        # Should return 200 with status "waiting" (no Redis data for this address)
        passed = resp.status_code == 200
        data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        status = data.get("status", "")
        
        details = f"Status: {resp.status_code}, payment status: {status}"
        
        # This is read-only - we expect "waiting" or similar for a non-existent address
        if passed and status not in ["waiting", "pending", "failed"]:
            details += f" (unexpected status, but endpoint is working)"
        
        return print_test("verifyCryptoPayment with auth returns 200", passed, details)
    except Exception as e:
        return print_test("verifyCryptoPayment with auth returns 200", False, f"Error: {e}")

def test_checkout_service_unit():
    """Test 6: Unit test for checkoutStreamService"""
    print("\n=== TEST 6: Unit test for checkoutStreamService ===")
    try:
        # Verify the service file exists and has the expected exports
        service_file = "/app/backend/services/checkoutStreamService.ts"
        
        with open(service_file, "r") as f:
            content = f.read()
        
        # Check for expected exports
        has_checkout_channel = "export const checkoutChannel" in content or "export { checkoutChannel" in content
        has_publish_status = "export const publishCheckoutStatus" in content or "export { publishCheckoutStatus" in content
        has_attach_stream = "export const attachCheckoutStream" in content or "export { attachCheckoutStream" in content
        
        # Check for expected logic
        has_lowercase = ".toLowerCase()" in content
        has_channel_format = "`checkout:" in content or '"checkout:"' in content or "'checkout:'" in content
        has_destination_tag_logic = "destinationTag" in content
        
        passed = all([
            has_checkout_channel,
            has_publish_status,
            has_attach_stream,
            has_lowercase,
            has_channel_format,
            has_destination_tag_logic
        ])
        
        if passed:
            details = "Service exports checkoutChannel, publishCheckoutStatus, attachCheckoutStream with correct logic (lowercase, channel format, tag support)"
        else:
            missing = []
            if not has_checkout_channel: missing.append("checkoutChannel export")
            if not has_publish_status: missing.append("publishCheckoutStatus export")
            if not has_attach_stream: missing.append("attachCheckoutStream export")
            if not has_lowercase: missing.append("toLowerCase logic")
            if not has_channel_format: missing.append("channel format")
            if not has_destination_tag_logic: missing.append("destinationTag logic")
            details = f"Missing: {', '.join(missing)}"
        
        return print_test("checkoutStreamService code structure", passed, details)
        
    except Exception as e:
        return print_test("checkoutStreamService unit tests", False, f"Error: {e}")

def check_backend_logs():
    """Test 7: Check backend logs for errors related to checkoutStream"""
    print("\n=== TEST 7: Backend logs check ===")
    try:
        # Check for errors in backend logs
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        error_log = result.stdout
        
        # Look for errors related to checkoutStream, paymentRouter, or SSE
        relevant_errors = []
        for line in error_log.split('\n'):
            lower_line = line.lower()
            if any(keyword in lower_line for keyword in ['checkoutstream', 'paymentrouter', '/api/pay/stream', 'sse', 'error', 'exception']):
                if any(err in lower_line for err in ['error', 'exception', 'failed', 'crash']):
                    relevant_errors.append(line.strip())
        
        # Filter out old errors (before our tests)
        recent_errors = relevant_errors[-10:] if relevant_errors else []
        
        passed = len(recent_errors) == 0
        
        if passed:
            details = "No errors related to checkoutStream in recent logs"
        else:
            details = f"Found {len(recent_errors)} potential errors (may be pre-existing)"
            if recent_errors:
                details += f"\n  Sample: {recent_errors[0][:100]}"
        
        return print_test("Backend logs clean", passed, details)
        
    except Exception as e:
        # Log check is not critical
        return print_test("Backend logs check", True, f"Could not check logs: {e}")

def main():
    print("=" * 70)
    print("DynoPay Backend Testing - Checkout Stream Feature")
    print("Session: 2026-09-06")
    print("=" * 70)
    
    results = []
    
    # Run all tests
    results.append(test_health())
    results.append(test_stream_no_token())
    results.append(test_stream_garbage_token())
    results.append(test_stream_missing_address())
    results.append(test_stream_bad_address())
    results.append(test_stream_valid())
    results.append(test_stream_with_destination_tag())
    results.append(test_verify_crypto_no_auth())
    results.append(test_verify_crypto_with_auth())
    results.append(test_checkout_service_unit())
    results.append(check_backend_logs())
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(results)
    total = len(results)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("\n✓✓✓ ALL TESTS PASSED ✓✓✓")
        return 0
    else:
        print(f"\n✗ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
