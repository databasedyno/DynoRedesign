#!/usr/bin/env python3
"""
Admin Support Inbox Backend Testing
====================================
Tests the NEW Admin Support Inbox backend for Dynopay app.
This is a prod-connected preview in SAFE MODE with DISABLE_OUTBOUND_EMAIL=true.

Admin Credentials: moxxcompany@gmail.com / Katiekendra123@
Backend URL: https://a99b939f-45b1-4e47-80f9-5665102e9204.preview.emergentagent.com/api
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://a99b939f-45b1-4e47-80f9-5665102e9204.preview.emergentagent.com/api"
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"

# Test session ID (throwaway for QA)
TIMESTAMP = int(time.time())
SESSION_ID = f"qa-inbox-{TIMESTAMP}"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_test(test_num, description):
    """Print test header"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST {test_num}: {description}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def print_pass(message):
    """Print pass message"""
    print(f"{GREEN}✓ PASS: {message}{RESET}")

def print_fail(message):
    """Print fail message"""
    print(f"{RED}✗ FAIL: {message}{RESET}")

def print_info(message):
    """Print info message"""
    print(f"{YELLOW}ℹ INFO: {message}{RESET}")

def print_response(response):
    """Print response details"""
    print(f"  Status: {response.status_code}")
    try:
        data = response.json()
        print(f"  Response: {json.dumps(data, indent=2)}")
    except:
        print(f"  Response: {response.text[:500]}")

# Test Results Tracker
test_results = []

def record_result(test_num, description, passed, details=""):
    """Record test result"""
    test_results.append({
        "test": test_num,
        "description": description,
        "passed": passed,
        "details": details
    })

