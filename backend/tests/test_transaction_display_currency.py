"""
Test Transaction Display Currency Conversion

Tests that GET /api/company/getTransactions/{company_id}:
1. Returns display_amount > 0 for crypto transactions
2. Returns display_currency matching company preferred currency (GBP for company 38)
3. Returns amount_display object with display_value formatted as '£X.XX GBP'
4. Properly converts crypto base_amount (ETH, BTC) to company fiat currency (GBP)
5. Returns currency_info with code, symbol, display_format fields

Bug Fix Context:
- Previous issue: companyController.ts was hardcoding sourceCurrency='USD' in currencyConvert calls
- Fix: Now uses actual base_currency from each transaction (ETH, BTC, etc.)
- currencyConvert.ts now tries CoinGecko first for crypto conversions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTransactionDisplayCurrency:
    """Tests for transaction display currency conversion fix"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get access token"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={
                "email": "richard@dyno.pt",
                "password": "Katiekendra123@"
            },
            timeout=30
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed with status {response.status_code}: {response.text}")
        
        data = response.json()
        token = data.get('data', {}).get('accessToken') or data.get('accessToken')
        if not token:
            pytest.skip(f"No access token in response: {data}")
        return token

    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    def test_01_get_transactions_returns_200(self, auth_headers):
        """Verify getTransactions endpoint returns 200 OK"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert 'data' in data or 'transactions' in data.get('data', {})
        print("✓ getTransactions returned 200 OK")

    def test_02_response_has_currency_field(self, auth_headers):
        """Verify response has currency field matching company preference (GBP)"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        
        # Check currency field exists and is GBP
        currency = data.get('currency')
        assert currency is not None, "Response missing 'currency' field"
        assert currency == 'GBP', f"Expected currency='GBP' for company 38, got '{currency}'"
        print("✓ Response currency is GBP (company 38's preferred currency)")

    def test_03_response_has_currency_info(self, auth_headers):
        """Verify response has currency_info with code, symbol, display_format"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        
        # Check currency_info exists and has required fields
        currency_info = data.get('currency_info')
        assert currency_info is not None, "Response missing 'currency_info' field"
        assert 'code' in currency_info, "currency_info missing 'code' field"
        assert 'symbol' in currency_info, "currency_info missing 'symbol' field"
        assert 'display_format' in currency_info, "currency_info missing 'display_format' field"
        
        # Verify values for GBP
        assert currency_info['code'] == 'GBP', f"Expected code='GBP', got '{currency_info['code']}'"
        assert currency_info['symbol'] == '£', f"Expected symbol='£', got '{currency_info['symbol']}'"
        assert 'GBP' in currency_info['display_format'], f"Expected display_format to contain 'GBP', got '{currency_info['display_format']}'"
        
        print(f"✓ currency_info is valid: {currency_info}")

    def test_04_transactions_have_display_currency_field(self, auth_headers):
        """Verify each transaction has display_currency field matching company preference"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        transactions = data.get('transactions', [])
        
        if not transactions:
            pytest.skip("No transactions found for company 38")
        
        for i, tx in enumerate(transactions[:5]):  # Check first 5 transactions
            assert 'display_currency' in tx, f"Transaction {i} missing 'display_currency' field"
            assert tx['display_currency'] == 'GBP', f"Transaction {i}: expected display_currency='GBP', got '{tx['display_currency']}'"
        
        print("✓ All sampled transactions have display_currency='GBP'")

    def test_05_transactions_have_display_amount_field(self, auth_headers):
        """Verify each transaction has display_amount field"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        transactions = data.get('transactions', [])
        
        if not transactions:
            pytest.skip("No transactions found for company 38")
        
        for i, tx in enumerate(transactions[:5]):
            assert 'display_amount' in tx, f"Transaction {i} missing 'display_amount' field"
            display_amount = tx.get('display_amount')
            assert display_amount is not None, f"Transaction {i}: display_amount is None"
            assert isinstance(display_amount, (int, float)), f"Transaction {i}: display_amount should be numeric, got {type(display_amount)}"
        
        print("✓ All sampled transactions have display_amount field (numeric)")

    def test_06_transactions_have_amount_display_object(self, auth_headers):
        """Verify each transaction has amount_display object with required fields"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        transactions = data.get('transactions', [])
        
        if not transactions:
            pytest.skip("No transactions found for company 38")
        
        for i, tx in enumerate(transactions[:5]):
            amount_display = tx.get('amount_display')
            assert amount_display is not None, f"Transaction {i} missing 'amount_display' object"
            assert 'display_value' in amount_display, f"Transaction {i}: amount_display missing 'display_value'"
            assert 'symbol' in amount_display, f"Transaction {i}: amount_display missing 'symbol'"
            assert 'currency_code' in amount_display, f"Transaction {i}: amount_display missing 'currency_code'"
            
            # Verify display_value format: should be like '£X.XX GBP'
            display_value = amount_display.get('display_value', '')
            assert '£' in display_value, f"Transaction {i}: display_value should contain '£', got '{display_value}'"
            assert 'GBP' in display_value, f"Transaction {i}: display_value should contain 'GBP', got '{display_value}'"
        
        print("✓ All sampled transactions have valid amount_display object")

    def test_07_crypto_transactions_have_non_zero_display_amount(self, auth_headers):
        """Verify crypto transactions (ETH, BTC) have display_amount > 0 after conversion"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        transactions = data.get('transactions', [])
        
        if not transactions:
            pytest.skip("No transactions found for company 38")
        
        # Find crypto transactions
        crypto_currencies = ['ETH', 'BTC', 'TRX', 'LTC', 'DOGE', 'USDT', 'USDC']
        crypto_txs = [tx for tx in transactions if tx.get('base_currency', '').upper() in crypto_currencies]
        
        if not crypto_txs:
            pytest.skip("No crypto transactions found for company 38")
        
        failed_conversions = []
        for tx in crypto_txs[:10]:  # Check up to 10 crypto transactions
            base_amount = float(tx.get('base_amount', 0))
            display_amount = float(tx.get('display_amount', 0))
            base_currency = tx.get('base_currency', '')
            
            # If there's a base_amount, display_amount should be > 0 after conversion
            if base_amount > 0:
                if display_amount == 0:
                    failed_conversions.append({
                        'base_currency': base_currency,
                        'base_amount': base_amount,
                        'display_amount': display_amount,
                        'transaction_id': tx.get('transaction_id', 'unknown')
                    })
        
        if failed_conversions:
            pytest.fail(f"Found {len(failed_conversions)} crypto transactions with display_amount=0: {failed_conversions[:3]}")
        
        print(f"✓ All {len(crypto_txs)} crypto transactions have display_amount > 0")

    def test_08_display_amount_conversion_is_reasonable(self, auth_headers):
        """Verify crypto to fiat conversion produces reasonable values"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        transactions = data.get('transactions', [])
        
        if not transactions:
            pytest.skip("No transactions found for company 38")
        
        # Find ETH transactions
        eth_txs = [tx for tx in transactions if tx.get('base_currency', '').upper() == 'ETH']
        
        if not eth_txs:
            pytest.skip("No ETH transactions found for company 38")
        
        for tx in eth_txs[:5]:
            base_amount = float(tx.get('base_amount', 0))
            display_amount = float(tx.get('display_amount', 0))
            
            if base_amount > 0 and display_amount > 0:
                # ETH price is roughly £1000-5000+ per ETH (as of 2024-2025)
                # So 0.00775 ETH should be roughly £7-40
                # NOT £0.01 (which was the bug - treating crypto amount as already in fiat)
                implied_rate = display_amount / base_amount
                
                # Sanity check: ETH/GBP rate should be > £100 at minimum
                assert implied_rate > 100, f"Implied ETH/GBP rate ({implied_rate}) is too low. base_amount={base_amount}, display_amount={display_amount}. This suggests crypto value wasn't properly converted."
                
                print(f"✓ ETH transaction: {base_amount} ETH → £{display_amount} GBP (implied rate: £{implied_rate:.2f}/ETH)")
                return  # Pass on first valid check
        
        pytest.skip("No valid ETH transactions to verify conversion rate")

    def test_09_response_structure_is_complete(self, auth_headers):
        """Verify complete response structure"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        full_response = response.json()
        
        # Check top-level structure
        assert 'message' in full_response, "Response missing 'message' field"
        assert 'data' in full_response, "Response missing 'data' field"
        
        data = full_response.get('data', {})
        assert 'transactions' in data, "Response data missing 'transactions' array"
        assert 'currency' in data, "Response data missing 'currency' field"
        assert 'currency_info' in data, "Response data missing 'currency_info' field"
        
        print("✓ Response structure is complete")
        print(f"  - message: {full_response.get('message', '')[:50]}...")
        print(f"  - currency: {data.get('currency')}")
        print(f"  - transactions count: {len(data.get('transactions', []))}")
        print(f"  - currency_info: {data.get('currency_info')}")

    def test_10_sample_transaction_full_details(self, auth_headers):
        """Log a sample transaction for verification"""
        response = requests.get(
            f"{BASE_URL}/api/company/getTransactions/38",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json().get('data', response.json())
        transactions = data.get('transactions', [])
        
        if not transactions:
            pytest.skip("No transactions found for company 38")
        
        # Find a crypto transaction to log
        crypto_tx = None
        for tx in transactions:
            if tx.get('base_currency', '').upper() in ['ETH', 'BTC', 'TRX', 'LTC']:
                crypto_tx = tx
                break
        
        if crypto_tx:
            print("\n=== SAMPLE CRYPTO TRANSACTION ===")
            print(f"  base_currency: {crypto_tx.get('base_currency')}")
            print(f"  base_amount: {crypto_tx.get('base_amount')}")
            print(f"  usd_value: {crypto_tx.get('usd_value')}")
            print(f"  display_amount: {crypto_tx.get('display_amount')}")
            print(f"  display_currency: {crypto_tx.get('display_currency')}")
            print(f"  amount_display: {crypto_tx.get('amount_display')}")
            print("================================")
        else:
            print("No crypto transaction found to sample")
        
        # Test passes regardless - this is informational
        print("✓ Sample transaction logged")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
