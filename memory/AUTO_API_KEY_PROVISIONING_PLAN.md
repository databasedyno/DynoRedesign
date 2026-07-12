# Auto API-Key Provisioning — Full Implementation Spec

> Status: **PLANNED — not yet implemented** (as of 2026-06, Session 33 fork)
> Owner task (P0): "Implement fully" — auto-provision API credentials for merchants.
> This document is the single source of truth so any agent can pick this up and finish it.

---

## 1. Objective (user-agreed UX)

Reduce onboarding friction for merchants integrating the Dynopay gateway:

| Trigger | Action | Key type |
|---|---|---|
| **New company created** (`POST /api/company/addCompany`) | Auto-mint a **restricted TEST key** | `dpk_test_` (environment=`development`) |
| **First wallet configured** for a company — either manually added (`verifyOtp`) OR copied via Wallet-Reuse (`copyWalletAddresses`) | Auto-mint a **LIVE key** (only if the company has no active live key yet) | `dpk_live_` (environment=`production`) |
| Reveal / rotate / regenerate / change permissions / delete | **Stay 100% manual** (destructive/sensitive) | — |

Net effect: a merchant always has a sandbox key immediately, and their live key
"unlocks" predictably the moment they can actually receive funds (they have a wallet).

---

## 2. Current state of the code (what already exists)

### Backend
- **`backend/models/apiModels/apiModel.ts`** (table `tbl_api`) — fields relevant here:
  - `company_id`, `user_id`, `api_name`, `apiKey` (encrypted TEXT), `adminToken`, `admin_token`
  - `environment` ENUM(`production`,`development`) default `production`
  - `status` ENUM(`active`,`inactive`,`revoked`) default `active`
  - `base_currency` default `USD`
  - `permissions` TEXT default `["payments","transactions","webhooks","wallets"]`
  - `test_mode_restrictions` TEXT default `{"max_amount":100,"allowed_currencies":["BTC","ETH","USDT-TRC20"]}`
  - rate limits (`rate_limit_per_minute` 60, `_hour` 3600, `_day` 100000)

- **`backend/controller/apiController.ts`**
  - `addApi()` (manual create) — builds `keyData = {base_currency, company_id, adm_id, env}`,
    prefix `dpk_live_` (prod) / `dpk_test_` (dev), `apiKey = encrypt(keyString, API_SECRET)`.
    Creates a `customerModel` + `customerWalletModel` + customer access token + admin JWT.
    Dev keys get `test_mode_restrictions = {max_amount:100, allowed_currencies:[BTC,ETH,USDT-TRC20,TRX,LTC], sandbox_mode:true}`.
    - ⚠️ **Hard rule at lines ~147-162: "Only 1 active API key per company (regardless of environment)."**
      Returns 400 if any active key already exists.
    - Prod keys require `walletCount >= 1` (line ~123-139).
    - Currency-sync logic (lines ~80-109) DOES already contemplate a company having both a
      prod key and a dev key simultaneously (`existingProdKey` + `existingDevKey`) — i.e. the
      "1 key" rule at 147-162 contradicts the sync design and is the blocker to relax.
  - `getApi()` — returns `{ all, grouped:{production[],development[]}, total, production_count, development_count }`,
    ordered `environment ASC, createdAt DESC`. Masks the key via `maskApiKey()`.

- **`backend/controller/walletController.ts`**
  - `verifyOtp()` (lines ~3098-3183) — **ALREADY auto-creates a `dpk_live_` key** after a wallet is
    verified, BUT guarded by `if (!existingApiKey)` where `existingApiKey` = any active key for the
    company (any environment). Builds the key inline (does NOT call `addApi`), env=`production`,
    base_currency `USD`, `test_mode_restrictions: null`, creates customer + tokens. Sets
    `auto_api_key_created` in the response.
  - `copyWalletAddresses()` (lines ~4628-4729) — Wallet-Reuse endpoint. Copies wallets from source
    company → target company. **Does NOT create any API key.**
  - Imports available at top: `encrypt`, `generateApiKeyName`, `crypto`, `jwt`, `apiModel`,
    `customerModel`, `customerWalletModel`, `companyModel`, `userWalletModel`, `validateCompanyOwnership`.

