/**
 * utils/durableState — Redis primitives for restart-surviving operational state.
 * Uses a fake node-redis client with real NX/EX/INCR semantics.
 */
const store = new Map<string, { v: string; exp: number | null }>();
let redisDown = false;
const live = (k: string) => {
  const e = store.get(k);
  if (!e) return null;
  if (e.exp !== null && e.exp <= Date.now()) { store.delete(k); return null; }
  return e;
};
// NOTE: ".ts" suffix on purpose — the unit project's moduleNameMapper rewrites the
// bare "../utils/redisInstance" specifier to the shared mock, which would make this
// jest.mock target the mock file instead of the real module durableState imports.
jest.mock("../utils/redisInstance.ts", () => ({
  redis: {
    set: jest.fn(async (k: string, v: string, opts?: { NX?: boolean; EX?: number }) => {
      if (redisDown) throw new Error("ECONNREFUSED");
      if (opts?.NX && live(k)) return null;
      store.set(k, { v, exp: opts?.EX ? Date.now() + opts.EX * 1000 : null });
      return "OK";
    }),
    get: jest.fn(async (k: string) => { if (redisDown) throw new Error("ECONNREFUSED"); return live(k)?.v ?? null; }),
    del: jest.fn(async (k: string) => { if (redisDown) throw new Error("ECONNREFUSED"); store.delete(k); return 1; }),
    eval: jest.fn(async (_script: string, { keys, arguments: args }: { keys: string[]; arguments: string[] }) => {
      if (redisDown) throw new Error("ECONNREFUSED");
      const e = live(keys[0]);
      const n = (e ? Number(e.v) : 0) + 1;
      store.set(keys[0], { v: String(n), exp: e ? e.exp : Date.now() + Number(args[0]) * 1000 });
      return n;
    }),
    scanIterator: ({ MATCH }: { MATCH: string }) => {
      const prefix = MATCH.replace(/\*$/, "");
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix) && live(k));
      return (async function* () { if (redisDown) throw new Error("ECONNREFUSED"); for (const k of keys) yield k; })();
    },
  },
}));
jest.mock("../utils/loggers", () => ({ apiLogger: { warn: jest.fn(), info: jest.fn() }, cronLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { countHit, claimOnce, loadJson, saveJson, remove, loadAllJson } from "../utils/durableState";

beforeEach(() => { store.clear(); redisDown = false; });

describe("durableState", () => {
  it("countHit increments within the window and starts over after it expires", async () => {
    expect(await countHit("k", 60)).toBe(1);
    expect(await countHit("k", 60)).toBe(2);
    expect(await countHit("k", 60)).toBe(3);
    store.get("dynopay:durable:k")!.exp = Date.now() - 1; // window elapsed
    expect(await countHit("k", 60)).toBe(1);
  });

  it("claimOnce is first-come-only until the TTL expires", async () => {
    expect(await claimOnce("c", 60)).toBe(true);
    expect(await claimOnce("c", 60)).toBe(false);
    store.get("dynopay:durable:c")!.exp = Date.now() - 1;
    expect(await claimOnce("c", 60)).toBe(true);
  });

  it("saveJson/loadJson/remove/loadAllJson round-trip", async () => {
    await saveJson("bot:blocked:1.2.3.4", { since: 5, hits: 7 }, 60);
    await saveJson("bot:blocked:5.6.7.8", { since: 9, hits: 5 }, 60);
    await saveJson("other", { x: 1 }, 60);
    expect(await loadJson("bot:blocked:1.2.3.4")).toEqual({ since: 5, hits: 7 });
    expect(await loadAllJson("bot:blocked:")).toEqual({ "1.2.3.4": { since: 5, hits: 7 }, "5.6.7.8": { since: 9, hits: 5 } });
    await remove("bot:blocked:1.2.3.4");
    expect(await loadJson("bot:blocked:1.2.3.4")).toBeNull();
  });

  it("never throws when Redis is down — signals fallback instead", async () => {
    redisDown = true;
    expect(await countHit("k", 60)).toBeNull();
    expect(await claimOnce("c", 60)).toBeNull();
    expect(await loadJson("x")).toBeNull();
    expect(await saveJson("x", {}, 60)).toBe(false);
    expect(await loadAllJson("p")).toBeNull();
    await expect(remove("x")).resolves.toBeUndefined();
  });
});
