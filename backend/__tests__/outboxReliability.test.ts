/**
 * Outbox reliability — regressions from the 2026-09-28 prod sweep:
 *  (1) a row claimed as `processing` whose worker died must be reclaimed (recent → pending,
 *      >24h → failed, never redelivered as a stale intermediate event);
 *  (2) when one of several merchant endpoints fails, the retry must hit ONLY the failed
 *      endpoint (payload.deliveredTargets), never double-deliver to the healthy one.
 */

jest.mock("../utils/loggers", () => ({
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  webhookLogs: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const updateMock: jest.Mock = jest.fn(async (..._a: any[]) => [1]);
jest.mock("../models/outboxEventModel", () => ({
  __esModule: true,
  default: { update: (...a: any[]) => updateMock(...a), create: jest.fn(), findOne: jest.fn() },
}));

const callMerchantWebhook = jest.fn();
jest.mock("../webhooks", () => ({ callMerchantWebhook: (...a: any[]) => callMerchantWebhook(...a) }));

import sequelize from "../utils/dbInstance";
import {
  relayPendingBatch,
  reclaimStaleProcessing,
  registerDispatcher,
  OutboxPartialFailure,
  PROCESSING_LEASE_MS,
} from "../services/outbox/outboxService";
import { registerDefaultOutboxDispatchers } from "../services/outbox/outboxDispatchers";
import { MERCHANT_WEBHOOK_EVENT_TYPE } from "../services/outbox/merchantWebhookOutbox";

const q = sequelize.query as jest.Mock;
const tx = sequelize.transaction as jest.Mock;

const claimed = (over: Record<string, unknown> = {}) => ({
  id: 612,
  event_id: "evt-612",
  aggregate_type: "payment",
  aggregate_id: "f8e1ca0e",
  event_type: MERCHANT_WEBHOOK_EVENT_TYPE,
  payload: { customerData: { company_id: 71 }, eventData: { event: "payment.confirmed" } },
  attempts: 0,
  max_attempts: 20,
  correlation_id: null,
  ...over,
});

/** sequelize.query mock: 1st call = reclaim UPDATE…RETURNING, 2nd = claim SELECT, 3rd = claim UPDATE. */
function wireQueries(reclaimRows: any[], claimRows: any[]) {
  q.mockReset();
  q.mockImplementation(async (sql: string) => {
    if (/UPDATE tbl_outbox\s+SET status = CASE/.test(sql)) return reclaimRows;
    if (/SELECT id, event_id/.test(sql)) return claimRows;
    return [];
  });
  tx.mockImplementation(async (fn: any) => fn({}));
}

beforeAll(() => registerDefaultOutboxDispatchers());
beforeEach(() => {
  updateMock.mockClear();
  callMerchantWebhook.mockReset();
});

describe("stale processing lease", () => {
  it("claim stamps a lease on available_at and reclaim runs before every claim", async () => {
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({ success: true, delivered: ["https://a.example/hook"], failed: [] });
    await relayPendingBatch(10);
    const sqls = q.mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toMatch(/UPDATE tbl_outbox\s+SET status = CASE/); // reclaim first
    expect(sqls.some((s) => /SET status = 'processing', available_at = NOW\(\) \+ make_interval/.test(s))).toBe(true);
    const claimUpd = q.mock.calls.find((c) => /status = 'processing'/.test(String(c[0])));
    expect(claimUpd?.[1]?.replacements?.leaseS).toBe(PROCESSING_LEASE_MS / 1000);
  });

  it("reclaim reports requeued vs closed rows from the RETURNING set", async () => {
    wireQueries(
      [
        { id: 900, event_id: "e900", event_type: MERCHANT_WEBHOOK_EVENT_TYPE, status: "pending" },
        { id: 612, event_id: "e612", event_type: MERCHANT_WEBHOOK_EVENT_TYPE, status: "failed" },
      ],
      []
    );
    const r = await reclaimStaleProcessing();
    expect(r).toEqual({ requeued: 1, closed: 1 });
    const sql = String(q.mock.calls[0][0]);
    expect(sql).toMatch(/WHERE status = 'processing' AND available_at <= NOW\(\) - make_interval/);
    expect(sql).toMatch(/not redelivered/);
  });

  it("a reclaim failure never blocks the relay", async () => {
    q.mockReset();
    let n = 0;
    q.mockImplementation(async (sql: string) => {
      if (/SET status = CASE/.test(sql)) { n++; throw new Error("db hiccup"); }
      if (/SELECT id, event_id/.test(sql)) return [];
      return [];
    });
    tx.mockImplementation(async (fn: any) => fn({}));
    await expect(relayPendingBatch(10)).resolves.toEqual({ dispatched: 0, retried: 0 });
    expect(n).toBe(1);
  });
});

describe("per-target merchant webhook retries", () => {
  const A = "https://samdav1.up.railway.app/dynopay/crypto-wallet";
  const B = "https://samdav1.up.railway.app/api/store/crypto-webhook";

  it("one 404 among two endpoints → row retried with deliveredTargets so only the failed one is re-sent", async () => {
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({
      success: true,
      delivered: [A],
      failed: [{ url: B, error: "Request failed with status code 404" }],
    });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 0, retried: 1 });
    expect(callMerchantWebhook).toHaveBeenCalledWith(expect.anything(), expect.anything(), { skipUrls: [] });
    const [fields] = updateMock.mock.calls[0] as any[];
    expect(fields.status).toBe("pending");
    expect(fields.attempts).toBe(1);
    expect(fields.payload.deliveredTargets).toEqual([A]);
    expect(fields.payload.eventData.event).toBe("payment.confirmed");
    expect(fields.last_error).toContain(B);
  });

  it("the retry passes deliveredTargets as skipUrls and completes once the failed endpoint accepts", async () => {
    wireQueries([], [claimed({ attempts: 1, payload: { customerData: {}, eventData: { event: "payment.confirmed" }, deliveredTargets: [A] } })]);
    callMerchantWebhook.mockResolvedValue({ success: true, delivered: [B], failed: [] });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 1, retried: 0 });
    expect(callMerchantWebhook).toHaveBeenCalledWith(expect.anything(), expect.anything(), { skipUrls: [A] });
    const [fields] = updateMock.mock.calls[0] as any[];
    expect(fields.status).toBe("dispatched");
  });

  it("permanent failures (private URL / disabled endpoint) are not retried", async () => {
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({
      success: true,
      delivered: [A],
      failed: [{ url: "http://[::ffff:127.0.0.1]:8001/x", error: 'Webhook URL "…" points to a private or local address which is unreachable from Dynopay servers.' }],
    });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 1, retried: 0 });
  });

  it("merchant-side 4xx flagged permanent → NOT retried (2026-10 sweep: 400s stuck 12 rows)", async () => {
    // Sole failure is a permanent 4xx (webhooks/index.ts sets permanent:true).
    // The error STRING is a plain axios message that does NOT match PERMANENT_SKIP,
    // so only the explicit flag can stop the retry storm.
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({
      success: false,
      error: "Request failed with status code 400",
      permanent: true,
      delivered: [],
      failed: [{ url: B, error: "Request failed with status code 400", permanent: true }],
    });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 1, retried: 0 });
  });

  it("legacy shape with top-level permanent:true (no per-target arrays) → NOT retried", async () => {
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({ success: false, error: "Request failed with status code 422", permanent: true });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 1, retried: 0 });
  });

  it("merchant 5xx is NOT permanent → still retried (transient server error)", async () => {
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({
      success: false,
      error: "Request failed with status code 500",
      delivered: [],
      failed: [{ url: B, error: "Request failed with status code 500", permanent: false }],
    });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 0, retried: 1 });
  });

  it("all endpoints failing transiently → plain retry (no deliveredTargets)", async () => {
    wireQueries([], [claimed()]);
    callMerchantWebhook.mockResolvedValue({ success: false, error: "timeout of 10000ms exceeded", url: A, delivered: [], failed: [{ url: A, error: "timeout of 10000ms exceeded" }, { url: B, error: "timeout of 10000ms exceeded" }] });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 0, retried: 1 });
    const [fields] = updateMock.mock.calls[0] as any[];
    expect(fields.status).toBe("pending");
    expect(fields.payload).toBeUndefined();
  });

  it("OutboxPartialFailure carries the delivered set", () => {
    const e = new OutboxPartialFailure("x", [A]);
    expect(e).toBeInstanceOf(Error);
    expect(e.deliveredTargets).toEqual([A]);
    expect(e.name).toBe("OutboxPartialFailure");
  });

  it("legacy dispatcher result shape (no per-target arrays) still works", async () => {
    registerDispatcher("noop.test", async () => undefined);
    wireQueries([], [claimed({ event_type: MERCHANT_WEBHOOK_EVENT_TYPE })]);
    callMerchantWebhook.mockResolvedValue({ success: false, error: "Request failed with status code 502" });
    const r = await relayPendingBatch(10);
    expect(r).toEqual({ dispatched: 0, retried: 1 });
  });
});
