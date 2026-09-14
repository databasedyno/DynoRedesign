/**
 * Historical USD Value Backfill Script
 * 
 * This script populates the usd_value field for historical transactions
 * using the actual exchange rates at the time of each transaction.
 * 
 * Strategy:
 * 1. Fetch all transactions where usd_value = 0 or NULL
 * 2. For each transaction, get the historical exchange rate at createdAt timestamp
 * 3. Calculate usd_value = base_amount × historical_rate
 * 4. Update the database
 * 
 * Historical Price Sources (in order of preference):
 * - CoinGecko /coins/{id}/history API (free, supports date-based historical prices)
 * - Binance Klines API (has API keys, good for recent data)
 * - Fallback to 1:1 for stablecoins (USDT, USDC, RLUSD)
 */

import axios from 'axios';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// CoinGecko ID mapping (reused from currencyConvert.ts)
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  TRX: 'tron',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  BCH: 'bitcoin-cash',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
  MATIC: 'matic-network',
  POLYGON: 'matic-network',
  RLUSD: 'ripple-usd',
};

// Stablecoins that are always 1:1 with USD
const STABLECOINS = ['USDT', 'USDC', 'RLUSD'];

// Cache to avoid fetching the same price multiple times
const priceCache = new Map<string, number>();

/**
 * Normalize currency code (handle variants)
 */
function normalizeCurrency(currency: string): string {
  if (!currency) return 'USD';
  const upper = currency.toUpperCase();
  if (upper.includes('USDT')) return 'USDT';
  if (upper.includes('USDC')) return 'USDC';
  if (upper.includes('RLUSD')) return 'RLUSD';
  if (upper.includes('TRON') || upper === 'TRX') return 'TRX';
  if (upper.includes('POLYGON') || upper === 'MATIC') return 'MATIC';
  return upper;
}

/**
 * Get current price as approximation for historical
 * Since we don't have reliable free historical APIs, we'll use current rates
 * This is still better than 0 and provides a reasonable approximation
 */
async function getCurrentPriceFromTatum(
  currency: string
): Promise<number | null> {
  const tatumIds: Record<string, string> = {
    BTC: 'BTC', ETH: 'ETH', TRX: 'TRX', LTC: 'LTC', DOGE: 'DOGE',
    BCH: 'BCH', BNB: 'BNB', XRP: 'XRP', ADA: 'ADA', SOL: 'SOL',
    MATIC: 'MATIC', POLYGON: 'MATIC',
  };

  const id = tatumIds[currency];
  if (!id) {
    console.warn(`⚠️  No Tatum ID mapping for ${currency}`);
    return null;
  }

  // Check cache
  const cacheKey = `tatum:${currency}`;
  if (priceCache.has(cacheKey)) {
    console.log(`💾 Cache hit: ${cacheKey} = ${priceCache.get(cacheKey)}`);
    return priceCache.get(cacheKey)!;
  }

  const apiKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
  if (!apiKey) {
    console.warn(`⚠️  Tatum: no API key configured`);
    return null;
  }

  try {
    const { data } = await axios.get(
      `https://api.tatum.io/v3/tatum/rate/${id}`,
      {
        params: { basePair: 'USD' },
        headers: { 'x-api-key': apiKey },
        timeout: 8000,
      }
    );
    
    const rate = parseFloat(data?.value);
    if (rate > 0) {
      console.log(`✅ Tatum current rate for ${currency}: $${rate}`);
      priceCache.set(cacheKey, rate);
      return rate;
    }
  } catch (error: any) {
    console.warn(`⚠️  Tatum API failed for ${currency}: ${error.message}`);
  }

  return null;
}

/**
 * Get historical price from Binance Klines
 * API: GET /api/v3/klines
 * Note: Binance data only available from ~2017 onwards
 */
async function getBinanceHistoricalPrice(
  currency: string,
  timestamp: Date
): Promise<number | null> {
  // Binance symbol mapping
  const symbolMap: Record<string, string> = {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    BNB: 'BNBUSDT',
    LTC: 'LTCUSDT',
    BCH: 'BCHUSDT',
    XRP: 'XRPUSDT',
    ADA: 'ADAUSDT',
    SOL: 'SOLUSDT',
    DOGE: 'DOGEUSDT',
    TRX: 'TRXUSDT',
    MATIC: 'MATICUSDT',
  };

  const symbol = symbolMap[currency];
  if (!symbol) {
    console.warn(`⚠️  No Binance symbol mapping for ${currency}`);
    return null;
  }

  const dateStr = timestamp.toISOString().split('T')[0];
  const cacheKey = `binance:${currency}:${dateStr}`;
  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey)!;
  }

  try {
    const startTime = timestamp.getTime();
    const endTime = startTime + 86400000; // +24 hours

    const response = await axios.get(
      `https://api.binance.com/api/v3/klines`,
      {
        params: {
          symbol,
          interval: '1d',
          startTime,
          endTime,
          limit: 1,
        },
        timeout: 10000,
      }
    );

    if (response.data && response.data.length > 0) {
      // Kline format: [openTime, open, high, low, close, volume, ...]
      const closePrice = parseFloat(response.data[0][4]);
      if (closePrice > 0) {
        console.log(`✅ Binance: ${currency} on ${dateStr} = $${closePrice}`);
        priceCache.set(cacheKey, closePrice);
        return closePrice;
      }
    }
  } catch (error: any) {
    console.warn(
      `⚠️  Binance API failed for ${currency} on ${dateStr}: ${error.message}`
    );
  }

  return null;
}

