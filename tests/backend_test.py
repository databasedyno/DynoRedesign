#!/usr/bin/env python3
"""
Backend Test for Comprehensive Code Cleanup
DynoPay Backend Testing Script
"""

import requests
import subprocess
import os
import json
import sys
from pathlib import Path

def get_base_url():
    """Get the backend base URL from environment"""
    # Check if we're in the container environment
    try:
        with open('/app/backend/.env', 'r') as f:
            for line in f:
                if line.startswith('SERVER_URL='):
                    server_url = line.split('=')[1].strip()
                    if server_url.startswith('http'):
                        return server_url
    except:
        pass
    
    # Fallback to localhost
    return "http://localhost:8001"

BASE_URL = "http://localhost:8001"  # Use localhost directly for container testing
print(f"Using BASE_URL: {BASE_URL}")

class TestResults:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def run_test(self, test_name, test_func):
        """Run a test and record results"""
        self.tests_run += 1
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                print(f"✅ TEST {self.tests_run} - {test_name}: PASSED")
                return True
            else:
                self.failures.append(f"TEST {self.tests_run} - {test_name}: FAILED")
                print(f"❌ TEST {self.tests_run} - {test_name}: FAILED")
                return False
        except Exception as e:
            self.failures.append(f"TEST {self.tests_run} - {test_name}: ERROR - {str(e)}")
            print(f"❌ TEST {self.tests_run} - {test_name}: ERROR - {str(e)}")
            return False

    def summary(self):
        print(f"\n🎯 TEST SUMMARY: {self.tests_passed}/{self.tests_run} tests passed")
        if self.failures:
            print("\n❌ FAILURES:")
            for failure in self.failures:
                print(f"  - {failure}")
        return self.tests_passed == self.tests_run

