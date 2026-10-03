/**
 * Bounce-aware owner fallback (2026-06, SMADAV case): a brand notification
 * address Brevo cannot deliver to must never swallow payment emails.
 *   - resolver adds the owner login email when the primary company address is flagged
 *   - companyDispatch tags the primary send with fallbackTo=owner (job + log row)
 *   - Brevo soft/hard bounce → address flagged + the same email re-queued to the owner (once)
 *   - delivered heals the flag; preview pods never enqueue
 */
jest.mock("../utils/loggers", () => ({
  log: jest.fn(),
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  adminLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  cronLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../services/errorMonitoringService", () => ({ captureError: jest.fn() }));
jest.mock("../services/slackAlertService", () => ({ sendAlertSafe: jest.fn(async () => ({})) }));
jest.mock("../utils/emailTemplate", () => ({ TO_EMAIL_TOKEN: "%%TO_EMAIL%%" }));
jest.mock("axios", () => {
  const inst = { post: jest.fn(), get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { ...inst, create: () => inst }, create: () => inst };
});

const queueAdd = jest.fn(async () => ({ id: "job-2" }));
const queueGetJob = jest.fn();
jest.mock("bullmq", () => {
  class UnrecoverableError extends Error {}
  class DelayedError extends Error {}
  return {
    Queue: jest.fn().mockImplementation(() => ({ add: queueAdd, getJob: queueGetJob, close: jest.fn() })),
    Worker: jest.fn(),
    UnrecoverableError,
    DelayedError,
  };
});

import sequelize from "../utils/dbInstance";
import { companyModel, userModel, teamMemberModel } from "../models";
import { acquireLock, getRedisItem } from "../utils/redisInstance";
import { __clearMockStore, __setMockData } from "./__mocks__/redisInstance";
import { SUPPRESSED_KEY, UNREACHABLE_KEY, getCompanyEmailHealth } from "../services/email/deliverability";
import { resolveCompanyDelivery, resolveCompanyRecipients } from "../utils/notificationRecipients";
import { dispatchCompanyEmail } from "../services/email/companyDispatch";
import { handleBrevoEvent } from "../services/email/brevoEvents";
import mailTransporter from "../utils/mailTransporter";

const q = sequelize.query as jest.Mock;
const BRAND = "smadav@titan.test";
const OWNER = "owner@gmail.test";
const CID = 71;

const row = (data: Record<string, unknown>) => ({ get: () => data });
const seedCompany = (over: Record<string, unknown> = {}) => {
  (companyModel.findOne as jest.Mock).mockResolvedValue(
    row({ company_id: CID, user_id: 1, company_name: "SMADAV", email: BRAND, notification_email: null, notification_prefs: {}, ...over }),
  );
  (userModel.findOne as jest.Mock).mockResolvedValue(row({ user_id: 1, email: OWNER, name: "John Davis" }));
  (teamMemberModel.findAll as jest.Mock).mockResolvedValue([]);
};

/** sequelize.query mock: INSERT → new log id, SELECT by message id → the bounced row, everything else → []. */
const logRow = { log_id: "19", to_email: BRAND, subject: "Payment settled · 29.97 USD · SMADAV", job_id: "19", fallback_to: OWNER, fallback_log_id: null as string | null };
let nextLogId = 100;
const wireQuery = () => {
  q.mockImplementation(async (sql: string) => {
    if (/INSERT INTO tbl_email_log/.test(sql)) return [{ log_id: String(nextLogId++) }];
    if (/FROM tbl_email_log WHERE brevo_message_id/.test(sql)) return [logRow];
    return [];
  });
};

const bouncedJob = () => ({
  data: {
    to: BRAND,
    name: "John Davis",
    subject: logRow.subject,
    body: "<p>settled</p>",
    sender: { name: "Dynopay", email: "hi@dynopay.com" },
    lane: "default",
    template: null,
    logId: 19,
    companyId: CID,
    fallbackTo: OWNER,
    fallbackName: "John Davis",
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  __clearMockStore();
  logRow.fallback_log_id = null;
  nextLogId = 100;
  wireQuery();
  (acquireLock as jest.Mock).mockResolvedValue(true);
  process.env.DISABLE_OUTBOUND_EMAIL = "false";
  process.env.BREVO_API_KEY = "test-key";
  delete process.env.EMAIL_QUEUE_DISABLED;
});

describe("resolveCompanyDelivery — owner fallback", () => {
  it("healthy brand address: only the brand receives, owner exposed as fallback", async () => {
    seedCompany();
    const d = await resolveCompanyDelivery(CID, "payments");
    expect(d.recipients.map((r) => r.email)).toEqual([BRAND]);
    expect(d.recipients[0].source).toBe("company");
    expect(d.owner).toMatchObject({ email: OWNER, name: "John Davis" });
    expect(d.primaryBlock).toBeNull();
  });

  it("unreachable brand address (soft bounce): owner login email is ADDED", async () => {
    seedCompany();
    __setMockData(UNREACHABLE_KEY(BRAND), { event: "soft_bounce", reason: "550 5.7.2 Sender IP rejected", at: "2026-10-02T12:02:08.000Z" });
    const d = await resolveCompanyDelivery(CID, "payments");
    expect(d.recipients.map((r) => r.email)).toEqual([BRAND, OWNER]);
    expect(d.recipients[1].source).toBe("owner");
    expect(d.primaryBlock).toMatchObject({ kind: "unreachable", event: "soft_bounce" });
    expect(await resolveCompanyRecipients(CID, "payments")).toHaveLength(2);
  });

  it("suppressed brand address (hard bounce) also adds the owner", async () => {
    seedCompany();
    __setMockData(SUPPRESSED_KEY(BRAND), { event: "hard_bounce", reason: "unknown user" });
    const d = await resolveCompanyDelivery(CID, "payments");
    expect(d.recipients.map((r) => r.email)).toEqual([BRAND, OWNER]);
    expect(d.primaryBlock?.kind).toBe("suppressed");
  });

  it("brand address == owner login (The Dev Store case): one recipient, no block lookup", async () => {
    seedCompany({ email: null });
    __setMockData(UNREACHABLE_KEY(OWNER), { event: "soft_bounce" });
    const d = await resolveCompanyDelivery(CID, "payments");
    expect(d.recipients.map((r) => r.email)).toEqual([OWNER]);
    expect(d.recipients[0].source).toBe("owner");
    expect(d.primaryBlock).toBeNull();
  });

  it("explicitly disabled category still suppresses everything", async () => {
    seedCompany({ notification_prefs: { categories: { payments: false } } });
    __setMockData(UNREACHABLE_KEY(BRAND), { event: "soft_bounce" });
    const d = await resolveCompanyDelivery(CID, "payments");
    expect(d.recipients).toEqual([]);
  });
});

describe("dispatchCompanyEmail → mailTransporter fallback tagging", () => {
  const sendOne = (email: string, name: string) => mailTransporter({ to: email, name, subject: "Payment settled", body: "<p>x</p>" });

  it("primary brand send carries fallbackTo=owner + companyId on the job and the log row", async () => {
    seedCompany();
    const r = await dispatchCompanyEmail(CID, "payments", { email: OWNER, name: "John" }, sendOne);
    expect(r).toEqual({ attempted: 1, succeeded: 1 });
    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [, job] = queueAdd.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(job).toMatchObject({ to: BRAND, companyId: CID, fallbackTo: OWNER, fallbackName: "John Davis" });
    const insert = q.mock.calls.find((c) => /INSERT INTO tbl_email_log/.test(String(c[0])));
    expect(insert?.[1]?.replacements).toMatchObject({ to: BRAND, companyId: CID, fallbackTo: OWNER });
  });

  it("when the owner already receives a copy (brand flagged), no job carries a fallback (no duplicates)", async () => {
    seedCompany();
    __setMockData(UNREACHABLE_KEY(BRAND), { event: "soft_bounce" });
    const r = await dispatchCompanyEmail(CID, "payments", { email: OWNER, name: "John" }, sendOne);
    expect(r).toEqual({ attempted: 2, succeeded: 2 });
    const jobs = queueAdd.mock.calls.map((c) => (c as unknown as [string, Record<string, unknown>])[1]);
    expect(jobs.map((j) => j.to)).toEqual([BRAND, OWNER]);
    expect(jobs.every((j) => j.fallbackTo === null)).toBe(true);
  });

  it("owner-as-primary (no brand email): no fallback tagging", async () => {
    seedCompany({ email: null });
    await dispatchCompanyEmail(CID, "payments", { email: OWNER, name: "John" }, sendOne);
    const [, job] = queueAdd.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(job).toMatchObject({ to: OWNER, fallbackTo: null });
  });

  it("a send outside any company dispatch never gets a fallback", async () => {
    await mailTransporter({ to: "buyer@example.com", name: "B", subject: "Receipt", body: "<p>x</p>" });
    const [, job] = queueAdd.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(job).toMatchObject({ to: "buyer@example.com", fallbackTo: null, companyId: null });
  });
});

describe("Brevo bounce → re-route to the owner", () => {
  it("soft_bounce (550 Sender IP rejected): flags unreachable + re-queues the SAME email to the owner once", async () => {
    queueGetJob.mockResolvedValue(bouncedJob());
    const out = await handleBrevoEvent({ event: "soft_bounce", email: BRAND, "message-id": "<m19>", reason: "550 5.7.2 77.32.148.26: Sender IP rejected: spam rate exceeded", ts_event: 1790000000 });
    expect(out).toBe("unreachable+rerouted");
    expect(await getRedisItem(UNREACHABLE_KEY(BRAND))).toMatchObject({ event: "soft_bounce" });
    expect(await getRedisItem(SUPPRESSED_KEY(BRAND))).toBeNull();
    expect(queueGetJob).toHaveBeenCalledWith("19");
    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [, job] = queueAdd.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(job).toMatchObject({ to: OWNER, name: "John Davis", subject: logRow.subject, body: "<p>settled</p>", fallbackTo: null, logId: 100 });
    // new copy logged to the owner + original row linked to it
    const insert = q.mock.calls.find((c) => /INSERT INTO tbl_email_log/.test(String(c[0])));
    expect(insert?.[1]?.replacements).toMatchObject({ to: OWNER, companyId: CID });
    expect(q.mock.calls.some((c) => /fallback_log_id = :fallback_log_id/.test(String(c[0])) && c[1]?.replacements?.fallback_log_id === 100 && c[1]?.replacements?.logId === 19)).toBe(true);
  });

  it("hard_bounce: suppressed AND re-routed", async () => {
    queueGetJob.mockResolvedValue(bouncedJob());
    const out = await handleBrevoEvent({ event: "hard_bounce", email: BRAND, "message-id": "<m19>", reason: "unknown user" });
    expect(out).toBe("suppressed+rerouted");
    expect(await getRedisItem(SUPPRESSED_KEY(BRAND))).toMatchObject({ event: "hard_bounce" });
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: an already re-routed row (or a lost claim) is not sent twice", async () => {
    queueGetJob.mockResolvedValue(bouncedJob());
    logRow.fallback_log_id = "100";
    expect(await handleBrevoEvent({ event: "soft_bounce", email: BRAND, "message-id": "<m19>" })).toBe("unreachable");
    logRow.fallback_log_id = null;
    (acquireLock as jest.Mock).mockResolvedValueOnce(false);
    expect(await handleBrevoEvent({ event: "soft_bounce", email: BRAND, "message-id": "<m19>" })).toBe("unreachable");
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("no fallback recorded (customer receipt / owner was primary): nothing re-routed", async () => {
    q.mockImplementation(async (sql: string) =>
      /FROM tbl_email_log WHERE brevo_message_id/.test(sql) ? [{ ...logRow, fallback_to: null }] : [],
    );
    expect(await handleBrevoEvent({ event: "soft_bounce", email: BRAND, "message-id": "<m19>" })).toBe("unreachable");
    expect(queueGetJob).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("original job already purged: flags the address, logs, no crash", async () => {
    queueGetJob.mockResolvedValue(null);
    expect(await handleBrevoEvent({ event: "soft_bounce", email: BRAND, "message-id": "<m19>" })).toBe("unreachable");
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("preview pod (DISABLE_OUTBOUND_EMAIL=true) never enqueues a re-route", async () => {
    process.env.DISABLE_OUTBOUND_EMAIL = "true";
    queueGetJob.mockResolvedValue(bouncedJob());
    expect(await handleBrevoEvent({ event: "soft_bounce", email: BRAND, "message-id": "<m19>" })).toBe("unreachable");
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("delivered heals the unreachable flag", async () => {
    __setMockData(UNREACHABLE_KEY(BRAND), { event: "soft_bounce" });
    expect(await handleBrevoEvent({ event: "delivered", email: BRAND, "message-id": "<m20>" })).toBe("delivered");
    expect(await getRedisItem(UNREACHABLE_KEY(BRAND))).toBeNull();
  });
});

describe("getCompanyEmailHealth (dashboard Needs-attention source)", () => {
  it("reports the flagged brand address + owner fallback", async () => {
    q.mockImplementation(async (sql: string) =>
      /FROM tbl_company c LEFT JOIN tbl_user u/.test(sql) ? [{ notification_email: null, company_email: BRAND, owner_email: OWNER }] : [],
    );
    __setMockData(UNREACHABLE_KEY(BRAND), { event: "soft_bounce", reason: "550 Sender IP rejected", at: "2026-10-02T12:02:08.000Z" });
    const h = await getCompanyEmailHealth(CID);
    expect(h).toMatchObject({ primary_email: BRAND, owner_email: OWNER, fallback_email: OWNER });
    expect(h?.block).toMatchObject({ kind: "unreachable", reason: "550 Sender IP rejected" });
  });

  it("healthy address → block null; owner-primary → no fallback", async () => {
    q.mockImplementation(async () => [{ notification_email: OWNER, company_email: BRAND, owner_email: OWNER }]);
    const h = await getCompanyEmailHealth(CID);
    expect(h).toMatchObject({ primary_email: OWNER, fallback_email: null, block: null });
  });
});
