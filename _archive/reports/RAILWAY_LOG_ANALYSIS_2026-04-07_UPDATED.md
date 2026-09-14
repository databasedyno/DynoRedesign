# Railway Log Analysis Report — April 7, 2026 (Updated)

## $98 USDT-TRC20 Payment Failure Analysis

### Payment Details
| Field | Value |
|-------|-------|
| Payment ID | `6e6e204c-e608-4fcc-9ab9-5031426d2594` |
| Pool Address | `TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe` |
| Merchant Wallet | `TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR` (Company 3, User 4 — NomadlyNew) |
| Amount | 98 USDT-TRC20 |
| Merchant Portion | 93.4916 USDT-TRC20 (after 2.52% fees + gas) |
| Admin Fees | 2.47 USDT-TRC20 |
| Gas Deducted | 2.0384 USD (in TRX) |
| Status | **STUCK in `processing`** — 3 failed settlement attempts |
| On-chain TX Hash | `1f8f52a54880f8954fe3921957ee6425ae9212dd45dfad2b94461b72780429a5` (incoming) |
| Failed TXs | `b3c3ac9b...` (OUT_OF_ENERGY), `a51fed51...` (OUT_OF_ENERGY), `05fc63ab...` (OUT_OF_ENERGY) |
| Total Gas Burned | 38.63 TRX (~$11.87) |

### Root Cause: Energy Estimation Mismatch

**SmartGas** (gas funding system) and **assetToOtherAddress** (transfer executor) used different energy estimates for the same recipient wallet:

| Component | Energy Estimate | TRX Needed | Why Different? |
|-----------|----------------|------------|----------------|
| **SmartGas** (`fundGasIfNeeded`) | 65,000 (ACTIVATED) | 8.3 TRX | Passed `recipientAddress` → TronGrid API said ACTIVATED |
| **assetToOtherAddress** alignment | 130,000 (NEW) | 16.1 TRX | Called `calculateDynamicTRC20Fee(fromAddress)` — no recipient → defaulted to NEW |
| **TRON Network** (actual) | 130,000 | ~13 TRX | Treated recipient as NEW despite having $3166 USDT balance |

**Result**: SmartGas funded 9.96 TRX, but network needed 13+ TRX → OUT_OF_ENERGY on all 3 attempts.

### Fix Applied (3 files)

1. **`tatumApi.ts`** — `assetToOtherAddress` feeLimit alignment now passes `toAddress` and `TRX_CONTRACT` to `calculateDynamicTRC20Fee` for consistent activation check
2. **`paymentController.ts`** — Recovery loop fee calculations now pass `recipientAddress` + `contractAddress`  
3. **`merchantPoolSweep.ts`** — `fundGasIfNeeded` now **always uses NEW_RECIPIENT (130k) energy** for TRC20 settlement gas, with a safety minimum of 16.1 TRX regardless of activation API result. The extra ~$2 TRX stays in pool and gets reclaimed.

### Recovery Script
Created `/app/backend/scripts/recover_payment_98_usdt.ts` for manual recovery of the stuck payment. Run with:
```
cd /app/backend && npx ts-node scripts/recover_payment_98_usdt.ts
```

### Timeline of Failure
```
14:34:23 — Payment created: 98 USDT-TRC20 for Company 3
14:34:24 — Pool address reserved: TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe
14:36:34 — Tatum webhook: 98 USDT received on-chain ✅
14:36:36 — payment.pending webhook → merchant (200 OK) ✅
14:36:37 — payment.confirmed webhook → merchant (200 OK) ✅
14:36:38 — State: pending → processing
14:36:43 — SmartGas: ACTIVATED (65k) → 8.3 TRX → funds 9.96 TRX
14:36:51 — Settlement TX: feeLimit aligned to 16.1 TRX (NEW, 130k)
14:36:58 — ❌ OUT_OF_ENERGY (TX b3c3ac9b, block 81635033)
14:36:59 — Recovery 1/2: Re-funded 9.96 TRX
14:37:13 — ❌ OUT_OF_ENERGY again (TX a51fed51, block 81635039)
14:37:14 — Recovery 2/2: Re-funded 9.96 TRX
14:37:28 — ❌ OUT_OF_ENERGY again (TX 05fc63ab, block 81635043)
14:37:28 — All recovery attempts exhausted. 38.63 TRX burned total.
14:37:29 — "Manual recovery required via /diagnostics/recover-stuck-payment"
14:37:33 — Idempotency guard blocks further attempts
14:37:40 — Pool still has 106.81 USDT. Payment stuck in processing.
```

### Other Anomalies Found

1. **Fee Wallet Low Balances**: TRX=$25.80 (⚠️ <$30), POLYGON=$0.34 (🚨), XRP=$13.47 (⚠️), ETH=$24.95 (⚠️)
2. **Stale Sweep Addresses**: 4 addresses deferred (5 unprofitable attempts each, retrying after April 14)
3. **TRON API 429s**: Multiple rate limiting during batch sweep operations
