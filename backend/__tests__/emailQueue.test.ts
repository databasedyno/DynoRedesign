/**
 * Durable email queue (2026-10): worker semantics + Brevo bounce handling + transporter contract.
 */
jest.mock("../utils/loggers", () => ({
  log: jest.fn(),
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  adminLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../services/errorMonitoringService", () => ({ captureError: jest.fn() }));
jest.mock("../services/slackAlertService", () => ({ sendAlertSafe: jest.fn(async () => ({})) }));

const axiosPost = jest.fn();
jest.mock("axios", () => {
  const inst = { post: (...a: any[]) => axiosPost(...a), get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { ...inst, create: () => inst }, create: () => inst };
});
jest.mock("../utils/emailTemplate", () => ({ TO_EMAIL_TOKEN: "%%TO_EMAIL%%" }));

const queueAdd = jest.fn(async () => ({ id: "job-1" }));
jest.mock("bullmq", () => {
  class UnrecoverableError extends Error {
    constructor(m: string) {
      super(m);
      this.name = "UnrecoverableError";
    }
  }
  class DelayedError extends Error {}
  return {
    Queue: jest.fn().mockImplementation(() => ({ add: queueAdd, close: jest.fn() })),
    Worker: jest.fn(),
    UnrecoverableError,
    DelayedError,
  };
});

import sequelize from "../utils/dbInstance";
import { getRedisItem } from "../utils/redisInstance";
import { __clearMockStore, __setMockData } from "./__mocks__/redisInstance";
import { processEmailJob, SUPPRESSED_KEY, OTP_TTL_MS } from "../services/email/emailQueue";
import { handleBrevoEvent, brevoWebhookToken, isValidBrevoToken } from "../services/email/brevoEvents";
import mailTransporter from "../utils/mailTransporter";

const q = sequelize.query as jest.Mock;
const brevoErr = (status?: number, headers: Record<string, string> = {}, data: unknown = { message: "nope" }) => ({
  isAxiosError: true,
  message: `Request failed ${status}`,
  response: status ? { status, headers, data } : undefined,
  code: status ? undefined : "ECONNRESET",
});
const job = (over: Record<string, unknown> = {}) =>
  ({
    id: "j1",
    attemptsMade: 0,
    opts: { attempts: 7 },
    moveToDelayed: jest.fn(async () => {}),
    data: {
      to: "merchant@example.com",
      name: "M",
      subject: "Hello",
      body: "<p>hi</p>",
      sender: { name: "Dynopay", email: "hi@dynopay.com" },
      lane: "default",
      logId: 42,
      ...over,
    },
  }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  __clearMockStore();
  q.mockReset();
  q.mockResolvedValue([]);
  process.env.DISABLE_OUTBOUND_EMAIL = "false";
  process.env.BREVO_API_KEY = "test-key";
  delete process.env.EMAIL_QUEUE_DISABLED;
});

describe("processEmailJob", () => {
  it("sends once and records the Brevo message id", async () => {
    axiosPost.mockResolvedValueOnce({ data: { messageId: "<abc@smtp-relay.mailin.fr>" } });
    const r = await processEmailJob(job(), "tok");
    expect(r.messageId).toBe("<abc@smtp-relay.mailin.fr>");
    expect(axiosPost).toHaveBeenCalledTimes(1);
    const sql = q.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/UPDATE tbl_email_log SET .*status = :status/);
    expect(q.mock.calls.some((c) => c[1]?.replacements?.status === "sent" && c[1]?.replacements?.brevo_message_id === "<abc@smtp-relay.mailin.fr>")).toBe(true);
  });

  it("retries 5xx / network (rethrows) and keeps the row queued", async () => {
    axiosPost.mockRejectedValueOnce(brevoErr(503));
    await expect(processEmailJob(job(), "tok")).rejects.toThrow(/503/);
    expect(q.mock.calls.some((c) => c[1]?.replacements?.status === "failed")).toBe(false);
    axiosPost.mockRejectedValueOnce(brevoErr(undefined));
    await expect(processEmailJob(job(), "tok")).rejects.toBeTruthy();
  });

  it("honours Retry-After on 429 by delaying the job", async () => {
    axiosPost.mockRejectedValueOnce(brevoErr(429, { "retry-after": "7" }));
    const j = job();
    await expect(processEmailJob(j, "tok")).rejects.toThrow();
    expect(j.moveToDelayed).toHaveBeenCalledTimes(1);
    const when = j.moveToDelayed.mock.calls[0][0] as number;
    expect(when - Date.now()).toBeGreaterThan(5000);
    expect(when - Date.now()).toBeLessThanOrEqual(7000);
  });

  it("marks other 4xx as a permanent failure (UnrecoverableError, no retry)", async () => {
    axiosPost.mockRejectedValueOnce(brevoErr(400, {}, { message: "sender not valid", code: "invalid_parameter" }));
    await expect(processEmailJob(job(), "tok")).rejects.toMatchObject({ name: "UnrecoverableError" });
    expect(q.mock.calls.some((c) => c[1]?.replacements?.status === "failed")).toBe(true);
  });

  it("never delivers an expired OTP", async () => {
    const r = await processEmailJob(job({ lane: "otp", expiresAt: Date.now() - 1 }), "tok");
    expect(r.skipped).toBe("expired");
    expect(axiosPost).not.toHaveBeenCalled();
    expect(q.mock.calls.some((c) => c[1]?.replacements?.status === "expired")).toBe(true);
  });

  it("skips non-OTP mail to a bounced address but still tries OTP", async () => {
    __setMockData(SUPPRESSED_KEY("merchant@example.com"), { event: "hard_bounce" });
    const r = await processEmailJob(job(), "tok");
    expect(r.skipped).toBe("suppressed");
    expect(axiosPost).not.toHaveBeenCalled();
    axiosPost.mockResolvedValueOnce({ data: { messageId: "m2" } });
    const r2 = await processEmailJob(job({ lane: "otp", expiresAt: Date.now() + OTP_TTL_MS }), "tok");
    expect(r2.messageId).toBe("m2");
  });
});

describe("Brevo webhook events", () => {
  it("hard bounce → suppression key + tbl_user.email_bounced_at + log row bounced", async () => {
    q.mockResolvedValue([{ user_id: 7 }]);
    const out = await handleBrevoEvent({ event: "hard_bounce", email: "Dead@Example.com", "message-id": "<m1>", reason: "mailbox full", ts_event: 1700000000 });
    expect(out).toBe("suppressed");
    expect(await getRedisItem(SUPPRESSED_KEY("dead@example.com"))).toMatchObject({ event: "hard_bounce", reason: "mailbox full" });
    const sql = q.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/UPDATE tbl_user SET email_bounced_at = NOW\(\)/);
    expect(sql).toMatch(/UPDATE tbl_email_log SET .*WHERE brevo_message_id = :messageId/);
  });

  it("delivered heals an earlier bounce flag", async () => {
    __setMockData(SUPPRESSED_KEY("dead@example.com"), { event: "hard_bounce" });
    q.mockResolvedValue([{ user_id: 7 }]);
    const out = await handleBrevoEvent({ event: "delivered", email: "dead@example.com", "message-id": "<m2>" });
    expect(out).toBe("delivered");
    expect(await getRedisItem(SUPPRESSED_KEY("dead@example.com"))).toBeNull();
    expect(q.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/SET email_bounced_at = NULL/);
  });

  it("soft bounce is recorded only", async () => {
    expect(await handleBrevoEvent({ event: "soft_bounce", email: "x@example.com", "message-id": "<m3>" })).toBe("recorded");
    expect(await getRedisItem(SUPPRESSED_KEY("x@example.com"))).toBeNull();
  });

  it("token is derived from BREVO_API_KEY and compared in constant time", () => {
    const t = brevoWebhookToken();
    expect(t).toHaveLength(48);
    expect(isValidBrevoToken(t)).toBe(true);
    expect(isValidBrevoToken(t.slice(0, 47) + "x")).toBe(false);
    expect(isValidBrevoToken("")).toBe(false);
  });
});

