/**
 * Load-test safety guard.
 *
 * When (and ONLY when) the env var LOADTEST_NO_BROADCAST === "true", the
 * on-chain broadcast / KMS-signing primitives short-circuit and return a
 * SYNTHETIC transaction hash instead of moving real funds. Every other layer
 * of the money path (reservation locking, settlement idempotency, journaling,
 * ledger double-entry, sweep dedup, state machine) runs unchanged, so a load
 * test exercises the exact concurrency-sensitive logic WITHOUT any risk of a
 * real transfer.
 *
 * This flag is UNSET in every real environment (dev / preview / production),
 * so this guard is a strict no-op there — it can only ever be turned on by an
 * operator explicitly running a load test against an isolated staging DB.
 */

export const isLoadtestNoBroadcast = (): boolean =>
  process.env.LOADTEST_NO_BROADCAST === "true";

/** Deterministic-ish synthetic tx hash for a gated broadcast. */
export const syntheticTxId = (prefix = "LOADTEST"): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
