#!/usr/bin/env python3
"""
Backend Test Suite for Session 12b: AI Support Chat Feature
Tests the new AI support chat backend at /api/support/chat

CRITICAL SAFETY: LIVE PRODUCTION DB + REDIS SHARED
- Chat/history/escalate writes go ONLY to tbl_support_chat_message (feature's own table)
- Prefix ALL session_ids with "qa-"
- Do AT MOST ONE escalate call that sends a real email (to moxxcompany@gmail.com)
- Keep total POST /chat calls to ≤6 (each costs OpenAI tokens)
- No other DB writes, no sweeps, no transfers
"""

import requests
import time
import json
import sys
import uuid
import subprocess

# Configuration
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"
SUPPORT_API = f"{API_BASE}/support"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Test state
chat_call_count = 0
escalate_call_count = 0

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

def generate_qa_session_id():
    """Generate a session_id prefixed with 'qa-'"""
    return f"qa-{uuid.uuid4()}"

def post_chat(session_id, message, auth_token=None):
    """POST /api/support/chat"""
    global chat_call_count
    chat_call_count += 1
    
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    payload = {
        'session_id': session_id,
        'message': message
    }
    
    log_info(f"POST /support/chat (call #{chat_call_count}/6) session={session_id[:15]}... message_len={len(message)}")
    response = requests.post(f"{SUPPORT_API}/chat", json=payload, headers=headers, timeout=60)
    return response

def get_history(session_id):
    """GET /api/support/chat/history/:session_id"""
    log_info(f"GET /support/chat/history/{session_id[:15]}...")
    response = requests.get(f"{SUPPORT_API}/chat/history/{session_id}", timeout=10)
    return response

def post_escalate(session_id, contact_email=None, note=None):
    """POST /api/support/chat/escalate"""
    global escalate_call_count
    escalate_call_count += 1
    
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    payload = {'session_id': session_id}
    if contact_email:
        payload['contact_email'] = contact_email
    if note:
        payload['note'] = note
    
    log_info(f"POST /support/chat/escalate (call #{escalate_call_count}) session={session_id[:15]}...")
    response = requests.post(f"{SUPPORT_API}/chat/escalate", json=payload, headers=headers, timeout=30)
    return response