# ============================================================================
# TEST 1: AUTH ENFORCED - Endpoints should return 401/403 without token
# ============================================================================
def test_1_auth_enforced():
    print_test(1, "AUTH ENFORCED - No token should return 401/403")
    
    passed = True
    details = []
    
    # Test GET /api/admin/support/summary without token
    print_info("Testing GET /api/admin/support/summary without token...")
    response = requests.get(f"{BASE_URL}/admin/support/summary")
    print_response(response)
    
    if response.status_code in [401, 403]:
        print_pass(f"GET /api/admin/support/summary returned {response.status_code} (auth enforced)")
        details.append(f"GET summary: {response.status_code}")
    else:
        print_fail(f"GET /api/admin/support/summary returned {response.status_code}, expected 401/403")
        passed = False
        details.append(f"GET summary: {response.status_code} (FAIL)")
    
    # Test POST /api/admin/support/sessions/qa-x/takeover without token
    print_info("Testing POST /api/admin/support/sessions/qa-x/takeover without token...")
    response = requests.post(f"{BASE_URL}/admin/support/sessions/qa-x/takeover")
    print_response(response)
    
    if response.status_code in [401, 403]:
        print_pass(f"POST takeover returned {response.status_code} (auth enforced)")
        details.append(f"POST takeover: {response.status_code}")
    else:
        print_fail(f"POST takeover returned {response.status_code}, expected 401/403")
        passed = False
        details.append(f"POST takeover: {response.status_code} (FAIL)")
    
    record_result(1, "AUTH ENFORCED", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 2: ADMIN LOGIN - Get access token
# ============================================================================
def test_2_admin_login():
    print_test(2, "ADMIN LOGIN - Get access token")
    
    passed = True
    details = []
    access_token = None
    
    # Test with correct credentials
    print_info("Testing POST /api/admin/login with correct credentials...")
    response = requests.post(
        f"{BASE_URL}/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        if data.get("data", {}).get("accessToken"):
            access_token = data["data"]["accessToken"]
            print_pass(f"Admin login successful, got accessToken")
            details.append("Login: 200 with accessToken")
        else:
            print_fail("Admin login returned 200 but no accessToken in response")
            passed = False
            details.append("Login: 200 but no accessToken (FAIL)")
    else:
        print_fail(f"Admin login failed with status {response.status_code}")
        passed = False
        details.append(f"Login: {response.status_code} (FAIL)")
    
    # Test with wrong password
    print_info("Testing POST /api/admin/login with WRONG password...")
    response = requests.post(
        f"{BASE_URL}/admin/login",
        json={"email": ADMIN_EMAIL, "password": "WrongPassword123!"}
    )
    print_response(response)
    
    if response.status_code != 200:
        print_pass(f"Wrong password correctly rejected with status {response.status_code}")
        details.append(f"Wrong password: {response.status_code}")
    else:
        print_fail("Wrong password returned 200 (should fail)")
        passed = False
        details.append("Wrong password: 200 (FAIL)")
    
    record_result(2, "ADMIN LOGIN", passed, "; ".join(details))
    return passed, access_token

# ============================================================================
# TEST 3: CREATE AI SESSION - Public endpoint
# ============================================================================
def test_3_create_ai_session():
    print_test(3, "CREATE AI SESSION - Public chat endpoint")
    
    passed = True
    details = []
    
    # Create AI session
    print_info(f"Testing POST /api/support/chat with session_id={SESSION_ID}...")
    response = requests.post(
        f"{BASE_URL}/support/chat",
        json={"session_id": SESSION_ID, "message": "Hi, testing"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("data", {}).get("mode")
        reply = data.get("data", {}).get("reply")
        
        if mode == "ai":
            print_pass(f"Session created with mode='ai'")
            details.append("mode=ai")
        else:
            print_fail(f"Expected mode='ai', got mode='{mode}'")
            passed = False
            details.append(f"mode={mode} (FAIL)")
        
        if reply and len(reply) > 0:
            print_pass(f"Got non-empty AI reply: {reply[:100]}...")
            details.append("reply non-empty")
        else:
            print_fail("AI reply is empty or missing")
            passed = False
            details.append("reply empty (FAIL)")
    else:
        print_fail(f"Chat creation failed with status {response.status_code}")
        passed = False
        details.append(f"Status: {response.status_code} (FAIL)")
    
    # Get history
    print_info(f"Testing GET /api/support/chat/history/{SESSION_ID}...")
    response = requests.get(f"{BASE_URL}/support/chat/history/{SESSION_ID}")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("data", {}).get("mode")
        messages = data.get("data", {}).get("messages", [])
        
        if mode == "ai":
            print_pass("History shows mode='ai'")
            details.append("history mode=ai")
        else:
            print_fail(f"History mode='{mode}', expected 'ai'")
            passed = False
            details.append(f"history mode={mode} (FAIL)")
        
        if len(messages) >= 2:
            print_pass(f"History has {len(messages)} messages (user + assistant)")
            details.append(f"{len(messages)} messages")
        else:
            print_fail(f"History has only {len(messages)} messages, expected at least 2")
            passed = False
            details.append(f"{len(messages)} messages (FAIL)")
    else:
        print_fail(f"Get history failed with status {response.status_code}")
        passed = False
        details.append(f"History: {response.status_code} (FAIL)")
    
    record_result(3, "CREATE AI SESSION", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 4: TAKEOVER - Admin takes over from AI
# ============================================================================
def test_4_takeover(admin_token):
    print_test(4, "TAKEOVER - Admin takes over, AI pauses")
    
    passed = True
    details = []
    
    # Admin takeover
    print_info(f"Testing POST /api/admin/support/sessions/{SESSION_ID}/takeover...")
    response = requests.post(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}/takeover",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("data", {}).get("mode")
        
        if mode == "human":
            print_pass("Takeover successful, mode='human'")
            details.append("takeover mode=human")
        else:
            print_fail(f"Takeover returned mode='{mode}', expected 'human'")
            passed = False
            details.append(f"takeover mode={mode} (FAIL)")
    else:
        print_fail(f"Takeover failed with status {response.status_code}")
        passed = False
        details.append(f"Takeover: {response.status_code} (FAIL)")
    
    # Visitor sends message while in human mode
    print_info("Testing visitor message while in human mode (AI should NOT answer)...")
    response = requests.post(
        f"{BASE_URL}/support/chat",
        json={"session_id": SESSION_ID, "message": "still there?"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("data", {}).get("mode")
        reply = data.get("data", {}).get("reply")
        
        if mode == "human":
            print_pass("Visitor message stored with mode='human'")
            details.append("visitor mode=human")
        else:
            print_fail(f"Expected mode='human', got mode='{mode}'")
            passed = False
            details.append(f"visitor mode={mode} (FAIL)")
        
        if reply is None:
            print_pass("AI correctly did NOT reply (reply=null)")
            details.append("reply=null")
        else:
            print_fail(f"AI replied when it shouldn't: {reply}")
            passed = False
            details.append("reply not null (FAIL)")
    else:
        print_fail(f"Visitor message failed with status {response.status_code}")
        passed = False
        details.append(f"Visitor msg: {response.status_code} (FAIL)")
    
    # Check history for agent join note
    print_info("Checking history for agent join note...")
    response = requests.get(f"{BASE_URL}/support/chat/history/{SESSION_ID}")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        messages = data.get("data", {}).get("messages", [])
        
        # Look for agent join message
        agent_messages = [m for m in messages if m.get("role") == "agent"]
        if agent_messages:
            print_pass(f"Found {len(agent_messages)} agent message(s) in history")
            details.append(f"{len(agent_messages)} agent msgs")
        else:
            print_fail("No agent messages found in history")
            passed = False
            details.append("no agent msgs (FAIL)")
    
    record_result(4, "TAKEOVER", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 5: AGENT REPLY - Admin sends reply
# ============================================================================
def test_5_agent_reply(admin_token):
    print_test(5, "AGENT REPLY - Admin sends reply")
    
    passed = True
    details = []
    
    # Admin reply
    print_info(f"Testing POST /api/admin/support/sessions/{SESSION_ID}/reply...")
    response = requests.post(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}/reply",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"message": "Agent here, how can I help?"}
    )
    print_response(response)
    
    if response.status_code == 200:
        print_pass("Agent reply sent successfully")
        details.append("reply: 200")
    else:
        print_fail(f"Agent reply failed with status {response.status_code}")
        passed = False
        details.append(f"reply: {response.status_code} (FAIL)")
    
    # Get session detail
    print_info(f"Testing GET /api/admin/support/sessions/{SESSION_ID}...")
    response = requests.get(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        session = data.get("data", {}).get("session", {})
        messages = data.get("data", {}).get("messages", [])
        
        if session.get("mode") == "human":
            print_pass("Session mode is 'human'")
            details.append("session mode=human")
        else:
            print_fail(f"Session mode is '{session.get('mode')}', expected 'human'")
            passed = False
            details.append(f"session mode={session.get('mode')} (FAIL)")
        
        # Check for agent reply in messages
        agent_replies = [m for m in messages if m.get("role") == "agent" and "Agent here" in m.get("content", "")]
        if agent_replies:
            print_pass("Found agent reply in messages")
            details.append("agent reply found")
        else:
            print_fail("Agent reply not found in messages")
            passed = False
            details.append("agent reply not found (FAIL)")
    else:
        print_fail(f"Get session failed with status {response.status_code}")
        passed = False
        details.append(f"get session: {response.status_code} (FAIL)")
    
    record_result(5, "AGENT REPLY", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 6: HANDBACK - Return to AI
# ============================================================================
def test_6_handback(admin_token):
    print_test(6, "HANDBACK - Return to AI")
    
    passed = True
    details = []
    
    # Handback to AI
    print_info(f"Testing POST /api/admin/support/sessions/{SESSION_ID}/handback...")
    response = requests.post(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}/handback",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("data", {}).get("mode")
        
        if mode == "ai":
            print_pass("Handback successful, mode='ai'")
            details.append("handback mode=ai")
        else:
            print_fail(f"Handback returned mode='{mode}', expected 'ai'")
            passed = False
            details.append(f"handback mode={mode} (FAIL)")
    else:
        print_fail(f"Handback failed with status {response.status_code}")
        passed = False
        details.append(f"Handback: {response.status_code} (FAIL)")
    
    # Visitor sends message, AI should answer
    print_info("Testing visitor message after handback (AI should answer)...")
    response = requests.post(
        f"{BASE_URL}/support/chat",
        json={"session_id": SESSION_ID, "message": "are you a bot now?"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("data", {}).get("mode")
        reply = data.get("data", {}).get("reply")
        
        if mode == "ai":
            print_pass("Message processed with mode='ai'")
            details.append("visitor mode=ai")
        else:
            print_fail(f"Expected mode='ai', got mode='{mode}'")
            passed = False
            details.append(f"visitor mode={mode} (FAIL)")
        
        if reply and len(reply) > 0:
            print_pass(f"AI answered again: {reply[:100]}...")
            details.append("AI replied")
        else:
            print_fail("AI did not reply")
            passed = False
            details.append("AI no reply (FAIL)")
    else:
        print_fail(f"Visitor message failed with status {response.status_code}")
        passed = False
        details.append(f"Visitor msg: {response.status_code} (FAIL)")
    
    record_result(6, "HANDBACK", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 7: EMAIL REPLY - Send email to visitor
# ============================================================================
def test_7_email_reply(admin_token):
    print_test(7, "EMAIL REPLY - Send email to visitor")
    
    passed = True
    details = []
    
    # Try email without contact email
    print_info("Testing email reply WITHOUT contact email (should fail)...")
    response = requests.post(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}/email",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"message": "Thanks for reaching out"}
    )
    print_response(response)
    
    if response.status_code == 400:
        print_pass("Email without contact correctly rejected with 400")
        details.append("no contact: 400")
    else:
        print_fail(f"Expected 400, got {response.status_code}")
        passed = False
        details.append(f"no contact: {response.status_code} (FAIL)")
    
    # Try email with explicit recipient
    print_info("Testing email reply WITH explicit recipient...")
    response = requests.post(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}/email",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "to": "qa@example.com",
            "subject": "Re: test",
            "message": "Thanks!"
        }
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        disabled = data.get("data", {}).get("disabled_in_preview")
        to = data.get("data", {}).get("to")
        
        if disabled is True:
            print_pass("Email suppressed in preview (disabled_in_preview=true)")
            details.append("disabled_in_preview=true")
        else:
            print_fail(f"Expected disabled_in_preview=true, got {disabled}")
            passed = False
            details.append(f"disabled_in_preview={disabled} (FAIL)")
        
        if to == "qa@example.com":
            print_pass("Email recipient correct (to=qa@example.com)")
            details.append("to=qa@example.com")
        else:
            print_fail(f"Expected to=qa@example.com, got to={to}")
            passed = False
            details.append(f"to={to} (FAIL)")
    else:
        print_fail(f"Email reply failed with status {response.status_code}")
        passed = False
        details.append(f"Email: {response.status_code} (FAIL)")
    
    record_result(7, "EMAIL REPLY", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 8: LIST + SUMMARY - Admin inbox endpoints
# ============================================================================
def test_8_list_summary(admin_token):
    print_test(8, "LIST + SUMMARY - Admin inbox endpoints")
    
    passed = True
    details = []
    
    # Get sessions list
    print_info("Testing GET /api/admin/support/sessions?status=all...")
    response = requests.get(
        f"{BASE_URL}/admin/support/sessions?status=all",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        sessions = data.get("data", {}).get("sessions", [])
        
        # Check if our test session is in the list
        our_session = [s for s in sessions if s.get("session_id") == SESSION_ID]
        if our_session:
            print_pass(f"Found test session {SESSION_ID} in sessions list")
            session = our_session[0]
            print_info(f"  Session details: mode={session.get('mode')}, status={session.get('status')}, message_count={session.get('message_count')}")
            details.append(f"session found: mode={session.get('mode')}")
        else:
            print_fail(f"Test session {SESSION_ID} not found in sessions list")
            passed = False
            details.append("session not found (FAIL)")
        
        # Check session structure
        if sessions and len(sessions) > 0:
            sample = sessions[0]
            required_fields = ["session_id", "message_count", "last_message_at", "preview"]
            missing = [f for f in required_fields if f not in sample]
            if not missing:
                print_pass("Session objects have required fields")
                details.append("fields OK")
            else:
                print_fail(f"Session objects missing fields: {missing}")
                passed = False
                details.append(f"missing fields: {missing} (FAIL)")
    else:
        print_fail(f"Get sessions failed with status {response.status_code}")
        passed = False
        details.append(f"sessions: {response.status_code} (FAIL)")
    
    # Get summary
    print_info("Testing GET /api/admin/support/summary...")
    response = requests.get(
        f"{BASE_URL}/admin/support/summary",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        summary = data.get("data", {})
        
        required_fields = ["open", "human", "escalated", "unread", "total"]
        missing = [f for f in required_fields if f not in summary]
        
        if not missing:
            print_pass("Summary has all required fields")
            print_info(f"  Summary: open={summary.get('open')}, human={summary.get('human')}, escalated={summary.get('escalated')}, unread={summary.get('unread')}, total={summary.get('total')}")
            details.append("summary fields OK")
            
            # Check that all are integers
            all_ints = all(isinstance(summary.get(f), int) for f in required_fields)
            if all_ints:
                print_pass("All summary fields are integers")
                details.append("all integers")
            else:
                print_fail("Some summary fields are not integers")
                passed = False
                details.append("not all integers (FAIL)")
        else:
            print_fail(f"Summary missing fields: {missing}")
            passed = False
            details.append(f"missing: {missing} (FAIL)")
    else:
        print_fail(f"Get summary failed with status {response.status_code}")
        passed = False
        details.append(f"summary: {response.status_code} (FAIL)")
    
    record_result(8, "LIST + SUMMARY", passed, "; ".join(details))
    return passed

# ============================================================================
# TEST 9: VALIDATION - Error handling
# ============================================================================
def test_9_validation(admin_token):
    print_test(9, "VALIDATION - Error handling")
    
    passed = True
    details = []
    
    # Reply with missing message
    print_info("Testing reply with missing message (should return 400)...")
    response = requests.post(
        f"{BASE_URL}/admin/support/sessions/{SESSION_ID}/reply",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={}
    )
    print_response(response)
    
    if response.status_code == 400:
        print_pass("Missing message correctly rejected with 400")
        details.append("missing msg: 400")
    else:
        print_fail(f"Expected 400, got {response.status_code}")
        passed = False
        details.append(f"missing msg: {response.status_code} (FAIL)")
    
    # Get non-existent session
    print_info("Testing get non-existent session (should return 404)...")
    response = requests.get(
        f"{BASE_URL}/admin/support/sessions/does-not-exist-xyz",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    print_response(response)
    
    if response.status_code == 404:
        print_pass("Non-existent session correctly returned 404")
        details.append("not found: 404")
    else:
        print_fail(f"Expected 404, got {response.status_code}")
        passed = False
        details.append(f"not found: {response.status_code} (FAIL)")
    
    record_result(9, "VALIDATION", passed, "; ".join(details))
    return passed

# ============================================================================
# HEALTH CHECK
# ============================================================================
def test_health():
    print_test("HEALTH", "Health endpoint check")
    
    passed = True
    details = []
    
    print_info("Testing GET /health...")
    response = requests.get(f"{BASE_URL.replace('/api', '')}/health")
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        status = data.get("status")
        
        if status == "healthy":
            print_pass("Health check passed (status=healthy)")
            details.append("status=healthy")
        else:
            print_fail(f"Health status is '{status}', expected 'healthy'")
            passed = False
            details.append(f"status={status} (FAIL)")
    else:
        print_fail(f"Health check failed with status {response.status_code}")
        passed = False
        details.append(f"Status: {response.status_code} (FAIL)")
    
    record_result("HEALTH", "Health Check", passed, "; ".join(details))
    return passed

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}ADMIN SUPPORT INBOX BACKEND TESTING{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Session ID: {SESSION_ID}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    # Run tests in order
    test_1_auth_enforced()
    
    passed, admin_token = test_2_admin_login()
    if not passed or not admin_token:
        print_fail("Cannot continue without admin token")
        print_summary()
        return
    
    test_3_create_ai_session()
    test_4_takeover(admin_token)
    test_5_agent_reply(admin_token)
    test_6_handback(admin_token)
    test_7_email_reply(admin_token)
    test_8_list_summary(admin_token)
    test_9_validation(admin_token)
    test_health()
    
    # Print summary
    print_summary()

def print_summary():
    """Print test summary"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    for result in test_results:
        status = f"{GREEN}✓ PASS{RESET}" if result["passed"] else f"{RED}✗ FAIL{RESET}"
        print(f"{status} - Test {result['test']}: {result['description']}")
        if result["details"]:
            print(f"       Details: {result['details']}")
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    if failed == 0:
        print(f"{GREEN}ALL TESTS PASSED: {passed}/{total}{RESET}")
    else:
        print(f"{RED}SOME TESTS FAILED: {passed}/{total} passed, {failed}/{total} failed{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

if __name__ == "__main__":
    main()
