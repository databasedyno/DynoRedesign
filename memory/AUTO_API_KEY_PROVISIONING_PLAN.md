# Auto API-Key Provisioning — Execution-Ready Plan

> **Status:** Phase A ✅ (backend, 7/7 tests pass) · Phase B ✅ (frontend, manual UI verified) · **Awaiting frontend testing_agent approval**
> **Priority:** P0 · **Only remaining "Implement fully" item — SHIPPED PENDING FINAL TESTING**
> **Owner:** next agent picking this up
> **Env verified:** setup done on preview `https://crypto-checkout-init-1.preview.emergentagent.com` (backend :3300 healthy, frontend :3000 200, csrf 200, login 401 bad-creds, Railway PG + Redis + Tatum connected, background_jobs.eligible=false — see §Environment).

---

## 0. TL;DR (what we're building)

Two auto-provisioning triggers on the API-keys table `tbl_api`:

| Trigger | Result |
|---|---|
| `POST /api/company/addCompany` succeeds | Mint a restricted **`dpk_test_`** key (env=`development`, sandbox limits) |
| Merchant's **first wallet** appears on the company — via `verifyOtp` OR `copyWalletAddresses` | Mint a **`dpk_live_`** key (env=`production`), only if no live key exists yet |

Reveal / rotate / regenerate / permissions / delete stay **100% manual** (destructive/sensitive).
Net effect: sandbox key at signup + live key unlocks the moment the merchant can receive funds.

---

## 1. Execution phases (do in order)

### Phase A — Backend (do first, ship together) — ✅ DONE (session 34)
- [x] **A1. Relax dedupe in `apiController.addApi`** → per-(company, environment) instead of "1 per company". *(§3.1)*
- [x] **A2. Extract `ensureLiveApiKey(company_id, user_id, userData)` helper** in `walletController.ts` from the existing `verifyOtp` block. *(§3.2)*
- [x] **A3. Fix `verifyOtp` live-key guard** → look for `environment: 'production'` only (not "any active"). Call the helper. *(§3.2)*
- [x] **A4. Call the helper in `copyWalletAddresses`** after `invalidateWalletCache`. *(§3.3)*
- [x] **A5. Add auto `dpk_test_` key in `companyController.addCompany`** — non-fatal try/catch after `companyModel.create`. *(§3.4)*
- [x] **A6. Backend testing_agent** — 7/7 assertions PASSED (T1-T7). Session 34 verified end-to-end via `validateWalletAddress → read verified_otp from tbl_user → verifyOtp` loop for T2/T3, and `copyWalletAddresses` for T6.

### Phase B — Frontend — ✅ DONE (session 34, manual UI verified)
- [x] **B1. `pages/developer-keys.tsx`** — removed "hide Create when apiList.length===0"; per-environment gate `canCreateAnother = !hasActiveProd || !hasActiveDev`.
- [x] **B2. `Components/Page/API/ApiKeysPage.tsx`** — added banner "🔒 Live key activates after adding/reusing a wallet" (only when prod=0, dev>=1); added "Auto-Created · Sandbox" chip inline with "Active" chip on dev-env cards (Tags absolute-position collision fixed via a wrapper Box); added subtitle limits line `Max $X · currencies · sandbox mode` reading from `test_mode_restrictions`.
- [x] **B3. i18n** — `keys.liveUnlockHint`, `keys.testAutoCreatedBadge`, `keys.sandboxLimits` added in all 6 locales (en/es/fr/de/nl/pt). Full translations, `defaultValue` fallback preserved.
- [x] **B4. `next build` (from `/app`) + `sudo supervisorctl restart frontend`.** PASSED, external /developer-keys = 200.
- [x] **B5. Manual UI verification** via Playwright screenshot at 1440x900 — banner, badge, limits, create-button-hidden all confirmed for both `prod=0/dev=1` and `prod=1/dev=1` states.
- [ ] **B6. `auto_frontend_testing_agent` full sweep (accessibility + mobile 390 + regression)** — pending user approval.

### Phase C — Enhancement (optional, do after A + B ship)
- [ ] **C1. "Try your first payment" cURL card** on `/developer-keys` (test env). See §7.