### Frontend
- **`pages/developer-keys.tsx`** — thin wrapper. Shows a "Create" button ONLY when
  `apiState.apiList.length === 0` (comment says "max 1 key per company"). Renders `<ApiKeysPage/>`.
- **`Components/Page/API/ApiKeysPage.tsx`** — already renders TWO sections via i18n keys
  `keys.production` (line ~1085) and `keys.development` (line ~1093), plus Publishable Keys,
  Buy Buttons, Embedded Checkout, Elements cards. So the grouped prod/dev display is already built.

---

## 3. The design conflict + resolution (DECISION REQUIRED / DEFAULT CHOSEN)

**Conflict:** The requested UX requires a company to hold **2 keys at once** (1 test + 1 live).
But `verifyOtp`'s auto-live logic only fires when there is **no active key of any kind**, and
`addApi` enforces **only 1 active key per company**. If we mint a test key at company creation,
the live key will NEVER auto-create.

**Resolution (DEFAULT — pending user confirmation, recommended = allow coexistence):**
Allow **exactly 1 active TEST key + 1 active LIVE key per company**. Concretely:
1. In `verifyOtp` and `copyWalletAddresses`, the live-key guard becomes:
   *"create a `dpk_live_` key only if the company has no active key with `environment='production'`"*
   (ignore the test key when deciding).
2. In `apiController.addApi`, relax the "only 1 active key per company" rule to
   **"only 1 active key per (company, environment) pair"** — so a merchant can still manually add
   the other-environment key if an auto one is missing, but cannot duplicate within an environment.
   Keep the currency-sync logic intact (it already assumes prod+dev coexist).

> If the user instead chooses "only ever 1 key" (option 1b), then: skip the company-creation test
> key entirely OR have the live-key creation REPLACE (revoke) the test key on first wallet. Do NOT
> implement both auto-creations under a 1-key regime — they will fight each other.

---

## 4. Implementation steps

### 4.1 Backend — auto TEST key on company creation
**File:** `backend/controller/companyController.ts` → inside `addCompany()`, AFTER
`companyModel.create(...)` returns `resData` (~line 246) and BEFORE/around the email block.

Add a non-fatal `try/catch` (mirror the email dedup pattern — never fail company creation):
```ts
// AUTO-PROVISION restricted TEST key for the new company (non-fatal)
try {
  const newCompanyId = resData.dataValues.company_id;
  const existingTestKey = await apiModel.findOne({
    where: { company_id: newCompanyId, environment: 'development', status: 'active' },
  });
  if (!existingTestKey) {
    const baseCurrency = 'USD'; // DEFAULT (see §3 Q2)
    const keyData = { base_currency: baseCurrency, company_id: newCompanyId, adm_id: userData.user_id, env: 'development' };
    const apiKey = encrypt('dpk_test_' + 'DYNOPAY_USER_API-' + JSON.stringify(keyData), process.env.API_SECRET);

    const companyName = data.company_name || 'Company';
    const companyEmail = data.email || userData.email;
    const createdCustomer = await customerModel.create({
      id: crypto.randomUUID(), customer_name: companyName + ' admin',
      email: companyEmail, mobile: companyEmail, company_id: newCompanyId,
    });
    await customerWalletModel.create({
      id: crypto.randomUUID(), customer_id: createdCustomer.dataValues.customer_id, wallet_type: baseCurrency,
    });
    const secret = process.env.ACCESS_TOKEN_SECRET;
    const customerToken = jwt.sign({ customer_id: createdCustomer.dataValues.customer_id }, secret, { expiresIn: '30d' });
    const adminToken = jwt.sign({ api_id: null, company_id: newCompanyId, user_id: userData.user_id, type: 'admin_token', environment: 'development' }, secret, { expiresIn: '30d' });

    await apiModel.create({
      company_id: newCompanyId, base_currency: baseCurrency, apiKey, user_id: userData.user_id,
      adminToken: customerToken, admin_token: adminToken, withdrawal_whitelist: null,
      api_name: generateApiKeyName(), permissions: JSON.stringify(['payments','transactions','webhooks','wallets']),
      environment: 'development', status: 'active',
      test_mode_restrictions: JSON.stringify({ max_amount: 100, allowed_currencies: ['BTC','ETH','USDT-TRC20','TRX','LTC'], sandbox_mode: true }),
      request_count: 0, rate_limit_per_minute: 60, rate_limit_per_hour: 3600, rate_limit_per_day: 100000,
    });
    companyLogger.info(`[addCompany] Auto-created TEST key for company ${newCompanyId}`, { user_id: userData.user_id });
  }
} catch (apiKeyErr) {
  companyLogger.warn(`[addCompany] Auto TEST key creation skipped: ${getErrorMessage(apiKeyErr)}`, { user_id: userData.user_id });
}
```
**New imports needed in companyController.ts:** `encrypt` (from `../helper`), `generateApiKeyName`
(from `../helper`), `crypto`, `apiModel`, `customerModel`, `customerWalletModel` (from `../models`).
(`jwt` is already imported.)

