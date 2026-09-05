# ============================================================================
# CURRENT SESSION — 2026-09-05: SEO AUDIT (Google starter guide) + sitemap <lastmod> enhancement
#   Audited dynopay.com vs https://developers.google.com/search/docs/fundamentals/seo-starter-guide
#   RESULT = strong PASS: HTTPS, unique descriptive <title>, meta description, self-canonical,
#   mobile viewport, exactly 1 H1, rich JSON-LD (Organization/WebSite+SearchAction/SoftwareApplication+
#   Offer/FAQPage; verticals add BreadcrumbList+WebPage), OG(9)+Twitter(5), 7 hreflang, 100% img alt,
#   robots.txt -> Sitemap line, descriptive URLs grouped in /for /blog directories. New /for verticals
#   are fully SEO-complete (title/desc/canonical/hreflang/JSON-LD/1×H1).
#   SITEMAP RESUBMIT ANSWER: NOT required — Google recrawls the already-submitted sitemap automatically.
#   Action needed = DEPLOY (new pages+sitemap are preview-only; prod sitemap still lists 15 verticals).
#   Optional expedite = GSC URL Inspection -> Request Indexing for the 6 new URLs. (Google deprecated
#   the sitemap ping endpoint in 2023, so pinging is a no-op.)
#
#   ENHANCEMENT (this turn): sitemap now emits accurate <lastmod> for every SEO page (country+vertical)
#   sourced from the page JSON `_generated_at`:
#     - utils/seoContent.ts: SEOPageIndexEntry.generatedAt added + populated from c/v._generated_at.
#     - pages/sitemap.xml.tsx: seoEntries now sets lastmod: toDateOnly(p.generatedAt).
#   Verified on preview: 6 new /for/* verticals show <lastmod>2026-09-05</lastmod>; existing verticals
#   show their real date (e.g. /for/saas 2026-08-29); lastmod URL count 10 -> 31. eslint clean.
#
#   BACKEND/HTTP TEST FOCUS (READ-ONLY curl; no data writes):
#     Preview base: https://4c5482a5-2509-48bc-800b-ec8d400e9de4.preview.emergentagent.com
#     1) GET /sitemap.xml -> HTTP 200, valid XML (<urlset>), not an error page.
#     2) Each of the 6 new verticals has a <url> block with <lastmod>2026-09-05</lastmod>:
#        /for/online-courses, /for/dropshipping, /for/affiliate-marketing, /for/forex-trading,
#        /for/consultants, /for/web3-daos.
#     3) At least one existing vertical (e.g. /for/saas) still has a valid <lastmod> date.
#     4) /robots.txt contains a "Sitemap: https://.../sitemap.xml" line.
# ============================================================================

# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05: SITEMAP <lastmod> ENHANCEMENT — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent (READ-ONLY curl verification on preview)
#   Test date: 2026-09-05
#   Preview URL: https://4c5482a5-2509-48bc-800b-ec8d400e9de4.preview.emergentagent.com
#
#   TEST RESULTS SUMMARY:
#   ✓ 1) GET /sitemap.xml — PASS
#        - HTTP Status: 200 OK
#        - Content-Type: text/xml; charset=utf-8
#        - Valid XML structure: Starts with <?xml version="1.0" encoding="UTF-8"?>
#        - Root element: <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
#        - NOT an HTML error page (confirmed valid sitemap XML)
#
#   ✓ 2) 6 NEW VERTICAL URLs WITH <lastmod>2026-09-05</lastmod> — PASS (6/6)
#        All 6 new vertical URLs found in sitemap with correct lastmod date:
#        - https://dynopay.com/for/online-courses → <lastmod>2026-09-05</lastmod> ✓
#        - https://dynopay.com/for/dropshipping → <lastmod>2026-09-05</lastmod> ✓
#        - https://dynopay.com/for/affiliate-marketing → <lastmod>2026-09-05</lastmod> ✓
#        - https://dynopay.com/for/forex-trading → <lastmod>2026-09-05</lastmod> ✓
#        - https://dynopay.com/for/consultants → <lastmod>2026-09-05</lastmod> ✓
#        - https://dynopay.com/for/web3-daos → <lastmod>2026-09-05</lastmod> ✓
#        Each URL is properly wrapped in a <url>...</url> block with <loc> and <lastmod> tags.
#
#   ✓ 3) EXISTING VERTICAL HAS VALID <lastmod> — PASS
#        - https://dynopay.com/for/saas → <lastmod>2026-08-29</lastmod> ✓
#        - Format: YYYY-MM-DD (valid ISO 8601 date format)
#        - Other existing verticals also verified with valid dates (e.g., /for/agencies,
#          /for/creators, /for/developers, /for/ecommerce, etc. all show 2026-08-29)
#
#   ✓ 4) GET /robots.txt — PASS
#        - HTTP Status: 200 OK
#        - Content-Type: text/plain; charset=utf-8
#        - Contains required Sitemap line: "Sitemap: https://dynopay.com/sitemap.xml" ✓
#        - Located at the bottom of the robots.txt file
#
#   OVERALL RESULT: ✓✓✓ ALL 4 VERIFICATION ITEMS PASSED ✓✓✓
#
#   NOTES:
#   - All tests performed via READ-ONLY GET requests (no data writes)
#   - Sitemap contains 21 vertical pages total (15 existing + 6 new)
#   - All 6 new verticals correctly show lastmod=2026-09-05
#   - All existing verticals retain their original lastmod dates (2026-08-29)
#   - Sitemap XML structure is valid and well-formed
#   - robots.txt properly references the sitemap URL
#   - No critical issues found
# ============================================================================



