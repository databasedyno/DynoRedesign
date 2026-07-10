#!/usr/bin/env python3
"""
Session-11 3-Issue Fix Batch Backend Test Suite
Tests A-F for DynoPay crypto payment gateway
"""

import subprocess
import sys
import json
import requests
import time
import random
import string

def run_command(cmd, cwd=None, check=True):
    """Run a shell command and return output"""
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    if check and result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        return None
    return result

def test_a_public_files():
    """TEST A: Verify /app/public has 42 files restored"""
    print("\n" + "="*80)
    print("TEST A: Public directory files (deploy blocker fix)")
    print("="*80)
    
    # Count files in filesystem
    result = run_command("find /app/public -type f | wc -l")
    fs_count = int(result.stdout.strip())
    
    # Count files in git
    result = run_command("cd /app && git ls-files public | wc -l")
    git_count = int(result.stdout.strip())
    
    print(f"Filesystem count: {fs_count}")
    print(f"Git tracked count: {git_count}")
    
    if fs_count == 42 and git_count == 42:
        print("✅ TEST A PASS: 42 files present in both filesystem and git")
        return True
    else:
        print(f"❌ TEST A FAIL: Expected 42 files, got fs={fs_count}, git={git_count}")
        return False

def test_b_typescript_compile():
    """TEST B: Verify TypeScript compiles without errors"""
    print("\n" + "="*80)
    print("TEST B: TypeScript compilation (merchantPoolSweep.ts fix)")
    print("="*80)
    
    result = run_command("cd /app/backend && node_modules/.bin/tsc --noEmit", check=False)
    
    if result.returncode == 0 and not result.stdout.strip():
        print("✅ TEST B PASS: TypeScript compiles with no errors")
        return True
    else:
        print(f"❌ TEST B FAIL: TypeScript compilation failed")
        print(f"Exit code: {result.returncode}")
        print(f"Output: {result.stdout}")
        print(f"Errors: {result.stderr}")
        return False

def test_c_sweep_module():
    """TEST C: Verify sweep module loads and exports functions (READ-ONLY)"""
    print("\n" + "="*80)
    print("TEST C: Sweep module regression check (READ-ONLY)")
    print("="*80)
    
    test_script = """
const sweep = require('./services/merchantPool/merchantPoolSweep');
console.log('Module loaded successfully');
console.log('Exports:', Object.keys(sweep));
const hasAll = sweep.sweepPoolAddress && sweep.sweepByThreshold && sweep.performScheduledSweeps;
console.log('Has all required exports:', hasAll);
process.exit(hasAll ? 0 : 1);
"""
    
    # Write test script
    with open('/tmp/test_sweep.js', 'w') as f:
        f.write(test_script)
    
    result = run_command(
        "cd /app/backend && node -r dotenv/config -r ts-node/register/transpile-only /tmp/test_sweep.js",
        check=False
    )
    
    print(f"Output: {result.stdout}")
    
    if result.returncode == 0 and 'Has all required exports: true' in result.stdout:
        print("✅ TEST C PASS: Sweep module loads and exports all required functions")
        return True
    else:
        print(f"❌ TEST C FAIL: Sweep module check failed")
        print(f"Stderr: {result.stderr}")
        return False

