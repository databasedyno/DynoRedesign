#!/usr/bin/env python3
"""
DynoPay Company ID Parameter Testing Suite
Testing specific endpoints to verify they accept company_id parameter correctly.

Review Request: Test DynoPay backend API to verify all endpoints accept 
company_id parameter correctly without causing 500 errors.

Backend base URL: http://localhost:8001

Test the following endpoints to verify they accept company_id and respond without 500 errors:

1. GET /api - Health check (expect 200)
2. POST /api/wallet/getAllTransactions with body {"company_id": 1} (expect 401 - auth required)
3. GET /api/wallet/getWallet?company_id=1 (expect 401 - auth required)
4. GET /api/wallet/getWalletAddresses?company_id=1 (expect 401 - auth required)
5. GET /api/pay/getPaymentLinks?company_id=1 (expect 401 - auth required)
6. POST /api/pay/createPaymentLink with body {"company_id": 1, "amount": 10, "currency": "USD"} (expect 401 - auth required)
7. GET /api/userApi/getApi?company_id=1 (expect 401 - auth required)
8. GET /api/userApi/customers?company_id=1 (expect 401 - auth required)
9. GET /api/invoices?company_id=1 (expect 401 - auth required)
10. GET /api/notifications?company_id=1 (expect 401 - auth required)
11. PUT /api/notifications/read-all with body {"company_id": 1} (expect 401 - auth required)
12. GET /api/notifications/preferences?company_id=1 (expect 401 - auth required)
13. PUT /api/notifications/preferences with body {"company_id": 1, "transaction_updates": true} (expect 401 - auth required)
14. GET /api/invoices/tax-report?company_id=1 (expect 401 - auth required)
15. POST /api/wallet/exportTransactions with body {"company_id": 1} (expect 401 - auth required)
16. GET /api/company/auto-convert/1 (expect 401 - auth required)
17. GET /api/company/webhook-settings/1 (expect 401 - auth required)

Key verification:
- All protected endpoints return 401 (not 404 or 500) when company_id is provided without auth
- company_id parameter does NOT cause any server errors
- Routes are properly registered and accessible
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Backend URL - use localhost:8001 as specified in review request
BACKEND_URL = "http://localhost:8001"

class DynoPayCompanyIdTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_result(self, test_name: str, status: str, details: str):
        """Log test results"""
        result = {
            'test': test_name,
            'status': status,  # 'PASS' or 'FAIL'
            'details': details
        }
        self.test_results.append(result)
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"{status_symbol} {test_name}: {details}")
    
    def test_health_check(self):
        """Test 1: GET /api - Health check (expect 200)"""
        try:
            response = self.session.get(f"{self.backend_url}/api", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    status = data.get('status', 'unknown')
                    service = data.get('service', 'DynoPay API')
                    
                    self.log_result(
                        "GET /api - Health Check", 
                        "PASS", 
                        f"Health check returned 200 - {service} status: {status}"
                    )
                except ValueError:
                    self.log_result(
                        "GET /api - Health Check", 
                        "PASS", 
                        f"Health check returned 200 (non-JSON response)"
                    )
            else:
                self.log_result(
                    "GET /api - Health Check", 
                    "FAIL", 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api - Health Check", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_get_all_transactions(self):
        """Test 2: POST /api/wallet/getAllTransactions with body {"company_id": 1} (expect 401)"""
        try:
            response = self.session.post(
                f"{self.backend_url}/api/wallet/getAllTransactions",
                json={"company_id": 1},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 401 (auth required)"
                )
            elif response.status_code == 403:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 403 (not 500/404)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/wallet/getAllTransactions", 
                    "FAIL", 
                    f"Unexpected status {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/getAllTransactions", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_get_wallet(self):
        """Test 3: GET /api/wallet/getWallet?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/wallet/getWallet?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/wallet/getWallet", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/wallet/getWallet", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/wallet/getWallet", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/wallet/getWallet", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/wallet/getWallet", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_get_addresses(self):
        """Test 4: GET /api/wallet/getWalletAddresses?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/wallet/getWalletAddresses?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/wallet/getWalletAddresses", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/wallet/getWalletAddresses", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/wallet/getWalletAddresses", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/wallet/getWalletAddresses", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/wallet/getWalletAddresses", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_pay_get_payment_links(self):
        """Test 5: GET /api/pay/getPaymentLinks?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/pay/getPaymentLinks?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/pay/getPaymentLinks", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/pay/getPaymentLinks", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/pay/getPaymentLinks", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/pay/getPaymentLinks", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/pay/getPaymentLinks", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_pay_create_payment_link(self):
        """Test 6: POST /api/pay/createPaymentLink with body {"company_id": 1, "amount": 10, "currency": "USD"} (expect 401)"""
        try:
            response = self.session.post(
                f"{self.backend_url}/api/pay/createPaymentLink",
                json={"company_id": 1, "amount": 10, "currency": "USD"},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "POST /api/pay/createPaymentLink", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 401 (auth required)"
                )
            elif response.status_code == 403:
                self.log_result(
                    "POST /api/pay/createPaymentLink", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 403 (not 500/404)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/pay/createPaymentLink", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/pay/createPaymentLink", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/pay/createPaymentLink", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/pay/createPaymentLink", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_user_api_get_api(self):
        """Test 7: GET /api/userApi/getApi?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/userApi/getApi?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/userApi/getApi", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/userApi/getApi", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/userApi/getApi", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/userApi/getApi", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/userApi/getApi", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_user_api_customers(self):
        """Test 8: GET /api/userApi/customers?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/userApi/customers?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/userApi/customers", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/userApi/customers", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_invoices(self):
        """Test 9: GET /api/invoices?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/invoices?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/invoices", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/invoices", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/invoices", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/invoices", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/invoices", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_notifications(self):
        """Test 10: GET /api/notifications?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/notifications?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/notifications", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/notifications", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/notifications", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/notifications", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/notifications", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_notifications_read_all(self):
        """Test 11: PUT /api/notifications/read-all with body {"company_id": 1} (expect 401)"""
        try:
            response = self.session.put(
                f"{self.backend_url}/api/notifications/read-all",
                json={"company_id": 1},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "PUT /api/notifications/read-all", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 401 (auth required)"
                )
            elif response.status_code == 403:
                self.log_result(
                    "PUT /api/notifications/read-all", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 403 (not 500/404)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "PUT /api/notifications/read-all", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "PUT /api/notifications/read-all", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "PUT /api/notifications/read-all", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "PUT /api/notifications/read-all", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_notifications_preferences_get(self):
        """Test 12: GET /api/notifications/preferences?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/notifications/preferences?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/notifications/preferences", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/notifications/preferences", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/notifications/preferences", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/notifications/preferences", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/notifications/preferences", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_notifications_preferences_put(self):
        """Test 13: PUT /api/notifications/preferences with body {"company_id": 1, "transaction_updates": true} (expect 401)"""
        try:
            response = self.session.put(
                f"{self.backend_url}/api/notifications/preferences",
                json={"company_id": 1, "transaction_updates": True},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "PUT /api/notifications/preferences", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 401 (auth required)"
                )
            elif response.status_code == 403:
                self.log_result(
                    "PUT /api/notifications/preferences", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 403 (not 500/404)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "PUT /api/notifications/preferences", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "PUT /api/notifications/preferences", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "PUT /api/notifications/preferences", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "PUT /api/notifications/preferences", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_invoices_tax_report(self):
        """Test 14: GET /api/invoices/tax-report?company_id=1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/invoices/tax-report?company_id=1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/invoices/tax-report", 
                    "PASS", 
                    "Accepts company_id query param, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/invoices/tax-report", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/invoices/tax-report", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/invoices/tax-report", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/invoices/tax-report", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_wallet_export_transactions(self):
        """Test 15: POST /api/wallet/exportTransactions with body {"company_id": 1} (expect 401)"""
        try:
            response = self.session.post(
                f"{self.backend_url}/api/wallet/exportTransactions",
                json={"company_id": 1},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "POST /api/wallet/exportTransactions", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 401 (auth required)"
                )
            elif response.status_code == 403:
                self.log_result(
                    "POST /api/wallet/exportTransactions", 
                    "PASS", 
                    "Accepts company_id in body, correctly returns 403 (not 500/404)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/wallet/exportTransactions", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "POST /api/wallet/exportTransactions", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "POST /api/wallet/exportTransactions", 
                    "FAIL", 
                    f"Expected 401/403, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "POST /api/wallet/exportTransactions", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_company_auto_convert(self):
        """Test 16: GET /api/company/auto-convert/1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/company/auto-convert/1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/company/auto-convert/1", 
                    "PASS", 
                    "Company ID in URL path, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/company/auto-convert/1", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/company/auto-convert/1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/company/auto-convert/1", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/company/auto-convert/1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def test_company_webhook_settings(self):
        """Test 17: GET /api/company/webhook-settings/1 (expect 401)"""
        try:
            response = self.session.get(
                f"{self.backend_url}/api/company/webhook-settings/1",
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_result(
                    "GET /api/company/webhook-settings/1", 
                    "PASS", 
                    "Company ID in URL path, correctly returns 401 (auth required)"
                )
            elif response.status_code == 404:
                self.log_result(
                    "GET /api/company/webhook-settings/1", 
                    "FAIL", 
                    "Endpoint not found (404) - route not registered"
                )
            elif response.status_code == 500:
                self.log_result(
                    "GET /api/company/webhook-settings/1", 
                    "FAIL", 
                    f"Server error (500) - company_id parameter may be causing issues: {response.text[:200]}"
                )
            else:
                self.log_result(
                    "GET /api/company/webhook-settings/1", 
                    "FAIL", 
                    f"Expected 401, got {response.status_code}: {response.text[:200]}"
                )
        except Exception as e:
            self.log_result(
                "GET /api/company/webhook-settings/1", 
                "FAIL", 
                f"Connection error: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all company_id parameter tests for DynoPay backend"""
        print(f"\n🧪 Testing DynoPay Backend API Company ID Parameter Acceptance")
        print(f"Backend URL: {self.backend_url}")
        print("="*80)
        print("Testing 17 endpoints to verify:")
        print("1. All endpoints accept company_id parameter without 500 errors")
        print("2. Protected endpoints return 401 (not 404 or 500) when company_id is provided without auth")
        print("3. Routes are properly registered and accessible")
        print("="*80)
        
        # Test all 17 endpoints as specified in review request
        self.test_health_check()                        # 1
        self.test_wallet_get_all_transactions()         # 2
        self.test_wallet_get_wallet()                   # 3
        self.test_wallet_get_addresses()                # 4
        self.test_pay_get_payment_links()               # 5
        self.test_pay_create_payment_link()             # 6
        self.test_user_api_get_api()                    # 7
        self.test_user_api_customers()                  # 8
        self.test_invoices()                            # 9
        self.test_notifications()                       # 10
        self.test_notifications_read_all()              # 11
        self.test_notifications_preferences_get()       # 12
        self.test_notifications_preferences_put()       # 13
        self.test_invoices_tax_report()                 # 14
        self.test_wallet_export_transactions()          # 15
        self.test_company_auto_convert()                # 16
        self.test_company_webhook_settings()            # 17
        
        # Summary
        print("\n📊 Test Summary:")
        print("="*80)
        
        passed = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed = sum(1 for result in self.test_results if result['status'] == 'FAIL')
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        # Key verification points - only count FAILED tests with these issues
        print(f"\n🔍 Key Verification Points:")
        server_errors = sum(1 for result in self.test_results if result['status'] == 'FAIL' and "500" in result['details'])
        not_found_errors = sum(1 for result in self.test_results if result['status'] == 'FAIL' and "404" in result['details'])
        auth_protected = sum(1 for result in self.test_results if result['status'] == 'PASS' and ("401" in result['details'] or "403" in result['details']))
        
        print(f"  • No 500 Server Errors: {'✅' if server_errors == 0 else '❌'} ({server_errors} found)")
        print(f"  • No 404 Route Errors: {'✅' if not_found_errors == 0 else '❌'} ({not_found_errors} found)")
        print(f"  • Proper Auth Protection: {'✅' if auth_protected >= 16 else '❌'} ({auth_protected}/16 protected endpoints)")
        
        if failed > 0:
            print(f"\n🔍 Failed Tests:")
            for result in self.test_results:
                if result['status'] == 'FAIL':
                    print(f"  • {result['test']}: {result['details']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = DynoPayCompanyIdTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)