# ============================================================================
# CURRENT SESSION — 2026-09-05 (pod 4c5482a5): ANOMALY FIXES + 3 FEATURES
#   LIVE prod DB, SAFE MODE. Preview: https://4c5482a5-2509-48bc-800b-ec8d400e9de4.preview.emergentagent.com
#   Owner login (READ-ONLY testing only): onarrival21@gmail.com / Katiekendra123@ (user_id=1).
#   tsc --noEmit = 0 errors; eslint clean on all touched files.
#
#   INFRA/SEO ANOMALY FIXES (from DO-log analysis; FastForex intentionally EXCLUDED):
#   - Fontconfig: Dockerfile runner `apk add ... fontconfig ttf-dejavu && fc-cache -f`
#     (fixes "Fontconfig error: Cannot load default config file" on PDF/OG render). Deploy-time.
#   - nginx.conf: added `client_body_buffer_size 1m;` (stops "request body buffered to a temp
#     file" warnings for normal image uploads). Deploy-time.
#   - /ads.txt 404 -> added public/ads.txt (comment-only, valid). VERIFIED 200 text/plain.
#   - i18n SSR payload >128kB: pages/_app.tsx getInitialProps now EXCLUDES 9 authenticated-app-only
#     namespaces from the serialized bundle on PUBLIC pages. VERIFIED on /fees?lang=de: 12 ns
#     shipped, 0 app-only leaked, i18nResources ~290kB->~210kB, German still renders. (common+landing
#     are inherently large so the biggest pages may still exceed 128kB — full fix = split those ns.)
#
#   FEATURES:
#   - ATTRIBUTION FIX (Redux/Reducers/userReducer.ts): fire syncAttribution() the instant the auth
#     token is stored in USER_LOGIN/USER_REGISTER/USER_UPDATE (deferred, fire-and-forget, idempotent
#     server-side). ROOT CAUSE of 76% missing attribution: syncAttribution only ran on a later route
#     change, so signups that didn't navigate again (e.g. "verify your email") never synced.
#     Endpoint unchanged: POST /api/track/attribution (auth). utils/attribution.ts unchanged.
#   - WALLET NUDGE (Components/Page/Dashboard/WalletSetupNudge.tsx, wired into pages/dashboard.tsx
#     owners-only after KycGraceBanner): shows ONLY when hasCompany && !hasWallet; one tap opens the
#     existing AddWalletModal inline; auto-hides on refetchWallets after add; fires track/onboarding
#     step_clicked/step_completed(wallet). testid=wallet-setup-nudge / wallet-setup-nudge-cta.
#   - MORE /for/<vertical> SEO PAGES (data/seo-pages/verticals/*.json): +6 LLM-discovery verticals
#     (online-courses, dropshipping, affiliate-marketing, forex-trading, consultants, web3-daos).
#     Data-driven — auto-added to /for/* + sitemap + related links. VERIFIED: /for/online-courses 200
#     with correct H1; sitemap lists all 6. (15 -> 21 verticals.)
#
#   FRONTEND TEST FOCUS (READ-ONLY — SAFE MODE, prod DB; do NOT create brands/wallets or write data):
#     1) New SEO pages: GET /for/online-courses, /for/web3-daos, /for/dropshipping render 200 with an
#        <h1> and body content (no error page). Sitemap /sitemap.xml lists the 6 new /for/ slugs.
#     2) ads.txt: GET /ads.txt -> 200 text/plain (not 404).
#     3) Attribution beacon: on LOGIN (2-step: login-email-input -> Continue -> password-input ->
#        signin-submit-btn) a POST to /api/track/attribution fires shortly after auth (observe network).
#     4) Dashboard health: after login, /dashboard renders with NO console errors introduced by the new
#        WalletSetupNudge. The owner (user_id=1) HAS wallets, so the nudge (testid=wallet-setup-nudge)
#        must NOT appear (correct gating). Do NOT create a throwaway brand to force it to appear.
# ============================================================================

# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05 (pod 4c5482a5): ALL TESTS PASSED
# ============================================================================
#   Tested by: testing_agent (READ-ONLY verification on LIVE prod DB, SAFE MODE)
#   Test date: 2026-09-05
#   Preview URL: https://4c5482a5-2509-48bc-800b-ec8d400e9de4.preview.emergentagent.com
#   Login: onarrival21@gmail.com / Katiekendra123@ (user_id=1)
#
#   TEST RESULTS SUMMARY:
#   ✓ 1) NEW SEO LANDING PAGES — PASS (3/3)
#        - /for/online-courses: HTTP 200, H1 "Accept crypto payments for online courses without chargebacks", 3007 chars
#        - /for/dropshipping: HTTP 200, H1 "Accept crypto payments for dropshipping without chargebacks or frozen accounts", 2980 chars
#        - /for/web3-daos: HTTP 200, H1 "Accept crypto payments for your Web3 project or DAO", 2981 chars
#        All pages render with visible H1 and real body content (NOT 404/error pages).
#
#   ✓ 2) SITEMAP.XML — PASS
#        - HTTP 200, Content-Type: application/xml
#        - All 6 new paths FOUND in sitemap:
#          /for/online-courses, /for/dropshipping, /for/affiliate-marketing,
#          /for/forex-trading, /for/consultants, /for/web3-daos
#
#   ✓ 3) ADS.TXT — PASS
#        - HTTP 200, Content-Type: text/plain; charset=UTF-8
#        - Returns valid plain-text content (NOT a 404 or Next.js error page)
#        - Content: "# Dynopay — https://dynopay.com" (comment-only file, IAB spec compliant)
#        - Verified via curl: proper text/plain headers, 372 bytes
#
#   ✓ 4) ATTRIBUTION BEACON — PASS (PRIMARY FIX VERIFIED)
#        - Login flow successful: 2-step email → Continue → password → Sign in
#        - POST request to /api/track/attribution CAPTURED immediately after auth token storage
#        - Request URL: https://4c5482a5-2509-48bc-800b-ec8d400e9de4.preview.emergentagent.com/api/track/attribution
#        - Timing: Fired during navigation to /dashboard (within 3 seconds of login)
#        - This confirms the Redux userReducer.ts fix is working (syncAttribution fires on USER_LOGIN)
#
#   ✓ 5) DASHBOARD HEALTH + WALLET NUDGE GATING — PASS
#        - Dashboard renders successfully after login
#        - Console errors: 0 (no new errors introduced by WalletSetupNudge component)
#        - Wallet setup nudge (data-testid="wallet-setup-nudge"): NOT VISIBLE (correct gating)
#        - Gating logic verified: owner account (user_id=1) HAS wallets → nudge correctly hidden
#        - Dashboard screenshot captured: shows normal dashboard with balance $1,477.15, 13 active wallets
#
#   OVERALL RESULT: ✓✓✓ ALL 5 VERIFICATION ITEMS PASSED ✓✓✓
#
#   NOTES:
#   - All tests performed in READ-ONLY mode (no data created/modified)
#   - No critical issues found
#   - Attribution fix is the key feature and is working correctly
#   - Wallet nudge gating logic is correct (hidden for accounts with wallets)
#   - All SEO pages render with proper content and H1 tags
#   - Sitemap and ads.txt infrastructure fixes are working
# ============================================================================



