/**
 * Detailed Google Identity Services (GIS) Integration Test
 * Verifies that clicking the Google button invokes initTokenClient with correct client_id
 */

const { chromium } = require('playwright');

const PREVIEW_URL = 'https://dynopay-setup-10.preview.emergentagent.com';

async function testGISIntegration() {
  console.log('='.repeat(80));
  console.log('DETAILED GIS INTEGRATION TEST');
  console.log('='.repeat(80));
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log(`Navigating to ${PREVIEW_URL}/auth/login...`);
    await page.goto(`${PREVIEW_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for page to fully load and hydrate
    console.log('Waiting for page hydration...');
    await page.waitForTimeout(5000);
    
    // Check if GIS script is loaded
    const gisCheck = await page.evaluate(() => {
      return {
        hasGoogle: typeof window.google !== 'undefined',
        hasAccounts: typeof window.google?.accounts !== 'undefined',
        hasOAuth2: typeof window.google?.accounts?.oauth2 !== 'undefined',
        hasInitTokenClient: typeof window.google?.accounts?.oauth2?.initTokenClient !== 'undefined'
      };
    });
    
    console.log('GIS Script Status:');
    console.log(`  - window.google exists: ${gisCheck.hasGoogle ? '✅' : '❌'}`);
    console.log(`  - window.google.accounts exists: ${gisCheck.hasAccounts ? '✅' : '❌'}`);
    console.log(`  - window.google.accounts.oauth2 exists: ${gisCheck.hasOAuth2 ? '✅' : '❌'}`);
    console.log(`  - initTokenClient exists: ${gisCheck.hasInitTokenClient ? '✅' : '❌'}`);
    console.log('');
    
    if (!gisCheck.hasInitTokenClient) {
      console.log('❌ FAIL: GIS initTokenClient not available');
      await browser.close();
      return;
    }
    
    // Inject a spy to capture initTokenClient calls
    console.log('Injecting spy for initTokenClient...');
    await page.evaluate(() => {
      window.capturedGISConfig = null;
      const originalInit = window.google.accounts.oauth2.initTokenClient;
      window.google.accounts.oauth2.initTokenClient = function(config) {
        console.log('initTokenClient called with config:', config);
        window.capturedGISConfig = config;
        return originalInit.call(this, config);
      };
    });
    
    // Find and click the Google button
    console.log('Looking for Google login button...');
    const googleImg = await page.locator('img[alt="google login"]').first();
    const isVisible = await googleImg.isVisible();
    
    if (!isVisible) {
      console.log('❌ FAIL: Google button not visible');
      await browser.close();
      return;
    }
    
    console.log('✅ Google button found and visible');
    console.log('Clicking Google button...');
    
    // Click the parent Box element
    const googleBox = await page.locator('img[alt="google login"]').locator('..').locator('..');
    await googleBox.click();
    
    // Wait for the click to process
    await page.waitForTimeout(3000);
    
    // Check if initTokenClient was called
    const capturedConfig = await page.evaluate(() => window.capturedGISConfig);
    
    console.log('');
    console.log('initTokenClient Call Results:');
    
    if (capturedConfig) {
      console.log('✅ initTokenClient WAS called');
      console.log('');
      console.log('Captured Configuration:');
      console.log(`  - client_id: ${capturedConfig.client_id}`);
      console.log(`  - scope: ${capturedConfig.scope}`);
      console.log(`  - callback: ${typeof capturedConfig.callback}`);
      console.log(`  - error_callback: ${typeof capturedConfig.error_callback}`);
      console.log('');
      
      // Verify client_id
      const expectedPrefix = '163670787265-';
      const hasCorrectClientId = capturedConfig.client_id && capturedConfig.client_id.startsWith(expectedPrefix);
      
      console.log('Verification:');
      console.log(`  - client_id starts with "${expectedPrefix}": ${hasCorrectClientId ? '✅ YES' : '❌ NO'}`);
      console.log(`  - scope includes "openid": ${capturedConfig.scope?.includes('openid') ? '✅ YES' : '❌ NO'}`);
      console.log(`  - scope includes "email": ${capturedConfig.scope?.includes('email') ? '✅ YES' : '❌ NO'}`);
      console.log(`  - scope includes "profile": ${capturedConfig.scope?.includes('profile') ? '✅ YES' : '❌ NO'}`);
      console.log('');
      
      if (hasCorrectClientId) {
        console.log('✅ PASS: GIS integration working correctly');
      } else {
        console.log('❌ FAIL: client_id does not match expected value');
      }
      
    } else {
      console.log('⚠️ initTokenClient was NOT captured');
      console.log('This could mean:');
      console.log('  1. The button opened a popup directly (alternative flow)');
      console.log('  2. The click handler uses a different approach');
      console.log('  3. The spy was not set up correctly');
      
      // Check if any popups were opened
      const pages = context.pages();
      if (pages.length > 1) {
        console.log('');
        console.log(`✅ A popup WAS opened (${pages.length - 1} new page(s))`);
        console.log('This indicates the Google OAuth flow was triggered');
        
        // Close popups
        for (let i = 1; i < pages.length; i++) {
          const popupUrl = pages[i].url();
          console.log(`  - Popup URL: ${popupUrl.substring(0, 100)}...`);
          await pages[i].close();
        }
      } else {
        console.log('');
        console.log('❌ No popup was opened either');
      }
    }
    
    // Take a screenshot
    await page.screenshot({ path: '/app/gis_test_screenshot.png', fullPage: false });
    console.log('');
    console.log('Screenshot saved: gis_test_screenshot.png');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
  
  console.log('');
  console.log('='.repeat(80));
}

testGISIntegration().then(() => {
  console.log('Test complete.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
