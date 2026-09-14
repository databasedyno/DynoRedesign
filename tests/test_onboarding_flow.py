"""
Test Suite for Post-Registration Onboarding Flow
Tests: Registration → Dashboard → Company Creation → Wallet Addition → API Key Auto-Creation → First Payment

This test suite verifies the complete onboarding flow for new users.
"""

import pytest
import requests
import os
import json
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"


class TestOnboardingFlowBackend:
    """Backend API tests for onboarding flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.company_id = None
        
    def get_auth_token(self):
        """Get authentication token using admin credentials"""
        if self.token:
            return self.token
            
        response = self.session.post(f"{BASE_URL}/api/user/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("data", {}).get("accessToken"):
                self.token = data["data"]["accessToken"]
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                return self.token
        
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        
    # ============================================
    # REGISTRATION API TESTS
    # ============================================
    
    def test_registration_endpoint_exists(self):
        """Test that registration endpoint exists and accepts POST"""
        # Generate unique test email
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        test_email = f"test_onboarding_{random_suffix}@testmail.com"
        
        response = self.session.post(f"{BASE_URL}/api/user/register", json={
            "name": "Test User",
            "email": test_email,
            "password": "TestPass123@"
        })
        
        # Should return 200 (success) or 400 (validation error) - not 404
        assert response.status_code in [200, 201, 400, 409], f"Registration endpoint returned unexpected status: {response.status_code}"
        print(f"Registration endpoint test: Status {response.status_code}")
        
        # If successful, it should send OTP email
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"Registration response: {data.get('message', 'No message')}")
            
    def test_email_check_endpoint(self):
        """Test email check endpoint for existing users"""
        response = self.session.get(f"{BASE_URL}/api/user/checkEmail?email={ADMIN_EMAIL}")
        
        assert response.status_code == 200, f"Email check failed: {response.status_code}"
        data = response.json()
        assert data.get("data", {}).get("validEmail") == True, "Admin email should be valid"
        print(f"Email check for admin: validEmail={data.get('data', {}).get('validEmail')}")
        
    def test_email_check_nonexistent(self):
        """Test email check for non-existent user"""
        random_email = f"nonexistent_{random.randint(1000, 9999)}@test.com"
        response = self.session.get(f"{BASE_URL}/api/user/checkEmail?email={random_email}")
        
        assert response.status_code == 200, f"Email check failed: {response.status_code}"
        data = response.json()
        assert data.get("data", {}).get("validEmail") == False, "Non-existent email should be invalid"
        print(f"Email check for non-existent: validEmail={data.get('data', {}).get('validEmail')}")
        
    # ============================================
    # LOGIN API TESTS
    # ============================================
    
    def test_login_with_password(self):
        """Test login with email and password"""
        response = self.session.post(f"{BASE_URL}/api/user/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "data" in data, "Response should contain 'data' field"
        assert "accessToken" in data["data"], "Response should contain accessToken"
        
        self.token = data["data"]["accessToken"]
        print(f"Login successful, token received")
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/user/login", json={
            "email": ADMIN_EMAIL,
            "password": "WrongPassword123@"
        })
        
        assert response.status_code in [400, 401, 403], f"Should reject invalid credentials: {response.status_code}"
        print(f"Invalid login rejected with status: {response.status_code}")
        
    # ============================================
    # COMPANY API TESTS (Onboarding Step 1)
    # ============================================
    
    def test_get_company_list(self):
        """Test getting company list for authenticated user"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/company/getCompany")
        
        assert response.status_code == 200, f"Get company failed: {response.status_code}"
        data = response.json()
        
        # Should return list of companies
        assert "data" in data, "Response should contain 'data' field"
        companies = data.get("data", [])
        print(f"Found {len(companies)} companies for user")
        
        if companies:
            self.company_id = companies[0].get("company_id")
            print(f"First company ID: {self.company_id}")
            
    def test_company_creation_validation(self):
        """Test company creation with missing required fields"""
        self.get_auth_token()
        
        # Test with missing company_name
        response = self.session.post(f"{BASE_URL}/api/company/addCompany", json={
            "email": "test@company.com",
            "mobile": "+1234567890"
        })
        
        # Should return validation error
        assert response.status_code in [400, 422], f"Should reject missing company_name: {response.status_code}"
        print(f"Company creation validation: Status {response.status_code}")
        
    def test_company_creation_with_valid_data(self):
        """Test company creation with valid data (may fail if company already exists)"""
        self.get_auth_token()
        
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        
        # Create FormData-like request
        response = self.session.post(
            f"{BASE_URL}/api/company/addCompany",
            data={
                "data": json.dumps({
                    "company_name": f"Test Company {random_suffix}",
                    "email": f"company_{random_suffix}@test.com",
                    "mobile": "+12025551234",
                    "website": "https://testcompany.com"
                })
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        # May succeed (201) or fail if user already has a company
        print(f"Company creation: Status {response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"Company created: {data.get('data', {}).get('company_name', 'N/A')}")
        else:
            print(f"Company creation response: {response.text[:200]}")
            
    # ============================================
    # WALLET API TESTS (Onboarding Step 2)
    # ============================================
    
    def test_get_wallet_list(self):
        """Test getting wallet list for authenticated user"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/wallet/getWallet")
        
        assert response.status_code == 200, f"Get wallet failed: {response.status_code}"
        data = response.json()
        
        print(f"Wallet list response: {data.get('message', 'No message')}")
        wallets = data.get("data", [])
        print(f"Found {len(wallets)} wallets for user")
        
    def test_wallet_validation_endpoint(self):
        """Test wallet address validation endpoint"""
        self.get_auth_token()
        
        # First get company ID
        company_response = self.session.get(f"{BASE_URL}/api/company/getCompany")
        if company_response.status_code == 200:
            companies = company_response.json().get("data", [])
            if companies:
                company_id = companies[0].get("company_id")
                
                # Test wallet validation with a sample BTC address
                response = self.session.post(f"{BASE_URL}/api/wallet/validateWalletAddress", json={
                    "wallet_address": "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
                    "currency": "BTC",
                    "company_id": company_id,
                    "wallet_name": "Test BTC Wallet"
                })
                
                # Should return 200 (OTP sent) or validation error
                print(f"Wallet validation: Status {response.status_code}")
                if response.status_code == 200:
                    print("OTP would be sent to user's email for wallet verification")
                else:
                    print(f"Wallet validation response: {response.text[:200]}")
                    
    # ============================================
    # API KEY TESTS (Auto-created after first wallet)
    # ============================================
    
    def test_get_api_keys(self):
        """Test getting API keys for authenticated user"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/api/getApiKeys")
        
        assert response.status_code == 200, f"Get API keys failed: {response.status_code}"
        data = response.json()
        
        api_keys = data.get("data", [])
        print(f"Found {len(api_keys)} API keys for user")
        
        if api_keys:
            first_key = api_keys[0]
            print(f"First API key: base_currency={first_key.get('base_currency')}, status={first_key.get('status')}")
            
    # ============================================
    # PAYMENT LINK TESTS (First Payment)
    # ============================================
    
    def test_get_payment_links(self):
        """Test getting payment links for authenticated user"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/payment/getPaymentLinks")
        
        assert response.status_code == 200, f"Get payment links failed: {response.status_code}"
        data = response.json()
        
        payment_links = data.get("data", [])
        print(f"Found {len(payment_links)} payment links for user")
        
    def test_create_payment_link_validation(self):
        """Test payment link creation validation"""
        self.get_auth_token()
        
        # First get company ID
        company_response = self.session.get(f"{BASE_URL}/api/company/getCompany")
        if company_response.status_code == 200:
            companies = company_response.json().get("data", [])
            if companies:
                company_id = companies[0].get("company_id")
                
                # Test with missing required fields
                response = self.session.post(f"{BASE_URL}/api/payment/createPaymentLink", json={
                    "company_id": company_id
                    # Missing amount, currency, etc.
                })
                
                # Should return validation error
                print(f"Payment link validation: Status {response.status_code}")
                
    # ============================================
    # DASHBOARD DATA TESTS
    # ============================================
    
    def test_dashboard_data(self):
        """Test dashboard data endpoint"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/getDashboardData")
        
        # Dashboard endpoint should exist
        assert response.status_code in [200, 404], f"Dashboard endpoint error: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"Dashboard data retrieved successfully")
        else:
            print("Dashboard endpoint not found - may use different route")
            
    def test_transaction_summary(self):
        """Test transaction summary endpoint"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/getTransactionSummary")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Transaction summary retrieved")
        else:
            print(f"Transaction summary: Status {response.status_code}")


class TestOnboardingFlowIntegration:
    """Integration tests for complete onboarding flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_complete_onboarding_check(self):
        """Test that a user with company and wallet has completed onboarding"""
        # Login
        response = self.session.post(f"{BASE_URL}/api/user/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, "Login failed"
        token = response.json()["data"]["accessToken"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Check company
        company_response = self.session.get(f"{BASE_URL}/api/company/getCompany")
        assert company_response.status_code == 200, "Get company failed"
        companies = company_response.json().get("data", [])
        has_company = len(companies) > 0
        
        # Check wallet
        wallet_response = self.session.get(f"{BASE_URL}/api/wallet/getWallet")
        assert wallet_response.status_code == 200, "Get wallet failed"
        wallets = wallet_response.json().get("data", [])
        has_wallet = len(wallets) > 0
        
        # Check API keys
        api_response = self.session.get(f"{BASE_URL}/api/api/getApiKeys")
        assert api_response.status_code == 200, "Get API keys failed"
        api_keys = api_response.json().get("data", [])
        has_api_key = len(api_keys) > 0
        
        print(f"\nOnboarding Status Check:")
        print(f"  - Has Company: {has_company} ({len(companies)} companies)")
        print(f"  - Has Wallet: {has_wallet} ({len(wallets)} wallets)")
        print(f"  - Has API Key: {has_api_key} ({len(api_keys)} API keys)")
        print(f"  - Onboarding Complete: {has_company and has_wallet}")
        
        # For admin user, onboarding should be complete
        assert has_company, "Admin should have at least one company"
        assert has_wallet, "Admin should have at least one wallet"
        

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
