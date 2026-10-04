/**
 * Restart-survival: operational state that used to live only in process memory
 * must come back after a redeploy. Each case runs a module, wipes the module
 * registry (= new container), re-imports it and checks the behaviour carries
 * over through the (fake) Redis-backed durableState.
 */
const durableStore = new Map<string, { v: unknown; exp: number }>();
const liveVal = (k: string) => {
  const e = durableStore.get(k);
  if (!e) return undefined;
  if (e.exp <= Date.now()) { durableStore.delete(k); return undefined; }
  return e.v;
};
let durableDown = false;
jest.mock("../utils/durableState", () => ({
  countHit: async (k: string, win: number) => {
    if (durableDown) return null;
    const cur = (liveVal(k) as number | undefined) ?? 0;
    const e = durableStore.get(k);
    durableStore.set(k, { v: cur + 1, exp: cur === 0 || !e ? Date.now() + win * 1000 : e.exp });
    return cur + 1;
  },
  claimOnce: async (k: string, ttl: number) => {
    if (durableDown) return null;
    if (liveVal(k) !== undefined) return false;
    durableStore.set(k, { v: 1, exp: Date.now() + ttl * 1000 });
    return true;
  },
  loadJson: async (k: string) => (durableDown ? null : (liveVal(k) ?? null)),
  saveJson: async (k: string, v: unknown, ttl: number) => { if (durableDown) return false; durableStore.set(k, { v, exp: Date.now() + ttl * 1000 }); return true; },
  remove: async (k: string) => { durableStore.delete(k); },
  loadAllJson: async (prefix: string) => {
    if (durableDown) return null;
    const out: Record<string, unknown> = {};
    for (const k of [...durableStore.keys()]) if (k.startsWith(prefix) && liveVal(k) !== undefined) out[k.slice(prefix.length)] = liveVal(k);
    return out;
  },
}));
jest.mock("../utils/loggers", () => ({
  apiLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  cronLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mailMock = jest.fn(async (..._a: unknown[]) => ({ ok: true }));
jest.mock("../utils/mailTransporter", () => ({ __esModule: true, default: (...a: unknown[]) => mailMock(...a) }));

const slackPost = jest.fn(async (..._a: unknown[]) => ({ status: 200 }));
jest.mock("axios", () => ({ __esModule: true, default: { post: (...a: unknown[]) => slackPost(...a) } }));

// rpc health: 1 fake endpoint per chain, fetch controlled per test
const rpcOk = { value: true };
jest.mock("../services/merchantPool/directEvmTransfer", () => ({ getRpcUrls: (chain: string) => [`https://rpc.test/${chain}`] }));
jest.mock("../utils/tatumAuth", () => ({ getTatumApiKey: () => "" }));
const capturedErrors: string[] = [];
jest.mock("../services/errorMonitoringService", () => ({ captureError: (e: Error) => { capturedErrors.push(e.message); } }));
jest.mock("../services/slackAlertService", () => ({ sendAlert: async () => ({ slack: true, discord: false }), sendAlertSafe: async () => ({}) }));

const reload = async <T>(path: string): Promise<T> => { jest.resetModules(); return import(path) as Promise<T>; };

beforeEach(() => {
  durableStore.clear();
  durableDown = false;
  mailMock.mockClear();
  slackPost.mockClear();
  capturedErrors.length = 0;
  process.env.ADMIN_EMAIL = "ops@test";
  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/x";
  process.env.DISCORD_WEBHOOK_URL = "https://discord.test/x"; // unset → 3s retry sleeps per alert
  process.env.RPC_HEALTH_FAILURE_THRESHOLD = "2";
  (global as any).fetch = jest.fn(async (url: string) =>
    rpcOk.value
      ? { ok: true, status: 200, json: async () => ({ result: String(url).includes("POLYGON") ? "0x89" : "0x1" }) }
      : { ok: false, status: 404, json: async () => null } // 4xx = no 750ms retry sleep
  );
});

type BotMod = typeof import("../middleware/botProtection");
const scannerReq = (ip: string, path = "/wp-login.php") =>
  ({ ip, headers: { "x-forwarded-for": ip, "user-agent": "node" }, path, originalUrl: path, method: "GET" } as any);
const fakeRes = () => {
  const res: any = { statusCode: 0, ended: false, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
};

describe("bot protection blocklist survives a restart", () => {
  it("an auto-blocked IP is still blocked after the module is reloaded", async () => {
    let mod = await reload<BotMod>("../middleware/botProtection");
    await mod.hydrateBlockedIps();
    for (let i = 0; i < 5; i++) await mod.default(scannerReq("203.0.113.9"), fakeRes(), jest.fn());
    expect(mod.getBotProtectionStats().blockedIPs).toEqual(["203.0.113.9"]);

    mod = await reload<BotMod>("../middleware/botProtection"); // new container
    await mod.hydrateBlockedIps();
    expect(mod.getBotProtectionStats().blockedIPs).toEqual(["203.0.113.9"]);
    const res = fakeRes(); const next = jest.fn();
    await mod.default(scannerReq("203.0.113.9", "/api/status"), res, next); // normal path, still blocked
    expect(res.statusCode).toBe(403);
    expect(res.ended).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it("hit counts survive too: 3 hits before + 2 after the restart = blocked", async () => {
    let mod = await reload<BotMod>("../middleware/botProtection");
    await mod.hydrateBlockedIps();
    for (let i = 0; i < 3; i++) await mod.default(scannerReq("198.51.100.7"), fakeRes(), jest.fn());
    expect(mod.getBotProtectionStats().blocked).toBe(0);
    mod = await reload<BotMod>("../middleware/botProtection");
    await mod.hydrateBlockedIps();
    for (let i = 0; i < 2; i++) await mod.default(scannerReq("198.51.100.7"), fakeRes(), jest.fn());
    expect(mod.getBotProtectionStats().blockedIPs).toEqual(["198.51.100.7"]);
  });

  it("still works purely in memory when Redis is unavailable, and hydrates later once Redis is back", async () => {
    durableDown = true;
    const mod = await reload<BotMod>("../middleware/botProtection");
    await mod.hydrateBlockedIps(); // fails softly (Redis not connected yet at boot)
    for (let i = 0; i < 5; i++) await mod.default(scannerReq("192.0.2.1"), fakeRes(), jest.fn());
    expect(mod.getBotProtectionStats().blockedIPs).toEqual(["192.0.2.1"]);

    durableStore.set("bot:blocked:203.0.113.50", { v: { since: Date.now(), hits: 5 }, exp: Date.now() + 3600_000 });
    durableDown = false; // Redis comes up → the next request retries hydration
    const res = fakeRes();
    await mod.default(scannerReq("203.0.113.50", "/api/status"), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(mod.getBotProtectionStats().blockedIPs.sort()).toEqual(["192.0.2.1", "203.0.113.50"]);
  });
});

describe("critical-error immediate alert cooldown survives a restart", () => {
  type ErrMod = typeof import("../services/errorMonitoringService");
  const flush = () => new Promise((r) => setTimeout(r, 30));

  it("the same critical error does not re-page right after a redeploy", async () => {
    jest.unmock("../services/errorMonitoringService");
    let mod = await reload<ErrMod>("../services/errorMonitoringService");
    mod.captureError(new Error("DB pool exhausted"), "database", { severity: "critical" });
    await flush();
    expect(mailMock).toHaveBeenCalledTimes(1);

    mod = await reload<ErrMod>("../services/errorMonitoringService"); // memory cooldown gone
    mod.captureError(new Error("DB pool exhausted"), "database", { severity: "critical" });
    await flush();
    expect(mailMock).toHaveBeenCalledTimes(1); // Redis claim still held → no duplicate

    mod.captureError(new Error("Totally different failure"), "payment", { severity: "critical" });
    await flush();
    expect(mailMock).toHaveBeenCalledTimes(2); // new fingerprint still alerts
    jest.doMock("../services/errorMonitoringService", () => ({ captureError: (e: Error) => { capturedErrors.push(e.message); } }));
  });
});

describe("RPC outage memory survives a restart", () => {
  type RpcMod = typeof import("../services/rpcHealthMonitor");

  it("does not re-page for an outage that was already alerted before the redeploy, and reports recovery", async () => {
    rpcOk.value = false;
    let mod = await reload<RpcMod>("../services/rpcHealthMonitor");
    await mod.checkRpcHealth(); // streak 1
    await mod.checkRpcHealth(); // streak 2 → alert
    const pagesBefore = capturedErrors.filter((m) => m.includes("unreachable")).length;
    expect(pagesBefore).toBe(2); // one per chain (ETH, POLYGON)

    mod = await reload<RpcMod>("../services/rpcHealthMonitor"); // new container mid-outage
    await mod.checkRpcHealth();
    await mod.checkRpcHealth();
    expect(capturedErrors.filter((m) => m.includes("unreachable")).length).toBe(pagesBefore); // no re-page

    rpcOk.value = true;
    await mod.checkRpcHealth();
    const { cronLogger } = await import("../utils/loggers");
    const recovered = (cronLogger.info as jest.Mock).mock.calls.filter((c) => String(c[0]).includes("RECOVERED"));
    expect(recovered.length).toBe(2); // recovery is announced because `alerted` was remembered
  }, 20000);
});

describe("Slack alert dedupe window survives a restart", () => {
  type SlackMod = typeof import("../services/slackAlertService");
  const payload = { title: "Sweep failed", message: "TRX sweep error", severity: "warning" as const };

  it("a burst of identical alerts stays capped at 3 across a redeploy", async () => {
    jest.unmock("../services/slackAlertService");
    let mod = await reload<SlackMod>("../services/slackAlertService");
    for (let i = 0; i < 3; i++) expect((await mod.sendAlertSafe(payload)).suppressed).toBe(false);
    mod = await reload<SlackMod>("../services/slackAlertService");
    expect((await mod.sendAlertSafe(payload)).suppressed).toBe(true); // 4th in window, even after restart
    expect(slackPost).toHaveBeenCalledTimes(6); // 3 alerts × (slack + discord)
    jest.doMock("../services/slackAlertService", () => ({ sendAlert: async () => ({ slack: true, discord: false }), sendAlertSafe: async () => ({}) }));
  }, 20000);
});
