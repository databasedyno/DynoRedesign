#!/usr/bin/env python3
"""
DynoPay API Backend Test - Mixed Format Company Update Test
Session 51 - 2026-07-15

Test step 4 from review request: Verify mixed update with company_name + first_name + last_name
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://merchant-hub-611.preview.emergentagent.com"
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

class DynoPayMixedUpdateTest:
    def __init__(self):
        self.session = requests.Session()
        self.csrf_token: Optional[str] = None
        self.jwt_token: Optional[str] = None
        self.test_company_id: Optional[int] = None

    def get_csrf_token(self) -> bool:
        log_info("Getting CSRF token...")
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
            
            log_success(f"CSRF token obtained")
            return True
        except Exception as e:
            log_error(f"CSRF token request exception: {e}")
            return False

    def login(self) -> bool:
        log_info("Logging in as hostbay...")
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
                log_error(f"Login failed: {resp.status_code}")
                return False
            
            data = resp.json()
            self.jwt_token = data.get("data", {}).get("accessToken")
            if not self.jwt_token:
                log_error("No accessToken in login response")
                return False
            
            log_success(f"Login successful")
            return True
        except Exception as e:
            log_error(f"Login exception: {e}")
            return False

    def create_test_company(self) -> bool:
        log_info("Creating test company...")
        
        timestamp = int(time.time())
        company_name = f"QA UpdFix2 {timestamp}"
        email = f"qa.updfix2.{timestamp}@dynopaytest.com"
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            data = {
                "company_name": company_name,
                "email": email,
                "first_name": "Dan",
                "last_name": "Davis"
            }
            
            resp = self.session.post(
                f"{BASE_URL}/api/company/addCompany",
                data=data,
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
            return True
                
        except Exception as e:
            log_error(f"Company creation exception: {e}")
            return False

    def verify_company_fields(self, expected_name: str, expected_first: str, expected_last: str) -> bool:
        log_info(f"Verifying company fields...")
        
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
            
            test_company = None
            for company in companies:
                if company.get("company_id") == self.test_company_id:
                    test_company = company
                    break
            
            if not test_company:
                log_error(f"Test company {self.test_company_id} not found")
                return False
            
            actual_name = test_company.get("company_name")
            actual_first = test_company.get("contact_first_name")
            actual_last = test_company.get("contact_last_name")
            
            log_info(f"Actual: name='{actual_name}', first='{actual_first}', last='{actual_last}'")
            log_info(f"Expected: name='{expected_name}', first='{expected_first}', last='{expected_last}'")
            
            if actual_name == expected_name and actual_first == expected_first and actual_last == expected_last:
                log_success(f"All fields match expected values ✓")
                return True
            else:
                log_error(f"Fields MISMATCH")
                return False
                
        except Exception as e:
            log_error(f"Verify company exception: {e}")
            return False

    def update_company_mixed(self) -> bool:
        """Test mixed update: company_name + first_name + last_name"""
        log_info("Testing MIXED update (company_name + first_name + last_name)...")
        
        timestamp = int(time.time())
        new_company_name = f"QA UpdFix2b {timestamp}"
        
        try:
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "x-csrf-token": self.csrf_token
            }
            
            data = {
                "company_name": new_company_name,
                "first_name": "Fran",
                "last_name": "Fisher"
            }
            
            resp = self.session.put(
                f"{BASE_URL}/api/company/updateCompany/{self.test_company_id}",
                data=data,
                files={},  # Force multipart/form-data
                headers=headers,
                timeout=15
            )
            
            if resp.status_code != 200:
                log_error(f"Mixed update failed: {resp.status_code} - {resp.text[:300]}")
                return False
            
            result = resp.json()
            log_success(f"Mixed update returned 200: {result.get('message', '')}")
            
            # Verify all fields persisted
            return self.verify_company_fields(new_company_name, "Fran", "Fisher")
                
        except Exception as e:
            log_error(f"Mixed update exception: {e}")
            return False

    def cleanup_test_company(self) -> bool:
        log_info("Cleaning up - deleting test company...")
        
        if not self.test_company_id:
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
                log_success(f"Test company {self.test_company_id} deleted")
                return True
            else:
                log_error(f"Delete failed: {resp.status_code}")
                return False
                
        except Exception as e:
            log_error(f"Cleanup exception: {e}")
            return False

    def run_test(self) -> bool:
        log(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        log(f"{Colors.BOLD}DynoPay Mixed Format Company Update Test{Colors.RESET}")
        log(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
        
        if not self.get_csrf_token():
            return False
        
        if not self.login():
            return False
        
        if not self.create_test_company():
            return False
        
        # Test mixed update
        mixed_success = self.update_company_mixed()
        
        # Cleanup
        cleanup_ok = self.cleanup_test_company()
        
        # Final report
        log(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        log(f"{Colors.BOLD}TEST RESULTS{Colors.RESET}")
        log(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
        
        if mixed_success:
            log_success("MIXED UPDATE TEST: PASS ✓")
        else:
            log_error("MIXED UPDATE TEST: FAIL ✗")
        
        if cleanup_ok:
            log_success("CLEANUP: Test company deleted ✓")
        
        log(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        if mixed_success:
            log(f"{Colors.BOLD}{Colors.GREEN}OVERALL: PASS ✅{Colors.RESET}")
        else:
            log(f"{Colors.BOLD}{Colors.RED}OVERALL: FAIL ❌{Colors.RESET}")
        log(f"{Colors.BOLD}{'='*80}{Colors.RESET}\n")
        
        return mixed_success

def main():
    test = DynoPayMixedUpdateTest()
    success = test.run_test()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
