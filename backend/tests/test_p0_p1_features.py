"""
P0 + P1 Feature Tests: Reconciliation 7-day filter and DLQ Email Alert

Test Cases:
1. Reconciliation service code review (7-day filter implementation)
2. sendDLQAlert function exists and integrates properly  
3. DLQ alert only fires when ADMIN_EMAIL is configured
4. Queue health endpoint: GET /diagnostics/webhook-queue
5. DLQ listing endpoint: GET /diagnostics/webhook-queue/dlq
6. DLQ retry endpoint: POST /diagnostics/webhook-queue/dlq/:jobId/retry
7. Manual reconciliation endpoint: POST /diagnostics/webhook-queue/reconcile
8. Webhook enqueue endpoint: POST /api/tatum-crypto-webhook
9. Backend starts without errors
10. Graceful shutdown test
"""

import pytest
import requests
import os
import uuid

# Use external URL for API calls (PUBLIC_URL)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
# Fallback to internal URL if env not set
if not BASE_URL:
    BASE_URL = "https://multi-chain-checkout-4.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "richard@dyno.pt"
TEST_PASSWORD = "Katiekendra123@"


class TestAuthentication:
    """Test user login to get auth token"""
    
    def test_login_success(self):
        """Login to get authentication token"""
        response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "data" in data
        assert "accessToken" in data["data"]
        # Store token for later tests
        pytest.auth_token = data["data"]["accessToken"]
        print("✓ Login successful, token obtained")


class TestQueueHealthEndpoint:
    """Test GET /diagnostics/webhook-queue endpoint"""
    
    def test_queue_health_unauthenticated(self):
        """Queue health should require authentication"""
        # Internal port bypasses K8s ingress routing
        response = requests.get("http://localhost:8001/diagnostics/webhook-queue")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Queue health requires auth (403 for unauthenticated)")
    
    def test_queue_health_non_admin(self):
        """Queue health should require admin role"""
        token = getattr(pytest, 'auth_token', None)
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            "http://localhost:8001/diagnostics/webhook-queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        # richard@dyno.pt is NOT an admin, should get 403
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ Queue health requires admin role (403 for non-admin user)")


class TestDLQListingEndpoint:
    """Test GET /diagnostics/webhook-queue/dlq endpoint"""
    
    def test_dlq_listing_unauthenticated(self):
        """DLQ listing should require authentication"""
        response = requests.get("http://localhost:8001/diagnostics/webhook-queue/dlq")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ DLQ listing requires auth (403 for unauthenticated)")
    
    def test_dlq_listing_non_admin(self):
        """DLQ listing should require admin role"""
        token = getattr(pytest, 'auth_token', None)
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            "http://localhost:8001/diagnostics/webhook-queue/dlq",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ DLQ listing requires admin role (403 for non-admin user)")


