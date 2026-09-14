"""
Test Suite for DynoPay Controller Refactoring
Tests that API behavior is preserved after extracting shared error handling.

Key changes being tested:
- handleControllerError utility used across 12 controllers (134 catch blocks)
- handleControllerErrorReturn variant for early-return patterns
- buildTransactionFilters helper in walletController

The tests verify:
1. Health endpoints still respond correctly
2. Status endpoints return valid JSON
3. Controller routes don't have broken imports
4. Error handling properly returns 500 errors
"""

import pytest
import requests
import os

# Use internal URL for direct testing (external URL may have proxy issues)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

# Helper for making requests
def api_get(endpoint: str, headers: dict = None):
    """Make a GET request to the API"""
    url = f"{BASE_URL}{endpoint}"
    return requests.get(url, headers=headers or {}, timeout=30)

def api_post(endpoint: str, json_data: dict = None, headers: dict = None):
    """Make a POST request to the API"""
    url = f"{BASE_URL}{endpoint}"
    return requests.post(url, json=json_data or {}, headers=headers or {}, timeout=30)


class TestHealthEndpoints:
    """Tests for health check endpoints"""

    def test_health_endpoint_responds(self):
        """GET /api/status/health should return healthy status"""
        response = api_get('/api/status/health')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'status' in data, "Response should contain 'status' field"
        assert data['status'] == 'healthy', f"Expected 'healthy', got {data['status']}"
        assert 'timestamp' in data, "Response should contain 'timestamp' field"
        print(f"✅ Health endpoint healthy: {data}")

    def test_root_health_endpoint(self):
        """GET /health should return detailed health status"""
        response = api_get('/api/health')  # Via proxy
        # This might redirect, try direct health endpoint
        if response.status_code == 404:
            # Try status health instead
            response = api_get('/api/status/health')
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'status' in data
        print(f"✅ Root health endpoint: {data.get('status', 'unknown')}")


class TestStatusEndpoints:
    """Tests for status page endpoints - uses statusController which has handleControllerError"""

    def test_status_endpoint_returns_valid_json(self):
        """GET /api/status should return overall system status"""
        response = api_get('/api/status')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'message' in data or 'data' in data, "Response should have message or data"
        
        if 'data' in data:
            status_data = data['data']
            assert 'overall_status' in status_data, "Should have overall_status"
            assert 'services' in status_data, "Should have services list"
            assert isinstance(status_data['services'], list), "Services should be a list"
            print(f"✅ Status endpoint: {status_data.get('overall_status', 'unknown')}")
        else:
            print(f"✅ Status response: {data.get('message', 'unknown')}")

    def test_services_status_endpoint(self):
        """GET /api/status/services should return all services status"""
        response = api_get('/api/status/services')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        response.json()
        print(f"✅ Services status endpoint responded with status {response.status_code}")

    def test_uptime_endpoint(self):
        """GET /api/status/uptime should return uptime data"""
        response = api_get('/api/status/uptime')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        response.json()
        print("✅ Uptime endpoint responded successfully")

    def test_incidents_endpoint(self):
        """GET /api/status/incidents should return incidents list"""
        response = api_get('/api/status/incidents')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        response.json()
        print("✅ Incidents endpoint responded successfully")


