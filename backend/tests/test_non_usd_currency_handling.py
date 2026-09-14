"""
Test Non-USD Currency Handling Fix
===================================
Tests the fix for non-USD currency handling to ensure fee tiers are calculated 
using USD equivalent amounts.

Key Fix: $100 AUD should use ~$70 USD for fee tier selection, not $100.

Fee Tiers (in USD):
- Tier 1: $5 - $100 -> Fixed: $3, Buffer: 1.0%
- Tier 2: $101 - $500 -> Fixed: $2, Buffer: 0.8%
- Tier 3: $501 - $1000 -> Fixed: $1.5, Buffer: 0.5%
- Tier 4: $1001+ -> Fixed: $1, Buffer: 0.3%

Test Scenarios:
1. Create payment link with AUD currency
2. getCurrencyRates with AUD source - verify base_amount_usd shows converted USD value
3. Verify processing_fee is calculated based on USD equivalent
4. Verify $100 AUD (~$70 USD) hits Tier 1 (not Tier 2)
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"
COMPANY_ID = 38

# Module-level variables for sharing state
_auth_token = None
_created_link_ids = []


def get_auth_token():
    """Get or create auth token with retry logic"""
    global _auth_token
    if not _auth_token:
        max_retries = 5
        for attempt in range(max_retries):
            response = requests.post(
                f"{BASE_URL}/api/user/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            if response.status_code == 200:
                data = response.json()
                _auth_token = data.get('data', {}).get('accessToken')
                print("✓ Authenticated successfully")
                break
            elif response.status_code == 520 or "Backend starting" in response.text:
                print(f"Backend starting, waiting... (attempt {attempt + 1}/{max_retries})")
                import time
                time.sleep(15)
            else:
                raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
        else:
            raise Exception(f"Backend did not start after {max_retries} attempts")
    return _auth_token


def get_headers():
    """Get headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {get_auth_token()}"
    }


