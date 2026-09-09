# 2026-09-09 (fork, pod dbe1c2d6) SETTLEMENT HARDENING — VERIFIED (jest 57/57 webhookProcessor; full suite 667 pass; tsc 0; backend healthy).
#   Resumed the paused hardening task. The 4 reliability fixes were in place (uncommitted): (1) clear processed-tx Redis
#   lock on settlement failure so BullMQ retries fire; (2) crash-recovery now records failure + re-throws instead of faking
#   a "recovered" success when settlement did NOT move funds; (3) dedup bypass for explicit recovery sources; (4) DLQ alert
#   email rate-limiting. Modified (uncommitted): services/webhookProcessor.ts, paymentReliability.ts, webhookQueue.ts,
#   controller/payment/settlement/settleTransaction.ts (+ chainVerification.ts, reconciliation.ts, apis/tatumApi.ts).
#   REGRESSION FOUND + FIXED: __tests__/webhookProcessor.test.ts still asserted the OLD "falls back to direct webhook when
#   recovery cryptoVerification fails" (faked payment.confirmed/recovered:true, status 'recovered') — the exact fake-success
#   behaviour fix #2 removed. Rewrote that test to assert the correct new behaviour: processWebhookJob REJECTS, NO faked
#   confirmed webhook, Redis row → status 'failed', failed-payment-<txId> marker written, processed-tx-<txId> deleted. Now 57/57.
#   TESTING NOTE: did NOT run testing_agent — this pod is the LIVE PRODUCTION DB (SAFE MODE); a settlement/webhook test could
#   mutate real merchant rows or trigger real payouts. Verified via the mocked jest suite instead (dedup bug already had
#   246/246; webhookProcessor now 57/57; whole suite 667 pass — the 4 remaining failures are pre-existing env-only suites
#   [ledgerPaymentMapper/paymentWalletFlows/authFlows] that need a live DB/server: proven to fail identically on the committed
#   baseline via git stash). tsc --noEmit = 0. Backend restarted → /health healthy, database+redis connected.
#   ACTION NEEDED: use "Save to Github" so DigitalOcean auto-deploys — all settlement fixes + this test fix are preview-only until then.
#

# 2026-09-09 (fork, pod dbe1c2d6) FOLLOW-UP: NOTIFICATIONS → "Transaction Details" showed Pending/"Awaiting payment" for the settled LTC — FIXED + VERIFIED (screenshot + curl).
#   The drawer in the user's screenshot ("Transaction ID 1000", blank currency/amount) was the NOTIFICATIONS page, not the
#   transactions list: NotificationPage.handleNotificationClick built the modal from `notif.meta`, but the API returns the
#   payload as `notif.data` → every field undefined → id fell back to notification_id (1000), status "pending", awaiting banner.
#   FIX (frontend Components/Page/Notification/NotificationPage.tsx): read `notif.data`, then fetch the REAL ledger row via
#     GET /api/wallet/transaction/<txHash>?company_id= (new API_ENDPOINTS.transactions.detail) and map it (status/amount/USD/
#     fees/confirmations/hashes/settled-to). Fallback (no ledger row): build from payload; payment_received/transaction_confirmed
#     → "settled" (never "awaiting payment"). Shared normalizeTxStatus mirrors the /transactions list buckets.
#   FIX (backend controller/wallet/transactionsDetail.ts getTransactionDetails): also match ut.incoming_tx_hash / ut.transaction_reference
#     = :id_str (ORDER BY createdAt DESC LIMIT 1); id_num only when the param is all digits (parseInt("388e7809-…")=388 previously
#     returned the WRONG row for UUID lookups). NOTE: backend runs plain ts-node (no hot reload) → `sudo supervisorctl restart backend`.
#   VERIFIED: curl by hash/numeric/uuid → correct row, unknown → 404; Playwright: /notifications → click item 1000 → Settled,
#     1.84 LTC, $97.53, fee $1.95, 6/6, both hashes, no awaiting banner. FE+BE tsc clean. Needs deploy (Save to Github).
#


# 2026-09-09 (fork, pod dbe1c2d6) RECONCILIATION DEDUP BUG (LTC payment-link settlement) — FIXED + VERIFIED (jest 246/246, tsc 0).
#   Pod set up via `bash scripts/pod-bootstrap.sh --pass '<vault pass>'` (SAFE MODE, prod DB, bg jobs off).
#   BUG: services/webhookProcessor.ts processWebhookJob dedup-bypass read `payload.source` (always undefined) instead of
#     the job wrapper `data.source` → every reconciliation re-queue hit "Transaction already processed, skipping" while the
#     10-min `processed-tx-<txId>` (settlement_in_progress) key from the failed attempt was alive. Prod logs (DO app dynopay,
#     read via DO API) show LTC 1.84 tx e861cff… (payment link 363, payment cd3a3644…) skipped at 00:43 + 00:50, then
#     PERMANENTLY FAILED at 01:10 (retryCount=3), then Strategy 4 reset → settled 01:20 (out tx 0b35efa4…, DB row 388e7809
#     successful, link 363 successful). The underlying Tatum 400 ("decimal places not more than 8") was fixed in commit af10a42.
#   FIX: `if (data.source !== 'reconciliation')` (webhookProcessor.ts ~L344). Also `failed-payment-*` key now stores
#     currency + company_id so Strategy 2 re-queues carry `asset` (prod log showed asset=undefined → asset validation skipped).
#   TESTS: __tests__/webhookProcessor.test.ts +3 (reconciliation bypass/clears key/re-settles LTC link; webhook source still
#     deduped; reconciliation never double-settles a successful payment). Mock __tests__/__mocks__/redisInstance.ts +deleteRedisItem.
#     Regression test proven to FAIL on old code. Safety guards kept for all chains: tatum-webhook lock, payment-settlement-lock,
#     isAlreadySuccessful, DB dup check (customerTransactionModel), Strategy 4 DB idempotency + on-chain verify.
#   NOT CHANGED (observations): `watchdog-recovery` source still honours dedup (admin-replay clears key itself);
#     apis/tatumApi.ts ~L2178 "#####LTC Payload" logs privateKey at info level (security hygiene follow-up).
#   DEPLOY: must push to GitHub (branch conflict_2808 auto-deploys on DO) — preview fix is not live in prod until then.
#


# 2026-06 (fork, pod a99b939f) HEALTH CHECK: SUPPORT CHAT + EMAIL — VERIFIED WORKING (no code change).
#   Ran real E2E via curl on the preview. (1) Visitor AI chat POST /api/support/chat (session qa-health-*, model
#   gpt-5.4 via OPENAI_API_KEY) → mode:ai, 773-char accurate reply (15 assets + fee tiers); GET /chat/history returns
#   both turns. (2) Admin inbox: adminAuth login → GET /admin/support/sessions/:id shows the session; POST .../reply →
#   "Reply sent."; POST .../email {to,subject,message} → "Email queued (suppressed in this environment)" disabled_in_preview:true
#   (Brevo path wired; suppressed only because .env DISABLE_OUTBOUND_EMAIL=true — sends for real in prod). Cleaned up:
#   hard-deleted the qa-health test session + its 4 tbl_support_chat_message rows from the LIVE DB (session-id scoped).
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP 7: OVERVIEW PERIOD FILTER + FEE-REVENUE CHART — DONE + VERIFIED (curl 3 periods + screenshots; BE+FE tsc 0).
#   User asked for a date filter + a platform-fee-revenue-over-time chart on the admin Overview.
#   BACKEND (adminController.getAdminAnalytics): now returns feeRevenueSeries [{bucket, fee_usd, volume_usd}] +
#     bucketUnit. bucketUnit = 'day' when periodType='MONTH' else 'month'. fee_usd per bucket = SUM(transaction_fee *
#     usd_value / NULLIF(base_amount,0)) over settled txns (per-row settlement rate, currency-agnostic). Also made
#     totalTransactionsIncoming PERIOD-AWARE (raw count over settledWhere) so the Incoming KPI moves with the filter
#     (was a global model count). Removed now-unused userTransactionModel import. paymentSuccessRates already used `where`.
#   FRONTEND (Overview/index.tsx): period state all|year|month → POST body {} | {periodType:'YEAR'} | {periodType:'MONTH'}
#     (backend defaults year/month to current). Filter chips top-right (testid overview-period-all/-year/-month). New full-
#     width "Platform fee revenue" SectionCard (testid section-fee-revenue) = recharts BarChart of feeSeries (warning-color
#     bars, USD YAxis, USD tooltip), header shows self-consistent series total (derived.feeTotal, testid fee-revenue-total).
#     Labels: 'MMM YY' monthly / 'MMM D' daily. NOTE chart total (per-row) can differ from the KPI "$X in platform fees"
#     (per-currency blended rate) by a few cents — both legitimate; chart total matches its own bars on purpose.
#   VERIFIED: curl — All time/This year = 6 monthly pts, fee $870.58, incoming 454; This month = 7 daily pts (Sep),
#     fee $41.50, incoming 20. Screenshots — filter recomputes Volume $29,787→$1,389.61, Paid-to-merchants
#     $28,917→$1,348.17, Success 50.7%→18.5%, chart monthly↔daily. "Payments created · last 30 days" intentionally stays 30d.
#   FILES: backend/controller/adminController.ts, Components/Page/Admin/Overview/index.tsx.
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP 6: ADMIN NUMBER ROUNDING (end-to-end) — DONE + VERIFIED (screenshots; FE tsc 0).
#   User: crypto amounts across the admin dashboard had inconsistent/long decimals ("several 0000"), wanted uniform
#   rounding. Added formatCrypto() in Components/Page/Admin/adminUi.tsx — magnitude-aware: abs>=1000 → 2dp,
#   >=1 → 4dp, <1 → up to 8dp (trailing zeros trimmed via toLocaleString, drops JS float artifacts). Applied it to:
#   • MerchantDrawer payout-wallet amounts (was flat maximumFractionDigits:6).
#   • Transactions/index.tsx Amount (base_amount, customer+platform tabs) AND Crypto (crypto_amount) columns — the
#     Amount col previously used formatNumber (3dp default) so tiny crypto rendered as "0 BTC"/"0.001 BTC"; Crypto col
#     rendered the RAW float. Now both use formatCrypto (e.g. 0.00059946 BTC, 156 USDT-TRC20). Removed unused formatNumber import there.
#   • Overview "Volume by currency" Amount column. USD everywhere already 2dp via formatUSD (unchanged). Counts keep formatNumber.
#   Verified via screenshots: drawer (9,380.85 / 191.1956 / 0.20518809), transactions table (no more "0 BTC", no float tails).
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP 5: ADMIN DASHBOARD DATA-CORRECTNESS (fees $0 / payouts / wallet count) — DONE + VERIFIED.
#   User (viewing onarrival21@gmail.com / John Davis) flagged: dashboard "payout $0, fee $0"; merchant drawer
#   "Payout wallets (65)" (expected 13) with wrong-looking amounts. RCA via backend/scripts/ro_query.js (READ-ONLY):
#   • PLATFORM FEES $0 = BUG: getAdminAnalytics summed blockchain_fee from tbl_user_temp_address which has 0 ROWS.
#     Real fee lives in tbl_user_transaction.transaction_fee (base_currency units). FIX (adminController.getAdminAnalytics):
#     totalFee now = sum(transaction_fee) from settled tbl_user_transaction grouped by base_currency; fee→USD uses the
#     EFFECTIVE SETTLEMENT RATE feeInUsd = feeAmount * (usd_value_sum / base_amount_sum) (not convertToFiat at today's
#     rate — removed that import usage). Verified: platform fees now $870.16 (BTC $422.89, USDT-TRC20 $257.88, ETH $96.12,
#     LTC $59.88, USDT-ERC20 $30.72, TRX $1.37, DOGE $1.30) on $29,787.27 volume.
#   • PAYOUTS $0: KPI counted tbl_user_self_transaction which is EMPTY (non-custodial → no internal withdrawals). Per user
#     choice 2a, relabelled the card to "Paid to merchants" = USD forwarded net of fees = totalRevenueUsd − totalFeesUsd
#     (computed in Overview/index.tsx derived.paidToMerchants). Now shows $28,917.11 · "Forwarded (net of fees)". testid
#     kept kpi-payouts. (totalTransactionOutgoing still returned by API, just no longer drives the card.)
#   • PAYOUT WALLETS (65): tbl_user_wallet user_id=1 = 39 legacy account-level rows (company_id NULL: 13 coins × 3 empty
#     dupes) + 13 (company 1 The Dev Store) + 13 (company 71 SMADAV). Also `amount` is NOT an on-chain balance — it's
#     incremented by helper/walletHelpers.incrementUserWallet at each settlement = LIFETIME crypto forwarded (USDT-TRC20
#     amount 9380.85 == lifetime settled USD). Per user choice 3a, MerchantDrawer payout section now GROUPS BY BRAND
#     (hides company_id NULL rows unless a merchant has none), header "<Brand> — N wallets · M funded" (testid
#     merchant-wallet-group-<cid>), rows show "<amount> <COIN>" + a caption "Amounts are the lifetime crypto received
#     (forwarded) per address — not a spendable balance." Verified: groups The Dev Store(13·7) + SMADAV(13·2), 39 legacy hidden.
#   FILES: backend/controller/adminController.ts (getAdminAnalytics), Components/Page/Admin/Overview/index.tsx,
#     Components/Page/Admin/Merchants/MerchantDrawer.tsx. tsc BE+FE = 0. Verified: curl (analytics+user/1) + screenshots.
#     No DB writes (all read-only analytics/display). No testing_agent (avoids UI ban/suspend on LIVE prod DB).
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP 4: SUPPORT INBOX UX BATCH (4 items) — DONE + VERIFIED (screenshots; tsc 0).
#   All FRONTEND-only, no backend/DB writes (LIVE prod DB untouched). User asks addressed:
#   1) "To" FIELD VISIBLE: email dialog DialogContent pt:1 (8px) clipped the first outlined field's floating "To"
#      label at the scroll-container top edge. Fix = pt:2.5 + fullWidth on To/Subject/Message (ConversationPanel.tsx).
#   2) ONE-CLICK COPY: copy IconButton next to the resolved visitor email in the conversation header
#      (testid support-copy-email); navigator.clipboard w/ execCommand fallback; icon flips to check + "Copied!"
#      tooltip for 1.6s. Header email now sourced from derived `contactEmail` (resolved_email||contact_email).
#   3) EMAIL REPLY TEMPLATES: NEW Components/Page/Admin/SupportInbox/emailTemplates.ts — 3 built-ins
#      (Follow-up / No deposit detected / KYC in review, each with subject+body) + agent-saved templates persisted
#      PER-BROWSER in localStorage key `dynopay_admin_email_templates` (id prefixed user-*). In the Email dialog:
#      TEMPLATES chip row (click = fill subject+body), "Save current" -> inline name field -> saveEmailTemplate;
#      user chips get a ✕ (deleteEmailTemplate); built-ins are not deletable. testids support-email-template-<id>,
#      -save-open, -name, -save. NOTE chose localStorage over a DB table to avoid a prod migration (user said
#      "continue" w/o picking a/b) — can move to a shared DB table later if cross-device/agent sync is wanted.
#   4) BRAND DRILL-IN: brand rows in MerchantDrawer are now clickable (primary-color name + chevron, hover) ->
#      router.push(/admin/transactions?brand=<company_name>) + closes drawer. Transactions/index.tsx reads
#      router.query.brand (on router.isReady) -> sets search q + tab 0 + shows a removable "Brand: <name>" chip
#      (testid transactions-brand-filter; onDelete = clearBrand -> shallow replace to /admin/transactions).
#   VERIFIED via Playwright screenshots (admin moxxcompany@gmail.com): To label fully visible; copy btn present;
#      template apply filled 461-char body + subject; "My QA Template" saved+listed w/ delete ✕; brand drill-in on
#      John Davis/The Dev Store -> transactions filtered to that brand (Brand chip + prefilled search). tsc --noEmit 0.
#      (Self-tested only — no testing_agent, to avoid a UI ban/suspend on the LIVE prod DB.)
#      Files: ConversationPanel.tsx, emailTemplates.ts (NEW), Merchants/MerchantDrawer.tsx, Transactions/index.tsx.
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP 3: SUPPORT INBOX — SHOW VISITOR EMAIL — DONE + VERIFIED (curl + screenshot).
#   User: admin couldn't see the visitor's email (esp. logged-in in-app chats) to email them.
#   FIX (supportInboxController): new resolveContact() picks the best email — provided contact_email >
#   logged-in ACCOUNT email (via MAX(message.user_id) -> tbl_user.email/name) > email TYPED IN CHAT
#   (POSIX substring extraction). listSessions now returns resolved_email/user_name/email_source (bulk user
#   lookup + chat_email subquery); getSession returns the same on the session object; emailReply falls back to
#   the resolved email as the 'to'; session search also matches account email. Frontend: SessionList + Conversation
#   header show resolved_email (was contact_email only); header shows a "Signed in · <name>" / "Email from chat"
#   source chip (testids support-contact/support-email-source-account/-chat); Email dialog prefills resolved email.
#   Verified: session 828fa8b3 (uid 17, no contact_email) -> tajikzadeh@gmail.com "mohammad mahdi Tajikzadeh"
#   source=account; list shows account emails for logged-in sessions. tsc 0.
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP 2: MERCHANT DRAWER REVAMP — DONE + VERIFIED (curl + screenshot).
#   User feedback on the Merchants detail drawer: fee-free is deprecated; account "Creator handle" (@hostbay) was
#   wrong/misleading; brands + payout were missing; several fields blank.
#   FIX: backend getUserDetail (adminController) now also returns `companies` (tbl_company brands), `wallets`
#   (tbl_user_wallet payout destinations + on-chain balances), `settled_usd` + `settled_count` (usd_value of
#   successful/completed/settled txns). Frontend MerchantDrawer redesigned into FINANCIALS (Lifetime volume,
#   Settled received $+count, Transactions, Fee tier), IDENTITY (login/mobile/country/language/last-login-IP/
#   referral code/joined), BRANDS (name · type · country · @handle per brand — brand handle, NOT the account
#   handle), PAYOUT WALLETS (N configured, funded list with balances). Removed Fee-free remaining + account-level
#   Creator handle rows. Merchant iface: dropped fee_free_remaining_usd, added companies/wallets/settled_*/
#   merchant_country_code. Verified on user 1 (onarrival21/John Davis): brands The Dev Store(@devhub)+SMADAV(EE),
#   9/65 wallets funded, settled $29,787.27·454. Mobile/Country "—" = genuinely null in DB (not a bug). tsc 0.
#

