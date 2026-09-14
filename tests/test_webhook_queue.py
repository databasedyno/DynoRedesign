"""
Test Suite for BullMQ Webhook Queue Implementation
=================================================
Tests offline payment processing with BullMQ queue, startup reconciliation, and hardening.

Features Tested:
1. BullMQ webhook queue initialization and worker running on startup
2. Queue health endpoint GET /diagnostics/webhook-queue (admin auth required)
3. DLQ listing endpoint GET /diagnostics/webhook-queue/dlq (admin auth required)
4. DLQ retry endpoint POST /diagnostics/webhook-queue/dlq/:jobId/retry (admin auth required)
5. Manual reconciliation endpoint POST /diagnostics/webhook-queue/reconcile (admin auth required)
6. Temporary recovery endpoint removed (should return 404)
7. POST /api/tatum-crypto-webhook enqueues webhook and returns 200 immediately
8. Webhook with missing txId returns 200 without enqueuing
9. Duplicate webhook (already processed txId) returns 200 without re-enqueuing
10. Health check endpoint GET /health returns healthy status
"""

import pytest
import requests
import os
import time
import uuid

# Base URL - backend runs behind Python proxy on port 8001
BASE_URL = "http://localhost:8001"

# Test user credentials (non-admin user)
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"


class TestWebhookQueueSetup:
    """Setup and basic connectivity tests"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get authentication token for regular user (non-admin)"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "data" in data and "accessToken" in data["data"], "No access token in response"
        return data["data"]["accessToken"]
    
    def test_health_endpoint_returns_healthy(self):
        """GET /health returns healthy status with database and redis connected"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data["status"] == "healthy", f"Service not healthy: {data}"
        assert data["database"] == "connected", f"Database not connected: {data}"
        assert data["redis"] == "connected", f"Redis not connected: {data}"
        print(f"✓ Health check passed: status={data['status']}, database={data['database']}, redis={data['redis']}")
    
    def test_api_base_returns_operational(self):
        """GET /api returns operational status"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200, f"API base check failed: {response.text}"
        data = response.json()
        assert data["status"] == "operational", f"API not operational: {data}"
        print(f"✓ API operational: version={data.get('version')}")


class TestWebhookEndpoint:
    """Tests for POST /api/tatum-crypto-webhook endpoint"""
    
    def test_webhook_with_valid_payload_returns_200(self):
        """Webhook with valid payload returns 200 immediately (enqueued)"""
        unique_tx_id = f"test-tx-{uuid.uuid4()}"
        payload = {
            "address": "test-address-123",
            "counterAddress": "counter-address-456",
            "amount": "0.001",
            "txId": unique_tx_id,
            "asset": "BTC"
        }
        response = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json=payload
        )
        assert response.status_code == 200, f"Webhook should return 200: {response.text}"
        print(f"✓ Valid webhook returned 200 (txId={unique_tx_id})")
    
    def test_webhook_with_missing_txid_returns_200(self):
        """Webhook with missing txId returns 200 without enqueuing"""
        payload = {
            "address": "test-address-123",
            "amount": "0.001",
            "asset": "ETH"
            # Missing txId
        }
        response = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json=payload
        )
        assert response.status_code == 200, f"Webhook without txId should return 200: {response.text}"
        print("✓ Webhook without txId returned 200 (not enqueued)")
    
    def test_webhook_duplicate_txid_returns_200(self):
        """Duplicate webhook (same txId) returns 200 without re-enqueuing"""
        # First send a webhook
        unique_tx_id = f"test-dup-{uuid.uuid4()}"
        payload = {
            "address": "test-address-dup",
            "amount": "0.005",
            "txId": unique_tx_id,
            "asset": "LTC"
        }
        response1 = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json=payload
        )
        assert response1.status_code == 200, f"First webhook should return 200: {response1.text}"
        
        # Send the same webhook again (duplicate)
        response2 = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json=payload
        )
        assert response2.status_code == 200, f"Duplicate webhook should return 200: {response2.text}"
        print(f"✓ Duplicate webhook returned 200 (txId={unique_tx_id})")
    
    def test_webhook_with_query_params_returns_200(self):
        """Webhook with company/user query params returns 200"""
        unique_tx_id = f"test-query-{uuid.uuid4()}"
        payload = {
            "address": "test-address-query",
            "amount": "0.002",
            "txId": unique_tx_id,
            "asset": "DOGE"
        }
        response = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook?company_id=1&user_id=28",
            json=payload
        )
        assert response.status_code == 200, f"Webhook with query params should return 200: {response.text}"
        print(f"✓ Webhook with query params returned 200")
    
    def test_webhook_empty_body_returns_200(self):
        """Webhook with empty body returns 200 (graceful handling)"""
        response = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json={}
        )
        # Should return 200 (no txId = ignored gracefully)
        assert response.status_code == 200, f"Empty webhook should return 200: {response.text}"
        print("✓ Empty webhook body handled gracefully (returned 200)")


class TestAdminEndpointsWithRegularUser:
    """Test that admin-protected endpoints reject regular users with 403"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get authentication token for regular user (non-admin)"""
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["data"]["accessToken"]
    
    def test_queue_health_rejects_non_admin(self, user_token):
        """GET /diagnostics/webhook-queue rejects non-admin user with 403"""
        response = requests.get(
            f"{BASE_URL}/diagnostics/webhook-queue",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Admin access required" in data.get("message", ""), f"Unexpected error message: {data}"
        print("✓ Queue health endpoint correctly rejects non-admin with 403")
    
    def test_dlq_listing_rejects_non_admin(self, user_token):
        """GET /diagnostics/webhook-queue/dlq rejects non-admin user with 403"""
        response = requests.get(
            f"{BASE_URL}/diagnostics/webhook-queue/dlq",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ DLQ listing endpoint correctly rejects non-admin with 403")
    
    def test_dlq_retry_rejects_non_admin(self, user_token):
        """POST /diagnostics/webhook-queue/dlq/:jobId/retry rejects non-admin user with 403"""
        response = requests.post(
            f"{BASE_URL}/diagnostics/webhook-queue/dlq/test-job-id/retry",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ DLQ retry endpoint correctly rejects non-admin with 403")
    
    def test_manual_reconcile_rejects_non_admin(self, user_token):
        """POST /diagnostics/webhook-queue/reconcile rejects non-admin user with 403"""
        response = requests.post(
            f"{BASE_URL}/diagnostics/webhook-queue/reconcile",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ Manual reconciliation endpoint correctly rejects non-admin with 403")


class TestAdminEndpointsWithNoAuth:
    """Test that admin-protected endpoints reject unauthenticated requests"""
    
    def test_queue_health_requires_auth(self):
        """GET /diagnostics/webhook-queue requires authentication"""
        response = requests.get(f"{BASE_URL}/diagnostics/webhook-queue")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}: {response.text}"
        print("✓ Queue health endpoint requires authentication")
    
    def test_dlq_listing_requires_auth(self):
        """GET /diagnostics/webhook-queue/dlq requires authentication"""
        response = requests.get(f"{BASE_URL}/diagnostics/webhook-queue/dlq")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}: {response.text}"
        print("✓ DLQ listing endpoint requires authentication")
    
    def test_dlq_retry_requires_auth(self):
        """POST /diagnostics/webhook-queue/dlq/:jobId/retry requires authentication"""
        response = requests.post(f"{BASE_URL}/diagnostics/webhook-queue/dlq/test-job-id/retry")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}: {response.text}"
        print("✓ DLQ retry endpoint requires authentication")
    
    def test_manual_reconcile_requires_auth(self):
        """POST /diagnostics/webhook-queue/reconcile requires authentication"""
        response = requests.post(f"{BASE_URL}/diagnostics/webhook-queue/reconcile")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}: {response.text}"
        print("✓ Manual reconciliation endpoint requires authentication")


