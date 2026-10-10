# FIAT / CRYPTO DISPLAY + REFRESH AUDIT — FINDINGS REPORT (2026-06)

Scope: how fiat values and crypto amounts are converted, labelled and refreshed across the merchant app
(backend rate engine + money paths + display endpoints + frontend refresh). User decisions: fix all P0/P1 in one
pass; 60s auto-refresh + immediate refresh after payment / currency change; "rate as of hh:mm" when the live rate is
missing (never 0, never mixed symbols); money paths accept a last-known rate only if < 30 min old, else refuse / hold;
fix the KYC Requirements-card flash.

Verification: backend jest `__tests__/fxEngine.test.ts` (13) + `__tests__/merchantMoneyEvents.test.ts` (3) pass;
testing agent iteration_283 — backend 11/11 (`/app/tests/test_fiat_crypto_audit.py`), frontend 12/13 + the
13th (currency-change refresh) confirmed by a follow-up check (see "Known limits").

## Findings and fixes

| # | Sev | Finding (confirmed) | Fix |
|---|-----|---------------------|-----|
| F1 | P0 | Display endpoints did `rate = convertToFiat(...).rate \|\| 1` but kept the brand currency/symbol → on a rate outage a NGN merchant saw "₦100" for $100, EUR showed "€" + USD numbers. Same pattern in dashboard stats, chart, fee tiers, overview, payouts, brands, invoice period summary, tax report, invoice PDF/CSV, transaction CSV, wallet tx list, payout digest email. Dashboard stats even multiplied by `rate` = 0 → **€0.00 totals**. `/user/display-currency` set rate 1 on error. | New `resolveDisplayFx()` (currencyUtils) returns `{currency, rate, as_of, is_stale, fallback}`: brand currency with the live or last-known (≤24h) rate, otherwise **USD symbol AND USD numbers**. Every display endpoint above now uses it and returns an `fx` block; fallback responses are not cached. `getUsdToFiatRate` returns NaN (not 1) so a forgotten caller can't mislabel. |
| F2 | P0 | `currencyConvert` returned `{amount:0, transferRate:0}` when all providers failed; checkout, fees, settlement and Elements used it → USD value could be recorded as 0, quotes on 0/1 rates. | Component cache with last-known values + `unavailable`/`stale`/`rateAsOf` flags. Strict mode on money paths: last-known rate only if < 30 min (`MONEY_RATE_MAX_AGE_MS`), else checkout/Elements refuse the quote (503-style message) and settlement defers + retries. One settlement rate snapshot per verification. |
| F3 | P0/P1 | Precision: values > 1 were cut to 2 dp regardless of asset (1.23456789 BTC → 1.23); per-unit fiat rates read from the 2-dp `amount` (USD→EUR 0.8917 → 0.89, DOGE→EUR 0.0858 → 0.08). | Precision follows the target asset (fiat 2 dp, crypto per-asset decimals). Display/transaction paths now use full-precision `transferRate` / `getUsdPerUnit`. |
| F4 | P1 | Background cache: cron every 10 min but TTL 180 s → valid only ~3 of 10 minutes. | Cron every 2 min, cache valid for the whole interval + separate last-known store. |
| F5 | P1 | Pre-cache missed NGN/CAD/AUD (and SOL/XRP/BNB…), cached BRL needlessly. | Targets derived from `SUPPORTED_DISPLAY_CURRENCIES` + supported coins. |
| F6 | P1 | Docs claimed Redis for the FX cache; it is per-process memory. | Display rate now Redis-cached (`fxrate:v2:USD:<CUR>`, 120 s, 30 s for stale) with timestamp; comments corrected. Engine component cache stays in-process (documented). |
| F7 | P1 | Client FX rate never refreshed in a session (`revalidateOnFocus:false`, no interval); coerced rate ≤ 0 → 1 with the brand symbol. | `useDisplayFx`: effective currency/symbol from the API, 60 s refresh + focus, keeps last good value on error and flags it stale. |
| F8 | P1 | Mixed stores (Redux stats, SWR overview/wallets/FX) — after a payment nothing refreshed until navigation; currency change only invalidated `dashboard\|wallet\|display-currency` string keys (array keys for invoices/customers/wallets missed) and re-fetched Redux stats **without company_id** (all-brands aggregate). Backend caches (2–5 min) kept old totals after a payment; fee-tier cache ignored currency. Wallet hero showed the user-level currency symbol over USD numbers. | `useFiatAutoRefresh` (mounted once in the merchant shell): every 60 s while visible, on focus, on SSE `money_update`, and on `requestFiatRefresh()` → revalidates every amount-bearing SWR key in place (no blanking) + Redux dashboard / transactions with company_id. `useMoneyEventStream` reads `/api/events/stream` via fetch (Bearer token; EventSource can't send headers), reconnects with backoff. Backend `notifyMerchantMoneyChange()` (on every payment notification — even if muted — and on brand-currency change) drops the user's dashboard/overview/payouts/brands/chart/fee-tier/recent-tx/wallet/period caches and emits `money_update`. Wallet hero uses the brand rate. |
| UI | P0 | No indication when a rate is old/missing. | `FxAsOfLabel`: "Rate as of 14:05" (stale) or "Shown in USD · EUR rate unavailable" (fallback), with tooltip; on dashboard money row, wallet hero, transactions, payouts, brands, Receipts & Tax. Nothing shown when live. i18n in en/de/es/fr/nl/pt (`common.fxLabel.*`, `scripts/i18n/fx_label_i18n.py`). |
| Tax | P1 | Tax report added currencies with no rate at 1:1 into the converted total. | Those currencies are excluded and listed in `summary.unconverted_currencies`. |
| KYC | P1 | /kyc defaulted to view "not_needed" before status loaded → Requirements card flashed for verified accounts. | `useKycGate().settled`; page shows a skeleton until status resolves, then hides the card for verified accounts. |
| F9 | P2 | Fiat→fiat via Tatum uses USDT as a USD proxy when FastForex is down (small depeg error). | Not changed (documented). |
| F10 | P2 | Comment/doc drift in currencyConvert.ts. | Rewritten with the engine. |

## Known limits / follow-ups
- SSE is in-process: if the payment is settled by a different backend instance than the one holding the merchant's
  stream, the tab still refreshes within 60 s (interval) instead of instantly. A Redis pub/sub fan-out would close this.
- After a currency change, SWR keys not mounted on the current page (e.g. FX rate while on Settings) refetch the next
  time their page mounts (dedupe is cleared) — they never show the new currency's symbol with old numbers.
- Legacy `wallet/analytics` revenue endpoint still converts per row via `convertToFiat` (shows 0 when unavailable); not
  used by the current dashboard.
- `__tests__/merchantMoneyEvents.test.ts` mocks modules by absolute `/app/backend/...` path (relative mocks were not
  applied under this jest config).
