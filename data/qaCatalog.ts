/* Auto-extracted QA catalog (shared by /QA and /quality). Pure data — no imports. */

export type StepStatus = "pending" | "pass" | "fail";

export interface TestStep {
  id: string;
  action: string;
  expected: string;
}

export interface TestCase {
  id: string;
  title: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  preconditions?: string;
  steps: TestStep[];
  notes?: string;
}

export interface TestSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  cases: TestCase[];
}


export const TEST_SECTIONS: TestSection[] = [
  /* ============================================================
     SECTION 1: PUBLIC PAGES & NAVIGATION
     ============================================================ */
  {
    id: "public",
    title: "Public Pages & Navigation",
    icon: "🌐",
    description: "Landing page sections, blog, fees, legal, documentation, system status, help center",
    cases: [
      {
        id: "PUB-001",
        title: "Landing Page — Full Render & Sections",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to dynopay.com", expected: "Homepage loads. No console errors. All images render." },
          { id: "2", action: "Verify Hero section", expected: "Hero headline, subtitle, 'Start Accepting Crypto' and 'Learn More' CTAs visible." },
          { id: "3", action: "Click 'Start Accepting Crypto' CTA", expected: "If logged in → /dashboard. If not → /auth/login." },
          { id: "4", action: "Click 'Learn More' CTA", expected: "Navigates to /blog." },
          { id: "5", action: "Scroll to Features section", expected: "Feature cards render with icons and descriptions." },
          { id: "6", action: "Scroll to 'Why Choose Dynopay' section", expected: "Comparison or USP cards display correctly." },
          { id: "7", action: "Scroll to Use Cases section", expected: "Use case examples render properly." },
          { id: "8", action: "Scroll to Fee/Pricing section", expected: "Pricing tiers or fee breakdown visible." },
          { id: "9", action: "Scroll to Social Proof / Trust Badges", expected: "Supported crypto logos, trust badges, partner logos visible." },
          { id: "10", action: "Scroll to 'Go Live' CTA section", expected: "Final CTA with sign-up button visible." },
          { id: "11", action: "Verify footer", expected: "Footer with links (Privacy, Terms, AML, Blog, Support, Socials), copyright." },
        ],
      },
      {
        id: "PUB-002",
        title: "Navbar & Navigation Links",
        priority: "High",
        steps: [
          { id: "1", action: "Click all navbar links: Features, Pricing, Blog, Documentation, Login, Sign Up", expected: "Each navigates to correct page." },
          { id: "2", action: "Resize to mobile (375px)", expected: "Hamburger menu appears. All links accessible via mobile menu." },
          { id: "3", action: "Scroll down on homepage then click navbar logo", expected: "Scrolls back to top or navigates to homepage." },
        ],
      },
      {
        id: "PUB-003",
        title: "Blog Listing & Articles",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /blog", expected: "Blog listing loads with all posts (title, date, category, excerpt)." },
          { id: "2", action: "Verify all dates show 2026", expected: "No dates showing 2025. All posts dated 2026." },
          { id: "3", action: "Click a blog post", expected: "Detail page loads: full content, author, date, category badge." },
          { id: "4", action: "Verify social share buttons (X, LinkedIn, Facebook, WhatsApp)", expected: "All 4 share buttons present at top and bottom of article." },
          { id: "5", action: "Click each share button", expected: "Opens correct sharing URL in new tab with pre-filled title + URL." },
          { id: "6", action: "Navigate back to /blog", expected: "Blog listing loads. Browser back button also works." },
        ],
      },
      {
        id: "PUB-004",
        title: "Fees Page & Calculator",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /fees", expected: "Fees page loads with pricing tiers." },
          { id: "2", action: "Interact with fee calculator (enter amounts, select currencies)", expected: "Shows fee breakdown: platform fee, blockchain fee, net to merchant." },
          { id: "3", action: "Compare plan features table", expected: "All columns render with correct check/cross icons." },
        ],
      },
      {
        id: "PUB-005",
        title: "Documentation Page",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /documentation", expected: "Developer docs load with API reference sections." },
          { id: "2", action: "Verify code samples render", expected: "All code blocks display correctly. Endpoint paths match actual API." },
          { id: "3", action: "Check request/response examples", expected: "All examples show proper JSON formatting." },
        ],
      },
      {
        id: "PUB-006",
        title: "System Status Page",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /system-status", expected: "Status page loads with all services listed." },
          { id: "2", action: "Verify service statuses match /api/status", expected: "API Gateway, Payment Processing, Wallet, Webhook, Dashboard statuses accurate." },
          { id: "3", action: "Check uptime percentage display", expected: "Uptime metrics shown for each service." },
        ],
      },
      {
        id: "PUB-007",
        title: "Help & Support / Knowledge Base",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /help-support", expected: "Help center loads with categorized articles." },
          { id: "2", action: "Click on a category", expected: "Articles for that category listed." },
          { id: "3", action: "Click on an article", expected: "Article detail (/help-support/[slug]) loads with full content." },
          { id: "4", action: "Use search functionality", expected: "Search returns relevant articles." },
          { id: "5", action: "Submit article feedback (helpful/not helpful)", expected: "Feedback recorded. Thank you message shown." },
        ],
      },
      {
        id: "PUB-008",
        title: "Legal Pages",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /privacy-policy", expected: "Privacy policy loads with full content." },
          { id: "2", action: "Navigate to /terms-conditions", expected: "Terms & conditions loads." },
          { id: "3", action: "Navigate to /aml-policy", expected: "AML policy loads." },
          { id: "4", action: "Verify footer links to all legal pages", expected: "All 3 legal pages linked from footer." },
        ],
      },
      {
        id: "PUB-009",
        title: "SEO — Sitemap, Robots, Meta Tags",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /sitemap.xml", expected: "Valid XML sitemap with all public pages. Includes hreflang attributes." },
          { id: "2", action: "Check /robots.txt", expected: "Proper Allow/Disallow rules. Sitemap URL referenced." },
          { id: "3", action: "View page source of homepage", expected: "Meta title, description, OG tags, Twitter cards present." },
          { id: "4", action: "View page source of a blog post", expected: "Unique meta title/description per post. OG image set." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 2: AUTHENTICATION & ONBOARDING
     ============================================================ */
  {
    id: "auth",
    title: "Authentication & Onboarding",
    icon: "🔐",
    description: "Email/phone registration, email+OTP login, Google/Facebook sign-in, forgot password, 2FA, sessions, token refresh",
    cases: [
      {
        id: "AUTH-001",
        title: "Email + Password Registration",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /auth/register", expected: "Registration form: Name, Email, Password, Google sign-up option." },
          { id: "2", action: "Submit empty form", expected: "Validation errors for required fields." },
          { id: "3", action: "Enter invalid email format", expected: "Validation error shown." },
          { id: "4", action: "Enter weak password (< 8 chars)", expected: "Password strength error." },
          { id: "5", action: "Register with valid data", expected: "OTP verification screen. Confirmation email sent." },
          { id: "6", action: "Enter correct OTP", expected: "Registration succeeds → redirected to /dashboard." },
          { id: "7", action: "Register same email again", expected: "'Email already registered' error." },
        ],
      },
      {
        id: "AUTH-002",
        title: "Phone Registration Flow",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /auth/register and select phone registration", expected: "Phone input field displayed with country code selector." },
          { id: "2", action: "Enter valid phone number", expected: "OTP sent to phone. Verification screen shown." },
          { id: "3", action: "Enter correct OTP", expected: "Phone registration succeeds." },
          { id: "4", action: "Enter duplicate phone number", expected: "'Phone already registered' error." },
        ],
      },
      {
        id: "AUTH-003",
        title: "Email + Password Login (with OTP)",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /auth/login", expected: "Login form: Email, Password fields." },
          { id: "2", action: "Enter invalid credentials", expected: "'Invalid email or password' error." },
          { id: "3", action: "Enter valid credentials", expected: "OTP sent to email. OTP input screen shown." },
          { id: "4", action: "Enter wrong OTP", expected: "'Invalid OTP' error. Retry allowed." },
          { id: "5", action: "Enter correct OTP", expected: "Login succeeds → /dashboard. Success toast." },
          { id: "6", action: "Click 'Resend OTP'", expected: "New OTP sent. Cooldown timer starts." },
        ],
      },
      {
        id: "AUTH-004",
        title: "Google Sign-In — NEW User",
        priority: "Critical",
        preconditions: "Use a Google account not previously registered.",
        steps: [
          { id: "1", action: "Click 'Sign in with Google' on /auth/login", expected: "Google OAuth popup (or redirect)." },
          { id: "2", action: "Authenticate with Google account", expected: "Success toast. Brief animation." },
          { id: "3", action: "Wait for redirect", expected: "Redirected to /dashboard within ~1s." },
          { id: "4", action: "Verify dashboard loads fully", expected: "Dashboard shows onboarding (no companies). Stats visible with 0 values. NO redirect back to login." },
          { id: "5", action: "Check browser DevTools > Application > localStorage", expected: "'token' and 'refreshToken' both present." },
          { id: "6", action: "Check DevTools > Network", expected: "No CSRF 403 errors on dashboard API calls." },
          { id: "7", action: "Refresh the page", expected: "Stays on dashboard. User remains logged in." },
        ],
        notes: "Critical bug fix area — previously caused CSRF cascade redirect. Verify thoroughly.",
      },
      {
        id: "AUTH-005",
        title: "Google Sign-In — Existing User",
        priority: "Critical",
        preconditions: "Use a Google account that has a company set up.",
        steps: [
          { id: "1", action: "Click 'Sign in with Google'", expected: "OAuth popup." },
          { id: "2", action: "Authenticate", expected: "Login succeeds → /dashboard with company data." },
          { id: "3", action: "Navigate to Wallet, Transactions, Settings", expected: "All pages load with data. No auth errors." },
        ],
      },
      {
        id: "AUTH-006",
        title: "Facebook Sign-In",
        priority: "High",
        steps: [
          { id: "1", action: "Click 'Sign in with Facebook' on /auth/login", expected: "Facebook OAuth popup (or redirect)." },
          { id: "2", action: "Authenticate with Facebook", expected: "Login/registration succeeds → /dashboard." },
          { id: "3", action: "Verify dashboard loads", expected: "No errors. User profile shows Facebook-linked info." },
        ],
      },
      {
        id: "AUTH-007",
        title: "NextAuth Social Login Redirect (Fallback)",
        priority: "Medium",
        preconditions: "If NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set, Google uses NextAuth redirect flow.",
        steps: [
          { id: "1", action: "Trigger NextAuth Google flow", expected: "Redirected to Google → back to /auth/validateSocialLogin." },
          { id: "2", action: "Verify validateSocialLogin processes session", expected: "Token fetched from session → stored → redirect to /dashboard." },
        ],
      },
      {
        id: "AUTH-008",
        title: "Forgot Password & Reset",
        priority: "High",
        steps: [
          { id: "1", action: "Click 'Forgot Password' on login page", expected: "Email input form." },
          { id: "2", action: "Enter registered email", expected: "Reset email sent. Success message." },
          { id: "3", action: "Enter unregistered email", expected: "Error message shown." },
          { id: "4", action: "Click reset link in email", expected: "Opens /reset-password with token." },
          { id: "5", action: "Enter new password + confirm", expected: "Password reset succeeds." },
          { id: "6", action: "Login with new password", expected: "Login works with new credentials." },
        ],
      },
      {
        id: "AUTH-009",
        title: "Two-Factor Authentication (2FA) — Full Lifecycle",
        priority: "High",
        preconditions: "Logged in. 2FA not yet enabled.",
        steps: [
          { id: "1", action: "Go to Profile > Security > Enable 2FA", expected: "QR code + secret key displayed." },
          { id: "2", action: "Scan QR with authenticator app", expected: "App generates 6-digit TOTP codes." },
          { id: "3", action: "Enter TOTP to verify setup", expected: "2FA enabled. Backup codes displayed." },
          { id: "4", action: "Save backup codes", expected: "Codes downloadable/copyable." },
          { id: "5", action: "Log out and log back in", expected: "After email OTP, additional 2FA prompt appears." },
          { id: "6", action: "Enter TOTP code", expected: "Login completes. Dashboard accessible." },
          { id: "7", action: "Use a backup code instead of TOTP", expected: "Login succeeds. Backup code consumed." },
          { id: "8", action: "Check 2FA status (GET /api/user/2fa/status)", expected: "Returns enabled: true." },
          { id: "9", action: "Regenerate backup codes", expected: "Old codes invalidated. New codes shown." },
          { id: "10", action: "Disable 2FA", expected: "2FA removed. Login no longer requires 2FA step." },
        ],
      },
      {
        id: "AUTH-010",
        title: "Session Management",
        priority: "Medium",
        preconditions: "Logged in on multiple devices/browsers.",
        steps: [
          { id: "1", action: "Navigate to Profile > Sessions", expected: "Active sessions listed: device, IP, last active." },
          { id: "2", action: "Revoke a specific session", expected: "That device/browser logged out." },
          { id: "3", action: "Click 'Revoke all other sessions'", expected: "All except current revoked." },
          { id: "4", action: "View login history", expected: "Past logins listed with date, IP, device, location." },
        ],
      },
      {
        id: "AUTH-011",
        title: "Token Refresh",
        priority: "High",
        steps: [
          { id: "1", action: "Wait for access token to expire (or simulate 401)", expected: "Axios interceptor detects 401." },
          { id: "2", action: "Verify auto-refresh triggers", expected: "POST /api/user/refresh-token called with refreshToken." },
          { id: "3", action: "Verify new token stored", expected: "localStorage 'token' updated. User stays logged in seamlessly." },
        ],
      },
      {
        id: "AUTH-012",
        title: "Logout & Token Cleanup",
        priority: "High",
        steps: [
          { id: "1", action: "Click logout", expected: "Redirected to /auth/login." },
          { id: "2", action: "Check localStorage", expected: "'token' and 'refreshToken' removed." },
          { id: "3", action: "Access /dashboard directly", expected: "Redirected to /auth/login (withAuth guard)." },
          { id: "4", action: "Press browser Back after logout", expected: "No authenticated content shown." },
        ],
      },
      {
        id: "AUTH-013",
        title: "Email Verification & Unsubscribe",
        priority: "Low",
        steps: [
          { id: "1", action: "POST /api/user/verify-email", expected: "Email verification sent." },
          { id: "2", action: "POST /api/user/resend-verification", expected: "New verification email sent." },
          { id: "3", action: "Click unsubscribe link in reminder email", expected: "User unsubscribed from reminders. Confirmation page." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 3: DASHBOARD
     ============================================================ */
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "📊",
    description: "Stats cards, charts, today summary, fee tiers, recent transactions, conversions, onboarding",
    cases: [
      {
        id: "DASH-001",
        title: "Dashboard Full Load",
        priority: "Critical",
        preconditions: "Logged in with company + wallet set up.",
        steps: [
          { id: "1", action: "Navigate to /dashboard", expected: "Dashboard loads: stat cards (Revenue, Transactions, Average, Pending)." },
          { id: "2", action: "Verify Today Summary strip", expected: "Today's transaction count and revenue shown at top." },
          { id: "3", action: "Verify chart renders", expected: "Revenue/transaction chart with default 7d period." },
          { id: "4", action: "Change chart period (7d, 30d, 90d)", expected: "Chart re-renders with correct data." },
          { id: "5", action: "Verify recent transactions table", expected: "Latest transactions: amount, status, date, crypto type." },
          { id: "6", action: "Verify fee tiers progress", expected: "Current tier shown with progress to next tier." },
          { id: "7", action: "Verify conversion banner (if applicable)", expected: "Auto-convert promotion/status shown if enabled." },
        ],
      },
      {
        id: "DASH-002",
        title: "Company Switcher",
        priority: "High",
        preconditions: "User has 2+ companies.",
        steps: [
          { id: "1", action: "Open company dropdown", expected: "All companies listed." },
          { id: "2", action: "Switch company", expected: "Dashboard data refreshes for selected company." },
          { id: "3", action: "Refresh page", expected: "Selected company persists." },
        ],
      },
      {
        id: "DASH-003",
        title: "New User Onboarding Flow",
        priority: "High",
        preconditions: "Brand new user (no companies/wallets).",
        steps: [
          { id: "1", action: "Login as new user", expected: "Onboarding wizard displayed." },
          { id: "2", action: "Check onboarding status (GET /api/user/onboarding-status)", expected: "Returns steps completed/remaining." },
          { id: "3", action: "Complete step: Create company", expected: "Step marked complete. Progress updates." },
          { id: "4", action: "Complete step: Add wallet", expected: "Step marked complete." },
          { id: "5", action: "After all steps", expected: "Full dashboard shown with data." },
        ],
      },
      {
        id: "DASH-004",
        title: "Dashboard Conversions View",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to dashboard conversions section", expected: "Recent conversions listed with amounts, rates, status." },
          { id: "2", action: "Click on a conversion", expected: "Conversion detail: source crypto, target, rate, timestamp, status." },
        ],
      },
      {
        id: "DASH-005",
        title: "Dashboard — Empty State",
        priority: "Medium",
        preconditions: "User with company but zero transactions.",
        steps: [
          { id: "1", action: "Navigate to /dashboard", expected: "Stats show 0 values. Chart shows empty state." },
          { id: "2", action: "Verify 'No recent transactions' message", expected: "Empty state with call-to-action (create payment link, etc.)." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 4: COMPANY MANAGEMENT
     ============================================================ */
  {
    id: "company",
    title: "Company Management",
    icon: "🏢",
    description: "Create, edit, delete companies. Webhook settings, auto-convert, tax ID, conversion history",
    cases: [
      {
        id: "COMP-001",
        title: "Create Company",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /company or 'Add Company'", expected: "Company creation form loads." },
          { id: "2", action: "Fill: company name, type, country, address", expected: "Real-time validation on inputs." },
          { id: "3", action: "Upload company logo", expected: "Logo preview shown." },
          { id: "4", action: "Submit", expected: "Company created. Toast notification. Dashboard shows new company." },
        ],
      },
      {
        id: "COMP-002",
        title: "Edit Company",
        priority: "High",
        steps: [
          { id: "1", action: "Open company edit form", expected: "Pre-filled with current data." },
          { id: "2", action: "Modify company name and save", expected: "Updated everywhere (sidebar, dashboard, settings)." },
        ],
      },
      {
        id: "COMP-003",
        title: "Tax ID Validation",
        priority: "Medium",
        steps: [
          { id: "1", action: "Enter tax ID in company form", expected: "POST /api/company/validateTaxId called." },
          { id: "2", action: "Enter valid tax ID format", expected: "Validation passes. Green check." },
          { id: "3", action: "Enter invalid tax ID", expected: "Validation error shown." },
          { id: "4", action: "Verify tax acronyms API (GET /api/tax/acronyms)", expected: "Returns tax ID names per country (e.g., VAT, EIN, GST)." },
        ],
      },
      {
        id: "COMP-004",
        title: "Webhook Settings — Full Flow",
        priority: "High",
        preconditions: "Company exists.",
        steps: [
          { id: "1", action: "Navigate to webhook settings", expected: "Webhook config form: URL, secret, events." },
          { id: "2", action: "Enter webhook URL + select events + save", expected: "Settings saved. Success toast." },
          { id: "3", action: "Click 'Test Webhook'", expected: "Test payload sent. Result shown (success/fail with status code)." },
          { id: "4", action: "View webhook history", expected: "Delivery log: past payloads, status codes, timestamps." },
          { id: "5", action: "View webhook stats", expected: "Aggregate stats: success rate, average response time." },
          { id: "6", action: "Click on a specific webhook log entry", expected: "Full payload, headers, response body visible." },
        ],
      },
      {
        id: "COMP-005",
        title: "Auto-Convert Settings",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to auto-convert settings", expected: "Toggle + config options load." },
          { id: "2", action: "Enable auto-convert to USDC", expected: "Saved. Incoming crypto auto-converts." },
          { id: "3", action: "View conversion history", expected: "Past conversions: amounts, rates, status, timestamps." },
          { id: "4", action: "Retry a failed conversion", expected: "POST /api/company/conversion/:id/retry triggers retry." },
        ],
      },
      {
        id: "COMP-006",
        title: "Delete Company",
        priority: "Medium",
        steps: [
          { id: "1", action: "Click delete company", expected: "Confirmation dialog with warning." },
          { id: "2", action: "Confirm deletion", expected: "Company removed. Dashboard switches to another or shows onboarding." },
        ],
      },
      {
        id: "COMP-007",
        title: "Company Transactions View",
        priority: "Medium",
        steps: [
          { id: "1", action: "View transactions for a specific company (GET /api/company/getTransactions/:id)", expected: "Filtered transaction list for that company." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 5: WALLET MANAGEMENT
     ============================================================ */
  {
    id: "wallet",
    title: "Wallet Management",
    icon: "💰",
    description: "View wallets/balances, add/edit/delete addresses (OTP-verified), validate addresses, auto-naming, network fees",
    cases: [
      {
        id: "WAL-001",
        title: "View Wallets & Balances",
        priority: "Critical",
        preconditions: "Wallets configured for company.",
        steps: [
          { id: "1", action: "Navigate to /wallet", expected: "Wallet page: FIAT and CRYPTO balances listed." },
          { id: "2", action: "Click on a specific wallet (BTC, ETH, etc.)", expected: "Detail view: balance, addresses, recent transactions." },
          { id: "3", action: "Verify all 15 Nomadly1 wallets render", expected: "All crypto types shown: BTC, LTC, DOGE, ETH, TRX, USDT-ERC20/TRC20, USDC, BCH, SOL, XRP, POLYGON, RLUSD, USDT-POLYGON, RLUSD-ERC20." },
        ],
      },
      {
        id: "WAL-002",
        title: "Add Wallet Address (OTP Verified)",
        priority: "Critical",
        steps: [
          { id: "1", action: "Click 'Add Address'", expected: "Form: crypto type, address input, label (optional)." },
          { id: "2", action: "Enter valid wallet address", expected: "Address format validated. OTP sent." },
          { id: "3", action: "Enter OTP", expected: "Address added. Appears in list." },
          { id: "4", action: "Enter invalid address format", expected: "Validation error before OTP step." },
          { id: "5", action: "Leave wallet name blank", expected: "Auto-generated friendly name assigned (e.g., 'Swift-42')." },
        ],
        notes: "Auto-naming uses generateWalletName() from generateFriendlyName.ts.",
      },
      {
        id: "WAL-003",
        title: "Edit Wallet Address",
        priority: "High",
        steps: [
          { id: "1", action: "Click edit on existing address", expected: "Edit form pre-filled." },
          { id: "2", action: "Change address + submit", expected: "OTP verification required (wallet/update/send-otp → wallet/update)." },
          { id: "3", action: "Verify OTP and confirm", expected: "Address updated." },
        ],
      },
      {
        id: "WAL-004",
        title: "Delete Wallet Address",
        priority: "High",
        steps: [
          { id: "1", action: "Click delete on an address", expected: "Confirmation + OTP sent (address/delete/send-otp)." },
          { id: "2", action: "Enter OTP", expected: "Address deleted." },
        ],
      },
      {
        id: "WAL-005",
        title: "Wallet Address Validation",
        priority: "Medium",
        steps: [
          { id: "1", action: "POST /api/wallet/validateWalletAddress with valid BTC address", expected: "Returns valid: true." },
          { id: "2", action: "POST with invalid address", expected: "Returns valid: false with error message." },
          { id: "3", action: "POST with ETH address for BTC crypto_type", expected: "Returns mismatch error." },
        ],
      },
      {
        id: "WAL-006",
        title: "Network Fees & Currency Rates",
        priority: "Medium",
        steps: [
          { id: "1", action: "GET /api/pay/network-fees", expected: "Returns current blockchain fees per network." },
          { id: "2", action: "POST /api/wallet/getCurrencyRates", expected: "Returns exchange rates for all supported cryptos." },
          { id: "3", action: "POST /api/wallet/estimateFees with amount + crypto", expected: "Returns estimated platform + blockchain fees." },
        ],
      },
      {
        id: "WAL-007",
        title: "Transaction History & Export",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /transactions", expected: "Full transaction list with filters." },
          { id: "2", action: "Filter by date range", expected: "List updates correctly." },
          { id: "3", action: "Filter by status (completed, pending, failed)", expected: "Only matching transactions shown." },
          { id: "4", action: "Filter by crypto type", expected: "Filtered correctly." },
          { id: "5", action: "Click on a transaction", expected: "Detail: hash, confirmations, fees, timestamps, sender/receiver." },
          { id: "6", action: "Click 'Export'", expected: "CSV/PDF download with filtered data." },
        ],
      },
      {
        id: "WAL-008",
        title: "Delete Wallet (Full Wallet, Not Just Address)",
        priority: "Medium",
        steps: [
          { id: "1", action: "Click delete wallet", expected: "OTP sent (wallet/delete/send-otp)." },
          { id: "2", action: "Verify OTP (wallet/delete/verify)", expected: "Wallet removed from list." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 6: PAYMENT LINKS
     ============================================================ */
  {
    id: "paylinks",
    title: "Payment Links",
    icon: "🔗",
    description: "Create, view, edit, delete, share payment links. QR codes, success modals, currency selection",
    cases: [
      {
        id: "PAY-001",
        title: "Create Payment Link",
        priority: "Critical",
        preconditions: "Company + wallet set up.",
        steps: [
          { id: "1", action: "Navigate to /create-pay-link", expected: "Payment link creation form." },
          { id: "2", action: "Fill: amount, currency, description, accepted cryptos", expected: "Form validates. Preview updates." },
          { id: "3", action: "Select accepted cryptocurrencies", expected: "Only currencies with configured wallets shown." },
          { id: "4", action: "Submit", expected: "Link created. Success modal with shareable URL + QR code." },
          { id: "5", action: "Copy link from success modal", expected: "Link copied. Toast notification." },
          { id: "6", action: "Leave name blank", expected: "Auto-generated name assigned." },
        ],
      },
      {
        id: "PAY-002",
        title: "View & Manage Payment Links",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /pay-links", expected: "Table: all links with name, amount, status, creation date, clicks." },
          { id: "2", action: "Search/filter payment links", expected: "Results filtered correctly." },
          { id: "3", action: "Click on a link row", expected: "Navigates to /pay-links/[slug] detail page." },
        ],
      },
      {
        id: "PAY-003",
        title: "Edit Payment Link",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /pay-links/[slug]", expected: "Edit form pre-filled with link data." },
          { id: "2", action: "Modify amount or description", expected: "Changes saved via PUT /api/pay/links/:id." },
          { id: "3", action: "Change accepted currencies", expected: "Updated. Checkout reflects new options." },
        ],
      },
      {
        id: "PAY-004",
        title: "Delete Payment Link",
        priority: "Medium",
        steps: [
          { id: "1", action: "Click delete on a payment link", expected: "Confirmation dialog." },
          { id: "2", action: "Confirm deletion", expected: "Link deactivated. Removed from list." },
          { id: "3", action: "Try opening deleted link URL", expected: "Shows 'Payment link not found' or expired state." },
        ],
      },
      {
        id: "PAY-005",
        title: "Fee Preview with Referral Discount",
        priority: "Low",
        steps: [
          { id: "1", action: "GET /api/pay/fee-preview (logged in)", expected: "Fee breakdown with referral discount applied if active." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 7: PAYMENT CHECKOUT FLOW (CUSTOMER-FACING)
     ============================================================ */
  {
    id: "checkout",
    title: "Payment Checkout Flow (Customer-Facing)",
    icon: "💳",
    description: "Full checkout: crypto selection, QR code, payment processing, success/failure/expiry, bank transfer, demo pages",
    cases: [
      {
        id: "CHK-001",
        title: "Checkout Page — Initial Load",
        priority: "Critical",
        preconditions: "Valid payment link created.",
        steps: [
          { id: "1", action: "Open payment link URL as a customer", expected: "Checkout page: merchant name, amount, supported cryptos listed." },
          { id: "2", action: "Verify merchant branding", expected: "Company name/logo shown." },
          { id: "3", action: "Verify fee breakdown visible", expected: "Platform fee, blockchain fee, total shown." },
        ],
      },
      {
        id: "CHK-002",
        title: "Crypto Selection & Payment Details",
        priority: "Critical",
        steps: [
          { id: "1", action: "Select a cryptocurrency (e.g., BTC)", expected: "Payment address displayed. Amount in crypto calculated. QR code shown." },
          { id: "2", action: "Verify countdown timer starts", expected: "Timer shows remaining time (e.g., 30 min)." },
          { id: "3", action: "Copy wallet address", expected: "Address copied to clipboard." },
          { id: "4", action: "Scan QR code with wallet app", expected: "QR encodes correct address + amount." },
          { id: "5", action: "Switch to a different crypto", expected: "Address and amount update for new crypto." },
        ],
      },
      {
        id: "CHK-003",
        title: "Bank Transfer Option",
        priority: "Medium",
        steps: [
          { id: "1", action: "If bank transfer enabled, select bank transfer option", expected: "Bank details shown: account number, routing, reference." },
          { id: "2", action: "Verify reference code", expected: "Unique reference for this payment." },
        ],
      },
      {
        id: "CHK-004",
        title: "Payment Verification & Confirmation",
        priority: "Critical",
        steps: [
          { id: "1", action: "After sending crypto, wait for detection", expected: "Status changes to 'Confirming' with confirmation count." },
          { id: "2", action: "Wait for sufficient confirmations", expected: "Status changes to 'Completed'. Success page shown." },
          { id: "3", action: "Verify webhook triggered for merchant", expected: "Merchant webhook received with payment confirmation." },
        ],
      },
      {
        id: "CHK-005",
        title: "Payment States — All Scenarios",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /pay/payment-states-demo", expected: "All payment states rendered: Waiting, Confirming, Completed, Underpaid, Overpaid, Expired, Failed." },
          { id: "2", action: "Verify Underpaid state", expected: "Shows amount received vs expected. Option to send remaining." },
          { id: "3", action: "Verify Overpaid state", expected: "Shows overpayment amount. Merchant notification." },
          { id: "4", action: "Verify Expired state", expected: "Timer reached 0. 'Payment expired' message with retry option." },
          { id: "5", action: "Verify Failed state", expected: "Error message with support contact or retry." },
        ],
      },
      {
        id: "CHK-006",
        title: "Payment Success & Failed Pages",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /payment/success", expected: "Success page: transaction ID, amount, merchant info." },
          { id: "2", action: "Navigate to /payment/failed", expected: "Failure page: error details, retry/support options." },
          { id: "3", action: "Navigate to /payment/verify", expected: "Payment verification page loads correctly." },
          { id: "4", action: "Navigate to /pay/success-demo", expected: "Demo success page renders." },
        ],
      },
      {
        id: "CHK-007",
        title: "Checkout Legal Pages",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /pay/aml-policy", expected: "AML policy for checkout context loads." },
          { id: "2", action: "Navigate to /pay/terms-of-service", expected: "Terms of service for checkout loads." },
        ],
      },
      {
        id: "CHK-008",
        title: "Checkout Demo Page",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /pay/demo", expected: "Demo checkout page loads. Allows testing full checkout flow without real payments." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 8: INVOICES & TAX
     ============================================================ */
  {
    id: "invoices",
    title: "Invoices & Tax",
    icon: "📄",
    description: "Invoice list, filtering, detail view, PDF download, tax rate lookup",
    cases: [
      {
        id: "INV-001",
        title: "Invoice List & Filtering",
        priority: "High",
        preconditions: "Invoices exist from past transactions.",
        steps: [
          { id: "1", action: "Navigate to /invoices", expected: "Invoice list: number, date, amount, status, company." },
          { id: "2", action: "Filter by date range", expected: "Filtered results." },
          { id: "3", action: "Filter by status (paid, pending, overdue)", expected: "Correct filtering." },
          { id: "4", action: "Search invoices", expected: "Results match search term." },
        ],
      },
      {
        id: "INV-002",
        title: "Invoice Detail & Download",
        priority: "High",
        steps: [
          { id: "1", action: "Click on an invoice", expected: "Detail view: line items, tax, totals, payment status, dates." },
          { id: "2", action: "Download invoice as PDF", expected: "PDF generated with proper formatting." },
        ],
      },
      {
        id: "INV-003",
        title: "Tax Rate & Lookup",
        priority: "Low",
        steps: [
          { id: "1", action: "GET /api/tax/rate/:countryCode (e.g., US)", expected: "Returns applicable tax rate." },
          { id: "2", action: "GET /api/tax/lookup?country=Germany", expected: "Returns country tax info." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 9: DEVELOPER KEYS & API MANAGEMENT
     ============================================================ */
  {
    id: "devkeys",
    title: "Developer Keys & API Management",
    icon: "🔑",
    description: "API key CRUD, rate limits, usage stats, logs, plans, customer management, auto-naming",
    cases: [
      {
        id: "DEV-001",
        title: "Create API Key",
        priority: "Critical",
        preconditions: "Company exists.",
        steps: [
          { id: "1", action: "Navigate to /developer-keys", expected: "API management page." },
          { id: "2", action: "Click 'Create API Key'", expected: "Form: key name, permissions." },
          { id: "3", action: "Submit with a name", expected: "Key generated. Secret shown ONCE." },
          { id: "4", action: "Submit without a name", expected: "Auto-generated name assigned (e.g., 'Nova-7')." },
          { id: "5", action: "Copy/save key secret", expected: "Secret copyable." },
        ],
        notes: "Auto-naming uses generateApiKeyName() from generateFriendlyName.ts.",
      },
      {
        id: "DEV-002",
        title: "Manage API Keys",
        priority: "High",
        steps: [
          { id: "1", action: "Toggle key status (enable/disable)", expected: "Status changes. Disabled keys reject requests." },
          { id: "2", action: "Regenerate key secret", expected: "New secret. Old secret invalidated." },
          { id: "3", action: "Delete API key", expected: "Key revoked and removed." },
        ],
      },
      {
        id: "DEV-003",
        title: "API Usage & Logs",
        priority: "Medium",
        steps: [
          { id: "1", action: "View usage stats for a key (GET /api/api/usage/:id)", expected: "Request counts, success/error rates." },
          { id: "2", action: "View logs for a key (GET /api/api/logs/:id)", expected: "Recent calls: timestamp, endpoint, status, IP." },
        ],
      },
      {
        id: "DEV-004",
        title: "Rate Limit Configuration",
        priority: "Medium",
        steps: [
          { id: "1", action: "View current rate limits", expected: "Limits shown per key." },
          { id: "2", action: "Update rate limit (PUT /api/api/rateLimit/:id)", expected: "New limits applied." },
          { id: "3", action: "Exceed rate limit", expected: "429 Too Many Requests returned." },
        ],
      },
      {
        id: "DEV-005",
        title: "API Plans (Sub-merchant)",
        priority: "Low",
        steps: [
          { id: "1", action: "Create API plan", expected: "Plan created with name, limits, features." },
          { id: "2", action: "View plans (GET /api/api/getPlans/:id)", expected: "Plans listed." },
          { id: "3", action: "Update plan", expected: "Changes saved." },
          { id: "4", action: "Delete plan", expected: "Plan removed." },
        ],
      },
      {
        id: "DEV-006",
        title: "Customer Management",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /customers", expected: "Customer list: name, email, balance, transactions." },
          { id: "2", action: "Click on customer", expected: "Detail: profile, history, balance." },
          { id: "3", action: "Update customer (PUT /api/api/updateCustomer/:id)", expected: "Changes saved." },
          { id: "4", action: "Delete customer", expected: "Customer removed." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 10: NOTIFICATIONS
     ============================================================ */
  {
    id: "notifications",
    title: "Notifications",
    icon: "🔔",
    description: "In-app notifications, push notifications, unread count, preferences, mark read, delete",
    cases: [
      {
        id: "NOTIF-001",
        title: "Notification List & Interactions",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /notifications (or bell icon)", expected: "Notification list with unread count badge." },
          { id: "2", action: "Verify unread count (GET /api/notification/unread-count)", expected: "Badge count matches." },
          { id: "3", action: "Click a notification", expected: "Marked as read. Detail or linked page opens." },
          { id: "4", action: "Click 'Mark All as Read'", expected: "All read. Badge resets to 0." },
          { id: "5", action: "Delete a notification", expected: "Removed from list." },
        ],
      },
      {
        id: "NOTIF-002",
        title: "Notification Preferences",
        priority: "Low",
        steps: [
          { id: "1", action: "GET /api/notification/preferences", expected: "Current preference toggles loaded." },
          { id: "2", action: "Toggle off a notification type", expected: "PUT /api/notification/preferences saves. That type no longer sent." },
          { id: "3", action: "Verify notification types list (GET /api/notification/types)", expected: "All available notification types listed." },
        ],
      },
      {
        id: "NOTIF-003",
        title: "Push Notifications",
        priority: "Low",
        steps: [
          { id: "1", action: "GET /api/notification/push/vapid-key", expected: "VAPID public key returned." },
          { id: "2", action: "Subscribe to push (POST /api/notification/push/subscribe)", expected: "Subscription registered." },
          { id: "3", action: "Verify push notification received (on payment event)", expected: "Browser push notification appears." },
          { id: "4", action: "Unsubscribe (POST /api/notification/push/unsubscribe)", expected: "No more push notifications." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 11: PROFILE & SETTINGS
     ============================================================ */
  {
    id: "settings",
    title: "Profile & Settings",
    icon: "⚙️",
    description: "Settings hub, profile updates, password change, add/remove email/phone, account deletion, login history",
    cases: [
      {
        id: "SET-001",
        title: "Settings Hub Page",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /settings", expected: "Settings cards grid: Wallet Addresses, Company Profile, Payment Settings, API Keys, Profile & Security, Notifications, Webhook Config, My Account." },
          { id: "2", action: "Click each card", expected: "Navigates to correct page." },
        ],
      },
      {
        id: "SET-002",
        title: "Profile Update",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /profile", expected: "Profile page: name, email, phone, photo." },
          { id: "2", action: "Update display name", expected: "Saved. Updated in sidebar." },
          { id: "3", action: "Upload profile photo", expected: "Photo uploaded and shown." },
        ],
      },
      {
        id: "SET-003",
        title: "Password Change",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to password change section", expected: "Current password + new password + confirm fields." },
          { id: "2", action: "Enter wrong current password", expected: "Error: 'Incorrect password'." },
          { id: "3", action: "Enter valid current + new password", expected: "Password updated. Success toast." },
        ],
      },
      {
        id: "SET-004",
        title: "Change/Add Email",
        priority: "High",
        steps: [
          { id: "1", action: "Click 'Change Email'", expected: "Email change form." },
          { id: "2", action: "Enter new email + submit", expected: "OTP sent to new email." },
          { id: "3", action: "Verify OTP", expected: "Email updated." },
          { id: "4", action: "For phone-registered users: POST /api/user/addEmail", expected: "OTP sent. After verify, email added to account." },
        ],
      },
      {
        id: "SET-005",
        title: "Change/Add Phone",
        priority: "Medium",
        steps: [
          { id: "1", action: "Click 'Change Phone'", expected: "Phone change form." },
          { id: "2", action: "Enter new phone + verify OTP", expected: "Phone updated." },
          { id: "3", action: "For email-registered users: POST /api/user/addPhone", expected: "Phone added after OTP verification." },
        ],
      },
      {
        id: "SET-006",
        title: "Remove Email / Phone",
        priority: "Low",
        preconditions: "User has both email and phone. Cannot remove last contact method.",
        steps: [
          { id: "1", action: "Remove secondary email (DELETE /api/user/email)", expected: "Email removed." },
          { id: "2", action: "Try removing the only remaining contact method", expected: "Error: Cannot remove last contact method." },
        ],
      },
      {
        id: "SET-007",
        title: "Login History",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to login history (GET /api/user/login-history)", expected: "List: date, IP, device, location." },
        ],
      },
      {
        id: "SET-008",
        title: "Delete Account",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to account deletion", expected: "Delete option with warning." },
          { id: "2", action: "Confirm deletion (DELETE /api/user/account)", expected: "Account deleted. Logged out. Cannot login again." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 12: REFERRAL PROGRAM
     ============================================================ */
  {
    id: "referrals",
    title: "Referral Program",
    icon: "🎁",
    description: "Referral code, sharing, tracking, earnings, leaderboard, apply/validate/redeem",
    cases: [
      {
        id: "REF-001",
        title: "Referral Code & Sharing",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /referrals", expected: "Referral page: unique code, sharing options." },
          { id: "2", action: "Copy referral link", expected: "Copied. Toast notification." },
          { id: "3", action: "View referred users (GET /api/referral/list)", expected: "List: referred users with status." },
          { id: "4", action: "View earnings (GET /api/referral/earnings)", expected: "Total earnings from referrals." },
        ],
      },
      {
        id: "REF-002",
        title: "Referral Leaderboard",
        priority: "Low",
        steps: [
          { id: "1", action: "GET /api/referral/leaderboard", expected: "Top referrers listed with rank and count." },
        ],
      },
      {
        id: "REF-003",
        title: "Apply & Validate Referral Code",
        priority: "Medium",
        steps: [
          { id: "1", action: "During registration, enter valid referral code", expected: "POST /api/referral/validate returns valid. Discount applied." },
          { id: "2", action: "Enter invalid referral code", expected: "Error: 'Invalid referral code'." },
          { id: "3", action: "POST /api/referral/apply with valid code", expected: "Referral applied to account." },
          { id: "4", action: "Check discount status (GET /api/referral/discount-status)", expected: "Shows active discount percentage and remaining duration." },
        ],
      },
      {
        id: "REF-004",
        title: "Referee Validation & Redemption",
        priority: "Low",
        steps: [
          { id: "1", action: "POST /api/referral/referee/validate", expected: "Validates referee eligibility." },
          { id: "2", action: "POST /api/referral/referee/redeem", expected: "Referee reward redeemed." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 13: SUBSCRIPTIONS
     ============================================================ */
  {
    id: "subscriptions",
    title: "Subscriptions (Recurring Payments)",
    icon: "🔄",
    description: "Create, view, update, cancel recurring payment subscriptions",
    cases: [
      {
        id: "SUB-001",
        title: "Subscription CRUD — Full Lifecycle",
        priority: "Medium",
        steps: [
          { id: "1", action: "POST /api/subscription — create new subscription", expected: "Subscription created with amount, interval, customer." },
          { id: "2", action: "GET /api/subscription — list all", expected: "All subscriptions listed." },
          { id: "3", action: "GET /api/subscription/:id — view one", expected: "Detail: amount, interval, next charge, status, history." },
          { id: "4", action: "PUT /api/subscription/:id — update", expected: "Amount/interval updated. Next charge reflects changes." },
          { id: "5", action: "DELETE /api/subscription/:id — cancel", expected: "Status → cancelled. No further charges." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 14: KYC (Know Your Customer)
     ============================================================ */
  {
    id: "kyc",
    title: "KYC Verification",
    icon: "🪪",
    description: "KYC status, requirements, submission, resubmission, history, Veriff webhook",
    cases: [
      {
        id: "KYC-001",
        title: "KYC Status & Requirements",
        priority: "High",
        steps: [
          { id: "1", action: "GET /api/kyc/status", expected: "Current KYC status: not_started, pending, verified, rejected." },
          { id: "2", action: "GET /api/kyc/requirements", expected: "Required documents/info listed." },
        ],
      },
      {
        id: "KYC-002",
        title: "KYC Submission Flow",
        priority: "High",
        steps: [
          { id: "1", action: "POST /api/kyc/submit with required documents", expected: "KYC submission started. Status → pending." },
          { id: "2", action: "Verify Veriff integration triggers", expected: "Veriff verification session created." },
          { id: "3", action: "After Veriff webhook (approved)", expected: "Status → verified. Full platform access unlocked." },
          { id: "4", action: "After Veriff webhook (rejected)", expected: "Status → rejected. Reason provided." },
        ],
      },
      {
        id: "KYC-003",
        title: "KYC Resubmission & History",
        priority: "Medium",
        steps: [
          { id: "1", action: "POST /api/kyc/resubmit after rejection", expected: "New submission started." },
          { id: "2", action: "GET /api/kyc/history", expected: "All past submissions with dates, status, reason." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 15: MERCHANT API (Server-to-Server)
     ============================================================ */
  {
    id: "merchantapi",
    title: "Merchant API (Server-to-Server)",
    icon: "🔌",
    description: "External API for merchants: create users, payments, crypto payments, balances, transactions",
    cases: [
      {
        id: "MAPI-001",
        title: "Create User via API",
        priority: "High",
        preconditions: "Valid API key.",
        steps: [
          { id: "1", action: "POST /api/merchant/createUser with valid API key + user data", expected: "201 with user ID." },
          { id: "2", action: "POST without API key", expected: "401 Unauthorized." },
          { id: "3", action: "POST with invalid data", expected: "400 Bad Request + validation errors." },
        ],
      },
      {
        id: "MAPI-002",
        title: "Create Payment via API",
        priority: "Critical",
        steps: [
          { id: "1", action: "POST /api/merchant/createPayment with amount, currency, callback_url", expected: "200 with payment_id, checkout_url, payment address." },
          { id: "2", action: "Open checkout_url in browser", expected: "Customer checkout page loads." },
        ],
      },
      {
        id: "MAPI-003",
        title: "Crypto Payment via API",
        priority: "Critical",
        steps: [
          { id: "1", action: "POST /api/merchant/cryptoPayment", expected: "Crypto payment initiated. Address + amount returned." },
        ],
      },
      {
        id: "MAPI-004",
        title: "Add Funds & Use Wallet via API",
        priority: "Medium",
        steps: [
          { id: "1", action: "POST /api/merchant/addFunds", expected: "Funds added to customer wallet." },
          { id: "2", action: "POST /api/merchant/useWallet", expected: "Funds deducted from wallet." },
        ],
      },
      {
        id: "MAPI-005",
        title: "Balances & Transactions via API",
        priority: "High",
        steps: [
          { id: "1", action: "GET /api/merchant/getBalance with API key", expected: "200 with balances per currency." },
          { id: "2", action: "GET /api/merchant/getTransactions", expected: "Transaction list for merchant." },
          { id: "3", action: "GET /api/merchant/getSingleTransaction/:id", expected: "Single transaction detail." },
          { id: "4", action: "GET /api/merchant/getSupportedCurrency", expected: "List of supported cryptocurrencies." },
        ],
      },
      {
        id: "MAPI-006",
        title: "Webhook Delivery for API Payments",
        priority: "High",
        steps: [
          { id: "1", action: "Complete a payment created via API", expected: "Webhook fires to callback_url." },
          { id: "2", action: "Verify HMAC signature on webhook payload", expected: "Signature matches using webhook secret." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 16: ADMIN PANEL
     ============================================================ */
  {
    id: "admin",
    title: "Admin Panel",
    icon: "🛡️",
    description: "Admin login, dashboard, wallet management, fee config, transfer speed, withdrawals, KB articles, alerts",
    cases: [
      {
        id: "ADM-001",
        title: "Admin Login",
        priority: "Critical",
        steps: [
          { id: "1", action: "Navigate to /admin/login", expected: "Admin login form." },
          { id: "2", action: "Enter admin credentials", expected: "Admin dashboard loads." },
          { id: "3", action: "Enter wrong credentials", expected: "Error message. Login denied." },
        ],
      },
      {
        id: "ADM-002",
        title: "Admin Dashboard",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /admin", expected: "Overview: system stats, user counts, revenue." },
        ],
      },
      {
        id: "ADM-003",
        title: "Admin Wallet Management",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /admin/wallet", expected: "System wallets listed with balances." },
          { id: "2", action: "View admin fee wallet", expected: "Collected fees balance shown." },
        ],
      },
      {
        id: "ADM-004",
        title: "Fee Tier Configuration",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /admin/fee", expected: "Fee tiers table with volume thresholds and rates." },
          { id: "2", action: "Edit a fee tier", expected: "Changes saved." },
        ],
      },
      {
        id: "ADM-005",
        title: "Transfer Speed Configuration",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to /admin/transferSpeed", expected: "Transfer speed settings per network." },
          { id: "2", action: "Update speed setting", expected: "Saved. Affects payment confirmation times." },
        ],
      },
      {
        id: "ADM-006",
        title: "Withdrawal Management",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to /admin/withdraw", expected: "Pending withdrawal requests listed." },
          { id: "2", action: "Approve a withdrawal", expected: "Withdrawal processed." },
          { id: "3", action: "Reject a withdrawal", expected: "Withdrawal denied. User notified." },
        ],
      },
      {
        id: "ADM-007",
        title: "Admin Profile",
        priority: "Low",
        steps: [
          { id: "1", action: "Navigate to /admin/profile", expected: "Admin profile info." },
        ],
      },
      {
        id: "ADM-008",
        title: "Knowledge Base Admin (CRUD Articles)",
        priority: "Medium",
        steps: [
          { id: "1", action: "POST /api/kb/admin/articles — create article", expected: "Article created." },
          { id: "2", action: "PUT /api/kb/admin/articles/:id — update", expected: "Article updated." },
          { id: "3", action: "DELETE /api/kb/admin/articles/:id — delete", expected: "Article removed from KB." },
        ],
      },
      {
        id: "ADM-009",
        title: "Health Alerts & Monitoring",
        priority: "Low",
        steps: [
          { id: "1", action: "GET /api/admin/alerts/health", expected: "System health alerts listed." },
          { id: "2", action: "POST /api/admin/alerts/test", expected: "Test alert sent." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 17: INTERNATIONALIZATION (i18n)
     ============================================================ */
  {
    id: "i18n",
    title: "Internationalization (i18n)",
    icon: "🌍",
    description: "Multi-language support, locale switching, RTL, persistence",
    cases: [
      {
        id: "I18N-001",
        title: "Language Switching & Persistence",
        priority: "Medium",
        steps: [
          { id: "1", action: "Find language selector (footer or settings)", expected: "Dropdown with available languages." },
          { id: "2", action: "Switch to French (fr)", expected: "All UI text changes to French." },
          { id: "3", action: "Switch to Spanish (es)", expected: "UI text in Spanish." },
          { id: "4", action: "Refresh page", expected: "Selected language persists." },
          { id: "5", action: "Navigate between pages", expected: "Language consistent across all pages." },
          { id: "6", action: "Test Arabic or Hebrew (if available)", expected: "RTL layout activates correctly." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 18: REAL-TIME FEATURES
     ============================================================ */
  {
    id: "realtime",
    title: "Real-Time & SSE Events",
    icon: "⚡",
    description: "Server-Sent Events for live updates, payment status streaming, broadcast",
    cases: [
      {
        id: "RT-001",
        title: "SSE Event Stream",
        priority: "Medium",
        steps: [
          { id: "1", action: "Connect to GET /api/events/stream", expected: "SSE connection established. Heartbeat events received." },
          { id: "2", action: "Trigger a payment event", expected: "Real-time event pushed to connected clients." },
          { id: "3", action: "Verify dashboard updates without refresh", expected: "New transaction appears in real-time." },
        ],
      },
    ],
  },

  /* ============================================================
     SECTION 19: CROSS-CUTTING CONCERNS
     ============================================================ */
  {
    id: "crosscut",
    title: "Cross-Cutting Concerns",
    icon: "🔀",
    description: "Error handling, rate limiting, CORS, CSRF, responsive design, loading states, empty states, accessibility, dark mode",
    cases: [
      {
        id: "CC-001",
        title: "Error Handling & Edge Cases",
        priority: "High",
        steps: [
          { id: "1", action: "Navigate to non-existent URL (e.g., /xyz123)", expected: "Custom 404 page." },
          { id: "2", action: "Disconnect internet + try API action", expected: "'Network error' message." },
          { id: "3", action: "Rapid repeated requests (button mashing)", expected: "Button debounced/disabled. 429 if rate limited." },
          { id: "4", action: "Submit form with XSS payload (e.g., <script>alert(1)</script>)", expected: "Input sanitized. No script execution." },
        ],
      },
      {
        id: "CC-002",
        title: "CSRF & Auth Header Protection",
        priority: "High",
        steps: [
          { id: "1", action: "Verify POST requests include Authorization: Bearer", expected: "All authenticated POST/PUT/DELETE requests have token." },
          { id: "2", action: "Make POST without Bearer (curl)", expected: "403 CSRF validation failed." },
          { id: "3", action: "Verify business-logic 403 does NOT redirect to login", expected: "User stays on page. Error shown in context." },
        ],
        notes: "Critical fix area — 403 handler now distinguishes auth vs business-logic errors.",
      },
      {
        id: "CC-003",
        title: "Rate Limiting",
        priority: "Medium",
        steps: [
          { id: "1", action: "Send 20+ rapid login attempts", expected: "Rate limiter triggers: 429 Too Many Requests." },
          { id: "2", action: "Send 10+ OTP requests in 1 minute", expected: "OTP rate limiter triggers." },
          { id: "3", action: "Normal usage after cooldown", expected: "Rate limit resets. Requests succeed." },
        ],
      },
      {
        id: "CC-004",
        title: "Responsive Design — All Viewports",
        priority: "Medium",
        steps: [
          { id: "1", action: "iPhone (375x667)", expected: "All pages mobile-friendly. No horizontal scroll. Touch targets >= 44px." },
          { id: "2", action: "iPad (768x1024)", expected: "Tablet layout. Sidebar collapses." },
          { id: "3", action: "Desktop (1920x1080)", expected: "Full layout. Sidebar visible. Charts scale." },
          { id: "4", action: "Ultra-wide (2560x1440)", expected: "Content centered. No broken layouts." },
        ],
      },
      {
        id: "CC-005",
        title: "Dark / Light Mode",
        priority: "Medium",
        steps: [
          { id: "1", action: "Toggle dark mode", expected: "All pages switch. Text readable. No broken contrast." },
          { id: "2", action: "Toggle back to light mode", expected: "Clean switch. All elements visible." },
          { id: "3", action: "Refresh in each mode", expected: "Preference persists." },
        ],
      },
      {
        id: "CC-006",
        title: "Loading & Empty States",
        priority: "Medium",
        steps: [
          { id: "1", action: "Navigate to dashboard on slow connection (throttle to 3G)", expected: "Skeleton loaders or spinners shown during data fetch." },
          { id: "2", action: "View transactions with no data", expected: "Empty state: friendly message + CTA." },
          { id: "3", action: "View invoices with no data", expected: "Empty state message." },
          { id: "4", action: "View payment links with no data", expected: "Empty state with 'Create your first link' CTA." },
        ],
      },
      {
        id: "CC-007",
        title: "Browser Navigation",
        priority: "Low",
        steps: [
          { id: "1", action: "Use browser Back/Forward through the app", expected: "All pages render correctly. No blank screens." },
          { id: "2", action: "Open multiple tabs as same user", expected: "No conflicts. Each tab works independently." },
          { id: "3", action: "Refresh any page", expected: "Page reloads with correct state." },
        ],
      },
      {
        id: "CC-008",
        title: "Performance",
        priority: "Low",
        steps: [
          { id: "1", action: "Lighthouse audit on homepage", expected: "Performance > 80." },
          { id: "2", action: "API response times (Network tab)", expected: "Dashboard < 2s, simple queries < 500ms." },
          { id: "3", action: "Check JS bundle size", expected: "No extremely large chunks (> 500KB gzipped)." },
        ],
      },
    ],
  },
];
