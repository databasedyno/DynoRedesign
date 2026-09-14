# Controller Refactoring Plan
**Date:** 2026-02-12  
**Priority:** HIGH (Code Quality & Maintainability)

---

## 📊 Current Controller Statistics

| Controller | Lines | Functions | Status | Priority |
|------------|-------|-----------|--------|----------|
| **paymentController.ts** | 7,914 | 43 | 🔴 **CRITICAL** | P0 |
| **walletController.ts** | 4,493 | 30+ | 🟠 **HIGH** | P1 |
| **userController.ts** | 2,158 | 15+ | 🟡 **MEDIUM** | P2 |
| companyController.ts | 1,545 | 10+ | 🟢 **OK** | P3 |
| apiController.ts | 1,382 | 8+ | 🟢 **OK** | P3 |

**Target:** < 500 lines per file (Single Responsibility Principle)

---

## 🔴 PRIORITY 1: Split paymentController.ts (7,914 lines)

### Current Responsibilities (Too Many!)
1. Payment link creation/management
2. Crypto payment processing
3. Fiat payment methods (Card, Bank, USSD, Mobile Money, etc.)
4. Payment verification
5. Payment confirmation
6. Currency conversion
7. Fee calculation
8. Tax calculation
9. Cron jobs (USDT checking, fee sweeps, incomplete payments)
10. Network fee estimation
11. Blockchain subscription management

### Proposed Split (11 files):

---

#### 1️⃣ **paymentLinkController.ts** (~600 lines)
**Responsibility:** Payment link CRUD operations

**Functions to Move:**
- `createPaymentLink`
- `getPaymentLinks`
- `getPaymentLinkById`
- `updatePaymentLink`
- `deletePaymentLink`

**Routes:**
```typescript
// Before: /app/backend/routes/paymentRouter.ts
router.post('/create-payment-link', paymentController.createPaymentLink);

// After:
router.post('/create-payment-link', paymentLinkController.createPaymentLink);
```

---

#### 2️⃣ **cryptoPaymentController.ts** (~1,200 lines)
**Responsibility:** Cryptocurrency payment processing

**Functions to Move:**
- `createCryptoPayment` (from merchant API)
- `Crypto` (user crypto payments)
- `cryptoVerification`
- `verifyCryptoPayment`
- `settleCryptoTransaction`
- `getCryptoPriceForPayment`

**Key Features:**
- Merchant pool integration
- Address reservation
- Webhook creation
- On-chain verification

---

#### 3️⃣ **fiatPaymentController.ts** (~800 lines)
**Responsibility:** Fiat payment method handlers

**Functions to Move:**
- `cardPayment`
- `bankTransfer`
- `bankAccount`
- `googleApplePay`
- `USSD`
- `MobileMoney`
- `QRCode`

**Integration:** Flutterwave SDK

---

#### 4️⃣ **paymentVerificationController.ts** (~600 lines)
**Responsibility:** Payment verification & confirmation flows

**Functions to Move:**
- `verifyPayment`
- `confirmPayment`
- `authStep` (OTP/2FA verification)
- `getLinkAccessToken`
- `getAccessToken`

---

#### 5️⃣ **paymentDataController.ts** (~400 lines)
**Responsibility:** Payment data retrieval

**Functions to Move:**
- `getData` (main payment data endpoint)
- `getBalance`
- `getConfiguredCurrenciesForCheckout`

---

#### 6️⃣ **paymentCalculationService.ts** (~500 lines)
**Responsibility:** Fee, tax, and amount calculations (MOVE TO SERVICES)

**Functions to Move:**
- `calculatePaymentAmount`
- `calculateTaxForCheckout`
- `convertToUSD`
- Helper functions for fee calculations

**Note:** This should go in `/services/` not `/controller/`

---

#### 7️⃣ **currencyRateService.ts** (~300 lines)
**Responsibility:** Currency conversion & rates (MOVE TO SERVICES)

**Functions to Move:**
- `getCurrencyRates`
- Currency conversion helpers

---

#### 8️⃣ **networkFeeService.ts** (~400 lines)
**Responsibility:** Blockchain network fee estimation (MOVE TO SERVICES)

**Functions to Move:**
- `getNetworkFees`
- Fee estimation logic

---

#### 9️⃣ **paymentCronJobs.ts** (~800 lines)
**Responsibility:** Scheduled payment operations (MOVE TO SERVICES)

**Functions to Move:**
- `checkingUSDT`
- `sweepNativeAdminFees`
- `checkFeeBalance`
- `processIncompletePayments`
- `checkOnBlockchair`
- `removeUnwantedSubscriptions`

**Note:** These are cron job handlers, should be in `/services/cron/`

---

#### 🔟 **paymentAddController.ts** (~500 lines)
**Responsibility:** Legacy payment creation (can be deprecated?)

**Functions to Move:**
- `addPayment` (appears to be legacy)
- Related helpers

**Action:** Review if still needed, consider deprecation

---

#### 1️⃣1️⃣ **paymentUtilsService.ts** (~400 lines)
**Responsibility:** Shared payment utilities (MOVE TO SERVICES)

