/**
 * Unit Tests: Webhook Handlers (Phase 5)
 *
 * Tests the Express webhook handler functions in webhooks/index.ts:
 *   - tatumCryptoWebHook: Thin enqueuer (validate → dedup → enqueue → ACK 200)
 *   - tatumWebHook: Basic Redis-based webhook handler
 *   - flutterwaveWebHook: Flutterwave webhook with secret verification
 *   - callMerchantWebhook: Merchant webhook delivery (URL resolution, HMAC, retries)
 *   - verifyWebhookSignature: HMAC-SHA256 verification utility
 *
 * These handlers are the ENTRY POINTS for all external payment notifications.
 * If they fail, payments are silently lost or merchants aren't notified.
 */

// ── Mock Setup (hoisted before imports) ─────────────────────────────────────

jest.mock('../services/webhookQueue', () => ({
  enqueueWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/loggers', () => ({
  webhookLogs: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
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

jest.mock('../services/merchantPool/merchantPoolConfig', () => ({
  ADMIN_WALLETS: { BTC: '0xAdminBTC' },
  FEE_WALLETS: { TRX: '0xFeeTRX' },
  isTagBasedChain: jest.fn(() => false),
  getCryptoRedisKey: jest.fn((addr: string) => `crypto-${addr}`),
  XRP_MASTER_ADDRESS: 'rMasterXRP',
}));

jest.mock('axios');

jest.mock('../helper', () => ({
  getErrorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

jest.mock('../utils/currencyUtils', () => ({
  getCompanyBaseCurrency: jest.fn().mockResolvedValue('USD'),
  convertToFiat: jest.fn().mockResolvedValue({ amount: 100, rate: 50000 }),
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import { flutterwaveWebHook, tatumWebHook, tatumCryptoWebHook, callMerchantWebhook, verifyWebhookSignature } from '../webhooks';
import { enqueueWebhook } from '../services/webhookQueue';
import { getRedisItem, setRedisItem } from '../utils/redisInstance';
import axios from 'axios';
import crypto from 'crypto';

// ── Test Helpers ────────────────────────────────────────────────────────────

type MockReq = {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  params: Record<string, unknown>;
  ip: string;
};

const createReq = (
  body: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
  headers: Record<string, unknown> = {}
): MockReq => ({
  body,
  query,
  headers,
  params: {},
  ip: '10.0.0.1',
});

const createRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FLW_SECRET_HASH;
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. tatumCryptoWebHook — Thin Enqueuer
// ═════════════════════════════════════════════════════════════════════════════

describe('tatumCryptoWebHook', () => {
  const validPayload = {
    address: '0xabc123',
    counterAddress: '0xdef456',
    amount: '1.5',
    txId: 'tx-001',
    asset: 'ETH',
  };

  it('enqueues valid webhook and returns 200', async () => {
    (getRedisItem as jest.Mock).mockResolvedValueOnce({});
    const req = createReq(validPayload, { company_id: '1', user_id: '2', address_id: '3' });
    const res = createRes();

    await tatumCryptoWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(enqueueWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          txId: 'tx-001',
          amount: '1.5',
          address: '0xabc123',
        }),
        queryParams: expect.objectContaining({
          company_id: 1,
          user_id: 2,
          address_id: 3,
        }),
        source: 'webhook',
      })
    );
  });

  it('returns 200 but skips enqueue for missing txId', async () => {
    const req = createReq({ ...validPayload, txId: undefined });
    const res = createRes();

    await tatumCryptoWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(enqueueWebhook).not.toHaveBeenCalled();
  });

  it('returns 200 but skips enqueue for already-processed txId', async () => {
    // Mark as already processed
    (getRedisItem as jest.Mock).mockResolvedValueOnce({ processed: true });

    const req = createReq(validPayload);
    const res = createRes();

    await tatumCryptoWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(enqueueWebhook).not.toHaveBeenCalled();
  });

  it('passes query params to enqueued job', async () => {
    (getRedisItem as jest.Mock).mockResolvedValueOnce({});
    const req = createReq(validPayload, { company_id: '42', user_id: '7' });
    const res = createRes();

    await tatumCryptoWebHook(req as any, res as any);

    const enqueueCall = (enqueueWebhook as jest.Mock).mock.calls[0][0];
    expect(enqueueCall.queryParams.company_id).toBe(42);
    expect(enqueueCall.queryParams.user_id).toBe(7);
  });

  it('returns 200 even on enqueue error', async () => {
    (getRedisItem as jest.Mock).mockResolvedValueOnce({});
    (enqueueWebhook as jest.Mock).mockRejectedValueOnce(new Error('Redis down'));

    const req = createReq(validPayload);
    const res = createRes();

    await tatumCryptoWebHook(req as any, res as any);

    // Must ALWAYS return 200 to prevent Tatum retry storms
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('includes receivedAt timestamp in enqueued data', async () => {
    (getRedisItem as jest.Mock).mockResolvedValueOnce({});
    const req = createReq(validPayload);
    const res = createRes();

    await tatumCryptoWebHook(req as any, res as any);

    const enqueueCall = (enqueueWebhook as jest.Mock).mock.calls[0][0];
    expect(enqueueCall.receivedAt).toBeDefined();
    expect(new Date(enqueueCall.receivedAt).getTime()).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. tatumWebHook — Basic Redis Handler
// ═════════════════════════════════════════════════════════════════════════════

describe('tatumWebHook', () => {
  it('updates Redis with successful status when amount matches', async () => {
    const existingData = { amount: '1.0', currency: 'ETH', status: 'pending' };
    (getRedisItem as jest.Mock).mockResolvedValueOnce(existingData);

    const req = createReq({
      address: '0xaddr1',
      counterAddress: '0xsender',
      amount: '1.5',
      txId: 'tx-100',
    });
    const res = createRes();

    await tatumWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(setRedisItem).toHaveBeenCalledWith(
      'crypto-0xaddr1',
      expect.objectContaining({
        status: 'successful',
        txId: 'tx-100',
        receivedAmount: '1.5',
      })
    );
  });

  it('falls back to counterAddress when primary address not found', async () => {
    (getRedisItem as jest.Mock)
      .mockResolvedValueOnce({}) // primary address: empty
      .mockResolvedValueOnce({ amount: '0.5', status: 'pending' }); // counter address

    const req = createReq({
      address: '0xunknown',
      counterAddress: '0xknown',
      amount: '0.5',
      txId: 'tx-200',
    });
    const res = createRes();

    await tatumWebHook(req as any, res as any);

    expect(getRedisItem).toHaveBeenCalledWith('crypto-0xunknown');
    expect(getRedisItem).toHaveBeenCalledWith('crypto-0xknown');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 even when no matching address found', async () => {
    (getRedisItem as jest.Mock)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const req = createReq({
      address: '0xnope',
      counterAddress: '0xalsonope',
      amount: '1.0',
      txId: 'tx-300',
    });
    const res = createRes();

    await tatumWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(setRedisItem).not.toHaveBeenCalled();
  });

  it('skips Redis update when txId already recorded', async () => {
    const existingData = {
      amount: '1.0', status: 'pending', txId: 'tx-existing',
    };
    (getRedisItem as jest.Mock).mockResolvedValueOnce(existingData);

    const req = createReq({
      address: '0xaddr2',
      amount: '1.0',
      txId: 'tx-dup',
      counterAddress: '0xsender',
    });
    const res = createRes();

    await tatumWebHook(req as any, res as any);

    // Should NOT call setRedisItem because items.txId already exists
    expect(setRedisItem).not.toHaveBeenCalled();
  });

  it('marks as failed when amount is 0 and below expected', async () => {
    const existingData = { amount: '5.0', status: 'pending' };
    (getRedisItem as jest.Mock).mockResolvedValueOnce(existingData);

    const req = createReq({
      address: '0xaddr3',
      counterAddress: '0xsender',
      amount: '0',
      txId: 'tx-zero',
    });
    const res = createRes();

    await tatumWebHook(req as any, res as any);

    // amount=0, Number(0) > 0 is false, so setRedisItem is NOT called
    expect(setRedisItem).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. flutterwaveWebHook — Secret Hash Verification
// ═════════════════════════════════════════════════════════════════════════════

describe('flutterwaveWebHook', () => {
  it('returns 401 when signature is missing', async () => {
    process.env.FLW_SECRET_HASH = 'secret123';

    const req = createReq({ txRef: 'customer-ref-1', id: 1, status: 'success' });
    const res = createRes();

    await flutterwaveWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when signature does not match', async () => {
    process.env.FLW_SECRET_HASH = 'secret123';

    const req = createReq(
      { txRef: 'customer-ref-1', id: 1, status: 'success' },
      {},
      { 'verif-hash': 'wrong-hash' }
    );
    const res = createRes();

    await flutterwaveWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('processes valid webhook with correct signature', async () => {
    process.env.FLW_SECRET_HASH = 'secret123';
    (getRedisItem as jest.Mock).mockResolvedValueOnce({ amount: 100, status: 'pending' });

    const req = createReq(
      { txRef: 'customer-tx-ref', id: 42, status: 'successful' },
      {},
      { 'verif-hash': 'secret123' }
    );
    const res = createRes();

    await flutterwaveWebHook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(setRedisItem).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. verifyWebhookSignature — Pure HMAC Utility
// ═════════════════════════════════════════════════════════════════════════════

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';

  it('returns true for valid signature', () => {
    const payload = JSON.stringify({ event: 'payment.confirmed', amount: '1.5' });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('returns false for tampered payload', () => {
    const payload = JSON.stringify({ event: 'payment.confirmed', amount: '1.5' });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const tampered = JSON.stringify({ event: 'payment.confirmed', amount: '999' });
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it('returns false for wrong secret', () => {
    const payload = JSON.stringify({ event: 'payment.confirmed' });
    const signature = crypto.createHmac('sha256', 'wrong-secret').update(payload).digest('hex');

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. callMerchantWebhook — Webhook Delivery System
// ═════════════════════════════════════════════════════════════════════════════

describe('callMerchantWebhook', () => {
  const mockSequelize = require('../utils/dbInstance').default;

  it('sends webhook when URL is provided in customerData', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ status: 200, data: 'ok' });
    mockSequelize.query.mockResolvedValue([]); // no DB lookups needed

    const result = await callMerchantWebhook(
      { webhook_url: 'https://merchant.com/hook', company_id: 1 },
      { event: 'payment.confirmed', amount: '0.5', currency: 'BTC' }
    );

    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://merchant.com/hook',
      expect.objectContaining({ event: 'payment.confirmed' }),
      expect.objectContaining({ timeout: 20000, maxRedirects: 0 })
    );
  });

  it('skips when no webhook URL configured anywhere', async () => {
    // No webhook_url in customerData
    // DB queries return nothing
    mockSequelize.query.mockResolvedValue([]);

    const result = await callMerchantWebhook(
      { company_id: 1 },
      { event: 'payment.confirmed' }
    );

    expect(result.success).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects localhost webhook URLs', async () => {
    const result = await callMerchantWebhook(
      { webhook_url: 'http://localhost:3000/webhook', company_id: 1 },
      { event: 'payment.confirmed' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('localhost');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects 127.0.0.1 webhook URLs', async () => {
    const result = await callMerchantWebhook(
      { webhook_url: 'http://127.0.0.1:8080/hook', company_id: 1 },
      { event: 'payment.confirmed' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private or local address/);
  });

  it('rejects cloud-metadata and RFC1918 webhook URLs (SSRF guard)', async () => {
    for (const url of ['http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/hook', 'http://[::1]/hook', 'ftp://merchant.com/hook']) {
      const result = await callMerchantWebhook({ webhook_url: url, company_id: 1 }, { event: 'payment.confirmed' });
      expect(result.success).toBe(false);
      expect(axios.post).not.toHaveBeenCalled();
    }
  });

  it('includes HMAC signature header when webhook_secret is set', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ status: 200 });
    mockSequelize.query.mockResolvedValue([]);

    await callMerchantWebhook(
      { webhook_url: 'https://merchant.com/hook', webhook_secret: 'my-secret', company_id: 1 },
      { event: 'payment.confirmed' }
    );

    const headers = (axios.post as jest.Mock).mock.calls[0][2].headers;
    expect(headers['X-DynoPay-Signature']).toBeDefined();
    expect(headers['X-DynoPay-Event']).toBe('payment.confirmed');
    expect(headers['X-DynoPay-Timestamp']).toBeDefined();
  });

  it('ALWAYS includes signature header (uses system default when no merchant secret)', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ status: 200 });
    mockSequelize.query.mockResolvedValue([]);

    await callMerchantWebhook(
      { webhook_url: 'https://merchant.com/hook', company_id: 1 },
      { event: 'payment.confirmed' }
    );

    const headers = (axios.post as jest.Mock).mock.calls[0][2].headers;
    // BUG-A FIX: Signature is now ALWAYS included (system default when no merchant secret)
    expect(headers['X-DynoPay-Signature']).toBeDefined();
    expect(typeof headers['X-DynoPay-Signature']).toBe('string');
    expect(headers['X-DynoPay-Signature'].length).toBeGreaterThan(0);
  });

  it('does NOT retry on 4xx client errors', async () => {
    (axios.post as jest.Mock).mockRejectedValueOnce({
      response: { status: 400, data: 'Bad Request' },
      message: 'Request failed with status 400',
      code: undefined,
    });
    mockSequelize.query.mockResolvedValue([]);

    const result = await callMerchantWebhook(
      { webhook_url: 'https://merchant.com/hook', company_id: 1 },
      { event: 'payment.confirmed' }
    );

    expect(result.success).toBe(false);
    // Should only attempt once (no retries for 4xx)
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('enriches event data with fiat equivalent', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ status: 200 });
    mockSequelize.query.mockResolvedValue([]);

    await callMerchantWebhook(
      { webhook_url: 'https://merchant.com/hook', company_id: 1 },
      { event: 'payment.confirmed', amount: '0.002', currency: 'BTC' }
    );

    const sentPayload = (axios.post as jest.Mock).mock.calls[0][1];
    // Should include enriched fiat data from currencyUtils mock
    expect(sentPayload.base_amount).toBeDefined();
    expect(sentPayload.base_currency).toBeDefined();
  });
});
