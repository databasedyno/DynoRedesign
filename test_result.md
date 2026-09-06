# ============================================================================
# CURRENT SESSION — 2026-09-06 (pod 4afb1c97): 4 MERCHANT UX FIXES + CHECKOUT REAL-TIME STATUS
#   Preview: https://4afb1c97-1770-4379-a4ad-47899915d230.preview.emergentagent.com
#   Merchant login: onarrival21@gmail.com / Katiekendra123@ (2-step: email -> Continue -> password)
#   ⚠ Preview is wired to the LIVE prod DB — READ-ONLY checks preferred; do not create/save records
#     unless explicitly asked. Do NOT touch Binance/conversion code (out of scope this session).
#
#   1) Settings -> "Plan & fees" now IN-APP (was router.push("/fees") marketing page).
#      - pages/settings/index.tsx: new SectionKey "plan" (rail group Payments), renders
#        Components/Page/Settings/PlanFeesSection.tsx (reuses dashboard FeeTierCard + fee breakdown +
#        worked example + "View public pricing page" link). constants/feeTiers.ts = shared ladder.
#      - URL: /settings?section=plan ; testids: plan-fees-section, plan-fees-tier-card,
#        plan-fees-breakdown, plan-fees-current-pct, plan-fees-example, plan-fees-public-link.
#   2) Settings -> Payments -> Crypto conversion: "Save Changes" was PERMANENTLY DISABLED.
#      ROOT CAUSE: CompanySettingsDialog validated ALL fields incl. hidden Company ones; company 1 has
#      email=NULL -> yup email.required() failed silently in the Payments-only view.
#      FIX: yup schema scoped to visible sections; submit payload scoped to visible sections too
#      (hidden company identity fields no longer sent as ""). File: Components/UI/CompanySettingsDialog/index.tsx
#   3) "+ New -> Payment link" quick-create drawer: "What is this payment for?" is the BUYER PREVIEW
#      (not an input) -> typing went nowhere, and the bare `n` hotkey re-opened the "+ New" menu over the
#      drawer (focus trap swallowed keystrokes).
#      FIX: preview lines are now tap-to-edit buttons (testids quick-create-preview-description /
#      quick-create-preview-amount) focusing the real inputs; Amount autofocused on open (desktop only);
#      CreateNewButton `n` shortcut ignored while any MUI modal/dialog/drawer/menu is open.
#      + REDESIGN of /create-pay-link form: numbered sections 01 What is this payment for? (product
#      quick-sell + description) / 02 How much? (amount+currency row) / 03 Details (client+expiry grid,
#      fee payer option cards testids fee-payer-customer / fee-payer-company) / 04 Accepted cryptos.
#      Files: Components/UI/pay-link/PaymentSettingsBasic.tsx, DescriptionSection.tsx, CryptoSelection.tsx,
#      Components/Page/CreatePaymentLink/index.tsx + styled.tsx (FormSectionRoot/Header, FieldGrid, OptionCard).
#      All handlers/props/testids preserved (pay-link-description, pay-link-form-sections, pay-link-section-*).
#   4) CHECKOUT REAL-TIME STATUS (buyer): backend webhook pipeline goes detected->confirmed in ~3s but the
#      checkout polled every 10s -> buyer jumped straight to the paid card.
#      BACKEND (NEW): GET /api/pay/stream?address=<addr>[&destination_tag=..]&token=<customer jwt>
#        (SSE; token lifted from query into Authorization by tokenFromQuery, then customerAuthMiddleware).
#        Files: backend/services/checkoutStreamService.ts (publishCheckoutStatus/attachCheckoutStream,
#        channel checkout:<addr lowercased>), backend/controller/payment/settlement/checkoutStream.ts,
#        routes/paymentRouter.ts. Publishers: webhooks/index.ts (on webhook receipt -> "pending"),
#        services/webhookProcessor.ts ("processing", "confirmed", "underpaid", "failed", recovery "confirmed").
#        Events: connected (from sseService), ready {status snapshot from Redis}, status {...}, ping.
#        Expected: no token -> 403 "Your Login has Expired"; bad token -> 403; missing/invalid address
#        (with valid token) -> 400; valid -> 200 text/event-stream with `event: connected` then `event: ready`.
#      FRONTEND: CleanCheckoutV2.tsx subscribes via EventSource (checkoutStreamUrl in checkoutApi.ts),
#        re-verifies on every hint; polling fallback 4s (no SSE) / 10s (SSE connected); "Payment detected —
#        confirming" step held >= 2.5s (MIN_DETECTED_DWELL_MS) before the confirmed card.
#   5) TRANSACTIONS PAGE POLISH (dashboard parity — "Quiet Money"/v2026 language):
#      styled.tsx: flat 16px card + CB hairline (no filled header band / shadows), uppercase tech-font
#      column eyebrows (EYEBROW_SX), row hover + hairline dividers, borderless coin icon+ticker
#      (CryptoIconChip), source filter = segmented pill control (SourceChipsRow/SourceChip, indigo active),
#      toolbar radius 16. TransactionsTable.tsx: header image icons removed, sticky header solid paper,
#      mono tabular IDs, secondary date, flat mobile cards (testid tx-card: coin tile + mono amount +
#      StatusDot + date; row 2 source + #id). index.tsx: "Tax collected" pill flat w/ eyebrow label.
#      Statuses were already StatusDot (dot+text) — unchanged; details drawer unchanged.
#      FE TEST FOCUS: /transactions renders card + eyebrow headers; sorting still works (tx-sort-*);
#      source chips (transactions-source-chip-*) + status chips filter; row click opens details drawer;
#      mobile 390px cards render with tx-card-status + tx-fiat-value; dark mode legible.
#   6) PAYMENT LINKS POLISH (/pay-links): Payment-link/styled.tsx — flat 16px card + CB hairline, eyebrow
#      TableHeaderCell, paper HeaderRow (was #EEF4FF band), hairline footer, NEW RowActionButton (ghost,
#      tone primary=indigo copy/refund, danger=delete, neutral view/edit; 36px desktop / 44px mobile).
#      PaymentLinksTable.tsx — header image icons removed (eyebrow labels), hairline row dividers + hover,
#      mono link IDs, all CopyButton usages -> RowActionButton (desktop + mobile), mobile card testid
#      paylink-card 16px hairline. Create form PanelCard radius -> 16px (CreatePaymentLink/index.tsx).
#   7) CHECKOUT COPY FEEDBACK: CleanCheckoutV2 — address/amount rows (testids clean-checkout-address-row /
#      clean-checkout-amount-row, attr data-copied="true|false") get a 1.6s indigo ring+tint pulse
#      (@keyframes checkoutCopyPulse, reduced-motion safe); copy button fills indigo with "✓ Copied";
#      aria-live on the label. Existing copiedFlag timer (1600ms) unchanged.
#   8) CONFIRMED CELEBRATION: success disc (testid clean-checkout-success-icon) pops in
#      (@keyframes checkoutSuccessPop) and an inline SVG check-mark (.check-path) draws via
#      stroke-dashoffset (@keyframes checkoutCheckDraw, 560ms, 320ms delay), once on mount; disabled
#      under prefers-reduced-motion. Confetti unchanged.
#      VERIFIED via Playwright with mocked /api/pay/addPayment + verifyCryptoPayment on link ref rNtQRX
#      (QA link 281, $15) — HOW TO TEST WITHOUT PROD WRITES: route-mock addPayment -> {status:true,data:{address,
#      amount,merchant_amount,fees,fee_payer,transaction_id,remaining_minutes}} and verifyCryptoPayment ->
#      {status:true,data:{status:'waiting'|'pending'|'confirmed',...}}; abort /api/pay/stream. Select LTC in
#      clean-checkout-currency-select. Do NOT let real addPayment through (creates prod rows).
#   BACKEND TESTED (testing agent 2026-09-06): 11/11 PASS — /health, stream auth/validation matrix, SSE frames,
#     destination_tag channels, verifyCryptoPayment regression, no log errors. Agent noted the preview's
#     Python proxy (backend/server.py) buffered responses -> FIXED: server.py now streams text/event-stream
#     responses chunk-by-chunk (httpx send(stream=True) + aiter_raw, no read timeout for SSE). Verified
#     connected+ready frames arrive via :8001 within <1s. Prod uses nginx->Node directly (start-all.sh).
#   BACKEND TEST FOCUS: /health healthy; /api/pay/stream auth + validation matrix above; existing
#     POST /api/pay/verifyCryptoPayment unchanged; backend compiles (tsc clean) and no new error logs.
#   FE TEST FOCUS (only with user permission): settings plan section; Payments Save enabled after toggling
#     auto-convert radios (DO NOT click Save — prod DB); quick-create typing after clicking preview incl.
#     letters "n"; /create-pay-link sections 01-04 render + fee payer cards toggle; checkout page loads.
# ============================================================================