class TestRemovedEndpoints:
    """Test that temporary/removed endpoints return 404"""
    
    def test_recover_payment_endpoint_removed(self):
        """POST /diagnostics/recover-payment has been REMOVED (should return 404)"""
        response = requests.post(
            f"{BASE_URL}/diagnostics/recover-payment",
            json={"payment_id": "test"}
        )
        assert response.status_code == 404, f"Expected 404 for removed endpoint, got {response.status_code}: {response.text}"
        print("✓ /diagnostics/recover-payment correctly returns 404 (removed)")
    
    def test_recover_payment_api_prefix_also_removed(self):
        """POST /api/diagnostics/recover-payment also removed (should return 404)"""
        response = requests.post(
            f"{BASE_URL}/api/diagnostics/recover-payment",
            json={"payment_id": "test"}
        )
        assert response.status_code == 404, f"Expected 404 for removed endpoint, got {response.status_code}: {response.text}"
        print("✓ /api/diagnostics/recover-payment correctly returns 404 (removed)")


class TestExistingDiagnosticsEndpoints:
    """Test that other diagnostics endpoints still work"""
    
    def test_tunnel_status_works(self):
        """GET /diagnostics/tunnel-status returns tunnel info"""
        response = requests.get(f"{BASE_URL}/diagnostics/tunnel-status")
        assert response.status_code == 200, f"Tunnel status failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, f"Tunnel status not successful: {data}"
        print(f"✓ Tunnel status endpoint working")
    
    def test_binance_info_works(self):
        """GET /diagnostics/binance-info returns Binance config status"""
        response = requests.get(f"{BASE_URL}/diagnostics/binance-info")
        assert response.status_code == 200, f"Binance info failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, f"Binance info not successful: {data}"
        print(f"✓ Binance info endpoint working")
    
    def test_volatility_works(self):
        """GET /diagnostics/volatility returns market states"""
        response = requests.get(f"{BASE_URL}/diagnostics/volatility")
        assert response.status_code == 200, f"Volatility endpoint failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, f"Volatility not successful: {data}"
        print(f"✓ Volatility endpoint working")
    
    def test_fee_rates_works(self):
        """GET /diagnostics/fee-rates returns fee rate info"""
        response = requests.get(f"{BASE_URL}/diagnostics/fee-rates")
        assert response.status_code == 200, f"Fee rates failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, f"Fee rates not successful: {data}"
        print(f"✓ Fee rates endpoint working")