**Functions to Move:**
- `withRetry` (generic retry wrapper)
- Common payment helpers
- Validation functions

---

### Migration Strategy for paymentController.ts:

```
Phase 1 (Week 1): Extract Services
├── paymentCalculationService.ts
├── currencyRateService.ts
├── networkFeeService.ts
├── paymentCronJobs.ts
└── paymentUtilsService.ts

Phase 2 (Week 2): Split Controllers
├── paymentLinkController.ts
├── cryptoPaymentController.ts
├── fiatPaymentController.ts
└── paymentVerificationController.ts

Phase 3 (Week 3): Finalize & Test
├── paymentDataController.ts
├── Update all routes
├── Update imports across codebase
└── Full regression testing
```

---

## 🟠 PRIORITY 2: Split walletController.ts (4,493 lines)

### Current Responsibilities:
1. Wallet CRUD operations
2. Wallet funding
3. Crypto withdrawals
4. Wallet address management
5. Exchange operations
6. Transaction history
7. Analytics
8. Fee estimation
9. OTP verification

### Proposed Split (6 files):

---

#### 1️⃣ **walletCoreController.ts** (~600 lines)
**Responsibility:** Basic wallet operations

**Functions to Move:**
- `getWallet`
- `getWalletTransactions`
- `getAllTransactions`
- `invalidateWalletCache`

---

#### 2️⃣ **walletFundingController.ts** (~800 lines)
**Responsibility:** Wallet funding via various methods

**Functions to Move:**
- `addFunds`
- `authStep`
- `verifyPayment`
- `confirmPayment`
- `verifyCryptoPayment`
- All payment method handlers (cardPayment, bankTransfer, etc.)

---

#### 3️⃣ **walletWithdrawalController.ts** (~600 lines)
**Responsibility:** Crypto asset withdrawals

**Functions to Move:**
- `withdrawAssets`
- Related validation & processing

---

#### 4️⃣ **walletAddressController.ts** (~500 lines)
**Responsibility:** Wallet address management

**Functions to Move:**
- `getWalletAddresses`
- `addWalletAddress`
- `validateWallet`
- `verifyOtp`
- `sendConfirmationOTP`
- `getTempAddressBatches`

---

#### 5️⃣ **walletExchangeController.ts** (~400 lines)
**Responsibility:** In-wallet crypto exchange

**Functions to Move:**
- `exchangeCreate`
- `getExchange`
- `confirmExchange`

---

#### 6️⃣ **walletAnalyticsService.ts** (~300 lines)
**Responsibility:** Wallet analytics & reporting (MOVE TO SERVICES)

**Functions to Move:**
- `getUserAnalytics`
- `estimateFees`
- `getCurrencyRates`

---

### Migration Strategy for walletController.ts:

```
Phase 1 (Week 1): Extract Service
└── walletAnalyticsService.ts

Phase 2 (Week 2): Split Controllers
├── walletCoreController.ts
├── walletFundingController.ts
├── walletWithdrawalController.ts
└── walletAddressController.ts

Phase 3 (Week 3): Finalize
├── walletExchangeController.ts
├── Update routes
└── Testing
```

---

## 🟡 PRIORITY 3: Split userController.ts (2,158 lines)

### Current Responsibilities:
1. User registration/login
2. Profile management
3. Password management
4. Email verification
5. OTP management
6. Social auth
7. Referral system
8. KYC integration

### Proposed Split (4 files):

---

#### 1️⃣ **userAuthController.ts** (~700 lines)
**Responsibility:** Authentication

**Functions:**
- `registerUser`
- `loginUser`
- `logoutUser`
- `refreshToken`
- `forgotPassword`
- `resetPassword`

---

#### 2️⃣ **userProfileController.ts** (~500 lines)
**Responsibility:** Profile management

**Functions:**
- `getProfile`
- `updateProfile`
- `updatePassword`
- `deleteAccount`

---

#### 3️⃣ **userVerificationController.ts** (~600 lines)
**Responsibility:** Verification flows

**Functions:**
- Email verification
- Phone verification
- OTP management
- 2FA setup

---

#### 4️⃣ **userIntegrationController.ts** (~400 lines)
**Responsibility:** External integrations

**Functions:**
- Social auth (Google, Apple)
- Referral system
- KYC integration

---

## 📁 Recommended New Folder Structure

```
/app/backend/
├── controllers/
│   ├── payment/
│   │   ├── paymentLinkController.ts
│   │   ├── cryptoPaymentController.ts
│   │   ├── fiatPaymentController.ts
│   │   ├── paymentVerificationController.ts
│   │   ├── paymentDataController.ts
│   │   └── index.ts (exports all)
│   ├── wallet/
│   │   ├── walletCoreController.ts
│   │   ├── walletFundingController.ts
│   │   ├── walletWithdrawalController.ts
│   │   ├── walletAddressController.ts
│   │   ├── walletExchangeController.ts
│   │   └── index.ts
│   ├── user/
│   │   ├── userAuthController.ts
│   │   ├── userProfileController.ts
│   │   ├── userVerificationController.ts
│   │   ├── userIntegrationController.ts
│   │   └── index.ts
│   ├── company/
│   │   └── companyController.ts (already fine)
│   └── admin/
│       └── adminController.ts (already fine)
├── services/
│   ├── payment/
│   │   ├── paymentCalculationService.ts
│   │   ├── currencyRateService.ts
│   │   ├── networkFeeService.ts
│   │   └── paymentUtilsService.ts
│   ├── wallet/
│   │   └── walletAnalyticsService.ts
│   └── cron/
│       └── paymentCronJobs.ts
```