---

## 2. Design decision (default chosen)

**Coexistence:** allow **1 active TEST key + 1 active LIVE key per company**.
This is the DEFAULT. Rationale:
- The currency-sync logic in `apiController` (~lines 80-109) already contemplates a company having BOTH `existingProdKey` and `existingDevKey`.
- The "only 1 active key per company" rule at `apiController.ts:147-162` is the blocker to relax.

**Alternative (1b) — "only ever 1 key":** skip company-creation test key entirely OR have the live-key creation *revoke* the test key on first wallet. Do NOT implement both auto-creations under a 1-key regime — they will fight each other. **This alt is not recommended.**

**Auto TEST key `base_currency`:** `USD` (matches live key default).

---

## 3. Implementation details (code-ready)

### 3.1 `backend/controller/apiController.ts` — relax dedupe
Line ~147-162, inside `addApi()`:

```ts
// BEFORE (lines 149-154):
const existingApiKey = await apiModel.findOne({
  where: { company_id, status: 'active' },
});

// AFTER — per-(company, environment):
const existingApiKey = await apiModel.findOne({
  where: { company_id, environment, status: 'active' },
});

// BEFORE (line ~160):
`This company already has an active API key (${existingApiKey.dataValues.base_currency} ${existingApiKey.dataValues.environment}). Use "Regenerate" ...`

// AFTER:
`This company already has an active ${environment} API key. Use "Regenerate" to get a new key, or disable the existing one first.`
```

Keep the prod `walletCount >= 1` check + currency-sync logic unchanged.

---

### 3.2 `backend/controller/walletController.ts` — extract `ensureLiveApiKey` + fix guard

**New module-private helper** (drop above `verifyOtp` ~line 2948):

```ts
/**
 * Ensures the company has an active `dpk_live_` API key.
 * Non-fatal: returns false + logs a warning if creation fails.
 * Guards on environment='production' only (allows a test key to coexist).
 */
async function ensureLiveApiKey(
  company_id: number,
  user_id: number,
  userEmail: string,
  companyName?: string,
  companyEmail?: string,
): Promise<boolean> {
  try {
    const existing = await apiModel.findOne({
      where: { company_id, environment: 'production', status: 'active' },
    });
    if (existing) return false;

    const defaultCurrency = 'USD';
    const keyData = { base_currency: defaultCurrency, company_id, adm_id: user_id, env: 'production' };
    const keyString = 'dpk_live_' + 'DYNOPAY_USER_API-' + JSON.stringify(keyData);
    const apiKey = encrypt(keyString, process.env.API_SECRET);

    const name = companyName || 'Company';
    const email = companyEmail || userEmail;
    const createdCustomer = await customerModel.create({
      id: crypto.randomUUID(),
      customer_name: name + ' admin',
      email, mobile: email,
      company_id,
    });
    await customerWalletModel.create({
      id: crypto.randomUUID(),
      customer_id: createdCustomer.dataValues.customer_id,
      wallet_type: defaultCurrency,
    });

    const secret = process.env.ACCESS_TOKEN_SECRET;
    const customerToken = jwt.sign(
      { customer_id: createdCustomer.dataValues.customer_id }, secret, { expiresIn: '30d' }
    );
    const adminToken = jwt.sign(
      { api_id: null, company_id, user_id, type: 'admin_token', environment: 'production' },
      secret, { expiresIn: '30d' }
    );

    await apiModel.create({
      company_id, base_currency: defaultCurrency, apiKey, user_id,
      adminToken: customerToken, admin_token: adminToken, withdrawal_whitelist: null,
      api_name: generateApiKeyName(),
      permissions: JSON.stringify(['payments','transactions','webhooks','wallets']),
      environment: 'production', status: 'active',
      test_mode_restrictions: null,
      request_count: 0,
      rate_limit_per_minute: 60, rate_limit_per_hour: 3600, rate_limit_per_day: 100000,
    });
    walletLogger.info(`[ensureLiveApiKey] ✅ Auto-created LIVE API key for company ${company_id}`);
    return true;
  } catch (err) {
    walletLogger.warn(`[ensureLiveApiKey] ⚠️ skipped: ${getErrorMessage(err)}`);
    return false;
  }
}
```