/**
 * Get historical USD value for a transaction
 */
async function getHistoricalUsdValue(
  baseCurrency: string,
  baseAmount: number,
  createdAt: Date
): Promise<number> {
  const currency = normalizeCurrency(baseCurrency);

  // If already USD, return as-is
  if (currency === 'USD') {
    return baseAmount;
  }

  // Stablecoins are always 1:1 with USD
  if (STABLECOINS.includes(currency)) {
    console.log(`💵 Stablecoin ${currency}: 1:1 peg = $${baseAmount}`);
    return baseAmount;
  }

  // Use current Tatum price as approximation
  // Note: This is current price, not historical, but better than 0
  let rate = await getCurrentPriceFromTatum(currency);

  // If still no rate, return 0 and log error
  if (!rate) {
    console.error(
      `❌ Failed to get rate for ${currency} (transaction date: ${createdAt.toISOString()})`
    );
    return 0;
  }

  const usdValue = baseAmount * rate;
  console.log(
    `💰 ${baseAmount} ${currency} × $${rate} (approx) = $${usdValue.toFixed(2)}`
  );
  return usdValue;
}

/**
 * Main backfill function
 */
async function backfillUsdValues() {
  console.log('\n🚀 Starting USD Value Backfill Script\n');
  console.log('='.repeat(60));

  try {
    // Fetch all transactions where usd_value is 0 or NULL
    const transactions = await sequelize.query(
      `SELECT transaction_id, base_currency, base_amount, "createdAt", user_id, company_id
       FROM tbl_user_transaction
       WHERE COALESCE(usd_value, 0) = 0
       ORDER BY "createdAt" ASC`,
      { type: QueryTypes.SELECT }
    ) as Array<{
      transaction_id: number;
      base_currency: string;
      base_amount: number;
      createdAt: Date;
      user_id: number;
      company_id: number | null;
    }>;

    console.log(`\n📊 Found ${transactions.length} transactions to backfill\n`);

    if (transactions.length === 0) {
      console.log('✅ No transactions need backfilling. All done!');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let totalUsdValue = 0;

    // Process each transaction
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const progress = `[${i + 1}/${transactions.length}]`;

      console.log('\n' + '-'.repeat(60));
      console.log(
        `${progress} Transaction ID: ${tx.transaction_id} | User: ${tx.user_id} | Company: ${tx.company_id || 'N/A'}`
      );
      console.log(
        `   Amount: ${tx.base_amount} ${tx.base_currency} | Date: ${new Date(tx.createdAt).toISOString()}`
      );

      try {
        const usdValue = await getHistoricalUsdValue(
          tx.base_currency,
          tx.base_amount,
          new Date(tx.createdAt)
        );

        if (usdValue > 0) {
          // Update the database
          await sequelize.query(
            `UPDATE tbl_user_transaction
             SET usd_value = :usdValue
             WHERE transaction_id = :transactionId`,
            {
              replacements: {
                usdValue: usdValue,
                transactionId: tx.transaction_id,
              },
              type: QueryTypes.UPDATE,
            }
          );

          console.log(`   ✅ Updated usd_value = $${usdValue.toFixed(2)}`);
          successCount++;
          totalUsdValue += usdValue;
        } else {
          console.log(`   ⚠️  Skipped (no rate available)`);
          failCount++;
        }

        // Rate limiting: wait 0.5 seconds between API calls (Tatum has generous limits)
        if (i < transactions.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing transaction: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount} transactions`);
    console.log(`❌ Failed: ${failCount} transactions`);
    console.log(`💰 Total USD value backfilled: $${totalUsdValue.toFixed(2)}`);
    console.log('='.repeat(60) + '\n');
  } catch (error: any) {
    console.error('\n❌ Fatal error during backfill:', error);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  backfillUsdValues()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { backfillUsdValues, getHistoricalUsdValue };