class TestDLQRetryEndpoint:
    """Test POST /diagnostics/webhook-queue/dlq/:jobId/retry endpoint"""
    
    def test_dlq_retry_unauthenticated(self):
        """DLQ retry should require authentication"""
        response = requests.post("http://localhost:8001/diagnostics/webhook-queue/dlq/test-job-id/retry")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ DLQ retry requires auth (403 for unauthenticated)")
    
    def test_dlq_retry_non_admin(self):
        """DLQ retry should require admin role"""
        token = getattr(pytest, 'auth_token', None)
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.post(
            "http://localhost:8001/diagnostics/webhook-queue/dlq/test-job-id/retry",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ DLQ retry requires admin role (403 for non-admin user)")


class TestManualReconcileEndpoint:
    """Test POST /diagnostics/webhook-queue/reconcile endpoint"""
    
    def test_reconcile_unauthenticated(self):
        """Manual reconciliation should require authentication"""
        response = requests.post("http://localhost:8001/diagnostics/webhook-queue/reconcile")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Manual reconcile requires auth (403 for unauthenticated)")
    
    def test_reconcile_non_admin(self):
        """Manual reconciliation should require admin role"""
        token = getattr(pytest, 'auth_token', None)
        if not token:
            pytest.skip("No auth token available")
        
        response = requests.post(
            "http://localhost:8001/diagnostics/webhook-queue/reconcile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("✓ Manual reconcile requires admin role (403 for non-admin user)")


class TestWebhookEnqueueEndpoint:
    """Test POST /api/tatum-crypto-webhook endpoint"""
    
    def test_webhook_enqueue_valid_payload(self):
        """Webhook should enqueue valid payload and return 200"""
        unique_tx_id = f"TEST-TX-{uuid.uuid4()}"
        
        response = requests.post(f"{BASE_URL}/api/tatum-crypto-webhook", json={
            "address": "0x1234567890abcdef1234567890abcdef12345678",
            "amount": "0.001",
            "txId": unique_tx_id,
            "asset": "ETH"
        })
        
        # Should return 200 immediately (async enqueue)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in data or "message" in data
        print(f"✓ Webhook enqueue returns 200 for valid payload (txId={unique_tx_id[:20]}...)")
    
    def test_webhook_enqueue_missing_txid(self):
        """Webhook should handle missing txId gracefully"""
        response = requests.post(f"{BASE_URL}/api/tatum-crypto-webhook", json={
            "address": "0x1234567890abcdef1234567890abcdef12345678",
            "amount": "0.001",
            "asset": "ETH"
            # No txId
        })
        
        # Should return 200 (graceful handling - doesn't enqueue without txId)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Webhook handles missing txId gracefully (returns 200)")
    
    def test_webhook_enqueue_duplicate_detection(self):
        """Webhook should detect duplicate txIds"""
        # Use a txId that was likely already processed
        response = requests.post(f"{BASE_URL}/api/tatum-crypto-webhook", json={
            "address": "0x1234567890abcdef1234567890abcdef12345678",
            "amount": "0.001",
            "txId": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            "asset": "ETH"
        })
        
        # Should still return 200 (duplicates are handled gracefully)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Webhook handles duplicate txId gracefully (returns 200)")


class TestHealthEndpoint:
    """Test backend health endpoint"""
    
    def test_health_endpoint_status(self):
        """Health endpoint should return healthy status"""
        response = requests.get("http://localhost:8001/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] in ["healthy", "degraded"]
        assert data["database"] == "connected"
        assert data["redis"] == "connected"
        print(f"✓ Health endpoint returns {data['status']} (DB: {data['database']}, Redis: {data['redis']})")


class TestRootEndpoint:
    """Test root API endpoint"""
    
    def test_root_endpoint(self):
        """Root endpoint should return API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "operational"
        print("✓ API root endpoint returns operational status")


class TestCodeReview:
    """Code review tests for P0 and P1 features - verify implementation via inspection"""
    
    def test_reconciliation_7day_filter_exists(self):
        """Verify 7-day time filter is implemented in reconcileTatumFailedWebhooks"""
        # Read the reconciliation.ts file
        reconciliation_file = "/app/backend/services/reconciliation.ts"
        
        with open(reconciliation_file, 'r') as f:
            content = f.read()
        
        # Check for 7-day filter implementation
        assert "MAX_AGE_DAYS = 7" in content, "7-day constant not found"
        assert "maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000" in content, "maxAgeMs calculation not found"
        assert "cutoffTime = Date.now() - maxAgeMs" in content, "cutoffTime not found"
        assert "webhookTime < cutoffTime" in content, "Time comparison not found"
        
        # Check for summary logging (skippedStale counter)
        assert "skippedStale" in content, "skippedStale counter not found"
        assert "skippedProcessed" in content, "skippedProcessed counter not found"
        
        # Check for clean summary log
        assert "Tatum webhooks:" in content and "re-queued" in content and "skipped (older than" in content, \
            "Summary log message not found"
        
        print("✓ P0: Reconciliation 7-day filter implementation verified")
        print("  - MAX_AGE_DAYS = 7 constant present")
        print("  - Cutoff time calculation present")
        print("  - Time comparison logic present")
        print("  - Summary log with counts present")
    
    def test_dlq_alert_function_exists(self):
        """Verify sendDLQAlert function exists in webhookQueue.ts"""
        webhook_queue_file = "/app/backend/services/webhookQueue.ts"
        
        with open(webhook_queue_file, 'r') as f:
            content = f.read()
        
        # Check for sendDLQAlert function
        assert "async function sendDLQAlert" in content, "sendDLQAlert function not found"
        
        # Check function signature
        assert "jobData: WebhookJobData" in content, "jobData parameter not found"
        assert "jobId: string" in content, "jobId parameter not found"
        assert "attempts: number" in content, "attempts parameter not found"
        assert "errorMessage: string" in content, "errorMessage parameter not found"
        
        # Check for ADMIN_EMAIL guard
        assert 'const adminEmail = process.env.ADMIN_EMAIL' in content, "ADMIN_EMAIL check not found"
        assert 'if (!adminEmail) return' in content, "Early return for missing ADMIN_EMAIL not found"
        
        # Check email content components
        assert "Dead Letter Queue" in content, "DLQ mention in email not found"
        assert "payload.txId" in content, "txId in email not found"
        assert "exhausted all retries" in content, "Retry exhaustion message not found"
        
        print("✓ P1: sendDLQAlert function implementation verified")
        print("  - Function signature correct")
        print("  - ADMIN_EMAIL guard present")
        print("  - Email content includes txId and DLQ info")
    
    def test_dlq_alert_called_on_retry_exhaustion(self):
        """Verify sendDLQAlert is called when retries are exhausted"""
        webhook_queue_file = "/app/backend/services/webhookQueue.ts"
        
        with open(webhook_queue_file, 'r') as f:
            content = f.read()
        
        # Check that sendDLQAlert is called in the failed handler
        assert 'worker.on("failed"' in content, "Failed event handler not found"
        assert "attemptsLeft <= 0" in content or "attemptsLeft <= 1" in content or "exhausted" in content.lower(), \
            "Retry exhaustion check not found"
        assert "sendDLQAlert(job.data, job.id" in content, "sendDLQAlert call not found in failed handler"
        assert ".catch(() => {})" in content or ".catch" in content, "Error handling for sendDLQAlert not found"
        
        print("✓ P1: sendDLQAlert is called when job retries exhausted")
        print("  - Failed event handler present")
        print("  - Retry exhaustion check present")
        print("  - sendDLQAlert called with job data")
    
    def test_email_template_helpers_imported(self):
        """Verify email template helpers are imported in webhookQueue.ts"""
        webhook_queue_file = "/app/backend/services/webhookQueue.ts"
        
        with open(webhook_queue_file, 'r') as f:
            content = f.read()
        
        # Check imports
        assert 'baseEmailTemplate' in content, "baseEmailTemplate import not found"
        assert 'infoBox' in content, "infoBox import not found"
        assert 'dataRow' in content, "dataRow import not found"
        assert 'statusBadge' in content, "statusBadge import not found"
        assert 'from "../utils/emailTemplate"' in content, "emailTemplate import path not found"
        
        # Check mail transporter usage
        assert 'mailTransporter' in content.lower() or 'getMailTransporter' in content, \
            "Mail transporter not found"
        
        print("✓ Email template helpers properly imported")
        print("  - baseEmailTemplate, infoBox, dataRow, statusBadge imported")
        print("  - Mail transporter integration present")
    
    def test_graceful_shutdown_implementation(self):
        """Verify graceful shutdown properly closes queue and worker"""
        server_file = "/app/backend/server.ts"
        webhook_queue_file = "/app/backend/services/webhookQueue.ts"
        
        with open(server_file, 'r') as f:
            server_content = f.read()
        
        with open(webhook_queue_file, 'r') as f:
            queue_content = f.read()
        
        # Check server.ts for shutdown handling
        assert "shutdownWebhookQueue" in server_content, "shutdownWebhookQueue not called in server.ts"
        assert 'process.on(\'SIGTERM\'' in server_content or "process.on(\"SIGTERM\"" in server_content, \
            "SIGTERM handler not found"
        assert 'process.on(\'SIGINT\'' in server_content or "process.on(\"SIGINT\"" in server_content, \
            "SIGINT handler not found"
        
        # Check webhookQueue.ts for shutdown function
        assert "export async function shutdownWebhookQueue" in queue_content, \
            "shutdownWebhookQueue function not exported"
        assert "worker.close()" in queue_content, "Worker close not found"
        assert "webhookQueue.close()" in queue_content, "Queue close not found"
        assert "deadLetterQueue.close()" in queue_content, "DLQ close not found"
        
        print("✓ Graceful shutdown implementation verified")
        print("  - SIGTERM/SIGINT handlers present")
        print("  - shutdownWebhookQueue called during shutdown")
        print("  - Worker, queue, and DLQ properly closed")


class TestBullMQWorkerStartup:
    """Verify BullMQ worker starts correctly"""
    
    def test_worker_startup_in_server(self):
        """Verify BullMQ worker is started in server.ts"""
        server_file = "/app/backend/server.ts"
        
        with open(server_file, 'r') as f:
            content = f.read()
        
        # Check for worker startup
        assert "startWebhookWorker" in content, "startWebhookWorker not found in server.ts"
        assert "processWebhookJob" in content, "processWebhookJob not passed to worker"
        
        print("✓ BullMQ worker startup verified in server.ts")
    
    def test_reconciliation_on_startup(self):
        """Verify reconciliation runs on startup"""
        server_file = "/app/backend/server.ts"
        
        with open(server_file, 'r') as f:
            content = f.read()
        
        # Check for reconciliation call
        assert "runStartupReconciliation" in content, "runStartupReconciliation not called in server.ts"
        
        print("✓ Startup reconciliation call verified in server.ts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