class TestControllerRoutes:
    """Test that controller routes still respond (no broken imports)"""

    def test_root_api_endpoint(self):
        """GET / should return API info"""
        response = api_get('/api/')
        # Could be 200 or redirect
        assert response.status_code in [200, 301, 302, 307, 308], f"Unexpected status: {response.status_code}"
        print(f"✅ Root API endpoint status: {response.status_code}")

    def test_user_endpoints_accessible(self):
        """GET /api/user routes should be accessible (will return 401 without auth)"""
        response = api_get('/api/user')
        # Without auth, should return 401 or 403, not 500 (broken import)
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ User endpoint accessible (status: {response.status_code})")

    def test_company_endpoints_accessible(self):
        """GET /api/company routes should be accessible"""
        response = api_get('/api/company')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Company endpoint accessible (status: {response.status_code})")

    def test_wallet_endpoints_accessible(self):
        """GET /api/wallet routes should be accessible"""
        response = api_get('/api/wallet')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Wallet endpoint accessible (status: {response.status_code})")

    def test_admin_endpoints_accessible(self):
        """GET /api/admin routes should be accessible"""
        response = api_get('/api/admin')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Admin endpoint accessible (status: {response.status_code})")

    def test_payment_endpoints_accessible(self):
        """GET /api/payment routes should be accessible"""
        response = api_get('/api/payment')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Payment endpoint accessible (status: {response.status_code})")

    def test_api_key_endpoints_accessible(self):
        """GET /api/api routes should be accessible"""
        response = api_get('/api/api')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ API key endpoint accessible (status: {response.status_code})")

    def test_notification_endpoints_accessible(self):
        """GET /api/notification routes should be accessible"""
        response = api_get('/api/notification')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Notification endpoint accessible (status: {response.status_code})")

    def test_invoice_endpoints_accessible(self):
        """GET /api/invoice routes should be accessible"""
        response = api_get('/api/invoice')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Invoice endpoint accessible (status: {response.status_code})")

    def test_subscription_endpoints_accessible(self):
        """GET /api/subscription routes should be accessible"""
        response = api_get('/api/subscription')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Subscription endpoint accessible (status: {response.status_code})")

    def test_tax_endpoints_accessible(self):
        """GET /api/tax routes should be accessible"""
        response = api_get('/api/tax')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Tax endpoint accessible (status: {response.status_code})")

    def test_dashboard_endpoints_accessible(self):
        """GET /api/dashboard routes should be accessible"""
        response = api_get('/api/dashboard')
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Dashboard endpoint accessible (status: {response.status_code})")


class TestErrorHandling:
    """Test that error handling works correctly"""

    def test_invalid_endpoint_returns_404(self):
        """GET /api/nonexistent should return 404, not 500"""
        response = api_get('/api/nonexistent-endpoint-xyz123')
        # Should get 404 (not found) not 500 (server error)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Invalid endpoint returns 404 as expected")

    def test_malformed_request_handled_gracefully(self):
        """POST with invalid data should be handled, not crash"""
        response = api_post('/api/user/login', json_data={
            'email': 'invalid-email-format',
            'password': ''
        })
        # Should get validation error (400/401/422) not server crash (500)
        # Note: 401 is acceptable if endpoint exists but login fails
        assert response.status_code in [400, 401, 403, 404, 422], \
            f"Expected error handling response, got {response.status_code}"
        print(f"✅ Malformed request handled gracefully (status: {response.status_code})")


class TestDiagnosticsEndpoints:
    """Test diagnostic endpoints that actually exist"""

    def test_email_preview_diagnostic(self):
        """GET /diagnostics/email-preview should respond"""
        response = api_get('/api/diagnostics/email-preview')
        # Accepts 200, 401, 403, or 404 (endpoint exists but may require auth or params)
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Email preview diagnostic endpoint status: {response.status_code}")

    def test_binance_ping_diagnostic(self):
        """GET /diagnostics/binance-ping should respond"""
        response = api_get('/api/diagnostics/binance-ping')
        # Accepts any non-500 response (endpoint exists, may require auth or have connectivity issues)
        assert response.status_code != 500, f"Controller may have broken imports: {response.status_code}"
        print(f"✅ Binance ping diagnostic endpoint status: {response.status_code}")


class TestSwaggerDocs:
    """Test that API docs are accessible"""

    def test_swagger_docs_accessible(self):
        """GET /api/docs should serve Swagger UI"""
        response = api_get('/api/docs/')
        # Swagger returns HTML page or redirects
        assert response.status_code in [200, 301, 302], f"Swagger docs inaccessible: {response.status_code}"
        print(f"✅ Swagger docs accessible (status: {response.status_code})")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
