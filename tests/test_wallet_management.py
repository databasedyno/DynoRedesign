"""
Test suite for Customer Wallet Management APIs
Tests: POST /api/admin/customers/:customerId/credit
       POST /api/admin/customers/:customerId/debit

Both endpoints support dual authentication:
- Admin JWT token (from dashboard)
- API key (x-api-key header) for programmatic access
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_WALLET_"

# Credentials
ADMIN_EMAIL = "moxxcompany@gmail.com"
ADMIN_PASSWORD = "Katiekendra123@"
USER_EMAIL = "nomadly@moxx.co"
USER_PASSWORD = "Katiekendra123@"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin JWT token"""
    response = requests.post(
        f"{BASE_URL}/api/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("data", {}).get("accessToken")
    pytest.skip("Admin login failed - skipping admin tests")


@pytest.fixture(scope="module")
def user_token():
    """Get user JWT token for accessing customers"""
    response = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("data", {}).get("accessToken")
    pytest.skip("User login failed - skipping user tests")


@pytest.fixture(scope="module")
def api_key(user_token):
    """Get API key from user's API page"""
    response = requests.get(
        f"{BASE_URL}/api/userApi/api-settings",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    if response.status_code == 200:
        data = response.json()
        api_data = data.get("data", [])
        if api_data and len(api_data) > 0:
            return api_data[0].get("api_key")
    # Return None if no API key found
    return None


@pytest.fixture(scope="module")
def test_customer_id(user_token):
    """Get a test customer ID from the customers list"""
    response = requests.get(
        f"{BASE_URL}/api/userApi/customers",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    if response.status_code == 200:
        data = response.json()
        customers = data.get("data", {}).get("customers", [])
        if customers:
            # Return the numeric customer_id
            return customers[0].get("customer_id")
    pytest.skip("No customers found - skipping wallet tests")


class TestAdminWalletCredit:
    """Tests for POST /api/admin/customers/:customerId/credit"""

    def test_credit_wallet_with_admin_jwt_success(self, admin_token, test_customer_id):
        """Test credit wallet with valid admin JWT token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 10.00,
                "description": f"{TEST_PREFIX}Credit test from admin JWT"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # API returns {message, data} without success field on 200
        assert "Wallet credited successfully" in data.get("message", "")
        
        # Validate response data structure
        result = data.get("data", {})
        assert "customer_id" in result
        assert "previous_balance" in result
        assert "amount_credited" in result
        assert "new_balance" in result
        assert "currency" in result
        assert float(result.get("amount_credited", 0)) == 10.00
        print(f"SUCCESS: Credited {result['amount_credited']} {result['currency']} to customer {result['customer_id']}")

    def test_credit_wallet_with_api_key_success(self, api_key, test_customer_id):
        """Test credit wallet with valid API key"""
        if not api_key:
            pytest.skip("No API key available - skipping API key test")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
            json={
                "amount": 5.50,
                "description": f"{TEST_PREFIX}Credit test from API key"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # API returns {message, data} without success field on 200
        assert "Wallet credited successfully" in data.get("message", "")
        print(f"SUCCESS: API key credit - {data.get('data', {}).get('amount_credited')} {data.get('data', {}).get('currency')}")

    def test_credit_wallet_invalid_amount_zero(self, admin_token, test_customer_id):
        """Test credit wallet with zero amount - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 0,
                "description": "Test zero amount"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        assert "positive amount" in data.get("message", "").lower()
        print(f"SUCCESS: Zero amount correctly rejected: {data.get('message')}")

    def test_credit_wallet_invalid_amount_negative(self, admin_token, test_customer_id):
        """Test credit wallet with negative amount - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": -50,
                "description": "Test negative amount"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        print(f"SUCCESS: Negative amount correctly rejected: {data.get('message')}")

    def test_credit_wallet_missing_description(self, admin_token, test_customer_id):
        """Test credit wallet without description - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 10,
                "description": ""
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        assert "description" in data.get("message", "").lower()
        print(f"SUCCESS: Missing description correctly rejected: {data.get('message')}")

    def test_credit_wallet_invalid_customer_id(self, admin_token):
        """Test credit wallet with non-existent customer ID - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/99999999/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 10,
                "description": "Test invalid customer"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        print(f"SUCCESS: Invalid customer correctly rejected: {data.get('message')}")

    def test_credit_wallet_no_auth(self, test_customer_id):
        """Test credit wallet without any authentication - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Content-Type": "application/json"
            },
            json={
                "amount": 10,
                "description": "Test no auth"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: No auth correctly rejected with 403")


class TestAdminWalletDebit:
    """Tests for POST /api/admin/customers/:customerId/debit"""

    def test_debit_wallet_with_admin_jwt_success(self, admin_token, test_customer_id):
        """Test debit wallet with valid admin JWT token"""
        # First, check current balance
        response = requests.get(
            f"{BASE_URL}/api/userApi/customer/{test_customer_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Now attempt a small debit
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 1.00,
                "description": f"{TEST_PREFIX}Debit test from admin JWT"
            }
        )
        
        # Either success (200) or insufficient balance (400)
        if response.status_code == 200:
            data = response.json()
            # API returns {message, data} without success field on 200
            assert "Wallet debited successfully" in data.get("message", "")
            result = data.get("data", {})
            assert "customer_id" in result
            assert "previous_balance" in result
            assert "amount_debited" in result
            assert "new_balance" in result
            assert "currency" in result
            print(f"SUCCESS: Debited {result['amount_debited']} {result['currency']} from customer {result['customer_id']}")
        elif response.status_code == 400:
            data = response.json()
            assert "Insufficient balance" in data.get("message", "")
            print(f"SUCCESS: Insufficient balance correctly handled: {data.get('message')}")
        else:
            pytest.fail(f"Unexpected status code {response.status_code}: {response.text}")

    def test_debit_wallet_with_api_key_success(self, api_key, test_customer_id):
        """Test debit wallet with valid API key"""
        if not api_key:
            pytest.skip("No API key available - skipping API key test")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
            json={
                "amount": 0.50,
                "description": f"{TEST_PREFIX}Debit test from API key"
            }
        )
        
        # Either success or insufficient balance
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        data = response.json()
        if response.status_code == 200:
            # API returns {message, data} without success field on 200
            assert "Wallet debited successfully" in data.get("message", "")
            print(f"SUCCESS: API key debit - {data.get('data', {}).get('amount_debited')} {data.get('data', {}).get('currency')}")
        else:
            print(f"SUCCESS: API key debit - Insufficient balance correctly handled")

    def test_debit_wallet_invalid_amount_zero(self, admin_token, test_customer_id):
        """Test debit wallet with zero amount - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 0,
                "description": "Test zero amount"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        print(f"SUCCESS: Zero amount correctly rejected for debit: {data.get('message')}")

    def test_debit_wallet_invalid_amount_negative(self, admin_token, test_customer_id):
        """Test debit wallet with negative amount - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": -100,
                "description": "Test negative amount"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        print(f"SUCCESS: Negative amount correctly rejected for debit: {data.get('message')}")

    def test_debit_wallet_missing_description(self, admin_token, test_customer_id):
        """Test debit wallet without description - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 10,
                "description": "   "  # whitespace-only
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        print(f"SUCCESS: Missing description correctly rejected for debit: {data.get('message')}")

    def test_debit_wallet_insufficient_balance(self, admin_token, test_customer_id):
        """Test debit wallet with amount exceeding balance - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 999999999.99,
                "description": "Test excessive amount"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        assert "Insufficient balance" in data.get("message", "")
        print(f"SUCCESS: Insufficient balance correctly rejected: {data.get('message')}")

    def test_debit_wallet_invalid_customer_id(self, admin_token):
        """Test debit wallet with non-existent customer ID - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/99999999/debit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 10,
                "description": "Test invalid customer"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == False
        print(f"SUCCESS: Invalid customer correctly rejected for debit: {data.get('message')}")

    def test_debit_wallet_no_auth(self, test_customer_id):
        """Test debit wallet without any authentication - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/debit",
            headers={
                "Content-Type": "application/json"
            },
            json={
                "amount": 10,
                "description": "Test no auth"
            }
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: No auth correctly rejected for debit with 403")


class TestWalletAtomicOperations:
    """Tests for verifying atomic balance updates and transaction logging"""

    def test_credit_creates_transaction_record(self, admin_token, user_token, test_customer_id):
        """Test that credit operation creates a CREDIT transaction record"""
        # Credit the wallet
        credit_response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": 25.00,
                "description": f"{TEST_PREFIX}Transaction logging test"
            }
        )
        
        assert credit_response.status_code == 200, f"Credit failed: {credit_response.text}"
        
        # Verify transaction was logged by fetching customer details
        time.sleep(0.5)  # Small delay for consistency
        
        detail_response = requests.get(
            f"{BASE_URL}/api/userApi/customer/{test_customer_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert detail_response.status_code == 200, f"Get customer failed: {detail_response.text}"
        
        data = detail_response.json()
        transactions = data.get("data", {}).get("transactions", {}).get("data", [])
        
        # Check if there's a recent CREDIT transaction
        credit_txns = [t for t in transactions if t.get("transaction_type") == "CREDIT"]
        assert len(credit_txns) > 0, "No CREDIT transaction found after credit operation"
        print(f"SUCCESS: CREDIT transaction record found. Total CREDIT txns: {len(credit_txns)}")

    def test_balance_updates_atomically(self, admin_token, user_token, test_customer_id):
        """Test that balance updates are atomic (credit followed by get shows correct balance)"""
        # First get current balance
        detail_response = requests.get(
            f"{BASE_URL}/api/userApi/customer/{test_customer_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert detail_response.status_code == 200
        
        initial_balance = float(detail_response.json().get("data", {}).get("wallet", {}).get("amount", 0))
        
        # Credit a specific amount
        credit_amount = 15.75
        credit_response = requests.post(
            f"{BASE_URL}/api/admin/customers/{test_customer_id}/credit",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "amount": credit_amount,
                "description": f"{TEST_PREFIX}Atomic balance test"
            }
        )
        
        assert credit_response.status_code == 200
        credit_data = credit_response.json().get("data", {})
        api_new_balance = float(credit_data.get("new_balance", 0))
        
        # Verify via GET
        detail_response2 = requests.get(
            f"{BASE_URL}/api/userApi/customer/{test_customer_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert detail_response2.status_code == 200
        
        db_balance = float(detail_response2.json().get("data", {}).get("wallet", {}).get("amount", 0))
        
        # Verify balance consistency
        expected_balance = initial_balance + credit_amount
        assert abs(api_new_balance - expected_balance) < 0.01, f"API returned wrong balance: expected {expected_balance}, got {api_new_balance}"
        assert abs(db_balance - expected_balance) < 0.01, f"DB balance mismatch: expected {expected_balance}, got {db_balance}"
        
        print(f"SUCCESS: Atomic balance update verified. Initial: {initial_balance}, Added: {credit_amount}, Final: {db_balance}")


class TestDeveloperGuide:
    """Tests for developer integration guide"""

    def test_developer_guide_exists(self):
        """Test that DEVELOPER_INTEGRATION_GUIDE.md exists and is readable"""
        guide_path = "/app/DEVELOPER_INTEGRATION_GUIDE.md"
        
        assert os.path.exists(guide_path), f"Developer guide not found at {guide_path}"
        
        with open(guide_path, "r") as f:
            content = f.read()
        
        # Verify key sections
        assert "# Dynopay API" in content, "Guide missing title"
        assert "Quick Start" in content, "Guide missing Quick Start section"
        assert "Customer Wallet" in content, "Guide missing Customer Wallet section"
        assert "/api/admin/customers" in content, "Guide missing admin wallet endpoints"
        assert "credit" in content.lower(), "Guide missing credit documentation"
        assert "debit" in content.lower(), "Guide missing debit documentation"
        
        print(f"SUCCESS: Developer guide exists and contains required sections ({len(content)} bytes)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
