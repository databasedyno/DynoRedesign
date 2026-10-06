#!/usr/bin/env python3
"""
Backend API Testing for Webhook Status Fix (2026-10-03)
READ-ONLY testing on LIVE production database
Base URL: https://secure-passphrase-15.preview.emergentagent.com
All backend routes under /api
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from backend/.env SERVER_URL
BASE_URL = "https://secure-passphrase-15.preview.emergentagent.com"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}TEST: {test_name}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*80}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.RESET}")

def print_fail(message: str):
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.RESET}")

def print_critical(message: str):
    print(f"{Colors.RED}{Colors.BOLD}🔴 CRITICAL: {message}{Colors.RESET}")

def make_request(method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        print(f"\n{Colors.BLUE}→ {method} {endpoint}{Colors.RESET}")
        response = requests.request(method, url, timeout=30, **kwargs)
        print(f"  Status: {response.status_code}")
        return response
    except requests.exceptions.RequestException as e:
        print_fail(f"Request failed: {e}")
        return None

def test_1_status_check_dry_run():
    """
    TEST 1: GET /api/status/check (NEW read-only dry-run endpoint)
    CRITICAL: This is the main fix verification
    """
    print_test_header("1. GET /api/status/check (Read-only dry-run)")
    
    response = make_request("GET", "/api/status/check")
    
    if not response:
        print_fail("Request failed")
        return False
    
    # Check HTTP 200
    if response.status_code != 200:
        print_fail(f"Expected HTTP 200, got {response.status_code}")
        return False
    print_pass("HTTP 200 OK")
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        print_fail("Response is not valid JSON")
        return False
    
    # Check response structure
    if not isinstance(data, dict) or 'data' not in data:
        print_fail("Response missing 'data' field")
        return False
    
    payload = data['data']
    
    # Check dry_run flag
    if payload.get('dry_run') != True:
        print_fail(f"Expected dry_run=true, got {payload.get('dry_run')}")
        return False
    print_pass("dry_run === true (no DB writes)")
    
    # Check results array
    if 'results' not in payload or not isinstance(payload['results'], list):
        print_fail("Missing or invalid 'results' array")
        return False
    
    results = payload['results']
    if len(results) != 5:
        print_fail(f"Expected 5 services, got {len(results)}")
        return False
    print_pass(f"results array has 5 services")
    
    # Find webhook_delivery service
    webhook_service = None
    for service in results:
        if service.get('service_id') == 'webhook_delivery':
            webhook_service = service
            break
    
    if not webhook_service:
        print_fail("webhook_delivery service not found in results")
        return False
    print_pass("webhook_delivery service found in results")
    
    # CRITICAL ASSERTION: webhook_delivery status must be "operational"
    webhook_status = webhook_service.get('status')
    print(f"\n{Colors.BOLD}CRITICAL ASSERTION:{Colors.RESET}")
    print(f"  webhook_delivery status: {Colors.BOLD}{webhook_status}{Colors.RESET}")
    
    if webhook_status != "operational":
        print_critical(f"webhook_delivery status is '{webhook_status}', expected 'operational'")
        print_critical("THE BUG IS NOT FIXED - webhook_delivery should be operational")
        return False
    
    print_pass("✓✓✓ webhook_delivery status === 'operational' (BUG FIXED!)")
    
    # Check overall_status
    overall_status = payload.get('overall_status')
    print(f"\n  overall_status: {Colors.BOLD}{overall_status}{Colors.RESET}")
    
    if overall_status not in ['operational', 'degraded', 'partial_outage']:
        print_fail(f"Invalid overall_status: {overall_status}")
        return False
    
    # Overall status should be operational if webhook_delivery is operational
    # (unless some OTHER service is genuinely slow right now)
    if overall_status == 'operational':
        print_pass("overall_status === 'operational' (all services healthy)")
    else:
        print_info(f"overall_status === '{overall_status}' (some other service may be slow, but webhook_delivery is operational)")
    
    # Print all service statuses for visibility
    print(f"\n{Colors.BOLD}All Service Statuses:{Colors.RESET}")
    for service in results:
        sid = service.get('service_id', 'unknown')
        status = service.get('status', 'unknown')
        latency = service.get('latency_ms', 0)
        color = Colors.GREEN if status == 'operational' else Colors.YELLOW if status == 'degraded' else Colors.RED
        print(f"  {sid:20s} {color}{status:12s}{Colors.RESET} ({latency}ms)")
    
    print(f"\n{Colors.GREEN}{Colors.BOLD}✓✓✓ TEST 1 PASSED - BUG FIX VERIFIED{Colors.RESET}")
    return True

def test_2_status_public():
    """
    TEST 2: GET /api/status (public endpoint)
    NOTE: This reads stored rows written by PROD's monitor, so webhook_delivery
    may still show "degraded" here - that's EXPECTED and NOT a failure
    """
    print_test_header("2. GET /api/status (Public status endpoint)")
    
    response = make_request("GET", "/api/status")
    
    if not response:
        print_fail("Request failed")
        return False
    
    # Check HTTP 200
    if response.status_code != 200:
        print_fail(f"Expected HTTP 200, got {response.status_code}")
        return False
    print_pass("HTTP 200 OK")
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        print_fail("Response is not valid JSON")
        return False
    
    # Check response structure
    if not isinstance(data, dict) or 'data' not in data:
        print_fail("Response missing 'data' field")
        return False
    
    payload = data['data']
    
    # Check services array
    if 'services' not in payload or not isinstance(payload['services'], list):
        print_fail("Missing or invalid 'services' array")
        return False
    print_pass("services[] array present")
    
    # Check for webhook_delivery entry
    webhook_found = False
    for service in payload['services']:
        if service.get('id') == 'webhook_delivery':
            webhook_found = True
            webhook_status = service.get('status')
            print_info(f"webhook_delivery status in stored data: {webhook_status}")
            print_info("(May still be 'degraded' from old PROD monitor - this is EXPECTED)")
            break
    
    if not webhook_found:
        print_fail("webhook_delivery not found in services array")
        return False
    print_pass("webhook_delivery entry found in services[]")
    
    # Check overall_status present
    if 'overall_status' not in payload:
        print_fail("Missing overall_status field")
        return False
    print_pass(f"overall_status present: {payload['overall_status']}")
    
    # Check no 500 error
    if response.status_code == 500:
        print_fail("Endpoint returned 500 error")
        return False
    print_pass("No 500 error")
    
    print(f"\n{Colors.GREEN}✓ TEST 2 PASSED{Colors.RESET}")
    return True

def test_3_status_services():
    """
    TEST 3: GET /api/status/services
    """
    print_test_header("3. GET /api/status/services")
    
    response = make_request("GET", "/api/status/services")
    
    if not response:
        print_fail("Request failed")
        return False
    
    # Check HTTP 200
    if response.status_code != 200:
        print_fail(f"Expected HTTP 200, got {response.status_code}")
        return False
    print_pass("HTTP 200 OK")
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        print_fail("Response is not valid JSON")
        return False
    
    # Check response structure
    if not isinstance(data, dict) or 'data' not in data:
        print_fail("Response missing 'data' field")
        return False
    
    payload = data['data']
    
    # Check services array
    if 'services' not in payload or not isinstance(payload['services'], list):
        print_fail("Missing or invalid 'services' array")
        return False
    
    services = payload['services']
    if len(services) != 5:
        print_fail(f"Expected 5 services, got {len(services)}")
        return False
    print_pass(f"Returns 5 services")
    
    # Check each service has required fields
    for service in services:
        if not all(k in service for k in ['id', 'name', 'status', 'uptime', 'latency_ms']):
            print_fail(f"Service missing required fields: {service.get('id', 'unknown')}")
            return False
    print_pass("All services have required fields (id, name, status, uptime, latency_ms)")
    
    # Check no 500 error
    if response.status_code == 500:
        print_fail("Endpoint returned 500 error")
        return False
    print_pass("No 500 error")
    
    print(f"\n{Colors.GREEN}✓ TEST 3 PASSED{Colors.RESET}")
    return True

def test_4_service_webhook_uptime():
    """
    TEST 4: GET /api/status/service/webhook_delivery/uptime
    """
    print_test_header("4. GET /api/status/service/webhook_delivery/uptime")
    
    response = make_request("GET", "/api/status/service/webhook_delivery/uptime")
    
    if not response:
        print_fail("Request failed")
        return False
    
    # Check HTTP 200
    if response.status_code != 200:
        print_fail(f"Expected HTTP 200, got {response.status_code}")
        return False
    print_pass("HTTP 200 OK")
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        print_fail("Response is not valid JSON")
        return False
    
    # Check response structure
    if not isinstance(data, dict) or 'data' not in data:
        print_fail("Response missing 'data' field")
        return False
    
    payload = data['data']
    
    # Check daily_status array
    if 'daily_status' not in payload or not isinstance(payload['daily_status'], list):
        print_fail("Missing or invalid 'daily_status' array")
        return False
    print_pass("daily_status array present")
    
    # Check uptime_percentage
    if 'uptime_percentage' not in payload:
        print_fail("Missing uptime_percentage field")
        return False
    print_pass(f"uptime_percentage present: {payload['uptime_percentage']}%")
    
    # Check no 500 error
    if response.status_code == 500:
        print_fail("Endpoint returned 500 error")
        return False
    print_pass("No 500 error")
    
    print(f"\n{Colors.GREEN}✓ TEST 4 PASSED{Colors.RESET}")
    return True

def test_5_status_incidents():
    """
    TEST 5: GET /api/status/incidents
    """
    print_test_header("5. GET /api/status/incidents")
    
    response = make_request("GET", "/api/status/incidents")
    
    if not response:
        print_fail("Request failed")
        return False
    
    # Check HTTP 200
    if response.status_code != 200:
        print_fail(f"Expected HTTP 200, got {response.status_code}")
        return False
    print_pass("HTTP 200 OK")
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        print_fail("Response is not valid JSON")
        return False
    
    # Check response structure
    if not isinstance(data, dict) or 'data' not in data:
        print_fail("Response missing 'data' field")
        return False
    
    payload = data['data']
    
    # Check incidents array
    if 'incidents' not in payload or not isinstance(payload['incidents'], list):
        print_fail("Missing or invalid 'incidents' array")
        return False
    print_pass(f"incidents array present (count: {len(payload['incidents'])})")
    
    # Check no 500 error
    if response.status_code == 500:
        print_fail("Endpoint returned 500 error")
        return False
    print_pass("No 500 error")
    
    print(f"\n{Colors.GREEN}✓ TEST 5 PASSED{Colors.RESET}")
    return True

def test_6_health_check():
    """
    TEST 6: GET /health (backend health check)
    NOTE: /health is at root level, not under /api, so we access it via localhost:8001
    """
    print_test_header("6. GET /health (Backend health check)")
    
    # /health is not under /api, so we access it via localhost:8001
    url = "http://localhost:8001/health"
    try:
        print(f"\n{Colors.BLUE}→ GET /health (localhost:8001){Colors.RESET}")
        response = requests.get(url, timeout=10)
        print(f"  Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print_fail(f"Request failed: {e}")
        return False
    
    if not response:
        print_fail("Request failed")
        return False
    
    # Check HTTP 200
    if response.status_code != 200:
        print_fail(f"Expected HTTP 200, got {response.status_code}")
        return False
    print_pass("HTTP 200 OK")
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        print_fail("Response is not valid JSON")
        return False
    
    # Check status field
    if data.get('status') != 'healthy':
        print_fail(f"Expected status='healthy', got {data.get('status')}")
        return False
    print_pass("status === 'healthy'")
    
    # Check database connection
    if data.get('database') != 'connected':
        print_fail(f"Database not connected: {data.get('database')}")
        return False
    print_pass("database === 'connected'")
    
    # Check redis connection
    if data.get('redis') != 'connected':
        print_fail(f"Redis not connected: {data.get('redis')}")
        return False
    print_pass("redis === 'connected'")
    
    print(f"\n{Colors.GREEN}✓ TEST 6 PASSED{Colors.RESET}")
    return True

def main():
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}BACKEND API TESTING - Webhook Status Fix (2026-10-03){Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Environment: SAFE MODE, LIVE prod DB")
    print(f"Testing: READ-ONLY endpoints only (no POST /api/status/check)")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    
    results = []
    
    # Run all tests
    results.append(("TEST 1: GET /api/status/check (dry-run)", test_1_status_check_dry_run()))
    results.append(("TEST 2: GET /api/status", test_2_status_public()))
    results.append(("TEST 3: GET /api/status/services", test_3_status_services()))
    results.append(("TEST 4: GET /api/status/service/webhook_delivery/uptime", test_4_service_webhook_uptime()))
    results.append(("TEST 5: GET /api/status/incidents", test_5_status_incidents()))
    results.append(("TEST 6: GET /health", test_6_health_check()))
    
    # Summary
    print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*80}{Colors.RESET}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if result else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.BOLD}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}{'='*80}{Colors.RESET}")
        print(f"{Colors.GREEN}{Colors.BOLD}✓✓✓ ALL TESTS PASSED - BUG FIX VERIFIED ✓✓✓{Colors.RESET}")
        print(f"{Colors.GREEN}{Colors.BOLD}{'='*80}{Colors.RESET}")
        print(f"\n{Colors.GREEN}CRITICAL VERIFICATION:{Colors.RESET}")
        print(f"{Colors.GREEN}✓ webhook_delivery status === 'operational' (bug fixed){Colors.RESET}")
        print(f"{Colors.GREEN}✓ All endpoints return 200 with valid structure{Colors.RESET}")
        print(f"{Colors.GREEN}✓ Backend process is healthy (database + redis connected){Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}{'='*80}{Colors.RESET}")
        print(f"{Colors.RED}{Colors.BOLD}✗✗✗ SOME TESTS FAILED ✗✗✗{Colors.RESET}")
        print(f"{Colors.RED}{Colors.BOLD}{'='*80}{Colors.RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