# 2026-06 (fork, pod a99b939f) FOLLOW-UP: ADMIN "TOTAL VOLUME" CORRECTNESS FIX — DONE + VERIFIED.
#   User flagged Overview volume $185,979 was wrong (DB only has SUCCESSFUL txns for onarrival21 brands).
#   ROOT CAUSE: getAdminAnalytics summed base_amount across ALL statuses (incl. 438 PENDING/unpaid intents,
#   ~140k raw USDT-TRC20 from other merchants e.g. Donut Loot) and re-converted at TODAY'S rate.
#   FIX (adminController.getAdminAnalytics): revenue_performance + totalTransactionsIncoming now filter to
#   SETTLED_STATUSES = ('successful','completed','settled'); volume uses the stored usd_value (captured at
#   settlement) instead of re-converting base_amount. Result: Total volume = $29,787.27 (The Dev Store $29,493
#   + SMADAV $112 + $182 completed), Incoming = 454 settled. Frontend KPI sub relabelled "Settled payments".
#   Verified via curl + screenshot. (Payment-outcomes donut/success-rate still show all attempts — intentional.)
#

# 2026-06 (fork, pod a99b939f): ADMIN READ-ONLY MONITORING SCREENS — DONE + VERIFIED (self-test; LIVE prod DB, SAFE MODE).
#   Built 3 admin dashboards replacing the obsolete fee/wallet/withdraw/transferSpeed pages (DELETED those 4 page files):
#     • /admin (Overview) — pages/admin/index.tsx -> Components/Page/Admin/Overview/index.tsx. POST /api/admin/getAdminAnalytics.
#       KPI cards (active merchants, incoming payments, payouts, total volume USD + platform fees, success rate),
#       recharts donut (payment outcomes) + 30-day area (payments created), Volume-by-currency table, Popular currencies bars.
#     • /admin/merchants — Components/Page/Admin/Merchants/{index,MerchantDrawer}.tsx. GET /api/admin/getAllUsers (137 rows).
#       Search + status chips (All/Active/Suspended/Banned) + client pagination + right Drawer detail (GET /admin/users/:id).
#       WRITE actions wired (user asked to include now): Suspend/Ban -> PUT /admin/users/:id/ban {action,reason};
#       Re-activate -> PUT .../ban {action:'activate'}; Unlock login -> POST /admin/users/unlock {email}. Confirm dialog + reason.
#     • /admin/transactions — Components/Page/Admin/Transactions/index.tsx. GET /api/admin/getAllTransactions.
#       Tabs Customer payments(584)/Platform(0), search, status chips, client pagination. READ-ONLY.
#     • Shared UI: Components/Page/Admin/adminUi.tsx (StatCard, SectionCard, AdminStatusChip, formatUSD/Number/Date).
#   ROOT-CAUSE BUG FIXED (axiosAdmin.ts): baseURL was RELATIVE "api/" (NEXT_PUBLIC_BASE_URL empty) -> on depth-2 admin routes
#     (/admin/merchants, /admin/support) it resolved to /admin/api/... = 404 (why merchants showed 0 rows). Now mirrors
#     axiosConfig.ts: baseURL = ("").replace(/\/+$/,'') + "/api/" = ABSOLUTE "/api/". Also fixes the Support Inbox routing.
#   Also fixed 4 pre-existing tsc errors in SupportInbox/index.tsx (action() Promise<boolean> vs Promise<void> props).
#   _app.tsx routeKeyMap: removed adminFee/adminWallet/adminWithdraw/adminTransferSpeed keys; added support/merchants/transactions.
#   VERIFIED: tsc --noEmit 0; all 3 screens screenshot-verified with REAL data (desktop 1920 + mobile 390); write endpoints
#     E2E via curl on a REVERSIBLE scratch merchant (backend/scripts/scratch_merchant.js create|delete): suspend->activate->ban,
#     invalid action 400, 404 unknown user, 403 no-auth, unlock ok — scratch row hard-deleted after. NO real merchant mutated.
#   Testing agent NOT used on purpose: LIVE prod DB — a UI ban/suspend test would mutate a real merchant. Admin login:
#     moxxcompany@gmail.com / Katiekendra123@ (POST /api/admin/login -> localStorage 'admin_token').
#

# 2026-09-07 (fork): QA-board fix batch complete — resolved all open tbl_qa_comment findings
# (#8 hydration/Cloudflare emails, #10 FR/DE CTA, #15/#16 hero routing, #28 cards, #33/#56 help padding,
# #35 back-scroll, #36 mobile menu [not reproducible], #47 fee breakdown+currency, #52 docs JSON) and added
# a new "awaiting_retest" QA status (#4). All 8 findings stamped "Awaiting retest" on /quality for physical
# re-verification. Testing agent 8/8 PASS. Details: memory/CHANGELOG.md top entry. NOT yet deployed to prod.
#

# INVESTIGATION 2026-09-06 (pod 1a75b74d): onboarding + zero-transactions RCA -> memory/reports/onboarding_investigation_2026-09-06.md
#   Tools: backend/scripts/ro_query.js (READ-ONLY SQL runner, prod), DO API token in backend/.env (DO_API_TOKEN, gitignored).
#   Headline: 112 signups Aug-Sep (49% of attributed = ChatGPT -> /for/fundraisers; IR/SO/ET/PK/PS...), individuals' hardship
#   fundraisers; funnel 112->92 company->61 wallet->39 link->15 checkout-opened->0 paid. Zero funds ever sent (0 inbound events /
#   journal rows) -> not a bug; attempts are merchant self-tests; ~70% single-session users. DO logs only cover active deployment
#   (~hourly redeploys). Concrete bug: company 139 "Donut Loot" webhook 308 redirect (donutloot.xyz -> www.), 158 failed deliveries,
#   sender uses maxRedirects:0 (SSRF guard). Data bug: last_login_ip stores full X-Forwarded-For chain.

# FIX 2026-09-06 (pod 1a75b74d): COMMIT BLOCKER — husky pre-commit R2 rule (new backend .ts > 500 lines blocks). pdfService.ts had grown
#   491 -> 528; extracted services/pdf/invoiceChrome.ts (palette/logo/header+PAID/provider/footer) -> pdfService.ts 429 lines.
#   `sh .husky/pre-commit` exit 0 verified by testing agent. RULE FOR FUTURE WORK: keep every NEW backend .ts file <= 500 lines
#   (backend/scripts/check-file-size.mjs; legacy files grandfathered in backend/scripts/file-size-baseline.json).

# STATUS 2026-09-06 (pod 1a75b74d, part 2): COIN LOGO ON PDF + SHAREABLE RECEIPT LINK + DE/NL FORMAL REGISTER — DONE, backend 10/10.
#   Shareable receipt: /receipt/<token> (pages/receipt/[token].tsx, SSR, labels pre-localized by the API) backed by NEW table
#   tbl_payment_receipt (migration 0021 APPLIED on prod) = immutable snapshot of the settlement figures, 22-char token, masked
#   buyer email, dedupe by on-chain hash. Endpoints: GET /api/pay/receipt/:token (+/pdf), POST /api/pay/receipt/link (customer auth).
#   Surfaced: customer confirmation email CTA "View receipt online", PDF footer link, checkout paid card "Copy receipt link".
#   PDF receipt: coin badge + "0.0031245 BTC · Bitcoin" + Network row (backend/utils/networkLabels.ts, renderCurrencyBadgePng).
#   Register: scripts/apply_register_sweep.py (18 DE + 83 NL strings -> Sie/u), lint-guarded. NL checkout "ontvangst"->"bon".
#   Test snapshot kept for the user to click: /receipt/GwVgV4tgx8YUD5BySU7QtY (remove: seed_test_receipt.ts --cleanup).
#   Frontend page + checkout button verified by screenshot only (no automated frontend test run yet — needs user OK).

# STATUS 2026-09-06 (pod 1a75b74d): EMAIL FOOTER LOCALIZATION + COPY DE-DUPE + PDF RECEIPT/INVOICE AUDIT — DONE, backend-tested 8/8.
#   The former "KNOWN FOLLOW-UP" is closed: dynoPayEmailTemplate forwards `lang` (7th param) -> footer chrome + <html lang> localized
#   at 57 localized call sites (scripts/apply_footer_lang_wiring.py); English code-embedded emails deliberately untouched.
#   De-dupe (scripts/apply_email_dedupe.py): greeting = common.*, sign-off = chrome.*, PDF labels = labels.*/chrome.*, dead
#   merchant.walletOtp removed, orderReceipt.preheader added (was a raw-key leak), DE/NL receipt register made formal.
#   PDF: receipt was 4-6 PAGES (pdfkit auto-pagination) -> always 1 page, dynamic rows, mono IDs, localized footer/payment method,
#   contact-merchant line; invoice: brand indigo + PAID pill + localized settled terms for v2 (fee already collected at settlement;
#   controller default payment_terms/description updated for new rows). Verify: scripts/verify_footer_lang.ts,
#   scripts/render_pdf_previews.ts (+pdf_to_png.py); previews in memory/email_previews_v3 + memory/pdf_previews/{before,after}.
#   NOT touched: frontend, Binance/conversion, money math in pdfService.ts. Items Transactions/PayLinks polish, checkout copy pulse,
#   confirmed check-mark were already shipped last session (verified in code).

# STATUS 2026-06 (pod dbd52123): DESIGN POLISH — DASHBOARD + CHECKOUT (light touch, both themes). User-approved
# scope: keep layout; refine spacing/type hierarchy/hover+focus; consistent indigo accent; status dot+text; de-clutter the
# dashboard top area; checkout amount + "Send exactly" as mono heroes; calmer flat surfaces (no orbs / tinted boxes);
# visible countdown bar in the status strip. Tested: test_reports/iteration_130.json (frontend, ~98%, no defects).
# DASHBOARD: pages/dashboard.tsx H1 = greeting ("Good evening, John"), description = today's date; page-level
#   "Create payment link" button RETIRED (header "+ New" is the ONE create control, now brand indigo — CreateNewButton.tsx);
#   ReferralRewardBanner removed from dashboard (referral lives in rail: Grow slot + Referral code card).
#   BalanceStrip: greeting eyebrow gone; metric dropdown moved to top-left; hero value 2 decimals (formatWithSeparators).
#   DeltaChip text-only; SurfaceCard/StatCard radius 16; PanelCard widgets get DASH_PANEL_SX/DASH_PANEL_HEADER_SX
#   (v2026/styled.tsx); RecentTransactionsWidget status = StatusDot dot+text, mono amounts, keyboard-focusable rows;
#   GrowPanel/ReferralCodeCard neutral surfaces + indigo accent (no pink/amber); 🎉 removed from growTrialCompleteTitle ×6 langs;
#   ActionsRow surface buttons w/ indigo hover+focus ring; AssetsCard bars solid; staggered dashRise entrance (reduced-motion safe).
# CHECKOUT: Pay3Layout orbs removed (flat #F4F5F9 / #0B0B0E); PanelShell flat 16px hairline card (no shadow) + rise-in;
#   CheckoutStatusStrip neutral surface, NEW totalSeconds prop → 3px countdown bar (checkout-strip-progress) + always-on
#   MM:SS timer (checkout-strip-timer; checkout-strip-countdown when ≤60s); breathing ring replaces aurora blob.
#   CleanCheckoutV2: "TOTAL YOU PAY" eyebrow + big mono total (clean-checkout-amount) with quiet breakdown rows; flat
#   reference row; uppercase labelSx overlines; "SEND EXACTLY / <big mono amount> / on <Network>" (clean-checkout-instruction,
#   clean-checkout-instruction-amount); QR panel hairline (no shadow); address/amount rows unfilled; softer amber warn;
#   timeline hideBar when strip shows the bar; MONO now IBM Plex Mono first (checkoutConstants.ts). ReceiptEmailField flat.
#   pages/pay/demo.tsx mirrored (landing showcase stays 1:1).
# Cleanup: test pay link 338 (5H7px8) created for screenshots was DELETED. Prod data otherwise untouched.
#
# STATUS 2026-06 (fork): 6 NEW /for/* VERTICALS NOW LOCALIZED ×5 (de/es/fr/nl/pt) — 30 i18n JSONs under
# data/seo-pages/verticals/i18n/<lang>/, SSR-verified (translated title/H1/<html lang>/canonical/hreflang, EN intact).
# 6 missing OG cards generated (public/og/vertical-<slug>.png). Breadcrumbs already live. Deploy via Save-to-GitHub.

# STATUS 2026-06 (pod 8b63f71b): SEO fixes SHIPPED to code — 3A audit + follow-ups A/B/C. See memory/CHANGELOG.md top entries + /app/plan/plan.md.
# A) 7 help articles authored + translated ×6 langs, server-rendered (fully localized title/body/canonical under ?lang=).
# B) /fees now has a visible FAQ + FAQPage & Service JSON-LD (translated ×6). /for/* already had FAQ/WebPage/Breadcrumb JSON-LD.
# C) MULTILINGUAL SSR (Option 3B) LIVE in code: ?lang=xx (en,pt,fr,es,de,nl) renders translated HTML with <html lang>, self-canonical + hreflang; per-request cloned i18n instance (no cross-request bleed); client hydrates same locale (no mismatch). Header switcher updates ?lang= in URL. Public marketing pages carry s-maxage=300 caching.
#   Localizable (canonical/hreflang) set = / , /fees , /help-support(+articles), AND /for/* (all 15 verticals, fully translated ×6).
#   /for/[vertical] is now SSR (getServerSideProps, was SSG) so ?lang= renders server-side; CDN-cached via _app s-maxage=300. blog stays English-only.
#   Help-support INDEX now server-renders 8 crawlable <a href> article links (seeded static, localized) — no longer JS-only.
# Deploy: next Save-to-GitHub → DigitalOcean. Post-deploy: resubmit sitemap.xml + request indexing in Search Console.
# Backlog: optional per-locale translation of country pages (route not built yet); seed KB DB to auto-upgrade help articles to editable DB content.



# DynoPay — Product Requirements (living doc)