**Replace `verifyOtp` block at lines 3098-3183** (~85 lines) with a single call:

```ts
// Invalidate wallet cache so getWallet returns fresh data
await invalidateWalletCache(user_id);

// AUTO-CREATE LIVE API KEY (if company has no active production key)
const autoApiKeyCreated = await ensureLiveApiKey(
  company_id, user_id, userData.email,
  companyData?.dataValues.company_name,
  companyData?.dataValues.email,
);

successResponseHelper(res, 200, "OTP verified successfully!", {
  verified: true, wallet_name, company_id,
  auto_api_key_created: autoApiKeyCreated,
});
```

---

### 3.3 `backend/controller/walletController.ts` — `copyWalletAddresses` (~line 4713)

After `await invalidateWalletCache(user_id);`, before the success response:

```ts
// AUTO-CREATE LIVE API KEY if target company just got its first wallet(s)
let autoLiveKeyCreated = false;
// Only trigger if target company now has ≥1 wallet (copied or pre-existing)
if (copied.length > 0 || skipped.length > 0) {
  const target = await companyModel.findOne({
    where: { company_id: target_company_id, user_id },
    attributes: ['company_id', 'company_name', 'email'],
  });
  autoLiveKeyCreated = await ensureLiveApiKey(
    target_company_id, user_id, userData.email,
    target?.dataValues.company_name,
    target?.dataValues.email,
  );
}
// include in response:
// { ..., auto_live_key_created: autoLiveKeyCreated }
```

**Guard rationale:** `copyWalletAddresses` may skip 0 copies (all currencies pre-existed) — but if `skipped.length > 0` the wallets DO exist, so the live-key trigger is still correct.

---

### 3.4 `backend/controller/companyController.ts` — auto TEST key on `addCompany`

**New imports at top** (add to existing imports):
```ts
import { encrypt, generateApiKeyName } from '../helper';
import crypto from 'crypto';
import { apiModel, customerModel, customerWalletModel } from '../models';
// `jwt` already imported
```
*(Check exact export paths; the existing files use `../helper` for `encrypt` and `generateApiKeyName`.)*

**Insert after `companyModel.create(...)` returns `resData`** (line 246), before the email dedup block (line 269):

```ts
// AUTO-PROVISION restricted TEST key for the new company (non-fatal)
try {
  const newCompanyId = resData.dataValues.company_id;
  const existingTestKey = await apiModel.findOne({
    where: { company_id: newCompanyId, environment: 'development', status: 'active' },
  });
  if (!existingTestKey) {
    const baseCurrency = 'USD';
    const keyData = { base_currency: baseCurrency, company_id: newCompanyId, adm_id: userData.user_id, env: 'development' };
    const apiKey = encrypt('dpk_test_' + 'DYNOPAY_USER_API-' + JSON.stringify(keyData), process.env.API_SECRET);

    const companyName = data.company_name || 'Company';
    const companyEmail = data.email || userData.email;
    const createdCustomer = await customerModel.create({
      id: crypto.randomUUID(),
      customer_name: companyName + ' admin',
      email: companyEmail, mobile: companyEmail,
      company_id: newCompanyId,
    });
    await customerWalletModel.create({
      id: crypto.randomUUID(),
      customer_id: createdCustomer.dataValues.customer_id,
      wallet_type: baseCurrency,
    });
    const secret = process.env.ACCESS_TOKEN_SECRET;
    const customerToken = jwt.sign({ customer_id: createdCustomer.dataValues.customer_id }, secret, { expiresIn: '30d' });
    const adminToken = jwt.sign(
      { api_id: null, company_id: newCompanyId, user_id: userData.user_id, type: 'admin_token', environment: 'development' },
      secret, { expiresIn: '30d' },
    );

    await apiModel.create({
      company_id: newCompanyId, base_currency: baseCurrency, apiKey, user_id: userData.user_id,
      adminToken: customerToken, admin_token: adminToken, withdrawal_whitelist: null,
      api_name: generateApiKeyName(),
      permissions: JSON.stringify(['payments','transactions','webhooks','wallets']),
      environment: 'development', status: 'active',
      test_mode_restrictions: JSON.stringify({
        max_amount: 100,
        allowed_currencies: ['BTC','ETH','USDT-TRC20','TRX','LTC'],
        sandbox_mode: true,
      }),
      request_count: 0, rate_limit_per_minute: 60, rate_limit_per_hour: 3600, rate_limit_per_day: 100000,
    });
    companyLogger.info(`[addCompany] ✅ Auto-created TEST key for company ${newCompanyId}`, { user_id: userData.user_id });
  }
} catch (apiKeyErr) {
  companyLogger.warn(
    `[addCompany] ⚠️ Auto TEST key creation skipped: ${getErrorMessage(apiKeyErr)}`,
    { user_id: userData.user_id },
  );
}
```