# ============================================================================
# CURRENT SESSION — 2026-09-05 (pod 4c5482a5): SETUP + EMAIL LOGO FIX + OPS ANALYSIS
#   Restored env from vault (Katiekendra123@) -> pod-bootstrap. LIVE prod DB, SAFE MODE.
#   Preview: https://4c5482a5-2509-48bc-800b-ec8d400e9de4.preview.emergentagent.com
#   Owner login: onarrival21@gmail.com / Katiekendra123@ (user_id=1).
#
#   BUG FIX (committed 11ba6405b, already DEPLOYED to prod dynopay.com): admin + merchant
#     notification emails showed the OLD logo. ROOT CAUSE (backend/utils/emailTemplate.ts
#     getDynopayLogoUrl): (a) fell back to a stale EXTERNAL CDN (files.catbox.moe = OLD mark)
#     whenever SERVER_URL was empty, and (b) reused the SAME /api/static filename so mail-client
#     image proxies (Gmail/Outlook) kept serving the cached OLD image after bytes changed.
#   FIX: regenerated the logo from the landing white wordmark
#     (assets/Icons/home/dynopay-whiteLogo.svg) -> NEW versioned file
#     backend/public/dynopay-email-logo-v2.png (cache-bust); REMOVED the catbox CDN entirely;
#     getDynopayLogoUrl() now builds an own-domain URL via fallback chain
#     SERVER_URL -> FRONTEND_URL -> NEXT_PUBLIC_BASE_URL -> https://dynopay.com. All email
#     types share baseEmailTemplate, so admin + merchant both pick up the same new logo.
#
#   BACKEND TEST FOCUS (READ-ONLY — SAFE MODE, do NOT send real emails / no DB writes):
#     1) GET /api/static/dynopay-email-logo-v2.png -> 200, content-type image/png (served from
#        backend/public via `app.use("/api/static", express.static("public"))`).
#     2) The rendered email HTML (baseEmailTemplate) must embed
#        "<SERVER_URL>/api/static/dynopay-email-logo-v2.png" in BOTH header and footer <img>,
#        and contain ZERO "catbox" references. Helper: getDynopayLogoUrl() in
#        backend/utils/emailTemplate.ts. Admin emails: backend/services/email/adminOpsEmails.ts
#        (uses baseEmailTemplate); merchant emails likewise -> identical logo.
#     3) Legacy path GET /api/static/dynopay-email-logo.png -> 200 image/png too (the old
#        filename was refreshed with the new logo for any in-flight references).
# ============================================================================


# ============================================================================
# >>> FINAL STATUS 2026-09-02: ALL 3 ITEMS COMPLETE + VERIFIED <<<
#   ITEM1 last commit df3eab005: TEST1 Brand terminology PASS, TEST2 Individual/Business create
#     PASS (throwaway brand 115 deleted via API), TEST3 /settings PASS (Account-details tab:
#     save-changes COUNT=1 label "Save Changes", delete-brand COUNT=1, NO asterisks on
#     State/City/Address/Zip, single Brand-details card, "Registered business" account-type chip).
#   ITEM2 skeleton bug: FIXED + verified (frontend PART C: balance never stuck on skeleton across
#     3x navigate-away/back and window blur/focus).
#   ITEM3 Verified Everywhere: DONE + verified (backend endpoint 6/6 incl. SQLi-safe; FE PART A:
#     public-verified-badge visible on storefront, creator, product page, store checkout; emailed
#     order receipt gets green "Identity-verified merchant" line — email OFF in SAFE MODE).
#   NOTE: /pay hosted-checkout badge NOT visually shown only because ALL seeded links are expired
#     by the checkout's time rule (not a code issue); same component+endpoint proven elsewhere.

