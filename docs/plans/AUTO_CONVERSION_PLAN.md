# DynoPay Auto-Conversion Enhancement Plan
## Adaptive Fee + Limit IOC + Rate Lock

---

## How It Works End-to-End

```
Customer pays 0.00147 BTC to merchant's Tatum pool address
       │
       ▼
[1] Tatum webhook fires (payment detected)
       │
       ├─ Lock merchant's expected USD amount (e.g., $100.00)
       ├─ Lock exchange rate at this moment (e.g., 1 BTC = $67,880)
       │
       ▼
[2] Volatility Monitor checks market state for BTC
       │
       ├─ Reads 30-min ROC from Redis (updated every 60s)
       ├─ If STABLE    → sweep with SLOW fee
       ├─ If DECLINING → sweep with FAST fee
       ├─ If CRASH     → sweep with FASTEST fee + admin alert
       │
       ▼
[3] Sweep BTC from pool address → Binance deposit address
       │
       ├─ Tatum sweep API with adaptive fee tier
       ├─ Fee paid from the BTC being swept (deducted from amount)
       │
       ▼
[4] Wait for Binance to credit deposit (2 confirms for BTC)
       │
       ├─ conversionService polls Binance deposit history
       │
       ▼
[5] Sell BTC via Limit IOC at best bid
       │
       ├─ Check order book depth → get best bid price
       ├─ Place LIMIT SELL with timeInForce: IOC
       ├─ Fills instantly at best available prices
       ├─ actual_sale_usd = filled USDT amount
       │
       ▼
[6] Calculate merchant payout
       │
       ├─ IF actual_sale >= locked_amount:
       │     merchant_payout = locked_amount - platform_fee - trade_fee - sweep_fee
       │     platform_surplus = actual_sale - locked_amount (DynoPay profit)
       │
       ├─ IF actual_sale < locked_amount (price dropped):
       │     merchant_payout = actual_sale - platform_fee - trade_fee - sweep_fee
       │     platform_surplus = 0 (merchant absorbs the drop)
       │
       ▼
[7] Withdraw USDT to merchant's settlement wallet
       │
       ├─ Read from company settings:
       │     settlement_wallet_address: "TJx8kR3..." (merchant's USDT wallet)
       │     settlement_chain: "TRC20" (merchant's chosen network)
       │     settlement_currency: "USDT"
       │
       ├─ Call Binance withdrawal API:
       │     coin: USDT
       │     address: merchant's settlement_wallet_address
       │     network: merchant's settlement_chain
       │     amount: merchant_payout - withdrawal_fee
       │
       ▼
[8] Merchant receives USDT in their wallet ✅
```

---

## Phase 1: Volatility Monitor Service

**New file:** `backend/services/volatilityMonitorService.ts`

### What it does:
- Background cron job runs every **60 seconds**
- Fetches last 6 × 5-min klines from Binance public API for each non-stable crypto
- Calculates **30-min Rate of Change (ROC)** and **volume ratio**
- Determines market state and stores in Redis per crypto

### Monitored cryptos:
BTC, ETH, LTC, DOGE, SOL, XRP, BCH, BNB (all non-stablecoin currencies DynoPay supports)

### Market state thresholds:

| 30-min ROC | State | Sweep Fee Tier | Notes |
|------------|-------|----------------|-------|
| ROC ≥ -0.5% | `STABLE` | `slow` | Normal conditions, save on fees |
| -1.5% ≤ ROC < -0.5% | `VOLATILE` | `medium` | Some movement, moderate urgency |
| -3.0% ≤ ROC < -1.5% | `DECLINING` | `fast` | Price dropping, expedite sweep |
| -5.0% ≤ ROC < -3.0% | `RAPID_DECLINE` | `fastest` | Serious drop, max speed |
| ROC < -5.0% | `CRASH` | `fastest` | Flash crash, admin alert triggered |

### Volume confirmation:
- If volume ratio > 2x average AND ROC is negative → bump tier up one level
- This catches the early stages of a selloff before the price fully drops

### Redis storage:
```
volatility:{BTC} → { roc: -2.1, volumeRatio: 3.4, state: "DECLINING", feeTier: "fast", updatedAt: ... }
volatility:{ETH} → { roc: -0.3, volumeRatio: 0.8, state: "STABLE", feeTier: "slow", updatedAt: ... }
```

### Admin alert:
- When any crypto enters `RAPID_DECLINE` or `CRASH` → email admin via `sendEmail`
- Alert includes: crypto name, ROC %, current price, recommended action
- Cooldown: max 1 alert per crypto per 30 minutes (prevent spam during sustained crash)

### Exposed functions:
- `getMarketState(currency)` → returns `{ state, feeTier, roc, volumeRatio }`
- `startVolatilityMonitor()` → starts the 60s cron
- `getAllMarketStates()` → returns state for all monitored cryptos

### Diagnostics:
- `GET /api/diagnostics/volatility` → returns current state for all cryptos

---

## Phase 2: Live Fee Rate Fetcher

**New file:** `backend/services/feeRateService.ts`