> **Product:** DynoPay is a multi-tenant crypto payment gateway. Merchants accept
> crypto and get paid their way (keep the coin or auto-convert), with these
> integration surfaces: **Hosted Checkout**, **Payment Links** (branded short link
> `dynopay.com/<ref>`), **Buy Button** (`<dynopay-buy-button>` snippet), **Direct API**,
> **Embedded Checkout (iframe)**, **Elements (inline widget)**, and **Webhooks**.
> One account can run multiple businesses/**brands** (scoped by `company_id`).
>
> **Stack:** Next.js (Pages Router, app at `/app` ROOT — `/app/frontend` is unused) +
> Node/TS backend (proxied on :8001 via `server.py`) + PostgreSQL (Railway) + Redis.
>
> **This dev pod is connected to the LIVE production DB in SAFE MODE** (background jobs
> OFF, `WORKER_ROLE=secondary`, `DISABLE_OUTBOUND_EMAIL=true`, Redis isolated to `/1`).
> Prefer read-only / reversible writes. Owner test account: onarrival21@gmail.com
> (see `memory/test_credentials.md`).
>
> **History:** Full changelog lives in `memory/CHANGELOG.md`; backlog in
> `memory/ROADMAP.md`. Older PRD entries were trimmed (2026-09-01) to keep this file
> git-committable (<500KB) — recover via `git log --follow memory/PRD.md`. Keep entries
> concise going forward.

---

## Recent sessions (most recent first)

<!-- 2026-06 (fork, pod bc2629eb): SEO — COMPETITOR "ALTERNATIVE" PAGES — DONE + VERIFIED (testing_agent iteration_129, 100%).
     Context: user wants dynopay.com to rank for "crypto payment gateway"/"accept crypto" and to beat competitors
     coinpayments.net + coingate.com. Diagnosis: on-page/technical SEO is already strong (title/meta/canonical/OG,
     dynamic sitemap.xml, robots.txt, Organization+WebSite+SearchAction+SoftwareApplication JSON-LD in _app.tsx,
     FAQPage JSON-LD in Home/v3/FAQCompact.tsx, /for/[vertical] industry pages, blog). Real gap = OFF-PAGE authority
     (backlinks/listicles/site age) + missing competitor comparison pages. Built the latter in-repo.
     WHAT SHIPPED (this repo = the Next.js Pages-Router site for dynopay.com):
       • New programmatic-SEO kind "comparison" in utils/seoContent.ts (getComparisonContent/getAllComparisonSlugs,
         COMPARISONS_DIR; getAllSEOPagesIndex now emits /compare/{slug} → auto in sitemap).
       • data/seo-pages/comparisons/coingate.json + coinpayments.json — HAND-AUTHORED, honest/defensible comparison
         copy (positions Dynopay on non-custodial + auto-convert + product breadth + first-payment-free; does NOT
         falsely claim lower fees — both competitors are cheaper flat-fee at low volume, stated honestly for E-E-A-T).
       • pages/compare/[slug].tsx (getServerSideProps, 404 for unknown slugs) reusing Components/Page/SEO/SEOLandingPage.tsx
         (emits WebPage+FAQPage+BreadcrumbList JSON-LD, nav, hero, features, how-it-works, FAQ, related /for/* links,
         CTA → /auth/register?src=seo&page={slug}&kind=comparison).
       • SEOIllustration.tsx: widened `kind` union to include "comparison" (renders gradient monogram).
       • public/robots.txt: Allow /compare/. public/og/comparison-{coingate,coinpayments}.png (1200x630, generated).
       • ROOT-CAUSE FIX (was rendering blank): pages/_app.tsx layout resolver (~L292) did not treat /compare/* as a
         public "home" layout route → fell into app/auth shell → blank. Added pathname.startsWith('/compare/').
     VERIFIED: tsc --noEmit=0, file-size gate=0, both pages HTTP 200 + in sitemap, testing_agent iteration_129 100%
       (full client render, FAQ accordions expand, JSON-LD present, NO console errors, NO regression on / /fees /for/ecommerce).
       Added data-testid seo-faq-{i}/seo-faq-answer-{i} on FAQ accordions per review note.
     NOTE: URLs live at /compare/coingate and /compare/coinpayments (dynopay.com will serve on next deploy).
     NEXT SEO (not built): dedicated /crypto-payment-gateway head-term page; more comparison pages (BitPay/NOWPayments/
       Coinbase Commerce); long-tail blog hub ("how to accept crypto payments", per-coin, per-industry); OFF-PAGE
       authority = the real lever (get into "best crypto payment gateway 2026" listicles, G2/Capterra, WooCommerce/
       Shopify plugins, Product Hunt, crypto PR, reviews). GSC already set up by user. -->


<!-- 2026-06 (fork, pod bc2629eb): EMAIL CONTENT AUDIT — PART 2 (rewrites APPLIED) — DONE + VERIFIED.
     Scope applied per user choices: 1a KYC=ID+selfie (no proof-of-address), 2a subject house-style on ALL ~70,
     3a strip emoji from transactional/security/receipts (keep in referral/marketing), 4b EN + all 5 langs same pass.
     SAFE MODE intact (no email sent). tsc --noEmit = clean; all 6 locale JSON valid; live-render verified EN+DE.
     WHAT CHANGED:
       • CORRECTNESS: A1 KYC threshold now sourced from KYC_THRESHOLD_USD ($10,000) — kycEmails.ts imports it,
         subject/intro2 use {{threshold}} placeholder so the fix propagates to all 6 langs for free.
         A3 adminOpsEmails.sendAdminFeeReceivedEmail TDZ crash fixed (feeFmt/merchantFmt/totalFmt declared before subject).
         A2 subscriptionPaymentFailed now crypto-native (custSteps = pay-link/wallet-balance/contact-merchant; custCta
         "Complete payment"); subscriptionCreated.custOutro = "secure link to pay in crypto each cycle" (no auto-charge/cards).
         A4 kycRequired + kycStarted need-lists = "government photo ID / quick selfie for liveness / ~5 min" (no proof-of-address).
       • PREHEADERS: dynoPayEmailTemplate + dynoPayGreetingTemplate extended with a preheader param (emailShared.ts);
         41 locale-driven call sites wired + 47 preheader keys added in all 6 langs (scripts/apply_part2_wiring.py).
         Code-embedded emails (wallet OTP/security, creator handle, team, referral x8, order x6, webhook) got inline preheaders.
       • SUBJECTS: house-style applied to all subject-ish keys in all 6 langs (strip " - Dynopay" suffix, " - "→" – " en-dash)
         via scripts/apply_part2_locales.py; 4 reworded for clarity (paymentPending, paymentConfirming,
         customerPaymentConfirmation, kycRequired) with explicit 5-lang translations. Order/admin subjects fixed in code.
       • GREETING: inline "Hi"→"Hey" unified (wallet, creator, team, wallet-security). Emoji stripped from welcome.promo.
       • payoutDigest: baseEmailTemplate call now also passes `lang` (chrome localized) + preheaderActive/Quiet.
     SCRIPTS (persistent, re-runnable): backend/scripts/apply_part2_wiring.py, apply_part2_locales.py,
       verify_part2_render.ts (live EN+DE render + assertions → memory/email_previews_v2/).
     KNOWN FOLLOW-UP (P1, NOT done — pre-existing, out of approved Part-2 list): dynoPayEmailTemplate does NOT forward
       `lang` to baseEmailTemplate, so the shared sign-off/footer chrome ("Best regards, / The Dynopay Team", tagline, links)
       renders in ENGLISH even on non-English emails (body/subject/preheader ARE localized). Fix = add `lang` param to
       dynoPayEmailTemplate + append lang at ~40 call sites (mechanical, same pattern as apply_part2_wiring.py). Deferred to
       avoid churn/risk at handoff. Also P2: de-dupe redundant keys (common.* == chrome.*, receipt.* == labels.*, two walletOtp).
     Future: PDF receipt/invoice content audit. -->


<!-- 2026-06 (fork, pod bc2629eb): EMAIL CONTENT AUDIT — PART 1 (analysis only) — DONE, AWAITING USER APPROVAL.
     SAFE MODE intact (no source copy changed, no email sent). Scope per user: ALL ~70 templates — locales/en/emails.json
     (625 strings/25 sections) + 17 services/email/* code builders. Ranked by impact × frequency. Previews EN + DE.
     DELIVERABLES:
       • memory/email_audit.md — full audit vs 4 criteria (clarity/details/conciseness/premium) + Top-15 priority list.
       • memory/email_style_guide.md — one-page house style (voice, subject, preheader, greeting, CTA, emoji, i18n).
       • memory/email_previews/index.html — before/after gallery for Top 15 (EN) + 3 DE chrome-sanity renders,
         generated by backend/scripts/email_audit_preview.ts (regen: ts-node --transpile-only scripts/email_audit_preview.ts).
     KEY FINDINGS (fix in PART 2 after approval):
       P0 correctness: (A1) KYC email quotes $5,000 threshold — enforcement is $10,000 (helper/kycEnforcement KYC_THRESHOLD_USD;
         kycEmails.ts L25 hardcodes '5,000'). (A2) subscriptionPaymentFailed uses card/bank language ("update payment method",
         "contact your bank") on a crypto product — must be crypto-native. (A3) adminOpsEmails.sendAdminFeeReceivedEmail is a
         RUNTIME CRASH — `feeFmt` used in subject L120 before its `const` declaration L131 (TDZ) → admin fee email never sends.
         (A4) KYC doc reqs inconsistent between kycRequired vs kycStarted + likely inaccurate for Veriff (verify w/ product).
       P1: (B) NO preheader on ANY production email (template supports it; 0 builders pass it) = biggest premium win, all ~70.
         (C) inconsistent greeting Hey vs Hi, subject punctuation ` - ` vs ` — ` vs none, stray emoji, mixed CTA casing.
         (D) payment emails miss fiat value / net-after-fee / show 5-coin ETA table regardless of coin paid.
       P2: (E) duplicate strings (common.* == chrome.*, receipt.* == labels.*, two `walletOtp` blocks) — de-dupe in Part 2.
     PART 2 (NOT started, needs approval): apply EN rewrites+preheaders, fix A1–A5, de-dupe, enforce style guide, re-render,
       then translate changed strings to de/es/fr/nl/pt. Future: PDF receipt/invoice content audit. -->


<!-- 2026-09-03 (fork, pod ca6c51ad) PART 2: CORS ALERT NOISE + MOBILE HEADER BRAND NAME + COLUMN SORTING + SITEMAP AUDIT — DONE + VERIFIED
     (testing_agent iteration_123: backend 12/12, frontend 100%, 0 issues; regression suite backend/tests/test_iter123_cors_sitemap.py)
     - PROD BUG: HIGH-severity email "CORS: Origin https://dynopay.me/api/rsc not allowed" — a bot POST /api/rsc with a malformed
       Origin (path in it) fell through the cors callback into the global error handler → captureError(high) + 500. Fix: typed
       CorsOriginError (statusCode 403) in backend/server.ts; global handler answers 403 {message:'Origin not allowed'} and skips
       captureError (WARN log 'CORS blocked origin' remains). NOTE for user: if dynopay.me actually serves pages that call the API,
       add it to prod CORS_ALLOWED_ORIGINS / CORS_TRUSTED_DOMAINS (a REAL browser Origin would be https://dynopay.me with no path).
     - BUG: business name in the mobile header pill truncated to "T." (5 x 44px controls on the right ate the width). Fix at <600px:
       briefcase icon + company-selector chevron + user-menu chevron hidden, standalone theme toggle hidden (lives in user menu
       user-menu-theme-toggle; still shown 600-1199px), search/bell/+New/hamburger 40px wide (44 tall), tighter gaps; name
       flex-shrinks with ellipsis (data-testid=company-selector-name). Full "The Dev Store" at 390/375, ellipsis at 360/320.
     - FEATURE: /transactions column sorting (desktop headers Amount / USD Value / Date & Time; testids tx-sort-<key>, aria-sort,
       data-sort-dir). First click desc, second asc; default Date desc; page resets to 1. ExtendedTransaction gained
       cryptoAmountRaw + createdAtTs (also filled in NotificationPage's synthetic tx).
     - SITEMAP AUDIT: pages/sitemap.xml.tsx adds /how-to, /help-support, published KB articles (/api/kb/articles, 0 today),
       public creator pages /{handle} (new `creators` array in GET /api/shop-sitemap: creator_page_enabled=true); static pages no
       longer emit a fabricated <lastmod> (blog/products/articles keep real dates). robots.txt: help-support now ALLOWED
       (public docs), added Disallow for /payment/, /order/, /pay/*-demo, /qa, /QA, /kyc/, /wallet-security, /unsubscribe, /payouts.
       64 URLs, XML well-formed, all spot-checked 200. GOTCHA: /api/shop/*, /api/pay/creator/* share paymentRateLimiter
       (30/min/IP) → probing many SSR pages in parallel yields false 429→404s; probe serially. -->

<!-- 2026-09-03 (fork, pod ca6c51ad): TRANSACTIONS TABLE — STATUS CHIPS + SCOPED EXPORT + STICKY HEADER — DONE + VERIFIED
     (testing_agent iteration_122: frontend 10/10, backend 10/11 → the 1 miss (export ignored the crypto/amount part of
     `search`) fixed + curl-verified: search=LTC → 68 rows == grid). Closes REFACTOR_STATUS item #7 (P3).
     - New toolbar strip INSIDE the table card above the column headers (Components/Page/Transactions/TransactionsToolbar.tsx):
       status chips w/ live counts (All · Settled · Confirmed · Processing · Pending · Awaiting · Unpaid · Failed; zero-count
       chips hidden) on the left, Export (+ "Settled only") on the right. Export/Settled-only REMOVED from the top bar
       (top bar keeps source chips, search, date, wallet). Chip → ?status= URL sync; /transactions?status=pending|unpaid deep
       links now work (dashboard tile already linked there). Export label "Export <n>" when a chip is active, disabled at 0.
     - Export honours EVERY active filter: backend POST /api/wallet/transactions/export now accepts status (UI bucket),
       source, wallet, search (id/hash/currency/amount parity), whole-day date range, company_id (RBAC parity via
       validateCompanyOwnership); status chip supersedes settled_only; settled_only == settled bucket.
       Shared bucket helpers in backend/utils/transactionDisplayStatus.ts (TX_STATUS_BUCKETS, toTxStatusBucket, rawStatusesForBucket).
     - Sticky header genuinely sticks on desktop (card is flex 0 1 auto → inner box scrolls); header composited opaque
       (primary.light is rgba). Amount / USD Value / VAT-Tax right-aligned with tabular numerals.
     - i18n keys added to all 6 locales (statusAll, awaitingShort, settledOnly, exportScoped*, statusFilterLabel).
     - Backend regression suite from testing agent: backend/tests/test_transactions_export.py (read-only, live DB). -->

<!-- 2026-06 (fork, pod 55c5e4b0): DEEP AUDIT — BUGS / SECURITY / PERF / CLEANUP — DONE + VERIFIED
     (testing_agent iteration_119: backend 18/18 pass; frontend dashboard renders, kyc/status 3x -> 1x confirmed via
     Playwright network capture after follow-up fix; BE tsc 0, FE tsc 0, eslint 0, jest redisInstance 42/42 +
     webhookHandlers 26/26). Full ranked findings + "found but not changed" list: memory/AUDIT_2026-06.md.
  P0 security: helper/otpGuard.ts (crypto.randomInt codes; 5-strike lockout via recordOtpFailure) wired into
     passwordReset, registrationEmail (passwordless login!), contactEmail, profileSecurity, onboarding, authLogin;
     12 Math.random OTP sites replaced. utils/outboundUrlGuard.ts SSRF guard (private/metadata/DNS-resolved) in
     webhooks/index.ts (+maxRedirects:0) and PUT /company/webhook-settings. withdrawals.ts no longer logs OTPs.
  P1 reliability: redisInstance cleanupStaleLocks was deleting PEER instances' cron locks (PID check on wrong host) ->
     lock value now host:pid:ts, same-host-only cleanup, SCAN not KEYS. rateLimitMiddleware rewritten as atomic Lua
     sliding window with TTL (old keys were permanent + racy), API keys hashed in key names. pending-notif markers
     30d TTL (customer-* sessions intentionally NOT expired — they ARE the payment-link store). server.ts: JSON 404
     for /api/*, headersSent guard in error handler. currencyConvert: FastForex circuit breaker (subscription lapsed).
  P1 DB perf (boot migrations 0021/0022 in migrations/perfMigrations.ts, applied to prod): dropped 1,093 duplicate
     unique indexes (tbl_publishable_key x789 etc., Sequelize alter:true bug) 1,323 -> 230; added hot-path indexes
     on tbl_user_transaction/customer_transaction/notification/user_wallet/payment_link/company/kyc/api/user.email.
  P2 FE: hooks/useKycStatus.ts single SWR entry (gate/badge/identity), waits for company store; contexts stable
     EMPTY_LIST memo; axiosConfig console.log removed.
  Cleanup: ~140 stray root/backend files -> /app/_archive (excluded in tsconfig/.dockerignore).
  Audit tooling: backend/scripts/audit/*.cjs (redis TTL audit, db RTT/indexes, per-endpoint query counter).
  FOLLOW-UP (same fork, user-approved): CRITICAL reset-password bypass fixed (getRedisItem `{}` truthiness →
     any account resettable with bogus token) — see AUDIT_2026-06.md; prod Redis cleanup applied (−276 legacy
     ratelimit, 445 pending-notif now expire); suspicious-activity emails (OTP lockout + login rate-limit trip,
     6 locales, 1h dedup) via services/securityAlertService.ts; EXACT MONEY MATH everywhere: backend utils/money.ts
     (decimal.js) + frontend utils/money.ts (BigInt), 778 rounding sites codemodded, core arithmetic hand-refactored,
     checkout split extracted to controller/payment/checkoutMath.ts with property tests; before/after API snapshots
     byte-identical. OPEN for user: FastForex subscription lapsed (renew or drop key).
  GIT COMMIT BLOCKER (user: "won't commit, fix any file over 500 lines"): controller/wallet/walletOtp.ts was 501 ->
     trimmed to 448 (unused imports). Full .husky/pre-commit run exit 0 (preflight-tsc BE+FE, file-size, secrets,
     contrast warn-only). COMMITTED via hook: 1ae1436b31ffa6ca50a1f07bf7238231311f03c1 (391 files).
  REGRESSION (testing_agent iteration_120, backend read-only on LIVE DB): 20/20 PASS — wallet verifyOtp/verifyCode/
     validateWalletAddress 4xx-never-500 (missing otp/company_id, invalid otp, foreign company 403, unauth); sudo/status;
     reset-password bogus/empty/missing token all 400 + login still works; wallet+payment getCurrencyRates finite numbers,
     clean 4xx on unknown/empty; public tickers; walletOtp.ts 448, file-size gate 0, tsc 0; no new stack traces.
     Suite kept at backend/tests/test_iter120_regression.py — HARDENED to env vars (TEAM_TEST_BASE_URL/OWNER_EMAIL/
     OWNER_PASSWORD, skips when unset; no hardcoded live password). Wallet-OTP fix is fully closed.
  UI/UX RECOMMENDATIONS (7 items, prioritized, NOT implemented) documented at top of memory/REFACTOR_STATUS.md:
     rate-limit countdown UX, security activity panel, instant dashboard (SWR->localStorage), single-step login,
     checkout fee breakdown, sidebar grouping, transactions table polish.
  CHECKOUT BREAKDOWN — DONE (user choices: always show, even merchant-pays; checkout + success + PDF + email; real E2E).
     Frontend: checkout/PriceBreakdown.tsx + checkout/breakdownRows.ts (pure row builders), CleanCheckoutV2 header rows
     (Amount / [Tax] / Dynopay fee / [Network fee] / Total you pay / Merchant receives [+ network fee cover]) always shown,
     est. until coin reserved then exact from addPayment split; crypto split card (data-testid clean-checkout-crypto-split)
     under the amount; success card rows (clean-checkout-success-breakdown). i18n 9 keys x6 locales via
     scripts/inject_breakdown_i18n.py. Meta.estimated_platform_fee, CryptoSplit type.
     Backend: getData fee_info.estimated_platform_fee (all 3 sites); /pay/addPayment (paymentController) split moved from
     FLOAT math to computeInclusiveSplit (checkoutMath.ts) and now RETURNS amount/merchant_amount/fees/fee_payer/
     platform_fee_usd/network_fee_usd; MONEY FIX (user picked option a): customer-pays split now matches the quote —
     getCurrencyRates quotes with the merchant's userId (tier/promo parity), returns platform_fee/network_fee parts and
     caches quote-{ref}-{CUR} in Redis (30 min); addPayment reads it so the network buffer rides with the merchant share
     and Dynopay gets exactly its tier fee (was: ~$0.15 skew to Dynopay on a $5 link). chainVerification writes
     settled_merchant_amount/settled_fee_amount at PAYOUT_COMPLETE; verifyCryptoPayment returns merchantAmount/feeAmount/
     feePayer; PDF receipt "Payment breakdown" block; customer confirmation email rows (sendCustomerPaymentConfirmationEmail
     moved to services/email/customerReceiptEmail.ts to stay under the 500-line gate). settledBreakdown.ts helper.
     Verified: real E2E both fee payers (0.00006762 + 0.00001285 = 0.00008047 BTC; $5.00+$1.05+$0.53=$6.58), 12 jest
     checkoutMath tests, testing_agent iteration_121 13/13 PASS (backend API/unit/PDF/i18n). All QA artifacts cleaned
     (3 pending tx rows deleted, temp addresses 11/20/71 released, Redis keys cleared, throwaway links 318/319/320 deleted).
     Hook gates green. KNOWN: getData pre-quote estimate (est.) uses feeTiers path (~$1.08) vs exact $1.05 — replaced
     within ~2s by exact figures; success-screen rows verified by code + unit only (no real payment made).
  SIDEBAR REGROUP — DONE (user: Sell/Money/Grow/Settings; collapsible per device, all open by default, active group
     auto-expands; same in mobile drawer). Dashboard pinned; Sell=[Payment Links, Your page] (creator: page first);
     Money=[Balances, Transactions, (Receipts), Payout wallets]; Grow=[(Customers), Refer & earn]; Settings=[Settings,
     (Developers), Help & Support]. Footer cards (ReferralAndKnowledge) REMOVED from the sidebar (component still used on
     Dashboard). New: NewSidebar/navSections.ts (pure builder), NewSidebar/SectionHeader.tsx (SectionToggle styled button,
     data-testid sidebar-section-toggle-{key}, count badge when folded), hooks/useCollapsedSections.ts (localStorage
     `sidebar_sections_collapsed` JSON array). Section wrapper data-testid sidebar-section-{key} data-folded. Icon rail
     ignores folding. Row padding 10->8px, group gap 14->10px. i18n: dashboardLayout.sidebarSectionSell + common.referAndEarn
     x6 via scripts/inject_sidebar_i18n.py. Self-tested via screenshots (fold/unfold, count badge, persist across reload,
     auto-expand on /transactions un-persists, 390px drawer). Hook gates green. KNOWN: at 768px tall with every group open
     the last ~2 rows scroll (Menu is the scroll region) — folding any group fixes it. -->

<!-- 2026-06 (fork): BLOG COVER REFRESH — DONE + VERIFIED (screenshots /blog + /blog/[slug]; 4/4 covers loaded, post
     cover 1200x630; tsc 0, eslint 0). utils/blogData.ts += getBlogCover(post) = coverImage || /og/blog-<slug>.png (the
     same branded share card). pages/blog/index.tsx: each card gets a 1200/630 cover on top (rounded 14px, lazy, hover
     scale; testids blog-card-<slug>, blog-card-cover-<slug>). pages/blog/[slug].tsx: hero cover between author row and
     share buttons (rounded 20px, shadow, fetchPriority=high + <link rel=preload>; testid blog-post-cover). To add art
     for a new post: add it to blogPosts, run `python3 scripts/generate-og-images.py` (pip: pillow fonttools brotli). -->

<!-- 2026-06 (fork): INLINE KYC STEP + EVENT-TRIGGERED ACTIVATION EMAIL + PER-PAGE OG CARDS — DONE + VERIFIED
     (testing_agent iteration_118: 8/8 scenarios pass, backend pytest 14/14, all gate scenarios via Playwright route
     interception — no prod writes). BE tsc 0, FE tsc 0, eslint 0.
  1) INLINE KYC STEP (/create-pay-link): NEW hooks/useKycGate.ts (SWR ['kyc/status/full', companyId] -> GET /kyc/status;
     required/blocked/daysRemaining/hasSession/startVerification/refresh). KycGraceBanner refactored onto the hook.
     pages/create-pay-link.tsx: setupComplete = company && wallet && !kyc.blocked; loading waits for kyc; steps array
     gains a 3rd "Verify your identity" step whenever kyc.required (helper: blocked / "{{days}} days left" / continue /
     "Opening verification…"); KYC-only gate swaps title/subtitle (setupKycTitle/Subtitle) + VerifiedUser icon; grace
     (not blocked) renders the form with <KycGraceBanner/> above it; backend [KYC_REQUIRED] create error -> kyc.refresh()
     flips the guard in. testids: payment-link-setup-guard[data-gate=brand|wallet|kyc], setup-required-subtitle,
     setup-guard-step-kyc. i18n keys setupStepKyc*/setupKyc* in createPaymentLinkScreen.json (6 locales).
  2) ACTIVATION GATE EMAIL: NEW backend/services/email/activationGateEmail.ts sendActivationGateEmail(userId, gate,
     companyId) — subject "Finish setting up to get paid", per-gate intro/CTA -> /create-pay-link, video CTA (not for kyc),
     unsubscribe footer (existing activation-unsubscribe token), Redis dedup activation-gate:{uid}:{gate} 7d, honours
     marketing_opt_out, SERVER-SIDE gate re-check (brand: no company; wallet: no wallet for owned company; kyc:
     checkKycEnforcement().blocked) so clients can't trigger arbitrary mail. i18n activation.gate.* in backend/locales
     (6 langs). NEW controller/user/activationNudge.ts -> POST /api/user/activation-nudge {gate, company_id?} (auth +
     moderateRateLimiter; 400 on bad gate). Also fired server-side in paymentLinkController when KYC blocks create.
     Frontend fires it once per gate per browser session (sessionStorage dp:activation-nudge:<gate>) when the guard shows.
     NOTE: preview has DISABLE_OUTBOUND_EMAIL=true — real send only in prod.
  3) PER-PAGE OG CARDS: scripts/generate-og-images.py += render_card() + PAGE_CARDS -> public/og/{fees,about,how-to,blog}.png
     (1200x630, same brand system as vertical cards; deps: pip fonttools brotli pillow). _app.tsx ROUTE_OG_IMAGE map picks
     them for og:image/twitter:image; everything else keeps /og/dynopay-og.png. -->