# ============================================================================
# CURRENT SESSION — 2026-09-05: BRAND AUDIT (logo sweep) + admin-sidebar fix
#   Swept all logo assets/usages (favicons, OG, landing/auth/header/footer, PDF invoice+receipt,
#   emails, Logo component). RESULT: every RENDERED surface already uses the new indigo
#   "dyn○pay" coin brand. Confirmed:
#     - backend/assets/dynopay-logo.png (invoice PDF) = NEW; backend/assets/dynopay-white-logo.png
#       (receipt PDF) = NEW coin; backend/public/dynopay-email-logo-v2.png (emails) = NEW;
#       assets/Icons/home/dynopay-blackLogo/whiteLogo.svg (landing/header/auth) = NEW wordmark+coin;
#       assets/Icons/Logo.tsx = NEW coin.
#   ONE GAP FIXED: Components/Layout/BrandLogo/index.tsx (used by admin Sidebar via AdminHeader)
#     rendered a bare Typography "D" (image commented out) -> now renders <Logo width=40 height=40/>
#     (the new coin mark). Lint clean.
#   DEAD/UNUSED stale files (NOT referenced anywhere, safe to ignore/delete later):
#     assets/Images/auth/dynopay-logo.png (old blue), dynopay-logo.svg, dynopay-mobile-logo.png,
#     backend/public/dynopay-email-logo.png (old v1).
#   PENDING: optional FE visual check of admin sidebar (requires admin login) — ask user.
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-05: OG (LINK-PREVIEW) IMAGE OLD-LOGO FIX
#   ISSUE: sharing dynopay.com/quality unfurled a card whose baked-in OG image
#     (public/og/dynopay-og.png) still showed the OLD black blob logo bottom-left.
#   ROOT CAUSE: dynopay-og.png is a hand-made asset (NOT built by generate-og-images.py,
#     which per-route cards use). The per-route cards already use the new indigo coin
#     (assets/Images/auth/dynopay-white-logo.png -> new coin), only this one was stale.
#   FIX: PIL-composited the new indigo conversion-coin (from favicon-512.png) over the old
#     black mark in public/og/dynopay-og.png (erased old blob at x68-122,y504-562 with the
#     flat bg #F7F7FB, pasted 52px coin at (70,508)); wordmark "dynopay" kept. Verified visually.
#     Bumped og:image URL to ?v=2 in pages/_app.tsx (DEFAULT_OG_IMAGE) so social scrapers refetch.
#   VERIFIED: / and /quality emit og:image = /og/dynopay-og.png?v=2 (HTTP 200); lint clean.
#   NOTE: social platforms (iMessage/Slack/WA/FB/LinkedIn) cache OG cards + favicons; already-
#     shared links refresh on their own TTL or via each platform's re-scrape/debugger.
#   FE TEST FOCUS: screenshot the OG image URL -> must show indigo coin + "dynopay" (no black
#     blob); confirm og:image meta on / and /quality = ...dynopay-og.png?v=2 and returns 200.
# ============================================================================

# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05: OG IMAGE FIX — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent (Playwright browser automation)
#   Test date: 2026-09-05
#   Preview URL: https://onboard-app-11.preview.emergentagent.com
#
#   CONTEXT: Verified the Open Graph (OG) image fix for Dynopay. The old black 
#   blob logo was replaced with the NEW indigo/purple circular conversion-coin 
#   mark (white looping arrows) to match the landing page branding.
#
#   TEST RESULTS SUMMARY: 4/4 VERIFICATION ITEMS PASSED
#
#   ✓ 1) OG IMAGE VISUAL — PASS
#        Direct URL: /og/dynopay-og.png?v=2
#        - HTTP Status: 200 OK
#        - Content-Type: image/png
#        - Visual inspection confirms: INDIGO/PURPLE circular mark with white 
#          curved arrows forming a loop (the "conversion coin") next to the 
#          word "dynopay" at bottom-left
#        - Card text: "Accept crypto payments. Get paid your way."
#        - Subline: "Bitcoin · Ethereum · USDT · USDC — settled to your own wallet"
#        - ✓ PASS: Shows NEW indigo coin (NOT the old black blob)
#        - Screenshot: .screenshots/og-image-direct.png
#
#   ✓ 2) HOMEPAGE (/) OG:IMAGE META TAG — PASS
#        - og:image content: https://dynopay.com/og/dynopay-og.png?v=2
#        - ✓ Contains ?v=2 version suffix (cache-bust parameter present)
#        - ✓ References dynopay-og.png
#        - ✓ Full production URL format
#        - og:image:width: 1200
#        - og:image:height: 630
#        - Page title: "Accept Crypto Payments — Get Paid Your Way · Dynopay"
#        - Screenshot: .screenshots/homepage-retry.png
#
#   ✓ 3) /quality PAGE OG:IMAGE META TAG — PASS
#        - og:image content: https://dynopay.com/og/dynopay-og.png?v=2
#        - ✓ Contains ?v=2 version suffix (cache-bust parameter present)
#        - ✓ References dynopay-og.png
#        - ✓ Full production URL format
#        - Screenshot: .screenshots/quality-page-og-meta.png
#
#   ✓ 4) ASSET AVAILABILITY — PASS
#        - GET /og/dynopay-og.png?v=2 → HTTP 200
#        - Content-Type: image/png (correct image content-type)
#        - Asset is publicly accessible and returns valid image data
#
#   OVERALL RESULT: ✓✓✓ ALL 4 VERIFICATION ITEMS PASSED ✓✓✓
#
#   DETAILED FINDINGS:
#   - The OG image fix is working correctly as specified
#   - The NEW indigo/purple conversion-coin logo is visible (not the old black blob)
#   - Both homepage (/) and /quality page emit the correct og:image meta tag
#   - The ?v=2 cache-busting parameter is present on all og:image references
#   - The OG image asset is publicly accessible and returns HTTP 200
#   - Visual branding is consistent with the landing page logo
#   - No critical issues found
#
#   NOTES:
#   - The site now correctly serves the updated OG image with new branding
#   - Social platforms (iMessage/Slack/WhatsApp/Facebook/LinkedIn) cache OG 
#     cards and will refresh on their own TTL or via platform-specific 
#     re-scrape/debugger tools
#   - The fix addresses the root cause: replaced the old black blob logo with 
#     the new indigo conversion-coin mark in the OG image file itself
#   - All tests performed via READ-ONLY browser automation (no data writes)
# ============================================================================




# ============================================================================
# CURRENT SESSION — 2026-09-05: RPC HEALTH FALSE-ALERT FIX (prod "ETH RPC unreachable — timeout")
#   RCA (via DigitalOcean prod logs): Tatum API transiently degraded ~10:00 UTC
#     (rate refresh took 29777ms; Tatum returned Cloudflare "error code: 524" on TRON/POLYGON).
#     The single 8s ETH health ping timed out -> HIGH alert; recovered by 10:10 (ETH 3/3 healthy).
#     => flappy false-positive; not our infra, not a dead endpoint.
#   FIX (services/rpcHealthMonitor.ts):
#     - DEBOUNCE: new exported registerResult(url,ok) / resetRpcHealthState() / getFailStreak().
#       Per-endpoint consecutive-failure streak; HIGH alert fires ONLY when streak reaches
#       FAILURE_THRESHOLD (env RPC_HEALTH_FAILURE_THRESHOLD, default 2) and only once per outage;
#       recovery logged only if we had alerted. CRITICAL "all down" fires only when EVERY endpoint
#       is sustained-down (>=threshold).
#     - RETRY: pingRpc retries once (750ms) on timeout/network AND on HTTP 5xx/524.
#     - TOLERANCE: PING_TIMEOUT_MS 8s -> 10s (env RPC_HEALTH_PING_TIMEOUT_MS).
#   SELF-CHECK (ts-node): blip1 alert=false; blip2 alert=true; blip3 alert=false; recover recovered=true;
#     transient single-blip-then-recover => alert=false, recovered=false (NO noise). Backend healthy.
#   BACKEND TEST FOCUS: import {registerResult,resetRpcHealthState,getFailStreak} from
#     services/rpcHealthMonitor and assert the above sequence (run ts-node inside /app/backend).
#     Also confirm backend /health healthy after the change.
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-05: AMOUNT CONSISTENCY (dashboard + PDF match emails)
#   Goal: dashboard & PDF receipts show clean 2-decimal money like the emails.
#   FRONTEND: utils/currencyFormat.ts — added isStablecoin() + formatDisplayAmount()
#     (stablecoins USDT/USDC/.../fiat -> 2dp + separators; other crypto -> trim<=8dp).
#     Kept shared formatCryptoAmount UNCHANGED so live checkout "amount to send" keeps
#     full precision. Applied formatDisplayAmount in: Transactions/index.tsx (table amount),
#     Dashboard/RecentTransactionsWidget.tsx (primary amount), Customers/index.tsx (wallet +
#     payment history). Lint clean.
#   BACKEND (PDF + receipt emails): pdfReceiptService.ts now formats amount/cryptoAmount/
#     youPaid via formatMoneyForEmail (covers all receipt callers). customerReceiptEmail.ts
#     breakdown (merchantReceives/platformFee) + body crypto row switched to formatMoneyForEmail.
#   VERIFIED: backend boots healthy; generatePaymentReceipt with "220.00000000" input
#     produces a valid 24KB PDF (code path + formatter applied, no crash).
#   PENDING: frontend UI visual verification of dashboard formatting (ask user before FE test).
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-05: EMAIL AMOUNT FORMATTING + DEPLOY HARDENING
#   A) EMAIL AMOUNTS (reported bug: "3.20000000 USDT-TRC20" 8-zero noise in emails)
#      - NEW helper emailShared.formatMoneyForEmail(amount,currency): stable/fiat -> 2dp
#        (3.20 / 216.80 / 220.00), other crypto -> up to 8dp with trailing zeros trimmed.
#      - Applied in: adminOpsEmails.ts (Platform Fee Received: fee/merchant/total + subject;
#        Admin Fee Swept), conversionEmails.ts (auto-convert payout/source + subject),
#        walletEmails.ts (withdrawal amount rows). Verified via ts-node: 3.20000000->3.20,
#        216.80000000->216.80, 220.00000000->220.00, 0.00512300 BTC->0.005123, 1.5 ETH.
#      NOTE: merchant/customer payment emails already showed clean base amounts (2dp) +
#        formatCryptoAmount for crypto — left unchanged.
#   B) DEPLOY HARDENING (settlement delayed ~13min because prod redeployed mid-confirmation;
#      payment left "processing", recovered later by startup reconciliation)
#      - server.ts gracefulShutdown: now DRAINS the BullMQ settlement worker FIRST (right after
#        HTTP close, before cron/error-digest/db-close), bounded by SETTLEMENT_DRAIN_MS (default
#        18s) so in-flight settlements finish before SIGKILL but can't hang the deploy.
#        worker.close() already waits for ACTIVE jobs; this just gives them the grace window.
#      - "Reconciliation sooner": clean shutdown releases the leader lease early (existing step 0a),
#        so the surviving instance promotes (~15s) and runs startup reconciliation far sooner than
#        the SIGKILL path (~60s TTL + boot). No leader-TTL change made (too risky on live payments).
#   BACKEND TEST FOCUS: (1) backend boots healthy after server.ts edit; (2) formatMoneyForEmail
#     outputs (run ts-node in /app/backend); (3) /api/quality endpoints still OK (regression).
# ============================================================================

# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05: EMAIL FORMATTING + DEPLOY HARDENING — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent
#   Test date: 2026-09-05
#   Base URL: http://localhost:8001
#
#   TEST RESULTS SUMMARY: 3/3 AREAS VERIFIED
#
#   ✓ AREA 1: EMAIL AMOUNT FORMATTING — PASS (7/7 test cases)
#        Created temp test script /app/backend/scripts/_verify_fmt.ts and ran:
#        cd /app/backend && ./node_modules/.bin/ts-node --transpile-only scripts/_verify_fmt.ts
#
#        EXPECTED vs ACTUAL (all match perfectly):
#        - 3.20000000 USDT-TRC20 → 3.20 ✓ (no trailing zeros)
#        - 216.80000000 USDT-TRC20 → 216.80 ✓ (no trailing zeros)
#        - 220.00000000 USDT-TRC20 → 220.00 ✓ (2 decimals for stablecoin)
#        - 220 USD → 220.00 ✓ (2 decimals for fiat)
#        - 0.00512300 BTC → 0.005123 ✓ (trailing zeros trimmed, up to 8 decimals)
#        - 1.50000000 ETH → 1.5 ✓ (trailing zeros trimmed)
#        - 100 USDC → 100.00 ✓ (2 decimals for stablecoin)
#
#        NONE contain trailing "00000000" — bug fix confirmed working.
#
#        Import verification (all files compile without TSError):
#        - services/email/adminOpsEmails.ts: imports formatMoneyForEmail ✓
#          Used in: sendAdminFeeReceivedEmail (lines 131-133), sendAdminFeeSweepEmail (line 193)
#        - services/email/conversionEmails.ts: imports formatMoneyForEmail ✓
#          Used in: sendAutoConversionPayoutEmail (lines 66-67)
#        - services/email/walletEmails.ts: imports formatMoneyForEmail ✓
#          Used in: sendWithdrawalOTPEmail (line 263), sendWithdrawalSuccessEmail (line 301)
#
#        Temp file cleaned up after test.
#
#   ✓ AREA 2: GRACEFUL SHUTDOWN REORDER — PASS
#        Backend boots healthy after server.ts edit:
#        - GET http://localhost:8001/health → HTTP 200
#        - Response: {"status":"healthy","database":"connected"}
#        - No compile/import errors detected
#        - Server started successfully with BullMQ settlement worker drain logic in place
#
#        NOTE: The actual settlement worker drain behavior is production-runtime only
#        (triggered by SIGTERM/SIGINT during deploy). This test confirms the code
#        compiles and the backend remains healthy after the gracefulShutdown reorder.
#
#   ✓ AREA 3: QA QUALITY CENTER REGRESSION CHECK — PASS (3/3 endpoint tests)
#        Base URL: http://localhost:8001/api/quality
#        Passcode header: x-qa-passcode: Dynopay123@
#
#        1. POST /api/quality/auth with correct passcode → HTTP 200 {"ok":true} ✓
#        2. POST /api/quality/auth without passcode → HTTP 401 {"ok":false,"error":"Invalid passcode"} ✓
#        3. POST /api/quality/auth with wrong passcode → HTTP 401 {"ok":false,"error":"Invalid passcode"} ✓
#        4. GET /api/quality/data with correct passcode → HTTP 200 with commentsByItem + customItems ✓
#
#        All endpoints working correctly. No regressions detected.
#
#   OVERALL RESULT: ✓✓✓ ALL 3 AREAS VERIFIED SUCCESSFULLY ✓✓✓
#
#   NOTES:
#   - Email formatting helper working perfectly (no trailing zeros in stablecoins/fiat)
#   - Backend boots healthy after graceful shutdown reorder
#   - QA Quality Center endpoints remain functional (no regressions)
#   - All tests performed via READ-ONLY verification (no data writes except temp test file)
#   - Temp test file /app/backend/scripts/_verify_fmt.ts created and deleted after test
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-05: GOOGLE SEARCH FAVICON FIX (verified by frontend agent)
#   ISSUE: Google search result for "dynopay" showed an old black jagged icon, not the
#   landing-page logo (indigo circle + white conversion-coin).
#   ROOT CAUSE: All PNG favicons in pages/_document.tsx were gated behind
#   media="(prefers-color-scheme:...)" which Googlebot ignores, and there was NO web
#   manifest — so Google only had the .ico + a stale cached icon to work with.
#   (All favicon FILES were already the correct new logo; nothing was broken asset-wise.)
#   FIX:
#     - Added public/favicon-48.png, favicon-192.png, apple-touch-icon.png (180) generated
#       from favicon-512.png (the correct indigo coin), + public/site.webmanifest (icons 192/512,
#       name Dynopay, theme_color #4338CA).
#     - pages/_document.tsx: added UNCONDITIONAL rel=icon PNGs (192,48) + apple-touch-icon 180 +
#       rel=manifest; bumped cache-bust ?v=3 -> ?v=4 on all icon links.
#   VERIFIED (frontend testing agent, ALL PASS): head declares svg + unconditional 192/48 PNG +
#     ico + apple-touch + manifest; all assets HTTP 200; manifest valid; favicon visually matches
#     landing logo; homepage 200 + no console errors.
#   NOTE TO USER: must Save-to-GitHub -> deploy for prod; Google refreshes its cached search
#     favicon on its own crawl schedule (days-weeks) — expedite via Search Console re-indexing.
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-05: QA QUALITY CENTER (/quality) — NEW FEATURE
#   Built a passcode-gated end-to-end QA checklist page at /quality where testers
#   record a status + notes per test function; all notes persist in Postgres so the
#   team can retrieve & fix. Includes custom test items + CSV/JSON export.
#
#   PASSCODE (shared, gate): Dynopay123@   (backend reads process.env.QA_PASSCODE, falls back to this)
#   NOTE: This is NOT the vault password. Vault password (setup only) = Katiekendra123@.
#
#   BACKEND (Node/TS, Sequelize + Postgres):
#     - models/qaModels.ts: tbl_qa_comment (running note thread per item) + tbl_qa_custom_item.
#       Tables auto-created lazily via ensureQaTables() (sync alter:false — additive, safe on prod DB).
#     - routes/qualityRouter.ts mounted at /api/quality (public route, passcode-gated INSIDE via
#       requirePasscode -> x-qa-passcode header). Endpoints:
#         POST /api/quality/auth            validate passcode
#         GET  /api/quality/data            all comments grouped by item_key + custom items
#         POST /api/quality/comment         append a note {item_key,section_id,section_title,case_title,tester,status,note}
#         DELETE /api/quality/comment/:id   delete one note
#         POST /api/quality/custom          add custom test {area,title,description,created_by}
#         DELETE /api/quality/custom/:id    delete custom item (+ its notes)
#         GET  /api/quality/export?format=csv|json   download all notes
#       status enum: pass | fail | blocked | not_tested
#     - middleware/csrfMiddleware.ts: added "/api/quality" to EXEMPT_PATHS (passcode header auth, not cookie).
#     - routes/index.ts: registered qualityRouter.
#
#   FRONTEND (Next.js, MUI): pages/quality.tsx (layout="none", standalone, noindex).
#     Passcode gate -> catalog (data/qaCatalog.ts, extracted from pages/QA.tsx TEST_SECTIONS) rendered
#     as accordions; each test = status select + notes box + Save (appends to DB thread) + delete;
#     custom-test add form; CSV/JSON export; live pass/fail/blocked/untested stats; search.
#
#   MANUAL CURL VERIFICATION (all PASS): auth (right 200 / wrong 403), data, comment add,
#     custom add, export csv, delete comment, delete custom -> DB clean. Frontend route compiles 200.
#
#   BACKEND TEST FOCUS (SAFE MODE, prod DB — only writes to the two NEW tbl_qa_* tables):
#     Base: http://localhost:8001  | header: x-qa-passcode: Dynopay123@
#     1) POST /api/quality/auth wrong passcode -> 401/403; correct -> 200 {ok:true}.
#     2) All endpoints REJECT (401) when x-qa-passcode header is missing/wrong.
#     3) POST /api/quality/comment persists; GET /api/quality/data returns it grouped by item_key.
#     4) POST /api/quality/custom returns item_key "custom::<id>"; appears in /data.
#     5) GET /api/quality/export?format=csv and =json return downloadable content with the rows.
#     6) DELETE comment/:id and custom/:id remove rows. Clean up any rows you create.
# ============================================================================


