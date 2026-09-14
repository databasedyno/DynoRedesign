/**
 * Dedicated background-worker entrypoint (Pattern B — worker / API split).
 *
 * Same repo + same image as the web server (server.ts). This process runs ONLY
 * the background machinery — cron jobs, blockchain sweeps, settlement,
 * reconciliation and the BullMQ webhook consumer — and exposes just a tiny
 * /health endpoint (WORKER_HEALTH_PORT). It does NOT serve the public merchant
 * or dashboard API, so heavy background work never competes with API traffic.
 *
 * Deploy TWO services from one image:
 *   web    :  WORKER_ROLE=secondary
 *             -> API only, scale horizontally, zero cron jobs.
 *   worker :  (this entrypoint) `yarn start:worker`  /  node dist/worker.js
 *             -> runs cron / sweeps / settlement / queue consumer.
 *
 * Both share the same Postgres + Redis. Redis leader election
 * (utils/leaderElection.ts) guarantees each job runs exactly once even if you
 * run 2+ worker replicas for high availability.
 *
 * IMPORTANT: env is forced BEFORE requiring ./server so server.ts computes
 * isCronEnabled = true and takes the WORKER_PROCESS branch. dotenv.config()
 * inside server.ts does NOT override already-set process.env values, so these
 * assignments win. A plain `import "./server"` would be hoisted above these
 * lines, so we intentionally use require() after setting the env.
 */
process.env.WORKER_PROCESS = "true";
process.env.WORKER_ROLE = "primary";
process.env.ENABLE_BACKGROUND_JOBS = "true";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./server");
