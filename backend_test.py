#!/usr/bin/env python3
"""
DynoPay Backend Testing - DATA-ISOLATION Bug Fix Verification
STRICTLY READ-ONLY: Login + GET requests only. NO mutations.
Testing recent-transactions company-scoping fix on LIVE Railway PROD database.
"""

import requests
import json
import sys
from typing import Dict, List, Optional, Set

# Base URL for API (external preview URL)
BASE_URL = "https://crypto-checkout-43.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
HEALTH_URL = "http://localhost:8001/health"

# Test credentials
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(msg: str):
    print(f"\n{Colors.BLUE}[TEST]{Colors.RESET} {msg}")

def print_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS:{Colors.RESET} {msg}")

def print_fail(msg: str):
    print(f"{Colors.RED}✗ FAIL:{Colors.RESET} {msg}")

def print_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO:{Colors.RESET} {msg}")

def print_section(title: str):
    print(f"\n{'='*80}")
    print(f"{Colors.BLUE}{title}{Colors.RESET}")
    print('='*80)

class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
    
    def add_pass(self, test_name: str, details: str = ""):
        self.tests.append({"name": test_name, "status": "PASS", "details": details})
        self.passed += 1
        print_pass(f"{test_name} - {details}")
    
    def add_fail(self, test_name: str, details: str = ""):
        self.tests.append({"name": test_name, "status": "FAIL", "details": details})
        self.failed += 1
        print_fail(f"{test_name} - {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print_section("TEST SUMMARY")
        print(f"Total Tests: {total}")
        print(f"{Colors.GREEN}Passed: {self.passed}{Colors.RESET}")
        print(f"{Colors.RED}Failed: {self.failed}{Colors.RESET}")
        print(f"Pass Rate: {(self.passed/total*100) if total > 0 else 0:.1f}%")
        return self.failed == 0

results = TestResults()

def test_1_login() -> Optional[str]:
    """Test 1: Login with email/password and get JWT token"""
    print_section("TEST 1: Login Authentication")
    print_test(f"POST /api/user/login with {TEST_EMAIL}")
    
    try:
        response = requests.post(
            f"{API_BASE}/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Login", f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return None
        
        data = response.json()
        print_info(f"Response keys: {list(data.keys())}")
        
        # Try to find the token in various possible locations
        token = None
        token_field = None
        
        if "accessToken" in data:
            token = data["accessToken"]
            token_field = "accessToken"
        elif "token" in data:
            token = data["token"]
            token_field = "token"
        elif "data" in data and isinstance(data["data"], dict):
            if "accessToken" in data["data"]:
                token = data["data"]["accessToken"]
                token_field = "data.accessToken"
            elif "token" in data["data"]:
                token = data["data"]["token"]
                token_field = "data.token"
        
        if token:
            results.add_pass("Login", f"HTTP 200, JWT token found in field: {token_field}")
            print_info(f"Token (first 50 chars): {token[:50]}...")
            return token
        else:
            results.add_fail("Login", f"HTTP 200 but no JWT token found in response")
            print_info(f"Full response: {json.dumps(data, indent=2)[:1000]}")
            return None
            
    except Exception as e:
        results.add_fail("Login", f"Exception: {str(e)}")
        return None

def test_2_get_companies(token: str) -> List[Dict]:
    """Test 2: Get user's companies"""
    print_section("TEST 2: Get Companies List")
    print_test("GET /api/company/getCompany")
    
    try:
        response = requests.get(
            f"{API_BASE}/company/getCompany",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Get Companies", f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return []
        
        data = response.json()
        
        # Extract companies list
        companies = []
        if isinstance(data, list):
            companies = data
        elif "data" in data and isinstance(data["data"], list):
            companies = data["data"]
        elif "companies" in data and isinstance(data["companies"], list):
            companies = data["companies"]
        
        if not companies:
            results.add_fail("Get Companies", "No companies found in response")
            print_info(f"Response: {json.dumps(data, indent=2)[:1000]}")
            return []
        
        print_info(f"Found {len(companies)} companies")
        
        company_ids = []
        for i, company in enumerate(companies):
            company_id = company.get("company_id") or company.get("id")
            company_name = company.get("company_name") or company.get("name") or "Unknown"
            print_info(f"  Company {i+1}: ID={company_id}, Name={company_name}")
            if company_id:
                company_ids.append({"id": company_id, "name": company_name})
        
        if len(company_ids) >= 2:
            results.add_pass("Get Companies", f"Found {len(company_ids)} companies with IDs: {[c['id'] for c in company_ids]}")
        else:
            results.add_fail("Get Companies", f"Expected at least 2 companies, found {len(company_ids)}")
        
        return company_ids
        
    except Exception as e:
        results.add_fail("Get Companies", f"Exception: {str(e)}")
        return []

def test_3_recent_transactions_isolation(token: str, companies: List[Dict]):
    """Test 3: CORE ISOLATION CHECK - Recent transactions company-scoping"""
    print_section("TEST 3: CORE ISOLATION CHECK - Recent Transactions Company-Scoping")
    
    if len(companies) < 2:
        results.add_fail("Transaction Isolation", "Need at least 2 companies to test isolation")
        return
    
    company_a = companies[0]
    company_b = companies[1]
    
    print_test(f"Testing isolation between Company A (ID={company_a['id']}) and Company B (ID={company_b['id']})")
    
    try:
        # Get transactions for Company A
        print_info(f"Fetching transactions for Company A (ID={company_a['id']})...")
        response_a = requests.get(
            f"{API_BASE}/dashboard/recent-transactions",
            params={"company_id": company_a['id']},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Company A Status Code: {response_a.status_code}")
        
        if response_a.status_code != 200:
            results.add_fail("Transaction Isolation - Company A", f"Expected 200, got {response_a.status_code}")
            return
        
        data_a = response_a.json()
        transactions_a = []
        
        if isinstance(data_a, list):
            transactions_a = data_a
        elif "data" in data_a and isinstance(data_a["data"], list):
            transactions_a = data_a["data"]
        elif "transactions" in data_a and isinstance(data_a["transactions"], list):
            transactions_a = data_a["transactions"]
        
        print_info(f"Company A: {len(transactions_a)} transactions returned")
        
        # Get transactions for Company B
        print_info(f"Fetching transactions for Company B (ID={company_b['id']})...")
        response_b = requests.get(
            f"{API_BASE}/dashboard/recent-transactions",
            params={"company_id": company_b['id']},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Company B Status Code: {response_b.status_code}")
        
        if response_b.status_code != 200:
            results.add_fail("Transaction Isolation - Company B", f"Expected 200, got {response_b.status_code}")
            return
        
        data_b = response_b.json()
        transactions_b = []
        
        if isinstance(data_b, list):
            transactions_b = data_b
        elif "data" in data_b and isinstance(data_b["data"], list):
            transactions_b = data_b["data"]
        elif "transactions" in data_b and isinstance(data_b["transactions"], list):
            transactions_b = data_b["transactions"]
        
        print_info(f"Company B: {len(transactions_b)} transactions returned")
        
        # Extract transaction IDs/references
        def extract_tx_ids(transactions: List[Dict]) -> Set[str]:
            ids = set()
            for tx in transactions:
                tx_id = (tx.get("transaction_id") or 
                        tx.get("id") or 
                        tx.get("transaction_reference") or 
                        tx.get("reference") or 
                        tx.get("txn_id"))
                if tx_id:
                    ids.add(str(tx_id))
            return ids
        
        ids_a = extract_tx_ids(transactions_a)
        ids_b = extract_tx_ids(transactions_b)
        
        print_info(f"Company A transaction IDs (first 5): {list(ids_a)[:5]}")
        print_info(f"Company B transaction IDs (first 5): {list(ids_b)[:5]}")
        
        # Check for overlap
        overlap = ids_a.intersection(ids_b)
        
        if len(overlap) > 0:
            results.add_fail("Transaction Isolation", 
                           f"ISOLATION BREACH: {len(overlap)} transactions appear in BOTH companies: {list(overlap)[:5]}")
            print_info(f"Overlapping transaction IDs: {overlap}")
        else:
            results.add_pass("Transaction Isolation", 
                           f"Company A ({len(transactions_a)} txns) and Company B ({len(transactions_b)} txns) have NO overlapping transactions")
        
        # Check that responses are different (unless both are empty)
        if len(transactions_a) > 0 or len(transactions_b) > 0:
            if ids_a == ids_b and len(ids_a) > 0:
                results.add_fail("Transaction Isolation - Different Results", 
                               "Company A and B returned IDENTICAL transaction sets (data leak)")
            else:
                results.add_pass("Transaction Isolation - Different Results", 
                               "Company A and B returned different transaction sets")
        
    except Exception as e:
        results.add_fail("Transaction Isolation", f"Exception: {str(e)}")

def test_4_recent_transactions_no_company_id(token: str):
    """Test 4: Recent transactions without company_id (legacy behavior)"""
    print_section("TEST 4: Recent Transactions Without company_id (Legacy)")
    print_test("GET /api/dashboard/recent-transactions (no company_id param)")
    
    try:
        response = requests.get(
            f"{API_BASE}/dashboard/recent-transactions",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            results.add_pass("No company_id", "HTTP 200 - legacy across-all behavior still works")
            data = response.json()
            transactions = []
            if isinstance(data, list):
                transactions = data
            elif "data" in data:
                transactions = data["data"] if isinstance(data["data"], list) else []
            print_info(f"Returned {len(transactions)} transactions (across all companies)")
        else:
            results.add_fail("No company_id", f"Expected 200, got {response.status_code}")
            
    except Exception as e:
        results.add_fail("No company_id", f"Exception: {str(e)}")

def test_5_ownership_guard(token: str):
    """Test 5: OWNERSHIP GUARD - Reject unowned company_id"""
    print_section("TEST 5: OWNERSHIP GUARD - Unowned Company Rejection")
    print_test("GET /api/dashboard/recent-transactions?company_id=999999 (unowned)")
    
    try:
        response = requests.get(
            f"{API_BASE}/dashboard/recent-transactions",
            params={"company_id": 999999},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        # Should be rejected (403 or validation error)
        if response.status_code in [403, 401, 400]:
            results.add_pass("Ownership Guard", 
                           f"HTTP {response.status_code} - correctly rejected unowned company_id")
        elif response.status_code == 200:
            # Check if it returned empty data or error message
            data = response.json()
            if isinstance(data, dict) and ("error" in data or "message" in data):
                results.add_pass("Ownership Guard", 
                               f"HTTP 200 with error message: {data.get('error') or data.get('message')}")
            else:
                results.add_fail("Ownership Guard", 
                               "HTTP 200 with data - SECURITY ISSUE: unowned company_id returned data!")
                print_info(f"Data returned: {json.dumps(data, indent=2)[:500]}")
        else:
            results.add_fail("Ownership Guard", 
                           f"Unexpected status code {response.status_code}")
            
    except Exception as e:
        results.add_fail("Ownership Guard", f"Exception: {str(e)}")

def test_6_regression_dashboard_endpoints(token: str, companies: List[Dict]):
    """Test 6: REGRESSION - Other dashboard endpoints still work"""
    print_section("TEST 6: REGRESSION - Other Dashboard Endpoints")
    
    if not companies:
        print_info("No companies available, skipping regression tests")
        return
    
    company_id = companies[0]['id']
    
    # Test /api/dashboard
    print_test(f"GET /api/dashboard?company_id={company_id}")
    try:
        response = requests.get(
            f"{API_BASE}/dashboard",
            params={"company_id": company_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            results.add_pass("Dashboard Endpoint", "HTTP 200 - still working")
        else:
            results.add_fail("Dashboard Endpoint", f"Expected 200, got {response.status_code}")
            
    except Exception as e:
        results.add_fail("Dashboard Endpoint", f"Exception: {str(e)}")
    
    # Test /api/dashboard/chart
    print_test(f"GET /api/dashboard/chart?company_id={company_id}")
    try:
        response = requests.get(
            f"{API_BASE}/dashboard/chart",
            params={"company_id": company_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            results.add_pass("Dashboard Chart Endpoint", "HTTP 200 - still working")
        else:
            results.add_fail("Dashboard Chart Endpoint", f"Expected 200, got {response.status_code}")
            
    except Exception as e:
        results.add_fail("Dashboard Chart Endpoint", f"Exception: {str(e)}")

def test_7_health_check():
    """Test 7: Health check via localhost"""
    print_section("TEST 7: Health Check (SAFE MODE Verification)")
    print_test("GET http://localhost:8001/health")
    
    try:
        response = requests.get(HEALTH_URL, timeout=10)
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Health Check", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        print_info(f"Health Response: {json.dumps(data, indent=2)}")
        
        status = data.get("status")
        database = data.get("database")
        redis = data.get("redis")
        bg_jobs = data.get("background_jobs", {})
        bg_eligible = bg_jobs.get("eligible") if isinstance(bg_jobs, dict) else None
        
        checks = []
        
        if status == "healthy":
            checks.append("status=healthy ✓")
        else:
            checks.append(f"status={status} ✗")
        
        if database == "connected":
            checks.append("database=connected ✓")
        else:
            checks.append(f"database={database} ✗")
        
        if redis == "connected":
            checks.append("redis=connected ✓")
        else:
            checks.append(f"redis={redis} ✗")
        
        if bg_eligible == False:
            checks.append("background_jobs.eligible=false ✓ (SAFE MODE)")
        else:
            checks.append(f"background_jobs.eligible={bg_eligible} ✗ (NOT SAFE MODE!)")
        
        all_good = (status == "healthy" and 
                   database == "connected" and 
                   redis == "connected" and 
                   bg_eligible == False)
        
        if all_good:
            results.add_pass("Health Check", ", ".join(checks))
        else:
            results.add_fail("Health Check", ", ".join(checks))
            
    except Exception as e:
        results.add_fail("Health Check", f"Exception: {str(e)}")

def main():
    print_section("DynoPay DATA-ISOLATION Bug Fix Verification")
    print_info("STRICTLY READ-ONLY: Login + GET requests only")
    print_info("Testing on LIVE Railway PROD database in SAFE MODE")
    print_info(f"Base URL: {BASE_URL}")
    
    # Test 1: Login
    token = test_1_login()
    if not token:
        print_fail("Cannot proceed without authentication token")
        sys.exit(1)
    
    # Test 2: Get companies
    companies = test_2_get_companies(token)
    
    # Test 3: Core isolation check
    if companies:
        test_3_recent_transactions_isolation(token, companies)
    
    # Test 4: No company_id (legacy)
    test_4_recent_transactions_no_company_id(token)
    
    # Test 5: Ownership guard
    test_5_ownership_guard(token)
    
    # Test 6: Regression tests
    test_6_regression_dashboard_endpoints(token, companies)
    
    # Test 7: Health check
    test_7_health_check()
    
    # Summary
    success = results.summary()
    
    print_section("OVERALL VERDICT")
    if success:
        print(f"{Colors.GREEN}✓ ALL TESTS PASSED{Colors.RESET}")
        print("The recent-transactions company-isolation fix is working correctly.")
        sys.exit(0)
    else:
        print(f"{Colors.RED}✗ SOME TESTS FAILED{Colors.RESET}")
        print("Review the failures above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()
