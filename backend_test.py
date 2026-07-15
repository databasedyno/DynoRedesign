#!/usr/bin/env python3
"""
DynoPay API Backend Test - Format 3 Company Update Fix Verification
Session 51 - 2026-07-15

NARROW RE-TEST: Verify that PUT /api/company/updateCompany/:id now correctly
persists contact_first_name and contact_last_name when individual top-level
fields (first_name, last_name) are sent as multipart/form-data or url-encoded
(Format 3), NOT wrapped in a JSON `data` object.

Base URL: https://5a08d09d-24f7-4f72-942d-454f2d1c9727.preview.emergentagent.com
Auth: GET /api/csrf-token → POST /api/user/login → JWT Bearer token
Test account: hostbay@moxx.co / Katiekendra123@
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://5a08d09d-24f7-4f72-942d-454f2d1c9727.preview.emergentagent.com"
TEST_EMAIL = "hostbay@moxx.co"
TEST_PASSWORD = "Katiekendra123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log(msg: str, color: str = Colors.RESET):
    print(f"{color}{msg}{Colors.RESET}")

def log_success(msg: str):
    log(f"✅ {msg}", Colors.GREEN)

def log_error(msg: str):
    log(f"❌ {msg}", Colors.RED)

def log_info(msg: str):
    log(f"ℹ️  {msg}", Colors.BLUE)

def log_warning(msg: str):
    log(f"⚠️  {msg}", Colors.YELLOW)

class DynoPayAPITest:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token: Optional[str] = None
        self.jwt_token: Optional[str] = None
        self.account_name: Optional[str] = None
        self.test_company_id: Optional[int] = None
        self.test_results = []

    def get_csrf_token(self) -> bool:
        """Step 1: Get CSRF token"""
        log_info("Step 1: Getting CSRF token...")
        try:
            resp = self.session.get(f"{BASE_URL}/api/csrf-token", timeout=15)
            if resp.status_code != 200:
                log_error(f"CSRF token request failed: {resp.status_code}")
                return False
            
            data = resp.json()
            self.csrf_token = data.get("csrf_token")
            if not self.csrf_token:
                log_error("No csrf_token in response")
                return False
            
            log_success(f"CSRF token obtained: {self.csrf_token[:20]}...")
            return True
        except Exception as e:
            log_error(f"CSRF token request exception: {e}")
            return False

    def login(self) -> bool:
        """Step 2: Login and get JWT"""
        log_info("Step 2: Logging in as hostbay...")
        try:
            headers = {
                "x-csrf-token": self.csrf_token,
                "Content-Type": "application/json"
            }
            payload = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
            
            resp = self.session.post(
                f"{BASE_URL}/api/user/login",
                json=payload,
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Login failed: {resp.status_code} - {resp.text[:200]}")
                return False
            
            data = resp.json()
            self.jwt_token = data.get("data", {}).get("accessToken")
            if not self.jwt_token:
                log_error("No accessToken in login response")
                return False
            
            log_success(f"Login successful, JWT: {self.jwt_token[:30]}...")
            return True
        except Exception as e:
            log_error(f"Login exception: {e}")
            return False

    def get_profile(self) -> bool:
        """Get user profile to capture account name"""
        log_info("Getting user profile to capture account name...")
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            resp = self.session.get(
                f"{BASE_URL}/api/user/profile",
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Profile request failed: {resp.status_code}")
                return False
            
            data = resp.json()
            profile = data.get("data", {})
            self.account_name = profile.get("name", "")
            log_success(f"Account name: '{self.account_name}'")
            return True
        except Exception as e:
            log_error(f"Profile request exception: {e}")
            return False

    def create_test_company(self) -> bool:
        """Step 3: Create throwaway company with Format 3 (individual fields)"""
        log_info("Step 3: Creating test company with Format 3 (individual fields)...")
        
        timestamp = int(time.time())
        company_name = f"QA UpdFix {timestamp}"
        email = f"qa.updfix.{timestamp}@dynopaytest.com"
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            # Format 3: Individual top-level fields (multipart/form-data)
            data = {
                "company_name": company_name,
                "email": email,
                "first_name": "Dan",
                "last_name": "Davis"
            }
            
            resp = self.session.post(
                f"{BASE_URL}/api/company/addCompany",
                data=data,  # multipart/form-data
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Company creation failed: {resp.status_code} - {resp.text[:300]}")
                return False
            
            result = resp.json()
            company_data = result.get("data", {})
            self.test_company_id = company_data.get("company_id")
            
            if not self.test_company_id:
                log_error("No company_id in response")
                return False
            
            log_success(f"Test company created: ID={self.test_company_id}, name='{company_name}'")
            
            # Verify initial contact fields
            contact_first = company_data.get("contact_first_name")
            contact_last = company_data.get("contact_last_name")
            
            if contact_first == "Dan" and contact_last == "Davis":
                log_success(f"Initial contact fields correct: first='{contact_first}', last='{contact_last}'")
                return True
            else:
                log_error(f"Initial contact fields WRONG: first='{contact_first}', last='{contact_last}'")
                return False
                
        except Exception as e:
            log_error(f"Company creation exception: {e}")
            return False

    def verify_company_contact_fields(self, expected_first: str, expected_last: str) -> bool:
        """Verify company contact fields via GET /api/company/getCompany"""
        log_info(f"Verifying contact fields (expecting first='{expected_first}', last='{expected_last}')...")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            resp = self.session.get(
                f"{BASE_URL}/api/company/getCompany",
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Get company failed: {resp.status_code}")
                return False
            
            result = resp.json()
            companies = result.get("data", [])
            
            # Find our test company
            test_company = None
            for company in companies:
                if company.get("company_id") == self.test_company_id:
                    test_company = company
                    break
            
            if not test_company:
                log_error(f"Test company {self.test_company_id} not found in response")
                return False
            
            actual_first = test_company.get("contact_first_name")
            actual_last = test_company.get("contact_last_name")
            
            log_info(f"Actual contact fields: first='{actual_first}', last='{actual_last}'")
            
            if actual_first == expected_first and actual_last == expected_last:
                log_success(f"Contact fields match expected values ✓")
                return True
            else:
                log_error(f"Contact fields MISMATCH: expected ('{expected_first}', '{expected_last}'), got ('{actual_first}', '{actual_last}')")
                return False
                
        except Exception as e:
            log_error(f"Verify company exception: {e}")
            return False

    def update_company_format3(self) -> bool:
        """Step 4: PRIMARY TEST - Update company with Format 3 (individual fields)"""
        log_info("Step 4: PRIMARY TEST - Updating company with Format 3 (first_name='Erin', last_name='Evans')...")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            # Format 3: Individual top-level fields sent as multipart/form-data
            # Using files={} forces multipart/form-data encoding
            data = {
                "first_name": "Erin",
                "last_name": "Evans"
            }
            
            resp = self.session.put(
                f"{BASE_URL}/api/company/updateCompany/{self.test_company_id}",
                data=data,
                files={},  # Force multipart/form-data encoding
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Company update failed: {resp.status_code} - {resp.text[:300]}")
                return False
            
            result = resp.json()
            log_success(f"Company update returned 200: {result.get('message', '')}")
            
            # Now verify the fields were actually persisted
            return self.verify_company_contact_fields("Erin", "Evans")
                
        except Exception as e:
            log_error(f"Company update exception: {e}")
            return False

    def verify_account_name_unchanged(self) -> bool:
        """Step 5: Verify account name is still unchanged"""
        log_info("Step 5: Verifying account name is unchanged...")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            resp = self.session.get(
                f"{BASE_URL}/api/user/profile",
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Profile request failed: {resp.status_code}")
                return False
            
            data = resp.json()
            profile = data.get("data", {})
            current_name = profile.get("name", "")
            
            if current_name == self.account_name:
                log_success(f"Account name unchanged: '{current_name}' ✓")
                return True
            else:
                log_error(f"Account name CHANGED: was '{self.account_name}', now '{current_name}'")
                return False
                
        except Exception as e:
            log_error(f"Account name verification exception: {e}")
            return False

    def cleanup_test_company(self) -> bool:
        """Step 6: Delete test company"""
        log_info("Step 6: Cleaning up - deleting test company...")
        
        if not self.test_company_id:
            log_warning("No test company to delete")
            return True
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            resp = self.session.delete(
                f"{BASE_URL}/api/company/deleteCompany/{self.test_company_id}",
                headers=headers,
                timeout=15
            )
            
            if resp.status_code == 200:
                log_success(f"Test company {self.test_company_id} deleted successfully")
                return True
            elif resp.status_code == 400:
                # Might be the only company
                log_warning(f"Cannot delete (might be only company): {resp.text[:200]}")
                return True
            else:
                log_error(f"Delete failed: {resp.status_code} - {resp.text[:200]}")
                return False
                
        except Exception as e:
            log_error(f"Cleanup exception: {e}")
            return False

    def run_test(self) -> bool:
        """Run the complete test sequence"""
        log(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        log(f"{Colors.BOLD}DynoPay Format 3 Company Update Fix - Narrow Re-Test{Colors.RESET}")
        log(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
        
        # Step 1: Get CSRF token
        if not self.get_csrf_token():
            return False
        
        # Step 2: Login
        if not self.login():
            return False
        
        # Get initial account name
        if not self.get_profile():
            return False
        
        # Step 3: Create test company with Format 3
        if not self.create_test_company():
            return False
        
        # Step 4: PRIMARY TEST - Update with Format 3
        format3_success = self.update_company_format3()
        
        # Step 5: Verify account name unchanged
        account_name_ok = self.verify_account_name_unchanged()
        
        # Step 6: Cleanup
        cleanup_ok = self.cleanup_test_company()
        
        # Final report
        log(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        log(f"{Colors.BOLD}TEST RESULTS{Colors.RESET}")
        log(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
        
        if format3_success:
            log_success("PRIMARY ASSERTION: Format 3 update now persists contact fields ✓")
        else:
            log_error("PRIMARY ASSERTION: Format 3 update FAILED to persist contact fields ✗")
        
        if account_name_ok:
            log_success("SECONDARY ASSERTION: Account name unchanged ✓")
        else:
            log_error("SECONDARY ASSERTION: Account name was modified ✗")
        
        if cleanup_ok:
            log_success("CLEANUP: Test company deleted ✓")
        else:
            log_warning("CLEANUP: Test company may still exist (manual cleanup needed)")
        
        overall_pass = format3_success and account_name_ok
        
        log(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        if overall_pass:
            log(f"{Colors.BOLD}{Colors.GREEN}OVERALL: PASS ✅{Colors.RESET}")
        else:
            log(f"{Colors.BOLD}{Colors.RED}OVERALL: FAIL ❌{Colors.RESET}")
        log(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
        
        return overall_pass

def main():
    test = DynoPayAPITest()
    success = test.run_test()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
