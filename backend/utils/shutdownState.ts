/**
 * Shared shutdown flag.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `utils/dbInstance.ts` needs to know whether the process is shutting down so it
 * can stop issuing queries and avoid noisy "connection manager was closed"
 * errors. It used to obtain that flag with a lazy `require('../server')` inside
 * the Sequelize `beforeQuery` hook — i.e. on EVERY query.
 *
 * That was a landmine. `server.ts` calls `startServer()` at module scope, so the
 * first query issued by ANY process that imported a model would load and BOOT A
 * SECOND COPY OF THE WHOLE SERVER: `app.listen(3300)` → EADDRINUSE → uncaught
 * exception → ErrorMonitor alert emails. Any maintenance script, migration or
 * test that touched a model triggered it (observed 2026-08-12 21:36 UTC while
 * verifying account provisioning — three alert emails were sent to the admin).
 *
 * On a production box with ENABLE_BACKGROUND_JOBS=true the consequences are far
 * worse than noise: the second boot would start a second cron scheduler, a second
 * BullMQ webhook worker and a second sweep loop, i.e. DOUBLE-PROCESSING of real
 * payments and fund movements.
 *
 * The dependency is now inverted: this module owns the flag and imports nothing,
 * so `dbInstance` can read it with a plain static import and the cycle
 * (server → models → dbInstance → server) is gone. `server.ts` sets the flag
 * during graceful shutdown.
 */

let shuttingDown = false;

/** Called by server.ts when graceful shutdown begins. */
export const markShuttingDown = (): void => {
  shuttingDown = true;
};

/** True once graceful shutdown has started. */
export const isShuttingDown = (): boolean => shuttingDown;

export default { markShuttingDown, isShuttingDown };
