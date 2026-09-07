#!/usr/bin/env python3
"""
Backend API Test for Dynopay Bug Fixes
- Weekly Summary "lacking data" fix
- Email greeting "Hey The," fix
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "onarrival21@gmail.com"
TEST_PASSWORD = "Katiekendra123@"

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append((test_name, details))
        print(f"{GREEN}✓ PASS{RESET}: {test_name}")
        if details:
            print(f"  {details}")
    
    def add_fail(self, test_name: str, details: str):
        self.failed.append((test_name, details))
        print(f"{RED}✗ FAIL{RESET}: {test_name}")
        print(f"  {details}")
    
    def add_warning(self, test_name: str, details: str):
        self.warnings.append((test_name, details))
        print(f"{YELLOW}⚠ WARNING{RESET}: {test_name}")
        print(f"  {details}")
    
    def summary(self):
        print("\n" + "="*80)
        print(f"{BLUE}TEST SUMMARY{RESET}")
        print("="*80)
        print(f"Passed: {GREEN}{len(self.passed)}{RESET}")
        print(f"Failed: {RED}{len(self.failed)}{RESET}")
        print(f"Warnings: {YELLOW}{len(self.warnings)}{RESET}")
        
        if self.failed:
            print(f"\n{RED}FAILED TESTS:{RESET}")
            for name, details in self.failed:
                print(f"  - {name}")
                print(f"    {details}")
        
        return len(self.failed) == 0


def login(results: TestResult) -> Optional[str]:
    """
    Login and get access token.
    Returns the JWT token or None if login fails.
    """
    print(f"\n{BLUE}=== TEST 1: LOGIN ==={RESET}")
    
    url = f"{API_BASE}/user/login"
    payload = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"Request: POST {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Login", f"Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check for 2FA requirement
        if data.get('requires_2fa'):
            results.add_fail("Login", "Account requires 2FA (not expected for this test account)")
            return None
        
        # Check for success message
        if data.get('message') != "Login Successful!":
            results.add_warning("Login", f"Unexpected message: {data.get('message')}")
        
        # Extract token
        token = data.get('data', {}).get('accessToken')
        if not token:
            results.add_fail("Login", "No accessToken in response")
            return None
        
        results.add_pass("Login", f"Successfully logged in, token length: {len(token)}")
        return token
        
    except Exception as e:
        results.add_fail("Login", f"Exception: {str(e)}")
        return None


def test_weekly_summary(token: str, results: TestResult):
    """
    Test the weekly summary endpoint with dry_run=true.
    Verify that the summary data is NO LONGER all-zero.
    """
    print(f"\n{BLUE}=== TEST 2: WEEKLY SUMMARY (dry_run) ==={RESET}")
    
    url = f"{API_BASE}/notifications/trigger-weekly-summary"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "user_id": 1,
        "dry_run": True
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        print(f"Request: POST {url}")
        print(f"Headers: Authorization: Bearer {token[:20]}...")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Weekly Summary - HTTP Status", 
                           f"Expected HTTP 200, got {response.status_code}\nResponse: {response.text}")
            return
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Extract the summary from data.data.results[0]
        response_data = data.get('data', {})
        if not response_data.get('results') or len(response_data['results']) == 0:
            results.add_fail("Weekly Summary - Response Structure", 
                           "No results array in response")
            return
        
        summary = response_data['results'][0].get('summary')
        if not summary:
            results.add_fail("Weekly Summary - Response Structure", 
                           "No summary in results[0]")
            return
        
        print(f"\n{BLUE}Summary Data:{RESET}")
        print(f"  transaction_count: {summary.get('transaction_count')}")
        print(f"  completed_count: {summary.get('completed_count')}")
        print(f"  pending_count: {summary.get('pending_count')}")
        print(f"  total_volume: {summary.get('total_volume')}")
        print(f"  top_currency: {summary.get('top_currency')}")
        
        # PASS criteria: summary is NO LONGER all-zero
        checks = []
        
        # Check completed_count > 0
        completed_count = summary.get('completed_count', 0)
        if completed_count > 0:
            checks.append(f"completed_count={completed_count} > 0 ✓")
        else:
            checks.append(f"completed_count={completed_count} (EXPECTED > 0) ✗")
        
        # Check total_volume > 0
        total_volume = summary.get('total_volume', 0)
        if total_volume > 0:
            checks.append(f"total_volume={total_volume} > 0 ✓")
        else:
            checks.append(f"total_volume={total_volume} (EXPECTED > 0) ✗")
        
        # Check top_currency is not "None" or empty
        top_currency = summary.get('top_currency', '')
        if top_currency and top_currency not in ['None', '', 'null']:
            checks.append(f"top_currency='{top_currency}' (not None/empty) ✓")
        else:
            checks.append(f"top_currency='{top_currency}' (EXPECTED non-empty) ✗")
        
        # Check pending_count > 0
        pending_count = summary.get('pending_count', 0)
        if pending_count > 0:
            checks.append(f"pending_count={pending_count} > 0 ✓")
        else:
            checks.append(f"pending_count={pending_count} (EXPECTED > 0) ✗")
        
        # Check transaction_count > 0
        transaction_count = summary.get('transaction_count', 0)
        if transaction_count > 0:
            checks.append(f"transaction_count={transaction_count} > 0 ✓")
        else:
            checks.append(f"transaction_count={transaction_count} (EXPECTED > 0) ✗")
        
        print(f"\n{BLUE}Regression Checks:{RESET}")
        for check in checks:
            print(f"  {check}")
        
        # All checks must pass
        all_pass = (
            completed_count > 0 and
            total_volume > 0 and
            top_currency and top_currency not in ['None', '', 'null'] and
            pending_count > 0 and
            transaction_count > 0
        )
        
        if all_pass:
            results.add_pass("Weekly Summary - Data Regression Check", 
                           f"Summary is NO LONGER all-zero (completed={completed_count}, volume={total_volume}, currency={top_currency})")
        else:
            results.add_fail("Weekly Summary - Data Regression Check", 
                           f"Summary still contains zero/empty values:\n" + "\n".join(checks))
        
        # Verify dry_run did NOT create a notification
        notification = response_data['results'][0].get('notification')
        if notification is None or notification == 'null':
            results.add_pass("Weekly Summary - dry_run Behavior", 
                           "dry_run=true did NOT create a notification (correct)")
        else:
            results.add_fail("Weekly Summary - dry_run Behavior", 
                           f"dry_run=true created a notification: {notification}")
        
        # Reference values check (informational)
        print(f"\n{BLUE}Reference Values (from fix time):{RESET}")
        print(f"  Expected ~52 transactions, ~22 completed, ~30 pending, ~495.15 volume, BTC currency")
        print(f"  Note: Exact numbers may drift if new live transactions arrive")
        
    except Exception as e:
        results.add_fail("Weekly Summary - Exception", f"Exception: {str(e)}")


def test_recipients_preview(token: str, results: TestResult):
    """
    Test the recipients-preview endpoint.
    Verify that company_id=1 "The Dev Store" has greeting_first_name="John" (NOT "The").
    """
    print(f"\n{BLUE}=== TEST 3: RECIPIENTS PREVIEW (Greeting Fix) ==={RESET}")
    
    url = f"{API_BASE}/notifications/recipients-preview"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"Request: GET {url}")
        print(f"Headers: Authorization: Bearer {token[:20]}...")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Recipients Preview - HTTP Status", 
                           f"Expected HTTP 200, got {response.status_code}\nResponse: {response.text}")
            return
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Find company_id=1 "The Dev Store"
        response_data = data.get('data', {})
        companies = response_data.get('companies', [])
        if not companies:
            results.add_fail("Recipients Preview - Response Structure", 
                           "No companies array in response")
            return
        
        target_company = None
        for company in companies:
            if company.get('company_id') == 1:
                target_company = company
                break
        
        if not target_company:
            results.add_fail("Recipients Preview - Company Not Found", 
                           "company_id=1 not found in response")
            return
        
        company_name = target_company.get('company_name')
        print(f"\n{BLUE}Found Company:{RESET}")
        print(f"  company_id: 1")
        print(f"  company_name: {company_name}")
        
        if company_name != "The Dev Store":
            results.add_warning("Recipients Preview - Company Name", 
                              f"Expected 'The Dev Store', got '{company_name}'")
        
        # Find the PRIMARY recipient (source == "company" or "owner")
        recipients = target_company.get('recipients', [])
        if not recipients:
            results.add_fail("Recipients Preview - No Recipients", 
                           "No recipients for company_id=1")
            return
        
        print(f"\n{BLUE}Recipients:{RESET}")
        primary_recipient = None
        for recipient in recipients:
            source = recipient.get('source')
            greeting_name = recipient.get('greeting_name')
            greeting_first_name = recipient.get('greeting_first_name')
            
            print(f"  - source: {source}")
            print(f"    greeting_name: {greeting_name}")
            print(f"    greeting_first_name: {greeting_first_name}")
            
            if source in ['company', 'owner']:
                primary_recipient = recipient
        
        if not primary_recipient:
            results.add_fail("Recipients Preview - No Primary Recipient", 
                           "No recipient with source='company' or 'owner' found")
            return
        
        # Verify greeting_first_name == "John" (NOT "The")
        greeting_first_name = primary_recipient.get('greeting_first_name')
        greeting_name = primary_recipient.get('greeting_name')
        
        print(f"\n{BLUE}Primary Recipient Greeting Check:{RESET}")
        print(f"  greeting_first_name: '{greeting_first_name}'")
        print(f"  greeting_name: '{greeting_name}'")
        
        if greeting_first_name == "John":
            results.add_pass("Recipients Preview - Greeting First Name", 
                           f"greeting_first_name='John' (correct, NOT 'The')")
        else:
            results.add_fail("Recipients Preview - Greeting First Name", 
                           f"Expected 'John', got '{greeting_first_name}' (BUG: still using company name?)")
        
        if greeting_name == "John Davis":
            results.add_pass("Recipients Preview - Greeting Full Name", 
                           f"greeting_name='John Davis' (correct)")
        else:
            results.add_warning("Recipients Preview - Greeting Full Name", 
                              f"Expected 'John Davis', got '{greeting_name}'")
        
        # Check for any recipient with greeting_first_name == "The" (should NOT exist)
        bad_recipients = [r for r in recipients if r.get('greeting_first_name') == 'The']
        if bad_recipients:
            results.add_fail("Recipients Preview - Bad Greeting Found", 
                           f"Found {len(bad_recipients)} recipient(s) with greeting_first_name='The' (BUG NOT FIXED)")
        else:
            results.add_pass("Recipients Preview - No Bad Greetings", 
                           "No recipients with greeting_first_name='The' found")
        
    except Exception as e:
        results.add_fail("Recipients Preview - Exception", f"Exception: {str(e)}")


def main():
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Dynopay Backend Bug Fix Verification{RESET}")
    print(f"{BLUE}Session: 2026-09-07 (pod a7d8a15f){RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    print(f"SAFE MODE: Live production Postgres (READ-ONLY where possible)")
    
    results = TestResult()
    
    # Step 1: Login (ONCE, reuse token)
    token = login(results)
    if not token:
        print(f"\n{RED}CRITICAL: Login failed, cannot proceed with other tests{RESET}")
        results.summary()
        sys.exit(1)
    
    # Step 2: Test weekly summary
    test_weekly_summary(token, results)
    
    # Step 3: Test recipients preview (greeting fix)
    test_recipients_preview(token, results)
    
    # Summary
    success = results.summary()
    
    if success:
        print(f"\n{GREEN}{'='*80}{RESET}")
        print(f"{GREEN}ALL TESTS PASSED ✓✓✓{RESET}")
        print(f"{GREEN}{'='*80}{RESET}")
        sys.exit(0)
    else:
        print(f"\n{RED}{'='*80}{RESET}")
        print(f"{RED}SOME TESTS FAILED{RESET}")
        print(f"{RED}{'='*80}{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
