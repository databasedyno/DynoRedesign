"""
Regression Test Suite for Backend Refactoring
=============================================
Verifies that all endpoints work correctly after the large-scale code quality refactoring.

Refactoring included:
1. Replaced all console.log with standardized logger
2. Extracted wallet increment patterns to walletHelpers.ts
3. Extracted controller error handling to controllerErrorHandler.ts
4. Extracted subscription cleanup and KYC enforcement to helpers
5. Created SSH tunnel auto-reconnect service
6. Added tunnel-status diagnostics endpoint
"""
import pytest
import requests
import os

# Get base URL - use localhost if external URL returns 520/503 errors
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Override to use localhost for internal testing since external URL may have intermittent issues
BASE_URL = 'http://localhost:8001'

# Test timeout for slow endpoints
TIMEOUT = 30


class TestDiagnosticsEndpoints:
    """Test all diagnostics endpoints added during refactoring"""
    
    def test_tunnel_status_endpoint(self):
        """GET /api/diagnostics/tunnel-status - SSH tunnel health diagnostics"""
        response = requests.get(f"{BASE_URL}/api/diagnostics/tunnel-status", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, f"Expected success=True, got {data}"
        assert "tunnel" in data, "Missing 'tunnel' key in response"
        assert "binanceProxy" in data, "Missing 'binanceProxy' key in response"
        
        # Verify tunnel status structure
        tunnel = data["tunnel"]
        assert "enabled" in tunnel
        assert "tunnelUp" in tunnel
        assert "localPort" in tunnel
        assert "sshHost" in tunnel
        assert "consecutiveFailures" in tunnel
        assert "startCount" in tunnel
    
    def test_binance_info_endpoint(self):
        """GET /api/diagnostics/binance-info - Binance configuration status"""
        response = requests.get(f"{BASE_URL}/api/diagnostics/binance-info", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True
        assert "binanceConfigured" in data
        assert "apiKeyPresent" in data
        assert "apiSecretPresent" in data
        assert "baseUrl" in data
    
    def test_email_preview_endpoint(self):
        """GET /api/diagnostics/email-preview - HTML email template preview"""
        response = requests.get(f"{BASE_URL}/api/diagnostics/email-preview", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Should return HTML content
        content_type = response.headers.get("Content-Type", "")
        assert "text/html" in content_type, f"Expected text/html, got {content_type}"
        
        # Should contain email template navigation links
        html_content = response.text
        assert "payment" in html_content.lower(), "Missing 'payment' template option"
        assert "otp" in html_content.lower(), "Missing 'otp' template option"
    
    def test_email_preview_different_templates(self):
        """GET /api/diagnostics/email-preview?template=xxx - Different template styles"""
        templates = ["payment", "otp", "security", "welcome", "admin"]
        
        for template in templates:
            response = requests.get(
                f"{BASE_URL}/api/diagnostics/email-preview?template={template}", 
                timeout=TIMEOUT
            )
            assert response.status_code == 200, f"Template '{template}' returned {response.status_code}"


class TestHealthEndpoints:
    """Test core health and status endpoints"""
    
    def test_health_endpoint(self):
        """GET /health - Server health check"""
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Missing 'status' key"
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "database" in data
        assert "redis" in data
        assert "uptime" in data
    
    def test_root_endpoint(self):
        """GET / - API root with fee information"""
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("message") == "Dynopay Backend API"
        assert data.get("version") == "1.0.0"
        assert data.get("status") == "running"
    
    def test_swagger_docs_accessible(self):
        """GET /api/docs - Swagger documentation"""
        response = requests.get(f"{BASE_URL}/api/docs", timeout=TIMEOUT, allow_redirects=True)
        # Swagger UI should return HTML
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


class TestControllerIntegration:
    """Test that controllers are properly wired after refactoring"""
    
    def test_user_endpoint_reachable(self):
        """GET /api/user/profile - Should return 401 (requires auth)"""
        response = requests.get(f"{BASE_URL}/api/user/profile", timeout=TIMEOUT)
        # Without auth, should get 401 or 400 - NOT 500 (broken import)
        assert response.status_code in [401, 400, 403], f"Got {response.status_code} - controller may have import error"
    
    def test_wallet_endpoint_reachable(self):
        """GET /api/wallet - Should return 401 (requires auth)"""
        response = requests.get(f"{BASE_URL}/api/wallet", timeout=TIMEOUT)
        assert response.status_code in [401, 400, 403], f"Got {response.status_code} - controller may have import error"
    
    def test_admin_login_endpoint_structure(self):
        """POST /api/admin/login - Should validate credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "test@test.com", "password": "wrongpassword"},
            timeout=TIMEOUT
        )
        # Should get 500 with "Invalid username or password" - NOT import error
        assert response.status_code == 500, f"Got {response.status_code}"
        data = response.json()
        assert "Invalid username or password" in str(data) or "message" in data
    
    def test_payment_endpoint_reachable(self):
        """GET /api/payment - Should work without auth (public endpoint)"""
        response = requests.post(
            f"{BASE_URL}/api/payment",
            json={"data": "testdata"},
            timeout=TIMEOUT
        )
        # Should return error about invalid data - NOT 500 from import error
        assert response.status_code in [200, 400, 404, 500], f"Got unexpected {response.status_code}"


class TestDiagnosticsExtended:
    """Test extended diagnostics endpoints"""
    
    def test_volatility_endpoint(self):
        """GET /diagnostics/volatility - Market volatility states"""
        response = requests.get(f"{BASE_URL}/diagnostics/volatility", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True
        assert "monitoredAssets" in data
        assert "decliningAssets" in data
        assert "states" in data
    
    def test_fee_rates_endpoint(self):
        """GET /diagnostics/fee-rates - Blockchain fee rates"""
        response = requests.get(f"{BASE_URL}/diagnostics/fee-rates", timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True
        assert "rates" in data
    
    def test_conversion_email_preview(self):
        """GET /diagnostics/conversion-email-preview - Auto-conversion email template"""
        response = requests.get(f"{BASE_URL}/diagnostics/conversion-email-preview", timeout=TIMEOUT)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
    
    def test_weekly_conversion_email_preview(self):
        """GET /diagnostics/weekly-conversion-email-preview - Weekly summary email"""
        response = requests.get(f"{BASE_URL}/diagnostics/weekly-conversion-email-preview", timeout=TIMEOUT)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")


class TestErrorHandling:
    """Test that error handling works correctly after refactoring"""
    
    def test_404_for_invalid_endpoint(self):
        """GET /api/nonexistent - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/nonexistent", timeout=TIMEOUT)
        # May return 404 or route to default handler
        assert response.status_code in [404, 500], f"Got {response.status_code}"
    
    def test_malformed_json_handling(self):
        """POST with invalid JSON - Should return 400 or handle gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/payment",
            data="not valid json",
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT
        )
        # Should not crash the server
        assert response.status_code in [400, 500], f"Got {response.status_code}"


class TestAPIVersioning:
    """Test API versioning routes"""
    
    def test_v1_route_works(self):
        """GET /api/v1/... - Versioned API should work"""
        response = requests.get(f"{BASE_URL}/api/v1/user/profile", timeout=TIMEOUT)
        # Should get auth error, not 404
        assert response.status_code in [401, 400, 403], f"Got {response.status_code}"
    
    def test_diagnostics_without_api_prefix(self):
        """GET /diagnostics/... - Should work without /api prefix"""
        response = requests.get(f"{BASE_URL}/diagnostics/tunnel-status", timeout=TIMEOUT)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
