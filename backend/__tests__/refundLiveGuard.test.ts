/**
 * Refund live-guard: ENABLE_CRYPTO_REFUNDS=true + REFUND_DRY_RUN=false in prod while the
 * Phase-C forwarding rails (refundWorker detectDeposit/forwardToCustomer) are still stubs.
 * Creating a LIVE refund must be refused up-front (no pool address reserved, no deposit asked).
 */
jest.mock('../utils/loggers', () => ({
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const flags: Record<string, string | undefined> = {};
jest.mock('../utils/config', () => ({
  config: {
    bool: (k: string) => ['1', 'true', 'yes', 'on'].includes(String(flags[k] ?? '').toLowerCase()),
    str: (k: string) => flags[k],
    raw: (k: string) => flags[k],
  },
  raw: (k: string) => flags[k],
}));

jest.mock('../models/userModels/refundModel', () => ({ __esModule: true, default: { findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn() } }));
jest.mock('../services/merchantPool/merchantPoolReservation', () => ({ reserveAddress: jest.fn() }));
jest.mock('../services/blockchainFeeService', () => ({ getBlockchainNetworkFee: jest.fn() }));
jest.mock('../services/refund/refundEmails', () => ({ sendRefundStatusEmail: jest.fn() }));

import { createRefund, isLiveRefundAvailable, LIVE_REFUND_UNAVAILABLE_MSG } from '../services/refund/refundService';
import { reserveAddress } from '../services/merchantPool/merchantPoolReservation';
import refundModel from '../models/userModels/refundModel';

const input = { sourceType: 'product_order', sourceRef: 'ORD-1', requestedAmount: 1, reason: null, actorUserId: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(flags)) delete flags[k];
});

describe('refund live guard', () => {
  it('LIVE (dry-run off) without forwarding rails → refused before touching the pool or DB', async () => {
    flags.ENABLE_CRYPTO_REFUNDS = 'true';
    flags.REFUND_DRY_RUN = 'false';
    expect(isLiveRefundAvailable()).toBe(false);
    await expect(createRefund(input)).rejects.toThrow(LIVE_REFUND_UNAVAILABLE_MSG);
    expect(reserveAddress).not.toHaveBeenCalled();
    expect((refundModel as any).create).not.toHaveBeenCalled();
  });

  it('dry-run (sandbox) refunds stay available', () => {
    flags.REFUND_DRY_RUN = 'true';
    expect(isLiveRefundAvailable()).toBe(true);
  });

  it('REFUND_FORWARDING_WIRED=true re-enables live refunds', () => {
    flags.REFUND_DRY_RUN = 'false';
    flags.REFUND_FORWARDING_WIRED = 'true';
    expect(isLiveRefundAvailable()).toBe(true);
  });
});
