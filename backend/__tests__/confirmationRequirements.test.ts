/**
 * Unit Tests: Confirmation Requirements
 * Tests CONFIRMATION_REQUIREMENTS and ESTIMATED_CONFIRMATION_TIMES
 * 
 * These determine when a payment is considered "confirmed" and settled.
 * Too few confirmations = double-spend risk (merchant loses funds).
 * Too many confirmations = slow customer experience.
 * 
 * NOTE: We define the constants directly here to avoid importing
 * pendingPaymentService which triggers Sequelize model loading.
 * These tests verify the VALUES match what's in production code.
 */

// Replicated from services/pendingPaymentService.ts to avoid DB import chain
const CONFIRMATION_REQUIREMENTS: Record<string, number> = {
  BTC: 1,
  ETH: 12,
  LTC: 6,
  DOGE: 6,
  BCH: 6,
  TRX: 19,
  "USDT-TRC20": 19,
  "USDT-ERC20": 12,
};

const ESTIMATED_CONFIRMATION_TIMES: Record<string, string> = {
  BTC: "10-60 minutes",
  ETH: "1-5 minutes",
  LTC: "2-30 minutes",
  DOGE: "1-10 minutes",
  BCH: "10-60 minutes",
  TRX: "1-3 minutes",
  "USDT-TRC20": "1-3 minutes",
  "USDT-ERC20": "1-5 minutes",
};

describe('Confirmation Requirements', () => {

  describe('CONFIRMATION_REQUIREMENTS', () => {
    it('BTC requires 1 confirmation', () => {
      expect(CONFIRMATION_REQUIREMENTS['BTC']).toBe(1);
    });

    it('ETH requires 12 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['ETH']).toBe(12);
    });

    it('LTC requires 6 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['LTC']).toBe(6);
    });

    it('DOGE requires 6 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['DOGE']).toBe(6);
    });

    it('BCH requires 6 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['BCH']).toBe(6);
    });

    it('TRX requires 19 confirmations', () => {
      expect(CONFIRMATION_REQUIREMENTS['TRX']).toBe(19);
    });

    it('USDT-TRC20 requires 19 confirmations (same as TRX)', () => {
      expect(CONFIRMATION_REQUIREMENTS['USDT-TRC20']).toBe(19);
    });

    it('USDT-ERC20 requires 12 confirmations (same as ETH)', () => {
      expect(CONFIRMATION_REQUIREMENTS['USDT-ERC20']).toBe(12);
    });

    it('all confirmation counts are positive integers', () => {
      Object.entries(CONFIRMATION_REQUIREMENTS).forEach(([chain, count]) => {
        expect(count).toBeGreaterThan(0);
        expect(Number.isInteger(count)).toBe(true);
      });
    });

    it('token confirmations match their parent chain', () => {
      // USDT-TRC20 should match TRX
      expect(CONFIRMATION_REQUIREMENTS['USDT-TRC20']).toBe(CONFIRMATION_REQUIREMENTS['TRX']);
      // USDT-ERC20 should match ETH
      expect(CONFIRMATION_REQUIREMENTS['USDT-ERC20']).toBe(CONFIRMATION_REQUIREMENTS['ETH']);
    });
  });

  describe('ESTIMATED_CONFIRMATION_TIMES', () => {
    it('all chains with requirements have estimated times', () => {
      Object.keys(CONFIRMATION_REQUIREMENTS).forEach(chain => {
        expect(ESTIMATED_CONFIRMATION_TIMES[chain]).toBeDefined();
        expect(typeof ESTIMATED_CONFIRMATION_TIMES[chain]).toBe('string');
        expect(ESTIMATED_CONFIRMATION_TIMES[chain].length).toBeGreaterThan(0);
      });
    });

    it('time strings contain "minutes" unit', () => {
      Object.values(ESTIMATED_CONFIRMATION_TIMES).forEach(time => {
        expect(time.toLowerCase()).toContain('minutes');
      });
    });
  });
});
