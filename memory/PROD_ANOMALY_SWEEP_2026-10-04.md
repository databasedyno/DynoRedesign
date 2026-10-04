# Production anomaly sweep — 48h window ending 2026-10-04 ~11:00Z

Sources: LIVE prod Postgres (read-only `backend/scripts/ro_anomaly_sweep{,2,3}.js` + `ro_inbound_backlog.js`)
AND the droplet `root@134.209.94.115` (dynopay-prod-ams3) via a fresh SSH key
(`/root/.ssh/dynopay_prod_ed25519`, wiped on new pods) — `docker inspect/logs`, `journalctl`.

## Infra health — solid
- Container `dynopay` healthy, RestartCount=0, OOMKilled=false, no kernel OOM, disk 11%, mem 322MiB/3.8GiB, Caddy active, /health 200.
- Running image `eb3954097…` == latest app-code HEAD → **last sweep's fixes ARE deployed** (deploy gap closed).
- 14 container swaps in 48h = frequent `deploy_on_push`, all CLEAN (unique IDs, exit 0, no crash-loop).

## Findings
1. **Gas wallets starved (operational, NOT code):** ETH fee wallet `0x2b29aa06…` ≈ $0.61 CRITICAL; TRX `TMHECc7emy…` ≈ $14.17 WARNING; POL/XRP healthy. `[MerchantPool] Skipping sweep — NO gas funded` recurring → EVM/TRON merchant sweeps blocked. **ACTION: owner must fund ETH + TRX gas wallets.** (Not fixed in code.)
2. **One bad merchant endpoint flipped GLOBAL "Webhook Delivery" to OUTAGE + retry storm.** Company 269 dev CF Worker (`cutefeetcollection-development…workers.dev`) returned 72× HTTP 400 + 6× 500 (last 01:56Z) → service-health 14 "outage"+2 "degraded"; 12 outbox rows stuck `pending` retrying a permanent 400.
3. **Health-check cron ~30-min gaps ×3** — journald shows they coincide with deploy/container swaps (NOT crashes/OOM). One `*/15` tick skipped during a swap.
4. **Tatum inbound-events backlog 531** `received`/processed_at NULL — ALL `ADDRESS_EVENT`, all 2026-08-29→09-29 01:28Z. Since 09-29 02:45Z every event transitions correctly (markProcessed/markSkipped). So the ingestion leak was ALREADY fixed; 531 is a FROZEN historical backlog polluting the "unprocessed" metric (no new growth).

## Fixes applied this session (code; committed, NOT yet deployed)
- **#2a** `services/monitoringService.ts`: new exported pure `classifyWebhookDeliveryHealth()`. webhook_delivery probe now (a) excludes `webhook.test`, (b) EXCLUDES merchant-side 4xx from "deliverable" (we delivered; their app rejected), (c) measures per-company and uses `max(volumeRate, companyRate)` when ≥2 companies active → one noisy merchant can't force a global OUTAGE. Genuine system-wide failure / Redis-down still → degraded/outage.
- **#2b** `webhooks/index.ts`: `callUrlWithPayload` sets `permanent:true` on merchant 4xx (except 429) and non-retryable redirect problems; propagated through `WebhookResult.failed[].permanent` + top-level `permanent`. `services/outbox/outboxDispatchers.ts` treats `permanent` targets as non-retryable (stops the retry storm; stuck `pending` rows clear on next attempt).
- **#3** `utils/cronJobs.ts` `setupHealthCheckCron`: runs ONE health snapshot 8s after boot (leader only) so a deploy landing mid-interval no longer leaves a 15–30 min gap.
- **#4** `services/idempotency/inboundEventService.ts`: new `reconcileStaleReceivedInboundEvents(24h)`; scheduled daily 03:15 UTC in cronJobs.ts. Marks stale `received` rows (incl. the frozen 531) → `skipped` with reason. Self-heals on first prod run; prevents recurrence.

## Verification
- Jest: `__tests__/webhookDeliveryHealth.test.ts` (6) + extended `__tests__/outboxReliability.test.ts` (perm-4xx not retried, 5xx still retried, legacy top-level permanent) — **19/19 pass**. ts-jest type-checks the edited sources.
- NOT integration-verified: these paths run only on the droplet with background jobs, which are OFF in the SAFE-MODE preview (talks to LIVE prod DB — must not write). Full verification happens on the next droplet deploy. testing_agent was NOT run (would risk prod writes; session ended early at user request).

## To go live
Save to GitHub → droplet CI deploy. #1 (fund gas wallets) is owner action, not deployed code.
New read-only helper added: `backend/scripts/ro_inbound_backlog.js`.
