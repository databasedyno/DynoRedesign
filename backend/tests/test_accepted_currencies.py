"""
Test suite for Payment Link Accepted Currencies Feature
Tests the ability for merchants to select which cryptocurrencies to accept for each payment link.

Endpoints tested:
- GET /api/pay/company-currencies/:company_id - returns all currencies with configuration status
- POST /api/pay/createPaymentLink with accepted_currencies array - creates link with selected cryptos
- POST /api/pay/createPaymentLink without accepted_currencies - uses all configured wallets
- PUT /api/pay/links/:id with accepted_currencies - updates selected cryptos
- GET /api/pay/links/:id - returns accepted_currencies as array
- Validation: invalid crypto type returns error
- Validation: unconfigured wallet returns error
"""

import pytest
import requests
import os

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"
COMPANY_ID = 38

# Supported crypto types
SUPPORTED_CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20']

# Company 38 configured currencies (from test info)
CONFIGURED_CURRENCIES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'USDT-TRC20', 'USDT-ERC20']
UNCONFIGURED_CURRENCIES = ['BCH', 'USDC-ERC20']


# Global auth token
AUTH_TOKEN = None
CREATED_LINK_IDS = []


@pytest.fixture(autouse=True, scope="session")
def reset_auth():
    """Reset auth token at start of session"""
    global AUTH_TOKEN
    AUTH_TOKEN = None
    yield


def get_auth_token():
    """Get authentication token"""
    global AUTH_TOKEN
    if AUTH_TOKEN:
        return AUTH_TOKEN
    
    print(f"\n[Auth] Authenticating with {TEST_EMAIL}...")
    response = requests.post(
        f"{BASE_URL}/api/user/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    print(f"[Auth] Response status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        AUTH_TOKEN = data.get('data', {}).get('accessToken')
        print(f"[Auth] Token obtained: {AUTH_TOKEN[:30]}..." if AUTH_TOKEN else "[Auth] No token in response")
        return AUTH_TOKEN
    else:
        print(f"[Auth] Failed: {response.text}")
        return None


def get_headers():
    """Get headers with auth token"""
    token = get_auth_token()
    if not token:
        pytest.skip("Authentication failed")
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }


def cleanup_test_links():
    """Cleanup created test links"""
    global CREATED_LINK_IDS
    for link_id in CREATED_LINK_IDS:
        try:
            requests.delete(
                f"{BASE_URL}/api/pay/deletePaymentLink/{link_id}",
                headers=get_headers()
            )
            print(f"[Cleanup] Deleted link {link_id}")
        except Exception as e:
            print(f"[Cleanup] Failed to delete link {link_id}: {e}")
    CREATED_LINK_IDS = []


# ==========================================
# Test 1: GET /api/pay/company-currencies/:company_id
# ==========================================
def test_get_company_currencies_success():
    """Test GET /api/pay/company-currencies/:company_id returns all currencies with configuration status"""
    print(f"\n[Test] GET /api/pay/company-currencies/{COMPANY_ID}")
    
    response = requests.get(
        f"{BASE_URL}/api/pay/company-currencies/{COMPANY_ID}",
        headers=get_headers()
    )
    
    print(f"[Test] Response status: {response.status_code}")
    print(f"[Test] Response body: {response.text[:500]}...")
    
    # Status code assertion
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    # Data assertions
    data = response.json()
    assert 'data' in data, "Response should have 'data' field"
    
    result = data['data']
    assert 'company_id' in result, "Response should have company_id"
    assert result['company_id'] == COMPANY_ID, f"Expected company_id {COMPANY_ID}, got {result['company_id']}"
    
    assert 'currencies' in result, "Response should have currencies array"
    assert isinstance(result['currencies'], list), "currencies should be an array"
    
    # Verify all supported crypto types are returned
    currency_types = [c['type'] for c in result['currencies']]
    for crypto in SUPPORTED_CRYPTO_TYPES:
        assert crypto in currency_types, f"Missing crypto type: {crypto}"
    
    # Verify each currency has required fields
    for currency in result['currencies']:
        assert 'type' in currency, "Currency should have 'type'"
        assert 'name' in currency, "Currency should have 'name'"
        assert 'configured' in currency, "Currency should have 'configured' boolean"
        assert isinstance(currency['configured'], bool), "'configured' should be boolean"
    
    # Verify configured/unconfigured arrays
    assert 'configured' in result, "Response should have 'configured' array"
    assert 'unconfigured' in result, "Response should have 'unconfigured' array"
    
    print(f"[Test] ✓ Configured currencies: {result['configured']}")
    print(f"[Test] ✓ Unconfigured currencies: {result['unconfigured']}")
    print(f"[Test] ✓ Total available: {result.get('total_available')}, Total configured: {result.get('total_configured')}")


