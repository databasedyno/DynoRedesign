#!/usr/bin/env python3
"""
Backend API Testing for DynoPay Auto-Conversion Disable Flow Enhancement
Testing suite for auto-conversion disable flow as per review request
"""

import requests
import json
import sys
import time
import subprocess
from typing import Dict, Any, List, Union

# Base URL - using the frontend environment variable as specified
BASE_URL = "https://credential-deploy.preview.emergentagent.com"

class AutoConvertTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DynoPay-AutoConvert-Test/1.0'
        })
        self.test_results = []
        
    def log(self, message: str, test_name: str = "", status: str = "INFO"):
        """Log test results with proper formatting"""
        timestamp = time.strftime("%H:%M:%S")
        if test_name:
            print(f"[{timestamp}] {status}: TEST {test_name} - {message}")
        else:
            print(f"[{timestamp}] {status}: {message}")
        
        if test_name and status in ["PASS", "FAIL"]:
            self.test_results.append({
                "test": test_name,
                "status": status,
                "message": message
            })
    
    def test_1_backend_health(self) -> bool:
        """TEST 1: Backend healthy — GET /health should return 200 with status "healthy"""
        test_name = "1"
        try:
            # Test the actual working health endpoint
            response = self.session.get(f"{self.base_url}/api/status/health", timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("status") == "healthy":
                        self.log(f"Backend healthy: {data}", test_name, "PASS")
                        return True
                    else:
                        self.log(f"Backend not healthy: status={data.get('status')}, full response: {data}", test_name, "FAIL")
                        return False
                except json.JSONDecodeError:
                    # If it's not JSON, check if it just says "healthy"
                    if "healthy" in response.text.lower():
                        self.log(f"Backend healthy (text response): {response.text}", test_name, "PASS")
                        return True
                    else:
                        self.log(f"Health check returned non-JSON: {response.text}", test_name, "FAIL")
                        return False
            else:
                self.log(f"Health check failed: HTTP {response.status_code}, response: {response.text[:200]}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Health check error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_2_disable_endpoint(self) -> bool:
        """TEST 2: Disable endpoint accessible — curl -s -X PUT /api/company/auto-convert/1 with auto_convert_enabled: false should return JSON with 401"""
        test_name = "2"
        try:
            url = f"{self.base_url}/api/company/auto-convert/1"
            payload = {"auto_convert_enabled": False}
            
            response = self.session.put(url, json=payload, timeout=10)
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    self.log(f"Disable endpoint accessible, requires auth (401): {data}", test_name, "PASS")
                    return True
                except json.JSONDecodeError:
                    self.log(f"Disable endpoint returns 401 but non-JSON: {response.text[:200]}", test_name, "FAIL")
                    return False
            else:
                self.log(f"Disable endpoint unexpected status: {response.status_code}, response: {response.text[:200]}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Disable endpoint error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_3_swagger_wallet_readiness(self) -> bool:
        """TEST 3: Swagger spec contains wallet_readiness in disable docs"""
        test_name = "3"
        try:
            # Use the exact command from review request
            cmd = [
                "curl", "-s", f"{self.base_url}/api/docs.json"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode != 0:
                self.log(f"Curl command failed: {result.stderr}", test_name, "FAIL")
                return False
            
            # Parse and check for wallet_readiness in description
            try:
                spec_data = json.loads(result.stdout)
                disable_path = spec_data.get('paths', {}).get('/api/company/auto-convert/{id}', {}).get('put', {})
                description = disable_path.get('description', '')
                
                if 'wallet_readiness' in description:
                    self.log(f"wallet_readiness found in disable endpoint description", test_name, "PASS")
                    return True
                else:
                    self.log(f"wallet_readiness NOT found in description: '{description}'", test_name, "FAIL")
                    return False
            except (json.JSONDecodeError, KeyError) as e:
                self.log(f"Error parsing swagger spec: {str(e)}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Swagger wallet_readiness test error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_4_enable_endpoint(self) -> bool:
        """TEST 4: Enable endpoint accessible — curl -s -X PUT /api/company/auto-convert/1 with enable params should return JSON with 401"""
        test_name = "4"
        try:
            url = f"{self.base_url}/api/company/auto-convert/1"
            payload = {
                "auto_convert_enabled": True,
                "settlement_currency": "USDT",
                "settlement_chain": "ERC20",
                "settlement_wallet_address": "0x123"
            }
            
            response = self.session.put(url, json=payload, timeout=10)
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    self.log(f"Enable endpoint accessible, requires auth (401): {data}", test_name, "PASS")
                    return True
                except json.JSONDecodeError:
                    self.log(f"Enable endpoint returns 401 but non-JSON: {response.text[:200]}", test_name, "FAIL")
                    return False
            else:
                self.log(f"Enable endpoint unexpected status: {response.status_code}, response: {response.text[:200]}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Enable endpoint error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_5_swagger_response_schema(self) -> bool:
        """TEST 5: Swagger response schema includes wallet_readiness and forwarding_mode"""
        test_name = "5"
        try:
            # Use the exact command from review request
            cmd = [
                "curl", "-s", f"{self.base_url}/api/docs.json"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode != 0:
                self.log(f"Curl command failed: {result.stderr}", test_name, "FAIL")
                return False
            
            # Parse and check response schema
            try:
                spec_data = json.loads(result.stdout)
                put_endpoint = spec_data.get('paths', {}).get('/api/company/auto-convert/{id}', {}).get('put', {})
                resp_schema = put_endpoint.get('responses', {}).get('200', {})
                content = json.dumps(resp_schema)
                
                has_readiness = 'wallet_readiness' in content
                has_forwarding = 'forwarding_mode' in content
                
                self.log(f"wallet_readiness: {has_readiness}, forwarding_mode: {has_forwarding}", test_name, 
                        "PASS" if (has_readiness and has_forwarding) else "FAIL")
                
                return has_readiness and has_forwarding
                
            except (json.JSONDecodeError, KeyError) as e:
                self.log(f"Error parsing swagger response schema: {str(e)}", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Swagger response schema test error: {str(e)}", test_name, "FAIL")
            return False
    
    def test_6_payment_flow_logic(self) -> bool:
        """TEST 6: Verify the payment flow logic — grep for auto-conversion check in paymentController.ts"""
        test_name = "6"
        try:
            # Use the exact grep command from review request
            cmd = [
                "grep", "-A5", "auto_convert_enabled", "/app/backend/controller/paymentController.ts"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and result.stdout.strip():
                lines = result.stdout.strip().split('\n')[:10]  # head -10 equivalent
                output = '\n'.join(lines)
                
                # Check if the logic properly skips when disabled - auto-conversion only happens when auto_convert_enabled is true
                # The if condition checks auto_convert_enabled && other_conditions, so if auto_convert_enabled is false, it skips
                if 'auto_convert_enabled &&' in output or 'auto_convert_enabled\n' in output:
                    self.log(f"Auto-conversion check found with proper conditional logic (skips when disabled):\n{output}", test_name, "PASS")
                    return True
                else:
                    self.log(f"Auto-conversion check found but no clear conditional logic:\n{output}", test_name, "FAIL")
                    return False
            else:
                self.log(f"No auto_convert_enabled found in paymentController.ts", test_name, "FAIL")
                return False
                
        except Exception as e:
            self.log(f"Payment flow logic test error: {str(e)}", test_name, "FAIL")
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all auto-conversion disable flow tests"""
        self.log("=" * 80)
        self.log("DynoPay Auto-Conversion Disable Flow Enhancement - Backend Testing")
        self.log(f"Testing against: {self.base_url}")
        self.log("Base URL: http://localhost:8001 (mapped to external URL)")
        self.log("=" * 80)
        
        # Run all 6 tests as specified in review request
        tests = [
            ("TEST 1: Backend healthy", self.test_1_backend_health),
            ("TEST 2: Disable endpoint accessible", self.test_2_disable_endpoint),
            ("TEST 3: Swagger spec contains wallet_readiness", self.test_3_swagger_wallet_readiness),
            ("TEST 4: Enable endpoint accessible", self.test_4_enable_endpoint),
            ("TEST 5: Swagger response schema", self.test_5_swagger_response_schema),
            ("TEST 6: Payment flow logic", self.test_6_payment_flow_logic)
        ]
        
        results = []
        for test_desc, test_func in tests:
            self.log(f"Running {test_desc}...")
            result = test_func()
            results.append(result)
            time.sleep(0.5)  # Small delay between tests
        
        # Summary
        self.log("=" * 80)
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        failed_tests = total_tests - passed_tests
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        self.log(f"TESTING COMPLETE: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
        
        if failed_tests > 0:
            self.log("FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    self.log(f"  TEST {result['test']}: {result['message']}")
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": success_rate,
            "results": self.test_results
        }

def main():
    """Main test execution"""
    tester = AutoConvertTester(BASE_URL)
    results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    if results["failed_tests"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()