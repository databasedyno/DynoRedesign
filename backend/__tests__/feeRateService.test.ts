/**
 * Unit Tests: Fee Rate Service (Phase 3)
 *
 * Tests the fee rate fetching and sweep cost estimation:
 *   - getFeeRates(chain): cached rate lookup per chain
 *   - getFeeForChain(chain, tier): specific tier rate
 *   - estimateSweepCostUSD(chain, tier, cryptoPriceUSD): USD cost of sweep tx
 *   - getAllFeeRates(): memory cache diagnostics
 *
 * These rates drive the SmartGas system — incorrect rates mean
 * either stuck transactions (too low) or wasted gas (too high).
 */

// ── Mock Setup ──────────────────────────────────────────────────────────────

jest.mock('../utils/loggers', () => ({
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Mock the redis client (used directly, not via helpers)
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');
jest.mock('../utils/redisInstance', () => ({
  ...(jest.requireActual('../utils/redisInstance') as object),
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    isReady: true,
  },
}));

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
  __esModule: true,
  default: { get: jest.fn() },
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  getFeeRates,
  getFeeForChain,
  estimateSweepCostUSD,
  getAllFeeRates,
} from '../services/feeRateService';
import axios from 'axios';

const mockAxiosGet = axios.get as jest.Mock;

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Fee Rate Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);

    // Default: Blockstream BTC fees
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('blockstream')) {
        return Promise.resolve({
          data: { '1': 25, '2': 20, '3': 15, '6': 8, '25': 3 },
        });
      }
      if (url.includes('blocknative')) {
        return Promise.resolve({
          data: {
            blockPrices: [
              {
                estimatedPrices: [
                  { confidence: 99, maxFeePerGas: 30 },
                  { confidence: 90, maxFeePerGas: 20 },
                  { confidence: 70, maxFeePerGas: 10 },
                ],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFeeRates
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFeeRates', () => {
    it('fetches BTC rates from Blockstream API', async () => {
      const rates = await getFeeRates('BTC');

      expect(rates.chain).toBe('BTC');
      expect(rates.unit).toBe('sat/vB');
      expect(rates.fast).toBe(25); // block target "1"
      expect(rates.medium).toBe(15); // block target "3"
      expect(rates.slow).toBe(8); // block target "6"
      expect(rates.fastest).toBe(38); // ceil(25 * 1.5)
    });

    it('fetches ETH rates from Blocknative API', async () => {
      const rates = await getFeeRates('ETH');

      expect(rates.chain).toBe('ETH');
      expect(rates.unit).toBe('Gwei');
      expect(rates.fast).toBe(30); // 99% confidence
      expect(rates.medium).toBe(20); // 90% confidence
      expect(rates.slow).toBe(10); // 70% confidence
      expect(rates.fastest).toBe(45); // ceil(30 * 1.5)
    });

    it('returns static rates for LTC', async () => {
      const rates = await getFeeRates('LTC');

      expect(rates.chain).toBe('LTC');
      expect(rates.unit).toBe('litoshi/byte');
    });

    it('returns fixed fees for near-instant chains (TRX, SOL, XRP)', async () => {
      const trxRates = await getFeeRates('TRX');
      expect(trxRates.chain).toBe('TRX');
      expect(trxRates.unit).toBe('bandwidth');

      const solRates = await getFeeRates('SOL');
      expect(solRates.chain).toBe('SOL');
      expect(solRates.unit).toBe('lamports');

      const xrpRates = await getFeeRates('XRP');
      expect(xrpRates.chain).toBe('XRP');
      expect(xrpRates.unit).toBe('drops');
    });

    it('returns cached result from Redis', async () => {
      const cached = JSON.stringify({
        slow: 5,
        medium: 10,
        fast: 20,
        fastest: 30,
        unit: 'sat/vB',
        chain: 'BTC',
        fetchedAt: new Date().toISOString(),
      });
      mockRedisGet.mockResolvedValue(cached);

      const rates = await getFeeRates('BTC');

      expect(rates.fast).toBe(20);
      // Should NOT call Blockstream API
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });

    it('falls back to memory cache when Redis is unavailable', async () => {
      // First call populates memory cache
      await getFeeRates('BTC');

      // Simulate Redis failure
      mockRedisGet.mockRejectedValue(new Error('Redis down'));

      const rates = await getFeeRates('BTC');

      expect(rates.chain).toBe('BTC');
    });

    it('uses memory-cached rates when BTC API fails', async () => {
      // First call populates memory cache
      await getFeeRates('BTC');
      // Now API fails
      mockAxiosGet.mockRejectedValue(new Error('Network error'));
      mockRedisGet.mockResolvedValue(null);

      const rates = await getFeeRates('BTC');

      // Should use memory-cached values from first call
      expect(rates.chain).toBe('BTC');
      expect(rates.fast).toBe(25); // From Blockstream mock
    });

    it('uses memory-cached rates when ETH API fails', async () => {
      await getFeeRates('ETH');
      mockAxiosGet.mockRejectedValue(new Error('Network error'));
      mockRedisGet.mockResolvedValue(null);

      const rates = await getFeeRates('ETH');

      expect(rates.chain).toBe('ETH');
      expect(rates.fast).toBe(30); // From Blocknative mock
    });

    it('handles ERC20 as ETH alias', async () => {
      const rates = await getFeeRates('ERC20');

      expect(rates.chain).toBe('ETH');
      expect(rates.unit).toBe('Gwei');
    });

    it('handles unknown chains with zero-fee defaults', async () => {
      const rates = await getFeeRates('UNKNOWN');

      expect(rates.chain).toBe('UNKNOWN');
      expect(rates.unit).toBe('unknown');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFeeForChain
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFeeForChain', () => {
    it('returns specific tier rate and unit', async () => {
      const result = await getFeeForChain('BTC', 'fast');

      expect(result.rate).toBe(25);
      expect(result.unit).toBe('sat/vB');
    });

    it('returns slow tier', async () => {
      const result = await getFeeForChain('BTC', 'slow');

      expect(result.rate).toBe(8);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // estimateSweepCostUSD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('estimateSweepCostUSD', () => {
    it('estimates BTC sweep cost (141 vBytes × rate)', async () => {
      // BTC fast = 25 sat/vB, price = $95,000
      const cost = await estimateSweepCostUSD('BTC', 'fast', 95000);

      // 141 * 25 = 3525 sats = 0.00003525 BTC * $95000 ≈ $3.35
      expect(cost).toBeCloseTo(3.35, 0);
    });

    it('estimates ETH sweep cost (21000 gas × rate)', async () => {
      // ETH fast = 30 Gwei, price = $2,300
      const cost = await estimateSweepCostUSD('ETH', 'fast', 2300);

      // 21000 * 30 / 1e9 = 0.00063 ETH * $2300 ≈ $1.449
      expect(cost).toBeCloseTo(1.449, 1);
    });

    it('estimates LTC sweep cost (225 bytes × rate)', async () => {
      // LTC: rate = 50 litoshi/byte, price = $100
      const cost = await estimateSweepCostUSD('LTC', 'fast', 100);

      // 225 * 50 = 11250 litoshi = 0.0001125 LTC * $100 ≈ $0.01125
      expect(cost).toBeCloseTo(0.01125, 3);
    });

    it('returns $0.01 for near-instant chains (SOL, XRP, TRX)', async () => {
      const solCost = await estimateSweepCostUSD('SOL', 'fast', 170);
      expect(solCost).toBe(0.01);

      const xrpCost = await estimateSweepCostUSD('XRP', 'fast', 2.5);
      expect(xrpCost).toBe(0.01);

      const trxCost = await estimateSweepCostUSD('TRX', 'fast', 0.25);
      expect(trxCost).toBe(0.01);
    });

    it('handles ERC20 as ETH alias for sweep estimation', async () => {
      const ethCost = await estimateSweepCostUSD('ETH', 'fast', 2300);
      const erc20Cost = await estimateSweepCostUSD('ERC20', 'fast', 2300);

      expect(ethCost).toBeCloseTo(erc20Cost, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAllFeeRates (Diagnostics)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAllFeeRates', () => {
    it('returns populated memory cache after fetch', async () => {
      await getFeeRates('BTC');
      await getFeeRates('ETH');

      const all = getAllFeeRates();

      expect(all).toHaveProperty('BTC');
      expect(all).toHaveProperty('ETH');
      expect(all.BTC.chain).toBe('BTC');
    });
  });
});