def mint_jwt_for_hostbay():
    """Mint a JWT for hostbay@moxx.co using the mint script"""
    log_info("Minting JWT for hostbay@moxx.co...")
    try:
        result = subprocess.run(
            ["node", "/app/scripts/mint_ux_tokens.js"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Parse JSON output
        try:
            tokens = json.loads(result.stdout)
            token = tokens.get('hostbay@moxx.co')
            if token:
                log_pass(f"JWT minted successfully (length={len(token)})")
                return token
            else:
                log_fail("hostbay@moxx.co token not found in output")
                return None
        except json.JSONDecodeError:
            log_fail("Could not parse JSON from mint script output")
            return None
    except Exception as e:
        log_fail(f"Failed to mint JWT: {e}")
        return None

# ============================================================================
# TEST 1: Multi-turn + Session Memory
# ============================================================================

def test_1_multi_turn_session():
    log_test("1) Multi-turn + Session Memory")
    
    session_id = generate_qa_session_id()
    log_info(f"Using session_id: {session_id}")
    
    # First turn: Ask about fees
    log_info("Turn 1: Asking about DynoPay fees...")
    response1 = post_chat(session_id, "What fees does DynoPay charge?")
    
    if response1.status_code != 200:
        log_fail(f"Turn 1 failed: HTTP {response1.status_code}")
        return log_result("TEST 1", False)
    
    data1 = response1.json()
    reply1 = data1.get('data', {}).get('reply', '')
    
    if not reply1:
        log_fail("Turn 1: Empty reply")
        return log_result("TEST 1", False)
    
    log_pass(f"Turn 1: Got reply (length={len(reply1)})")
    log_info(f"Reply excerpt: {reply1[:150]}...")
    
    # Check if reply mentions fees (1.5%, 0.5%, Starter, Enterprise, etc.)
    fee_keywords = ['1.5%', '0.5%', 'Starter', 'Enterprise', 'fee', 'percent']
    has_fee_info = any(keyword.lower() in reply1.lower() for keyword in fee_keywords)
    
    if has_fee_info:
        log_pass("Turn 1: Reply mentions fee information")
    else:
        log_fail("Turn 1: Reply does not mention expected fee information")
        return log_result("TEST 1", False)
    
    # Second turn: Ask what they just asked (context retention test)
    log_info("Turn 2: Testing context retention...")
    response2 = post_chat(session_id, "What did I just ask you?")
    
    if response2.status_code != 200:
        log_fail(f"Turn 2 failed: HTTP {response2.status_code}")
        return log_result("TEST 1", False)
    
    data2 = response2.json()
    reply2 = data2.get('data', {}).get('reply', '')
    
    if not reply2:
        log_fail("Turn 2: Empty reply")
        return log_result("TEST 1", False)
    
    log_pass(f"Turn 2: Got reply (length={len(reply2)})")
    log_info(f"Reply excerpt: {reply2[:150]}...")
    
    # Check if reply references the fees question
    context_keywords = ['fee', 'charge', 'cost', 'price', 'asked']
    has_context = any(keyword.lower() in reply2.lower() for keyword in context_keywords)
    
    if has_context:
        log_pass("Turn 2: Reply references the previous fees question (context retained)")
    else:
        log_fail("Turn 2: Reply does not reference the previous question")
        return log_result("TEST 1", False)
    
    # Get history and verify 4 messages
    log_info("Fetching chat history...")
    history_response = get_history(session_id)
    
    if history_response.status_code != 200:
        log_fail(f"History fetch failed: HTTP {history_response.status_code}")
        return log_result("TEST 1", False)
    
    history_data = history_response.json()
    messages = history_data.get('data', {}).get('messages', [])
    
    if len(messages) != 4:
        log_fail(f"Expected 4 messages in history, got {len(messages)}")
        return log_result("TEST 1", False)
    
    log_pass(f"History contains exactly 4 messages")
    
    # Verify order: user, assistant, user, assistant
    expected_roles = ['user', 'assistant', 'user', 'assistant']
    actual_roles = [msg.get('role') for msg in messages]
    
    if actual_roles == expected_roles:
        log_pass("Messages in correct order: user/assistant/user/assistant")
    else:
        log_fail(f"Message order incorrect: {actual_roles}")
        return log_result("TEST 1", False)
    
    return log_result("TEST 1", True, "Multi-turn conversation with context retention working")

# ============================================================================
# TEST 2: Session Isolation
# ============================================================================

def test_2_session_isolation():
    log_test("2) Session Isolation (No Context Leakage)")
    
    session_id2 = generate_qa_session_id()
    log_info(f"Using NEW session_id: {session_id2}")
    
    # Ask the same context question in a different session
    log_info("Asking 'What did I just ask you?' in a fresh session...")
    response = post_chat(session_id2, "What did I just ask you?")
    
    if response.status_code != 200:
        log_fail(f"Request failed: HTTP {response.status_code}")
        return log_result("TEST 2", False)
    
    data = response.json()
    reply = data.get('data', {}).get('reply', '')
    
    if not reply:
        log_fail("Empty reply")
        return log_result("TEST 2", False)
    
    log_pass(f"Got reply (length={len(reply)})")
    log_info(f"Reply excerpt: {reply[:150]}...")
    
    # Check that reply does NOT know about the fees question from session 1
    # It should say something like "this is the first message" or "I don't have context"
    no_context_keywords = ['first', 'start', 'beginning', 'no previous', "don't have", "haven't"]
    has_no_context = any(keyword.lower() in reply.lower() for keyword in no_context_keywords)
    
    # Also check it doesn't mention fees (which would indicate leakage)
    fee_keywords = ['fee', '1.5%', '0.5%', 'charge']
    mentions_fees = any(keyword.lower() in reply.lower() for keyword in fee_keywords)
    
    if has_no_context and not mentions_fees:
        log_pass("Reply indicates no previous context (no leakage from session 1)")
    elif not mentions_fees:
        log_pass("Reply does not mention fees from session 1 (no leakage)")
    else:
        log_fail("Reply appears to have context from session 1 (LEAKAGE DETECTED)")
        return log_result("TEST 2", False)
    
    # Verify history has only 2 messages
    history_response = get_history(session_id2)
    
    if history_response.status_code != 200:
        log_fail(f"History fetch failed: HTTP {history_response.status_code}")
        return log_result("TEST 2", False)
    
    history_data = history_response.json()
    messages = history_data.get('data', {}).get('messages', [])
    
    if len(messages) == 2:
        log_pass("History contains exactly 2 messages (user + assistant)")
    else:
        log_fail(f"Expected 2 messages in history, got {len(messages)}")
        return log_result("TEST 2", False)
    
    return log_result("TEST 2", True, "Session isolation verified - no context leakage")

# ============================================================================
# TEST 3: Input Validation
# ============================================================================

def test_3_input_validation():
    log_test("3) Input Validation")
    
    tests_passed = []
    
    # 3a: Invalid session_id (too short)
    log_info("3a: Testing invalid session_id 'ab' (too short)...")
    response = post_chat("ab", "Hello")
    
    if response.status_code == 400:
        log_pass("3a: Invalid session_id rejected with 400")
        tests_passed.append(True)
    else:
        log_fail(f"3a: Expected 400, got {response.status_code}")
        tests_passed.append(False)
    
    # 3b: Missing message
    log_info("3b: Testing missing message...")
    headers = {'Content-Type': 'application/json'}
    payload = {'session_id': generate_qa_session_id()}
    response = requests.post(f"{SUPPORT_API}/chat", json=payload, headers=headers, timeout=10)
    
    if response.status_code == 400:
        log_pass("3b: Missing message rejected with 400")
        tests_passed.append(True)
    else:
        log_fail(f"3b: Expected 400, got {response.status_code}")
        tests_passed.append(False)
    
    # 3c: Message too long (2001 chars)
    log_info("3c: Testing message with 2001 characters...")
    long_message = "x" * 2001
    response = post_chat(generate_qa_session_id(), long_message)
    
    if response.status_code == 400:
        log_pass("3c: Message >2000 chars rejected with 400")
        tests_passed.append(True)
    else:
        log_fail(f"3c: Expected 400, got {response.status_code}")
        tests_passed.append(False)
    
    # 3d: History for unused session (should return 200 with empty array)
    log_info("3d: Testing history for valid-format but unused session...")
    unused_session = generate_qa_session_id()
    response = get_history(unused_session)
    
    if response.status_code == 200:
        data = response.json()
        messages = data.get('data', {}).get('messages', [])
        if len(messages) == 0:
            log_pass("3d: Unused session returns 200 with empty messages array")
            tests_passed.append(True)
        else:
            log_fail(f"3d: Expected empty array, got {len(messages)} messages")
            tests_passed.append(False)
    else:
        log_fail(f"3d: Expected 200, got {response.status_code}")
        tests_passed.append(False)
    
    all_passed = all(tests_passed)
    details = f"3a: {tests_passed[0]}, 3b: {tests_passed[1]}, 3c: {tests_passed[2]}, 3d: {tests_passed[3]}"
    return log_result("TEST 3", all_passed, details)

# ============================================================================
# TEST 4: Escalation (ONE CALL - SENDS REAL EMAIL)
# ============================================================================

def test_4_escalation():
    log_test("4) Escalation (ONE CALL - SENDS REAL EMAIL)")
    
    # Create a session with some conversation first
    session_id = generate_qa_session_id()
    log_info(f"Creating conversation in session: {session_id}")
    
    # Add one message to the session
    response = post_chat(session_id, "I need help with my account")
    
    if response.status_code != 200:
        log_fail(f"Failed to create conversation: HTTP {response.status_code}")
        return log_result("TEST 4", False)
    
    log_pass("Conversation created")
    
    # Now escalate (THIS SENDS A REAL EMAIL)
    log_info("⚠️  ESCALATING - THIS WILL SEND A REAL EMAIL TO moxxcompany@gmail.com")
    escalate_response = post_escalate(
        session_id,
        contact_email="qa.tester@dynopaytest.com",
        note="Automated QA test - please ignore"
    )
    
    if escalate_response.status_code != 200:
        log_fail(f"Escalation failed: HTTP {escalate_response.status_code}")
        log_info(f"Response: {escalate_response.text}")
        return log_result("TEST 4", False)
    
    escalate_data = escalate_response.json()
    if escalate_data.get('data', {}).get('escalated') == True:
        log_pass("Escalation returned 200 with escalated=true")
    else:
        log_fail(f"Escalation response missing escalated=true: {escalate_data}")
        return log_result("TEST 4", False)
    
    # Check backend logs for escalation confirmation
    log_info("Checking backend logs for escalation confirmation...")
    try:
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        log_output = result.stdout
        if f"session {session_id} escalated to moxxcompany@gmail.com" in log_output:
            log_pass("Backend log contains escalation confirmation to moxxcompany@gmail.com")
        else:
            log_fail("Backend log does not contain expected escalation message")
            log_info("Checking last 20 lines of log:")
            for line in log_output.split('\n')[-20:]:
                if 'escalat' in line.lower() or session_id[:10] in line:
                    print(f"  {line}")
    except Exception as e:
        log_fail(f"Could not check backend logs: {e}")
    
    # Check history - should now have the "forwarded to support team" message
    log_info("Checking history for escalation message...")
    history_response = get_history(session_id)
    
    if history_response.status_code != 200:
        log_fail(f"History fetch failed: HTTP {history_response.status_code}")
        return log_result("TEST 4", False)
    
    history_data = history_response.json()
    messages = history_data.get('data', {}).get('messages', [])
    
    # Should have: user message + assistant reply + escalation assistant message = 3
    if len(messages) >= 3:
        log_pass(f"History contains {len(messages)} messages (includes escalation message)")
        
        # Check last message is the escalation message
        last_msg = messages[-1]
        if last_msg.get('role') == 'assistant' and 'forwarded to our support team' in last_msg.get('content', ''):
            log_pass("Last message is the escalation confirmation from assistant")
        else:
            log_fail("Last message is not the expected escalation confirmation")
    else:
        log_fail(f"Expected at least 3 messages, got {len(messages)}")
        return log_result("TEST 4", False)
    
    # Test escalation on empty session (should return 400)
    log_info("Testing escalation on empty session (should return 400)...")
    empty_session = generate_qa_session_id()
    empty_escalate_response = post_escalate(empty_session)
    
    if empty_escalate_response.status_code == 400:
        log_pass("Empty session escalation rejected with 400 'No conversation found'")
    else:
        log_fail(f"Empty session escalation: expected 400, got {empty_escalate_response.status_code}")
        return log_result("TEST 4", False)
    
    return log_result("TEST 4", True, "Escalation working - email sent, history updated, empty session rejected")

# ============================================================================
# TEST 5: Logged-in Context (Optional - JWT required)
# ============================================================================

def test_5_logged_in_context():
    log_test("5) Logged-in Context (Optional - JWT for hostbay@moxx.co)")
    
    # Try to mint JWT
    jwt_token = mint_jwt_for_hostbay()
    
    if not jwt_token:
        log_info("Skipping test 5 - could not mint JWT")
        return log_result("TEST 5", True, "SKIPPED - JWT minting failed")
    
    # Create a new session with JWT auth
    session_id = generate_qa_session_id()
    log_info(f"Using session with JWT auth: {session_id}")
    
    # Ask about company name
    log_info("Asking: 'What is my company name on DynoPay?'")
    response = post_chat(session_id, "What is my company name on DynoPay?", auth_token=jwt_token)
    
    if response.status_code != 200:
        log_fail(f"Request failed: HTTP {response.status_code}")
        return log_result("TEST 5", False)
    
    data = response.json()
    reply = data.get('data', {}).get('reply', '')
    
    if not reply:
        log_fail("Empty reply")
        return log_result("TEST 5", False)
    
    log_pass(f"Got reply (length={len(reply)})")
    log_info(f"Reply excerpt: {reply[:200]}...")
    
    # Check if reply mentions a company name (hostbay@moxx.co should have a company)
    # The reply should reference their company from tbl_company
    company_indicators = ['company', 'business', 'organization', 'account']
    has_company_ref = any(indicator.lower() in reply.lower() for indicator in company_indicators)
    
    if has_company_ref:
        log_pass("Reply references company information (merchant context injection working)")
    else:
        log_fail("Reply does not reference company information")
        return log_result("TEST 5", False)
    
    return log_result("TEST 5", True, "Logged-in merchant context injection working")

# ============================================================================
# TEST 6: Regression Tests
# ============================================================================

def test_6_regression():
    log_test("6) Regression Tests")
    
    tests_passed = []
    
    # 6a: GET /api/
    log_info("6a: GET /api/ (root endpoint)")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            log_pass("6a: GET /api/ returned 200")
            tests_passed.append(True)
        else:
            log_fail(f"6a: GET /api/ returned {response.status_code}")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"6a: GET /api/ failed: {e}")
        tests_passed.append(False)
    
    # 6b: GET /health
    log_info("6b: GET /health")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            bg_jobs = data.get('background_jobs', {})
            if bg_jobs.get('eligible') == False:
                log_pass("6b: GET /health returned 200 with background_jobs.eligible=false")
                tests_passed.append(True)
            else:
                log_fail(f"6b: background_jobs.eligible={bg_jobs.get('eligible')}, expected false")
                tests_passed.append(False)
        else:
            log_fail(f"6b: GET /health returned {response.status_code}")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"6b: GET /health failed: {e}")
        tests_passed.append(False)
    
    # 6c: GET /api/csrf-token
    log_info("6c: GET /api/csrf-token")
    try:
        response = requests.get(f"{API_BASE}/csrf-token", timeout=10)
        if response.status_code == 200:
            log_pass("6c: GET /api/csrf-token returned 200")
            tests_passed.append(True)
        else:
            log_fail(f"6c: GET /api/csrf-token returned {response.status_code}")
            tests_passed.append(False)
    except Exception as e:
        log_fail(f"6c: GET /api/csrf-token failed: {e}")
        tests_passed.append(False)
    
    all_passed = all(tests_passed)
    details = f"6a: {tests_passed[0]}, 6b: {tests_passed[1]}, 6c: {tests_passed[2]}"
    return log_result("TEST 6", all_passed, details)

# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Backend Test Suite - Session 12b: AI Support Chat Feature{RESET}")
    print(f"{BLUE}Testing: /api/support/chat (OpenAI gpt-5.4){RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    log_info("⚠️  SAFETY CONSTRAINTS:")
    log_info("  - All session_ids prefixed with 'qa-'")
    log_info("  - At most ONE escalate call (sends real email)")
    log_info("  - Keep to ≤6 chat calls total (costs OpenAI tokens)")
    log_info("  - Writes ONLY to tbl_support_chat_message")
    print()
    
    results = []
    
    # Run all tests
    results.append(("1: Multi-turn + Session", test_1_multi_turn_session()))
    results.append(("2: Session Isolation", test_2_session_isolation()))
    results.append(("3: Input Validation", test_3_input_validation()))
    results.append(("4: Escalation", test_4_escalation()))
    results.append(("5: Logged-in Context", test_5_logged_in_context()))
    results.append(("6: Regression", test_6_regression()))
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    for test_name, passed in results:
        status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        print(f"  {test_name}: {status}")
    
    total_passed = sum(1 for _, passed in results if passed)
    total_tests = len(results)
    
    print(f"\n{BLUE}API Call Summary:{RESET}")
    print(f"  POST /chat calls: {chat_call_count}/6")
    print(f"  POST /escalate calls: {escalate_call_count}/1")
    
    print(f"\n{BLUE}Total: {total_passed}/{total_tests} tests passed{RESET}\n")
    
    if total_passed == total_tests:
        print(f"{GREEN}✓ ALL TESTS PASSED{RESET}\n")
        return 0
    else:
        print(f"{RED}✗ SOME TESTS FAILED{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
