/**
 * Unit Tests: opt-in webhook events (Tier-1 audit item #2)
 *
 * Covers the two things that must never regress:
 *   1. An opt-in event is ONLY delivered to a company that subscribed —
 *      existing merchants must keep receiving exactly the legacy set.
 *   2. Each opt-in event is emitted at most once per payment (the verify
 *      endpoint it hangs off is polled by the checkout page).
 */

jest.mock('../utils/loggers', () => ({
  webhookLogs: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  log: jest.fn(),
}));

jest.mock('../webhooks', () => ({
  callMerchantWebhook: jest.fn().mockResolvedValue({ success: true }),
}));

import sequelize from '../utils/dbInstance';
import { redis } from '../utils/redisInstance';
import { callMerchantWebhook } from '../webhooks';
import {
  OPT_IN_WEBHOOK_EVENTS,
  isOptInWebhookEvent,
  isEventSubscribed,
  parseSubscribedEvents,
  claimEmitOnce,
  emitPaymentCreated,
  emitPaymentOverpaid,
} from '../services/webhookEvents';

const mockQuery = sequelize.query as jest.Mock;
const mockCall = callMerchantWebhook as jest.Mock;
const mockSet = redis.set as jest.Mock;

const subscribeTo = (events: string[] | null) =>
  mockQuery.mockResolvedValue([{ webhook_events: events }]);

beforeEach(() => {
  jest.clearAllMocks();
  mockSet.mockResolvedValue('OK'); // NX claim succeeds by default
});

describe('event catalogue', () => {
  it('classifies opt-in vs legacy events', () => {
    expect(OPT_IN_WEBHOOK_EVENTS).toEqual(['payment.created', 'payment.expired', 'payment.overpaid']);
    expect(isOptInWebhookEvent('payment.created')).toBe(true);
    expect(isOptInWebhookEvent('payment.confirmed')).toBe(false);
  });

  it('always allows legacy events regardless of subscription state', () => {
    expect(isEventSubscribed(null, 'payment.confirmed')).toBe(true);
    expect(isEventSubscribed([], 'payment.pending')).toBe(true);
    expect(isEventSubscribed(['payment.created'], 'payment.settled')).toBe(true);
  });

  it('gates opt-in events on an explicit subscription', () => {
    expect(isEventSubscribed(null, 'payment.created')).toBe(false);
    expect(isEventSubscribed([], 'payment.created')).toBe(false);
    expect(isEventSubscribed(['payment.expired'], 'payment.created')).toBe(false);
    expect(isEventSubscribed(['payment.created'], 'payment.created')).toBe(true);
  });

  it('parses JSONB arrays and JSON text alike', () => {
    expect(parseSubscribedEvents(['payment.created'])).toEqual(['payment.created']);
    expect(parseSubscribedEvents('["payment.expired"]')).toEqual(['payment.expired']);
    expect(parseSubscribedEvents(null)).toEqual([]);
    expect(parseSubscribedEvents('not json')).toEqual([]);
  });
});

describe('claimEmitOnce', () => {
  it('claims once and refuses the second attempt', async () => {
    mockSet.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    await expect(claimEmitOnce('created:pay_1')).resolves.toBe(true);
    await expect(claimEmitOnce('created:pay_1')).resolves.toBe(false);
  });

  it('delivers rather than drops when Redis is unavailable', async () => {
    mockSet.mockRejectedValueOnce(new Error('redis down'));
    await expect(claimEmitOnce('created:pay_2')).resolves.toBe(true);
  });
});

describe('emitPaymentCreated', () => {
  const customer = { company_id: 42, link_id: 7, webhook_url: 'https://merchant.test/hook' };
  const fields = {
    payment_id: 'pay_abc',
    address: '0xabc',
    amount: 0.005,
    currency: 'ETH',
    base_amount: 12.5,
    base_currency: 'USD',
    link_id: 7,
  };

  it('does nothing when the merchant has not subscribed', async () => {
    subscribeTo(null);
    const res = await emitPaymentCreated(customer, fields);
    expect(res).toEqual({ emitted: false, reason: 'not_subscribed' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('delivers when subscribed, with payment_link type and created status', async () => {
    subscribeTo(['payment.created']);
    const res = await emitPaymentCreated(customer, fields);
    expect(res.emitted).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [, payload] = mockCall.mock.calls[0];
    expect(payload.event).toBe('payment.created');
    expect(payload.payment_type).toBe('payment_link');
    expect(payload.status).toBe('created');
    expect(payload.payment_id).toBe('pay_abc');
    expect(payload.created_at).toBeTruthy();
  });

  it('marks payments without a link as direct_api', async () => {
    subscribeTo(['payment.created']);
    await emitPaymentCreated({ company_id: 42 }, { ...fields, link_id: null });
    const [, payload] = mockCall.mock.calls[0];
    expect(payload.payment_type).toBe('direct_api');
  });

  it('skips when there is no company to check', async () => {
    const res = await emitPaymentCreated({}, fields);
    expect(res).toEqual({ emitted: false, reason: 'no_company' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('never emits twice for the same payment', async () => {
    subscribeTo(['payment.created']);
    mockSet.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const first = await emitPaymentCreated(customer, fields);
    const second = await emitPaymentCreated(customer, fields);
    expect(first.emitted).toBe(true);
    expect(second).toEqual({ emitted: false, reason: 'duplicate' });
    expect(mockCall).toHaveBeenCalledTimes(1);
  });
});

describe('emitPaymentOverpaid', () => {
  it('carries the excess amounts to the merchant', async () => {
    subscribeTo(['payment.overpaid']);
    const res = await emitPaymentOverpaid(
      { company_id: 9, webhook_url: 'https://merchant.test/hook' },
      {
        payment_id: 'pay_over',
        amount_received: 0.0072,
        amount_expected: 0.00512,
        excess_amount: 0.00208,
        excess_amount_usd: 5.08,
        currency: 'ETH',
        txId: '0xdead',
      }
    );
    expect(res.emitted).toBe(true);
    const [, payload] = mockCall.mock.calls[0];
    expect(payload.event).toBe('payment.overpaid');
    expect(payload.excess_amount_usd).toBe(5.08);
    expect(payload.transaction_reference).toBe('0xdead');
    expect(payload.status).toBe('overpaid');
  });

  it('stays silent for a merchant subscribed only to other events', async () => {
    subscribeTo(['payment.created']);
    const res = await emitPaymentOverpaid(
      { company_id: 9 },
      {
        payment_id: 'pay_over_2',
        amount_received: 1,
        amount_expected: 0.5,
        excess_amount: 0.5,
        excess_amount_usd: 20,
      }
    );
    expect(res.reason).toBe('not_subscribed');
    expect(mockCall).not.toHaveBeenCalled();
  });
});