def test_d_leader_election_module():
    """TEST D: Verify leader election module loads and isLeader() === false"""
    print("\n" + "="*80)
    print("TEST D: Leader election module check (NO election start)")
    print("="*80)
    
    test_script = """
const le = require('./utils/leaderElection');
console.log('Module loaded successfully');
console.log('Exports:', Object.keys(le));
const hasAll = le.startLeaderElection && le.stopLeaderElection && le.isLeader && le.getInstanceId;
console.log('Has all required exports:', hasAll);
const isLeaderVal = le.isLeader();
console.log('isLeader():', isLeaderVal);
const instanceId = le.getInstanceId();
console.log('getInstanceId():', instanceId);
const pass = hasAll && isLeaderVal === false && instanceId && instanceId.length > 0;
console.log('Test pass:', pass);
process.exit(pass ? 0 : 1);
"""
    
    with open('/tmp/test_leader.js', 'w') as f:
        f.write(test_script)
    
    result = run_command(
        "cd /app/backend && node -r dotenv/config -r ts-node/register/transpile-only /tmp/test_leader.js",
        check=False
    )
    
    print(f"Output: {result.stdout}")
    
    if result.returncode == 0 and 'Test pass: true' in result.stdout:
        print("✅ TEST D PASS: Leader election module loads, isLeader() === false")
        return True
    else:
        print(f"❌ TEST D FAIL: Leader election module check failed")
        print(f"Stderr: {result.stderr}")
        return False

def test_e_redis_lease_semantics():
    """TEST E: Verify Redis lease semantics on throwaway key"""
    print("\n" + "="*80)
    print("TEST E: Redis lease semantics (throwaway key only)")
    print("="*80)
    
    # Generate random key
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    test_key = f"leader:test-{random_suffix}"
    test_value = f"test-instance-{random_suffix}"
    wrong_value = "wrong-instance"
    
    print(f"Using throwaway key: {test_key}")
    
    test_script = f"""
const {{ redis }} = require('./utils/redisInstance');

async function testRedisLease() {{
    try {{
        // Test 1: SET NX EX 60 should return 'OK'
        const set1 = await redis.set('{test_key}', '{test_value}', 'NX', 'EX', 60);
        console.log('First SET NX EX 60:', set1);
        
        // Test 2: Second SET NX should return null
        const set2 = await redis.set('{test_key}', 'other-value', 'NX', 'EX', 60);
        console.log('Second SET NX:', set2);
        
        // Test 3: Lua extend script with correct value should return 1
        const extendScript = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("EXPIRE", KEYS[1], ARGV[2])
            else
                return 0
            end
        `;
        const extend1 = await redis.eval(extendScript, 1, '{test_key}', '{test_value}', 60);
        console.log('Lua extend with correct value:', extend1);
        
        // Test 4: Lua extend script with wrong value should return 0
        const extend2 = await redis.eval(extendScript, 1, '{test_key}', '{wrong_value}', 60);
        console.log('Lua extend with wrong value:', extend2);
        
        // Test 5: Lua release with correct value should return 1
        const releaseScript = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `;
        const release1 = await redis.eval(releaseScript, 1, '{test_key}', '{test_value}');
        console.log('Lua release with correct value:', release1);
        
        // Cleanup: DEL the key
        await redis.del('{test_key}');
        console.log('Cleanup: key deleted');
        
        // Check results
        const pass = set1 === 'OK' && set2 === null && extend1 === 1 && extend2 === 0 && release1 === 1;
        console.log('All tests pass:', pass);
        process.exit(pass ? 0 : 1);
    }} catch (err) {{
        console.error('Error:', err);
        process.exit(1);
    }}
}}

testRedisLease();
"""
    
    with open('/tmp/test_redis.js', 'w') as f:
        f.write(test_script)
    
    result = run_command(
        "cd /app/backend && node -r dotenv/config -r ts-node/register/transpile-only /tmp/test_redis.js",
        check=False
    )
    
    print(f"Output: {result.stdout}")
    
    if result.returncode == 0 and 'All tests pass: true' in result.stdout:
        print("✅ TEST E PASS: Redis lease semantics working correctly")
        return True
    else:
        print(f"❌ TEST E FAIL: Redis lease semantics check failed")
        print(f"Stderr: {result.stderr}")
        return False