---

## 🔧 Refactoring Guidelines

### 1. Single Responsibility Principle
Each controller should have ONE clear responsibility:
```typescript
// ❌ BAD: One controller doing everything
export const paymentController = {
  createPayment,
  verifyPayment,
  calculateFees,
  getCurrencyRates,
  runCronJob,
  ...43 more functions
}

// ✅ GOOD: Focused controllers
export const paymentLinkController = {
  create,
  getAll,
  getById,
  update,
  delete
}
```

### 2. Shared Dependencies
Create a shared utilities file for common functions:
```typescript
// /controllers/payment/shared/paymentUtils.ts
export const validatePaymentAmount = (amount: number) => { ... }
export const formatCurrency = (amount: number, currency: string) => { ... }
```

### 3. Import Updates
Use barrel exports for clean imports:
```typescript
// /controllers/payment/index.ts
export * from './paymentLinkController';
export * from './cryptoPaymentController';

// Usage in routes:
import { createPaymentLink, createCryptoPayment } from '../controllers/payment';
```

### 4. Route Organization
Update routes to match new controller structure:
```typescript
// /routes/payment/paymentLinkRoutes.ts
import { paymentLinkController } from '../../controllers/payment';

const router = express.Router();
router.post('/create', paymentLinkController.create);
router.get('/list', paymentLinkController.getAll);

export default router;
```

---

## 🧪 Testing Strategy

### For Each Split:

1. **Unit Tests**
   - Test each new controller function independently
   - Mock dependencies
   - Verify behavior unchanged

2. **Integration Tests**
   - Test end-to-end flows
   - Verify all routes still work
   - Check error handling

3. **Regression Tests**
   - Run full test suite after each migration phase
   - Compare behavior before/after split

---

## 📈 Success Metrics

| Metric | Before | Target | Priority |
|--------|--------|--------|----------|
| Largest Controller | 7,914 lines | < 500 lines | P0 |
| Functions per Controller | 43 | < 10 | P0 |
| Cyclomatic Complexity | High | < 10 per function | P1 |
| Code Duplication | ~15% | < 5% | P2 |
| Test Coverage | ~60% | > 80% | P1 |

---

## ⏱️ Estimated Timeline

### Total: 9 weeks (2.25 months)

**Weeks 1-3:** paymentController refactoring  
**Weeks 4-6:** walletController refactoring  
**Weeks 7-9:** userController refactoring + final testing

**Per Week Breakdown:**
- Days 1-2: Planning & dependency analysis
- Days 3-4: File extraction & migration
- Day 5: Route updates & testing

---

## 🚨 Risks & Mitigation

### Risk 1: Breaking Changes
**Mitigation:** 
- Feature flag new controllers
- Run old & new in parallel initially
- Gradual rollout

### Risk 2: Import Hell
**Mitigation:**
- Use barrel exports (index.ts)
- Create import maps
- Document all changes

### Risk 3: Merge Conflicts
**Mitigation:**
- Lock payment controller during refactor
- Feature branch strategy
- Daily syncs with main

### Risk 4: Performance Impact
**Mitigation:**
- Benchmark before/after
- Optimize hot paths first
- Monitor in staging

---

## 🎯 Quick Wins (Can Start Today)

### Easiest Extractions (1-2 days each):

1. **Extract Cron Jobs** (Day 1)
   - Move 6 cron functions to `/services/cron/paymentCronJobs.ts`
   - Update server.ts imports
   - Low risk, high impact

2. **Extract Fee Calculation** (Day 2)
   - Move calculation logic to `/services/payment/paymentCalculationService.ts`
   - Shared by multiple controllers
   - Reusable across codebase

3. **Extract Currency Rates** (Day 3)
   - Move to `/services/payment/currencyRateService.ts`
   - Already partially abstracted

---

## 📞 Next Steps

1. **Get Team Approval** - Review this plan with team
2. **Prioritize** - Decide which controller to split first
3. **Create Branch** - `feature/refactor-payment-controller`
4. **Start with Services** - Extract easiest pieces first
5. **Document** - Keep detailed migration log

---

## 🔗 Related Documents

- `/app/CODEBASE_ANALYSIS_REPORT.md` - Original analysis
- `/app/SECURITY_FIXES_SUMMARY.md` - Recent security improvements
- `/app/backend/REFACTORING_LOG.md` - Migration progress (to be created)

---

**This refactoring will significantly improve:**
- Code maintainability
- Developer onboarding
- Testing coverage
- Bug isolation
- Performance optimization opportunities

**Recommendation:** Start with extracting cron jobs (quick win) → then tackle payment controller split in phases.

---

*END OF REFACTORING PLAN*
