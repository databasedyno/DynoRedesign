# Option C — Migrate DynoPay from App Platform to a DigitalOcean Droplet (static IP for Binance)

Status: **IN PROGRESS — infrastructure provisioned 2026-09-10** (user approved Option C, "yes to all").
Owner decision: **C chosen** (was A/B/C pending).

## PROGRESS LOG — 2026-09-10 (pod session)
Infrastructure created on the owner's DO account (token pasted in chat — ROTATE after):
- Tag `dynopay`; Cloud Firewall `dynopay-prod-fw` id `e67dcd74-0d1a-47d5-bf4f-9a367dbb03b0` (inbound 22/80/443 open, key-only SSH; tighten 22 later).
- SSH key `dynopay-prod-deploy-20260910` id `59253845` (private key on pod at `/root/.ssh/dynopay_droplet`).
- Droplet `dynopay-prod-ams3` id `599433401`, ams3, `s-2vcpu-4gb`, ubuntu-24-04, monitoring on, IPv6 on. **Public IPv4 = 134.209.94.115**.
- Reserved IP **129.212.213.147** (ams3) assigned to the droplet.
- cloud-init done: Docker 29.8.0, Docker Compose v5.5.1, Caddy v2.11.4 (installed, STOPPED/disabled until DNS cutover so it doesn't request TLS certs early). `/opt/dynopay/uploads` created.

### ⚠️ PLAN CORRECTION — which IP to whitelist in Binance
The original plan assumed the **Reserved IP** would be the Binance egress IP. **That is wrong on DigitalOcean.**
Empirically verified from the droplet: `curl https://api.ipify.org` → **134.209.94.115** (the droplet's OWN public IPv4),
NOT the Reserved IP. DO Reserved IPs are **inbound-only** (anchor interface); outbound egresses via the droplet's primary IPv4.
`api.binance.com` is **IPv4-only** (AAAA is a v4-mapped `::ffff:…`), and `/api/v3/ping` from the droplet → **200** (not geo-blocked).
➡️ **Whitelist `134.209.94.115` in Binance → API Management → "Restrict access to trusted IPs only".**
Caveat: this is the droplet's own IP — it survives reboots/resizes but NOT a destroy+recreate. The Reserved IP still serves
INBOUND (DNS points at it, survives rebuild). If you later need a rebuild-surviving *egress* IP, add policy-routing so the
default route uses the reserved/anchor IP (extra config, not required now — just don't destroy the droplet).

### Remaining (this session)
Build the app image on the droplet (jobs OFF), write compose/Caddyfile/CI workflow, smoke-test on droplet, then owner does
Binance whitelist + DNS cutover. `DYNOPAY_WEBHOOK_SECRET` still needed from owner for the final `.env` (9/10 secrets came from the vault).

### DEPLOYED & SMOKE-PASSED on the droplet — 2026-09-10 20:16Z
- `/opt/dynopay/.env` assembled: 195 keys = App Platform PROD spec (URLs/flags) + vault creds (identical to live app) + temp `DYNOPAY_WEBHOOK_SECRET`. Jobs OFF + email OFF for the smoke.
- Source shipped from pod → `/opt/dynopay/src`; image built ON the droplet (`docker build`, 4G swap added) → `dynopay:local` (897 MB). NOTE: deviation from the GHCR pipeline — image is built locally on the box for now; `.github/workflows/deploy-droplet.yml` is written in the repo for the GHCR/CI path once owner does Save-to-GitHub + sets repo secrets.
- `/opt/dynopay/docker-compose.yml` (image `dynopay:local`, env_file, `127.0.0.1:8001:8001`, `./uploads` volume, healthcheck, log rotation), `/opt/dynopay/build.sh`, `/etc/caddy/Caddyfile` (4 domains, Caddy still STOPPED until DNS cutover).
- `docker compose up -d` → container **healthy**. Boot log: Redis connected, PostgreSQL connected, migrations **0 applied / 23 present** (no schema change), listening 3300, nginx 8001, jobs disabled, BinanceWS connected (not geo-blocked from ams3).
- Smoke (Host: dynopay.com, on droplet localhost): `/health` 200, `/auth/login` 200 (title "Log in · Dynopay"), `/api/status/gateway` 200, `/pay` 200. Container egress IPv4 = **134.209.94.115**.
- Binance signed `/api/v3/account` from the droplet IP = baseline **-2015** (keys valid, IP not yet whitelisted). Flips to SUCCESS once owner whitelists 134.209.94.115.

### FINAL STEPS (owner-gated — NOT done)
0. **✅ ACCEPTANCE TEST PASSED 2026-09-10 ~20:40Z**: vault Binance key `Ue0UNc…2K2T` was STALE; owner supplied the current key `h3TyPs…z1TG` + secret. Signed `/api/v3/account` from the droplet IP 134.209.94.115 → `SUCCESS http=200 canTrade=true accountType=SPOT assetsWithBalance=5`. Working key/secret persisted in `/opt/dynopay/.env` (BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_SECRET_KEY alias); container healthy. **FOLLOW-UP: update `env.vault.enc` + App Platform SECRETs with this working key so all envs are consistent.** CI deploy key added (`/root/.ssh/dynopay_ci`, in droplet authorized_keys).
### ✅✅ CUTOVER COMPLETE — 2026-09-10 ~21:03Z
- Droplet flipped to prod mode: `ENABLE_BACKGROUND_JOBS=true`, `DISABLE_OUTBOUND_EMAIL=false`.
- **App Platform spec PUT (backup `/root/appspec_backup.json`)**: removed all 4 custom domains (releases DO-managed A/AAAA) + set `ENABLE_BACKGROUND_JOBS=false`. 10 encrypted secrets preserved (EV guard). Deploy `178b8a97` ACTIVE.
- DNS (DO API): `dynopay.com`+`dynopay.me` apex **A → 134.209.94.115** (ttl 60); Cloudflare A/AAAA auto-removed on domain detach; `www`+`checkout` CNAME → apex. Public DNS (Google) confirms all 4 → droplet.
- Caddy issued 4 LE certs. External HTTPS verified 200/301 valid TLS remote_ip=droplet; HTTP→HTTPS 308.
- Droplet **PROMOTED to background-jobs leader** → auto-convert + all crons run on the droplet with the WORKING Binance key.

### REMAINING FOLLOW-UPS (owner)
1. **Rollback window (48h)**: App Platform still runs (jobs off, no domains) as a warm target at `dynopay-bcibf.ondigitalocean.app`. Roll back by restoring `/root/appspec_backup.json` via `PUT /v2/apps/{id}` (re-adds domains + managed records + jobs) or repointing DNS.
2. **Decommission** App Platform after ~48h stable (stops $25/mo; `deploy_on_push` still true → delete the app).
3. **Update `env.vault.enc`** + pod `/app/.env` with the working Binance key `h3TyPs…` (they still hold the STALE `Ue0UNc…`).
4. **Rotate the DO API token** pasted in chat.
5. ✅ **DONE — GitHub droplet auto-deploy is LIVE (2026-09-10 ~22:20Z)**: repo secrets set, CI run #5 (sha 7005cb22)
   green end-to-end (build → push GHCR → SSH deploy). Droplet now runs `ghcr.io/databasedyno/dynopay:latest`
   (digest sha256:8f185d7d…), NOT the old `dynopay:local`. **CI build fix**: the Dockerfile frontend-builder stage
   was missing `COPY fonts/ ./fonts/`, so after _app.tsx moved Unbounded+IBM Plex to next/font/local, `yarn build`
   failed "Module not found: ../fonts/*.woff2" (failed runs #1,#2,#4). Added the COPY (commit 7005cb223). Prod now
   serves self-hosted fonts with zero fonts.googleapis.com build/runtime dependency.
Droplet SSH: `ssh -i /root/.ssh/dynopay_droplet root@134.209.94.115`. Reserved IP 129.212.213.147 (inbound only).


## 0. Why (verified live on dynopay.com, 2026-09-10)
- Auto-convert is broken because the Binance API key is IP-restricted and App Platform's outbound IP is shared/rotating.
  `GET /api/diagnostics/binance-account` (super-admin token) → `-2015 Invalid API-key, IP, or permissions`.
  `GET /api/diagnostics/binance-ping` → OK (Amsterdam is not geo-blocked, so the code path never uses the SOCKS proxy).
- The old SSH-tunnel workaround (Vultr `95.179.167.16`, Frankfurt) **never runs in prod**: the Alpine image has no
  `sshpass`/`openssh-client`, so `sshTunnelManager` reports `enabled:false`. Also `binanceService.detectBinanceAccess`
  only enables the proxy on HTTP 451/403 (geo-block), never for IP-whitelisting. If Option B is ever chosen instead,
  add `BINANCE_PROXY_MODE=always` handling in `backend/services/binanceService.ts` (force `proxyNeeded=true`).
- A droplet's public IPv4 is fixed for the droplet's lifetime; a **Reserved IP** (free while assigned) survives
  rebuilds. Whitelist that IP in Binance → API Management → "Restrict access to trusted IPs only".

## 1. Current production inventory (from DO API, token in chat — ROTATE it afterwards)
| Item | Value |
|---|---|
| App Platform app | `dynopay` id `f86b27dc-feb0-4a44-a4e9-ebd2053e0468`, region **ams** (ams3), `apps-s-1vcpu-2gb` = $25/mo, 1 instance |
| Component | service `dynoredesign`, Dockerfile `/Dockerfile`, http_port **8001**, GitHub `databasedyno/DynoRedesign` branch **`Improvement`**, deploy_on_push |
| Default ingress | `https://dynopay-bcibf.ondigitalocean.app` |
| Domains on the app | `dynopay.com`, `www.dynopay.com`, `checkout.dynopay.com`, `dynopay.me` |
| DNS | Hosted on **DigitalOcean DNS** (ns1-3.digitalocean.com). `dynopay.com`/`dynopay.me` apex A → `162.159.140.98`, `172.66.0.96` + AAAA (App Platform's Cloudflare edge). `www`, `checkout` CNAME → `dynopay-bcibf.ondigitalocean.app`. Also a `verify.bing.com` CNAME (keep). |
| Env vars | **195** in the spec; **10 SECRET** (encrypted `EV[1:…]` — NOT readable via API): `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `BINANCE_SECRET_KEY`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`, `OPENAI_API_KEY`, `SPACES_ACCESS_KEY`, `SPACES_SECRET_KEY`, `DYNOPAY_WEBHOOK_SECRET`. 9 of 10 exist in the vault `.env` (`env.vault.enc`, passphrase in test_credentials.md). **`DYNOPAY_WEBHOOK_SECRET` is NOT in the vault** — get it from the owner (DO console → app → Settings → env, "show") or regenerate (used in `backend/webhooks/index.ts` as the default merchant webhook signing secret; changing it re-signs all merchant webhooks — coordinate). |
| Plain-text secret to fix | `SSH_TUNNEL_PASS` is a NON-encrypted env in the spec. Retire the tunnel (delete SSH_TUNNEL_* + BINANCE_PROXY_URL) once the droplet is live. |
| External deps (unchanged by migration) | Postgres + Redis on Railway (`HOST=roundhouse.proxy.rlwy.net`, `REDIS_PUBLIC_URL`), Spaces bucket `dynopay-uploads-6708cc37` (ams3, CDN endpoint), Tatum, Brevo, Veriff, Flutterwave, Telnyx, OpenAI |
| Runtime shape | One container: nginx (:8001) → Next.js standalone (:3000) + Express (:3300). `start-all.sh` waits for backend `/health` before starting nginx. Background jobs run in-process (`ENABLE_BACKGROUND_JOBS=true`, `WORKER_ROLE=primary`, leader election in reconciliation/orderExpiry/payoutDigest). |
| Local disk | `UPLOAD_PATH` (default `backend/../uploads`) serves `/images`, `/api/static/images`; product assets go to Spaces. Mount a docker volume for `/app/uploads` so support-chat uploads survive redeploys (App Platform disk was ephemeral anyway). |
| Account facts | No Container Registry yet, no VPC in ams3 (defaults exist for nyc1/fra1/sgp1), no Reserved IPs, 4 unrelated droplets (whm2 $32, 3× nomadly $6). Droplet limit 10. Aug invoice $76.20 total. |

## 2. Target architecture
```
Internet ─▶ DO DNS (A/AAAA → Reserved IP) ─▶ Droplet ams3 (s-2vcpu-4gb, $24)
            ├─ DO Cloud Firewall: 22 (owner IPs only), 80, 443
            ├─ Caddy (host or container) — auto Let's Encrypt for dynopay.com, www, checkout, dynopay.me → :8001
            └─ docker compose: dynopay image (existing Dockerfile, EXPOSE 8001), volume ./uploads:/app/uploads, env_file /opt/dynopay/.env
Build: GitHub Actions on push to `Improvement` → build image → push GHCR (private) → SSH deploy → `docker compose pull && up -d` (blue/green not needed; ~20–40s cutover, nginx inside waits for backend /health)
Outbound: droplet public IP == Reserved IP → whitelist in Binance. No proxy code needed.
```
Sizing: `s-2vcpu-4gb` ($24, 80 GB, 4 TB xfer) — 2× current CPU/RAM. `s-2vcpu-2gb` ($18) also fits at runtime
(Next standalone ~300 MB + Express ~400–600 MB + nginx) but leaves no headroom for `docker pull`/extract + background
jobs; do NOT build the image on a 2 GB box (the Next + tsc build OOMs; App Platform already needed 2 GB). Optional:
Droplet Backups +20% (~$4.80). Total **$24–29/mo**, replacing the $25 App Platform bill (net ≈ $0).

## 3. Step-by-step (each step independently testable)
1. **Prep secrets** — assemble `/opt/dynopay/.env` (195 keys): export non-secret values from the app spec
   (`GET /v2/apps/{id}` → `spec.services[0].envs` + `spec.envs`, skip `type==SECRET`), fill the 10 secrets from the
   vault `.env` (+ `DYNOPAY_WEBHOOK_SECRET` from owner). Set `PORT=8001`, `INTERNAL_BACKEND_URL=http://localhost:3300`,
   keep all URL keys as `https://dynopay.com` / `https://checkout.dynopay.com`. Drop `SSH_TUNNEL_*`, `BINANCE_PROXY_URL`.
   Test: `node -e` count of keys == 195 − 5 dropped.
2. **Reserved IP + droplet (API)** — `POST /v2/droplets` `{name:"dynopay-prod-ams3", region:"ams3", size:"s-2vcpu-4gb",
   image:"docker-24-04" (Docker-on-Ubuntu marketplace) or "ubuntu-24-04-x64" + cloud-init installing docker, ssh_keys:[new key],
   monitoring:true, backups:false, tags:["dynopay","prod"]}`. Then `POST /v2/reserved_ips {droplet_id}` and record the IP.
   Cloud-init: create `deploy` user, disable password SSH, `ufw` not needed (use DO firewall), install `caddy`,
   `mkdir -p /opt/dynopay/uploads`. Test: `ssh deploy@<reserved-ip> docker --version && caddy version`.
3. **Cloud Firewall (API)** — `POST /v2/firewalls`: inbound 22 from owner IP(s)/CI runner IPs (or use DO's
   `doctl compute ssh` via console), 80+443 from 0.0.0.0/0,::/0; outbound all. Attach by tag `dynopay`.
   Test: `nmap`/curl from outside: 80/443 open, 22 filtered.
4. **Image pipeline** — add `.github/workflows/deploy-droplet.yml`: on push to `Improvement`: `docker buildx build`
   with the same `--build-arg`s the Dockerfile declares (`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SERVER_URL`,
   `NEXT_PUBLIC_API_DOCS_URL`, `NEXT_PUBLIC_CYPHER_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`,
   `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`, `NEXT_PUBLIC_ENABLE_GITHUB_AUTH`, `NEXT_PUBLIC_GITHUB_CLIENT_ID`,
   `NEXT_PUBLIC_ENABLE_CRYPTO_REFUNDS`, `NEXT_PUBLIC_CREATOR_BASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — see
   Dockerfile lines ~97–143; App Platform passed ALL envs as build args, so audit any other `NEXT_PUBLIC_*` the
   frontend reads: `NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG`, `NEXT_PUBLIC_INLINE_TIP_CHECKOUT`, `NEXT_PUBLIC_CLEAN_CHECKOUT_V2`,
   `NEXT_PUBLIC_SHOW_SOCIAL_LINKS` — add matching `ARG`/`ENV` lines or they will be undefined in the browser bundle),
   push to `ghcr.io/databasedyno/dynopay:sha` + `:latest` (GitHub secrets: build args; `DEPLOY_SSH_KEY`, `DEPLOY_HOST`),
   then `ssh deploy@host 'cd /opt/dynopay && docker compose pull && docker compose up -d && docker image prune -f'`.
   Alternative registry: DOCR Basic $5/mo (Starter free tier is 500 MiB — this image is larger). Test: workflow green,
   `docker ps` shows the container, `curl -s localhost:8001/health` on the droplet → 200.
5. **Compose + Caddy** — `/opt/dynopay/docker-compose.yml`: service `app` image ghcr…, `env_file: .env`,
   `ports: ["127.0.0.1:8001:8001"]`, `volumes: ["./uploads:/app/uploads"]`, `restart: unless-stopped`,
   `healthcheck: curl -f http://localhost:8001/health`, `logging: json-file max-size 50m max-file 5`.
   `/etc/caddy/Caddyfile`: `dynopay.com, www.dynopay.com, checkout.dynopay.com, dynopay.me { encode zstd gzip
   reverse_proxy 127.0.0.1:8001 { header_up X-Forwarded-Proto https } }` — the in-container nginx already routes
   `/api/auth/*`→Next, `/api/*`,`/health`,`/images`,`/videos`,`/api/docs`→Express, rest→Next (client_max_body_size 50M —
   Caddy has no body limit by default). Note Caddy can only get certs AFTER DNS points at it (step 7); until then test
   with `curl -H 'Host: dynopay.com' http://<reserved-ip>/health` → 200 and `/auth/login` → 200 HTML.
6. **Pre-cutover smoke on the droplet (no DNS change yet)** — from the pod: `curl --resolve dynopay.com:443:<ip>` is
   not possible before certs, so use HTTP + Host header: `/health` (db+redis connected, tatum operational), `/api/status`,
   admin login `POST /api/admin/login`, `GET /api/diagnostics/binance-ping` → 200. **Do NOT run two primaries with
   background jobs against the same DB/Redis**: set `ENABLE_BACKGROUND_JOBS=false` in the droplet `.env` for this smoke,
   flip to `true` at cutover (leader election exists but keep it simple).
7. **Binance whitelist** — Binance → API Management → edit key → "Restrict access to trusted IPs only" → add the Reserved
   IP → save (2FA). Then on the droplet (still with jobs off) call `/api/diagnostics/binance-account` with the admin token
   → expect `success:true` and an account payload. This is the acceptance test for the whole exercise.
8. **Cutover (DO DNS API, TTLs are already 30 s on the apex)** — lower `www`/`checkout` CNAME TTL to 60 s a day
   before; then: (a) set `ENABLE_BACKGROUND_JOBS=true` on the droplet + `docker compose up -d`; (b) scale the App
   Platform service to jobs off: update spec env `ENABLE_BACKGROUND_JOBS=false` (`PUT /v2/apps/{id}` full spec) — avoids
   two schedulers during the overlap; (c) replace apex A records (both `dynopay.com` and `dynopay.me`) with the Reserved
   IP, delete the AAAA records (droplet has no IPv6 unless enabled — enable IPv6 on the droplet and add AAAA if you want
   parity), change `www` + `checkout` CNAMEs to point at `dynopay.com` (or A → IP). Caddy obtains 4 certs within ~1 min.
   Test: `curl -I https://dynopay.com https://checkout.dynopay.com https://www.dynopay.com https://dynopay.me` → 200/301,
   login flow in browser, a test payment link page renders, Tatum webhook reaches `/api/...` (check logs), IndexNow
   pinger in `start-all.sh` fires once.
9. **Decommission** — after 48 h clean: delete the App Platform app (stops the $25), delete `SSH_TUNNEL_*` usage
   (retire the Vultr box), mark the migration in PRD/CHANGELOG, update `DIGITALOCEAN_DEPLOYMENT.md` (currently App
   Platform-only) or add `DROPLET_DEPLOYMENT.md`. Rotate the DO API token that was pasted in chat.

## 4. Things you lose vs App Platform (and the mitigation)
| Lost | Mitigation |
|---|---|
| Deploy on push + build infra | GitHub Actions workflow (step 4) |
| Managed TLS + Cloudflare edge/WAF | Caddy auto-TLS; optional: put Cloudflare (free) in front later — DNS would move off DO DNS |
| Zero-downtime rolling deploy | `docker compose up -d` recreates the container (~20–40 s while backend boots: migrations, pool init). Acceptable for now; blue/green with two compose services + Caddy `lb_policy` is a later upgrade |
| Health-check restarts | `restart: unless-stopped` + compose healthcheck; add DO Monitoring alerts (CPU, disk, memory) via `/v2/monitoring/alerts` |
| Log viewer | `docker logs`, or ship to DO/Logtail later |
| OS patching | `unattended-upgrades` in cloud-init; monthly reboot window |
| Rollback | `docker compose` with a pinned `:sha` tag; keep last 3 images |

## 5. Rollback plan (during the 48 h window)
Point the DNS records back at `dynopay-bcibf.ondigitalocean.app` (CNAMEs) and the two Cloudflare A/AAAA sets listed in §1,
re-enable `ENABLE_BACKGROUND_JOBS=true` on the App Platform spec, disable jobs on the droplet. Binance whitelist can keep
the droplet IP (harmless).

## 6. Cost summary
| | Monthly |
|---|---|
| Droplet `s-2vcpu-4gb` ams3 | $24 |
| Reserved IP (assigned) | $0 |
| Cloud Firewall, Monitoring, DO DNS | $0 |
| GHCR private image (≤500 MB free) or DOCR Basic | $0 / $5 |
| Droplet backups (optional) | +$4.80 |
| **Total** | **$24–34** (vs $25 today; vs $50 for Option A) |

## 7. Useful API calls (Bearer token)
```
GET  https://api.digitalocean.com/v2/apps/f86b27dc-feb0-4a44-a4e9-ebd2053e0468          # spec/envs
GET  https://api.digitalocean.com/v2/domains/dynopay.com/records?per_page=100            # DNS
POST https://api.digitalocean.com/v2/droplets | /v2/reserved_ips | /v2/firewalls | /v2/account/keys
GET  https://api.digitalocean.com/v2/sizes?per_page=200  (ams3: s-2vcpu-2gb $18, s-2vcpu-4gb $24, s-2vcpu-8gb-amd $42)
```
Prod diagnostics (super-admin JWT from `POST https://dynopay.com/api/admin/login`):
`/api/diagnostics/binance-ping`, `/binance-account`, `/binance-info`, `/tunnel-status`.
