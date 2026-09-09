/**
 * Unit Tests: Webhook Processor (Phase 2)
 *
 * Tests processWebhookJob — the core pipeline that handles incoming
 * blockchain transaction webhooks from Tatum. This is the most critical
 * piece of business logic: if it fails, payments are lost or double-processed.
 *
 * Pipeline stages tested:
 *   1. Duplicate detection (processed-tx Redis key)
 *   2. Atomic lock acquisition
 *   3. Internal wallet filter (admin/fee wallets)
 *   4. Address resolution (BCH normalization, XRP destination tags, fallbacks)
 *   5. Amount validation
 *   6. Status checks (already-successful payments)
 *   7. Crash recovery for stale "processing" payments
 *   8. New transaction handling (first tx + completion payments)
 *   9. Underpayment logic (payment link wait vs direct API immediate)
 *  10. CryptoVerification with exponential backoff retries
 *  11. Lock release guarantee
 */

// ── Mock Setup (must be before imports) ─────────────────────────────────────

jest.mock('../services/webhookQueue', () => ({}));

jest.mock('../utils/loggers', () => ({
  webhookLogs: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  apiLogger: { info: jest.fn(), error: jest.fn() },
  log: jest.fn(),
}));

jest.mock('../controller', () => ({
  paymentController: {
    cryptoVerification: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../services/pendingPaymentService', () => ({
  sendPendingPaymentNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../apis/tatumApi', () => ({
  default: { getXrpDestinationTag: jest.fn().mockResolvedValue(null) },
  __esModule: true,
}));

jest.mock('../webhooks', () => ({
  callMerchantWebhook: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../services/merchantPool/merchantPoolConfig', () => ({
  ADMIN_WALLETS: { BTC: '0xAdminBTC', ETH: '0xAdminETH' },
  FEE_WALLETS: { TRX: '0xFeeTRX', ETH: '0xFeeETH' },
  isTagBasedChain: jest.fn(() => false),
  getCryptoRedisKey: jest.fn(
    (addr: string, tag?: number | null) =>
      tag != null ? `crypto-${addr}-tag-${tag}` : `crypto-${addr}`
  ),
  XRP_MASTER_ADDRESS: 'rMasterXRP123',
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import { processWebhookJob } from '../services/webhookProcessor';
import {
  getRedisItem,
  setRedisItem,
  setRedisTTL,
  acquireLock,
  releaseLock,
  deleteRedisItem,
} from '../utils/redisInstance';
import { paymentController } from '../controller';
import tatumApi from '../apis/tatumApi';
import { callMerchantWebhook } from '../webhooks';
import { sendPendingPaymentNotification } from '../services/pendingPaymentService';
import { companyModel, merchantPoolTransactionModel } from '../models';

// ── Helpers ─────────────────────────────────────────────────────────────────

// In-memory mock store for Redis — tests set initial state, assertions check calls
let mockStore: Record<string, any> = {};

interface JobDataOverrides {
  address?: string;
  counterAddress?: string;
  amount?: string | number;
  txId?: string;
  asset?: string;
  company_id?: number;
  user_id?: number;
  source?: 'webhook' | 'reconciliation';
}

function createJobData(overrides: JobDataOverrides = {}) {
  return {
    payload: {
      address: overrides.address ?? '0xTestAddress',
      counterAddress: overrides.counterAddress ?? '0xCounterAddress',
      amount: overrides.amount ?? '100',
      txId: overrides.txId ?? 'tx-test-123',
      asset: overrides.asset ?? 'ETH',
    },
    queryParams: {
      company_id: overrides.company_id ?? 1,
      user_id: overrides.user_id ?? 1,
    },
    receivedAt: new Date().toISOString(),
    source: overrides.source ?? ('webhook' as const),
  };
}

function seedRedis(key: string, value: any) {
  mockStore[key] = value;
}

function createRedisPaymentData(overrides: Record<string, unknown> = {}) {
  return {
    amount: '100',
    currency: 'ETH',
    payment_id: 'pay-001',
    company_id: 1,
    user_id: 1,
    ref: 'ref-001',
    status: 'pending',
    ...overrides,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Webhook Processor — processWebhookJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};

    // Wire up getRedisItem to use our mock store
    (getRedisItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(mockStore[key] ?? null)
    );
    // Wire up setRedisItem to track calls AND update mock store
    (setRedisItem as jest.Mock).mockImplementation((key: string, value: any) => {
      mockStore[key] = value;
      return Promise.resolve();
    });

    // Defaults
    (acquireLock as jest.Mock).mockResolvedValue(true);
    (releaseLock as jest.Mock).mockResolvedValue(undefined);
    (setRedisTTL as jest.Mock).mockResolvedValue(undefined);
    (deleteRedisItem as jest.Mock).mockImplementation((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    });
    (paymentController.cryptoVerification as jest.Mock).mockResolvedValue({});
    (callMerchantWebhook as jest.Mock).mockResolvedValue({ success: true });
    (sendPendingPaymentNotification as jest.Mock).mockResolvedValue(undefined);
    (tatumApi.getXrpDestinationTag as jest.Mock).mockResolvedValue(null);
    (companyModel.findOne as jest.Mock).mockResolvedValue(null);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 1: Duplicate Detection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 1 — Duplicate Detection', () => {
    it('skips already-processed transactions', async () => {
      seedRedis('processed-tx-tx-test-123', { processed: true });

      await processWebhookJob(createJobData());

      expect(acquireLock).not.toHaveBeenCalled();
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('processes new transactions not yet in Redis', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(acquireLock).toHaveBeenCalled();
    });

    it('treats empty processed-tx object as not processed', async () => {
      seedRedis('processed-tx-tx-test-123', {});
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(acquireLock).toHaveBeenCalled();
    });

    // Regression: source lives on the job wrapper (data.source), not on payload.
    // The old check read payload.source (always undefined) and skipped every retry.
    it('reconciliation source bypasses dedup, clears stale key, and re-settles a failed payment (LTC payment link)', async () => {
      seedRedis('processed-tx-ltc-tx-1', { processed: true, status: 'settlement_in_progress' });
      seedRedis('crypto-ltc1qFailedAddr', createRedisPaymentData({
        currency: 'LTC', status: 'failed', txId: 'ltc-tx-1', retryCount: '1',
        lastError: 'UTXO fee mismatch', link_id: 'link-abc', payment_id: 'pay-ltc-1',
      }));

      await processWebhookJob(createJobData({
        address: 'ltc1qFailedAddr', txId: 'ltc-tx-1', asset: 'LTC', amount: '0.5', source: 'reconciliation',
      }));

      expect(deleteRedisItem).toHaveBeenCalledWith('processed-tx-ltc-tx-1');
      expect(acquireLock).toHaveBeenCalledWith('tatum-webhook-ltc-tx-1', 300, 1, 50);
      expect(paymentController.cryptoVerification).toHaveBeenCalledWith('ltc1qFailedAddr', true, 'crypto-ltc1qFailedAddr');
      expect(mockStore['crypto-ltc1qFailedAddr'].status).toBe('successful');
    });

    it('webhook source still honours the dedup key (no regression)', async () => {
      seedRedis('processed-tx-tx-test-123', { processed: true });
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ source: 'webhook' }));

      expect(deleteRedisItem).not.toHaveBeenCalled();
      expect(acquireLock).not.toHaveBeenCalled();
    });

    it('reconciliation source does NOT double-settle an already-successful payment', async () => {
      seedRedis('processed-tx-tx-test-123', { processed: true });
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({ status: 'successful', txId: 'tx-test-123' }));

      await processWebhookJob(createJobData({ source: 'reconciliation' }));

      expect(acquireLock).toHaveBeenCalled();
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 2: Atomic Lock
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 2 — Atomic Lock', () => {
    it('skips when lock cannot be acquired', async () => {
      (acquireLock as jest.Mock).mockResolvedValue(false);

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
      expect(releaseLock).not.toHaveBeenCalled();
    });

    it('always releases lock after processing', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(releaseLock).toHaveBeenCalledWith('tatum-webhook-tx-test-123');
    });

    it('releases lock even on error', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());
      (paymentController.cryptoVerification as jest.Mock).mockRejectedValue(
        new Error('invalid address')
      );

      await expect(processWebhookJob(createJobData())).rejects.toThrow();

      expect(releaseLock).toHaveBeenCalledWith('tatum-webhook-tx-test-123');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 3: Internal Wallet Filter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 3 — Internal Wallet Filter', () => {
    it('ignores transfers FROM admin wallets (case-insensitive)', async () => {
      const data = createJobData({ counterAddress: '0xadminbtc' });

      await processWebhookJob(data);

      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-test-123',
        expect.objectContaining({ processed: true, type: 'internal_sweep' })
      );
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores transfers FROM fee wallets', async () => {
      const data = createJobData({ counterAddress: '0xfeetrx' });

      await processWebhookJob(data);

      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-test-123',
        expect.objectContaining({ type: 'internal_sweep' })
      );
    });

    it('processes transfers from external wallets', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ counterAddress: '0xExternalCustomer' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('handles empty counterAddress gracefully', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData({ counterAddress: '' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 4: Address Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 4 — Address Resolution', () => {
    it('resolves payment data from primary address', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('normalizes BCH address with cashaddr prefix', async () => {
      seedRedis('crypto-bitcoincash:0xBCHAddr', createRedisPaymentData({ currency: 'BCH' }));

      await processWebhookJob(createJobData({ address: '0xBCHAddr', asset: 'BCH' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('falls back to counterAddress when primary has no data', async () => {
      seedRedis('crypto-0xCounterAddress', createRedisPaymentData());

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('resolves XRP master address via destination tag', async () => {
      (tatumApi.getXrpDestinationTag as jest.Mock).mockResolvedValue(12345);
      const { getCryptoRedisKey } = require('../services/merchantPool/merchantPoolConfig');
      (getCryptoRedisKey as jest.Mock).mockReturnValue('crypto-rMasterXRP123-tag-12345');
      seedRedis('crypto-rMasterXRP123-tag-12345', createRedisPaymentData({ currency: 'XRP' }));

      await processWebhookJob(createJobData({ address: 'rMasterXRP123', asset: 'XRP' }));

      expect(tatumApi.getXrpDestinationTag).toHaveBeenCalledWith('tx-test-123');
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('handles XRP master address with no destination tag (tagless)', async () => {
      (tatumApi.getXrpDestinationTag as jest.Mock).mockResolvedValue(null);

      await processWebhookJob(createJobData({ address: 'rMasterXRP123', asset: 'XRP' }));

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores webhook when no Redis data found for any address', async () => {
      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 5: Amount Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 5 — Amount Validation', () => {
    beforeEach(() => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData());
    });

    it('ignores zero-amount transactions', async () => {
      await processWebhookJob(createJobData({ amount: '0' }));
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores negative-amount transactions', async () => {
      await processWebhookJob(createJobData({ amount: '-50' }));
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('ignores NaN amounts', async () => {
      await processWebhookJob(createJobData({ amount: 'notanumber' }));
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('processes valid small amounts', async () => {
      await processWebhookJob(createJobData({ amount: '0.0001' }));
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 6: Status Checks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 6 — Already Successful Payments', () => {
    for (const status of ['successful', 'completed', 'recovered']) {
      it(`ignores payment with status "${status}"`, async () => {
        seedRedis('crypto-0xTestAddress', createRedisPaymentData({ status }));

        await processWebhookJob(createJobData());

        expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
      });
    }

    it('processes payment with status "pending"', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({ status: 'pending' }));

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('processes underpaid payment as completion', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        status: 'underpaid',
        incomplete: 'true',
        txId: 'tx-previous-456',
        previousAmount: '50',
        originalExpectedAmount: '100',
      }));

      await processWebhookJob(createJobData({ amount: '50' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 7: Crash Recovery
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 7 — Crash Recovery', () => {
    it('recovers stale "processing" payments older than 60s', async () => {
      const staleTime = new Date(Date.now() - 120_000).toISOString();
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        status: 'processing',
        txId: 'tx-old-789',
        lastAttempt: staleTime,
      }));

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful' })
      );
    });

    it('does NOT trigger recovery for recent "processing" payments', async () => {
      const recentTime = new Date(Date.now() - 30_000).toISOString();
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        status: 'processing',
        txId: 'tx-recent-789',
        lastAttempt: recentTime,
      }));

      await processWebhookJob(createJobData());

      // Not stale + txId already set → duplicate, ignored
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('falls back to direct webhook when recovery cryptoVerification fails', async () => {
      const staleTime = new Date(Date.now() - 120_000).toISOString();
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        status: 'processing',
        txId: 'tx-old-789',
        lastAttempt: staleTime,
        ref: 'ref-001',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1, webhook_url: 'https://merchant.com/hook' });

      (paymentController.cryptoVerification as jest.Mock).mockResolvedValue({
        status: 500,
        message: 'Settlement failed',
      });

      await processWebhookJob(createJobData());

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'payment.confirmed', recovered: true })
      );
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'recovered' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 8: New Transaction Processing
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 8 — New Transaction (First Tx)', () => {
    beforeEach(() => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1 });
    });

    it('processes first transaction and marks as successful', async () => {
      await processWebhookJob(createJobData({ amount: '100' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful', txId: 'tx-test-123' })
      );
    });

    it('sends pending notification', async () => {
      await processWebhookJob(createJobData());

      expect(sendPendingPaymentNotification).toHaveBeenCalled();
    });

    it('sends payment.pending webhook to merchant', async () => {
      await processWebhookJob(createJobData());

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'payment.pending', status: 'pending' })
      );
    });

    it('ignores duplicate tx (same txId already in Redis)', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({ txId: 'tx-test-123' }));

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('marks processed-tx after success', async () => {
      await processWebhookJob(createJobData());

      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-test-123',
        expect.objectContaining({ address: '0xTestAddress' })
      );
    });

    it('sets 48h TTL on processed-tx key', async () => {
      await processWebhookJob(createJobData());

      expect(setRedisTTL).toHaveBeenCalledWith('processed-tx-tx-test-123', 172800);
    });

    it('updates customer ref data on success', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        ref: 'ref-cust-1',
      }));
      seedRedis('ref-cust-1', { adm_id: 1, company_id: 1, status: 'pending' });

      await processWebhookJob(createJobData());

      expect(setRedisItem).toHaveBeenCalledWith(
        'ref-cust-1',
        expect.objectContaining({ status: 'successful', txId: 'tx-test-123' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 8b: Completion Payments
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 8b — Completion Payment', () => {
    it('processes completion payment with combined amount', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        status: 'underpaid',
        incomplete: 'true',
        txId: 'tx-first-part',
        previousAmount: '60',
        originalExpectedAmount: '100',
        amount: '40',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ txId: 'tx-second-part', amount: '40' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful', txId: 'tx-second-part' })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 9: Underpayment Logic
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 9 — Underpayment: Payment Link', () => {
    it('marks underpaid payment link and waits for remaining', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        base_amount: '100', // $100 USD — makes 30% shortfall = $30 > $1 threshold
        link_id: 'link-001',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({
          status: 'underpaid',
          incomplete: 'true',
          receivedAmount: 70,
          amount: 30,
        })
      );
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });

    it('sends underpaid webhook for payment link', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        base_amount: '100',
        link_id: 'link-001',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event: 'payment.underpaid',
          payment_type: 'payment_link',
          amount_received: 70,
          amount_expected: 100,
          amount_remaining: 30,
        })
      );
    });

    it('sets grace period TTL (default 30 min)', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        base_amount: '100',
        link_id: 'link-001',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(setRedisTTL).toHaveBeenCalledWith('crypto-0xTestAddress', 1800);
    });
  });

  describe('Stage 9 — Underpayment: Direct API', () => {
    it('processes underpaid direct API payment immediately', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('sends underpaid webhook with direct_api type', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ amount: '70' }));

      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event: 'payment.underpaid',
          payment_type: 'direct_api',
        })
      );
    });
  });

  describe('Stage 9 — Minor Underpayment (within threshold)', () => {
    it('accepts minor underpayment within $1 threshold', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
        base_amount: '100',
        link_id: 'link-001',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1, link_id: 'link-001' });

      // 99.5/100 → $0.50 shortfall < $1 threshold
      await processWebhookJob(createJobData({ amount: '99.5' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 10: Overpayment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 10 — Overpayment', () => {
    it('processes overpayment normally', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        amount: '100',
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1 });

      await processWebhookJob(createJobData({ amount: '150' }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful', receivedAmount: 150 })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 11: CryptoVerification & Retries
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 11 — CryptoVerification', () => {
    beforeEach(() => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({ txId: undefined }));
      seedRedis('ref-001', { adm_id: 1, company_id: 1 });
    });

    it('succeeds on first attempt', async () => {
      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable error and succeeds', async () => {
      (paymentController.cryptoVerification as jest.Mock)
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({});

      await processWebhookJob(createJobData());

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(2);
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'successful' })
      );
    }, 15000);

    it('does NOT retry non-retryable errors (invalid address)', async () => {
      (paymentController.cryptoVerification as jest.Mock).mockRejectedValue(
        new Error('invalid address')
      );

      await expect(processWebhookJob(createJobData())).rejects.toThrow('invalid address');

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(1);
    });

    it('marks payment as failed after all retries exhausted', async () => {
      (paymentController.cryptoVerification as jest.Mock).mockRejectedValue(
        new Error('server error')
      );

      await expect(processWebhookJob(createJobData())).rejects.toThrow('server error');

      expect(paymentController.cryptoVerification).toHaveBeenCalledTimes(3);
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xTestAddress',
        expect.objectContaining({ status: 'failed' })
      );
    }, 30000);

    it('records failed payment details in Redis', async () => {
      (paymentController.cryptoVerification as jest.Mock).mockRejectedValue(
        new Error('server error')
      );

      await expect(processWebhookJob(createJobData())).rejects.toThrow();

      expect(setRedisItem).toHaveBeenCalledWith(
        'failed-payment-tx-test-123',
        expect.objectContaining({
          address: '0xTestAddress',
          txId: 'tx-test-123',
          currency: 'ETH',
          company_id: 1,
          error: 'server error',
        })
      );
    }, 30000);

    it('handles cryptoVerification returning error status code', async () => {
      (paymentController.cryptoVerification as jest.Mock).mockResolvedValue({
        status: 500,
        message: 'Internal error',
      });

      await expect(processWebhookJob(createJobData())).rejects.toThrow(
        'cryptoVerification error 500'
      );
    }, 30000);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 12: Query Param Enrichment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stage 12 — Query Param Enrichment', () => {
    it('enriches items with company_id from query params', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        company_id: undefined,
      }));
      seedRedis('ref-001', { adm_id: 1 });

      await processWebhookJob(createJobData({ company_id: 42 }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('does NOT override existing company_id', async () => {
      seedRedis('crypto-0xTestAddress', createRedisPaymentData({
        txId: undefined,
        company_id: 99,
      }));
      seedRedis('ref-001', { adm_id: 1, company_id: 99 });

      await processWebhookJob(createJobData({ company_id: 42 }));

      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Full Pipeline Happy Path
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full Pipeline — Happy Path', () => {
    it('processes standard ETH payment end-to-end', async () => {
      seedRedis('crypto-0xPaymentAddr', createRedisPaymentData({
        txId: undefined,
        amount: '0.05',
        currency: 'ETH',
        payment_id: 'pay-full-001',
        ref: 'ref-full-001',
      }));
      seedRedis('ref-full-001', {
        adm_id: 1,
        company_id: 1,
        customer_name: 'Alice',
        email: 'alice@example.com',
      });

      const data = createJobData({
        address: '0xPaymentAddr',
        counterAddress: '0xCustomerWallet',
        amount: '0.05',
        txId: 'tx-eth-001',
        asset: 'ETH',
        company_id: 1,
      });

      await processWebhookJob(data);

      expect(acquireLock).toHaveBeenCalledWith('tatum-webhook-tx-eth-001', 300, 1, 50);
      expect(sendPendingPaymentNotification).toHaveBeenCalled();
      expect(callMerchantWebhook).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ event: 'payment.pending' })
      );
      expect(paymentController.cryptoVerification).toHaveBeenCalledWith(
        '0xPaymentAddr',
        true,
        'crypto-0xPaymentAddr'
      );
      expect(setRedisItem).toHaveBeenCalledWith(
        'crypto-0xPaymentAddr',
        expect.objectContaining({ status: 'successful' })
      );
      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-eth-001',
        expect.objectContaining({ address: '0xPaymentAddr', payment_id: 'pay-full-001' })
      );
      expect(releaseLock).toHaveBeenCalledWith('tatum-webhook-tx-eth-001');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Regression: isOwnOutgoingTransaction must NOT treat counterAddress as sender
  // (bug from commit 61cc2422; caused every ERC-20 incoming to be dropped)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Regression — Tatum ERC-20 incoming NOT misclassified as our-own-outgoing', () => {
    it('processes an ERC-20 incoming transfer where counterAddress is our subscribed pool addr', async () => {
      // isOwnOutgoingTransaction's dynamic import("../models") resolves through the
      // global moduleNameMapper to __tests__/__mocks__/models.ts, whose pool models
      // default to findOne → null (no match) — exactly what this test needs.
      // (A jest.doMock('../models') here would get CACHED as an explicit mock and
      // then shadow the shared mock for ALL later tests in this file — never do it.)

      seedRedis(
        'crypto-0xOurPoolAddr',
        createRedisPaymentData({
          amount: '52',
          currency: 'USDT-ERC20',
          payment_id: 'pay-erc20-001',
        })
      );

      // Tatum ERC-20 incoming: payload.address = external sender,
      // payload.counterAddress = OUR pool addr (the subscribed receiver)
      const data = createJobData({
        address: '0xExternalSender',
        counterAddress: '0xOurPoolAddr',
        amount: '52',
        txId: 'tx-erc20-001',
        asset: 'USDT-ERC20',
        company_id: 1,
      });

      await processWebhookJob(data);

      // Must NOT bail early — must attempt to acquire lock (bug would skip this)
      expect(acquireLock).toHaveBeenCalled();
      // Must NOT mark the tx as our-own-outgoing (the bug wrote this key)
      expect(setRedisItem).not.toHaveBeenCalledWith(
        'processed-tx-tx-erc20-001',
        expect.objectContaining({ type: expect.stringMatching(/^own_outgoing_/) })
      );
      // The fallback path should find the session via counterAddress and proceed
      expect(paymentController.cryptoVerification).toHaveBeenCalled();
    });

    it('correctly recognises OUR previously-recorded merchant settlement tx as our own outgoing', async () => {
      // Signal: this txId already exists in tbl_merchant_pool_transaction as merchant_tx_id.
      // NOTE: jest.doMock('../models') does NOT work here — '../models' is globally
      // mapped to __tests__/__mocks__/models.ts and already cached in the registry, so
      // the doMock factory was never used (the check then fail-opened to null and this
      // test failed). Override the shared mock's findOne for this one call instead.
      (merchantPoolTransactionModel.findOne as jest.Mock).mockResolvedValueOnce({
        pool_tx_id: 42,
        merchant_tx_id: 'tx-known-settle-001',
        gas_funding_tx_id: null,
      });

      const data = createJobData({
        address: '0xOurPoolAddr',
        counterAddress: '0xMerchantWallet',
        amount: '50.22',
        txId: 'tx-known-settle-001',
        asset: 'USDT-ERC20',
        company_id: 1,
      });

      await processWebhookJob(data);

      // Must bail early and mark as our-own-outgoing
      expect(setRedisItem).toHaveBeenCalledWith(
        'processed-tx-tx-known-settle-001',
        expect.objectContaining({ type: expect.stringMatching(/^own_outgoing_/) })
      );
      // Must NOT try to acquire main lock or call cryptoVerification
      expect(paymentController.cryptoVerification).not.toHaveBeenCalled();
    });
  });
});
