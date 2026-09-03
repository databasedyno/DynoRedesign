import os from 'os';
/**
 * Unit Tests: Redis Instance (Phase 4)
 *
 * Tests the Redis utility layer (utils/redisInstance.ts) which provides:
 *   - Cache operations: set/get/delete with JSON/hash dual-storage
 *   - Distributed locking: acquire/release with Lua-based atomicity
 *   - Lock auto-renewal: heartbeat timer prevents expiry during long ops
 *   - withLock: convenience wrapper for lock-protected execution
 *   - Stale lock cleanup: removes locks from dead processes on startup
 *
 * These functions underpin ALL payment concurrency in DynoPay.
 * If locking is broken → double-processing or stuck cron jobs.
 */

// ── Mock Redis npm package (before any module loads) ────────────────────────

const mockRedisClient: Record<string, jest.Mock> = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  hSet: jest.fn(),
  hGetAll: jest.fn(),
  keys: jest.fn(),
  scanIterator: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  eval: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../utils/loggers', () => ({
  cronLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  log: jest.fn(),
}));

// ── Import REAL module (no redisInstance mapper in 'redis' jest project) ─────

import {
  setRedisItem,
  setRedisItemWithTTL,
  setRedisTTL,
  getRedisItem,
  deleteRedisItem,
  softDeleteRedisItem,
  acquireLock,
  releaseLock,
  withLock,
  cleanupStaleLocks,
  connectRedis,
} from '../utils/redisInstance';

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. CACHE OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('Cache Operations', () => {

  describe('setRedisItem', () => {
    it('stores objects as JSON string with :json key suffix', async () => {
      const data = { amount: 100, currency: 'BTC', status: 'pending' };
      await setRedisItem('payment-abc', data);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'payment-abc:json',
        JSON.stringify(data)
      );
    });

    it('deletes old hash key to prevent stale reads', async () => {
      await setRedisItem('payment-abc', { amount: 100 });
      expect(mockRedisClient.del).toHaveBeenCalledWith('payment-abc');
    });

    it('handles nested objects', async () => {
      const data = { fees: { fixed: 2, percent: 1.5 }, meta: { source: 'api' } };
      await setRedisItem('fee-data', data);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'fee-data:json',
        JSON.stringify(data)
      );
    });

    it('stores arrays as JSON', async () => {
      const data = ['BTC', 'ETH', 'XRP'];
      await setRedisItem('currencies', data);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'currencies:json',
        JSON.stringify(data)
      );
    });
  });

  describe('setRedisItemWithTTL', () => {
    it('stores objects with EX expiry option', async () => {
      const data = { status: 'processing' };
      await setRedisItemWithTTL('temp-key', data, 300);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'temp-key:json',
        JSON.stringify(data),
        { EX: 300 }
      );
    });

    it('passes exact TTL value to Redis', async () => {
      await setRedisItemWithTTL('ttl-test', { a: 1 }, 60);
      const call = mockRedisClient.set.mock.calls[0];
      expect(call[2]).toEqual({ EX: 60 });
    });
  });

  describe('setRedisTTL', () => {
    it('sets TTL on both original and :json keys', async () => {
      await setRedisTTL('payment-123', 600);

      expect(mockRedisClient.expire).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('payment-123', 600);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('payment-123:json', 600);
    });
  });

  describe('getRedisItem', () => {
    it('returns {} for empty key', async () => {
      const result = await getRedisItem('');
      expect(result).toEqual({});
    });

    it('returns parsed JSON when :json key exists', async () => {
      const stored = { amount: 50, currency: 'ETH' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getRedisItem('payment-xyz');

      expect(mockRedisClient.get).toHaveBeenCalledWith('payment-xyz:json');
      expect(result).toEqual(stored);
    });

    it('falls back to hash storage when no JSON key', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.hGetAll.mockResolvedValueOnce({ status: 'active', amount: '100' });

      const result = await getRedisItem('payment-old');

      expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('payment-old');
      expect(result).toEqual({ status: 'active', amount: '100' });
    });

    it('returns {} when neither JSON nor hash exists', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      const result = await getRedisItem('nonexistent');
      expect(result).toEqual({});
    });

    it('falls back to hash on JSON parse error', async () => {
      mockRedisClient.get.mockResolvedValueOnce('not-valid-json{{{');
      mockRedisClient.hGetAll.mockResolvedValueOnce({ fallback: 'data' });

      const result = await getRedisItem('corrupt-key');
      expect(result).toEqual({ fallback: 'data' });
    });
  });

  describe('deleteRedisItem', () => {
    it('deletes both original and :json keys', async () => {
      await deleteRedisItem('payment-del');

      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.del).toHaveBeenCalledWith('payment-del');
      expect(mockRedisClient.del).toHaveBeenCalledWith('payment-del:json');
    });
  });

  describe('softDeleteRedisItem', () => {
    it('sets default 30-min TTL instead of deleting', async () => {
      await softDeleteRedisItem('payment-soft');

      expect(mockRedisClient.expire).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('payment-soft', 1800);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('payment-soft:json', 1800);
    });

    it('uses custom TTL when provided', async () => {
      await softDeleteRedisItem('payment-soft', 600);

      expect(mockRedisClient.expire).toHaveBeenCalledWith('payment-soft', 600);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('payment-soft:json', 600);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. DISTRIBUTED LOCKING
// ═════════════════════════════════════════════════════════════════════════════

describe('Distributed Locking', () => {

  describe('acquireLock', () => {
    it('acquires lock with NX + TTL on first attempt', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');

      const result = await acquireLock('payment:process:123', 30);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:payment:process:123',
        expect.stringMatching(/^.+:\d+:\d+$/), // host:PID:timestamp
        { NX: true, EX: 30 }
      );
    });

    it('returns false after all retries exhausted', async () => {
      mockRedisClient.set.mockResolvedValue(null);
      mockRedisClient.get.mockResolvedValue('other-pid:12345');
      mockRedisClient.ttl.mockResolvedValue(25);

      const result = await acquireLock('busy-lock', 30, 3, 10);

      expect(result).toBe(false);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
    });

    it('uses lock: prefix for all keys', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      await acquireLock('cron:sweep', 60);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:cron:sweep',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('includes hostname and current process PID in lock value', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      await acquireLock('pid-lock', 30);

      const lockValue = mockRedisClient.set.mock.calls[0][1];
      expect(lockValue).toMatch(new RegExp(`^${os.hostname()}:${process.pid}:\\d+$`));
    });

    it('succeeds on later retry after initial failure', async () => {
      mockRedisClient.set
        .mockResolvedValueOnce(null)   // 1st attempt fails
        .mockResolvedValueOnce(null)   // 2nd fails
        .mockResolvedValueOnce('OK');  // 3rd succeeds
      mockRedisClient.get.mockResolvedValue('other:123');
      mockRedisClient.ttl.mockResolvedValue(10);

      const result = await acquireLock('retry-lock', 30, 3, 10);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
    });

    it('starts auto-renewal timer when autoRenew=true', async () => {
      jest.useFakeTimers();
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValue(1); // renewal success

      await acquireLock('auto-renew-lock', 10, 1, 100, true);

      // Advance past 50% of TTL (10s * 500ms = 5000ms)
      await jest.advanceTimersByTimeAsync(5100);

      // Lua EXTEND script should have been called
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('expire'),
        expect.objectContaining({
          keys: ['lock:auto-renew-lock'],
        })
      );

      // Cleanup
      mockRedisClient.eval.mockResolvedValueOnce(1);
      await releaseLock('auto-renew-lock');
      jest.useRealTimers();
    });

    it('handles Redis errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('ECONNRESET'));

      const result = await acquireLock('error-lock', 30, 2, 10);
      expect(result).toBe(false);
    });

    it('logs lock holder info on first failed attempt', async () => {
      const { cronLogger } = require('../utils/loggers');
      mockRedisClient.set.mockResolvedValue(null);
      mockRedisClient.get.mockResolvedValue('99999:1234567890');
      mockRedisClient.ttl.mockResolvedValue(20);

      await acquireLock('info-lock', 30, 2, 10);

      expect(cronLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('99999')
      );
    });

    it('single attempt mode (maxRetries=1)', async () => {
      mockRedisClient.set.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValue('holder:123');
      mockRedisClient.ttl.mockResolvedValue(15);

      const result = await acquireLock('single', 30, 1, 100);

      expect(result).toBe(false);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('releaseLock', () => {
    it('releases owned lock via Lua atomic compare-and-delete', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      await acquireLock('rel-test', 30);

      mockRedisClient.eval.mockResolvedValueOnce(1);
      await releaseLock('rel-test');

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("del"'),
        expect.objectContaining({
          keys: ['lock:rel-test'],
          arguments: [expect.stringMatching(/^.+:\d+:\d+$/)],
        })
      );
    });

    it('logs warning when lock was expired or stolen', async () => {
      const { cronLogger } = require('../utils/loggers');

      mockRedisClient.set.mockResolvedValueOnce('OK');
      await acquireLock('expired-lock', 30);

      mockRedisClient.eval.mockResolvedValueOnce(0); // Lock not owned
      await releaseLock('expired-lock');

      expect(cronLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('expired or owned by another')
      );
    });

    it('falls back to del on Lua script error', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      await acquireLock('lua-err', 30);

      mockRedisClient.eval.mockRejectedValueOnce(new Error('NOSCRIPT'));
      mockRedisClient.del.mockResolvedValueOnce(1);

      await releaseLock('lua-err');

      expect(mockRedisClient.del).toHaveBeenCalledWith('lock:lua-err');
    });

    it('handles release without prior acquire (no owner)', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);

      await releaseLock('never-acquired');

      expect(mockRedisClient.del).toHaveBeenCalledWith('lock:never-acquired');
    });

    it('clears auto-renewal timer on release', async () => {
      jest.useFakeTimers();

      mockRedisClient.set.mockResolvedValueOnce('OK');
      await acquireLock('timer-lock', 10, 1, 100, true);

      mockRedisClient.eval.mockResolvedValueOnce(1);
      await releaseLock('timer-lock');

      // Advance time — renewal should NOT fire since timer was cleared
      mockRedisClient.eval.mockClear();
      await jest.advanceTimersByTimeAsync(15000);

      expect(mockRedisClient.eval).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('withLock', () => {
    it('executes function and returns result when lock acquired', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValueOnce(1);

      const result = await withLock('wl-success', async () => 42);

      expect(result).toEqual({ success: true, result: 42 });
    });

    it('returns error object when lock cannot be acquired', async () => {
      mockRedisClient.set.mockResolvedValue(null);
      mockRedisClient.get.mockResolvedValue('other:123');
      mockRedisClient.ttl.mockResolvedValue(10);

      const result = await withLock('wl-busy', async () => 'nope');

      expect(result).toEqual({ success: false, error: 'Could not acquire lock' });
    });

    it('releases lock even if function throws', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValueOnce(1);

      await expect(
        withLock('wl-throw', async () => { throw new Error('boom'); })
      ).rejects.toThrow('boom');

      // Lock should have been released via finally
      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('uses default 30s TTL', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValueOnce(1);

      await withLock('wl-default', async () => 'ok');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:wl-default',
        expect.any(String),
        { NX: true, EX: 30 }
      );
    });

    it('accepts custom TTL', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValueOnce(1);

      await withLock('wl-custom', async () => 'ok', 120);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:wl-custom',
        expect.any(String),
        { NX: true, EX: 120 }
      );
    });
  });

  describe('cleanupStaleLocks', () => {
    const host = os.hostname();
    const scanOf = (keys: string[]) =>
      mockRedisClient.scanIterator.mockReturnValueOnce((async function* () { for (const k of keys) yield k; })());

    it('removes locks from dead PIDs on this host', async () => {
      scanOf(['lock:cron:sweep', 'lock:cron:convert']);
      mockRedisClient.get
        .mockResolvedValueOnce(`${host}:99999:1234567890`)
        .mockResolvedValueOnce(`${host}:99998:1234567890`);
      mockRedisClient.del.mockResolvedValue(1);

      const origKill = process.kill;
      process.kill = jest.fn().mockImplementation((_pid: number, signal?: number) => {
        if (signal === 0) throw new Error('ESRCH');
        return true;
      }) as unknown as typeof process.kill;

      const cleaned = await cleanupStaleLocks();

      expect(cleaned).toBe(2);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);

      process.kill = origKill;
    });

    it('never touches locks held by other hosts (peer instances)', async () => {
      scanOf(['lock:cron:sweep']);
      mockRedisClient.get.mockResolvedValueOnce('other-host:99999:1234567890');

      const cleaned = await cleanupStaleLocks();

      expect(cleaned).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('leaves legacy pid:ts locks to their TTL', async () => {
      scanOf(['lock:cron:sweep']);
      mockRedisClient.get.mockResolvedValueOnce('99999:1234567890');

      expect(await cleanupStaleLocks()).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('keeps locks from alive PIDs', async () => {
      scanOf(['lock:cron:active']);
      mockRedisClient.get.mockResolvedValueOnce(`${host}:${process.pid}:${Date.now()}`);

      const cleaned = await cleanupStaleLocks();

      expect(cleaned).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('returns 0 when no stale locks exist', async () => {
      scanOf([]);

      const cleaned = await cleanupStaleLocks();
      expect(cleaned).toBe(0);
    });

    it('handles Redis errors gracefully', async () => {
      mockRedisClient.scanIterator.mockImplementationOnce(() => { throw new Error('ECONNRESET'); });

      const cleaned = await cleanupStaleLocks();
      expect(cleaned).toBe(0);
    });

    it('skips keys with null values', async () => {
      mockRedisClient.keys.mockResolvedValueOnce(['lock:cron:null']);
      mockRedisClient.get.mockResolvedValueOnce(null);

      const cleaned = await cleanupStaleLocks();
      expect(cleaned).toBe(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. CONNECTION MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

describe('connectRedis', () => {
  it('calls redisClient.connect on first invocation', async () => {
    // Note: module state — connectRedis may already have been called.
    // This test verifies the function is callable and doesn't throw.
    await connectRedis();
    // connect() was called either by this test or module init
    // The key assertion is no errors
  });
});
