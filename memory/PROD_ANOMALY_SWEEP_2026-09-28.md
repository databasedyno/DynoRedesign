# Production anomaly sweep — 48h window ending 2026-09-28 23:30Z

Source: LIVE prod PostgreSQL (read-only, `backend/scripts/ro_anomaly_sweep{,2,3}.js`). Droplet container logs NOT reachable from this pod (no SSH key in /root/.ssh; SSH_TUNNEL_HOST empty). Findings below are from persisted tables (service health, payment journal, outbox, webhook delivery log, inbound events, security tables, users/companies).

## Findings (ordered by severity)

1. **Settlement false-failure + 5h49m recovery loop — payment f8e1ca0e (company 71 samdav1, 0.00793 ETH, 2026-09-27)**
   - 14:09:05 detected → 14:09:07 settlement TX broadcast (0xd797…, confirmed on-chain 14:11). Then 14:14:21 a re-run re-detected it, settlement retried against an already-swept address → state `failed` → merchant got `payment.settlement_failed` webhook at 14:14:31.
   - Reconciliation then cycled failed→processing→settlement_started ~30× every 10 min (incl. one `permanently_failed` reset at 19:37) until 19:58:31 `settlement_auto_recovered` ("Settlement TX found on-chain but DB was never updated") → `payment.settled` webhooks. Money was correct; merchant saw failed→settled 5.7h apart.
   - Root cause needs droplet logs 14:09–14:15Z (post-broadcast state write failed / job retried). Hardening ideas: persist outgoing tx hash to Redis+DB atomically right after broadcast; run on-chain verify on the FIRST reconciliation cycle when a `settlement_tx_broadcast` journal row exists (today needs retryCount ≥ 2); suppress `settlement_failed` merchant webhook when a broadcast hash exists.

2. **Background-jobs stall 2026-09-27 15:10Z → 15:56Z (~46 min)**: no service-health rows 15:15/15:30/15:45, reconciliation skipped 15:20–15:50, resumed off-schedule at 15:56:25 (looks like a container restart). API stayed up (2 logins, journal writes). Smaller single-run misses: 09-27 10:xx, 12:xx; 09-28 10:xx, 16:xx. Check `docker inspect` RestartCount / OOM on the droplet.

3. **Outbox row #612 stuck in `processing` since 09-27 14:09Z** (merchant.webhook payment.confirmed for the same payment). `claimBatch` sets processing but there is no stale-lease reclaim → a crash/DB hiccup between claim and mark leaves rows forever. Impact here: samdav1 `/api/store/crypto-webhook` never got `payment.confirmed` (the other endpoint did; it did get `payment.settled`). Fix: reclaim `processing` rows older than N min back to `pending` in `relayPendingBatch`.

4. **Multi-endpoint webhook fan-out drops the failed target**: `callMerchantWebhook` returns success if ANY target delivered, so the outbox never retries the failed one. 09-28: nomadly1 (18:49Z) and samdav1 (23:01Z) `/api/store/crypto-webhook` returned 404 once each (Railway redeploy blips) → those `payment.created` events are lost for that endpoint. Design gap; per-target retry state would fix.

5. **webhook.test SSRF probe flood 09-27 00:17–01:24Z (148 events, company 1)** — DynoPay's own SSRF suite (memory/AGENT_HANDOFF.md). It reached loopback via IPv4-mapped IPv6 (`[0:0:0:0:0:ffff:127.0.0.1]:8001` → 400/403/404/500). Guard fix exists in code (`utils/outboundUrlGuard.ts`); confirm it is deployed on the droplet.

6. **Stablecoin conversion #8 `HELD` since 09-25** — BTC $115.67 → USDT held on Binance as SafeDeal escrow custody. BY DESIGN (deal #347-style), not an anomaly.

7. Observability gaps (not incidents): `tbl_inbound_events` never marked processed (523 `received`; `markProcessed` is never called — dedup ledger only); `tbl_api_usage_log` has 0 rows ever (feature not wired); `tbl_security_log` / `tbl_nexus_alert` / `tbl_incident` empty; `tbl_login_activities` only 2 rows vs 69 sessions.

## Normal / healthy
- Service health: all 5 services `operational` (one `degraded` Webhook Delivery blip 09-27 04:00 during the test flood). Latency avg 33–68 ms.
- Payments 48h: 13 successful ($754.70) vs 6 ($682) prior 48h; 49 detections, 28 completions, 11 overpayments credited, 1 expiry; no stuck live txs; gas audit 14 reconciled (variance $0.05); key access 331 worker reads, 0 failures.
- Signups 48h: 18 users / 19 brands (16 Google, 2 email, 1 GitHub; all gmail except stakededge.com; countries FR/EG/NL/IN/BR/MA/CZ/UK/TR/TW/PS/SO) — organic-looking, no disposable domains in 48h (2 mailinator + 2 dynopay-test in the 7d window are QA). 69 sessions / 19 users, 0 flagged logins, 0 security events.
- Tatum inbound events flowing (58 in 48h). Outbox: 77 dispatched, 0 pending, 14 old failed (Sept 5–8, merchant 308/401 — pre-window).

