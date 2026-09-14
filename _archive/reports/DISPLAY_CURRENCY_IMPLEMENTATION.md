# Feature: Merchant Dashboard Display Currency (decoupled from API key)

Status: APPROVED — full-stack build. Author: E1 agent. Date: 2026-07-13.

## 1. Problem
The dashboard's display currency is currently resolved from the **API key**:
```sql
-- utils/currencyUtils.ts  COMPANY_CURRENCY_QUERY
SELECT base_currency FROM tbl_api WHERE company_id = :companyId
ORDER BY (active first, production first, newest) LIMIT 1
```
`tbl_api.base_currency` is really the *payment pricing* currency for that key. Using it for the UI is wrong: ambiguous with multiple keys, unavailable before a key exists, and changing "how I view my dashboard" shouldn't mean editing an API key.

## 2. Goal (confirmed with user)
- Let a **merchant (company-level)** view the dashboard in their chosen local currency.
- **DISPLAY ONLY** — stored data and payment pricing (`tbl_api.base_currency`) are untouched.
- Supported currencies (curated): **USD, EUR, GBP, NGN, CAD, AUD**.
- Backfill existing merchants so nobody's dashboard visibly changes on release.

## 3. Design principles
- **Canonical storage stays USD.** Transactions already carry `usd_value`. We never persist display-converted amounts.
- **Convert at read-time** for dashboard/wallet responses only.
- **Presentation vs pricing are separate concerns.** Invoices, tax reports, CSV exports, webhooks, and payment/settlement emails KEEP using the pricing currency (`getCompanyBaseCurrency`). Only the interactive dashboard/wallet views use the new display currency.

## 4. Data model
Add one column to `tbl_company`:
```
display_currency VARCHAR(3) NULL   -- e.g. 'USD','EUR','GBP','NGN','CAD','AUD'
```
- Nullable, no forced default (resolver handles fallback). Added via idempotent
  `ADD COLUMN IF NOT EXISTS` migration (safe, no table rewrite/lock on PG).
- Also added to `models/companyModels/companyModel.ts`.

### Backfill (one-time, idempotent)
For every company with `display_currency IS NULL`, set it to the company's current
API-key `base_currency` **iff** that value ∈ supported list, else `'USD'`. This keeps
each merchant's dashboard visually identical to today; they can change it in Settings.

## 5. Backend
### 5.1 Supported list + resolver (utils/currencyUtils.ts)
```
export const SUPPORTED_DISPLAY_CURRENCIES = ['USD','EUR','GBP','NGN','CAD','AUD'];
export const isSupportedDisplayCurrency = (c) => SUPPORTED_DISPLAY_CURRENCIES.includes((c||'').toUpperCase());

// NEW — dashboard display currency. Order: company.display_currency → API base_currency → USD, clamped to supported.
export const getCompanyDisplayCurrency = async (companyId): Promise<string> => { ... }
```
`getCompanyBaseCurrency` is UNCHANGED (still reads `tbl_api` — pricing currency).

### 5.2 Rate cache (utils/currencyUtils.ts, Redis)
```
// Cached USD→fiat rate (Redis, ~10 min TTL) so the dashboard is fast and we don't
// burn FastForex quota per request. Falls back to live convertToFiat on cache miss.
export const getUsdToFiatRate = async (target: string): Promise<number> => { ... }
export const convertUsdForDisplay = async (usd: number, target: string): Promise<number> => { ... }
```
Redis key: `fxrate:USD:<CUR>`; value: rate; TTL 600s. Uses existing `getRedisItem/setRedisItem`.

### 5.3 Swap display call-sites (base → display)
Change ONLY these to `getCompanyDisplayCurrency`:
- `controller/dashboardController.ts` (3): lines ~132, ~338, ~583
- `controller/walletController.ts` (4): lines ~164, ~335, ~2652, ~4314
- `controller/companyController.ts` (1): line ~764
UNCHANGED (keep `getCompanyBaseCurrency`): invoiceController, paymentAmountDisplay,
merchantPoolSweep, pendingPaymentService, webhooks.

### 5.4 Update endpoint (controller/companyController.ts + routes)
```
PATCH /api/company/display-currency   (auth, ownership-checked)
body: { display_currency: 'EUR' }
- validate ∈ SUPPORTED_DISPLAY_CURRENCIES (else 400)
- UPDATE tbl_company SET display_currency = :cur WHERE company_id = <user's company>
- return { display_currency }
GET /api/company/display-currency  -> { display_currency, supported: [...] }
```

## 6. Frontend
- Settings/Profile: a **Display Currency** dropdown (USD, EUR, GBP, NGN, CAD, AUD) showing symbol + code.
- On load: GET current value. On change: PATCH, toast success, invalidate/refetch dashboard + wallet queries so numbers re-render in the new currency.
- Uses `REACT_APP_BACKEND_URL`; no hardcoded URLs.

## 7. Rollout
1. Migration (add column) → backfill script → deploy resolver + swapped call-sites (no visible change; dashboards identical due to backfill).
2. PATCH/GET endpoints + Settings UI (merchants can now change it).
3. (Future) optional per-user override.

## 8. Testing
- Backend (deep_testing_backend_v2): GET default; PATCH to EUR/GBP → 200 and persisted; PATCH invalid (e.g. 'XYZ','BTC') → 400; dashboard/wallet endpoints reflect the new currency + symbol; invoices/payment-preview UNCHANGED (still pricing currency); 401 without auth.
- Frontend (after user approval): change currency in Settings → dashboard numbers + symbol update.

## 9. Guardrails / non-goals
- Does NOT change stored amounts, payment pricing, invoices, tax docs, exports, or webhook payloads.
- Display conversion uses live FX (cached); dashboard shows "approx" semantics — not for accounting/legal use.