### 4.2 Backend — fix LIVE key guard in `verifyOtp`
**File:** `backend/controller/walletController.ts` (~line 3101).
Change the guard from "any active key" to "any active **production** key":
```ts
const existingApiKey = await apiModel.findOne({
  where: { company_id, environment: 'production', status: 'active' },
});
```
Everything else in that block already mints a correct `dpk_live_` key. No other change.

### 4.3 Backend — auto LIVE key in `copyWalletAddresses`
**File:** `backend/controller/walletController.ts` (~after line 4713 `invalidateWalletCache`, before the
success response). Only when at least one wallet now exists on the target company AND there's no active
production key. Factor the live-key block from `verifyOtp` into a reusable helper to avoid duplication:

**Recommended:** extract a module-private helper `ensureLiveApiKey(company_id, user_id, userData)` that
runs the exact block currently inlined in `verifyOtp` (guard on production key, mint `dpk_live_`), and
call it from BOTH `verifyOtp` and `copyWalletAddresses`. Return a boolean `created`.

```ts
// in copyWalletAddresses, after invalidateWalletCache(user_id):
let autoLiveKeyCreated = false;
if (copied.length > 0) {
  autoLiveKeyCreated = await ensureLiveApiKey(target_company_id, user_id, userData);
}
// include auto_live_key_created: autoLiveKeyCreated in the success payload
```
Guard note: `copyWalletAddresses` may copy 0 wallets (all already existed). Only trigger when the
target company actually has ≥1 wallet — safest is to re-count `userWalletModel` for the target, or
rely on `copied.length > 0 || existingCurrencies.size > 0`.

### 4.4 Backend — relax the manual "1 key per company" rule
**File:** `backend/controller/apiController.ts` (~line 149-162, inside `addApi`).
Change the duplicate check to be per-environment:
```ts
const existingApiKey = await apiModel.findOne({
  where: { company_id, environment, status: 'active' },
});
if (existingApiKey) {
  return errorResponseHelper(res, 400,
    `This company already has an active ${environment} API key. Use "Regenerate" or disable it first.`);
}
```
(Keep the prod `walletCount >= 1` check and currency-sync logic unchanged.)

### 4.5 Frontend — Developer Keys page messaging + Create button logic
**Files:** `pages/developer-keys.tsx`, `Components/Page/API/ApiKeysPage.tsx`.
- The "Create" button currently hides when ANY key exists. Update so it reflects per-environment:
  - If no LIVE key yet → show a subtle "Live key unlocks after you add or reuse a wallet" hint
    (info banner in the Production section) instead of a Create CTA.
  - If no TEST key (edge: legacy companies) → allow manual create as today.
- Add an info banner in the Production/Live section when `production_count === 0`:
  > "🔒 Your live key activates automatically once you add (or reuse) your first wallet."
- Development/Test section: badge it "Auto-created · Sandbox" with the `test_mode_restrictions`
  summary (max $100, sandbox currencies).
- Keep reveal/rotate/regenerate/permissions buttons exactly as-is (manual).
- i18n: add keys under `apiScreen` namespace (all 6 locales en/es/fr/de/nl/pt), e.g.
  `keys.liveUnlockHint`, `keys.testAutoCreatedBadge`, `keys.sandboxLimits`.

---