**MUST be non-fatal** — never fail company creation because of a key mint issue.

---

### 3.5 Frontend — Developer Keys page

Files: `pages/developer-keys.tsx`, `Components/Page/API/ApiKeysPage.tsx`.

- **Create-button logic:** currently hides when ANY key exists. Change to:
  - Show "Regenerate/manage" (existing) for the environment(s) that have a key.
  - Show a subtle *info banner* — not a Create CTA — for the missing environment(s).
- **Production section info banner** (when `production_count === 0`):
  > 🔒 *Your live key activates automatically once you add (or reuse) your first wallet.*
- **Development/Test section:** badge the row "Auto-created · Sandbox" + one-line summary reading from `test_mode_restrictions`:
  > *Max $100 · BTC / ETH / USDT-TRC20 · sandbox mode*
- **Reveal / rotate / regenerate / permissions / delete** stay exactly as-is (manual, destructive).
- **i18n keys** (all 6 locales, use `defaultValue`):
  - `keys.liveUnlockHint` — "Your live key activates automatically once you add (or reuse) your first wallet."
  - `keys.testAutoCreatedBadge` — "Auto-created · Sandbox"
  - `keys.sandboxLimits` — "Max ${max} · {currencies} · sandbox mode"

---

## 4. Files touched (summary)

| File | Change |
|---|---|
| `backend/controller/apiController.ts` | Relax dedupe to per-(company, environment) *(§3.1)* |
| `backend/controller/walletController.ts` | Extract `ensureLiveApiKey`, refactor `verifyOtp`, call from `copyWalletAddresses` *(§3.2, §3.3)* |
| `backend/controller/companyController.ts` | Add non-fatal test-key mint after `companyModel.create` *(§3.4)* |
| `pages/developer-keys.tsx` | Per-environment Create logic *(§3.5)* |
| `Components/Page/API/ApiKeysPage.tsx` | Live-unlock hint + sandbox badge + limits copy *(§3.5)* |
| `langs/{en,es,fr,de,nl,pt}/apiScreen.json` (or the correct locale files under `/app/langs/**`) | Add 3 new i18n keys *(§3.5)* |

**No DB migrations required.** `tbl_api.environment` ENUM already includes both `production` and `development`.

---

## 5. Test plan

### 5.1 Backend (via `deep_testing_backend_v2`)

Use **QA accounts only** (LIVE Railway Postgres — never touch `hostbay@moxx.co`):
- `qa.empty.1782626169@dynopaytest.com / QaEmpty#2026` (no company — ideal for company-creation flow)
- `qa.onboard.1782585233@dynopaytest.com / QaOnboard#2026`