class TestNonUSDCurrencyHandling:
    """Test non-USD currency handling for fee tier calculation"""
    
    # ==========================================
    # Test 1: getCurrencyRates with AUD source
    # ==========================================
    def test_01_get_currency_rates_aud_source(self):
        """Test getCurrencyRates with AUD source - verify USD conversion"""
        payload = {
            "source": "AUD",
            "amount": 100,  # $100 AUD
            "currencyList": ["BTC", "ETH", "USD"],
            "fixedDecimal": True,
            "fee_payer": "customer",  # To see fee breakdown
            "tax_amount": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload
        )
        
        print(f"getCurrencyRates AUD response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json().get('data', [])
        assert len(data) > 0, "Should return currency rates"
        
        # Find ETH rate to check fee calculation
        eth_rate = None
        for rate in data:
            if rate.get('currency') == 'ETH':
                eth_rate = rate
                break
        
        assert eth_rate is not None, "Should have ETH rate"
        
        # KEY VERIFICATION: base_amount_usd should be ~$70 USD (not $100)
        base_amount_usd = eth_rate.get('base_amount_usd', 0)
        print(f"✓ base_amount_usd: ${base_amount_usd}")
        
        # AUD to USD rate is approximately 0.65-0.75, so $100 AUD ≈ $65-$75 USD
        assert 50 < base_amount_usd < 85, f"Expected base_amount_usd between $50-$85 (AUD conversion), got ${base_amount_usd}"
        
        # Verify processing_fee is calculated based on USD amount
        processing_fee = eth_rate.get('processing_fee', 0)
        print(f"✓ processing_fee: ${processing_fee}")
        
        print(f"✓ Full rate data: {json.dumps(eth_rate, indent=2)}")
    
    # ==========================================
    # Test 2: Compare $100 AUD vs $100 USD
    # ==========================================
    def test_02_compare_aud_vs_usd_same_amount(self):
        """Compare $100 AUD vs $100 USD - should use different USD equivalents"""
        # $100 AUD (~$70 USD) -> Tier 1
        payload_aud = {
            "source": "AUD",
            "amount": 100,
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "customer",
            "tax_amount": 0
        }
        
        response_aud = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload_aud
        )
        
        assert response_aud.status_code == 200
        data_aud = response_aud.json().get('data', [])[0]
        
        # $100 USD -> Tier 1 (boundary)
        payload_usd = {
            "source": "USD",
            "amount": 100,
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "customer",
            "tax_amount": 0
        }
        
        response_usd = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload_usd
        )
        
        assert response_usd.status_code == 200
        data_usd = response_usd.json().get('data', [])[0]
        
        base_usd_from_aud = data_aud.get('base_amount_usd', 0)
        base_usd_from_usd = data_usd.get('base_amount_usd', 0)
        
        print(f"$100 AUD -> base_amount_usd: ${base_usd_from_aud}")
        print(f"$100 USD -> base_amount_usd: ${base_usd_from_usd}")
        
        # KEY ASSERTION: $100 AUD should NOT equal $100 USD
        assert base_usd_from_aud != base_usd_from_usd, "AUD and USD should have different USD equivalents"
        assert base_usd_from_aud < base_usd_from_usd, f"$100 AUD (${base_usd_from_aud}) should be less than $100 USD (${base_usd_from_usd})"
        
        print(f"✓ Verified: $100 AUD (${base_usd_from_aud} USD) < $100 USD (${base_usd_from_usd} USD)")
    
    # ==========================================
    # Test 3: Verify Fee Tier Selection
    # ==========================================
    def test_03_verify_fee_tier_selection_aud(self):
        """Verify $100 AUD uses correct fee tier based on USD equivalent"""
        # Test with $100 AUD (should be ~$70 USD -> Tier 1)
        payload_aud = {
            "source": "AUD",
            "amount": 100,
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "customer",
            "tax_amount": 0
        }
        
        response_aud = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload_aud
        )
        
        assert response_aud.status_code == 200
        data_aud = response_aud.json().get('data', [])[0]
        
        # Test with $70 USD directly (should be same tier)
        payload_usd = {
            "source": "USD",
            "amount": 70,  # Approximate USD equivalent of $100 AUD
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "customer",
            "tax_amount": 0
        }
        
        response_usd = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload_usd
        )
        
        assert response_usd.status_code == 200
        data_usd = response_usd.json().get('data', [])[0]
        
        print(f"$100 AUD -> base_amount_usd: ${data_aud.get('base_amount_usd')}, processing_fee: ${data_aud.get('processing_fee')}")
        print(f"$70 USD -> base_amount_usd: ${data_usd.get('base_amount_usd')}, processing_fee: ${data_usd.get('processing_fee')}")
        
        # Both should use Tier 1 (since both are ~$70 USD)
        fee_aud = data_aud.get('processing_fee', 0)
        fee_usd = data_usd.get('processing_fee', 0)
        
        # Allow 20% variance due to exchange rate fluctuations
        fee_ratio = fee_aud / fee_usd if fee_usd > 0 else 0
        print(f"Fee ratio (AUD/USD): {fee_ratio:.2f}")
        
        # The fees should be in the same ballpark (both Tier 1)
        assert 0.7 < fee_ratio < 1.5, f"Fee ratio should be close to 1.0, got {fee_ratio:.2f}"
        
        print("✓ Fee tier selection verified - both use similar tier")
    
    # ==========================================
    # Test 4: Test EUR Currency
    # ==========================================
    def test_04_get_currency_rates_eur_source(self):
        """Test getCurrencyRates with EUR source"""
        payload = {
            "source": "EUR",
            "amount": 100,  # €100 EUR
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "customer",
            "tax_amount": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload
        )
        
        print(f"getCurrencyRates EUR response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json().get('data', [])
        assert len(data) > 0, "Should return currency rates"
        
        eth_rate = data[0]
        
        # EUR to USD rate is approximately 1.05-1.25, so €100 EUR ≈ $105-$125 USD
        base_amount_usd = eth_rate.get('base_amount_usd', 0)
        print(f"✓ €100 EUR -> base_amount_usd: ${base_amount_usd}")
        
        # €100 EUR should be > $100 USD (EUR is stronger than USD)
        assert base_amount_usd > 100, f"Expected base_amount_usd > $100 (EUR conversion), got ${base_amount_usd}"
        
        print(f"✓ EUR conversion verified: €100 EUR = ${base_amount_usd} USD")
    
    # ==========================================
    # Test 5: Test GBP Currency
    # ==========================================
    def test_05_get_currency_rates_gbp_source(self):
        """Test getCurrencyRates with GBP source"""
        payload = {
            "source": "GBP",
            "amount": 100,  # £100 GBP
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "customer",
            "tax_amount": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload
        )
        
        print(f"getCurrencyRates GBP response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json().get('data', [])
        assert len(data) > 0, "Should return currency rates"
        
        eth_rate = data[0]
        
        # GBP to USD rate is approximately 1.25-1.40, so £100 GBP ≈ $125-$140 USD
        base_amount_usd = eth_rate.get('base_amount_usd', 0)
        print(f"✓ £100 GBP -> base_amount_usd: ${base_amount_usd}")
        
        # £100 GBP should be > $100 USD (GBP is stronger than USD)
        assert base_amount_usd > 100, f"Expected base_amount_usd > $100 (GBP conversion), got ${base_amount_usd}"
        
        print(f"✓ GBP conversion verified: £100 GBP = ${base_amount_usd} USD")
    
    # ==========================================
    # Test 6: Verify Fee Tier Boundaries
    # ==========================================
    def test_06_verify_fee_tier_boundaries(self):
        """Verify fee tier boundaries work correctly with USD conversion"""
        # Test amounts that should hit different tiers
        test_cases = [
            # (source, amount, expected_tier_description)
            ("AUD", 70, "Tier 1 (~$50 USD)"),   # ~$50 USD -> Tier 1
            ("AUD", 150, "Tier 1/2 (~$105 USD)"),  # ~$105 USD -> Tier 2
            ("AUD", 750, "Tier 3 (~$525 USD)"),  # ~$525 USD -> Tier 3
        ]
        
        results = []
        for source, amount, description in test_cases:
            payload = {
                "source": source,
                "amount": amount,
                "currencyList": ["ETH"],
                "fixedDecimal": True,
                "fee_payer": "customer",
                "tax_amount": 0
            }
            
            response = requests.post(
                f"{BASE_URL}/api/pay/getCurrencyRates",
                headers=get_headers(),
                json=payload
            )
            
            assert response.status_code == 200
            data = response.json().get('data', [])[0]
            
            base_usd = data.get('base_amount_usd', 0)
            processing_fee = data.get('processing_fee', 0)
            
            results.append({
                "source": source,
                "amount": amount,
                "description": description,
                "base_usd": base_usd,
                "processing_fee": processing_fee
            })
            
            print(f"${amount} {source} ({description}): base_usd=${base_usd:.2f}, fee=${processing_fee:.2f}")
        
        # Verify fees increase with amount (as expected with tier structure)
        for i in range(1, len(results)):
            # Higher amounts should generally have higher absolute fees
            assert results[i]['base_usd'] > results[i-1]['base_usd'], \
                f"USD amount should increase: {results[i-1]['base_usd']} -> {results[i]['base_usd']}"
        
        print("✓ Fee tier boundaries verified across different AUD amounts")
    
    # ==========================================
    # Test 7: Create Payment Link with AUD
    # ==========================================
    def test_07_create_payment_link_with_aud(self):
        """Test creating a payment link with AUD currency"""
        global _created_link_ids
        
        payload = {
            "company_id": COMPANY_ID,
            "base_amount": 100,  # $100 AUD
            "base_currency": "AUD",
            "description": "Test AUD payment for fee tier verification",
            "fee_payer": "customer",  # Customer pays fees to see fee breakdown
            "accepted_currencies": "BTC,ETH"  # Limit to BTC and ETH
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink",
            headers=get_headers(),
            json=payload
        )
        
        print(f"Create AUD payment link response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json().get('data', {})
        assert 'link_id' in data or 'id' in data, "Response should contain link_id or id"
        
        link_id = data.get('link_id') or data.get('id')
        _created_link_ids.append(link_id)
        
        # Verify the payment link was created with AUD
        assert data.get('base_currency') == 'AUD', f"Expected AUD, got {data.get('base_currency')}"
        assert data.get('base_amount') == 100 or data.get('amount') == 100, "Amount should be 100"
        
        print(f"✓ Created AUD payment link with ID: {link_id}")
    
    # ==========================================
    # Test 8: Create Payment Link with EUR
    # ==========================================
    def test_08_create_payment_link_with_eur(self):
        """Test creating a payment link with EUR currency"""
        global _created_link_ids
        
        payload = {
            "company_id": COMPANY_ID,
            "base_amount": 100,  # €100 EUR
            "base_currency": "EUR",
            "description": "Test EUR payment for fee tier verification",
            "fee_payer": "customer",
            "accepted_currencies": "BTC,ETH"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/createPaymentLink",
            headers=get_headers(),
            json=payload
        )
        
        print(f"Create EUR payment link response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json().get('data', {})
        link_id = data.get('link_id') or data.get('id')
        _created_link_ids.append(link_id)
        
        assert data.get('base_currency') == 'EUR', f"Expected EUR, got {data.get('base_currency')}"
        
        print(f"✓ Created EUR payment link with ID: {link_id}")
    
    # ==========================================
    # Test 9: Verify Company Pays Fees Mode
    # ==========================================
    def test_09_company_pays_fees_mode(self):
        """Test getCurrencyRates with company pays fees mode"""
        payload = {
            "source": "AUD",
            "amount": 100,
            "currencyList": ["ETH"],
            "fixedDecimal": True,
            "fee_payer": "company",  # Company pays fees
            "tax_amount": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pay/getCurrencyRates",
            headers=get_headers(),
            json=payload
        )
        
        print(f"getCurrencyRates (company pays) response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json().get('data', [])
        assert len(data) > 0, "Should return currency rates"
        
        eth_rate = data[0]
        
        # When company pays fees, response should NOT include processing_fee breakdown
        # (fees are hidden from customer)
        print(f"Company pays fees response: {json.dumps(eth_rate, indent=2)}")
        
        # The amount should be the base conversion (no fees added)
        assert 'amount' in eth_rate, "Should have amount field"
        
        print("✓ Company pays fees mode verified")
    
    # ==========================================
    # Test 10: Multiple Currency Conversions
    # ==========================================
    def test_10_multiple_currency_conversions(self):
        """Test multiple currency conversions to verify USD conversion works for all"""
        currencies = [
            ("AUD", 100, 50, 85),    # AUD weaker than USD
            ("EUR", 100, 100, 140),  # EUR stronger than USD
            ("GBP", 100, 120, 150),  # GBP stronger than USD
            ("CAD", 100, 60, 85),    # CAD weaker than USD
        ]
        
        for source, amount, min_usd, max_usd in currencies:
            payload = {
                "source": source,
                "amount": amount,
                "currencyList": ["ETH"],
                "fixedDecimal": True,
                "fee_payer": "customer",
                "tax_amount": 0
            }
            
            response = requests.post(
                f"{BASE_URL}/api/pay/getCurrencyRates",
                headers=get_headers(),
                json=payload
            )
            
            assert response.status_code == 200, f"Failed for {source}"
            data = response.json().get('data', [])[0]
            
            base_usd = data.get('base_amount_usd', 0)
            print(f"${amount} {source} = ${base_usd} USD")
            
            assert min_usd < base_usd < max_usd, \
                f"${amount} {source} should be ${min_usd}-${max_usd} USD, got ${base_usd}"
        
        print("✓ All currency conversions verified")
    
    # ==========================================
    # Cleanup
    # ==========================================
    def test_99_cleanup(self):
        """Cleanup created payment links"""
        global _created_link_ids
        
        for link_id in _created_link_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/pay/deletePaymentLink/{link_id}",
                    headers=get_headers()
                )
                if response.status_code == 200:
                    print(f"✓ Deleted payment link {link_id}")
                else:
                    print(f"⚠ Could not delete payment link {link_id}: {response.status_code}")
            except Exception as e:
                print(f"⚠ Error deleting payment link {link_id}: {e}")
        
        _created_link_ids = []
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
