# Production Anomaly Sweep — 2026-10-10 (24h window)

Host: `dynopay-prod-ams3` (134.209.94.115). Read-only SSH diagnostics per PROD_LOG_ACCESS_RUNBOOK.md.
Fresh pod key authorized: `emergent-agent-dynopay-prodlogs-2026-10-10`.

## Health baseline — GOOD
- Container `dynopay` Up 18h, **healthy**, restarts=0. Caddy active. Load avg 0.09. Disk 12%. Mem 0.9G/3.8G used.
- Backend app logs (~92k lines / 18h): **0 5xx**, **0 uncaught/unhandled exceptions**, **0 DB/OOM errors**, **0 cron errors**.
- No runaway client / fetch-loop (per-IP volume all ~1 req).

## Anomalies worth action
1. **Broken logo in OLD emails** — `GET /api/static/dynopay-email-logo-v4.png 404` ×193/24h. Current template uses v6 (v6 light/dark + safedeal v1 all return 200). No current code references v4 — these are recipients opening pre-v6 emails → broken logo image. Fix: drop a `dynopay-email-logo-v4.png` alias (copy of current light logo) into the served `public/` dir so historical emails render. Cosmetic, historical only.
2. **`/api/wallet/batch` latency outlier** — one call **61,996ms (62s)** from 66.93.128.230; others 4.7s / 5.2s. `/api/wallet/getWallet` ~1.6–2.0s; `/api/wallet/address-sanity` ~1.5–1.9s; `/api/wallet/verifyOtp` 5.8s once. Likely multi-chain RPC fan-out with no per-call cap. 62s ties up a worker and risks gateway timeout. Investigate a timeout + parallelization. (`/api/support/chat` 4–10s is expected LLM latency.)
3. **Broken KB cross-link** — `GET /api/kb/articles/supported-cryptocurrencies-and-networks 404` ×9. Confirmed referenced in `Components/Page/HelpAndSupport/Slugs/getting-started-with-dynopay.tsx:83` as a related-article link, but the article 404s. Fix: publish that KB article or repoint/remove the link.

## Non-issues (expected / working as intended)
- **Caddy "502" ×1461/24h** — ~all hostile scanner probes (`.env`, `.php`, `wp-`, `/wordpress/`) dropped by container nginx `return 444`, logged by Caddy as upstream EOF/502. Non-scanner filter left only `/wordpress/` ×3. Not customer-facing (runbook §5). nginx error.log empty.
- **Crypto webhook "⛔ SPAM TOKEN REJECTED" ×4** — spam/unknown-asset dust (e.g. `TRC20AdsCOM`, random contracts) correctly rejected before enqueue. Filter working.
- **401s on authed endpoints** (`/api/user/profile`, `/api/dashboard/*`, `/api/wallet/security/status`, etc., ~10–34 each) — unauthenticated / expired-session noise. Expected.
- **Creator-handle 404s** (`/api/pay/creator/<handle>` + `/analytics`: steliospal 33, tiktaak37 14, wp/z47zrd/staging/dev/nima…) — non-existent handles, mix of bots and dead links. Expected.
- **Crons** — WrongAsset scans, PreWarm, CrumbSweeper, ErrorMonitor all `errors=0`.
- Reconciliation re-queued 2 Tatum webhooks (self-healing working).
