const keys = jest.fn();
const del = jest.fn();
const sendToUser = jest.fn();

jest.mock("/app/backend/utils/redisInstance", () => ({ redis: { keys: (...a: unknown[]) => keys(...a), del: (...a: unknown[]) => del(...a) } }));
jest.mock("/app/backend/services/sseService", () => ({ sendToUser: (...a: unknown[]) => sendToUser(...a) }));
jest.mock("/app/backend/utils/loggers", () => ({ apiLogger: { warn: jest.fn(), info: jest.fn() } }));

import { invalidateMerchantMoneyCaches, notifyMerchantMoneyChange } from "../utils/merchantMoneyEvents";

describe("merchantMoneyEvents", () => {
  beforeEach(() => {
    keys.mockClear();
    del.mockClear();
    sendToUser.mockClear();
  });

  it("drops every per-user fiat cache (deduped)", async () => {
    keys.mockImplementation(async (p: string) =>
      p === "dashboard:7:*" ? ["dashboard:7:1:EUR:v3settled"] : p === "dashboard:*:7:*" ? ["dashboard:overview:7:1:30d:EUR:v2", "dashboard:overview:7:1:30d:EUR:v2"] : p === "wallet:7:*" ? ["wallet:7:1:EUR:v6"] : [],
    );
    await invalidateMerchantMoneyCaches(7);
    const patterns = keys.mock.calls.map((c) => c[0]);
    expect(patterns).toEqual(expect.arrayContaining(["dashboard:7:*", "dashboard:*:7:*", "chart:7:*", "feeTiers:7:*", "recentTx:7:*", "wallet:7:*", "invoices:period:7:*"]));
    expect(del).toHaveBeenCalledWith(["dashboard:7:1:EUR:v3settled", "dashboard:overview:7:1:30d:EUR:v2", "wallet:7:1:EUR:v6"]);
  });

  it("emits a money_update SSE event after invalidating", async () => {
    keys.mockResolvedValue([]);
    await notifyMerchantMoneyChange(7, { reason: "payment", transaction_id: "tx1", company_id: 1 });
    expect(del).not.toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledWith(7, "money_update", expect.objectContaining({ reason: "payment", transaction_id: "tx1", company_id: 1 }));
  });

  it("never throws when Redis is down", async () => {
    keys.mockRejectedValue(new Error("down"));
    await expect(notifyMerchantMoneyChange(7, { reason: "currency" })).resolves.toBeUndefined();
    expect(sendToUser).toHaveBeenCalled();
  });
});