def test_get_company_currencies_invalid_company():
    """Test GET /api/pay/company-currencies with invalid company_id returns error"""
    print("\n[Test] GET /api/pay/company-currencies/99999 (invalid)")
    
    response = requests.get(
        f"{BASE_URL}/api/pay/company-currencies/99999",
        headers=get_headers()
    )
    
    print(f"[Test] Response status: {response.status_code}")
    
    # Should return 404 for non-existent company
    assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    print("[Test] ✓ Invalid company returns 404")


# ==========================================
# Test 2: POST /api/pay/createPaymentLink with accepted_currencies
# ==========================================
def test_create_payment_link_with_accepted_currencies():
    """Test creating payment link with specific accepted_currencies array"""
    global CREATED_LINK_IDS
    print("\n[Test] POST /api/pay/createPaymentLink with accepted_currencies=['BTC', 'ETH']")
    
    payload = {
        "base_amount": 50,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_accepted_currencies_btc_eth",
        "accepted_currencies": ["BTC", "ETH"],
        "expire": "24h"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=payload
    )
    
    print(f"[Test] Response status: {response.status_code}")
    print(f"[Test] Response body: {response.text[:500]}...")
    
    # Status code assertion
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    # Data assertions
    data = response.json()
    assert 'data' in data, "Response should have 'data' field"
    
    result = data['data']
    assert 'link_id' in result, "Response should have link_id"
    
    # Track for cleanup
    CREATED_LINK_IDS.append(result['link_id'])
    
    # Verify accepted_currencies in response
    assert 'accepted_currencies' in result, "Response should have accepted_currencies"
    accepted = result['accepted_currencies']
    
    if accepted is not None:
        # createPaymentLink returns comma-separated string, getPaymentLinkById returns array
        # Handle both formats
        if isinstance(accepted, str):
            accepted_list = [c.strip() for c in accepted.split(',')]
        else:
            accepted_list = accepted
        
        assert 'BTC' in accepted_list, "BTC should be in accepted_currencies"
        assert 'ETH' in accepted_list, "ETH should be in accepted_currencies"
        assert len(accepted_list) == 2, f"Expected 2 currencies, got {len(accepted_list)}"
    
    print(f"[Test] ✓ Created link {result['link_id']} with accepted_currencies: {accepted}")


def test_create_payment_link_without_accepted_currencies():
    """Test creating payment link without accepted_currencies uses all configured wallets"""
    global CREATED_LINK_IDS
    print("\n[Test] POST /api/pay/createPaymentLink without accepted_currencies")
    
    payload = {
        "base_amount": 25,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_no_accepted_currencies",
        "expire": "24h"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=payload
    )
    
    print(f"[Test] Response status: {response.status_code}")
    print(f"[Test] Response body: {response.text[:500]}...")
    
    # Status code assertion
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    # Data assertions
    data = response.json()
    result = data['data']
    
    # Track for cleanup
    CREATED_LINK_IDS.append(result['link_id'])
    
    # When no accepted_currencies provided, should be null (all configured)
    accepted = result.get('accepted_currencies')
    assert accepted is None, f"Expected null accepted_currencies, got {accepted}"
    
    print(f"[Test] ✓ Created link {result['link_id']} with accepted_currencies: null (all configured)")


def test_create_payment_link_invalid_crypto_type():
    """Test creating payment link with invalid crypto type returns error"""
    print("\n[Test] POST /api/pay/createPaymentLink with invalid crypto type 'INVALID_COIN'")
    
    payload = {
        "base_amount": 30,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_invalid_crypto",
        "accepted_currencies": ["BTC", "INVALID_COIN"],
        "expire": "24h"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=payload
    )
    
    print(f"[Test] Response status: {response.status_code}")
    print(f"[Test] Response body: {response.text}")
    
    # Should return 400 for invalid crypto type
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    # Verify error message mentions invalid crypto
    data = response.json()
    error_msg = data.get('message', '') or data.get('error', '')
    assert 'invalid' in error_msg.lower() or 'INVALID_COIN' in error_msg, f"Error should mention invalid crypto: {error_msg}"
    
    print(f"[Test] ✓ Invalid crypto type returns 400 with message: {error_msg}")