describe("mailTransporter", () => {
  it("queues (no Brevo call) and returns a truthy result for companyDispatch", async () => {
    q.mockResolvedValueOnce([{ log_id: "99" }]);
    const r = await mailTransporter({ to: "a@example.com", name: "A", subject: "S", body: "<p>b</p>" });
    expect(r).toMatchObject({ queued: true, jobId: "job-1", logId: 99 });
    expect(axiosPost).not.toHaveBeenCalled();
    const payload = queueAdd.mock.calls[0] as unknown as [string, any, any];
    expect(payload[1].lane).toBe("default");
    expect(payload[2]).toMatchObject({ priority: 10, attempts: 7 });
  });

  it("OTP lane gets priority + TTL", async () => {
    await mailTransporter({ to: "a@example.com", name: "A", subject: "123456 is your code", body: "<p>b</p>", lane: "otp" });
    const [, data, opts] = queueAdd.mock.calls[0] as unknown as [string, any, any];
    expect(opts).toMatchObject({ priority: 1, attempts: 4 });
    expect(data.expiresAt - Date.now()).toBeGreaterThan(OTP_TTL_MS - 2000);
  });

  it("falls back to an inline send when the queue is unavailable", async () => {
    queueAdd.mockRejectedValueOnce(new Error("ECONNREFUSED redis"));
    axiosPost.mockResolvedValueOnce({ data: { messageId: "inline-1" } });
    const r = await mailTransporter({ to: "a@example.com", name: "A", subject: "S", body: "<p>b</p>" });
    expect(r).toMatchObject({ sent: true, messageId: "inline-1" });
  });

  it("suppresses (and never queues) when DISABLE_OUTBOUND_EMAIL=true", async () => {
    process.env.DISABLE_OUTBOUND_EMAIL = "true";
    const r = await mailTransporter({ to: "a@example.com", name: "A", subject: "S", body: "<p>b</p>" });
    expect(r).toEqual({ suppressed: true });
    expect(queueAdd).not.toHaveBeenCalled();
    expect(q).not.toHaveBeenCalled();
  });

  it("rejects invalid input before queueing", async () => {
    await expect(mailTransporter({ to: "nope", name: "A", subject: "S", body: "<p>b</p>" })).rejects.toThrow(/Invalid recipient/);
    await expect(mailTransporter({ to: "a@example.com", name: "A", subject: "", body: "<p>b</p>" })).rejects.toThrow(/Empty subject/);
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