# CURRENT SESSION — 2026-09-02 (pod 054d2272): SETUP + TEST LAST COMMIT + FEATURE + BUG
#   Restored env from encrypted vault (passphrase Katiekendra123@) -> pod-bootstrap --skip-env.
#   LIVE prod DB, SAFE MODE (bg jobs off, email off, Redis /1, Binance/SSH tunnel blanked).
#   Preview: https://vault-setup-4.preview.emergentagent.com
#   Owner login: onarrival21@gmail.com / Katiekendra123@ (user_id=1, company_id=1 "Hostbay").
#
#   PLAN (user-approved):
#   1) TEST last commit df3eab005 "Brand terminology + Add-brand account-type choice + settings fixes"
#      (FRONTEND). User approved creating a THROWAWAY test brand then DELETING it (prod DB write, reversible).
#   2) FIX bug: after auto-refresh on return, Dashboard balance stuck on skeleton until manual refresh.
#   3) FEATURE "Verified Everywhere": show KYC identity-verified badge on ALL buyer-facing surfaces
#      (hosted /pay page, storefront checkout+product, on-screen receipt/success, emailed receipt)
#      via a NEW read-only PUBLIC endpoint (buyers are unauthenticated).
#
#   FRONTEND TEST FOCUS (item 1) — testids:
#     Login (2-step): login-email-input -> Continue (exact) -> password-input -> signin-submit-btn
#     Add brand: company-selector-trigger -> add-company-btn -> createbrand-account-type-chooser
#       (options createbrand-account-type-individual / -business); individual hides name section,
#       email optional; company-name-input, company-country-input, company-currency-input;
#       create-company-submit-btn. Verify "Brand" terminology (not "Company").
#     Settings dialog: settings-save-changes-btn (label "Save Changes"), settings-delete-brand-btn,
#       account-type-chooser, account-type-business-badge. /settings must NOT double-render account details.
#     Delete throwaway brand: settings-delete-brand-btn -> type brand name into
#       delete-company-confirm-input -> confirm "Delete". MUST clean up (leave prod as found).
# ============================================================================

# ============================================================================
# STATUS (2026-09-02, pod 054d2272) — progress + BACKEND TEST FOCUS
# ----------------------------------------------------------------------------
#   ITEM 1 (last commit): TEST1 (Brand terminology) + TEST2 (Individual/Business create) PASS.
#     Throwaway brand "QA Throwaway 90202" (company_id=115) created then DELETED via API
#     (DELETE /api/company/deleteCompany/115 -> "Company deleted successfully!"; prod restored
#     to SMADAV(71)+The Dev Store(1)). TEST3 (/settings duplicate-render + "Save Changes" label +
#     no required asterisks on State/City/Address/Zip) still needs a read-only FE check.
#   ITEM 2 (skeleton bug): FIXED. Root cause: DashboardAction dispatches DASHBOARD_INIT ->
#     reducer sets loading:true, but DashboardSaga dedupe `break`ed without a terminal action ->
#     loading stuck true -> VolumeHero showSkeleton + Sparkline stuck. FIX (Redux/Reducers/
#     dashboardReducer.ts + Redux/Sagas/DashboardSaga.ts): added statsLoaded/chartLoaded flags so
#     the skeleton only shows on genuine first load; saga dedupe now clears transient loading.
#   ITEM 3 (Verified Everywhere): DONE + partially verified.
#     Backend: NEW read-only public endpoint GET /api/public/merchant-verification
#       ?handle= | ?linkRef= | ?orderId=  -> { verified, business_name }. Helper
#       backend/helper/merchantVerification.ts. Emailed buyer receipt
#       (orderEmails.sendOrderReceiptEmail) adds a green "Identity-verified merchant" line
#       (email OFF in SAFE MODE so not delivery-tested).
#     Frontend: NEW Components/UI/PublicVerifiedBadge (testid=public-verified-badge), wired into
#       CleanCheckoutV2 (H1 + on-screen receipt, linkRef=d), ShopHero (handle), product page,
#       store checkout (handle), CreatorProfile (handle), order/[publicRef] (handle+orderId).
#       i18n verifiedBadge.{label,tooltip} added to all 6 common.json.
#     VERIFIED: endpoint handle=devhub -> verified:true "The Dev Store" (internal + preview
#       ingress); real linkRefs (user_id=1) -> true; unknown/none -> false. BADGE RENDERS: green
#       check next to "The Dev Store" on /devhub/shop (preview screenshot-confirmed).
#
#   BACKEND TEST FOCUS (deep_testing_backend_v2, READ-ONLY — prod DB):
#     GET /api/public/merchant-verification
#       - ?handle=devhub            -> 200 { verified:true, business_name:"The Dev Store" }
#       - ?handle=<random-nonexist> -> 200 { verified:false }
#       - (no params)               -> 200 { verified:false }
#       - ?linkRef=ZZZZZZ (bogus)   -> 200 { verified:false }
#       - ?linkRef=<real active link ref owned by user_id=1> -> 200 { verified:true }
#         (get a ref: login onarrival21@gmail.com/Katiekendra123@ -> data.accessToken;
#          GET /api/pay/getPaymentLinks?company_id=1 (Bearer) -> parse ?d=<ref> from payment_link)
#       Endpoint must NEVER 4xx/5xx (always 200 with verified boolean); no DB writes.
# ============================================================================