### What it does:
- Fetches real-time blockchain fee rates from public APIs
- Caches in Redis (60s TTL) to avoid hammering external APIs
- Returns fee rate for a given chain and tier

### Fee sources per chain:

| Chain | API Source | What's Fetched |
|-------|-----------|----------------|
| BTC | Blockstream `api/fee-estimates` | sat/vB for each confirmation target |
| ETH | Blocknative `gasprices/blockprices` | Gwei for confidence levels |
| TRX | N/A | Fees are near-zero and constant |
| LTC | Blockstream/similar | litoshi/byte rates |
| SOL | N/A | Fees are near-zero and constant |
| XRP | N/A | Fixed fee (0.00001 XRP) |
| DOGE | Chain-specific estimator | koinu/byte |

### Exposed function:
- `getFeeForChain(chain, tier)` → returns fee rate in chain-native units

### Mapping tier → fee target:
```
slow    → 6-block target (BTC ~60 min, ETH ~75 sec)
medium  → 3-block target (BTC ~30 min, ETH ~36 sec)
fast    → 1-block target (BTC ~10 min, ETH ~12 sec)
fastest → 1-block with premium multiplier (1.5x fast rate)
```

---

## Phase 3: Smart Sweep with Adaptive Fees

**Modified file:** Sweep logic in payment/merchant pool flow

### What changes:
- Before initiating a sweep, call:
  1. `volatilityMonitorService.getMarketState(currency)` → get recommended fee tier
  2. `feeRateService.getFeeForChain(chain, tier)` → get actual fee rate
- Pass fee rate to Tatum sweep API
- Log the fee tier used and market state at time of sweep

### Tatum fee parameter mapping:
- **BTC:** Pass `fee` or `feeRate` in sat/vB
- **ETH/ERC20:** Pass `gasPrice` in Gwei or `fee.gasPrice`
- **TRX/TRC20:** No fee parameter needed (near-instant, negligible cost)
- **Others:** Chain-specific parameter per Tatum docs

### New fields stored on conversion record:
- `fee_tier_used`: which tier was selected (slow/medium/fast/fastest)
- `market_state_at_sweep`: market state when sweep was initiated
- `sweep_fee_usd`: USD cost of the sweep fee

---

## Phase 4: Limit IOC Sell on Binance

**Modified file:** `backend/services/binanceService.ts`

### New/updated functions:

**`getOrderBookBestBid(symbol)`**
- Calls `GET /api/v3/depth?symbol={symbol}&limit=5`
- Returns `{ bestBid, bestBidQty, totalBidDepth, spread }`

**`placeLimitIOCSell(symbol, quantity, price)`**
- Places `POST /api/v3/order` with:
  ```
  symbol: "BTCUSDT"
  side: "SELL"
  type: "LIMIT"
  timeInForce: "IOC"
  quantity: (rounded to stepSize)
  price: bestBid (from order book)
  ```
- Returns fill details: `{ orderId, status, executedQty, cummulativeQuoteQty, fills[] }`

**`convertViaLimitIOC(fromAsset, toAsset, amount)`** (replaces current `convertViaSpotTrade`)
1. Get order book → extract best bid
2. Place Limit IOC SELL at best bid
3. Check fill %:
   - If ≥ 95% filled → success
   - If < 95% filled → place another Limit IOC for remainder at new best bid
   - If < 50% filled after 2 attempts → fallback to MARKET order
4. Return: `{ orderId, avgPrice, fromAmount, toAmount, fillPercent, method }`

---

## Phase 5: Merchant Rate Lock & Payout Calculation

**Modified file:** `backend/services/conversionService.ts`

### Rate locking (at payment detection time):
When a new stablecoin conversion record is created:
- `locked_merchant_usd` = the USD value quoted to the merchant at payment time
- `locked_exchange_rate` = the exchange rate used for the quote
- `locked_at` = timestamp of the lock

**Source:** These values come from the existing `source_amount_usd` field and the transaction's exchange rate at creation. The `source_amount_usd` on the conversion record already captures this — we just need to ensure it's treated as the merchant's locked amount.

### Payout calculation (after Limit IOC sell):

```
actual_sale_usd = Limit IOC fill amount in USDT
locked_merchant_usd = source_amount_usd (from conversion record)

platform_fee = platform_fee_pct% of actual_sale_usd
trade_fee = Binance 0.1% taker fee (already deducted from fill)
sweep_fee = sweep_fee_usd (from Phase 3)
withdrawal_fee = Binance network fee for settlement_chain

IF actual_sale_usd >= locked_merchant_usd:
    # Price went up → merchant gets locked amount, platform keeps surplus
    merchant_payout = locked_merchant_usd - platform_fee_on_locked - sweep_fee
    platform_surplus = actual_sale_usd - locked_merchant_usd
    
IF actual_sale_usd < locked_merchant_usd:
    # Price dropped → merchant absorbs the loss
    merchant_payout = actual_sale_usd - platform_fee_on_actual - sweep_fee
    platform_surplus = 0

# Final withdrawal amount (what Binance sends to merchant's wallet)
withdrawal_amount = merchant_payout - withdrawal_fee
```

### New fields on stablecoin_conversion model:

| Field | Type | Description |
|-------|------|-------------|
| `locked_merchant_usd` | DECIMAL(20,2) | Merchant's expected USD at payment time |
| `locked_exchange_rate` | DECIMAL(20,8) | Exchange rate at payment time |
| `locked_at` | DATE | When rate was locked |
| `actual_sale_usd` | DECIMAL(20,2) | What the crypto actually sold for in USDT |
| `platform_surplus` | DECIMAL(20,4) | Profit from price increase (0 if price dropped) |
| `price_movement_pct` | DECIMAL(10,4) | % change from locked rate to actual sale |
| `fee_tier_used` | STRING(20) | slow/medium/fast/fastest |
| `market_state_at_sweep` | STRING(20) | STABLE/VOLATILE/DECLINING/RAPID_DECLINE/CRASH |
| `sweep_fee_usd` | DECIMAL(20,4) | Blockchain fee for sweep in USD |
| `trade_fee_usd` | DECIMAL(20,4) | Binance trading fee in USD |
| `ioc_fill_percent` | DECIMAL(5,2) | % of Limit IOC that was filled |
| `merchant_payout_usd` | DECIMAL(20,2) | Final USDT amount sent to merchant |

---

## Phase 6: Withdrawal to Merchant's Wallet

**Modified file:** `backend/services/conversionService.ts` (processWithdrawals)

### Current flow (already exists, needs update):
The withdrawal step already reads from the conversion record:
- `settlement_wallet_address` → merchant's wallet (from company settings, e.g., `TJx8kR3...`)
- `settlement_chain` → merchant's chosen network (from company settings, e.g., `TRC20`)
- `target_currency` → USDT or USDC

### What changes:
1. **Calculate net withdrawal amount:**
   - `withdrawal_amount = merchant_payout_usd - binance_withdrawal_fee`
   - Binance charges a fixed fee per network (TRC20: ~$1, ERC20: ~$3.20, Polygon: ~$0.80)
   
2. **Withdrawal call to Binance** (already implemented, just update amount):
   ```
   binanceService.submitWithdrawal({
     coin: "USDT",                           // from settlement_currency
     address: "TJx8kR3...",                   // from settlement_wallet_address (company settings)
     amount: withdrawal_amount,               // merchant_payout minus withdrawal fee
     network: "TRC20",                        // from settlement_chain (company settings)
   })
   ```

3. **Store withdrawal details:**
   - `withdrawal_fee` = Binance network fee charged
   - `merchant_payout_usd` = final amount merchant receives in their wallet

### How merchant's wallet is determined:
```
Company Settings (set by merchant in dashboard):
  ├── auto_convert_enabled: true
  ├── settlement_currency: "USDT"
  ├── settlement_wallet_address: "TJx8kR3nPz..." ← Binance sends here
  └── settlement_chain: "TRC20"                   ← On this network
         │
         ▼
Copied to stablecoin_conversion record at creation time
         │
         ▼
Used by processWithdrawals() to call Binance withdrawal API
         │
         ▼
Merchant receives USDT in their TRC20 wallet ✅
```

---

## Phase 7: Wiring & Registration

**Modified file:** `backend/server.ts`

### Register cron jobs:
1. **Volatility monitor** — runs every 60 seconds
   - `cron.schedule('*/1 * * * *', volatilityMonitor.run)` with Redis lock
2. **Conversion processor** — already exists, just ensure it uses updated logic

### Register diagnostics:
- `GET /api/diagnostics/volatility` — current market states for all cryptos
- `GET /api/diagnostics/fee-rates` — current blockchain fee rates per chain
- `GET /api/diagnostics/binance-orderbook?symbol=BTCUSDT` — live order book

### Update conversion stats:
- Include avg surplus, avg price movement, fee tier distribution

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
  │          │          │          │          │          │          │
  │          │          │          │          │          │          └─ Wire to server.ts + diagnostics
  │          │          │          │          │          └─ Update withdrawal with payout calc
  │          │          │          │          └─ Rate lock + payout logic
  │          │          │          └─ Limit IOC sell (binanceService)
  │          │          └─ Adaptive sweep fees
  │          └─ Live fee rate fetcher
  └─ Volatility monitor (foundation)
```

Each phase can be tested independently before moving to the next.

---

## Files Changed Summary

| File | Action | Phase |
|------|--------|-------|
| `backend/services/volatilityMonitorService.ts` | **NEW** | 1 |
| `backend/services/feeRateService.ts` | **NEW** | 2 |
| `backend/services/binanceService.ts` | **MODIFY** — add Limit IOC, order book | 4 |
| `backend/services/conversionService.ts` | **MODIFY** — adaptive fees, rate lock, payout calc | 3, 5, 6 |
| `backend/models/stablecoinConversionModel.ts` | **MODIFY** — add new columns | 5 |
| `backend/routes/diagnosticsRouter.ts` | **MODIFY** — add volatility, fee, orderbook endpoints | 7 |
| `backend/server.ts` | **MODIFY** — register volatility cron | 7 |
| Sweep logic (merchantPoolService or equivalent) | **MODIFY** — use adaptive fees | 3 |