def test_backend_healthy():
    """TEST 1: Backend health check"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('status') == 'healthy'
        return False
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_typescript_compiles():
    """TEST 2: TypeScript compilation check"""
    try:
        os.chdir('/app/backend')
        result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                              capture_output=True, text=True, timeout=60)
        return result.returncode == 0
    except Exception as e:
        print(f"TypeScript compilation failed: {e}")
        return False

def test_deleted_files():
    """TEST 3: Verify deleted files no longer exist"""
    deleted_files = [
        '/app/backend/utils/redisKeyNamespace.ts',
        '/app/backend/utils/destinationTagValidator.ts', 
        '/app/backend/middleware/csrfProtection.ts'
    ]
    
    for file_path in deleted_files:
        if os.path.exists(file_path):
            print(f"File still exists: {file_path}")
            return False
    
    return True

def test_unused_packages_removed():
    """TEST 4: Verify unused packages removed from package.json"""
    try:
        with open('/app/backend/package.json', 'r') as f:
            package_content = f.read()
        
        unused_packages = ['cheerio', 'yamljs', 'ioredis', '"crc-32"', '"crc32"', '"fast-crc32c"']
        
        for package in unused_packages:
            if package in package_content:
                print(f"Unused package still found: {package}")
                return False
        
        return True
    except Exception as e:
        print(f"Package.json check failed: {e}")
        return False

def test_types_moved_to_dev_dependencies():
    """TEST 5: Verify @types moved to devDependencies"""
    try:
        with open('/app/backend/package.json', 'r') as f:
            package_data = json.load(f)
        
        # Check devDependencies has the required @types packages
        dev_deps = package_data.get('devDependencies', {})
        required_types = [
            '@types/fast-crc32c',
            '@types/node-cron', 
            '@types/nodemailer',
            '@types/qrcode',
            '@types/sharp',
            '@types/swagger-jsdoc',
            '@types/swagger-ui-express'
        ]
        
        for type_package in required_types:
            if type_package not in dev_deps:
                print(f"Missing from devDependencies: {type_package}")
                return False
        
        # Check dependencies does NOT contain @types packages
        deps = package_data.get('dependencies', {})
        for dep in deps:
            if dep.startswith('@types/'):
                print(f"@types package found in dependencies: {dep}")
                return False
                
        return True
    except Exception as e:
        print(f"devDependencies check failed: {e}")
        return False

def test_scripts_archived():
    """TEST 6: Verify scripts archived"""
    try:
        archive_path = '/app/backend/scripts/_archive/'
        if not os.path.exists(archive_path):
            print("Archive directory does not exist")
            return False
        
        # Check for required archived directories
        required_dirs = ['debug', 'analysis', 'migration', 'recovery', 'root_utils']
        for dir_name in required_dirs:
            dir_path = os.path.join(archive_path, dir_name)
            if not os.path.exists(dir_path):
                print(f"Archived directory missing: {dir_name}")
                return False
        
        # Check debug directory has 50+ files
        debug_path = os.path.join(archive_path, 'debug')
        if os.path.exists(debug_path):
            debug_files = len(os.listdir(debug_path))
            if debug_files < 50:
                print(f"Debug directory has only {debug_files} files, expected 50+")
                return False
        
        return True
    except Exception as e:
        print(f"Scripts archive check failed: {e}")
        return False

def test_docs_consolidated():
    """TEST 7: Verify docs consolidated"""
    try:
        # Check guides directory - expecting 14 files (13 + 1 subdirectory)
        guides_path = '/app/docs/guides/'
        if os.path.exists(guides_path):
            guides_items = os.listdir(guides_path)
            # Count only files, not directories
            guides_files = [item for item in guides_items if os.path.isfile(os.path.join(guides_path, item))]
            if len(guides_files) != 13:
                print(f"Expected 13 files in guides, found {len(guides_files)} files, {len(guides_items)} total items")
                return False
        else:
            print("Guides directory does not exist")
            return False
            
        # Check plans directory  
        plans_path = '/app/docs/plans/'
        if os.path.exists(plans_path):
            plans_count = len(os.listdir(plans_path))
            if plans_count != 5:
                print(f"Expected 5 files in plans, found {plans_count}")
                return False
        else:
            print("Plans directory does not exist")
            return False
            
        # Check reports directory
        reports_path = '/app/docs/reports/'
        if os.path.exists(reports_path):
            reports_count = len(os.listdir(reports_path))
            if reports_count != 7:
                print(f"Expected 7 files in reports, found {reports_count}")
                return False
        else:
            print("Reports directory does not exist")
            return False
            
        return True
    except Exception as e:
        print(f"Docs consolidation check failed: {e}")
        return False

def test_no_root_doc_sprawl():
    """TEST 8: Verify no root doc sprawl"""
    try:
        md_files = []
        for file in os.listdir('/app/'):
            if file.endswith('.md'):
                md_files.append(file)
        
        expected_files = ['README.md', 'test_result.md']
        
        if set(md_files) != set(expected_files):
            print(f"Expected only {expected_files}, found: {md_files}")
            return False
            
        return True
    except Exception as e:
        print(f"Root doc sprawl check failed: {e}")
        return False

def test_root_test_files_moved():
    """TEST 9: Verify root test .py files moved"""
    try:
        # Check that backend_test.py exists in tests directory
        if not os.path.exists('/app/tests/backend_test.py'):
            print("backend_test.py does not exist in /app/tests/")
            return False
            
        # Check that backend_test.py does NOT exist in root
        if os.path.exists('/app/backend_test.py'):
            print("backend_test.py still exists in root")
            return False
            
        return True
    except Exception as e:
        print(f"Test files move check failed: {e}")
        return False

def test_config_dedup():
    """TEST 10: Verify config dedup"""
    try:
        config_files = ['Procfile', 'railway.json', 'nixpacks.toml']
        
        for config_file in config_files:
            backend_path = f'/app/backend/{config_file}'
            if os.path.exists(backend_path):
                print(f"Config file still exists in backend: {config_file}")
                return False
                
        return True
    except Exception as e:
        print(f"Config dedup check failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 COMPREHENSIVE CODE CLEANUP TESTING")
    print("=" * 50)
    
    test_runner = TestResults()
    
    # Run all tests
    test_runner.run_test("Backend Health", test_backend_healthy)
    test_runner.run_test("TypeScript Compilation", test_typescript_compiles) 
    test_runner.run_test("Deleted Files Removed", test_deleted_files)
    test_runner.run_test("Unused Packages Removed", test_unused_packages_removed)
    test_runner.run_test("@types Moved to devDependencies", test_types_moved_to_dev_dependencies)
    test_runner.run_test("Scripts Archived", test_scripts_archived)
    test_runner.run_test("Docs Consolidated", test_docs_consolidated)
    test_runner.run_test("No Root Doc Sprawl", test_no_root_doc_sprawl)
    test_runner.run_test("Root Test Files Moved", test_root_test_files_moved)
    test_runner.run_test("Config Dedup", test_config_dedup)
    
    # Print summary
    success = test_runner.summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())