# ############################################################################
# >>> CURRENT MERCHANT LOGIN (updated 2026-08-27, pod f431e319) <<<
#     LOGIN EMAIL:  onarrival21@gmail.com   (password unchanged: Katiekendra123@)
#     user_id=1 ("Hostbay"), company_id=1 — LIVE prod Railway PG.
#
#     The primary email (tbl_user, user_id=1) has been migrated twice:
#         hostbay@moxx.co  ->  moxxcompany@gmail.com  ->  onarrival21@gmail.com
#         (verified: onarrival21@gmail.com logs in; older addresses now return
#          "Invalid email or password").
#
#     ⚠️ ALL references to "hostbay@moxx.co" / "moxxcompany@gmail.com" BELOW ARE
#        HISTORICAL. For any NEW login / testing, USE onarrival21@gmail.com / Katiekendra123@.
#        (2-step flow: /auth/login -> email -> Continue -> password -> Sign in.)
# ############################################################################

# ============================================================================
# CURRENT SESSION — 2026-09-01 (fork, pod d4fef0d9): FLICKER FIX + DOCS + LANDING BRANDS
#   LIVE prod DB, SAFE MODE. Preview: https://vault-setup-4.preview.emergentagent.com
#   Respond in English. Owner: onarrival21@gmail.com / Katiekendra123@ (user_id=1).
#
#   (P0) ISSUE #4 — payment-link "double-load / flicker" — FIXED + VERIFIED.
#     ROOT CAUSE (frontend, not a reload): Components/Page/Pay3Components/CleanCheckoutV2.tsx
#     auto-selects first network+currency then AUTO-RESERVES the address the instant it
#     reaches 'currency_select'. The 'creating_payment' phase early-returned a FULL-PANEL
#     loader ('Preparing payment address…') that BLANKED the header/amount for ~5s, so the
#     checkout appeared -> vanished -> reappeared. FIX: the full-panel loader now handles
#     ONLY phase 'loading_meta'; 'creating_payment' keeps the header/amount/coin-selects
#     mounted and shows an INLINE spinner (data-testid=clean-checkout-preparing) in the
#     address area. Verified via instrumented Playwright (clean-checkout-h1 stays mounted
#     continuously; single 'load' event = no reload) + testing_agent iteration_109 (4/4 PASS).
#     Cloudflare note: the leading 307 seen in headless traces is a __cf_bm bot-cookie
#     handshake (curl returns 200 directly) — NOT an app bug.
#
#   (P1) DOCS — Buy Button + all integration methods now covered.
#     - pages/documentation.tsx: new SECTIONS entry {id:'buy-button'} + <Box id='buy-button'>
#       (snippet <dynopay-buy-button> + embed.js + attributes table); Overview gained a
#       'Ways to accept payments' list (Hosted Checkout, Payment Links, Buy Button, Direct
#       API, Embedded Checkout, Elements, Webhooks) + a 'Multiple brands, one account' InfoBox.
#     - DEVELOPER_INTEGRATION_GUIDE.md: new 'Ways to Accept Payments (Overview)' table,
#       'Payment Links' section, 'Buy Button' section, 'Multiple brands' note + TOC entries.
#
#   (P1) LANDING + RENAME — multi-tenant surfaced as "Brands".
#     - Components/Page/Home/v3/WhyDynoPayV3.tsx: 7th card 'One account, every brand'
#       (i18n v3.why.c7t/c7d added to all 6 landing.json via scripts/inject_brands_i18n.py).
#     - CompanySelector switcher relabelled to Brands: dashboardLayout.json
#       companySelectorTitle 'Your Companies'->'Your brands', addCompany 'Add New Company'->
#       'Add brand' in all 6 locales (scripts/rename_brands_switcher.py). Only the switcher
#       was renamed — deeper in-app "Company" labels (settings/KYC/add-business dialog) left
#       as-is pending user confirmation (KYC legally verifies a company, not a "brand").
#
#   (BUG) SANDBOX KEY MISSING FOR THE DEV STORE — FIXED + VERIFIED (testing_agent iter 110).
#     User: "I used to see the Sandbox key but can't anymore." RCA: The Dev Store
#     (company_id=1, created 2026-04-18) predates sandbox auto-provisioning, so tbl_api
#     had ONLY a dpk_live_ (production) row, never a dpk_test_ (development) one — the UI
#     (Components/Page/API/ApiKeysPage.tsx) just renders whatever getApi returns, so no
#     Test card showed. Also confirmed the LIVE key FORMAT never changed: the user's pasted
#     value (U2FsdGVkX1…) is just the CryptoJS-AES encrypted-at-rest form; decrypts to
#     dpk_live_DYNOPAY_USER_API-{json}, identical family to August-era keys. FIX: created the
#     missing sandbox key via the tested production endpoint POST /api/userApi/addApi
#     {company_id:1, base_currency:USD, environment:development} -> api_id=92, dpk_test_,
#     sandbox_mode:true, max $100, BTC/ETH/USDT-TRC20/TRX/LTC. Reversible (delete/disable
#     api_id=92 to revert). Integration_expert consulted (auth): recommends a shared
#     ensureSandboxApiKey() helper + a one-time idempotent backfill for ALL legacy accounts
#     + a partial unique index (company_id, environment) WHERE status='active'; do NOT
#     provision inside GET. Systemic backfill for other old companies is STILL PENDING user
#     go-ahead (see open design Qs).
#
#   (P1) SANDBOX API TEST (item #5) — now UNBLOCKED for The Dev Store (has dpk_test_ api_id=92).
#     FINDING: "The Dev Store" (company_id=1) has NO pk_test_ publishable key and NO
#     'development' secret API key — only 2 pk_live_ keys (pub_key_id 6 active) + 1
#     'production' secret key (api_id=2). So the sandbox happy-path can't be run as-is.
#     DONE (safe, no-funds, industry-standards validation of the PUBLIC embed/buy-button
#     surface via /api/embed/public/session): 401 missing key / 401 invalid format / 401
#     unknown key / 403 origin-missing / 403 origin-not-allowed — ALL correct. (Preview
#     ingress overrides the Origin header, so the allowed-origin happy path can't be curled;
#     needs a real browser page on an allow-listed domain.) AWAITING user direction on the
#     sandbox key (create temp pk_test + dev secret key, or point to an existing one).
#
#   CLEANUP: throwaway link_id=302 (ref 6SpZe9, $5 The Dev Store) created to reproduce the
#   flicker was DELETED (link-exists/6SpZe9 -> exists:false).
#   Throwaway probe/injector helpers (flicker_*.js, inject_brands_i18n.py,
#   rename_brands_switcher.py, shot_*.png) were REMOVED after use — not committed.
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-01 (pod d4fef0d9): KYC-VERIFY HOSTBAY + VERIFIED BADGE
#   Prod-connected, SAFE MODE. Owner: onarrival21@gmail.com / Katiekendra123@ (user_id=1).
#
#   USER REQUEST: "Mark Hostbay (onarrival21@gmail.com) as KYC verified; show a verified
#   icon somewhere relevant."
#
#   DONE (PROD DB WRITE — reversible):
#   - Inserted tbl_kyc rows status='approved' for user_id=1: company_id=1 (The Dev Store),
#     company_id=71 (SMADAV), and account-level (company_id NULL). Tagged
#     veriff_reason='Manually verified (merchant request 2026-09-01)'.
#     UNDO: DELETE FROM tbl_kyc WHERE user_id=1 AND veriff_reason='Manually verified (merchant request 2026-09-01)';
#   - VERIFIED via API: GET /api/kyc/status?company_id=1 -> status="approved",
#     can_process_payments=true. This UNBLOCKS createPaymentLink (KYC gate cleared).
#
#   FRONTEND: new Components/UI/KycVerifiedBadge/index.tsx (SWR GET /api/kyc/status,
#   renders mdi:check-decagram #12B76A only when status==='approved'); wired into
#   Components/UI/CompanySelector trigger next to the business name. testid=kyc-verified-badge.
#
#   BACKEND TEST FOCUS (now that KYC is approved):
#   1) GET /api/kyc/status?company_id=1 -> status "approved", can_process_payments true.
#   2) E2E re-verify BUG #1 (previously KYC-blocked): POST /api/pay/createPaymentLink
#      (owner JWT; login returns data.accessToken; send as Bearer). amount 25 USD,
#      email onarrival21+ptest@gmail.com, 2+ cryptos [BTC,ETH]. ASSERT response.data.short_link
#      == <SERVER_URL>/<6charRef> (NO "/pay?d="); response.data.payment_link STILL has
#      "/pay?d=<ref>"; same 6-char ref in both. Then DELETE /api/pay/deletePaymentLink/<link_id>.
# ============================================================================



