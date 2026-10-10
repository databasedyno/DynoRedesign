# FIAT / CRYPTO DISPLAY + REFRESH AUDIT — HANDOFF (2026-06, pod a81d8386)

STATUS: NOT STARTED (analysis only begun). User asked: "analyze whether the manner in which we currently implement
FIAT currency and crypto for all types is correct and refresh correctly on UI behavior." User is NOT satisfied with this area.
Respond to the user in ENGLISH. Preview URL: https://fiat-crypto-vault.preview.emergentagent.com (same-origin /api).
Creds: /app/memory/test_credentials.md (merchant onarrival21@gmail.com, user 1 / company 1; browser UA required).
SAFE MODE on LIVE prod DB — never write real money data; mock writes in UI tests.
Frontend = PROD Next build (.next-prod, NO hot reload) — rebuild + swap after FE edits:
  cd /app && NEXT_DIST_DIR=.next-prod-new node_modules/.bin/next build && rm -rf .next-prod-old && mv .next-prod .next-prod-old && mv .next-prod-new .next-prod && sudo supervisorctl restart frontend
i18n: any new string -> all 6 locales (en/de/es/fr/nl/pt) via a script in /app/scripts/i18n/.

## STEP 0 — ask_human FIRST (questions were sent, user ended session before answering). Re-ask:
1. Analysis mode: review + fix all P0/P1 in one pass (recommended) | report only | fix only
2. Symptom seen: general / stale after payment or currency change / fiat mismatch between pages / crypto decimals inconsistent
3. Refresh policy: ~60s auto + immediate after payment/currency change (recommended) | load+focus+manual button | push/realtime
4. Rate unavailable: show last-known rate + "rate as of hh:mm", never 0 (recommended) | hide fiat | keep as-is
5. Also fix KYC "Requirements" card flash on load for verified accounts (recommended yes)

## KEY FILES
Backend: backend/helper/currencyConvert.ts (core rate engine), backend/utils/currencyUtils.ts (wrappers, getUsdToFiatRate,
  SUPPORTED_DISPLAY_CURRENCIES), backend/controller/user/preferences.ts (GET /api/user/display-currency),
  companyController get/updateDisplayCurrency (GET/PATCH /api/company/display-currency/:id), backend/server.ts:1544 + 1702 (cache cron/startup).
  currencyConvert() callers (MONEY-CRITICAL): paymentController.ts (205,526,539,968), payment/cryptoCheckout.ts (1484,1606),
  payment/feeController.ts (410,508), payment/settlement/chainVerification.ts (209,528,985,1402,1411), elementsController.ts:394.
Frontend: hooks/useDisplayFx.ts, Components/UI/DisplayCurrencySelector/index.tsx, hooks/useDashboardData.ts (redux),
  contexts/WalletDataContext.tsx (SWR wallets), Components/Page/Dashboard/v2026/command/useDashboardOverview.ts (60s SWR),
  Components/Page/Wallet/WalletTotalHero.tsx, pages/pay/index.tsx, Components/Page/Pay3Components/cryptoTransfer.tsx +
  CleanCheckoutV2.tsx (4-10s polling/SSE), Components/UI/UnderPayment|OverPayment, pages/invoices.tsx,
  Components/Page/Invoices/CollectedTaxReport.tsx, utils/money.ts, utils/locale.ts (formatWithSymbol).

## PRELIMINARY FINDINGS (verify each before fixing; severity is a first guess)
F1 [P0] Wrong fiat on rate failure: preferences.ts getUserDisplayCurrency sets rate=1 on error but still returns the brand
   currency (EUR/GBP/NGN/CAD/AUD). useDisplayFx also coerces rate<=0 -> 1. => NGN merchant could see "₦100" for $100
   (off by ~1500x) and EUR shows "€" with USD numbers. Fix: return last-known rate + rate_as_of, or fall back to USD
   symbol+code together (never mix the symbol of one currency with numbers from another).