def test_create_payment_link_unconfigured_wallet():
    """Test creating payment link with unconfigured wallet returns error"""
    print("\n[Test] POST /api/pay/createPaymentLink with unconfigured wallet 'BCH'")
    
    payload = {
        "base_amount": 30,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_unconfigured_wallet",
        "accepted_currencies": ["BTC", "BCH"],  # BCH is not configured for company 38
        "expire": "24h"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=payload
    )
    
    print(f"[Test] Response status: {response.status_code}")
    print(f"[Test] Response body: {response.text}")
    
    # Should return 400 for unconfigured wallet
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    # Verify error message mentions unconfigured wallet
    data = response.json()
    error_msg = data.get('message', '') or data.get('error', '')
    assert 'wallet' in error_msg.lower() or 'configured' in error_msg.lower() or 'BCH' in error_msg, \
        f"Error should mention unconfigured wallet: {error_msg}"
    
    print(f"[Test] ✓ Unconfigured wallet returns 400 with message: {error_msg}")


# ==========================================
# Test 3: GET /api/pay/links/:id returns accepted_currencies
# ==========================================
def test_get_payment_link_returns_accepted_currencies():
    """Test GET /api/pay/links/:id returns accepted_currencies as array"""
    global CREATED_LINK_IDS
    print("\n[Test] Creating link then GET /api/pay/links/:id to verify accepted_currencies")
    
    # First create a link with specific currencies
    create_payload = {
        "base_amount": 75,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_get_link_currencies",
        "accepted_currencies": ["LTC", "DOGE", "TRX"],
        "expire": "24h"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=create_payload
    )
    
    assert create_response.status_code == 200, f"Create failed: {create_response.text}"
    
    link_id = create_response.json()['data']['link_id']
    CREATED_LINK_IDS.append(link_id)
    
    # Now GET the link
    print(f"[Test] GET /api/pay/links/{link_id}")
    
    get_response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers()
    )
    
    print(f"[Test] Response status: {get_response.status_code}")
    print(f"[Test] Response body: {get_response.text[:500]}...")
    
    # Status code assertion
    assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}: {get_response.text}"
    
    # Data assertions
    data = get_response.json()
    result = data['data']
    
    # Verify accepted_currencies is returned as array
    assert 'accepted_currencies' in result, "Response should have accepted_currencies"
    accepted = result['accepted_currencies']
    
    assert isinstance(accepted, list), f"accepted_currencies should be array, got {type(accepted)}"
    assert 'LTC' in accepted, "LTC should be in accepted_currencies"
    assert 'DOGE' in accepted, "DOGE should be in accepted_currencies"
    assert 'TRX' in accepted, "TRX should be in accepted_currencies"
    assert len(accepted) == 3, f"Expected 3 currencies, got {len(accepted)}"
    
    print(f"[Test] ✓ GET link {link_id} returns accepted_currencies: {accepted}")


# ==========================================
# Test 4: PUT /api/pay/links/:id with accepted_currencies
# ==========================================
def test_update_payment_link_accepted_currencies():
    """Test PUT /api/pay/links/:id updates accepted_currencies"""
    global CREATED_LINK_IDS
    print("\n[Test] Creating link then PUT /api/pay/links/:id to update accepted_currencies")
    
    # First create a link with BTC only
    create_payload = {
        "base_amount": 100,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_update_currencies",
        "accepted_currencies": ["BTC"],
        "expire": "24h"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=create_payload
    )
    
    assert create_response.status_code == 200, f"Create failed: {create_response.text}"
    
    link_id = create_response.json()['data']['link_id']
    CREATED_LINK_IDS.append(link_id)
    
    # Now UPDATE to add more currencies
    print(f"[Test] PUT /api/pay/links/{link_id} with accepted_currencies=['BTC', 'ETH', 'LTC']")
    
    update_payload = {
        "accepted_currencies": ["BTC", "ETH", "LTC"]
    }
    
    update_response = requests.put(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers(),
        json=update_payload
    )
    
    print(f"[Test] Response status: {update_response.status_code}")
    print(f"[Test] Response body: {update_response.text[:500]}...")
    
    # Status code assertion
    assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
    
    # Verify update by GET
    get_response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers()
    )
    
    result = get_response.json()['data']
    accepted = result['accepted_currencies']
    
    assert isinstance(accepted, list), f"accepted_currencies should be array, got {type(accepted)}"
    assert 'BTC' in accepted, "BTC should be in accepted_currencies"
    assert 'ETH' in accepted, "ETH should be in accepted_currencies"
    assert 'LTC' in accepted, "LTC should be in accepted_currencies"
    assert len(accepted) == 3, f"Expected 3 currencies, got {len(accepted)}"
    
    print(f"[Test] ✓ Updated link {link_id} accepted_currencies: {accepted}")