<!-- 2026-06 (fork): SEO TITLE/META AUDIT + FIXES — DONE + VERIFIED (rendered-HTML audit via scripts/seo_audit.py; tsc 0, eslint 0).
     User shared a Slack preview of the homepage and asked to analyze titles/SEO for clarity + marketing.
     • Homepage title now matches H1 + OG image: "Accept Crypto Payments — Get Paid Your Way · Dynopay" (was "Sell, tip,
       fundraise — in crypto"); desc de-jargoned. default_title/desc same. All 6 locales (pageTitles.json + landing.json).
     • BUG /for/* (15 verticals): SEOLandingPage og:/twitter: tags had no `key`, so _app's generic og:title came FIRST and
       Slack/LinkedIn/FB showed the homepage headline. Fixed with keys; vertical meta_titles unified to "sentence case · Dynopay".
     • BUG blog posts: <title> rendered literal "<!-- -->" (two JSX children) + 76–93ch. Now template string, suffix "· Dynopay".
       Same mixed-children fix in order/[publicRef], _error, [handle]/cart, [handle]/checkout.
     • /how-to og:description + twitter:* added; /documentation weak description override removed; /blog og:desc = meta desc;
       about_desc synced with landing.about.metaDescription; stub descriptions removed from wallet/dashboard/create-pay-link/referrals.
     • Missing <h1> fixed on /fees, /referral-program, /system-status (component="h1"), /documentation (headingAs="h1").
     • og:locale -> en_US/pt_BR/fr_FR/es_ES/de_DE/nl_NL. Polish: fees_title "Pricing — 1.5% down to 0.5%, no monthly fee",
       about_title "About Dynopay — making crypto payments simple for every business", blog_title "Crypto payments blog — fees,
       settlement & integrations". NOTE: the Slack/X link cache for dynopay.com must be refreshed after deploy. -->

<!-- 2026-06 (fork, pod 5cde9912): GIT COMMIT BLOCKER FIXED — DONE + VERIFIED (testing_agent iteration_115 all green).
     User: "blocker preventing commit — 500 line limit or large images?" ROOT CAUSE: husky pre-commit
     (.husky/pre-commit -> backend/scripts/check-file-size.mjs) FAILS on NEW backend .ts > 500 lines;
     controller/wallet/walletSudo.ts was 545. (Not images: largest staged file was PRD.md 77KB.) FIX: split into
     walletSudo.ts (session/OTP + requireWalletSudo, 269 lines; re-exports batchWalletMutate) + NEW walletBatch.ts
     (batchWalletMutate + isPlausibleAddress, 288 lines). walletController/walletRouter imports unchanged. All gates
     green (preflight-tsc BE+FE, file-size, secrets). COMMITTED via the hook: 332368ef059b5dfe7f286a65656cb50254f9ba29.
     iteration_115: status 401 no-auth / 200 active=false w/ Bearer / batch 403 SUDO_REQUIRED w/o session; FE sheet
     opens to unlock gate, 0 console errors. Reminder: keep new backend .ts files <= 500 lines or the platform's
     auto-commit (and Save to GitHub) will be blocked again. -->

<!-- 2026-06 (fork, pod 5cde9912): WALLET MANAGER PREMIUM UI/UX REBUILD — DONE + VERIFIED (screenshots light/dark/
     mobile; reversible LIVE E2E: BTC wallet_name NULL -> "Main" -> NULL via the new UI, DB confirmed back to NULL,
     company_1 = 13 wallets; test Redis sudo session cleared). FE tsc 0, eslint 0. User: "I hope the UI/UX for wallet
     actions is clean and usability is premium" -> full rebuild of Components/UI/WalletManagerModal (split into
     index.tsx orchestrator + useSudoSession.ts + SessionStrip/UnlockGate/SectionLabel/ExistingWalletRow/AddWalletCard/
     MissingNetworks/ReuseSection/ManagerFooter + types.ts). Now a proper right-side sheet (MUI Dialog, Slide-left,
     600px, full-screen <md): sticky header (title + X), SESSION STRIP (lock-open/clock icon, "Unlocked · m:ss
     remaining · no more codes needed", 2px time-progress bar, turns amber <=2min, "Lock now"), SCROLL BODY, GLASS FOOTER.
     • Existing wallets: table-style compact rows (coin icon, name, mono ticker, truncated mono address, wallet name);
       tap/pencil expands inline editor (address mono + name + tag; "Reset to saved" + "Done"); trash marks removal
       (row tints rose, strikethrough, "Removes on save", undo-2 icon to undo); dot+text status (Edited/indigo,
       Removes/rose, invalid/amber, error/rose). Rows with server errors auto-expand after a partial save.
     • CLIENT-SIDE FORMAT GUARD: utils/walletAddressType.ts += isPlausibleAddress() (mirrors backend regex per family)
       + shortAddress(). Invalid edited/new addresses show amber inline hint, footer "N address looks off", and Save is
       DISABLED until fixed (backend would reject anyway).
     • Add wallets: "Not set up yet — tap to add" chips (icon + code, prefill a row); numbered cards turn emerald-check
       when complete; smart paste box ("EVM address detected · works on these networks too" + chips + "Add to all N" /
       "Also add X"); duplicate-row button; "Every supported network already has a wallet" empty state.
     • Reuse section restyled (brand card, Select all/Clear, pressed chips, "Copy N wallets").
     • Footer: change summary dots (N new / N edited / N removed), Discard/Close + "Save N changes" (loading state);
       closing with pending changes -> inline "Discard N unsaved changes? Keep editing / Discard" (also on backdrop/Esc).
     • TOAST FIX (root cause found in E2E): global Toast is fixed bottom-right and COVERED the sheet's Save button
       (a click landed on the toast and the save silently didn't fire). Added additive `placement` to the toast
       payload/reducer/IToastProps/Toast (top-center variant, slideInDown) + a proper amber "warning" style (was
       rendering green). Manager dispatches placement:"top-center". Containers/Client passes ToastState.placement.
     • Icon bundle regenerated (65 icons, +undo-2). All new i18n via tw() defaultValue; interpolation vars use {{n}}
       (not i18next-reserved `count`). testids: wallet-manager-{modal,body,footer,summary,session-banner,countdown,
       lock-btn,x-btn,close-btn,save-btn,discard-confirm,keep-editing-btn,discard-btn,existing-list,row-<CUR>,
       edit-toggle-<CUR>,remove-toggle-<CUR>,undo-remove-<CUR>,editor-<CUR>,address-<CUR>,name-<CUR>,tag-<CUR>,
       reset-<CUR>,collapse-<CUR>,status-<CUR>,invalid-<CUR>,error-<CUR>,missing,missing-<CUR>,add-row-btn,
       add-row-btn-bottom,add-row,add-address,add-name,add-tag,add-invalid,add-error,duplicate-row-btn,remove-row-btn,
       smart-paste,smart-preview,smart-preview-<CUR>,smart-apply-btn,all-set,reuse,reuse-<cid>,reuse-all-<cid>,
       reuse-chip-<cid>-<CUR>,reuse-copy-<cid>,unlock,send-code-btn,cancel-btn,invalid-count}. -->

<!-- 2026-06 (fork, pod 5cde9912): WALLET MANAGER ENHANCEMENTS — Session Reminder + Bulk Reuse +
     Smart Paste Preview — DONE + VERIFIED (screenshots on LIVE account via reversible imbalance, restored).
     All in Components/UI/WalletManagerModal.
  1) SESSION REMINDER: countdown turns amber ("Ending soon · m:ss", clock icon) at ≤120s left and fires a
     one-time toast "2 minutes left — save your changes soon" (warnedRef, reset on each unlock). Screenshot-
     verified (banner + toast at 0:54).
  2) BULK REUSE: new "Copy from another brand" section in the unlocked editor. Reuses the EXISTING, already-
     shipped backend (GET /wallet/reusable-wallets + POST /wallet/copyWalletAddresses — no OTP, copies the
     merchant's own saved addresses). Lists other brands with wallets THIS brand lacks; per-currency toggle
     chips (default all) + "Copy N wallets". Fetched via fetchReuse() on unlock + after every save/copy.
     Screenshot-verified (SMADAV · 2 available → ETH/POLYGON chips → Copy 2 wallets) after temporarily
     unsetting ETH+POLYGON on company 1 (backend/scripts/imbalance_test.cjs remove|restore, snapshot to
     /tmp/imbalance_snapshot.json) — RESTORED EXACTLY (ETH#2/POLYGON#11 back on company 1, both companies 13).
  3) SMART PASTE PREVIEW: the "Apply to all N" chip now first shows a tiny chip list of the exact networks it
     will fill (previewList = compatible EVM/Tron currencies the brand is missing; shown only when ≥2). Copy:
     "<family> address detected. This will add:" + chips + "Apply to all N". Screenshot-verified: pasting a 0x
     address on a brand missing ETH/POLYGON/RLUSD-ERC20 → chips [ETH, RLUSD-ERC20, POLYGON] + "Apply to all 3".
  NOTE: on the Hostbay account both brands are fully stocked (only RLUSD-ERC20 missing) so in normal use the
  reuse section and smart-paste chip are correctly HIDDEN (nothing to reuse / <2 missing). FE tsc 0. -->


<!-- 2026-06 (fork, pod 5cde9912): WALLET "FULL PACKAGE" — 10-min sudo session + BULK add/edit/delete +
     SMART PASTE — DONE + VERIFIED (backend reversible E2E on LIVE prod DB, fully restored; FE+BE tsc 0;
     editor screenshot-verified). ADDITIVE — legacy single-action OTP flows untouched. Preview:
     https://kendra-vault.preview.emergentagent.com
  WHY: adding N payout wallets (e.g. all EVM chains) used to need one emailed OTP PER network. Now one OTP
     unlocks a 10-minute security session that authorises many add/edit/delete ops.
  BACKEND (all NEW, additive) — backend/controller/wallet/walletSudo.ts:
    • Redis-backed sudo session keyed by user_id (consistent w/ the app's server-side OTP model — NO client
      token). setRedisItemWithTTL('wallet_sudo_session_<uid>', {issued_at,expires_at}, 600). Absolute expiry
      (no sliding TTL). Fail-CLOSED on Redis error.
    • Unlock OTP stored HASHED in Redis ('wallet_sudo_otp_<uid>', HMAC-SHA256(API_SECRET,code)) — NOT in the DB
      (avoids clobbering the legacy tbl_user.verified_otp used by single flows). 5-min TTL, 5-attempt cap,
      30s request rate-limit (atomic NX). Single-use: consumed on verify.
    • Routes (walletRouter.ts): GET /wallet/sudo/status, POST /wallet/sudo/request-otp | verify-otp | revoke;
      POST /wallet/batch (requireCompanyOwnerBy + requireWalletSudo middleware + auditWallet). CSRF auto-skips
      for Bearer-token requests (csrfMiddleware L132).
    • batchWalletMutate: 1-50 ops [{action:add|edit|delete,...}], each scoped by user_id+company_id, per-op
      results, one summary email. add reuses the verifyOtp path (empty-slot reuse, merchant-pool init,
      ensureLiveApiKey). ROOT-CAUSE HARDENING: added isPlausibleAddress() strict format guard BEFORE the
      Tatum call — the single-flow relied only on tatum.getAddressBalance which does NOT throw for a bad RLUSD
      string (a typo would create a garbage wallet). Regex per family (EVM 0x40hex / Tron T… / XRPL r… /
      BTC/LTC/DOGE/BCH/SOL). Emails: sendWalletSudoOTPEmail + sendWalletBatchSummaryEmail (walletEmails.ts,
      same branded template + otpBlock — "Consistent" per user).
  FRONTEND — NEW Components/UI/WalletManagerModal (right-side panel): unlock gate ("Email me a code") ->
    OtpDialog -> editor. Editor: session banner + live MM:SS countdown + "Lock now"; existing wallets with
    editable name/address (+ tag for XRP/RLUSD) + Remove toggle; "Add wallets" multi-row (CryptocurrencySelector
    + address + optional name); SMART PASTE (utils/walletAddressType.ts detectAddressKind: 0x40hex->EVM,
    T…->Tron) shows "Apply to all N compatible networks" when >1 missing -> auto-fills rows w/ the same address.
    "Save N changes" -> POST /wallet/batch, per-op inline errors, 403 SUDO_REQUIRED reopens the gate. Entry:
    NEW "Manage wallets" button (wallet-manage-btn) on /wallet next to the legacy "Add wallet". api/endpoints.ts
    += wallet.sudo*/batch. New Icons bundled (shield-check/lock-open/settings-2 — yarn icons:bundle, 64 icons).
    i18n via t() defaultValue (no locale-file churn).
  VERIFIED (curl, reversible, LIVE prod DB user_1/company_1): gate 403 SUDO_REQUIRED w/o session; request-otp
    200; OTP recovered via HMAC (backend/scripts/recover_sudo_otp.cjs) -> wrong 400, correct 200 -> session
    active; BULK batch = 2 real name edits (id 1,8) + reject dup ETH + reject invalid RLUSD (format guard) +
    reject delete-not-found; then FULLY RESTORED (names->NULL, scratch RLUSD wallet 144 hard-deleted, 0 pool
    rows — pool init had failed cleanly on XRP_MASTER). Editor screenshot-verified (banner + 13 rows + add
    section) via a seeded Redis session (cleared after). company_1 back to exactly 13 wallets. Test harnesses:
    backend/scripts/{recover_sudo_otp,seed_sudo_session,inspect_rlusd_scratch,cleanup_batch_test}.cjs. -->


<!-- 2026-09-02 (fork, pod vault-setup): LANDING "SMALL→BIG" ROOT-CAUSE FIX + STATUS BADGES + WALLET FLOW —
     DONE (testing_agent iteration_114 = 100% frontend; backend edit-OTP flow curl-verified + reverted; FE tsc 0,
     eslint 0 errors). LIVE prod DB, SAFE MODE. Preview: https://kendra-vault.preview.emergentagent.com
  (1) LANDING REFLOW — TRUE ROOT CAUSE (reproduced on dynopay.com prod, 390px + throttled net): the font CSS
      variables in pages/_app.tsx were rendered as <style>{`…`}</style>; React SSR HTML-escapes the quotes
      (" -> &quot;, ' -> &#x27;) and browsers do NOT decode entities inside <style>, so `--font-hero: &quot;…`
      was INVALID CSS until hydration rewrote the node -> whole page painted in Times New Roman / default fonts,
      then "grew" into Manrope/Plex. (Earlier "fixes" targeted font preloading = wrong layer.) FIX: style now
      emitted via dangerouslySetInnerHTML (data-testid font-vars-style). Also removed the `!mounted` white-logo
      guard in HomeHeader + HomeFooter (logo was invisible pre-hydration on light theme; theme is SSR'd from the
      cookie so isDark is hydration-safe). VERIFIED on a real `next build` (NEXT_DIST_DIR=.next-prod, port 3400):
      JS-disabled SSR paint == hydrated paint for h1/hero/header/logo/main at 390 and 1440. Regression script:
      scripts/verify-ssr-vs-hydrated.js. next.config.mjs: optional distDir via NEXT_DIST_DIR env.
  (2) STATUS BADGES — new shared Components/UI/TransactionStatusBadge.tsx (tone map + i18n label + tooltip +
      "Converted" sub-label; variants inline|pill) replaces the divergent StatusDot-in-table vs legacy icon pill
      in TransactionDetailsModal header. testids tx-row-status / tx-card-status / tx-modal-status /
      tx-status-converted. Transactions table (styled.tsx) >=md now uses weighted minmax(0,Nfr) columns +
      minWidth 0 (was repeat(7,1fr)+minWidth:max-content+cell maxWidth 180 => fixed 1356px row => Status column
      pushed off-screen on 1280-1440 laptops). <md keeps max-content horizontal scroll. i18n
      transactions.autoConvertedShort x6.
  (3) WALLET FLOW — BUG: Edit wallet + address change called /wallet/validateWalletAddress (add-flow) which
      rejects "A DOGE wallet already exists" for the very wallet being edited (repro'd via curl), and verifyOtp
      would have created a new slot. FIX: AddWalletModal edit mode uses the dedicated backend flow
      POST /wallet/wallet/update/send-otp {wallet_id,company_id} -> POST /wallet/wallet/update {wallet_id,
      company_id,otp,wallet_address,wallet_name,destination_tag}; resend re-hits send-otp; success -> toast +
      refetchWallets + close. Name-only edits still PUT /wallet/updateWallet/:id (no OTP) and now refetch.
      Add-wallet success screen (Done / Add another) now shows on the Wallets page too (Done closes when no
      onWalletAdded). Real wallet_name + destination_tag now flow into edit prefill (useWalletData/WalletDataType).
      UX: helper text "Changing the address requires a one-time code…" + CTA "Verify & save" when OTP needed;
      add-only description hidden in edit; edit/delete buttons got aria-labels + testids wallet-edit-btn /
      wallet-delete-btn. i18n walletScreen.{walletUpdated,editOtpNotice,verifyAndSave,updatingWallet} x6.
      E2E (reversible, live DB): send-otp -> OTP read from tbl_user.verified_otp -> wrong OTP 400 -> correct OTP
      with SAME DOGE address + name "Doge main" -> 200 -> name reverted to NULL, OTP cleared.
  (4) ICONS OFFLINE — <Icon/> (styles/uiKit.tsx) fetched every lucide icon from api.iconify.design at runtime
      (edit/delete wallet buttons rendered as BLANK squares while loading / when CDN blocked). Now
      scripts/gen-icon-bundle.mjs (yarn icons:bundle) writes styles/iconBundle.json (61 icons, 16KB) which is
      addCollection'ed at import — instant + offline; unknown icons still fall back to the API. Re-run the script
      after adding a new <Icon name=...>. Dev deps: @iconify-json/lucide, @iconify/utils.
  (5) DEPLOY BLOCKERS FIXED: `next build` FAILED on 2 pre-existing eslint ERRORS (PayoutCard `useSavedWallet`
      callback named like a hook -> renamed applySavedWallet; how-to.tsx unescaped apostrophe). Prod deploy would
      have failed without this.
  KNOWN/MINOR (pre-existing): PopupModal uses keepMounted so closed dialogs stay in DOM (visibility:hidden) —
      duplicate testids for strict locators; no functional impact. -->

<!-- 2026-09-02 (fork, pod 054d2272 / preview setup-credentials): FIRST+LAST NAME COLLECTION +
     PREFILL + EDIT + IDENTITY-VERIFIED LOCK — DONE (FE+BE tsc 0; screenshot-verified locked state;
     backend curl-verified 403 guard). LIVE prod DB, SAFE MODE. Storage: kept single tbl_user.name
     (split on spaces for first/last, joined to save) — NO schema change (user chose 2a).
  (1) SIGN-UP NAME STEP (email/phone only): pages/auth/register.tsx — new Step "name" between "otp"
      and "success". After OTP verify for NEW accounts (not existing-login, not social), collect
      First+Last (both required) then PUT /user/updateUser {name} -> dispatch USER_LOGIN with the
      returned {userData,accessToken} (refreshes JWT + redux top-level name) -> success -> onboarding.
      Existing-account re-login unchanged (straight to /dashboard). Social (Google/GitHub) already
      capture provider name in backend/controller/user/socialAuth.ts -> they SKIP this step.
      testids: register-name-step, register-first-name-input, register-last-name-input,
      register-name-submit, register-name-error.
  (2) BRAND MODAL (Components/UI/OnboardingFlow/CreateCompanyModal.tsx): the "Your name" First/Last
      section now shows for BOTH individual AND business (was business-only). Prefill hardened — reads
      userState.name OR the JWT token (useTokenData) as fallback, because redux resets on hard reload
      (this was the user's "doesn't prefill" bug). Validation requires first+last for both types
      (skipped when name is locked). testids: company-first-name-input, company-last-name-input,
      company-name-locked-notice.
  (3) PROFILE SETTINGS (Components/Page/Profile/AccountSetting.tsx): First/Last name were READ-ONLY
      ("contact support"); now EDITABLE with a Save button (PUT /user/updateUser -> USER_LOGIN +
      USER_PROFILE_FETCH). testids: first-name-input, last-name-input, save-name-btn.
  (4) IDENTITY-VERIFIED LOCK (user rule): once KYC status === "approved" the legal name can no longer
      be self-edited. NEW hook hooks/useIdentityVerified.ts (SWR ["kyc/status","self"], reuses badge
      key). Frontend: brand modal + settings render the name fields DISABLED + a "verified, contact
      support" notice, no Save. Backend enforcement (defense-in-depth) in backend/controller/user/
      profile.ts — both updateProfile (PUT /user/profile) AND updateUser (PUT /user/updateUser) reject
      a NAME CHANGE with 403 "Your name is locked after identity verification..." when
      isMerchantIdentityVerified(userId) (helper/merchantVerification.ts, account-level company_id IS
      NULL approved). Photo/email/mobile/language updates are unaffected (guard only trips on a name
      delta); new unverified signups pass (guard checks verification, they aren't verified yet).
  i18n: scripts/inject_name_i18n.py injected keys into ALL 6 locales — auth.namePrompt*/nameFirst*/
      nameLast*/nameSaveContinue/nameSaveFailed, profile.saveName/nameUpdated,
      companyDialog.createModal.nameLockedNotice.
  VERIFIED: FE tsc 0, BE tsc 0. Backend curl (user_1 = KYC approved): GET /kyc/status -> approved;
      PUT /user/profile {name} -> 403 locked; PUT /user/updateUser data={name} -> 403 locked (no write).
      Screenshots (setup-credentials preview, logged in as verified Hostbay): Settings->Profile shows
      First/Last disabled + "contact support" notice + NO save btn; Add-brand modal shows First/Last
      for BOTH individual & business, prefilled "Hostbay" from JWT, disabled + verified notice.
  NOT E2E-TESTED (live prod DB + email off make it unsafe/infeasible): the register name step
      happy-path (needs a new prod account + OTP) and the EDITABLE (unverified) path (needs an
      unverified account). Both are tsc-clean + logic is the inverse of the verified path that WAS
      screenshot-verified. Preview host: https://kendra-vault.preview.emergentagent.com
      (the older 054d2272 host returns 502). -->


<!-- 2026-09-02 (fork, pod d4fef0d9): KYC TRUTH ALIGNMENT + INDIVIDUAL->BUSINESS UPGRADE + KYC GRACE
     COUNTDOWN — DONE + VERIFIED (backend curl + reversible harness; frontend testing_agent iter_112 100%).
     LIVE prod DB, SAFE MODE. Preview: https://d4fef0d9-...preview.emergentagent.com
  (1) KYC STATUS VOLUME ALIGNMENT (backend/controller/kycController.ts getKYCStatus): now derives volume +
      grace/blocked state from checkKycEnforcement() (SUM successful tbl_customer_transaction) instead of the
      old tbl_user_transaction sum — so the dashboard matches the actual payment-gating source of truth. Also
      surfaces new fields: is_exempt, blocked, has_active_session, verification_url, grace_period{days_remaining,
      grace_period_end, threshold_date, blocked}. VERIFIED: company_1 volume jumped $0 -> $29,174.82 (the exact
      discrepancy the user reported); requires_kyc=true, status=approved => grace null, can_process=true.
  (2) INDIVIDUAL->BUSINESS UPGRADE: NEW owner-only endpoint PUT /api/company/upgrade-to-business/:id
      (companyController.upgradeToBusiness; companyRouter: authMiddleware+companyOwnershipMiddleware+
      requireCompanyOwner). Flips account_type individual->business IN PLACE (no 2nd company); requires
      business name + country, optional website + VAT. api/endpoints.ts += company.upgradeToBusiness. Guided
      modal NEW Components/UI/UpgradeToBusinessModal (prefilled name, country Autocomplete, website, VAT;
      fullScreen on mobile; success state; testids upgrade-business-modal/-name-input/-country-input/-website-
      input/-vat-input/-submit-btn/-success/-cancel-btn). Entry points: CompanySelector chip company-upgrade-<id>
      (individual+owned rows only) AND Settings->Account details card settings-upgrade-business-card
      (visibleSections includes 'company' + individual). VERIFIED backend: positive flip 200 + DB business,
      already-business 400, missing-name 400, no-auth 403, idempotent — all via REVERSIBLE harness
      backend/scripts/verify_upgrade_business.ts (scratch company created+deleted). VERIFIED frontend: chip
      shows only on individual, opens modal, flip -> success -> badge flips to BUSINESS + chip disappears;
      settings card same; desktop + mobile full-screen sheet.
  (3) KYC GRACE COUNTDOWN: NEW Components/Page/Dashboard/KycGraceBanner.tsx rendered in pages/dashboard.tsx
      (!isMember). Shows 'X days to verify your identity' (amber) or 'Verification overdue — payments paused'
      (red, when grace expired) with a one-click 'Start verification' button (POST /api/kyc/submit -> Veriff
      URL redirect; 'Continue verification' if a session already exists). Hidden when !requires_kyc, approved,
      or exempt. testids kyc-grace-banner/-days/-start-btn. VERIFIED: renders '90 days to verify' for a
      scratch over-threshold individual, HIDDEN for approved The Dev Store.
  BUG FIXED mid-session (iter_111 MEDIUM): banner didn't render on in-app company switch (needed reload).
      ROOT CAUSE: SWR KEY COLLISION — KycGraceBanner and KycVerifiedBadge both used key ['kyc/status', companyId]
      but different fetchers (object vs string), so the banner intermittently read a string. FIX: banner key ->
      ['kyc/status/full', companyId]. Also silenced MUI renderOption key-spread warning (destructure key).
      Re-verified iter_112 100% (banner appears <2s on switch, no reload; mobile full-screen modal flip OK).
  SAFE-MODE HYGIENE: all frontend testing used a REVERSIBLE fixture (backend/scripts/kyc_ui_fixture.ts
      --setup/--teardown: scratch individual company + one $15k successful customer_transaction). Torn down
      after — user_1 confirmed back to exactly [The Dev Store(business), SMADAV(business)], 0 scratch rows.
      NO new login creds. BE+FE tsc 0. -->

<!-- 2026-09-02 (fork, pod d4fef0d9): TWO NAI PICKS SHIPPED & SCREENSHOT-VERIFIED (frontend-only).
  (1) BRAND FEATURE SPOTLIGHT — new Components/Page/Home/v3/BrandSpotlightV3.tsx: a dedicated
      "headline feature" section (2-col desktop / stacked mobile) pairing value copy (eyebrow
      "Multi-brand", reuses why.c7t/c7d headline+body, 3 check bullets, "Start your first brand"
      pill CTA -> /auth/register?ref=brand_spotlight) with a faithful, theme-aware DOM MOCK of the
      in-dashboard brand switcher (CompanySelector look: "Aurora Group" header, Your brands, active
      brand row w/ verified + BUSINESS badge, Add brand). Wired in Home/index.tsx right after
      <WhyDynoPayV3/>, NOT wrapped in hideOnPhone -> visible on desktop+tablet+mobile. New i18n
      v3.brandSpotlight (eyebrow,b1,b2,b3,cta) injected into ALL 6 landing locales (JSON round-trip
      byte-preserving). Verified: 1440px + 390px screenshots both render the mock + copy.
  (2) SANDBOX BADGE POLISH — Components/Page/API/ApiKeysPage.tsx (ApiKeyCard, sandbox-only):
      the "Auto-created · Sandbox" badge already existed; ADDED (a) a MUI Tooltip on it explaining
      what Auto-created means (enterTouchDelay=0 so it works on mobile tap; cursor:help), and
      (b) a NEW one-click labeled "Copy sandbox key" button (data-testid=copy-sandbox-key-btn,
      gated on isSandboxKey, copies apiKey). New apiScreen keys use t() defaultValue (no locale
      file needed; fallbackLng=en). Verified: logged in (The Dev Store) -> /developer-keys ->
      Test card shows Auto-Created·Sandbox badge + limits line + "Copy sandbox key"; Live card
      correctly has NO copy-sandbox button. FE tsc 0. No backend changes.
  (3) SPOTLIGHT SWITCH ANIMATION — BrandSpotlightV3 active-brand highlight now cycles
      (useInView-gated so it only runs on-screen; useReducedMotion respected; CSS-transitioned
      bg/border + check). Verified: active-row samples [0,0,0,1,2,2] -> hops through all 3. -->

<!-- 2026-09-02 CODEBASE ANALYSIS (no code change) — answers for the user:
  KYC VERIFICATION + GRACE: provider Veriff. Volume-triggered, NOT upfront. Threshold
    KYC_THRESHOLD_USD=$10k (SUM successful tbl_customer_transaction). Under $10k -> no KYC,
    can_process_payments=true. At/over $10k -> 90-day grace (KYC_GRACE_PERIOD_DAYS, from the date
    the running total first hit $10k). During grace payments flow + escalating warnings; after grace
    AND not approved -> blocked=true. Enforced in helper/kycEnforcement.checkKycEnforcement, called by
    paymentLinkController (createPaymentLink L751), payment/cryptoCheckout (L1129), confirmPayment.
    Flow: POST /api/kyc/submit -> Veriff session; Veriff webhook POST /api/kyc/webhook (HMAC) maps
    approved/declined/resubmission_requested; resubmit via /api/kyc/resubmit. Exemptions via
    KYC_EXEMPT_COMPANY_IDS/USER_IDS env. MINOR INCONSISTENCY: getKYCStatus sums tbl_user_transaction
    while enforcement+onboarding sum tbl_customer_transaction (enforcement is source of truth).
  INDIVIDUAL vs BUSINESS: tenant = Account = tbl_company row; account_type 'individual'|'business'
    (DB default 'business'). (a) INDIVIDUAL auto-created at signup via userModel afterCreate hook
    -> services/accountProvisioning.ensurePersonalAccount (account_type='individual', idempotent,
    afterCommit, skips test emails + team-invite signups; kill-switch AUTO_PROVISION_PERSONAL_ACCOUNT).
    (b) BUSINESS = any company the user explicitly creates via addCompany/"Add brand" (no account_type
    passed -> model default 'business'). GAP: no endpoint flips individual->business (settings/updateCompany
    don't write account_type), despite the "Company = Account with a business profile" concept. -->


<!-- 2026-09-01 (fork, pod d4fef0d9) follow-up: LANDING FIXES per user.
  (a) MULTI-BRAND CARD MOBILE VISIBILITY (user: "important feature must show on desktop, mobile,
      tablet"). ROOT CAUSE: Home/index.tsx wrapped <WhyDynoPayV3/> (which holds the "One account,
      every brand" card, v3.why.c7) in hideOnPhone = {display:{xs:'none',sm:'block'}} — so the whole
      section was display:none on phones (<600px); it already showed on tablet(sm)/desktop(md). FIX:
      removed the hideOnPhone wrapper around WhyDynoPayV3 only (other hidden sections untouched). The
      card + StorefrontRoundedIcon were briefly removed earlier this turn on a MISREAD ("couldn't see
      it" ≠ "remove it") then RESTORED. Verified via 390px mobile screenshot: section visible=True,
      card renders with full copy. (An earlier removal edit was reverted — net: card kept + now shows
      on all breakpoints.)
  (b) FIXED the fabricated API code samples on the landing. User correctly flagged the curl URL was
      wrong. Corrected DeveloperBandV3.tsx (the LIVE terminal proof the user saw) + TryItNowV3.tsx
      (unwired, fixed for consistency) to the AUTHORITATIVE contract from DEVELOPER_INTEGRATION_GUIDE.md
      / merchantApiRouter.ts: POST https://api.dynopay.com/api/user/createPayment, header
      `x-api-key: your_api_key` (NOT Authorization: Bearer sk_test_), body {amount, redirect_uri},
      200 response {message:"Link Generated!", data:{redirect_url:"…/pay?d=…", available_currencies}}.
      Removed fictional /v1/payments, settlement/settle_to/order_id, cs_live_/pay_01HZ, checkout_url.
      NOTE: Home/v4/ProductPillarsV4.tsx has the same fake snippet but is DEAD (no importers) — left.
      Verified: FE tsc 0; landing renders end-to-end. -->


<!-- 2026-09-01 (fork, pod d4fef0d9): SYSTEMIC SANDBOX-KEY BACKFILL + partial-unique index + full
     sandbox API suite — DONE + VERIFIED. LIVE prod DB, SAFE MODE.
  ROOT CAUSE (why 40 legacy accounts lacked a dpk_test_ sandbox key): sandbox auto-provisioning in
     addCompany only began ~2026-08-23 (earliest active dev key in whole DB; user-confirmed concern
     "did they skip wallet?" is INVERTED — a LIVE key only mints AFTER a wallet is added, and DB-wide
     there are 0 companies with a live key but no wallet, so all 40 candidates already had >=1 wallet).
  (1) SHARED HELPER: NEW backend/controller/api/ensureSandboxApiKey.ts — extracted from the inline
     addCompany block (byte-identical: dpk_test_, max_amount 100, allowed [BTC,ETH,USDT-TRC20,TRX,LTC],
     sandbox_mode, 30d tokens, customer+wallet). Idempotent guard on active development key; non-fatal.
     companyController.addCompany now calls it (kept auto_test_key_created flag). tsc 0.
  (2) MIGRATION 0020 (bootMigrations.ts) — partial UNIQUE index tbl_api_active_company_env_uq ON
     (company_id, environment) WHERE status='active'. Applied to LIVE prod (1 applied, 19 present).
     0 dup active groups pre+post. Backstops the app-level "1 active key per env" cap.
  (3) BACKFILL: NEW backend/scripts/backfill_sandbox_keys.ts (manual, --apply gate, dry-run default,
     audit COUNTS only — never plaintext keys). Ran --apply: candidates=40 created=40 skipped=0
     errored=0; remaining=0; dup groups=0. Active dev keys 4 -> 44. Idempotent (re-run = 0 candidates).
     Spot-check decrypted co 3/36/108 -> valid dpk_test_ w/ matching embedded company_id + restrictions.
  (4) SANDBOX API SUITE: NEW backend/scripts/sandbox_api_suite.ts (The Dev Store dpk_test_ key, real
     merchant API). ALL PASS: $5 createPayment 200; $150 -> 400 sandbox_restriction (max_amount 100);
     DOGE -> 400 sandbox_restriction; BTC/ETH pass; getSupportedCurrency 200 (13); missing key 401.
     Only writes 2 Redis /1 sessions, both deleted. KEY LEARNING: the merchant's secret IS the
     encrypted U2FsdGVk... blob (x-api-key) — the API decrypts it to dpk_test_...; do NOT send the
     decrypted form. E2E regression: login(onarrival21)->getApi?company_id=1 returns 1 active prod +
     1 active dev w/ restrictions. FRONTEND UNCHANGED (The Dev Store /developer-keys already green in
     iter 110). No new login creds created. -->

<!-- 2026-09-01 (fork, pod d4fef0d9): P0 checkout flicker FIXED (CleanCheckoutV2 no longer
     blanks the panel during address reservation — inline spinner instead; testing_agent
     iter 109 4/4). Docs: Buy Button + all integration methods + multi-brand note added to
     /documentation AND DEVELOPER_INTEGRATION_GUIDE.md. Landing: "One account, every brand"
     card in WhyDynoPay + business switcher relabelled to "Brands" (6 locales). Trimmed
     test_result.md (2.8MB->12KB) & PRD.md (572KB->48KB) to clear git-commit friction
     (Emergent has NO 500-line limit; standard GitHub limits only). BUG FIX: The Dev Store
     (company_id=1) missing its sandbox key (predated auto-provisioning) — created dpk_test_
     api_id=92 via POST /api/userApi/addApi; testing_agent iter 110 confirms both Live+Test
     cards now show. LIVE key format unchanged (U2FsdGVk… is just encrypted-at-rest form).
     OPEN: systemic sandbox backfill for OTHER legacy accounts (shared ensureSandboxApiKey
     helper + one-time job + partial unique index — per integration_expert); whether to allow
     >1 API key per environment (currently capped at 1); run item #5 sandbox API test. -->

<!-- 2026-09-01 (fork, pod e952fc3d): EMAIL REWIRING → companyDispatch dedup/RBAC — DONE + VERIFIED. LIVE prod DB, SAFE MODE.
COMPLETED the deferred backend batch: the operational email triggers now route through the dedup/RBAC resolver. Wrapped 9 MERCHANT-facing send sites with dispatchCompanyEmail(companyId, category, fallback, sendOne) — uses utils/notificationRecipients.resolveCompanyRecipients (company notification_email -> company.email -> owner, + permitted ACTIVE team members, deduped case-insensitively) and suppresses ONLY explicitly-disabled categories (else falls back to owner so a critical email is never dropped):
  • services/pendingPaymentService.ts — pending / confirming / partial / partial-expired  => "payments" (handoff wrongly said wired; only the import existed — now actually wrapped, 4 sites)
  • services/conversionService.ts — auto-conversion payout => "payouts"; weekly conversion summary => "digests"
  • services/payoutDigestService.ts — weekly digest => "digests". Added a fanout flag: cron sendPayoutDigestsToAll -> sendPayoutDigestForUser(id,{fanout:true}) FANS OUT; the manual POST /payout-digest/preview stays SINGLE (self only).
  • services/merchantPool/merchantPoolSweep.ts — sweep-recovery payment-received => "payments"
  • controller/payment/settlement/chainVerification.ts — payment-received + large-txn-alert => "payments"
DELIBERATELY LEFT DIRECT (companyDispatch contract + user confirmed): admin-fee emails (go to ADMIN_EMAIL, not merchant) in chainVerification 1038/1050/1154 + merchantPoolSweep 1012; and the CUSTOMER/buyer payment-confirmation receipt (chainVerification ~1855). CATEGORY_PERMISSION: payments/payouts=view_transactions, orders=manage_products, config=manage_company_settings, digests=view_dashboard.
VERIFIED: backend tsc EXIT 0; file-size gate OK; backend healthy (db+redis, SAFE MODE). NEW reversible read-only harness scripts/verify_company_dispatch.ts = ALL PASS on company_id=1: all 5 categories resolve to exactly ONE send (owner — co1 has no notification_email + no active team members), dedupe=true, no fallback leak; explicit-disable of "payouts" SUPPRESSES while "payments" still delivers; notification_prefs captured + RESTORED to {}. No real email sent (stub sendOne + DISABLE_OUTBOUND_EMAIL=true). Team fan-out path is exercised (loop runs, 0 members on co1); multi-recipient dedupe already unit-covered in prior sessions.
NOTE: all cron/settlement side-effects (not HTTP-reachable) — no testing_agent run (user pref). Real multi-recipient fan-out validation happens in prod once a merchant sets a company notification_email / has active team members. This closes the P0 "Email Rewiring" issue. -->


<!-- 2026-09-01 (fork, pod e952fc3d): EMAIL-ARCHITECTURE FRONTEND + REWARD CTA + CHAIN HUB LINKS — DONE + VERIFIED. LIVE prod DB, SAFE MODE. Preview: https://kendra-vault.preview.emergentagent.com
(1) COMPANY EMAIL ROUTING UI (the interrupted P0): backend (migration 0018 tbl_company.notification_email + notification_prefs, resolveCompanyRecipients, GET/PUT /api/notifications/preferences) was already live from a prior session — this session built the FRONTEND. hooks/useNotificationPreferences.ts extended to fetch/expose+save company routing (CompanyRouting: notificationEmail, teamFanout, categories{payments,payouts,orders,config,digests}; missing=>on, mirrors resolver). NEW Components/Page/Notification/CompanyEmailRoutingCard.tsx (email InputBase + 'Also notify team members' fan-out switch + 5 per-category master switches; testids company-notification-email-input, company-team-fanout-switch, company-category-<cat>-switch). Wired into NotificationPage.tsx Settings tab as a full-width card at TOP, OWNER-ONLY (gated !isMember && selectedCompanyId). Client-side email validation blocks save on invalid; backend also 400s. i18n keys added to en/notifications.json (others fall back via t() defaultValue). VERIFIED: FE tsc 0; reversible curl on company_id=1 (set email+prefs -> GET echoes -> invalid email 400 -> RESTORED to null/{}); screenshot of Settings tab renders card.
(2) REWARD/REFERRAL CTA prominence: NEW Components/Page/Dashboard/ReferralRewardBanner.tsx (dismissible localStorage 'dynopay.referral-reward-banner.dismissed', 'Earn 25% revenue share' -> /referrals; testids referral-reward-banner, referral-banner-cta, referral-banner-dismiss), rendered on /dashboard after ClaimHandleBanner (!isMember && setupComplete). PLUS a quiet 'Refer & earn' entry re-added to Components/Layout/ReferralAndKnowledge/index.tsx sidebar footer (accent border, CardGiftcard icon, -> /referrals; testid sidebar-refer-earn) above Help & Support. i18n common.referAndEarn + dashboardLayout.referralBanner* via defaultValue. VERIFIED via screenshots (banner + sidebar entry both render).
(3) CHAIN ICON HUB LINKS: Components/Page/Home/v3/TrustLogosV3.tsx — the 9 landing trust-strip chain glyphs were non-clickable (native title only); now each is a crawlable <a href='/fees'> wrapped in a MUI Tooltip ('<Chain> · See fees & supported networks'), testid trust-chain-<label>. VERIFIED: 9 anchors, tag A, href /fees; screenshot renders.
DEFERRED (separate backend batch, NOT done): wiring the ~60 existing operational email triggers through backend/utils/notificationRecipients.ts resolveCompanyRecipients (only one webhook-disabled email was wired previously). Config-only follow-up: VERIFF_API_SECRET in DO env (hourly Veriff 401s). No testing_agent run (user pref: self-test; SAFE MODE, prod DB) — verified via curl + screenshots + tsc. -->


<!-- 2026-06 (fork): LANDING POLISH x3 (trust strip + checkout-story animation + dark-mode terminal) — DONE + VERIFIED (screenshot light+dark, tsc 0). Frontend-only, additive, no money-path touched. Preview: https://kendra-vault.preview.emergentagent.com (Next.js app is at /app ROOT; /app/frontend is a DIFFERENT unused dir — v3 components live in /app/Components/Page/Home/v3/).
(1) TRUST STRIP — NEW Components/Page/Home/v3/TrustLogosV3.tsx (data-testid=trust-logos): "Accept payments across 9 blockchains" label + 9 @iconify cryptocurrency-color chain glyphs (btc/eth/sol/xrp/trx/ltc/doge/bch/matic = the 9 real settlement chains, accurate to the label). Wired in Home/index.tsx directly under <HeroPlayground/> (dynamic import). i18n key v3.trust.label ×6 locales.
(2) CHECKOUT STORY ANIMATION — rewrote ProductShowcaseV3.tsx from two static phones to ONE auto-cycling phone (setTimeout state machine STEP_DURATION=[2200,2000,3200], loops 0→1→2): step0 "Awaiting payment" (amber dot) + step1 "Confirming on-chain…" (indigo pulsing dot) on checkout.png, step2 "Payment confirmed" (green check) cross-fades to success.png. Floating glass status chip (data-testid=showcase-status) bottom-center, 3 progress dots, caption. Honours prefers-reduced-motion (pins to confirmed). Images object-fit cover center-top (checkout 960x1880, success 960x1800). i18n v3.showcase.step0/step1/step2/caption/captionSub ×6. VERIFIED cycling via inner_text poll: 3 distinct states rotate.
(3) DARK-MODE TERMINAL CONTRAST — DeveloperBandV3.tsx terminal card bg was hardcoded #0B0B0F = exactly OBSIDIAN (s.bg in dark) so it vanished into the section. Now s.dark ? "#17171F" + indigo border rgba(129,140,248,0.22) + glow shadow : original #0B0B0F. CompareV3 re-verified in dark (already theme-aware via useAurora, legible) — no change needed. i18n injector was /tmp/inject_i18n3.py (executed; non-persistent — copy re-derivable from langs/locales/*/landing.json).
FILES: Components/Page/Home/v3/{TrustLogosV3.tsx(new),ProductShowcaseV3.tsx(rewritten),DeveloperBandV3.tsx}, Components/Page/Home/index.tsx, langs/locales/{en,es,pt,fr,de,nl}/landing.json. SAFE MODE intact (LIVE prod DB, no writes).
FOLLOW-UP (same session): ProductShowcaseV3 got two more picks — (a) HOVER PAUSE: onMouseEnter/Leave on the phone wrapper sets `paused`, which freezes BOTH the step-advance setTimeout and the elapsed-timer setInterval (verified: status+timer frozen 3s on hover, resume on leave). (b) CONVERSION-PROOF TIMER BADGE (data-testid=showcase-timer, top-center glass chip, AccessTimeRounded): counts 0:0X up while awaiting/confirming, freezes green-bordered as "Settled 0:04" on confirm, resets to 0:00 each loop (verified via inner_text poll). New i18n v3.showcase.settled ×6 (injector /tmp/inject_settled.py, non-persistent; t() has defaultValue "Settled"). tsc 0. -->
<!-- 2026-06 (fork): COIN-SWAP STORY — DONE + VERIFIED (screenshot + status poll, tsc 0). ProductShowcaseV3 story extended from 3→4 steps to SHOW the auto-convert choice: awaiting → confirming → AUTO-CONVERTING TO USDC → confirmed (STEP_DURATION=[2000,1900,2600,3000], loops %4, 4 progress dots). New step 2 dims the checkout screenshot and overlays a white glass coin-swap card (data-testid=showcase-swap): "AUTO-CONVERTING" eyebrow + @iconify cryptocurrency-color eth→usdc icons, "0.004376 ETH" ↓(animated swapNudge arrow)↓ "52.50 USDC", note "Keep the coin or auto-convert — your choice". Status chip gets a 4th violet(#7C5CFF) pulsing entry; timer keeps counting through convert, still freezes on confirm(step3). New i18n v3.showcase.stepConvert/swapTitle/swapNote ×6 (injector /tmp/inject_swap.py, non-persistent; all t() carry English defaultValue). VERIFIED: 4 distinct status states rotate incl. "Auto-converting to USDC"; swap card renders ETH→USDC with the note; es reads correctly. -->



<!-- 2026-06 (fork, pod 87e6bc11): WEBHOOK DELIVERY REDESIGN → ADDITIVE + PER-URL BREAKER + MANUAL TOGGLE — DONE + VERIFIED.
ROOT CAUSE of the missed webhook (the $26 BTC Hostbay payment): callMerchantWebhook used a FIRST-MATCH-WINS URL cascade AND a company-wide kill switch — a dead company/API-key webhook.site URL tripped tbl_company.webhook_disabled=TRUE, which then skipped ALL delivery, including valid per-request URLs on OTHER payments.
FIX (user approved "yes to all" on scenarios A-E, additive matrix confirmed):
  • NEW backend/webhooks/webhookTargets.ts::resolveWebhookTargets() builds an ADDITIVE, URL-deduped target list: per-request webhook_url + payment-link webhook/callback + company webhook (or active API-key webhook as company-level fallback). Every distinct URL receives the event; same URL never hit twice (per-request secret wins on collision).
  • backend/webhooks/index.ts callMerchantWebhook rewritten: the company-wide webhook_disabled flag NO LONGER kills all delivery — it only SUPPRESSES the company URL; per-request/link URLs always fire. Aggregate result = success if ANY target delivered (stops outbox retry-storm double-delivery); else surfaces first error (permanent-skip left alone, transient retried). Opt-in event subscription gate unchanged.
  • callUrlWithPayload gained isCompanyUrl param → the DB auto-disable (tbl_company.webhook_disabled) now only trips for the COMPANY url; a failing per-request URL relies on the existing per-URL Redis breaker (webhook-disabled:<url>) and can never disable the whole company.
  • PERSISTENCE (Scenario A): migration 0017_txn_webhook_secret adds nullable tbl_user_transaction.webhook_secret (already had webhook_url+callback_url). paymentController.addPayment now fire-and-forget persists webhook_url/callback_url/webhook_secret on the txn row; resolveWebhookTargets reads them back (WHERE id=user_tx_id) as a durable fallback if the Redis session expired. Additive/idempotent migration applied to LIVE prod DB (1 applied, 16 present).
  • MANUAL TOGGLE (Issue 3): NEW POST /api/company/webhook-disable/:id (companyController.disableWebhook, sets webhook_disabled=TRUE reason 'Manually paused by merchant'); re-enable reuses existing /webhook-reenable/:id. Frontend Components/Page/API/WebhookConsoleSection.tsx: MUI Switch data-testid=webhook-delivery-toggle at top of Webhooks settings (/developer-keys → Webhooks tab); ON→reenable, OFF→disable; the red disabled banner now branches copy for manual-pause vs auto-404. api/endpoints.ts += company.webhookDisable.
VERIFIED: backend reversible harness /app/backend/scripts/verify_additive_webhook.ts S1-S4 ALL PASS (S1 company-disabled→per-request still delivered; S2 additive both; S3 dedupe once; S4 per-request 404s don't set company flag) with exact company_id=1 state restore. Frontend testing_agent iteration_108 = 100% (5/5): toggle ON/OFF network 200s, banner+subtext+copy correct, persists across reload; dashboard Recent payments exact 2-decimal fiat confirmed. BE+FE tsc 0; file-size gate OK (new files <500). company_id=1 prod webhook state RESTORED exactly (webhook_disabled=TRUE, original auto-404 reason).
ALSO FIXED (fork setup misconfig): /app/.env NEXT_PUBLIC_BASE_URL was set to https://dynopay.com (would make the preview browser call PRODUCTION's API, bypassing SAFE MODE) → set to EMPTY so browser uses relative /api → local backend :8001 (prod DB, jobs off). THIS POD's preview host: https://kendra-vault.preview.emergentagent.com (ignore older dynopay-preview-15 URL).
NOTE: testing_agent added test-only attrs to Components/UI/Toast/index.tsx (data-testid=app-toast, data-severity) — benign. -->



<!-- 2026-08-31 (fork, pod 0e5cc9c0): WEBHOOK AUTO-DISABLE RECOVERY UI — DONE + VERIFIED (screenshot E2E). ANOMALY (from the DO-log trace of payment 6bfc858b): the payment settled fully, but the merchant's (company_id=1 Hostbay) webhook.site endpoint returned 5x HTTP 404 → backend auto-disabled webhook delivery (tbl_company.webhook_disabled=TRUE). The disable/re-enable machinery was ALL already built server-side (utils/webhookRetry.ts circuit breaker + 404-counter path; POST /company/webhook-reenable/:id clears DB flag + Redis keys webhook-404-failures/webhook-disabled/webhook:cb; GET /company/webhook-settings/:id already returns webhook_disabled/_at/_reason) but NO frontend surfaced it → merchant had no way to notice or recover. FIX (frontend only, no prod writes / schema / API changes): api/endpoints.ts adds company.webhookReenable(); Components/Page/API/WebhookConsoleSection.tsx now reads webhook_disabled/_at/_reason into disabledInfo, renders a red 'Webhook delivery is turned off' banner (disable time + monospace reason + red 'Re-enable' button, testids webhook-disabled-banner / webhook-disabled-reason / webhook-reenable-btn) at the top of both the Webhooks + Events views, and POSTs the re-enable endpoint. VERIFIED: FE tsc 0; reenable w/o auth → 403 CSRF (mounted+protected); GET settings/1 → webhook_disabled=true; logged-in screenshot shows banner with live 404 reason + button. Did NOT click Re-enable (no prod write): the webhook.site URL is still dead, so re-enabling before the merchant fixes the URL would just re-trip — the banner instructs fix-URL-then-re-enable. SAFE MODE intact. -->



<!-- 2026-08-31 (fork, pod 9a70e7ed): FILE-SIZE GATE FIX (Save-to-GitHub blocker) — DONE + VERIFIED. Pre-commit gate backend/scripts/check-file-size.mjs blocks NEW backend .ts files > 500 lines. backend/controller/teamController.ts had grown to 515 (from the accept-notification work). FIX: extracted the notifyInviteAccepted helper into a NEW module backend/controller/team/teamNotifications.ts (65 lines); teamController.ts now 460 lines. Pure refactor, behavior unchanged. testing_agent iter_107 = 100% backend PASS (login, invite, invite-info, /api/team/accept, owner team_member_joined notification, team.accept audit row, cleanup) — refactor preserved behavior, no regressions. Also HARDENED the regression suite the testing agent created (backend/tests/test_team_accept_regression.py): removed the hardcoded live merchant password + pod URL — now reads TEAM_TEST_OWNER_EMAIL/PASSWORD/BASE_URL from env and skips when unset (6/6 pass with env creds). ALL THREE commit gates now GREEN: file-size PASS, secrets PASS, preflight-tsc PASS. NOTE: the file-size gate only covers backend .ts; frontend .tsx / JSON locales are NOT line-gated, and GitHub itself only rejects >100MB blobs — so the grown TeamSettingsSection.tsx and common.json files are fine to commit. The long 'legacy file grew' list from the gate is non-blocking baseline drift (pre-existing, not from this session). All test members revoked (Team panel empty). SAFE MODE intact. -->


<!-- 2026-08-31 (fork, pod 9a70e7ed): ACCEPT NOTIFICATION + ACTIVITY-LOG LOCALIZATION — DONE + VERIFIED E2E. (1) ACCEPT NOTIFICATION: when an invitee accepts, the business OWNER is alerted. backend/controller/teamController.ts acceptInvite now calls new notifyInviteAccepted() (best-effort, never throws) per joined company -> (a) in-app notification via createNotification(ownerId, NOTIFICATION_TYPES.TEAM_MEMBER_JOINED='team_member_joined', 'A teammate joined', '<who> accepted your invite and joined <company>.'); (b) append-only audit row action='team.accept' desc 'Joined the team' attributed to the member; (c) owner email sendTeamMemberJoinedEmail (new in services/email/companyEmails.ts, English, emailShared helpers) — SUPPRESSED in preview via DISABLE_OUTBOUND_EMAIL, sends in prod. VERIFIED E2E over HTTP: invite->accept created the owner notification + the team.accept activity row + email fired-and-suppressed (log 'SUPPRESSED ... subject=Join Tester joined The Dev Store'). (2) ACTIVITY-LOG LOCALIZATION: added a nested activityLog.* block (26 action keys: company.*/team.*/apikey.*/wallet.* incl. new team.accept) to all 6 common.json locales via scripts/inject_team_i18n.py. TeamActivityPanel.tsx now renders t(`activityLog.${r.action}`, {defaultValue: r.description||r.action}) so verbs read natively, and swapped its hardcoded relTime for the shared localized useRelativeTime() hook. VERIFIED via Playwright (EN account): rows show 'Joined the team' / 'Invited a team member' / 'Removed a team member' (NOT raw action keys). FE tsc 0, BE tsc 0; check-i18n reports zero missing for the new keys (only 2 pre-existing intentional EN-only keys remain). All test members revoked (Team panel empty); audit rows persist by design. SAFE MODE intact. -->


<!-- 2026-08-31 (fork, pod 9a70e7ed): TEAM i18n FULL LOCALIZATION + INVITE-EXPIRY HINT — DONE + VERIFIED. (A) INVITE EXPIRY HINT: listMembers (backend/controller/teamController.ts) now returns expires_at (= invite_expires_at); TeamSettingsSection.tsx shows a ScheduleRounded chip (data-testid=team-invite-expiry-<id>) next to the resend button on invited rows — 'Expires in {{days}} days' / 'Expires within a day' / 'Expired' (warning color when <=2 days, error when expired). Verified via Playwright: 'Expires in 3 days'. (B) FULL i18n: the ENTIRE Team panel + accept-invite page are now translated in all 6 locales (en/es/pt/fr/de/nl). Added complete team.* (47 keys) + acceptInvite.* (23 keys) blocks to every langs/locales/*/common.json via persistent injector scripts/inject_team_i18n.py. accept-invite.tsx wired to useTranslation('common') (was 100% hardcoded English) — every visible string + interpolations (invitedByTitle {{name}}, joinLine {{companies}}/{{role}} with role word localized, expiry {{days}}/{{date}}, resend/revoke {{email}}) now t()-driven with English defaultValue fallback. Interpolation vars renamed off i18next's reserved `count` (permCount->{{num}}, expiresInDays->{{days}}) to avoid plural-key pitfalls. VERIFIED: FE tsc 0, BE tsc 0; check-i18n reports ZERO missing for the new keys (only 2 pre-existing intentional EN-only keys remain: apiScreen.currency.baseCurrencyHelper, settingsPage.viewOnly); German render proven on the public accept-invite page ('Du wurdest von Hostbay eingeladen', 'Tritt The Dev Store als Mitglied bei.', 'Passwort vergessen? Setze es auf der Anmeldeseite zurück.'). NOTE: the logged-in Team panel renders in the merchant's ACCOUNT language (reconcileLanguageOnAuth), not localStorage/?lang — translations are present + correct (same common.json namespace proven via the accept page). All test invites revoked (Team panel empty). SAFE MODE intact. -->


<!-- 2026-08-31 (fork, pod 9a70e7ed): TEAM UX ENHANCEMENTS x3 — DONE + VERIFIED (self-tested via Playwright E2E, all pass, cleanup done). All in Components/Page/Settings/TeamSettingsSection.tsx (frontend only; reuses existing team APIs). (1) SELF-INVITE GUARD: owner's own email (resolved from redux userReducer.email/profile.email with useTokenData() JWT fallback so it works even on hard refresh) — typing it shows an inline error hint (data-testid='team-self-invite-hint') + disables submit (team-dialog-submit); submit() also guards with a toast. Verified: hint+disabled on self, gone+enabled on a different email. (2) PENDING INVITES RESEND: invited-status rows now show a Send-icon 'Resend invite link' button (team-resend-<id>) that re-POSTs /team/invite (backend upserts by company+email -> refreshes the token, old link dies) and opens a copyable dialog (team-resend-dialog / team-resend-link / team-resend-done). Verified: fresh tokened link, differs from original. (3) READ-ONLY PRESET: a 'Read-only (view only)' quick-preset button (team-preset-readonly) in the invite/edit permissions section sets perms = every view_* key true, all manage_* false, role=member. Verified: view_dashboard/view_transactions/view_wallets ON, all manage_* OFF. FE tsc EXIT 0. New i18n keys use t() defaultValue (English), matching existing team.* pattern. Preview: https://kendra-vault.preview.emergentagent.com -->


<!-- 2026-08-31 (fork, pod 9a70e7ed): RBAC Task D MEMBER UX POLISH — DONE + VERIFIED. Backend A2/B/C1/C2 already shipped+verified (invoices 403 gate fix retested 15/15). This session finished the remaining Task D frontend polish: (1) team-member REVOKE now uses a proper MUI confirmation dialog (Components/Page/Settings/TeamSettingsSection.tsx: revokeTarget/revoking state + performRevoke; testids team-revoke-dialog / team-revoke-cancel / team-revoke-confirm) replacing the native window.confirm — testing_agent iter_106 verified BOTH cancel + confirm paths incl. 'Access revoked.' toast. (2) accept-invite existing-account branch (pages/auth/accept-invite.tsx) now shows a 'Forgot your password?' hint -> MuiLink data-testid='accept-invite-forgot-password' -> router.push('/auth/login') — self-verified via direct Playwright against LIVE preview (existing-account email onarrival21+dtest1788137435@gmail.com whose email_has_account=true: link present, text 'Reset it on the login page', click navigates to /auth/login; new-account branch correctly shows NO hint + password field). (3) member dashboard onboarding chrome already hidden (pages/dashboard.tsx isMember gates OnboardingFlow/AutoClaimHandle/ClaimHandleBanner) — testing_agent confirmed no onboarding wizard on member first-load. FE tsc EXIT 0. Full FE E2E testing_agent iter_106 = 7/8 (the 8th, existing-branch hint, was a test-data limitation which I then verified myself). ALL test invites/members revoked (Team panel empty). SAFE MODE intact (bg jobs off, email off). Preview: https://kendra-vault.preview.emergentagent.com -->


<!-- 2026-06 (fork) SESSION: Team/RBAC follow-ups shipped + accept-flow fixes. (1) Owner-only lockdown on payout-wallet + delete/revoke API-key (requireCompanyOwnerBy). (2) Member UI gating: CompanyDataContext exposes can()/isMember/memberRole; NewSidebar disables ungranted nav w/ tooltip; CompanySelector 'Member' badge + hidden edit pencil. (3) Currency UX: 'Settlement currency' + confirm modal; display currency 'View only' chip. (4) Team Activity Log: migration 0016 tbl_team_activity + auditMutations middleware + GET /api/team/activity + TeamActivityPanel. Fixes from testing_agent iters 103-105: CSRF-exempt /api/team/accept; encodeURIComponent login email; MEMBER DATA SCOPING — validateCompanyOwnership now allows active members & returns owner-as-effective-user so members see the OWNER's dashboard/chart/KPIs/transactions (verified member==owner over HTTP; 403 for non-granted). A1 DONE: accountProvisioning afterCreate hook honours skipAccountProvisioning; acceptInvite passes it -> invitees get NO stray personal company (verified OWNED_COMPANIES=0, defaults to granted business, no onboarding). DEFERRED (user chose A1 only): A2 getFeeTiers owner-remap (member sees $0/Starter); B full effective-owner across wallets/keys/customers/invoices/etc.; C1 API-key creation owner-only; C2 manage_team escalation guards; C3 revoke UI refresh; D onboarding chrome for members + revoke MUI confirm. Details: REFACTOR_STATUS.md (top). -->


<!-- 2026-06 (fork): RBAC PHASE 3 — MEMBER ACCESS ENFORCEMENT — DONE. Team Members/RBAC is now end-to-end: invited+accepted teammates can VIEW/OPERATE the owner's business per granted permissions; sensitive actions stay OWNER-ONLY. Backend-only: (1) companyController.getCompany returns owned + active-member companies with additive is_member/member_role/member_permissions flags; (2) authMiddleware.companyOwnershipMiddleware now allows owner OR active member (owner path byte-identical, attaches res.locals.membership); (3) companyRouter gates each route with requirePermission(key) and deleteCompany with requireCompanyOwner. Verified reversible harness scripts/verify_rbac_phase3.ts = 12/12, cleanup 0 rows; tsc/file-size/secrets gates all 0; SAFE MODE intact. Also fixed a Save-to-GitHub blocker this session: backend/services/referralService.ts was 501 lines (1 over the 500 cap for non-baselined files) -> removed a stale noise comment -> 499 lines, pre-commit file-size gate now EXIT 0. Details: REFACTOR_STATUS.md (top). FOLLOW-UP (Phase 4b, frontend): company-switcher + permission-aware UI hiding for members. -->


<!-- 2026-06 (fork): FULL PLATFORM FEATURE-COMPLETENESS AUDIT written to memory/FEATURE_COMPLETENESS_AUDIT.md — read-only runtime sweep (40 pages / 30 routers / ~374 routes) + flag/dormant-path map. Verdict: production-shaped, no significant half-built features; launch checklist = (a) prod-leader money-path validation, (b) flag decisions (Crypto Refunds dark in prod, Ledger shadow-mode), (c) confirm Flutterwave for subscriptions. No writes made to the live account. -->

<!-- 2026-06 (pod eddcc06a): Performance pass SHIPPED — 10 approved fixes B1-B4 (login defer, email-verified via Redis cache, single-round-trip fire-and-forget cache writes, walletRead Promise.all) + F1-F6 (dashboard waterfall collapse, SWR localStorage persistence, bundle-analyzer wired, useUsdRates dedupe, /dashboard route prefetch, Unbounded font diet). SAFE MODE + money-math untouched. Validated: testing_agent 100% (7/7), /app/test_reports/iteration_99.json. Details: memory/CHANGELOG.md (top). -->


# EARNINGS CALCULATOR — PAYOUT MODE TOGGLE (2026-06 fork) — DONE (FE tsc 0; SSR verified)

Added a "Get paid as" segmented toggle to Components/Page/Referrals/ReferralEarningsCalculator.tsx (/referral-program): Fee credit ↔ USDT cash-out. Amounts stay IDENTICAL (same 25% of fees — honest); only the delivery note swaps:
- credit → "Applied automatically to lower your own Dynopay fees — no action needed."
- cashout → "Cashed out to your USDT (TRC-20) wallet, on your schedule."
testids: referral-calc-mode-credit, referral-calc-mode-cashout, referral-calc-mode-note. Default = credit.
i18n: public.calcMode* ×6 (injector /tmp/inject_calc_mode_i18n.py, non-persistent). check-i18n clean (only pre-existing EN-only currency.baseCurrencyHelper).
VERIFIED: FE tsc EXIT 0; SSR renders both toggle buttons + label + default note. Trivial useState swap mirroring the already-100%-verified copy-toggle pattern (iteration_102) → self-tested (no separate testing_agent run).



# REFERRAL: ACCRUAL EMAIL + EARNINGS-CARD NAME + PUBLIC SHARE BAND (2026-06 fork) — DONE (FE+BE tsc 0; testing_agent iter_102 100%; reversible harnesses pass)

Three user-picked referral features:

1) ACCRUAL ALERT EMAIL (new). backend/services/email/referralEmails.ts → `sendReferralAccrualEmail(email,name,newCommissionUsd,merchantName,unpaidBalanceUsd)`. Hooked in referralCommissionService.ts `accrueActiveReferralCommissions` batch loop: after per-referral delta = accrueReferralCommission(referral), if delta>0 → look up referrer email/name + referred merchant name → send. Kept OUT of accrueReferralCommission so the accrual harness stays side-effect-free. Fires on the leader/prod cron only (OFF here in SAFE MODE). VERIFIED: scripts/verify_accrual_email.ts → mailTransporter SUPPRESSED it (DISABLE_OUTBOUND_EMAIL=true) with subject "You just earned $1.23 in referral rewards" — no real Brevo send; BE tsc 0.

2) EARNINGS CARD → MERCHANT NAME (was "#id"). referralCommissionService.getReferrerCommissionSummary now includes `{ model User as 'referred_user' }` and returns referred_name/referred_email per referral. Frontend pages/referrals.tsx breakdown row (~L774) shows referred_name || referred_email || "Referred merchant #id". VERIFIED: scripts/verify_referred_name_reversible.ts (imports models/associations) → summary row referred_name="Hostbay", email present; cleanup 0 rows. FE tsc 0.

3) PUBLIC SHARE BAND on /referral-program (new). Components/Page/Referrals/ShareProgramV3.tsx — WhatsApp/Telegram/X one-tap + copy-link. Logged-out shares `${origin}/referral-program`; logged-in (localStorage token) lazy-fetches /referral/my-code and shares THEIR referral_link. testids: referral-share-program / -whatsapp / -telegram / -x / -copy. i18n public.share* ×6 (injector /tmp/inject_share_i18n.py, non-persistent). VERIFIED: testing_agent iteration_102 = 100% (correct wa.me/t.me/twitter hrefs w/ encoded program URL, copy→"Link copied", no overflow, dark mode, page unbroken).

NOTE (existing, not rebuilt): the logged-in /referrals dashboard ALREADY had WhatsApp/Telegram/X share (shareTo) + a per-merchant commission breakdown — so this batch only added the NEW email, the name polish, and the PUBLIC-page share band.
Audit/harness scripts kept in backend/scripts/: verify_referral_accrual_basis.ts, verify_autoconvert_accrual.ts, verify_accrual_email.ts, verify_referred_name(_reversible).ts.



# REFERRAL MATH END-TO-END AUDIT + AUTO-CONVERT ACCRUAL FIX (2026-06 fork) — DONE (backend tsc 0; reversible harness 5/5; live read-only audit)

User asked to ensure ALL referral math is correct end-to-end, incl. auto-converted payments crediting the referrer.

AUDIT (read-only vs LIVE prod DB — new probe scripts/verify_referral_accrual_basis.ts):
- ✅ NORMAL (keep-crypto) settlements: accrual formula `(transaction_fee+fixed_fee)×usd_value/base_amount ×rate` is CORRECT — verified on all 428 real settled rows. transaction_fee stores the FULL platform fee (%+$1 fixed) in crypto; base_amount = net crypto; usd_value = USD of net → ratio is the exchange rate → referrer accrues exactly 25% of the real fee.
- ✅ Credit/payout accounting (accrued/paid/credited, oldest-first, double-spend guard, refund clawback): correct (existing verify_referral_scenarios.ts).
- NOTE: `fixed_fee` column is always 0 on real rows — harmless, because transaction_fee already includes the fixed component (formula's +fixed_fee is dead/defensive).

BUG FOUND + FIXED — auto-convert settlements (backend/controller/payment/settlement/chainVerification.ts):
- ROOT CAUSE: when auto-convert is on, code merges the merchant payout INTO adminAmountToSend and zeroes userAmountToSend (for the Binance sweep, lines ~627-628). The zero-payout settlement write (`else` branch ~1240) then stored transaction_fee = adminAmountToSend (= fee + WHOLE merchant payout) and never rewrote base_amount (kept the fiat creation value). So the referral accrual basis for auto-converted payments was garbage (coin-price-dependent over/under-count).
- IMPACT WHEN FOUND: ZERO — 2 companies have auto_convert_enabled but NO auto-converted payment has ever settled (0 rows in the by-flag aggregate).
- FIX: in the `else`/auto-convert write, record the row like the normal path using pre-merge captures — `transaction_fee = adminFeeForConversion` (fee only), `base_amount = originalUserAmount` (merchant NET crypto), `usd_value = convertToUSD(originalUserAmount)`. Under-threshold case (also hits this branch) left UNCHANGED. NO on-chain fund routing changed — only the persisted bookkeeping fields (also fixes the merchant's own fee display/invoices for auto-convert).
- VERIFIED: backend tsc EXIT 0; new REVERSIBLE harness scripts/verify_autoconvert_accrual.ts feeds a simulated auto-convert DOGE row (net 1000 / fee 15 / USD(net) $100) through the REAL accrueReferralCommission → credits $0.38 (25% of true $1.50 fee), NOT the old-broken $253.75; reward row + referrer referral_bonus_earned synced; full cleanup (scratch user 70, ref_left 0, tx_left 0, bonus restored). Backend restarted clean (listening 3300, SAFE MODE).
- SHIP: settlement code only runs on real on-chain payments (leader/prod, off in preview) → needs prod deploy to take effect; real on-chain auto-convert validation happens in prod.



# REFERRAL EARNINGS CALCULATOR (2026-06 fork) — DONE (testing_agent iteration_101 = pass, tsc EXIT 0)

Interactive earnings estimator added to /referral-program (user picked this next-action item).
- NEW Components/Page/Referrals/ReferralEarningsCalculator.tsx — MUI Slider (min $1k / max $500k / step $1k, default $50k) → live stat cards: their monthly fees, you earn/month, total over 12 months. Fee tiers MIRROR pages/fees.tsx exactly (flat by tier: <10k 1.5% · <100k 1.0% · <500k 0.7% · else 0.5%); referrer earns 25% for 12mo. Replaces the old static "$50k → ~$187" example block in pages/referral-program.tsx.
- testids: referral-example (container), referral-calc-slider, referral-calc-volume, referral-calc-their-fee, referral-calc-monthly, referral-calc-total.
- i18n: public.calc* labels (calcEyebrow/calcVolumeLabel/calcTheirFee/calcYouEarnMonthly/calcYouEarn12mo) ×6 locales (reuses public.exampleNote disclaimer). Injector /tmp/inject_calc_i18n.py (non-persistent).
- ROUNDING FIX (tester LOW): you12mo now = Math.round(youMonthly)*12 so the 12-month total is always exactly 12× the displayed monthly (was rounding independently → $1k/mo showed $4/mo but $45/yr).
- VERIFIED: testing_agent iteration_101 — default $50k→fees $500/you $125/yr $1,500; all 4 tiers correct across 5 slider positions (keyboard + drag), reactive, 12× relation holds, no console errors, mobile 390x844 no overflow, dark-mode OK. tsc EXIT 0; SSR renders.



# PUBLIC REFERRAL MARKETING PAGE (2026-06 fork) — DONE (testing_agent iteration_100 = 100% frontend + SSR/tsc verified)

Preview: https://kendra-vault.preview.emergentagent.com (LIVE prod DB, SAFE MODE). Frontend tsc EXIT 0.
User approved defaults: mega-menu link under Resources · landing CTA band just before the final register CTA · sitemap+hreflang.

BUILT (frontend-only, no backend/money-path change):
- NEW pages/referral-program.tsx — Aurora design (mirrors /fees): hero (crawlable <a> CTAs → /auth/register?ref=referral_program + /auth/login), 3-step "How it works", earnings example, FAQ (Array.isArray guarded), closing <FinalCTAAurora/>. testids: referral-program-page, referral-hero-primary/secondary-cta, referral-step-1..3, referral-example, referral-faq-1..3.
- NEW Components/Page/Home/v3/ReferralCtaBandV3.tsx — landing CTA band (testids referral-cta-band / referral-cta-band-link → /referral-program), wired in Home/index.tsx between FAQCompact and FinalCTAAurora.
- ROUTING: /referral-program added to homePaths + routeKeyMap('referralProgram') in pages/_app.tsx (verified NOT caught by the /referrals private-noindex prefix).
- NAV: menuData.tsx Resources section gets a referral MegaItem (CardGiftcardRounded); HomeFooter Company column gets a "Referral program" link.
- SEO: sitemap.xml.tsx PUBLIC_PAGES + /referral-program (6 hreflang alternates + x-default confirmed).
- i18n: referrals.json `public.*` marketing block (eyebrow/hero/example/faq[] + sentence-case step1-3 marketing copy + landing band* keys) ×6 locales; pageTitles referralProgram_title(<=53c)/desc ×6; landing referralProgram label + nav.mega.referral ×6. Injector: /tmp/inject_referral_i18n.py (NON-persistent — copy re-derivable from JSONs). check-i18n clean for all new keys (only pre-existing intentional EN-only apiScreen currency.baseCurrencyHelper remains, unrelated).

VERIFIED: tsc EXIT 0; SSR curl (title "Referral Program — earn 25% revenue share · Dynopay", hero+steps+example+FAQ present, marketing step copy replaced old dashboard "Share Your Code" copy, $187 appears once, CTAs are real anchors); testing_agent iteration_100 = 100% (8/8): page in public layout, both hero CTAs, landing band placement+nav, header mega + footer nav, mobile 390x844 no overflow, light+dark, sitemap. NOTE: automated pixel screenshots blank on external preview (known Cloudflare→headless) — verified via DOM/testids + SSR.

FILES: pages/referral-program.tsx (new), Components/Page/Home/v3/ReferralCtaBandV3.tsx (new), Components/Page/Home/index.tsx, pages/_app.tsx, Components/Layout/HomeHeader/menuData.tsx, Components/Layout/HomeFooter/index.tsx, pages/sitemap.xml.tsx, langs/locales/*/{referrals,pageTitles,landing}.json.


# REFERRAL PAYOUT — TREASURY SAFETY + THRESHOLD NUDGE + AUTO-PAYOUT (2026-06 fork) — session ended after build

- **Phase A (treasury safety) — DONE + verified.** Low Binance balance now alerts ADMIN_EMAIL (throttled 3h/asset via `utils/treasuryAlert.ts` + `sendTreasuryLowAlertEmail`). Referral payouts already wait+retry (added alert); merchant conversion **withdrawals** (Phase 3) no longer burn retries / mark FAILED on a temporary shortfall — they WAIT for top-up (mirrors referral) + alert. Phase 2 (deposit/sweep) left as-is. Unit-verified (compose + Redis throttle).
- **Phase B (threshold nudge) — BUILT.** Migration 0013 applied (auto flag, configurable auto-min, nudged_at). `referralEmails.ts` (ready/auto-enabled/requested/failed). `processReferralNudges` in accrual cron; flag resets after payout. Email happy-path not E2E'd (leader-only).
- **Phase C (auto-payout) — BUILT.** OTP-gated enable / no-OTP disable, configurable min (≥$25). `POST /referral/payout/auto` + `processAutoPayouts` cron (creates pending row, no per-payout OTP → Phase-3 sends). Frontend auto toggle in PayoutCard + i18n ×6. Verified via curl (overview auto fields; enable-while-credit→400; disable→200). Happy-path write E2E NOT run (session ended); account left credit/no-address/auto-off.
- Gates: backend tsc 0, frontend tsc 0, file-size PASS, check-i18n clean. Idempotent `withdrawOrderId` on the Binance send.
- **Next session:** run the reversible auto-pay + nudge E2E on user_id 1 (read OTP from Redis), then the real Binance send validation on production.



# REFERRAL PHASE 3 + OPT-OUT + PAYOUT HISTORY (2026-06 fork) — DONE (E2E'd on live DB, restored)

- **Phase 3 execution**: idempotent `withdrawOrderId` added to `binanceService.submitWithdrawal`; execution moved to `services/referralPayoutCron.ts` (submit passes withdrawOrderId + adopts any existing Binance withdrawal for that order id before re-sending). Leader/prod cron only, OFF in preview.
- **Opt-out**: turning cash off keeps the USDT-TRC20 wallet + verification on file; re-enabling the same/saved address needs NO OTP.
- **Payout history + CSV**: `GET /referral/payout/history` + `/history/export` (text/csv), tronscan tx links; `PayoutCard` shows a "Cash-out history" list + "Download CSV", "Turn off cash-out", and a "Re-enable cash-out" block. 9 i18n keys ×6 locales.
- **Verified E2E on live prod DB** (reversible, then fully restored to credit/NULL/NULL/0 rows): opt-in saved (no OTP), opt-out (addr retained), re-enable (no OTP), seeded payouts → history + CSV correct, cleanup. tsc 0, file-size PASS, /referrals 200. REAL Binance send not run in preview (geo-blocked) — runs on prod.



# REFERRAL REVENUE-SHARE — PHASE 2 CASH-OUT (2026-06 fork) — DONE (backend verified read-only)

Preview: https://kendra-vault.preview.emergentagent.com · Login: onarrival21@gmail.com / Katiekendra123@ (LIVE prod DB, SAFE MODE, EMAIL OFF).

Opt-in USDT-TRC20 cash-out for referral revenue-share (25%/12mo). BLENDED model: fee-credit default, cash opt-in.
- Backend NEW: `services/referralPayoutService.ts` (cross-company TRON wallet reuse, OTP opt-in, OTP-gated payout request → 'pending' row [NO funds move], leader/prod Binance send+monitor), `controller/referralPayoutController.ts`, 4 routes (GET /payout/overview, POST /payout/otp|opt-in|request). MIN=env REFERRAL_MIN_PAYOUT_USDT (default $25). Reuses sendWithdrawalOTPEmail. submitWithdrawal is CRON-ONLY (OFF in SAFE-MODE preview).
- R2 fix: split Phase-1-bloated `referralService.ts` (661→465) → new `referralCommissionService.ts` (209). Save-to-GitHub unblocked.
- Frontend NEW: `Components/Page/Referrals/PayoutCard.tsx` on `pages/referrals.tsx` — Credit/Cash toggle, saved-wallet reuse picker + add-new-address OTP flow, "Cash out $X" (mode=cash+verified+≥MIN), pending status. data-testids throughout.
- Copy updated (user request): referrer reward 50%/30d → "25% revenue share, 12mo" + 42 payout keys in ALL 6 locales (check-i18n referrals clean); landing FAQ a6 rewritten ×6.
- VERIFIED (read-only per user, NO live-account writes): overview (cross-company wallet aggregated+tron-validated), all negative validations (invalid addr/no-OTP/wrong-mode→400), OTP send 200 (Redis+suppressed email), account left UNCHANGED (mode=credit). earnings regression PASS. FE+BE tsc 0; /referrals 200. NOT E2E'd: happy-path opt-in/withdraw WRITE paths + real Binance send (Binance geo-blocked + email off in preview) — code+compile verified, run on prod.




# i18n POLISH SWEEP (2026-08-29 fork, pod 202ba772) — Invoice PDF locale + Relative-time + Email subjects — DONE (verified)

Preview: https://kendra-vault.preview.emergentagent.com · Login: onarrival21@gmail.com / Katiekendra123@ (LIVE prod DB, SAFE MODE, EMAIL OFF). FE tsc EXIT 0, BE healthy.

Four user-picked i18n items completed:
1. **Invoice PDF localization** — `services/pdfService.ts` + `controller/invoiceController.ts`: 21 `invoice.*`
   label keys ×6 locales in emails.json + locale-aware dates; merchant lang via `resolveLangByEmail`.
   VERIFIED: generated real PDFs EN/DE/PT, extracted text — DE "RECHNUNG/Zwischensumme/Gesamtbetrag/Vielen Dank",
   PT "FATURA/Valor total/Obrigado" all render (accents intact). (Receipt PDF already localized.)
2. **Relative-time "X ago"** — new shared `hooks/useRelativeTime.ts` (`relativeTime.*` in common.json ×6).
   Migrated 6 hardcoded-English sites: RateFreshness, LivePaymentFeed, DonorWallV2, donationCampaign,
   NotificationPage (7-day→absolute date fallback kept), Payouts. VERIFIED: tsc 0 + i18next resolution
   proves all 6 locales incl multi-token rate format ("Kurs vor 2 Min. 5 Sek. aktualisiert" etc).
3. **Non-EN email subject sweep** — audited ~60 subjects ×5 locales; fixed 16 outliers (NL welcome MEANING
   BUG "let's make you pay"→"time to get paid"; DE welcome awkward; es→formal; pt BR→European-pt). JSON valid,
   placeholders intact. Donor/contributor family left informal (deliberate). STATIC ONLY (email OFF).
4. **FAQ A3 fee-basis** — already correct (all-time settled volume) in all 6 locales; NO change needed.

CAVEAT: external-preview screenshots blank (Cloudflare→headless timing, known); verified via PDF text
extraction + i18next resolution + FE compile/tsc, NOT device screenshots. No testing_agent run (SAFE MODE,
low-risk mechanical change). Files: see REFACTOR_STATUS.md "Next Actions" checkboxes.

---


# HOSTBAY WEBHOOK / CREDITING FIX (2026-08-29 fork) — CODE DONE, DEPLOY PENDING
- Problem: Hostbay crypto orders paid on-chain but never credited. RCA via DigitalOcean + Railway logs.
- Root cause: DynoPay's merchant re-verify endpoint GET /api/user/getCryptoTransaction/:address returned HTTP 400
  for merchant-pool addresses (pre-check queried only tbl_user_temp_address, not tbl_merchant_temp_address);
  compounded by the April-2026 removal of the terminal payment.settled webhook.
- Fix A: merchantApiRouter.ts pre-check now UNIONs both temp-address tables (VERIFIED live read-only: 200 vs old 400).
- Fix B: chainVerification.ts restores terminal payment.settled at PAYOUT_COMPLETE via deliverMerchantWebhook,
  dedup-guarded so webhookProcessor doesn't double-send. tsc clean, backend healthy.
- Pending: deploy to prod (Save to GitHub → DO auto-deploy); optional reconciliation of past uncredited orders.
- Details in CHANGELOG.md (this session, top entry).


# SEO OVERHAUL + "PAGE APPEARS SMALL" RCA (2026-08-29 fork, pod 202ba772) — DONE (tsc FE+BE 0 errors, lint 0 errors, SSR-verified)

## 1. "Landing appears small then normal" — ROOT CAUSE: prod was on the PRE-FIX build
- Verified prod dynopay.com build last-modified = 2026-08-29 14:11 GMT (deployed ~30 min before this session).


# BRAND LOGO v3 + LANDING SCROLL REVEALS + AUTO-CONVERT SAVE FIX (2026-09-04, session 30) — DONE (tsc 0, testing_agent iteration_125 PASS, follow-ups self-verified)
- Logo: "dynopay" wordmark with indigo conversion-coin "o" (2 white swap arrows). ONE generator:
  `node scripts/brand/generate-logo.mjs` → header/footer/auth SVGs, <Logo/> mark paths, favicons (+.ico),
  apple-touch tile, press kit, PDF + email PNGs. OG images regenerated. Design intent: clear, memorable,
  says "crypto → stablecoin" at a glance; legible at 134×45 and 16px.
- Landing: <Reveal/> bidirectional scroll reveals on every section below the hero (in AND out, replays on
  scroll-up), staggered cards, CSS hero load-in, SSR-visible/hydration-safe, reduced-motion aware.
- Auto-convert "icon missing" P0: root cause was Settings never enabling auto-convert (payload mismatch,
  silent). Fixed + verified on live backend (company 71 test, restored). Details in CHANGELOG 2026-09-04.
- I18N sweep part 1 (30c): register purpose picker + header/footer/banners/secure-account now translate; 22 locale
  parity gaps filled; scanner + merge tooling added. Part 2 (checkout + dashboard, ~450 strings) is IN PROGRESS.
- Landing navigation (30b): desktop section dot-rail + mobile chip bar (scroll-spy, aria-current), hero
  "Explore ↓" jump links, 6 lower-priority sections folded into the tabbed "More about Dynopay" block, section
  padding tightened → desktop page ≈31% shorter (20.6k → 14.3k px). testing_agent iteration_126 PASS.

# WALLET SECURITY + ONBOARDING PREMIUM WALLET (2026-06 fork, pod 5cde9912) — DONE (backend curl-verified, frontend testing_agent iteration_116 PASS)

## Scope (user-approved 1a/2a/3a/4a)
- 3a: Onboarding wallet step now mounts the premium WalletManagerModal (Sudo Mode + Smart Paste + Bulk Reuse)
  instead of the lightweight AddWalletModal. Added props onSaved + headerExtra to WalletManagerModal;
  OnboardingFlow passes companyId + StepIndicator and advances/celebrates on onSaved.
- 1a: Wallet Change Alerts. Any payout ADDRESS add/change now sends notifyWalletChanges():
  friendly-but-secure email with a one-tap "This wasn't me — undo & lock" button + an always-shown in-app
  notification (type wallet_changed, NOT preference-gated). Applied EVERYWHERE (4a): single add (walletOtp.verifyOtp),
  single edit (walletMutations.updateWalletWithOTP), and batch (walletBatch). Name/tag-only edits keep the old light email.
  One-tap link -> public page /wallet-security?token=... -> POST /api/wallet-security/revert-change (CSRF-exempt,
  token-authed) -> performRevert(): reverts adds (clear slot) / edits (restore prev addr+name+tag), FREEZES wallet
  changes (Redis wallet_freeze_<uid>, kills sudo session), emails "account secured" + in-app lock notice, alerts ADMIN_EMAIL.
  Freeze is enforced (403 WALLET_FROZEN) at every mutation/unlock entry point: walletOtp.validateWallet/verifyOtp,
  walletMutations.sendUpdateWalletOTP/updateWalletWithOTP, walletSudo.requestWalletSudoOtp/verifyWalletSudoOtp, walletBatch.
  Revert token stored in Redis (wallet_revert_<token>) with 7-day TTL.
- 2a: Address Sanity Check (soft, dismissible). New authed POST /api/wallet/address-sanity {address,currency}
  returns network_mismatch (instant, EVM/Tron shape vs selected chain) + has_received_funds (best-effort Tatum
  getAddressBalance/getIncomingTransactions; null = unknown -> no warning). WalletManagerModal runs it on Save and
  shows a dismissible review dialog (Save anyway / Go back). AddWalletModal shows an instant inline network-mismatch
  note (data-testid wallet-address-network-mismatch).

## New / changed files
- NEW backend: services/wallet/walletChangeAlert.ts, services/email/walletSecurityEmails.ts,
  controller/wallet/walletSecurity.ts, routes/walletSecurityRouter.ts (all <500 lines for husky size hook).
- NEW frontend: pages/wallet-security.tsx (layout="none" public page).
- Edited: walletOtp.ts, walletMutations.ts, walletBatch.ts, walletSudo.ts, middleware/csrfMiddleware.ts (exempt
  /api/wallet-security/revert-change), routes/index.ts + routes/walletRouter.ts, services/emailService.ts (export *),
  api/endpoints.ts (wallet.addressSanity + walletSecurity.revertChange), Components/UI/WalletManagerModal/index.tsx,
  Components/UI/OnboardingFlow/index.tsx, Components/UI/AddWalletModal/index.tsx.

## Verification
- Backend curl: revert bad-token -> 410 LINK_EXPIRED; malformed -> 400; sanity EVM-into-BTC -> network_mismatch high;
  valid ETH -> no_history low; missing fields -> 400. Backend boots clean (listening 3300).
- Frontend testing_agent iteration_116: public /wallet-security expired state PASS; premium manager opens + unlock gate
  PASS; network-mismatch inline warning PASS (verified via RLUSD since all 13 primary currencies already added on test acct).
- NOT e2e-tested (env constraint): full unlock->save->alert->revert chain, because OTP email is suppressed (SAFE MODE)
  and the pod is on the LIVE prod DB (must not mutate). Backend logic curl-verified instead.

## Still open / backlog (from prior handoff)
- P1 Bulk Undo (undo last batch within unlocked session); P1 Session Extend (+10 min on ending-soon banner);
  P2 Wallet Search filter; P2 Shared Address Tags ("used on X networks").


## i18n Sweep Part 2 — status (updated 2026-06, pod ca6c51ad)
- DONE: 74 missing-EN keys fixed+translated; ProductEditor, BuyButtonsSection, Payouts fully i18n; LiveBrandContent marketing copy i18n. All 6 locales complete (check-i18n.mjs green). Scan 785->671.
- P1 REMAINING (next tier "public pages/docs", ~640 strings): pages/documentation.tsx (213), how-to.tsx (22), Help&Support KB articles, API PublishableKeysSection/WebhookConsoleSection, PaymentLinksTable, SupportChatWidget, CheckoutShell/StatusStrip, FeeCalculator, refund/tip/campaign components, misc dashboard leftovers.
- Workflow to continue: wrap strings in t("ns:key",{defaultValue:"EN"}) -> python3 scripts/extract_missing_i18n.py -> (hand-add dynamic keys) -> python3 scripts/translate_missing_i18n.py -> node scripts/check-i18n.mjs.
