#!/usr/bin/env python3
"""
Backend API Testing for DynoPay Transaction Source Refactor
STRICT READ-ONLY testing on LIVE PRODUCTION database
"""

import requests
import json
from typing import Dict, List, Any
from collections import Counter

# Configuration
BASE_URL = "https://13e42067-64de-478e-a336-166a694ea757.preview.emergentagent.com"
EMAIL = "hostbay@moxx.co"
PASSWORD = "Katiekendra123@"

# Canonical source types (the ONLY allowed values)
CANONICAL_TYPES = {"payment_link", "api", "tip", "product", "contribution", "direct"}

# Old/deprecated string values that should NOT appear
DEPRECATED_VALUES = {"legacy_api", "checkout"}

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
        
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append(f"✅ {test_name}: {details}")
        
    def add_fail(self, test_name: str, details: str):
        self.failed.append(f"❌ {test_name}: {details}")
        
    def add_warning(self, test_name: str, details: str):
        self.warnings.append(f"⚠️  {test_name}: {details}")
        
    def print_summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        if self.passed:
            print("\n✅ PASSED TESTS:")
            for p in self.passed:
                print(f"  {p}")
                
        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for w in self.warnings:
                print(f"  {w}")
                
        if self.failed:
            print("\n❌ FAILED TESTS:")
            for f in self.failed:
                print(f"  {f}")
                
        print("\n" + "="*80)
        total = len(self.passed) + len(self.failed)
        print(f"TOTAL: {len(self.passed)}/{total} tests passed")
        if self.failed:
            print("STATUS: ❌ CRITICAL ISSUES FOUND")
        else:
            print("STATUS: ✅ ALL TESTS PASSED")
        print("="*80 + "\n")