# ============================================================================
# CURRENT SESSION — 2026-09-01 (pod d4fef0d9): BUG #1 — BRANDED SHORT LINK IN EMAILS
#   Prod-connected, SAFE MODE (ENABLE_BACKGROUND_JOBS=false, WORKER_ROLE=secondary,
#   DISABLE_OUTBOUND_EMAIL=true, Redis /1). Owner login: onarrival21@gmail.com /
#   Katiekendra123@ (user_id=1, company_id=1 "Hostbay"). LIVE prod DB — prefer read-only.
#
#   USER BUG: "The email received still shows checkout.dynopay.com instead of
#   https://dynopay.com/<6-digit> when a payment link is created."
#
#   FIX (backend only, additive/non-breaking) in
#   backend/controller/payment/paymentLinkController.ts (createPaymentLink):
#     - Added `brandedShortLink` = (SERVER_URL||FRONTEND_URL||CHECKOUT_URL)/<uniqueRef>
#       (on prod = https://dynopay.com/<ref>; on this pod = <preview>/<ref>).
#     - Emails now use brandedShortLink: customer "Pay Now" href, merchant
#       sendPaymentLinkCreatedEmail, and sendCrowdfundingCampaignCreatedEmail.
#     - DB/Redis `payment_link` KEPT as CHECKOUT_URL/pay?d=<ref> (other flows parse
#       the ?d= param — see updatePaymentLink/delete + tbl_payment_link LIKE '%d=%').
#     - Response now ALSO returns additive `short_link` = brandedShortLink.
#
#   BACKEND TEST FOCUS (create + read-only assertions; delete the test link after):
#     POST /api/userApi/createPaymentLink (owner JWT). Assert response.data.short_link
#     == "<SERVER_URL>/<6charRef>" (no "/pay?d="), and response.data.payment_link
#     STILL == "<CHECKOUT_URL>/pay?d=<same 6charRef>" (unchanged). 6-char base62 ref
#     must be identical in both. Email is OFF (SAFE MODE) — do NOT assert delivery.
#
#   RESULT (deep_testing_backend_v2, 2026-09-01): FIX CODE-VERIFIED 6/6 (short_link
#     added + used in all 3 email sends; payment_link/DB format preserved; response
#     returns additive short_link). Could NOT create a NEW link at runtime: company_id=1
#     is KYC-BLOCKED (checkKycEnforcement — volume $29,144 > $10,000 threshold, 90-day
#     grace expired, kyc_status=not_started). KYC is per-OWNER (user_id=1) so BOTH its
#     companies ("The Dev Store" id=1, "SMADAV" id=71) are blocked from live link
#     creation. 41 existing links inspected: correct payment_link (/pay?d=) + short_link=null (pre-fix).
#   NOTE: The user's "sandbox API on The Dev Store" = a PUBLISHABLE KEY (pk_test_…,
#     environment='development') for the Buy Button / checkout-session flow
#     (/api/publishable-keys + /api/buy-buttons) — a DIFFERENT path than createPaymentLink.
#     Use it for item #5 (sandbox API test) and #2 (Buy Button docs). It is NOT KYC-gated.
# ============================================================================


# ============================================================================
# NOTE (2026-09-01, pod d4fef0d9): Older session history (40k+ lines) was TRIMMED
#   from this file so it stays under the git commit size limit (~500KB). Full
#   history is preserved in git commits (use `git log --follow test_result.md`).
#   Keep this file lean going forward — summarise, don't paste full test dumps.
# ============================================================================