## 5. Edge cases / idempotency
- **Idempotent:** every auto-create is guarded by an existence check on `(company_id, environment, status='active')`. Re-running is safe.
- **Non-fatal:** all auto-create blocks are wrapped in `try/catch` and must NEVER fail the parent
  operation (company creation / OTP verify / wallet copy). Log a warning and continue.
- **Legacy companies** (created before this feature) won't have a test key — the manual Create path
  still works for them (per-environment rule).
- **Wallet copy of 0 wallets** (all currencies already existed) → do NOT create a live key unless the
  target already has ≥1 wallet (it will, since they existed) — decide: safest is trigger when target
  wallet count ≥ 1.
- **customerModel/customerWalletModel** rows are created per key (mirrors existing `addApi` behavior) —
  acceptable; they are the "API admin" pseudo-customer.

---

## 6. Test plan
### Backend (`testing_agent`, LIVE prod DB — USE QA ACCOUNTS ONLY)
Use `qa.empty.1782626169@dynopaytest.com / QaEmpty#2026` (no company) and
`qa.onboard.1782585233@dynopaytest.com / QaOnboard#2026`. **NEVER create junk on `hostbay@moxx.co`.**
1. Create a new company (QA) → assert a `dpk_test_` key exists (`environment=development`, `test_mode_restrictions` set), and NO live key yet.
2. Add + verify a wallet (or copy wallets) for that company → assert a `dpk_live_` key now exists (`environment=production`), test key still present → **1 test + 1 live**.
3. Re-run wallet add/copy → assert NO duplicate live key (idempotent).
4. `GET getApi` → `production_count=1, development_count=1, total=2`.
5. `addApi` manual create of a 2nd production key → 400 (per-env dedupe). Manual create of the missing environment when one is absent → 200.
6. Company creation still succeeds even if key mint fails (simulate by temporary bad API_SECRET — optional/skip on prod).
### Frontend (`testing_agent`, frontend only)
7. New QA company → `/developer-keys` shows Test key (auto badge) + "live unlocks after wallet" hint, no live key.
8. After wallet add → live key row appears; hint gone.
9. Reveal/rotate/permissions buttons still present & manual.
10. Mobile 390 + desktop 1440, no overflow.

**Cleanup:** delete any QA companies/keys created during testing.

---

## 7. Open questions (from planning ask_human — DEFAULTS applied in this doc)
1. **Coexistence (1 test + 1 live)?** DEFAULT = YES (allow). [confirm]
2. **Auto TEST key base currency?** DEFAULT = USD. [confirm]
3. **Run deferred frontend test of F1/F5/F10/F22 + Wallet Reuse UI this session?** [pending]
4. **Clean 6 orphan `processing` journal rows in LIVE DB now?** DEFAULT = NO (needs explicit prod-write approval). [pending]

---

## 8. Safety notes (⚠️ LIVE production environment)
- Backend connects to the user's **LIVE Railway PostgreSQL + Redis**. Keep `.env` overrides:
  `NODE_ENV=production`, `WORKER_ROLE=secondary`, `ENABLE_BACKGROUND_JOBS=false`. Do NOT remove.
- API-key rows are additive & reversible (can be revoked). No on-chain / fund movement involved.
- For any test that WRITES (company/wallet/key create), use QA accounts only. Never touch `hostbay@moxx.co`.
- This repo IS the deployed repo (`databasedyno/DynoRedesign @ New-Onboarding2`); changes go live only
  after the user pushes via "Save to GitHub" → DigitalOcean autodeploy.

---

## 9. Files to change (summary)
| File | Change |
|---|---|
| `backend/controller/companyController.ts` | + auto `dpk_test_` in `addCompany`; new imports |
| `backend/controller/walletController.ts` | fix `verifyOtp` live guard (prod-only); + `ensureLiveApiKey` helper; call it in `copyWalletAddresses` |
| `backend/controller/apiController.ts` | relax dedupe to per-(company,environment) |
| `pages/developer-keys.tsx` | Create-button logic per-environment |
| `Components/Page/API/ApiKeysPage.tsx` | live-unlock hint + test-auto badge + sandbox limits copy |
| i18n `apiScreen` (×6 locales) | new keys: `keys.liveUnlockHint`, `keys.testAutoCreatedBadge`, `keys.sandboxLimits` |