def authenticate() -> tuple:
    """
    Authenticate and return (csrf_token, cookie_header, access_token)
    """
    session = requests.Session()
    
    print("Step 1: Getting CSRF token...")
    csrf_response = session.get(f"{BASE_URL}/api/csrf-token")
    print(f"  Status: {csrf_response.status_code}")
    
    if csrf_response.status_code != 200:
        raise Exception(f"Failed to get CSRF token: {csrf_response.status_code} - {csrf_response.text}")
    
    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get("csrf_token") or csrf_data.get("csrfToken")
    
    # Get cookies
    cookies = session.cookies.get_dict()
    cookie_header = "; ".join([f"{k}={v}" for k, v in cookies.items()])
    
    print(f"  CSRF Token: {csrf_token[:20]}...")
    print(f"  Cookies: {list(cookies.keys())}")
    
    # Step 2: Check email (optional, skip if not needed)
    print("\nStep 2: Checking email (optional)...")
    check_email_response = session.get(
        f"{BASE_URL}/api/user/checkEmail?email={EMAIL}",
        headers={
            "Cookie": cookie_header
        }
    )
    print(f"  Status: {check_email_response.status_code}")
    
    if check_email_response.status_code == 200:
        check_data = check_email_response.json()
        print(f"  Valid Email: {check_data.get('validEmail')}")
    else:
        print(f"  Skipping email check (not critical)")
    
    # Step 3: Login
    print("\nStep 3: Logging in...")
    login_response = session.post(
        f"{BASE_URL}/api/user/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers={
            "Content-Type": "application/json",
            "x-csrf-token": csrf_token,
            "Cookie": cookie_header
        }
    )
    print(f"  Status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"  Response: {login_response.text}")
        raise Exception(f"Login failed: {login_response.status_code}")
    
    login_data = login_response.json()
    
    # Try to find access token in various locations
    access_token = None
    if "data" in login_data and isinstance(login_data["data"], dict):
        access_token = login_data["data"].get("accessToken")
    if not access_token:
        access_token = login_data.get("accessToken")
    if not access_token:
        access_token = login_data.get("access_token")
    
    if not access_token:
        print(f"  Login response keys: {login_data.keys()}")
        raise Exception("Could not find accessToken in login response")
    
    print(f"  Access Token: {access_token[:20]}...")
    
    return csrf_token, cookie_header, access_token

def validate_source_object(source: Any, tx_id: str, results: TestResults, endpoint_name: str) -> bool:
    """
    Validate that source is an object with valid canonical type.
    Returns True if valid, False otherwise.
    """
    # Check if source is an object (dict)
    if not isinstance(source, dict):
        results.add_fail(
            f"{endpoint_name} - Transaction {tx_id}",
            f"source is NOT an object, it's a {type(source).__name__}: {source}"
        )
        return False
    
    # Check if source has a type field
    if "type" not in source:
        results.add_fail(
            f"{endpoint_name} - Transaction {tx_id}",
            f"source object missing 'type' field: {source}"
        )
        return False
    
    source_type = source["type"]
    
    # Check if type is in canonical set
    if source_type not in CANONICAL_TYPES:
        results.add_fail(
            f"{endpoint_name} - Transaction {tx_id}",
            f"source.type '{source_type}' is NOT in canonical set {CANONICAL_TYPES}"
        )
        return False
    
    # Check for deprecated values
    if source_type in DEPRECATED_VALUES:
        results.add_fail(
            f"{endpoint_name} - Transaction {tx_id}",
            f"source.type '{source_type}' is a DEPRECATED value (should not appear)"
        )
        return False
    
    # Check if the entire source is a deprecated string
    if isinstance(source, str) and source in DEPRECATED_VALUES:
        results.add_fail(
            f"{endpoint_name} - Transaction {tx_id}",
            f"source is a deprecated string value: '{source}'"
        )
        return False
    
    return True

def test_dashboard_recent_transactions(access_token: str, results: TestResults) -> Dict[str, int]:
    """
    Test GET /api/dashboard/recent-transactions?limit=25
    Returns count per source.type
    """
    print("\n" + "="*80)
    print("TEST A: GET /api/dashboard/recent-transactions?limit=25")
    print("="*80)
    
    response = requests.get(
        f"{BASE_URL}/api/dashboard/recent-transactions?limit=25",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        results.add_fail("Dashboard Recent Transactions", f"HTTP {response.status_code}: {response.text[:200]}")
        return {}
    
    data = response.json()
    print(f"Response structure: {list(data.keys()) if isinstance(data, dict) else 'list'}")
    if isinstance(data, dict) and len(str(data)) < 500:
        print(f"Response data: {data}")
    
    # Find transactions in response
    transactions = []
    if isinstance(data, list):
        transactions = data
    elif isinstance(data, dict):
        if "data" in data and isinstance(data["data"], dict):
            # Dashboard format: {message, data: {transactions: [...], count: N}}
            if "transactions" in data["data"]:
                transactions = data["data"]["transactions"]
        elif "data" in data and isinstance(data["data"], list):
            transactions = data["data"]
        elif "transactions" in data:
            transactions = data["transactions"]
        else:
            # Try to find any list in the response
            for value in data.values():
                if isinstance(value, list):
                    transactions = value
                    break
    
    print(f"Found {len(transactions)} transactions")
    
    if len(transactions) == 0:
        results.add_warning("Dashboard Recent Transactions", "No transactions returned (empty dataset)")
        return {}
    
    # Validate each transaction
    type_counts = Counter()
    valid_count = 0
    
    for i, tx in enumerate(transactions):
        tx_id = tx.get("id") or tx.get("transaction_id") or f"tx_{i}"
        
        if "source" not in tx:
            results.add_fail(f"Dashboard - Transaction {tx_id}", "Missing 'source' field")
            continue
        
        source = tx["source"]
        
        if validate_source_object(source, tx_id, results, "Dashboard"):
            valid_count += 1
            type_counts[source["type"]] += 1
    
    # Summary
    print(f"\nValidation Results:")
    print(f"  Valid: {valid_count}/{len(transactions)}")
    print(f"  Source Type Distribution:")
    for source_type, count in type_counts.most_common():
        print(f"    {source_type}: {count}")
    
    if valid_count == len(transactions):
        results.add_pass(
            "Dashboard Recent Transactions",
            f"All {len(transactions)} transactions have valid source objects. Distribution: {dict(type_counts)}"
        )
    
    return dict(type_counts)

def test_wallet_get_all_transactions(access_token: str, csrf_token: str, cookie_header: str, results: TestResults) -> Dict[str, int]:
    """
    Test POST /api/wallet/getAllTransactions
    Returns count per source.type
    """
    print("\n" + "="*80)
    print("TEST B: POST /api/wallet/getAllTransactions")
    print("="*80)
    
    # First, get company_id
    print("Getting company_id...")
    company_response = requests.get(
        f"{BASE_URL}/api/company/getCompany",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    print(f"Company endpoint status: {company_response.status_code}")
    
    if company_response.status_code != 200:
        # Try alternative endpoint
        print("Trying alternative endpoint /api/company/list...")
        company_response = requests.get(
            f"{BASE_URL}/api/company/list",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        print(f"Company list endpoint status: {company_response.status_code}")
        
        if company_response.status_code != 200:
            results.add_fail("Wallet Get All Transactions", f"Could not get company info. Both /api/company and /api/company/list returned non-200")
            return {}
    
    try:
        company_data = company_response.json()
    except Exception as e:
        results.add_fail("Wallet Get All Transactions", f"Could not parse company response as JSON. Status: {company_response.status_code}, Content: {company_response.text[:200]}")
        return {}
    
    # Find company_id for hostbay
    company_id = None
    if isinstance(company_data, dict):
        if "data" in company_data:
            if isinstance(company_data["data"], list) and len(company_data["data"]) > 0:
                # getCompany returns {message, data: [{company_id, ...}]}
                # Find hostbay company
                for company in company_data["data"]:
                    if company.get("company_name") == "hostbay" or company.get("name") == "hostbay":
                        company_id = company.get("company_id") or company.get("id")
                        break
                # If not found by name, just use the first one
                if not company_id:
                    company_id = company_data["data"][0].get("company_id") or company_data["data"][0].get("id")
            elif isinstance(company_data["data"], dict):
                company_id = company_data["data"].get("company_id") or company_data["data"].get("id")
        elif "company_id" in company_data:
            company_id = company_data["company_id"]
        elif "id" in company_data:
            company_id = company_data["id"]
    
    if not company_id:
        results.add_fail("Wallet Get All Transactions", f"Could not find company_id. Response status: {company_response.status_code}, keys: {list(company_data.keys()) if isinstance(company_data, dict) else 'not dict'}")
        return {}
    
    print(f"Company ID: {company_id}")
    
    # Now get transactions
    print("\nFetching transactions...")
    response = requests.post(
        f"{BASE_URL}/api/wallet/getAllTransactions",
        json={"company_id": company_id, "page": 1, "limit": 25},
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "x-csrf-token": csrf_token,
            "Cookie": cookie_header
        }
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        results.add_fail("Wallet Get All Transactions", f"HTTP {response.status_code}: {response.text[:200]}")
        return {}
    
    data = response.json()
    
    # Find transactions in response - Wallet format: {message, data: {customers_transactions: [...], self_transactions: [...]}}
    transactions = []
    if isinstance(data, list):
        transactions = data
    elif isinstance(data, dict):
        if "data" in data and isinstance(data["data"], dict):
            # Wallet endpoint returns customers_transactions and self_transactions
            if "customers_transactions" in data["data"]:
                transactions = data["data"]["customers_transactions"]
                # Also include self_transactions if present
                if "self_transactions" in data["data"] and isinstance(data["data"]["self_transactions"], list):
                    transactions.extend(data["data"]["self_transactions"])
            elif "transactions" in data["data"]:
                transactions = data["data"]["transactions"]
        elif "data" in data and isinstance(data["data"], list):
            transactions = data["data"]
        elif "transactions" in data:
            transactions = data["transactions"]
    
    print(f"Found {len(transactions)} transactions")
    
    if len(transactions) == 0:
        results.add_warning("Wallet Get All Transactions", "No transactions returned (empty dataset)")
        return {}
    
    # Validate each transaction
    type_counts = Counter()
    valid_count = 0
    api_type_count = 0
    
    for i, tx in enumerate(transactions):
        tx_id = tx.get("id") or tx.get("transaction_id") or f"tx_{i}"
        
        if "source" not in tx:
            results.add_fail(f"Wallet - Transaction {tx_id}", "Missing 'source' field")
            continue
        
        source = tx["source"]
        
        if validate_source_object(source, tx_id, results, "Wallet"):
            valid_count += 1
            type_counts[source["type"]] += 1
            
            # Check for API-origin transactions
            customer_email = tx.get("customer_email") or tx.get("buyer_email") or ""
            if (customer_email.endswith("@dynopay.internal") or
                customer_email.startswith("legacy-api-") or
                customer_email.startswith("pk-buyer-") or
                customer_email.startswith("elements-buyer-") or
                customer_email.startswith("recovered-")):
                if source["type"] == "api":
                    api_type_count += 1
                else:
                    results.add_warning(
                        f"Wallet - Transaction {tx_id}",
                        f"API-origin email '{customer_email}' but source.type is '{source['type']}' (expected 'api')"
                    )
    
    # Summary
    print(f"\nValidation Results:")
    print(f"  Valid: {valid_count}/{len(transactions)}")
    print(f"  API-origin transactions with type='api': {api_type_count}")
    print(f"  Source Type Distribution:")
    for source_type, count in type_counts.most_common():
        print(f"    {source_type}: {count}")
    
    if valid_count == len(transactions):
        results.add_pass(
            "Wallet Get All Transactions",
            f"All {len(transactions)} transactions have valid source objects. Distribution: {dict(type_counts)}"
        )
    
    return dict(type_counts)

def test_company_get_transactions(access_token: str, results: TestResults) -> Dict[str, int]:
    """
    Test GET /api/company/getTransactions/<company_id>?limit=25
    Returns count per source.type
    """
    print("\n" + "="*80)
    print("TEST C: GET /api/company/getTransactions/<company_id>?limit=25")
    print("="*80)
    
    # First, get company_id
    print("Getting company_id...")
    company_response = requests.get(
        f"{BASE_URL}/api/company/getCompany",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    print(f"Company endpoint status: {company_response.status_code}")
    
    company_data = company_response.json()
    
    # Find company_id
    company_id = None
    if isinstance(company_data, dict):
        if "data" in company_data:
            if isinstance(company_data["data"], list) and len(company_data["data"]) > 0:
                # getCompany returns {message, data: [{company_id, ...}]}
                company_id = company_data["data"][0].get("company_id") or company_data["data"][0].get("id")
            elif isinstance(company_data["data"], dict):
                company_id = company_data["data"].get("company_id") or company_data["data"].get("id")
        elif "company_id" in company_data:
            company_id = company_data["company_id"]
        elif "id" in company_data:
            company_id = company_data["id"]
    
    if not company_id:
        results.add_fail("Company Get Transactions", f"Could not find company_id in response")
        return {}
    
    print(f"Company ID: {company_id}")
    
    # Now get transactions
    print("\nFetching transactions...")
    response = requests.get(
        f"{BASE_URL}/api/company/getTransactions/{company_id}?limit=25",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        results.add_warning("Company Get Transactions", f"Endpoint may not be reachable: HTTP {response.status_code}")
        return {}
    
    data = response.json()
    
    # Find transactions in response
    transactions = []
    if isinstance(data, list):
        transactions = data
    elif isinstance(data, dict):
        if "data" in data:
            if isinstance(data["data"], list):
                transactions = data["data"]
            elif isinstance(data["data"], dict) and "transactions" in data["data"]:
                transactions = data["data"]["transactions"]
        elif "transactions" in data:
            transactions = data["transactions"]
    
    print(f"Found {len(transactions)} transactions")
    
    if len(transactions) == 0:
        results.add_warning("Company Get Transactions", "No transactions returned (empty dataset)")
        return {}
    
    # Validate each transaction
    type_counts = Counter()
    valid_count = 0
    
    for i, tx in enumerate(transactions):
        tx_id = tx.get("id") or tx.get("transaction_id") or f"tx_{i}"
        
        if "source" not in tx:
            results.add_fail(f"Company - Transaction {tx_id}", "Missing 'source' field")
            continue
        
        source = tx["source"]
        
        if validate_source_object(source, tx_id, results, "Company"):
            valid_count += 1
            type_counts[source["type"]] += 1
    
    # Summary
    print(f"\nValidation Results:")
    print(f"  Valid: {valid_count}/{len(transactions)}")
    print(f"  Source Type Distribution:")
    for source_type, count in type_counts.most_common():
        print(f"    {source_type}: {count}")
    
    if valid_count == len(transactions):
        results.add_pass(
            "Company Get Transactions",
            f"All {len(transactions)} transactions have valid source objects. Distribution: {dict(type_counts)}"
        )
    
    return dict(type_counts)

def main():
    print("="*80)
    print("DYNOPAY TRANSACTION SOURCE REFACTOR - BACKEND API TESTING")
    print("STRICT READ-ONLY on LIVE PRODUCTION DATABASE")
    print("="*80)
    
    results = TestResults()
    
    try:
        # Authenticate
        csrf_token, cookie_header, access_token = authenticate()
        
        # Test A: Dashboard recent transactions
        dashboard_counts = test_dashboard_recent_transactions(access_token, results)
        
        # Test B: Wallet get all transactions
        wallet_counts = test_wallet_get_all_transactions(access_token, csrf_token, cookie_header, results)
        
        # Test C: Company get transactions
        company_counts = test_company_get_transactions(access_token, results)
        
        # Print summary
        results.print_summary()
        
        # Print consolidated type distribution
        print("\n" + "="*80)
        print("CONSOLIDATED SOURCE TYPE DISTRIBUTION")
        print("="*80)
        print(f"\nDashboard Recent Transactions: {dashboard_counts}")
        print(f"Wallet Get All Transactions: {wallet_counts}")
        print(f"Company Get Transactions: {company_counts}")
        print("\n" + "="*80)
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        results.add_fail("Test Execution", str(e))
        results.print_summary()
        return 1
    
    return 0 if not results.failed else 1

if __name__ == "__main__":
    exit(main())