# ============================================================================
# CURRENT SESSION — 2026-09-05: BING WEBMASTER TOOLS SETUP (verified)
#   Added the Bing DNS verification CNAME via the DigitalOcean DNS API:
#     name=7023c07d2dc9c90065edb194fd8811a5  ->  verify.bing.com  (domain dynopay.com,
#     DO record id 1831196731, ttl 1800). Resolves publicly (CNAME chain to Bing edge).
#   RESULT: dynopay.com is now VERIFIED in Bing Webmaster Tools under the API key's account —
#     GetUrlSubmissionQuota returns DailyQuota=100 (previously ErrorCode 14 NotAuthorized).
#   Bing Webmaster API key stored in backend/.env as BING_WEBMASTER_API_KEY. NOTE: backend/.env is
#     gitignored -> the key is POD-ONLY; it must also be added to PRODUCTION (DigitalOcean app env)
#     for the prod readiness log to work. (Verification + IndexNow + sitemap crawl work regardless.)
#   CODE: backend/utils/bingWebmasterSubmitter.ts -> checkBingWebmasterReadiness() (READ-ONLY: GET
#     GetUrlSubmissionQuota; logs "verified + quota" or an actionable verify reminder). Wired in
#     server.ts ~125s post-boot inside the job-enabled (WORKER_ROLE=primary) block, so it runs in
#     PRODUCTION only (skipped in SAFE-MODE preview). Confirmed via ts-node: logs verified, quota 100.
#     Design note: Bing's JSON Webmaster API has NO working SubmitSitemap/AddFeed op (both 404); Bing
#     auto-crawls the sitemap via robots.txt and IndexNow (indexNowSubmitter.ts) pushes URLs instantly,
#     so we intentionally do NO redundant/quota-limited API resubmission.
#
#   VERIFICATION FOCUS (READ-ONLY; no data writes; app in SAFE MODE on prod DB):
#     1) DNS: `getent hosts 7023c07d2dc9c90065edb194fd8811a5.dynopay.com` resolves through
#        verify.bing.com to a Bing edge host (CNAME live).
#     2) Readiness fn: in /app/backend run
#        `./node_modules/.bin/ts-node --transpile-only -e "require('dotenv/config');import('./utils/bingWebmasterSubmitter').then(m=>m.checkBingWebmasterReadiness())"`
#        -> logs "[Bing] ✅ Webmaster Tools verified for https://dynopay.com (daily URL-submission quota: 100) ...".
#     3) Wiring: server.ts imports checkBingWebmasterReadiness inside the job-enabled block.
# ============================================================================


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
#     Preview base: https://onboard-app-11.preview.emergentagent.com
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
#   Preview URL: https://onboard-app-11.preview.emergentagent.com
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
#   LIVE prod DB, SAFE MODE. Preview: https://onboard-app-11.preview.emergentagent.com
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
#   Preview URL: https://onboard-app-11.preview.emergentagent.com
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
#        - Request URL: https://onboard-app-11.preview.emergentagent.com/api/track/attribution
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
#   Preview: https://onboard-app-11.preview.emergentagent.com
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
#   Preview: https://onboard-app-11.preview.emergentagent.com
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
#   LIVE prod DB, SAFE MODE. Preview: https://onboard-app-11.preview.emergentagent.com
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


# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05: QA QUALITY CENTER BACKEND API — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent (backend_test.py)
#   Test date: 2026-09-05
#   Base URL: http://localhost:8001
#   Passcode: x-qa-passcode: Dynopay123@
#
#   TEST RESULTS SUMMARY: 18/18 TESTS PASSED
#
#   ✓ AUTHENTICATION TESTS (3/3 PASS)
#     1. POST /api/quality/auth with correct passcode → 200 {ok:true} ✓
#     2. POST /api/quality/auth without passcode → 401 (correctly rejected) ✓
#     3. POST /api/quality/auth with wrong passcode → 401 (correctly rejected) ✓
#
#   ✓ GET /api/quality/data TESTS (2/2 PASS)
#     4. GET /api/quality/data without passcode → 401 (correctly rejected) ✓
#     5. GET /api/quality/data with passcode → 200 {ok, commentsByItem, customItems} ✓
#
#   ✓ POST /api/quality/comment TESTS (4/4 PASS)
#     6. Create comment with valid data → 200, comment created with ID ✓
#     7. Created comment appears in GET /data under correct item_key ✓
#     8. Create comment with invalid status → 200, status coerced to "not_tested" ✓
#     9. Create comment without item_key → 400 (correctly rejected) ✓
#
#   ✓ POST /api/quality/custom TESTS (3/3 PASS)
#     10. Create custom item → 200, item_key format "custom::<id>" ✓
#     11. Custom item appears in GET /data customItems array ✓
#     12. Create custom item without title → 400 (correctly rejected) ✓
#
#   ✓ EXPORT TESTS (2/2 PASS)
#     13. GET /api/quality/export?format=csv → 200, text/csv with header row ✓
#     14. GET /api/quality/export?format=json → 200, JSON with comments array ✓
#
#   ✓ DELETE TESTS (3/3 PASS)
#     15. DELETE /api/quality/comment/:id → 200 {ok:true, deleted:1} ✓
#     16. DELETE /api/quality/comment/:id (second comment) → 200 {ok:true, deleted:1} ✓
#     17. DELETE /api/quality/custom/:id → 200 {ok:true, deleted:1} ✓
#
#   ✓ CLEANUP VERIFICATION (1/1 PASS)
#     18. All created test data successfully deleted from database ✓
#
#   DETAILED FINDINGS:
#   - All endpoints correctly enforce passcode authentication (401 without/wrong passcode)
#   - Comment creation persists to database and appears in grouped data structure
#   - Invalid status values are safely coerced to "not_tested" (no 500 errors)
#   - Custom item creation generates correct "custom::<id>" item_key format
#   - CSV export returns proper Content-Type: text/csv with correct header row
#   - JSON export returns proper Content-Type: application/json with comments array
#   - Delete operations successfully remove rows from database
#   - All validation errors return appropriate 400 status codes
#   - Database cleanup successful - no orphaned test data
#
#   OVERALL RESULT: ✓✓✓ ALL 18 TESTS PASSED ✓✓✓
#
#   NOTES:
#   - Tests performed against SAFE MODE environment (prod DB, only writes to new tbl_qa_* tables)
#   - All test data was created and cleaned up successfully
#   - No critical issues found
#   - All endpoints working as specified in the review request
#   - Passcode authentication working correctly on all endpoints
#   - Status coercion working as expected (invalid → "not_tested")
#   - Export functionality (CSV and JSON) working correctly
#   - Database operations (create, read, delete) all functioning properly
# ============================================================================



# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05: FAVICON FIX VERIFICATION — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent (Playwright browser automation)
#   Test date: 2026-09-05
#   Preview URL: https://onboard-app-11.preview.emergentagent.com
#
#   CONTEXT: Verified the favicon fix for Dynopay (Next.js app). Google search was 
#   showing an old/wrong black icon. The fix ensures the site exposes a correct, 
#   consistent favicon that matches the landing-page logo (indigo/purple circle 
#   containing a white "conversion coin" made of two curved arrows forming a loop).
#
#   TEST RESULTS SUMMARY: 5/5 VERIFICATION ITEMS PASSED
#
#   ✓ 1) HOMEPAGE HEAD DECLARATIONS — PASS (6/6 required links found)
#        All required <link> tags are present in the document <head>:
#        - rel="icon" type="image/svg+xml" href="/favicon.svg?v=4" ✓
#        - rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png?v=4" ✓
#          (UNCONDITIONAL — no media attribute, as required for Google)
#        - rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=4" ✓
#          (UNCONDITIONAL — no media attribute, as required for Google)
#        - rel="icon" href="/favicon.ico?v=4" sizes="any" ✓
#        - rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=4" ✓
#        - rel="manifest" href="/site.webmanifest?v=4" ✓
#
#        Additional media-gated icons found (for light/dark mode support):
#        - 32x32 and 16x16 PNG icons with media="(prefers-color-scheme: light/dark)"
#
#        Total icon-related link tags found: 10
#
#   ✓ 2) ASSET AVAILABILITY — PASS (7/7 assets return HTTP 200)
#        All favicon and manifest assets are accessible with correct Content-Type:
#        - /favicon.svg → HTTP 200, Content-Type: image/svg+xml ✓
#        - /favicon.ico → HTTP 200, Content-Type: image/x-icon ✓
#        - /favicon-48.png → HTTP 200, Content-Type: image/png ✓
#        - /favicon-192.png → HTTP 200, Content-Type: image/png ✓
#        - /favicon-512.png → HTTP 200, Content-Type: image/png ✓
#        - /apple-touch-icon.png → HTTP 200, Content-Type: image/png ✓
#        - /site.webmanifest → HTTP 200, Content-Type: application/manifest+json ✓
#
#   ✓ 3) MANIFEST VALIDITY — PASS (4/4 validation checks)
#        /site.webmanifest is valid JSON with correct structure:
#        - Valid JSON format ✓
#        - name: "Dynopay" ✓
#        - theme_color: "#4338CA" (indigo) ✓
#        - icons array contains 2 items:
#          • /favicon-192.png (192x192, image/png) ✓
#          • /favicon-512.png (512x512, image/png) ✓
#
#   ✓ 4) VISUAL CONSISTENCY — PASS
#        Favicon and landing page branding are visually consistent:
#        - Favicon-192.png shows: Indigo/purple circular background (#4338CA) with 
#          two white curved arrows forming a circular loop (the "conversion coin" mark)
#        - Landing page header: Uses consistent indigo/purple brand colors with 
#          "dynopay" wordmark logo in top-left
#        - Visual identity is consistent across favicon and site ✓
#        - Screenshots captured for verification:
#          • /favicon-192.png (direct image URL)
#          • Homepage with header logo
#
#   ✓ 5) HOMEPAGE HEALTH CHECK — PASS (4/4 checks)
#        Homepage loads correctly with no issues:
#        - HTTP Status: 200 OK ✓
#        - Page Title: "Accept Crypto Payments — Get Paid Your Way · Dynopay" ✓
#        - Contains "Dynopay" in title ✓
#        - No error messages found on page ✓
#        - Not a Next.js error page ✓
#        - No console errors introduced ✓
#
#   OVERALL RESULT: ✓✓✓ ALL 5 VERIFICATION ITEMS PASSED ✓✓✓
#
#   DETAILED FINDINGS:
#   - The favicon fix is working correctly as specified
#   - All required unconditional PNG icons (192x192, 48x48) are present without 
#     media attributes, ensuring Google can properly index them
#   - The v=4 cache-busting parameter is applied to all favicon URLs
#   - The site.webmanifest correctly references the high-res PNG icons
#   - Visual consistency confirmed: favicon matches landing page branding
#   - No critical issues found
#
#   NOTES:
#   - Google's search result favicon is external and refreshes on Google's schedule
#   - The site now correctly exposes a consistent, unconditional favicon
#   - The fix addresses the root cause: proper unconditional high-res PNG declarations
#     that Google can index (Googlebot does not evaluate prefers-color-scheme media queries)
#   - All tests performed via READ-ONLY browser automation (no data writes)
# ============================================================================


# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-05: RPC HEALTH FALSE-ALERT FIX — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent
#   Test date: 2026-09-05
#   Base URL: http://localhost:8001
#
#   CONTEXT: Production sent a false "CRITICAL/HIGH — ETH RPC endpoint unreachable: 
#   https://api.tatum.io/v3/ethereum/web3/*** — timeout" alert. Root cause was a 
#   TRANSIENT Tatum slowdown (single 8s health-ping timeout) that recovered on the 
#   next cycle. The fix adds debounce so a single transient blip no longer alerts; 
#   only SUSTAINED failures (FAILURE_THRESHOLD=2 consecutive failures) trigger alerts.
#
#   TEST RESULTS SUMMARY: 2/2 TESTS PASSED
#
#   ✓ TEST 1: DEBOUNCE LOGIC — PASS (6/6 test cases)
#        Created temp test script /app/backend/scripts/_verify_rpc.ts and ran:
#        cd /app/backend && ./node_modules/.bin/ts-node --transpile-only scripts/_verify_rpc.ts
#
#        EXPECTED vs ACTUAL (all match perfectly):
#        Test sequence 1 (sustained failure then recovery):
#        - t1: First failure → {"alert":false,"recovered":false} ✓
#          (Single failure does NOT alert - debounce working)
#        - t2: Second consecutive failure → {"alert":true,"recovered":false} ✓
#          (Threshold reached, alert fires)
#        - t3: Third consecutive failure → {"alert":false,"recovered":false} ✓
#          (Already alerted, no duplicate alert)
#        - t4: Recovery → {"alert":false,"recovered":true} streak= 0 ✓
#          (Recovered flag set because we had alerted, streak reset to 0)
#
#        Test sequence 2 (transient single-blip scenario):
#        - b1: Single failure → {"alert":false,"recovered":false} ✓
#          (First failure, no alert yet)
#        - b2: Immediate recovery → {"alert":false,"recovered":false} ✓
#          (CRITICAL: Single blip then recover produces NO alert and NO recovery 
#          noise - this is the key fix for the production false-positive issue)
#
#        DEBOUNCE LOGIC VERIFIED:
#        - Single transient failure: NO alert (prevents false positives) ✓
#        - Sustained failures (2+ consecutive): Alert fires on threshold ✓
#        - No duplicate alerts after threshold reached ✓
#        - Recovery only logged if we had alerted ✓
#        - Streak counter resets correctly on success ✓
#
#        Temp file cleaned up after test.
#
#   ✓ TEST 2: BACKEND HEALTH — PASS
#        Backend boots healthy after rpcHealthMonitor.ts changes:
#        - GET http://localhost:8001/health → HTTP 200
#        - Response: {"status":"healthy","service":"Dynopay Backend",...}
#        - Database: connected ✓
#        - Redis: connected ✓
#        - Tatum API: operational (circuit_state: CLOSED, failures: 0) ✓
#        - No compile/import errors detected ✓
#        - Server started successfully with debounced RPC health monitoring in place
#
#   OVERALL RESULT: ✓✓✓ ALL TESTS PASSED ✓✓✓
#
#   DETAILED FINDINGS:
#   - The debounce logic is working exactly as designed
#   - FAILURE_THRESHOLD=2 (from env RPC_HEALTH_FAILURE_THRESHOLD, default 2)
#   - Single transient failures (like the production Tatum 8s timeout) will NO 
#     LONGER trigger false alerts
#   - Only SUSTAINED consecutive failures (2+ cycles) will alert
#   - The fix directly addresses the production false-positive issue
#   - Backend compiles and runs healthy with the new monitoring code
#   - All exported functions (registerResult, resetRpcHealthState, getFailStreak) 
#     are working correctly and are unit-testable
#
#   NOTES:
#   - This fix prevents the exact production scenario: a single Tatum API slowdown 
#     (8s timeout) that recovered on the next cycle will no longer page the admin
#   - The retry logic (750ms retry on timeout/5xx) provides additional resilience
#   - PING_TIMEOUT_MS increased from 8s to 10s (env RPC_HEALTH_PING_TIMEOUT_MS)
#   - All tests performed via READ-ONLY verification (no data writes except temp 
#     test file which was created and deleted)
#   - Temp test file /app/backend/scripts/_verify_rpc.ts created and deleted after test
# ============================================================================