def test_f_health_and_api():
    """TEST F: Verify /health endpoint and preview isolation"""
    print("\n" + "="*80)
    print("TEST F: Health endpoint and preview isolation")
    print("="*80)
    
    base_url = "http://localhost:8001"
    
    # Test /health endpoint
    print("\n1. Testing /health endpoint...")
    try:
        resp = requests.get(f"{base_url}/health", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check background_jobs fields
            bg_jobs = data.get('background_jobs', {})
            eligible = bg_jobs.get('eligible')
            is_leader = bg_jobs.get('is_leader')
            instance_id = bg_jobs.get('instance_id')
            
            print(f"\nBackground jobs check:")
            print(f"  eligible: {eligible} (expected: false)")
            print(f"  is_leader: {is_leader} (expected: false)")
            print(f"  instance_id: {instance_id} (expected: non-empty)")
            
            health_pass = (
                eligible is False and 
                is_leader is False and 
                instance_id and 
                len(str(instance_id)) > 0
            )
            
            if not health_pass:
                print("❌ /health check FAIL: background_jobs fields incorrect")
                return False
        else:
            print(f"❌ /health returned {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ /health request failed: {e}")
        return False
    
    # Check backend logs for "Skipping" warnings and NO "[LeaderElection]" lines
    print("\n2. Checking backend logs...")
    result = run_command("tail -n 200 /var/log/supervisor/backend.out.log")
    log_content = result.stdout
    
    # Count "Skipping" lines
    skipping_lines = [line for line in log_content.split('\n') if 'Skipping' in line]
    leader_lines = [line for line in log_content.split('\n') if '[LeaderElection]' in line]
    
    print(f"\nFound {len(skipping_lines)} 'Skipping' lines (expected: 4)")
    for line in skipping_lines[-4:]:
        print(f"  {line.strip()}")
    
    print(f"\nFound {len(leader_lines)} '[LeaderElection]' lines (expected: 0)")
    if leader_lines:
        for line in leader_lines[:5]:
            print(f"  {line.strip()}")
    
    logs_pass = len(skipping_lines) >= 4 and len(leader_lines) == 0
    
    if not logs_pass:
        print("❌ Log check FAIL: Expected 4+ 'Skipping' lines and 0 '[LeaderElection]' lines")
        return False
    
    # Test core API endpoints
    print("\n3. Testing core API endpoints...")
    
    # GET /api/
    try:
        resp = requests.get(f"{base_url}/api/", timeout=10)
        print(f"GET /api/ -> {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ GET /api/ failed with {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ GET /api/ failed: {e}")
        return False
    
    # GET /api/csrf-token
    try:
        resp = requests.get(f"{base_url}/api/csrf-token", timeout=10)
        print(f"GET /api/csrf-token -> {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ GET /api/csrf-token failed with {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ GET /api/csrf-token failed: {e}")
        return False
    
    # POST /api/user/login with wrong creds
    try:
        resp = requests.post(
            f"{base_url}/api/user/login",
            json={"email": "bad@bad.com", "password": "wrongpassword"},
            timeout=10
        )
        print(f"POST /api/user/login (wrong creds) -> {resp.status_code}")
        if resp.status_code != 401:
            print(f"❌ POST /api/user/login expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ POST /api/user/login failed: {e}")
        return False
    
    print("\n✅ TEST F PASS: All health and API checks passed")
    return True

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SESSION-11 3-ISSUE FIX BATCH - BACKEND TEST SUITE")
    print("="*80)
    print("Testing: Deploy blockers + TypeScript errors + Leader election")
    print("Safety: READ-ONLY testing, no mutations, no election start")
    print("="*80)
    
    results = {}
    
    # Run all tests
    results['A'] = test_a_public_files()
    results['B'] = test_b_typescript_compile()
    results['C'] = test_c_sweep_module()
    results['D'] = test_d_leader_election_module()
    results['E'] = test_e_redis_lease_semantics()
    results['F'] = test_f_health_and_api()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"TEST {test}: {status}")
    
    all_pass = all(results.values())
    
    print("\n" + "="*80)
    if all_pass:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*80)
    
    return 0 if all_pass else 1

if __name__ == "__main__":
    sys.exit(main())