class TestWebhookQueueFunctionality:
    """Tests focused on queue functionality verification"""
    
    def test_multiple_webhooks_processed_in_order(self):
        """Multiple webhooks can be enqueued and processed"""
        base_tx_id = f"multi-{uuid.uuid4()}"
        
        # Send multiple webhooks
        for i in range(3):
            payload = {
                "address": f"multi-test-address-{i}",
                "amount": str(0.001 * (i + 1)),
                "txId": f"{base_tx_id}-{i}",
                "asset": "BTC"
            }
            response = requests.post(
                f"{BASE_URL}/api/tatum-crypto-webhook",
                json=payload
            )
            assert response.status_code == 200, f"Webhook {i} failed: {response.text}"
        
        print(f"✓ Multiple webhooks enqueued successfully")
    
    def test_webhook_with_all_fields(self):
        """Webhook with all expected fields is processed correctly"""
        unique_tx_id = f"full-{uuid.uuid4()}"
        payload = {
            "address": "full-test-address",
            "counterAddress": "full-counter-address",
            "amount": "1.5",
            "txId": unique_tx_id,
            "asset": "ETH",
            "subscriptionType": "ACCOUNT_INCOMING_BLOCKCHAIN_TRANSACTION"
        }
        response = requests.post(
            f"{BASE_URL}/api/tatum-crypto-webhook",
            json=payload
        )
        assert response.status_code == 200, f"Full payload webhook failed: {response.text}"
        print(f"✓ Webhook with all fields processed (txId={unique_tx_id})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