F2 [P0] currencyConvert silent zero: processSingleCurrency returns {amount:0, transferRate:0} when all providers fail
   (comment wrongly says "rate=1"). Used in settlement/chainVerification + checkout + fee paths => a USD value could be
   recorded/displayed as 0. Audit every caller for how it handles 0 (should fail loudly or use last-known rate).
F3 [P0/P1] Precision bug: formattedAmount/transferRate use 2 decimals whenever value > 1 (fixedDecimal=false).
   Crypto targets > 1 unit (e.g. 1.23456789 BTC, 312.123456 TRX) get truncated to 2 dp. Check whether checkout quote /
   settlement amounts flow through this (cryptoCheckout.ts 1606, chainVerification 1402/1411). Precision should depend
   on the TARGET asset (fiat 2dp; crypto per-asset decimals), not on magnitude.
F4 [P1] Background cache mostly expired: cron runs every 10 min ("*/10 * * * *", server.ts:1544) but
   BACKGROUND_CACHE_TTL_MS = 180s => fallback cache is valid only ~3 of every 10 min. Comments claim 60s/120s refresh.
   Align: cron every 1-2 min OR TTL >= interval + margin (and keep a separate "stale but usable" last-known value).
F5 [P1] Cache fiat targets = USD/EUR/GBP/BRL but brand currencies = USD/EUR/GBP/NGN/CAD/AUD => NGN/CAD/AUD never pre-cached
   (always live Tatum, slower, 403-prone); BRL cached unnecessarily. Derive from SUPPORTED_DISPLAY_CURRENCIES.
   Crypto targets only ETH/BTC/TRX/LTC/DOGE — check XRP/SOL/BNB/MATIC(POL)/BCH etc. that the app supports.
F6 [P1] Cache is in-process memory (Map), not Redis — each worker/instance has its own; useDisplayFx doc claims Redis.
   Verify getUsdToFiatRate (currencyUtils) actually uses Redis 600s TTL and document truthfully.
F7 [P1] FX rate on client never refreshes in-session: useDisplayFx has revalidateOnFocus:false and no refreshInterval.
F8 [P1] Mixed state stores: dashboard stats = Redux (no polling; 4s module dedupe), overview = SWR 60s, wallets =
   WalletDataContext SWR (no interval), FX = SWR. After a payment completes, Redux stats + wallets don't refresh until
   navigation. DisplayCurrencySelector invalidates only SWR keys starting with dashboard|user/display-currency|
   company/display-currency|wallet — transactions/invoices/payouts/payment-links/settlements keys keep old currency.
F9 [P2] Fiat->fiat via Tatum uses USDT as a USD proxy (small depeg error) when FastForex is down/breaker-tripped.
F10 [P2] Comment/doc drift across currencyConvert.ts (CoinGecko "every 60s" vs Tatum primary, 10-min cron).

## PLAN (after user answers)
1. Backend correctness (F1,F2,F3,F4,F5,F6): last-known-rate store (Redis, with timestamp) used as fallback, never 0;
   return rate_as_of/is_stale in /user/display-currency; per-asset decimals; align cron/TTL; cache all supported fiats/cryptos.
   Test: curl /api/user/display-currency?company_id=1 (with UA), unit/pytest for convert precision + failure fallback.
2. Frontend refresh (F7,F8): useDisplayFx refreshInterval ~60s + focus revalidate; poll/invalidate dashboard stats +
   wallets on payment-complete events (SSE/notification) and after currency change invalidate ALL amount-bearing keys.
   Show "rate as of hh:mm" when stale. Test: change brand currency -> every page flips without reload.
3. Write findings report /app/memory/reports/FIAT_CRYPTO_AUDIT_2026-06.md and present to user.
4. KYC Requirements-card flash fix (pages/kyc/index.tsx + Components/Page/Kyc/KycRequirements.tsx loading gate).
5. Rebuild prod FE + testing_agent (both). Prev report: /app/test_reports/iteration_282.json.
