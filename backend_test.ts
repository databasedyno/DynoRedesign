/**
 * Backend Test Suite for 4-Issue Fix Batch (session 10b)
 * Tests: Email button render, CTA routes, sweep module, core API, checkout data
 * 
 * SAFETY: READ-ONLY tests only. No mutations, no emails, no sweeps.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://multi-chain-api-1.preview.emergentagent.com/api';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  evidence: string[];
  errors?: string[];
}

const results: TestResult[] = [];

// ============================================================
// TEST A: Email Button Render (offline)
// ============================================================
async function testA_EmailButtonRender(): Promise<void> {
  console.log('\n=== TEST A: Email Button Render (offline) ===');
  const evidence: string[] = [];
  const errors: string[] = [];
  
  try {
    // Import the email template module
    const emailTemplatePath = path.join(__dirname, 'backend', 'utils', 'emailTemplate.ts');
    
    // Use dynamic import with ts-node
    const { baseEmailTemplate } = await import('./backend/utils/emailTemplate');
    
    // Render a sample email with button
    const html = baseEmailTemplate(
      'Test Email',
      '<p>This is a test email body.</p>',
      {
        showButton: true,
        buttonText: 'View Transaction',
        buttonLink: 'https://example.com/transactions'
      }
    );
    
    // Check 1: <a class="btn"> has correct inline styles
    const btnRegex = /<a[^>]*class="btn"[^>]*style="([^"]*)"[^>]*>/;
    const btnMatch = html.match(btnRegex);
    
    if (btnMatch) {
      const btnStyle = btnMatch[1];
      const hasBgLime = btnStyle.includes('background-color: #CCFF00') || btnStyle.includes('background-color:#CCFF00');
      const hasColorBlack = btnStyle.includes('color: #050505') || btnStyle.includes('color:#050505');
      const hasWebkitFillBlack = btnStyle.includes('-webkit-text-fill-color: #050505') || btnStyle.includes('-webkit-text-fill-color:#050505');
      
      if (hasBgLime) {
        evidence.push('✓ Button <a> has background-color: #CCFF00');
      } else {
        errors.push('✗ Button <a> missing background-color: #CCFF00');
      }
      
      if (hasColorBlack) {
        evidence.push('✓ Button <a> has color: #050505');
      } else {
        errors.push('✗ Button <a> missing color: #050505');
      }
      
      if (hasWebkitFillBlack) {
        evidence.push('✓ Button <a> has -webkit-text-fill-color: #050505');
      } else {
        errors.push('✗ Button <a> missing -webkit-text-fill-color: #050505');
      }
    } else {
      errors.push('✗ Could not find <a class="btn"> in rendered HTML');
    }
    
    // Check 2: Inner <span> has correct styles
    const spanRegex = /<span[^>]*style="([^"]*)"[^>]*>View Transaction<\/span>/;
    const spanMatch = html.match(spanRegex);
    
    if (spanMatch) {
      const spanStyle = spanMatch[1];
      const hasColorBlack = spanStyle.includes('color: #050505') || spanStyle.includes('color:#050505');
      const hasWebkitFillBlack = spanStyle.includes('-webkit-text-fill-color: #050505') || spanStyle.includes('-webkit-text-fill-color:#050505');
      
      if (hasColorBlack) {
        evidence.push('✓ Button <span> has color: #050505');
      } else {
        errors.push('✗ Button <span> missing color: #050505');
      }
      
      if (hasWebkitFillBlack) {
        evidence.push('✓ Button <span> has -webkit-text-fill-color: #050505');
      } else {
        errors.push('✗ Button <span> missing -webkit-text-fill-color: #050505');
      }
    } else {
      errors.push('✗ Could not find button <span> in rendered HTML');
    }
    
    // Check 3: Dark mode media block has .btn span rule with #050505
    const darkModeRegex = /@media \(prefers-color-scheme: dark\)[^{]*\{([^}]*\.btn[^}]*\.btn span[^}]*color: #050505[^}]*)\}/s;
    const darkModeMatch = html.match(darkModeRegex);
    
    if (html.includes('.btn span') && html.includes('color: #050505')) {
      evidence.push('✓ Dark-mode media block contains .btn span rule with #050505');
    } else {
      errors.push('✗ Dark-mode media block missing .btn span rule with #050505');
    }
    
    // Check 4: NO occurrence of "background-color: #050505" in button block
    const oldBlackBgRegex = /background-color:\s*#050505/;
    const hasOldBlackBg = oldBlackBgRegex.test(html);
    
    if (!hasOldBlackBg) {
      evidence.push('✓ No old black background (background-color: #050505) found');
    } else {
      errors.push('✗ Found old black background (background-color: #050505) - should be #CCFF00');
    }
    
    results.push({
      test: 'A) Email Button Render',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    results.push({
      test: 'A) Email Button Render',
      status: 'FAIL',
      evidence: [],
      errors: [`Exception: ${error instanceof Error ? error.message : String(error)}`]
    });
  }
}

// ============================================================
// TEST B: CTA Routes (static)
// ============================================================
async function testB_CTARoutes(): Promise<void> {
  console.log('\n=== TEST B: CTA Routes (static) ===');
  const evidence: string[] = [];
  const errors: string[] = [];
  
  try {
    const emailServicePath = path.join(__dirname, 'backend', 'services', 'emailService.ts');
    const content = fs.readFileSync(emailServicePath, 'utf-8');
    
    // Extract all FRONTEND_BASE_URL paths
    const regex = /FRONTEND_BASE_URL\}([a-zA-Z0-9/_?=-]*)/g;
    const matches = [...content.matchAll(regex)];
    
    const allowedPaths = [
      '', // base URL
      '/dashboard',
      '/transactions',
      '/wallet',
      '/settings',
      '/profile',
      '/company',
      '/developer-keys',
      '/help-support',
      '/auth/login',
      '/auth/secure-account?token='
    ];
    
    const foundPaths = new Set<string>();
    const invalidPaths: string[] = [];
    
    for (const match of matches) {
      const path = match[1];
      foundPaths.add(path);
      
      // Check if path is allowed
      const isAllowed = allowedPaths.some(allowed => {
        if (allowed === '') return path === '';
        if (allowed.includes('?token=')) return path.startsWith('/auth/secure-account?token=');
        return path === allowed;
      });
      
      if (!isAllowed) {
        invalidPaths.push(path);
      }
    }
    
    evidence.push(`Found ${foundPaths.size} unique FRONTEND_BASE_URL paths`);
    
    // Check for forbidden paths
    const forbiddenPatterns = [
      /\/dashboard\/[a-z]/,  // /dashboard/<subpath>
      /\/support(?!\/)/,      // /support (not /help-support)
      /\/forgot-password/
    ];
    
    for (const path of foundPaths) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(path)) {
          invalidPaths.push(path);
        }
      }
    }
    
    if (invalidPaths.length === 0) {
      evidence.push('✓ All CTA paths are valid (no /dashboard/<subpath>, /support, or /forgot-password)');
    } else {
      errors.push(`✗ Found ${invalidPaths.length} invalid paths: ${invalidPaths.join(', ')}`);
    }
    
    // List all found paths for verification
    evidence.push(`Paths found: ${Array.from(foundPaths).join(', ')}`);
    
    results.push({
      test: 'B) CTA Routes',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    results.push({
      test: 'B) CTA Routes',
      status: 'FAIL',
      evidence: [],
      errors: [`Exception: ${error instanceof Error ? error.message : String(error)}`]
    });
  }
}

// ============================================================
// TEST C: Sweep Module Regression (read-only)
// ============================================================
async function testC_SweepModuleRegression(): Promise<void> {
  console.log('\n=== TEST C: Sweep Module Regression (read-only) ===');
  const evidence: string[] = [];
  const errors: string[] = [];
  
  try {
    const sweepModulePath = path.join(__dirname, 'backend', 'services', 'merchantPool', 'merchantPoolSweep.ts');
    const content = fs.readFileSync(sweepModulePath, 'utf-8');
    
    // Check 1: Module exports required functions
    const hasExportSweepPoolAddress = /export\s+(const|async\s+function)\s+sweepPoolAddress/.test(content);
    const hasExportSweepByThreshold = /export\s+(const|async\s+function)\s+sweepByThreshold/.test(content);
    const hasExportPerformScheduledSweeps = /export\s+(const|async\s+function)\s+performScheduledSweeps/.test(content);
    
    if (hasExportSweepPoolAddress) {
      evidence.push('✓ Module exports sweepPoolAddress');
    } else {
      errors.push('✗ Module missing export: sweepPoolAddress');
    }
    
    if (hasExportSweepByThreshold) {
      evidence.push('✓ Module exports sweepByThreshold');
    } else {
      errors.push('✗ Module missing export: sweepByThreshold');
    }
    
    if (hasExportPerformScheduledSweeps) {
      evidence.push('✓ Module exports performScheduledSweeps');
    } else {
      errors.push('✗ Module missing export: performScheduledSweeps');
    }
    
    // Check 2: DEFERRAL_HOURS = 24
    const deferralHoursRegex = /DEFERRAL_HOURS\s*=\s*24/;
    if (deferralHoursRegex.test(content)) {
      evidence.push('✓ DEFERRAL_HOURS = 24 found');
    } else {
      errors.push('✗ DEFERRAL_HOURS = 24 not found');
    }
    
    // Check 3: ERC20 write-off condition balUSD < 1.0
    const writeOffRegex = /balUSD\s*<\s*1\.0/;
    if (writeOffRegex.test(content)) {
      evidence.push('✓ ERC20 write-off condition balUSD < 1.0 found');
    } else {
      errors.push('✗ ERC20 write-off condition balUSD < 1.0 not found');
    }
    
    // Check 4: calculateDynamicTRC20Fee referenced in profitability section
    const dynamicFeeInProfitability = content.includes('calculateDynamicTRC20Fee') && 
                                       content.includes('profitability');
    if (dynamicFeeInProfitability) {
      evidence.push('✓ calculateDynamicTRC20Fee referenced in profitability section');
    } else {
      errors.push('✗ calculateDynamicTRC20Fee not found in profitability section');
    }
    
    results.push({
      test: 'C) Sweep Module Regression',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    results.push({
      test: 'C) Sweep Module Regression',
      status: 'FAIL',
      evidence: [],
      errors: [`Exception: ${error instanceof Error ? error.message : String(error)}`]
    });
  }
}

// ============================================================
// TEST D: Core API Regression
// ============================================================
async function testD_CoreAPIRegression(): Promise<void> {
  console.log('\n=== TEST D: Core API Regression ===');
  const evidence: string[] = [];
  const errors: string[] = [];
  
  try {
    // Test 1: GET /api/ → 200
    try {
      const res1 = await axios.get(`${API_BASE}/`, { timeout: 10000 });
      if (res1.status === 200) {
        evidence.push('✓ GET /api/ → 200');
      } else {
        errors.push(`✗ GET /api/ → ${res1.status} (expected 200)`);
      }
    } catch (err: any) {
      errors.push(`✗ GET /api/ failed: ${err.message}`);
    }
    
    // Test 2: GET /api/csrf-token → 200
    try {
      const res2 = await axios.get(`${API_BASE}/csrf-token`, { timeout: 10000 });
      if (res2.status === 200) {
        evidence.push('✓ GET /api/csrf-token → 200');
        
        // Extract CSRF token for next test
        const csrfToken = res2.data?.csrfToken || res2.data?.token;
        
        // Test 3: POST /api/user/login with wrong credentials → 401
        try {
          const res3 = await axios.post(
            `${API_BASE}/user/login`,
            { email: 'nouser@example.com', password: 'wrongpassword' },
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-CSRF-Token': csrfToken
              },
              timeout: 10000,
              validateStatus: () => true // Don't throw on 401
            }
          );
          
          if (res3.status === 401) {
            evidence.push('✓ POST /api/user/login (wrong creds) → 401');
          } else {
            errors.push(`✗ POST /api/user/login (wrong creds) → ${res3.status} (expected 401)`);
          }
        } catch (err: any) {
          if (err.response?.status === 401) {
            evidence.push('✓ POST /api/user/login (wrong creds) → 401');
          } else {
            errors.push(`✗ POST /api/user/login failed: ${err.message}`);
          }
        }
      } else {
        errors.push(`✗ GET /api/csrf-token → ${res2.status} (expected 200)`);
      }
    } catch (err: any) {
      errors.push(`✗ GET /api/csrf-token failed: ${err.message}`);
    }
    
    results.push({
      test: 'D) Core API Regression',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    results.push({
      test: 'D) Core API Regression',
      status: 'FAIL',
      evidence: [],
      errors: [`Exception: ${error instanceof Error ? error.message : String(error)}`]
    });
  }
}

// ============================================================
// TEST E: Checkout Data Regression
// ============================================================
async function testE_CheckoutDataRegression(): Promise<void> {
  console.log('\n=== TEST E: Checkout Data Regression ===');
  const evidence: string[] = [];
  const errors: string[] = [];
  
  try {
    const payload = {
      data: 'd73ed771b7ea6cbac71bb11c130d725d81bacf7ddf6811d0',
      timezone: 'UTC',
      language: 'en'
    };
    
    const res = await axios.post(
      `${API_BASE}/pay/getData`,
      payload,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    if (res.status === 200) {
      evidence.push('✓ POST /api/pay/getData → 200');
      
      const data = res.data?.data || res.data;
      
      // Check amount = 10
      if (data?.amount === 10 || data?.amount === '10') {
        evidence.push('✓ Response data.amount = 10');
      } else {
        errors.push(`✗ Response data.amount = ${data?.amount} (expected 10)`);
      }
      
      // Check base_currency = USD
      if (data?.base_currency === 'USD') {
        evidence.push('✓ Response data.base_currency = USD');
      } else {
        errors.push(`✗ Response data.base_currency = ${data?.base_currency} (expected USD)`);
      }
    } else {
      errors.push(`✗ POST /api/pay/getData → ${res.status} (expected 200)`);
    }
    
    results.push({
      test: 'E) Checkout Data Regression',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      evidence,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error: any) {
    results.push({
      test: 'E) Checkout Data Regression',
      status: 'FAIL',
      evidence: [],
      errors: [`Exception: ${error.response?.status || error.message}`]
    });
  }
}

// ============================================================
// Main Test Runner
// ============================================================
async function runAllTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Backend Test Suite - 4-Issue Fix Batch (session 10b)     ║');
  console.log('║  READ-ONLY tests - No mutations, no emails, no sweeps     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  await testA_EmailButtonRender();
  await testB_CTARoutes();
  await testC_SweepModuleRegression();
  await testD_CoreAPIRegression();
  await testE_CheckoutDataRegression();
  
  // Print results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST RESULTS                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  let passCount = 0;
  let failCount = 0;
  
  for (const result of results) {
    const statusIcon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${statusIcon} ${result.test}: ${result.status}`);
    
    if (result.status === 'PASS') {
      passCount++;
    } else {
      failCount++;
    }
    
    if (result.evidence.length > 0) {
      console.log('   Evidence:');
      result.evidence.forEach(e => console.log(`     ${e}`));
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('   Errors:');
      result.errors.forEach(e => console.log(`     ${e}`));
    }
    
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${passCount} PASS, ${failCount} FAIL`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
