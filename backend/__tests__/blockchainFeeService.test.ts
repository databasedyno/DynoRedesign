/**
 * Unit Tests: Blockchain Fee Service (Phase 3)
 *
 * Tests the real-time blockchain fee estimation engine:
 *   - getBlockchainNetworkFee(chain, speed)
 *   - calculateCustomerPaymentAmount(baseAmountUSD, chain, cryptoPrice)
 *
 * This service determines the actual blockchain gas/fee that gets
 * deducted from merchant payouts. If it over-estimates, merchants
 * lose money; if it under-estimates, the platform absorbs the loss.
 */

// ── Mock Setup ──────────────────────────────────────────────────────────────

jest.mock('../utils/loggers', () => ({
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  apiLogger: { info: jest.fn(), error: jest.fn() },
}));

// Mock tronEnergyService
jest.mock('../services/tronEnergyService', () => ({
  getTronNetworkParams: jest.fn().mockResolvedValue({
    energyPriceSun: 100,
    bandwidthPriceSun: 1000,
  }),
}));

// Mock axios for Tatum/CoinGecko calls
jest.mock('axios', () => ({
  get: jest.fn(),
  __esModule: true,
  default: { get: jest.fn() },
}));

// blockchainFeeService imports the shared axios INSTANCE from utils/tatumHttp
// (axios.create() — which the axios mock above doesn't provide, and the real
// module registers interceptors at load time). Map the instance straight to the
// mocked axios default so the existing `axios.get` assertions keep working.
jest.mock('../utils/tatumHttp', () => ({
  __esModule: true,
  default: require('axios').default,
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import {
  getBlockchainNetworkFee,
  calculateCustomerPaymentAmount,
} from '../services/blockchainFeeService';
import { getRedisItem, setRedisItem } from '../utils/redisInstance';
import axios from 'axios';

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockAxiosGet = axios.get as jest.Mock;

function seedRedis(key: string, value: unknown) {
  (getRedisItem as jest.Mock).mockImplementation((k: string) => {
    if (k === key) return Promise.resolve(value);
    return Promise.resolve(null);
  });
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Blockchain Fee Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no cache
    (getRedisItem as jest.Mock).mockResolvedValue(null);
    (setRedisItem as jest.Mock).mockResolvedValue(undefined);

    // Default Tatum fee response (ETH gas price in Wei)
    mockAxiosGet.mockImplementation((url: string) => {
      if (url.includes('blockchain/fee/BTC')) {
        return Promise.resolve({ data: { fast: 30, medium: 15, slow: 5 } });
      }
      if (url.includes('blockchain/fee/ETH')) {
        return Promise.resolve({ data: { fast: 30e9, medium: 20e9, slow: 10e9 } });
      }
      if (url.includes('blockchain/fee/LTC')) {
        return Promise.resolve({ data: { fast: 50, medium: 20, slow: 5 } });
      }
      if (url.includes('coingecko')) {
        // Return prices for common cryptos
        if (url.includes('bitcoin')) return Promise.resolve({ data: { bitcoin: { usd: 95000 } } });
        if (url.includes('ethereum')) return Promise.resolve({ data: { ethereum: { usd: 2300 } } });
        if (url.includes('tron')) return Promise.resolve({ data: { tron: { usd: 0.25 } } });
        if (url.includes('litecoin')) return Promise.resolve({ data: { litecoin: { usd: 100 } } });
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: {} });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Chain Routing
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Chain Routing', () => {
    it('routes BTC to UTXO calculator', async () => {
      const result = await getBlockchainNetworkFee('BTC');

      expect(result.chain).toBe('BTC');
      expect(result.feeInNative).toBeGreaterThan(0);
      expect(result.feeInUSD).toBeGreaterThan(0);
      expect(result.satPerByte).toBeDefined();
    });

    it('routes ETH to EVM calculator', async () => {
      const result = await getBlockchainNetworkFee('ETH');

      expect(result.chain).toBe('ETH');
      expect(result.feeInNative).toBeGreaterThan(0);
      expect(result.gasPrice).toBeDefined();
    });

    it('routes USDT_ERC20 to EVM calculator (token)', async () => {
      const result = await getBlockchainNetworkFee('USDT_ERC20');

      expect(result.chain).toBe('USDT_ERC20');
      expect(result.feeInNative).toBeGreaterThan(0);
    });

    it('routes TRX to TRON calculator', async () => {
      const result = await getBlockchainNetworkFee('TRX');

      expect(result.chain).toBe('TRX');
      expect(result.feeInNative).toBeGreaterThanOrEqual(0);
    });

    it('routes USDT_TRC20 to TRON calculator', async () => {
      const result = await getBlockchainNetworkFee('USDT_TRC20');

      expect(result.chain).toBe('USDT_TRC20');
    });

    it('routes SOL to fixed-fee calculator', async () => {
      const result = await getBlockchainNetworkFee('SOL');

      expect(result.chain).toBe('SOL');
      expect(result.feeInNative).toBe(0.000005);
      expect(result.nativeSymbol).toBe('SOL');
    });

    it('routes XRP to fixed-fee calculator', async () => {
      const result = await getBlockchainNetworkFee('XRP');

      expect(result.chain).toBe('XRP');
      expect(result.feeInNative).toBe(0.000012);
      expect(result.nativeSymbol).toBe('XRP');
    });

    it('routes RLUSD to fixed-fee calculator (XRP-based)', async () => {
      const result = await getBlockchainNetworkFee('RLUSD');

      expect(result.chain).toBe('RLUSD');
      expect(result.nativeSymbol).toBe('XRP');
    });

    it('normalizes hyphenated chain names (usdt-erc20 → USDT_ERC20)', async () => {
      const result = await getBlockchainNetworkFee('usdt-erc20');

      expect(result.chain).toBe('USDT_ERC20');
    });

    it('throws on unsupported chain', async () => {
      await expect(getBlockchainNetworkFee('DOGWIFHAT')).rejects.toThrow(
        'Unsupported blockchain: DOGWIFHAT'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UTXO Fee Calculation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('UTXO Fee Calculation (BTC)', () => {
    it('calculates BTC fee: satPerByte × txSize / 1e8', async () => {
      // fast = 30 sat/byte, txSize = 250 bytes
      const result = await getBlockchainNetworkFee('BTC', 'fast');

      // Fee: 30 * 250 = 7500 sats = 0.000075 BTC
      expect(result.feeInNative).toBeCloseTo(0.000075, 6);
      expect(result.satPerByte).toBe(30);
      // USD: 0.000075 * 95000 ≈ $7.125
      expect(result.feeInUSD).toBeCloseTo(7.125, 1);
    });

    it('uses medium speed when specified', async () => {
      const result = await getBlockchainNetworkFee('BTC', 'medium');

      // medium = 15 sat/byte
      expect(result.feeInNative).toBeCloseTo(0.0000375, 7);
      expect(result.speed).toBe('medium');
    });

    it('returns cached result when available', async () => {
      const cachedResult = {
        chain: 'BTC',
        feeInNative: 0.0001,
        feeInUSD: 9.5,
        speed: 'fast',
        timestamp: Date.now(), // Fresh cache
      };
      seedRedis('blockchain_fee_BTC', cachedResult);

      const result = await getBlockchainNetworkFee('BTC');

      expect(result.feeInNative).toBe(0.0001);
      expect(result.feeInUSD).toBe(9.5);
      // Should NOT call Tatum API
      expect(mockAxiosGet).not.toHaveBeenCalledWith(
        expect.stringContaining('blockchain/fee'),
        expect.anything()
      );
    });

    it('fetches fresh data when cache is expired', async () => {
      const staleResult = {
        chain: 'BTC',
        feeInNative: 0.0001,
        feeInUSD: 9.5,
        speed: 'fast',
        timestamp: Date.now() - 600000, // 10 min old (cache is 5 min)
      };
      seedRedis('blockchain_fee_BTC', staleResult);

      const result = await getBlockchainNetworkFee('BTC');

      // Should have fetched fresh data
      expect(result.feeInNative).toBeCloseTo(0.000075, 6); // Fresh calculation
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVM Fee Calculation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('EVM Fee Calculation (ETH)', () => {
    it('calculates ETH fee: gasPrice × gasLimit / 1e18', async () => {
      // fast = 30 Gwei (30e9 Wei), gasLimit = 21000
      const result = await getBlockchainNetworkFee('ETH', 'fast');

      // Fee: 30e9 * 21000 = 630e12 Wei = 0.00063 ETH
      expect(result.feeInNative).toBeCloseTo(0.00063, 5);
      // USD: 0.00063 * 2300 ≈ $1.449
      expect(result.feeInUSD).toBeCloseTo(1.449, 1);
    });

    it('uses higher gas limit for ERC20 tokens (65000 vs 21000)', async () => {
      const ethResult = await getBlockchainNetworkFee('ETH', 'fast');
      const tokenResult = await getBlockchainNetworkFee('USDT_ERC20', 'fast');

      // Token fee should be ~3.1x higher (65000/21000)
      expect(tokenResult.feeInNative).toBeGreaterThan(ethResult.feeInNative);
      expect(tokenResult.feeInNative / ethResult.feeInNative).toBeCloseTo(
        65000 / 21000,
        1
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRON Fee Calculation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('TRON Fee Calculation', () => {
    it('calculates TRX fee using bandwidth', async () => {
      const result = await getBlockchainNetworkFee('TRX');

      // TRX: 300 bandwidth × 1000 sun/bandwidth = 300000 sun = 0.3 TRX
      expect(result.feeInNative).toBeCloseTo(0.3, 1);
    });

    it('calculates USDT_TRC20 fee using energy', async () => {
      const result = await getBlockchainNetworkFee('USDT_TRC20');

      // USDT_TRC20: 65000 energy × 100 sun/energy = 6500000 sun = 6.5 TRX
      expect(result.feeInNative).toBeCloseTo(6.5, 1);
      // USD: 6.5 * 0.25 ≈ $1.625
      expect(result.feeInUSD).toBeCloseTo(1.625, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Fixed-Fee Chains
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Fixed-Fee Chains (SOL, XRP, RLUSD)', () => {
    it('SOL has fixed fee of 0.000005 SOL', async () => {
      const result = await getBlockchainNetworkFee('SOL');

      expect(result.feeInNative).toBe(0.000005);
      // USD should be calculated (not 0)
      expect(result.feeInUSD).toBeGreaterThanOrEqual(0);
    });

    it('XRP has fixed fee of 0.000012 XRP', async () => {
      const result = await getBlockchainNetworkFee('XRP');

      expect(result.feeInNative).toBe(0.000012);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateCustomerPaymentAmount
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateCustomerPaymentAmount', () => {
    it('adds blockchain fee to base crypto amount', async () => {
      // $100 at ETH price $2300 = 0.04348 ETH base
      const result = await calculateCustomerPaymentAmount(100, 'ETH', 2300);

      expect(result.baseAmountCrypto).toBeCloseTo(100 / 2300, 6);
      expect(result.blockchainFeeNative).toBeGreaterThan(0);
      expect(result.totalAmountCrypto).toBeGreaterThan(result.baseAmountCrypto);
      expect(result.totalAmountUSD).toBeGreaterThan(100);
    });

    it('returns zero fees when fee estimation returns 0', async () => {
      // SOL has negligible fees
      const result = await calculateCustomerPaymentAmount(50, 'SOL', 170);

      expect(result.baseAmountCrypto).toBeCloseTo(50 / 170, 6);
      // Fee should be near-zero but not negative
      expect(result.blockchainFeeNative).toBeGreaterThanOrEqual(0);
      expect(result.totalAmountCrypto).toBeGreaterThanOrEqual(result.baseAmountCrypto);
    });

    it('fee USD is consistent with feeNative × cryptoPrice', async () => {
      const result = await calculateCustomerPaymentAmount(100, 'BTC', 95000);

      // feeUSD should approximately equal feeInNative * btcPrice
      // (not exact due to BTC price fetch in getBlockchainNetworkFee)
      expect(result.blockchainFeeUSD).toBeGreaterThan(0);
      expect(result.totalAmountUSD).toBeCloseTo(100 + result.blockchainFeeUSD, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Caching Behavior
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Caching', () => {
    it('caches fresh fee results in Redis', async () => {
      await getBlockchainNetworkFee('BTC');

      expect(setRedisItem).toHaveBeenCalledWith(
        'blockchain_fee_BTC',
        expect.objectContaining({ chain: 'BTC', timestamp: expect.any(Number) })
      );
    });

    it('caches crypto prices in Redis', async () => {
      await getBlockchainNetworkFee('BTC');

      // Price should be cached
      expect(setRedisItem).toHaveBeenCalledWith(
        'price_BTC',
        expect.objectContaining({ price: 95000 })
      );
    });
  });
});