## Actions taken 2026-09-29 (user: "fix all")
- Finding 1 was ALREADY root-caused + fixed by a previous session (PRD 2026-09-27 "STUCK ETH DEPOSIT #1279", commit c0f3d6af6, deployed 19:58Z): deploy run 36324413883 (old swap-first script) killed the container mid-confirmation; verifyEvmSettlement returned "not implemented" so nothing could see the mined payout. Added on top: services/webhookProcessor.ts now WITHHOLDS the `payment.settlement_failed` merchant webhook when a `settlement_tx_broadcast` journal row exists for the payment (fail-open on journal read error). Tests: __tests__/webhookProcessor.test.ts (2 new).
- Finding 3: services/outbox/outboxService.ts — claim stamps a 10-min lease on available_at; `reclaimStaleProcessing()` runs before each claim: expired-lease rows created <24h → pending (redelivered), older → failed "not redelivered". Exported PROCESSING_LEASE_MS / STALE_REDELIVERY_MAX_AGE_MS / OutboxPartialFailure. Prod row #612 closed by hand (UPDATE … WHERE id=612 AND status='processing' → failed, explanatory last_error); open rows now 0.
- Finding 4: per-target retries — webhooks/index.ts callMerchantWebhook(customerData, eventData, { skipUrls }) returns { delivered[], failed[{url,error}] } (legacy `success` = ANY delivered kept for direct callers); services/outbox/outboxDispatchers.ts throws OutboxPartialFailure(deliveredTargets) when some targets failed transiently → markRetry persists payload.deliveredTargets → next attempt skips them. PERMANENT_SKIP regex extended (not a valid URL | must use http | could not be resolved). Tests: __tests__/outboxReliability.test.ts (9).
- Finding 5 (SSRF fix deployed?) still unverified — needs droplet access.
- Option d: generated /root/.ssh/dynopay_prod_ed25519 (pub: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAU9mWcLKYp5QPi3rMplIYylVFTpeqI2Vjbf4t7vbiom emergent-agent-dynopay-prodlogs-2026-09-28). User must append it to root@134.209.94.115:~/.ssh/authorized_keys. Then: `ssh -i ~/.ssh/dynopay_prod_ed25519 root@134.209.94.115 'docker ps; docker logs --since 2026-09-27T14:05:00Z --until 2026-09-27T14:20:00Z <container>'`.
- NOTE: none of the backend fixes are live in prod until Save to GitHub → deploy. Unit suite 708/710 (paymentFees.test.ts flaked under full-suite load, passes alone; unrelated fee math).

## Droplet log RCA 2026-09-29 (SSH access granted; read-only journalctl + docker)
Host `root@134.209.94.115` (dynopay-prod-ams3), single container `dynopay`, image tag = git SHA. Container json-file logs only span the live container, so Sep 27 app stdout is gone (old containers `docker rm`'d on each deploy) — but **journald persists Sep 20→now**, so dockerd/containerd/kernel events for both windows were fully recoverable.

- **Finding 2 (46-min stall 15:10–15:56Z) = CRASH-LOOP from a bad deploy, NOT an OOM.**
  - No OOM anywhere: kernel log clean, container `HostConfig.Memory=0` (no cgroup mem limit), `OOMKilled=false`. Exit code was **1** (app startup crash), not 137 (OOM).
  - Timeline (journald docker.service/containerd): deploys at 13:55, 14:09, 14:26 were clean container swaps. The **15:11:45Z deploy shipped a build that crashes on boot** — dockerd `restarting container … exitCode=1 … restartPolicy="{unless-stopped}"` fired continuously (container `d03bb13e…` then `be82676…`), ~59 exit-1 restarts, backoff growing 3s→60s, reaching restartCount=32 by 15:56.
  - At **15:56:15Z** dockerd `stopping restart-manager` for `be82676…` and started a NEW good container `cd21617b…` → recovery. Matches DB "resumed off-schedule at 15:56:25Z". During the ~45-min loop the app never stayed up long enough to run BullMQ cron (service-health 15:15/30/45 missing, reconciliation 15:20–15:50 skipped).
  - Root cause of the crash itself (which line exited 1) is NOT recoverable from logs — that container's stdout was deleted on the recovery deploy. Preventive: add a `healthcheck`-gated rolling deploy (don't `rm` the old container until the new one is healthy) and/or a CI smoke boot so a build that exits 1 never reaches prod. `unless-stopped` turned one bad build into a 45-min outage.

- **Finding 1 (settlement false-failure 14:09Z):** confirmed a **clean container swap at 14:09:08–14:09:13Z** (deploy, graceful stop — not a crash) interrupted payment f8e1ca0e mid-confirmation exactly as hypothesised. Consistent with the already-committed webhookProcessor fix (withhold settlement_failed webhook when broadcast row exists).

- **Finding 5 (SSRF guard) = VERIFIED LIVE.** Running image `4396c3c729…` contains compiled `/app/backend/dist/utils/outboundUrlGuard.js` (130 lines) with IPv4-mapped IPv6 / loopback / private-range logic (`ffff`, `::1`, `127.`, `isPrivate`, `IPv4-mapped`, `mapped`). Guard is deployed and running.

- **Current prod health (00:10Z Sep 29):** container Up ~38m, healthy, RestartCount=0, mem 861Mi/3.8Gi, disk 12%. Crons running normally (RPCHealth, reconcileDeferredPayments, preWarmAddressPool, paymentWatchdog, refundForwarding, WebhookQueue health OK every 60s, WrongAsset/OrphanDetect scans). No crash strings.

- **Deploy gap:** live image `4396c3c729…` is BEHIND repo HEAD `8e2bf4dd8`. This session's 3 anomaly fixes (outbox stale-lease, per-target fan-out, settlement false-failure) are committed but **NOT yet deployed** — needs Save to GitHub → deploy.