Assertions (each with SQL check against `tbl_api`):
1. **Company create → test key auto** — `POST /api/company/addCompany` succeeds; then `SELECT * FROM tbl_api WHERE company_id=? AND environment='development' AND status='active'` returns exactly 1 row; `test_mode_restrictions` JSON has `max_amount:100, sandbox_mode:true`; NO row with `environment='production'` yet.
2. **First wallet → live key auto** — verify OTP for a new wallet on that company → `SELECT ... environment='production' AND status='active'` returns exactly 1; the test key still present → **1 test + 1 live**.
3. **Idempotency** — re-run OTP verify OR wallet copy → still exactly 1 live key (no duplicates).
4. **`getApi` response** — `production_count=1, development_count=1, total=2`, `grouped.production` & `grouped.development` both non-empty.
5. **Manual add — dedupe per-env** — `POST /api/api/addApi` with `environment='production'` → 400 (duplicate). Change to `environment='development'` on a company that has NO test key → 200 (allowed). Change to `'production'` on a company that has NO live key AND has ≥1 wallet → 200 (allowed).
6. **Wallet copy → live auto** — QA account already has wallet(s); create a fresh company; `POST /api/wallet/copyWalletAddresses` from source → target; assert live key now exists on target and `auto_live_key_created: true` in response body.
7. **Non-fatal** — `addCompany` must still return 200 even if the auto-key block throws (harder to simulate; skip on prod).

### 5.2 Frontend (via `auto_frontend_testing_agent`, **ONLY after user says "yes"**)
8. Fresh QA company → `/developer-keys` shows Test key row with "Auto-created · Sandbox" badge + limits summary; Production section shows the info banner (no Create button).
9. After wallet add → live key row appears in Production; banner gone; both rows present simultaneously.
10. Reveal / rotate / regenerate / permissions / delete buttons still present, still manual, still work.
11. Mobile 390 + desktop 1440 → no overflow, badges/tooltips readable.

### 5.3 Cleanup
Delete every QA test company + its keys after the test run (destructive — via API endpoints, no direct DB writes).

---

## 6. Environment (verified this session)

- **Preview URL:** `https://crypto-checkout-init-1.preview.emergentagent.com` (=`preview_endpoint`)
- **Internal:** backend Node/TS on :3300 (proxied by Python uvicorn on :8001); frontend Next.js standalone on :3000
- **DB:** Railway PostgreSQL (LIVE PROD) `roundhouse.proxy.rlwy.net:23599 railway`
- **Redis:** Railway `nozomi.proxy.rlwy.net:15794` (LIVE PROD)
- **Safety overrides in `.env`:** `NODE_ENV=production`, `WORKER_ROLE=secondary`, `ENABLE_BACKGROUND_JOBS=false` — verified `/health` returns `background_jobs.eligible=false`.
- **Health check results:** internal :8001 `/health` = 200 (DB+Redis+Tatum connected, 9 cached prices, circuit CLOSED); frontend :3000 `/` = 200; external `/`, `/api/csrf-token`, `/auth/login`, `/api/user/login` (bad creds → 401) all pass; login page contains `google-login-btn` + `github-login-btn` + "Continue with Google/GitHub".
- **Expected quirks (do not treat as regressions):** Binance geo-blocked (WS 451) → CoinGecko/Tatum fallback; `sshpass` not installed → SSH tunnel manager disabled.
- **Deployment target (post-implementation):** DigitalOcean App Platform, app `dynopay` (id `f86b27dc-feb0-4a44-a4e9-ebd2053e0468`), repo `databasedyno/DynoRedesign` branch `New-Onboarding2`, autodeploy on push. This preview repo IS the deployed repo — changes go live after "Save to GitHub".

---

## 7. Enhancement (optional, post-implementation)

**"Try your first payment" cURL card** on `/developer-keys` (development section):
- Renders once a `dpk_test_` key exists on the merchant's company.
- Prefills the (masked) test key in a copy-paste cURL:
  ```bash
  curl -X POST https://dynopay.com/api/user/createPayment \
    -H "x-api-key: dpk_test_<MERCHANT_TEST_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"amount": 5, "currency": "USDT-TRC20"}'
  ```
- Reveal-to-copy: the actual key only appears after an explicit "Reveal" click, then re-mask.
- Show the sample `201 Created` response body inline; link to `/documentation`.
- **Rationale:** first-successful-API-call is the strongest activation signal; removing "what do I even call?" friction lifts conversion.
- **Status:** Not started. Propose after core auto-provisioning ships + backend tests pass.

---

## 8. Rollback / safety

