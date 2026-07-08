/**
 * Google Auth Button Fix Verification Test
 * 
 * Tests 4 parts:
 * 1. STATIC: Dockerfile verification (ARG+ENV declarations)
 * 2. PREVIEW UI: Button visibility + GIS integration
 * 3. PRODUCTION: Pre-fix evidence (button absent)
 * 4. PREVIEW: Backend regression tests
 */

const { chromium } = require('playwright');
const fs = require('fs');

const PREVIEW_URL = 'https://crypto-payment-hub-24.preview.emergentagent.com';
const PRODUCTION_URL = 'https://dynopay.com';

async function runTests() {
  console.log('='.repeat(80));
  console.log('GOOGLE AUTH BUTTON FIX VERIFICATION');
  console.log('='.repeat(80));
  console.log('');

  const results = {
    part1: { name: 'PART 1 - STATIC Dockerfile Verification', status: 'PENDING', details: [] },
    part2: { name: 'PART 2 - PREVIEW UI (Button Visibility + GIS)', status: 'PENDING', details: [] },
    part3: { name: 'PART 3 - PRODUCTION Pre-fix Evidence', status: 'PENDING', details: [] },
    part4: { name: 'PART 4 - PREVIEW Backend Regression', status: 'PENDING', details: [] }
  };

  // ========================================
  // PART 1: STATIC Dockerfile Verification
  // ========================================
  console.log('PART 1: STATIC Dockerfile Verification');
  console.log('-'.repeat(80));
  
  try {
    // Check /app/Dockerfile
    const dockerfile = fs.readFileSync('/app/Dockerfile', 'utf8');
    const dockerfileFrontend = fs.readFileSync('/app/Dockerfile.frontend', 'utf8');
    
    // Find the frontend-builder stage in /app/Dockerfile
    const dockerfileLines = dockerfile.split('\n');
    let builderStageStart = -1;
    let yarnBuildLine = -1;
    let argGoogleAuthLine = -1;
    let envGoogleAuthLine = -1;
    let argClientIdLine = -1;
    
    for (let i = 0; i < dockerfileLines.length; i++) {
      const line = dockerfileLines[i];
      if (line.includes('FROM node:20-alpine AS frontend-builder')) {
        builderStageStart = i;
      }
      if (builderStageStart > -1 && line.includes('RUN yarn build')) {
        yarnBuildLine = i;
        break;
      }
      if (builderStageStart > -1 && line.includes('ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH')) {
        argGoogleAuthLine = i;
      }
      if (builderStageStart > -1 && line.includes('ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH')) {
        envGoogleAuthLine = i;
      }
      if (builderStageStart > -1 && line.includes('ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID')) {
        argClientIdLine = i;
      }
    }
    
    results.part1.details.push(`/app/Dockerfile:`);
    results.part1.details.push(`  - Frontend builder stage starts at line ${builderStageStart + 1}`);
    results.part1.details.push(`  - RUN yarn build at line ${yarnBuildLine + 1}`);
    results.part1.details.push(`  - ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID at line ${argClientIdLine + 1}`);
    results.part1.details.push(`  - ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH at line ${argGoogleAuthLine + 1}`);
    results.part1.details.push(`  - ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH at line ${envGoogleAuthLine + 1}`);
    
    const dockerfilePass = 
      builderStageStart > -1 &&
      yarnBuildLine > -1 &&
      argGoogleAuthLine > -1 &&
      envGoogleAuthLine > -1 &&
      argClientIdLine > -1 &&
      argGoogleAuthLine < yarnBuildLine &&
      envGoogleAuthLine < yarnBuildLine;
    
    // Check /app/Dockerfile.frontend
    const dockerfileFrontendLines = dockerfileFrontend.split('\n');
    let builderStageStart2 = -1;
    let yarnBuildLine2 = -1;
    let argGoogleAuthLine2 = -1;
    let envGoogleAuthLine2 = -1;
    let argClientIdLine2 = -1;
    
    for (let i = 0; i < dockerfileFrontendLines.length; i++) {
      const line = dockerfileFrontendLines[i];
      if (line.includes('FROM node:20-alpine AS builder')) {
        builderStageStart2 = i;
      }
      if (builderStageStart2 > -1 && line.includes('RUN yarn build')) {
        yarnBuildLine2 = i;
        break;
      }
      if (builderStageStart2 > -1 && line.includes('ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH')) {
        argGoogleAuthLine2 = i;
      }
      if (builderStageStart2 > -1 && line.includes('ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH')) {
        envGoogleAuthLine2 = i;
      }
      if (builderStageStart2 > -1 && line.includes('ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID')) {
        argClientIdLine2 = i;
      }
    }
    
    results.part1.details.push('');
    results.part1.details.push(`/app/Dockerfile.frontend:`);
    results.part1.details.push(`  - Builder stage starts at line ${builderStageStart2 + 1}`);
    results.part1.details.push(`  - RUN yarn build at line ${yarnBuildLine2 + 1}`);
    results.part1.details.push(`  - ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID at line ${argClientIdLine2 + 1}`);
    results.part1.details.push(`  - ARG NEXT_PUBLIC_ENABLE_GOOGLE_AUTH at line ${argGoogleAuthLine2 + 1}`);
    results.part1.details.push(`  - ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH at line ${envGoogleAuthLine2 + 1}`);
    
    const dockerfileFrontendPass = 
      builderStageStart2 > -1 &&
      yarnBuildLine2 > -1 &&
      argGoogleAuthLine2 > -1 &&
      envGoogleAuthLine2 > -1 &&
      argClientIdLine2 > -1 &&
      argGoogleAuthLine2 < yarnBuildLine2 &&
      envGoogleAuthLine2 < yarnBuildLine2;
    
    if (dockerfilePass && dockerfileFrontendPass) {
      results.part1.status = 'PASS';
      results.part1.details.push('');
      results.part1.details.push('✅ PASS: Both Dockerfiles correctly declare ARG+ENV NEXT_PUBLIC_ENABLE_GOOGLE_AUTH BEFORE yarn build');
    } else {
      results.part1.status = 'FAIL';
      results.part1.details.push('');
      results.part1.details.push('❌ FAIL: Missing or incorrectly positioned ARG+ENV declarations');
    }
    
  } catch (error) {
    results.part1.status = 'FAIL';
    results.part1.details.push(`❌ ERROR: ${error.message}`);
  }
  
  console.log(results.part1.details.join('\n'));
  console.log('');

  // ========================================
  // PART 2, 3, 4: Browser-based tests
  // ========================================
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // ========================================
  // PART 2: PREVIEW UI - Button Visibility + GIS
  // ========================================
  console.log('PART 2: PREVIEW UI - Button Visibility + GIS Integration');
  console.log('-'.repeat(80));
  
  try {
    // 2a. Check /auth/login for Google button
    await page.goto(`${PREVIEW_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for hydration
    
    // Look for Google button - it's a Box with onClick, containing an img with alt="google login"
    const googleLoginBtn = await page.locator('img[alt="google login"]').first();
    const isLoginBtnVisible = await googleLoginBtn.isVisible().catch(() => false);
    
    results.part2.details.push(`Preview /auth/login:`);
    results.part2.details.push(`  - Google sign-in button visible: ${isLoginBtnVisible ? '✅ YES' : '❌ NO'}`);
    
    if (isLoginBtnVisible) {
      await page.screenshot({ path: '/app/preview_login_google_button.png', fullPage: false });
      results.part2.details.push(`  - Screenshot saved: preview_login_google_button.png`);
    }
    
    // 2b. Check /auth/register for Google button
    await page.goto(`${PREVIEW_URL}/auth/register`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const googleRegisterBtn = await page.locator('[data-testid="google-signup-btn"]').first();
    const isRegisterBtnVisible = await googleRegisterBtn.isVisible().catch(() => false);
    
    results.part2.details.push('');
    results.part2.details.push(`Preview /auth/register:`);
    results.part2.details.push(`  - Google sign-up button visible: ${isRegisterBtnVisible ? '✅ YES' : '❌ NO'}`);
    
    // 2c. Test GIS integration on login page
    await page.goto(`${PREVIEW_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for GIS script to load
    
    // Check if GIS is loaded
    const gisLoaded = await page.evaluate(() => {
      return !!(window.google && window.google.accounts && window.google.accounts.oauth2);
    });
    
    results.part2.details.push('');
    results.part2.details.push(`Google Identity Services (GIS):`);
    results.part2.details.push(`  - GIS script loaded: ${gisLoaded ? '✅ YES' : '❌ NO'}`);
    
    if (isLoginBtnVisible && gisLoaded) {
      // Stub initTokenClient to capture config
      const capturedConfig = await page.evaluate(() => {
        return new Promise((resolve) => {
          if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            const originalInit = window.google.accounts.oauth2.initTokenClient;
            window.google.accounts.oauth2.initTokenClient = function(config) {
              resolve(config);
              return originalInit.call(this, config);
            };
            // Trigger a timeout in case button doesn't call it
            setTimeout(() => resolve(null), 2000);
          } else {
            resolve(null);
          }
        });
      });
      
      // Click the Google button (click on the parent Box that has onClick)
      try {
        const googleBox = await page.locator('img[alt="google login"]').locator('..').locator('..');
        await googleBox.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        
        // Try to capture the config again after click
        const configAfterClick = await page.evaluate(() => {
          return new Promise((resolve) => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
              const originalInit = window.google.accounts.oauth2.initTokenClient;
              let captured = false;
              window.google.accounts.oauth2.initTokenClient = function(config) {
                if (!captured) {
                  captured = true;
                  resolve(config);
                }
                return originalInit.call(this, config);
              };
              setTimeout(() => resolve(null), 3000);
            } else {
              resolve(null);
            }
          });
        });
        
        if (configAfterClick && configAfterClick.client_id) {
          results.part2.details.push(`  - initTokenClient called: ✅ YES`);
          results.part2.details.push(`  - client_id: ${configAfterClick.client_id}`);
          results.part2.details.push(`  - client_id starts with "163670787265-": ${configAfterClick.client_id.startsWith('163670787265-') ? '✅ YES' : '❌ NO'}`);
          results.part2.details.push(`  - scope: ${configAfterClick.scope || 'N/A'}`);
        } else {
          results.part2.details.push(`  - initTokenClient called: ⚠️ Could not capture (may have opened popup)`);
        }
        
        // Close any popup that may have opened
        const pages = context.pages();
        if (pages.length > 1) {
          for (let i = 1; i < pages.length; i++) {
            await pages[i].close();
          }
          results.part2.details.push(`  - Google popup opened and closed (as expected)`);
        }
        
      } catch (error) {
        results.part2.details.push(`  - Click error: ${error.message}`);
      }
    }
    
    if (isLoginBtnVisible && isRegisterBtnVisible) {
      results.part2.status = 'PASS';
      results.part2.details.push('');
      results.part2.details.push('✅ PASS: Google buttons visible on both login and register pages');
    } else {
      results.part2.status = 'FAIL';
      results.part2.details.push('');
      results.part2.details.push('❌ FAIL: Google button(s) not visible');
    }
    
  } catch (error) {
    results.part2.status = 'FAIL';
    results.part2.details.push(`❌ ERROR: ${error.message}`);
  }
  
  console.log(results.part2.details.join('\n'));
  console.log('');

  // ========================================
  // PART 3: PRODUCTION Pre-fix Evidence
  // ========================================
  console.log('PART 3: PRODUCTION Pre-fix Evidence (READ-ONLY)');
  console.log('-'.repeat(80));
  
  try {
    await page.goto(`${PRODUCTION_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for hydration
    
    // Check if page loaded successfully
    const pageTitle = await page.title();
    const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
    const isEmailInputVisible = await emailInput.isVisible().catch(() => false);
    
    results.part3.details.push(`Production https://dynopay.com/auth/login:`);
    results.part3.details.push(`  - Page loaded: ✅ YES (title: ${pageTitle})`);
    results.part3.details.push(`  - Email input visible: ${isEmailInputVisible ? '✅ YES' : '❌ NO'}`);
    
    // Look for Google button (should be ABSENT)
    const googleBtnProd = await page.locator('[data-testid="google-login-btn"], button:has(img[alt*="google" i]), button:has-text("Continue with Google"), button:has-text("Google")').first();
    const isGoogleBtnVisible = await googleBtnProd.isVisible().catch(() => false);
    
    results.part3.details.push(`  - Google sign-in button visible: ${isGoogleBtnVisible ? '❌ YES (unexpected!)' : '✅ NO (expected - old build)'}`);
    
    await page.screenshot({ path: '/app/production_login_no_google_button.png', fullPage: false });
    results.part3.details.push(`  - Screenshot saved: production_login_no_google_button.png`);
    
    if (!isGoogleBtnVisible && isEmailInputVisible) {
      results.part3.status = 'PASS';
      results.part3.details.push('');
      results.part3.details.push('✅ PASS: Production shows NO Google button (confirms pre-fix state)');
    } else if (isGoogleBtnVisible) {
      results.part3.status = 'UNEXPECTED';
      results.part3.details.push('');
      results.part3.details.push('⚠️ UNEXPECTED: Production DOES show Google button (fix may already be deployed)');
    } else {
      results.part3.status = 'FAIL';
      results.part3.details.push('');
      results.part3.details.push('❌ FAIL: Could not verify page state');
    }
    
  } catch (error) {
    results.part3.status = 'FAIL';
    results.part3.details.push(`❌ ERROR: ${error.message}`);
  }
  
  console.log(results.part3.details.join('\n'));
  console.log('');

  await browser.close();

  // ========================================
  // PART 4: PREVIEW Backend Regression
  // ========================================
  console.log('PART 4: PREVIEW Backend Regression Tests');
  console.log('-'.repeat(80));
  
  try {
    const fetch = require('node-fetch');
    
    // Test /api/
    const apiRootResponse = await fetch(`${PREVIEW_URL}/api/`);
    const apiRootStatus = apiRootResponse.status;
    const apiRootBody = await apiRootResponse.text();
    
    results.part4.details.push(`GET ${PREVIEW_URL}/api/`);
    results.part4.details.push(`  - Status: ${apiRootStatus} ${apiRootStatus === 200 ? '✅' : '❌'}`);
    results.part4.details.push(`  - Body preview: ${apiRootBody.substring(0, 100)}...`);
    
    // Test /api/csrf-token
    const csrfResponse = await fetch(`${PREVIEW_URL}/api/csrf-token`);
    const csrfStatus = csrfResponse.status;
    const csrfBody = await csrfResponse.json();
    
    results.part4.details.push('');
    results.part4.details.push(`GET ${PREVIEW_URL}/api/csrf-token`);
    results.part4.details.push(`  - Status: ${csrfStatus} ${csrfStatus === 200 ? '✅' : '❌'}`);
    results.part4.details.push(`  - Has csrf_token: ${csrfBody.csrf_token ? '✅ YES' : '❌ NO'}`);
    
    if (apiRootStatus === 200 && csrfStatus === 200 && csrfBody.csrf_token) {
      results.part4.status = 'PASS';
      results.part4.details.push('');
      results.part4.details.push('✅ PASS: Backend endpoints working correctly');
    } else {
      results.part4.status = 'FAIL';
      results.part4.details.push('');
      results.part4.details.push('❌ FAIL: Backend regression detected');
    }
    
  } catch (error) {
    results.part4.status = 'FAIL';
    results.part4.details.push(`❌ ERROR: ${error.message}`);
  }
  
  console.log(results.part4.details.join('\n'));
  console.log('');

  // ========================================
  // FINAL SUMMARY
  // ========================================
  console.log('='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  
  for (const [key, result] of Object.entries(results)) {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${result.name}: ${result.status}`);
  }
  
  console.log('');
  
  const allPass = Object.values(results).every(r => r.status === 'PASS' || r.status === 'UNEXPECTED');
  if (allPass) {
    console.log('✅ OVERALL: ALL TESTS PASSED');
  } else {
    console.log('❌ OVERALL: SOME TESTS FAILED');
  }
  
  console.log('');
  console.log('='.repeat(80));
  
  return results;
}

// Run tests
runTests().then(() => {
  console.log('Test execution complete.');
  process.exit(0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