# ============================================================================
# TESTING AGENT VERIFICATION — 2026-09-06: CHECKOUT STREAM BACKEND — ALL TESTS PASSED ✓✓✓
# ============================================================================
#   Tested by: testing_agent (backend_test.py)
#   Test date: 2026-09-06
#   Base URL: http://localhost:8001 (Python proxy) / http://localhost:3300 (Node backend)
#   Session: pod 4afb1c97 - CHECKOUT REAL-TIME STATUS feature
#
#   CONTEXT: Verified the new GET /api/pay/stream endpoint for buyer-facing
#   real-time payment status via Server-Sent Events (SSE). This replaces the
#   10-second polling with instant status updates as the webhook pipeline
#   processes payments (detected → confirmed in ~3s).
#
#   TEST RESULTS SUMMARY: 11/11 TESTS PASSED
#
#   ✓ TEST 1: Health Endpoint — PASS
#        - GET /health → HTTP 200
#        - Status: healthy, database: connected, redis: connected
#        - Backend service operational
#
#   ✓ TEST 2: Stream without token — PASS
#        - GET /api/pay/stream?address=<addr> (no token) → HTTP 403
#        - Message: "Your Login has Expired"
#        - Auth middleware correctly rejects unauthenticated requests
#
#   ✓ TEST 3: Stream with garbage token — PASS
#        - GET /api/pay/stream?address=<addr>&token=garbage_token_12345 → HTTP 403
#        - Message: "Invalid token. Please login again."
#        - JWT validation working correctly
#
#   ✓ TEST 4a: Stream missing address — PASS
#        - GET /api/pay/stream?token=<valid jwt> (no address) → HTTP 400
#        - Message: "A valid payment address is required."
#        - Address validation working
#
#   ✓ TEST 4b: Stream with bad address — PASS
#        - GET /api/pay/stream?address=bad!addr&token=<valid jwt> → HTTP 400
#        - Message: "A valid payment address is required."
#        - Address format validation working (regex: /^[A-Za-z0-9:_-]{6,128}$/)
#
#   ✓ TEST 4c: Stream with valid credentials — PASS
#        - GET /api/pay/stream?address=0x4c66...&token=<valid jwt> → HTTP 200
#        - Content-Type: text/event-stream ✓
#        - X-Accel-Buffering: no ✓ (disables nginx buffering)
#        - event: connected with channels array ✓
#        - event: ready with status snapshot (waiting) ✓
#        - Address lowercased in channel: checkout:0x4c66... ✓
#        - SSE stream established successfully
#
#   ✓ TEST 4d: Stream with destination_tag — PASS
#        - GET /api/pay/stream?address=0x4c66...&destination_tag=12345&token=<jwt>
#        - event: connected lists TWO channels:
#          * checkout:0x4c66718579270e0f44e7ab4d70d2b5ce69368ca8 (base)
#          * checkout:0x4c66718579270e0f44e7ab4d70d2b5ce69368ca8:12345 (with tag)
#        - Tag-based chain support working (XRP, RLUSD)
#
#   ✓ TEST 5: verifyCryptoPayment without auth — PASS (regression check)
#        - POST /api/pay/verifyCryptoPayment (no auth) → HTTP 403
#        - Existing endpoint auth unchanged
#
#   ✓ TEST 5 (regression): verifyCryptoPayment with auth — PASS
#        - POST /api/pay/verifyCryptoPayment with JWT → HTTP 200
#        - Returns status for non-existent address (read-only test)
#        - Existing endpoint functionality preserved
#
#   ✓ TEST 6: checkoutStreamService code structure — PASS
#        - Service exports: checkoutChannel, publishCheckoutStatus, attachCheckoutStream ✓
#        - Logic verified: toLowerCase(), channel format `checkout:`, destinationTag support ✓
#        - Implementation matches specification
#
#   ✓ TEST 7: Backend logs check — PASS
#        - No errors related to checkoutStream in /var/log/supervisor/backend.err.log
#        - SSE client connections logged successfully in backend.out.log
#        - Sample: "[SSE] Client checkout-<uuid> (user 0) connected on channels: [checkout:0x4c66...]"
#
#   OVERALL RESULT: ✓✓✓ ALL 11 TESTS PASSED ✓✓✓
#
#   DETAILED FINDINGS:
#   1. Authentication & Authorization:
#      - customerAuthMiddleware correctly validates JWT tokens
#      - tokenFromQuery middleware lifts ?token= into Authorization header (EventSource workaround)
#      - 403 responses for missing/invalid tokens with appropriate messages
#
#   2. Input Validation:
#      - Address validation: regex /^[A-Za-z0-9:_-]{6,128}$/ (6-128 chars, alphanumeric + : _ -)
#      - Destination tag validation: /^\d{1,12}$/ (1-12 digits)
#      - 400 responses for invalid inputs with clear error messages
#
#   3. SSE Stream Implementation:
#      - Correct headers: Content-Type: text/event-stream, Cache-Control: no-cache,
#        Connection: keep-alive, X-Accel-Buffering: no
#      - Events: connected (from sseService), ready (status snapshot), status (updates), ping (keepalive)
#      - Channel naming: checkout:<address lowercased>[:<tag>]
#      - Multiple channel subscription for tag-based chains
#
#   4. Service Architecture:
#      - checkoutStreamService.ts: channel naming, publish, attach functions
#      - checkoutStream.ts: request handler, auth, validation, Redis snapshot
#      - sseService.ts: SSE client registry, channel-based delivery
#      - paymentRouter.ts: route wiring with middleware chain
#
#   5. Redis Integration:
#      - Reads current status from crypto-<address> or getCryptoRedisKey(address, tag)
#      - Maps Redis status to public vocabulary: waiting/pending/processing/confirmed/underpaid/failed
#      - Snapshot sent in "ready" event on connection
#
#   6. Regression Testing:
#      - POST /api/pay/verifyCryptoPayment auth unchanged (403 without token, 200 with token)
#      - No breaking changes to existing checkout flow
#
#   IMPORTANT NOTE — SSE PROXY LIMITATION:
#   The Python proxy (backend/server.py) on port 8001 does NOT support SSE streaming
#   because it buffers the entire response (httpx response.content) before forwarding.
#   SSE requires chunk-by-chunk streaming. Tests 4c and 4d were run against the Node
#   backend directly on port 3300 where SSE works correctly.
#
#   PRODUCTION IMPACT: The preview environment uses the Python proxy, so SSE will NOT
#   work on https://4afb1c97-1770-4379-a4ad-47899915d230.preview.emergentagent.com/api/pay/stream.
#   However, production (dynopay.com) uses nginx directly to the Node backend, so SSE
#   will work correctly in production. The proxy is only used in the preview environment.
#
#   NOTES:
#   - All tests performed in READ-ONLY mode (no DB writes, no payment creation)
#   - Test JWT created with ACCESS_TOKEN_SECRET from backend/.env
#   - Test address: 0x4c66718579270e0f44e7ab4d70d2b5ce69368ca8 (Ethereum format)
#   - No errors in backend logs after testing
#   - Backend compiles and runs without TypeScript errors
#   - All endpoints return correct HTTP status codes and error messages
#   - SSE implementation follows W3C EventSource specification
# ============================================================================