- **Every write is idempotent:** the auto-mint blocks all check for an existing active key on the same `(company_id, environment)` before creating.
- **Every write is non-fatal:** wrapped in `try/catch`; parent operation (`addCompany` / `verifyOtp` / `copyWalletAddresses`) always returns its normal response even if key mint throws.
- **API keys are additive & reversible** in `tbl_api` (revoke via `status='revoked'`). No on-chain funds involved, no destructive DB ops.
- **Legacy companies** without a test key can still manually create one (per-env dedupe permits it).
- **If we need to revert:** simply revert the 3 backend files + 2 frontend files. Existing auto-created rows can be marked `status='revoked'` via `apiController.revokeApi`. No schema change to roll back.

---

## 9. Open questions (defaults chosen — override at kickoff)

| Q | Default | Alternatives |
|---|---|---|
| Coexistence (1 test + 1 live per company)? | **Yes** | Only-1-key (revoke test on live mint) |
| Auto TEST key `base_currency`? | **USD** | EUR / GBP / other |
| Also verify deferred frontend items (F1/F5/F10/F22 + WalletReuseSelector) this session? | Pending user | Skip — focus on API-key provisioning only |
| Clean 6 orphan `processing` journal rows in the LIVE DB? | **No** (needs explicit prod-write approval) | Yes — one-off DB write |

---

## 10. Deferred / not part of P0

- 🟡 Frontend verification of Session-30 UX fixes F1/F5/F10/F22 + WalletReuseSelector UI — never tested.
- 🔴 Cleanup of 6 orphan `processing` journal rows in the LIVE DB — needs explicit prod-write approval.
- 🟢 (Backlog) "merchant webhook failing" auto-alert feature — proposed, not started.
- 🟢 (Backlog) Merchant email/notification audit log table.
- 🟢 (Backlog / §7) "Try your first payment" cURL activation card.
- 🟢 (Backlog / Session 34 follow-up) **Enforce sandbox restrictions on the direct-wallet-add path.** `POST /api/wallet/addWalletAddress` currently creates a wallet without going through `legacyApiAuthMiddleware`, so `test_mode_restrictions.max_amount` / `allowed_currencies` do not apply on that endpoint. `verifyOtp` is the OTP-gated flow that DOES call `ensureLiveApiKey` and inherits enforcement transitively. Consider either (a) route `addWalletAddress` through the same auth middleware and gate wallet creation on sandbox-key allowlists, or (b) explicitly deprecate `addWalletAddress` in favor of the `validateWalletAddress → verifyOtp` flow for merchant-API callers. Low priority — the sandbox key still cannot create *payments* over the limits (that's enforced at the payment endpoint), so this is a defense-in-depth gap, not an exploit path.

---

## 11. Session context (fork handoff)

**Completed by earlier sessions — do NOT redo:**
- Session 30-33 UX fixes (F1/F2/F3/F4/F5/F7/F10/F12/F15/F16/F17/F22) — shipped, verified 7/7 pass in Session 33.
- Session 32 backend fixes: `services/reconciliation.ts` idempotency guard; `services/volumeTierReconciliation.ts` (`updated_at` → `updatedAt`).
- Wallet-Reuse feature backend (8/8 tests) + `WalletReuseSelector` + `AddWalletModal` UI — UI test not yet run.

**This document's feature is the ONLY REMAINING P0 from "Implement fully".**

---

## 12. How to run the plan

```bash
# From /app root:

# 1. Backend edits (Phase A, §3.1–§3.4) — use search_replace for existing files
#    Restart backend after edits:
sudo supervisorctl restart backend
tail -f /var/log/supervisor/backend.out.log

# 2. Backend testing_agent (§5.1):
#    → invoke deep_testing_backend_v2 with the assertions in §5.1 (must use QA accounts)

# 3. Frontend edits (Phase B, §3.5) — search_replace + i18n
cd /app && node_modules/.bin/next build   # ~90–120s
sudo supervisorctl restart frontend

# 4. ASK user before running frontend testing_agent (§5.2)

# 5. "Save to GitHub" → DO auto-deploys to dynopay.com
```

---

*Last refreshed: session 34 (fork continuation) · env verified green · plan is execution-ready.*