def test_update_payment_link_clear_accepted_currencies():
    """Test PUT /api/pay/links/:id with null accepted_currencies clears selection"""
    global CREATED_LINK_IDS
    print("\n[Test] Creating link then PUT with null accepted_currencies to clear selection")
    
    # First create a link with specific currencies
    create_payload = {
        "base_amount": 60,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_clear_currencies",
        "accepted_currencies": ["BTC", "ETH"],
        "expire": "24h"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=create_payload
    )
    
    assert create_response.status_code == 200, f"Create failed: {create_response.text}"
    
    link_id = create_response.json()['data']['link_id']
    CREATED_LINK_IDS.append(link_id)
    
    # Now UPDATE with null to clear selection
    print(f"[Test] PUT /api/pay/links/{link_id} with accepted_currencies=null")
    
    update_payload = {
        "accepted_currencies": None
    }
    
    update_response = requests.put(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers(),
        json=update_payload
    )
    
    print(f"[Test] Response status: {update_response.status_code}")
    
    # Status code assertion
    assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
    
    # Verify update by GET
    get_response = requests.get(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers()
    )
    
    result = get_response.json()['data']
    accepted = result['accepted_currencies']
    
    # Should be null (all configured currencies)
    assert accepted is None, f"Expected null accepted_currencies, got {accepted}"
    
    print("[Test] ✓ Cleared accepted_currencies to null (all configured)")


def test_update_payment_link_invalid_crypto():
    """Test PUT /api/pay/links/:id with invalid crypto type returns error"""
    global CREATED_LINK_IDS
    print("\n[Test] Creating link then PUT with invalid crypto type")
    
    # First create a link
    create_payload = {
        "base_amount": 40,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_update_invalid_crypto",
        "accepted_currencies": ["BTC"],
        "expire": "24h"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=create_payload
    )
    
    assert create_response.status_code == 200, f"Create failed: {create_response.text}"
    
    link_id = create_response.json()['data']['link_id']
    CREATED_LINK_IDS.append(link_id)
    
    # Now UPDATE with invalid crypto
    print(f"[Test] PUT /api/pay/links/{link_id} with invalid crypto 'FAKE_COIN'")
    
    update_payload = {
        "accepted_currencies": ["BTC", "FAKE_COIN"]
    }
    
    update_response = requests.put(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers(),
        json=update_payload
    )
    
    print(f"[Test] Response status: {update_response.status_code}")
    print(f"[Test] Response body: {update_response.text}")
    
    # Should return 400 for invalid crypto
    assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}: {update_response.text}"
    
    print("[Test] ✓ Update with invalid crypto returns 400")


def test_update_payment_link_unconfigured_wallet():
    """Test PUT /api/pay/links/:id with unconfigured wallet returns error"""
    global CREATED_LINK_IDS
    print("\n[Test] Creating link then PUT with unconfigured wallet")
    
    # First create a link
    create_payload = {
        "base_amount": 45,
        "base_currency": "USD",
        "company_id": COMPANY_ID,
        "description": "TEST_update_unconfigured",
        "accepted_currencies": ["BTC"],
        "expire": "24h"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/pay/createPaymentLink",
        headers=get_headers(),
        json=create_payload
    )
    
    assert create_response.status_code == 200, f"Create failed: {create_response.text}"
    
    link_id = create_response.json()['data']['link_id']
    CREATED_LINK_IDS.append(link_id)
    
    # Now UPDATE with unconfigured wallet (BCH)
    print(f"[Test] PUT /api/pay/links/{link_id} with unconfigured wallet 'BCH'")
    
    update_payload = {
        "accepted_currencies": ["BTC", "BCH"]  # BCH is not configured
    }
    
    update_response = requests.put(
        f"{BASE_URL}/api/pay/links/{link_id}",
        headers=get_headers(),
        json=update_payload
    )
    
    print(f"[Test] Response status: {update_response.status_code}")
    print(f"[Test] Response body: {update_response.text}")
    
    # Should return 400 for unconfigured wallet
    assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}: {update_response.text}"
    
    print("[Test] ✓ Update with unconfigured wallet returns 400")


# Cleanup after all tests
def test_zz_cleanup():
    """Cleanup test data"""
    cleanup_test_links()
    print("[Test] ✓ Cleanup completed")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
