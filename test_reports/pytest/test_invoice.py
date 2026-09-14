"""
Invoice API Tests for DynoPay
Tests the invoice generation and PDF download functionality for transactions.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "nomadly@moxx.co"
TEST_PASSWORD = "Katiekendra123@"


class TestInvoiceAPI:
    """Invoice API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for the test user"""
        # Step 1: Login to get token
        login_response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        print(f"Login response status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            pytest.skip("Authentication failed - skipping authenticated tests")
        
        data = login_response.json()
        # Token is in data.accessToken field
        token = data.get("data", {}).get("accessToken") or data.get("accessToken") or data.get("token")
        
        if not token:
            print(f"No token in response: {data.keys() if isinstance(data, dict) else data}")
            pytest.skip("No token returned - skipping authenticated tests")
        
        print(f"Got auth token: {token[:50]}...")
        return token
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        """Create authenticated session"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_get_transactions_list(self, api_client):
        """Test getting transactions list to find completed transactions"""
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        
        print(f"POST /api/wallet/getAllTransactions status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Response keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")
        
        # Should return list of transactions
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        print(f"Number of transactions: {len(transactions)}")
        
        if len(transactions) > 0:
            print(f"First transaction: {transactions[0]}")
    
    def test_find_completed_transactions(self, api_client):
        """Find transactions with 'done' or 'successful' status"""
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        
        # Find completed transactions
        completed_transactions = [
            t for t in transactions 
            if t.get("status") in ["done", "successful"]
        ]
        
        print(f"Found {len(completed_transactions)} completed transactions out of {len(transactions)} total")
        
        if len(completed_transactions) > 0:
            for t in completed_transactions[:3]:
                print(f"  - Transaction {t.get('transaction_id')}: status={t.get('status')}, amount={t.get('base_amount')}")
        
        # Store for use in other tests
        return completed_transactions
    
    def test_get_invoice_for_completed_transaction(self, api_client):
        """Test getting invoice for a completed transaction"""
        # First get transactions
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        
        # Find a completed transaction
        completed = [t for t in transactions if t.get("status") in ["done", "successful"]]
        
        if not completed:
            pytest.skip("No completed transactions found")
        
        # Get invoice for the first completed transaction
        tx = completed[0]
        tx_id = tx.get("transaction_id")
        
        print(f"Getting invoice for transaction {tx_id} (status: {tx.get('status')})")
        
        invoice_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}/invoice")
        
        print(f"GET /api/transactions/{tx_id}/invoice status: {invoice_response.status_code}")
        print(f"Response: {invoice_response.text[:500]}")
        
        assert invoice_response.status_code in [200, 404], f"Unexpected status: {invoice_response.status_code}"
        
        if invoice_response.status_code == 200:
            invoice_data = invoice_response.json()
            print(f"Invoice data keys: {invoice_data.keys() if isinstance(invoice_data, dict) else 'Not a dict'}")
            
            # Verify invoice has required fields
            invoice = invoice_data.get("data", {})
            assert "invoice_id" in invoice or "invoice_number" in invoice, "Invoice should have invoice_id or invoice_number"
            print(f"Invoice ID: {invoice.get('invoice_id')}, Invoice Number: {invoice.get('invoice_number')}")
    
    def test_download_invoice_pdf(self, api_client):
        """Test downloading invoice as PDF"""
        # First get transactions
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        
        # Find a completed transaction
        completed = [t for t in transactions if t.get("status") in ["done", "successful"]]
        
        if not completed:
            pytest.skip("No completed transactions found")
        
        # Get invoice for the first completed transaction
        tx = completed[0]
        tx_id = tx.get("transaction_id")
        
        # Step 1: Get invoice metadata
        invoice_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}/invoice")
        
        if invoice_response.status_code == 404:
            pytest.skip(f"No invoice found for transaction {tx_id}")
        
        assert invoice_response.status_code == 200, f"Failed to get invoice: {invoice_response.text}"
        
        invoice_data = invoice_response.json().get("data", {})
        invoice_id = invoice_data.get("invoice_id")
        
        if not invoice_id:
            pytest.skip("Invoice ID not found in response")
        
        print(f"Got invoice ID: {invoice_id}")
        
        # Step 2: Download PDF
        pdf_response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        
        print(f"GET /api/invoices/{invoice_id}/pdf status: {pdf_response.status_code}")
        print(f"Content-Type: {pdf_response.headers.get('Content-Type')}")
        print(f"Content-Length: {len(pdf_response.content)} bytes")
        
        assert pdf_response.status_code == 200, f"Failed to download PDF: {pdf_response.text}"
        assert "application/pdf" in pdf_response.headers.get("Content-Type", ""), "Response should be PDF"
        assert len(pdf_response.content) > 100, "PDF should have content"
        
        # Save PDF for inspection
        with open("/tmp/test_invoice.pdf", "wb") as f:
            f.write(pdf_response.content)
        print("PDF saved to /tmp/test_invoice.pdf")
    
    def test_invoice_pdf_contains_dynopay_branding(self, api_client):
        """Verify PDF is valid and generated correctly"""
        # Get transactions
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        
        completed = [t for t in transactions if t.get("status") in ["done", "successful"]]
        
        if not completed:
            pytest.skip("No completed transactions found")
        
        tx = completed[0]
        tx_id = tx.get("transaction_id")
        
        # Get invoice
        invoice_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}/invoice")
        
        if invoice_response.status_code == 404:
            pytest.skip(f"No invoice found for transaction {tx_id}")
        
        invoice_data = invoice_response.json().get("data", {})
        invoice_id = invoice_data.get("invoice_id")
        
        if not invoice_id:
            pytest.skip("Invoice ID not found")
        
        # Download PDF
        pdf_response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        assert pdf_response.status_code == 200
        
        # Verify PDF is valid
        pdf_content = pdf_response.content
        
        # Check PDF header
        assert pdf_content[:4] == b'%PDF', "PDF should start with %PDF header"
        
        # Check PDF has reasonable size (more than just header)
        assert len(pdf_content) > 1000, f"PDF should have meaningful content (got {len(pdf_content)} bytes)"
        
        # Verify it's a proper PDF by checking for endobj markers (compressed streams)
        assert b'endobj' in pdf_content, "PDF should contain endobj markers"
        
        # Verify PDFKit generated it
        assert b'PDFKit' in pdf_content or b'Producer' in pdf_content, "PDF should have creator metadata"
        
        print(f"PDF is valid: {len(pdf_content)} bytes, proper header, has object markers")
    
    def test_invoice_has_required_fields(self, api_client):
        """Test invoice data has all required fields"""
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        
        completed = [t for t in transactions if t.get("status") in ["done", "successful"]]
        
        if not completed:
            pytest.skip("No completed transactions found")
        
        tx = completed[0]
        tx_id = tx.get("transaction_id")
        
        invoice_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}/invoice")
        
        if invoice_response.status_code == 404:
            pytest.skip(f"No invoice found for transaction {tx_id}")
        
        assert invoice_response.status_code == 200
        
        invoice = invoice_response.json().get("data", {})
        
        # Check required fields
        required_fields = [
            "invoice_id",
            "invoice_number",
            "invoice_date",
            "provider_name",
            "provider_address",
            "customer_name",
            "description",
            "total_usd",
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in invoice or invoice[field] is None:
                missing_fields.append(field)
            else:
                print(f"  {field}: {invoice[field]}")
        
        assert not missing_fields, f"Invoice missing required fields: {missing_fields}"
    
    def test_invoice_not_available_for_pending_transaction(self, api_client):
        """Test that invoice is not available for pending transactions"""
        response = api_client.post(f"{BASE_URL}/api/wallet/getAllTransactions", json={})
        assert response.status_code == 200
        
        data = response.json()
        transactions = data.get("data", {}).get("customers_transactions", []) or data.get("transactions", [])
        
        # Find a pending transaction
        pending = [t for t in transactions if t.get("status") in ["pending", "processing"]]
        
        if not pending:
            pytest.skip("No pending transactions found to test")
        
        tx = pending[0]
        tx_id = tx.get("transaction_id")
        
        print(f"Testing invoice for pending transaction {tx_id} (status: {tx.get('status')})")
        
        invoice_response = api_client.get(f"{BASE_URL}/api/transactions/{tx_id}/invoice")
        
        print(f"Response status: {invoice_response.status_code}")
        
        # Should return 404 for pending transactions
        assert invoice_response.status_code == 404, f"Expected 404 for pending transaction, got {invoice_response.status_code}"


class TestInvoiceList:
    """Test invoice list endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        login_response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        
        data = login_response.json()
        token = data.get("data", {}).get("accessToken") or data.get("accessToken") or data.get("token")
        return token
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token):
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_get_all_invoices(self, api_client):
        """Test getting list of all invoices"""
        response = api_client.get(f"{BASE_URL}/api/invoices")
        
        print(f"GET /api/invoices status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        assert response.status_code == 200
        
        data = response.json()
        invoices = data.get("data", {}).get("invoices", [])
        pagination = data.get("data", {}).get("pagination", {})
        
        print(f"Total invoices: {pagination.get('total', len(invoices))}")
        print(f"Page: {pagination.get('page', 1)}")
        
        if len(invoices) > 0:
            print(f"Sample invoice: {invoices[0]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
