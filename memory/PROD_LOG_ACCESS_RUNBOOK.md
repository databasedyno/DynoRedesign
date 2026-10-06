# DynoPay / SafeDeal — Production Log Access & Diagnostics Runbook

Last updated: 2026-10-06. Read-only diagnostics first. Any production **write**
(Caddyfile edit, env change, container recreate) requires explicit user approval
and the backup/validate/graceful-reload discipline at the end of this doc.

> SECURITY INVARIANT — never commit, echo into chat, paste into any repo file,
> `.env`, test report, or summary: the SSH private key, env secrets, vault
> passphrase, or any credential value. This runbook only names *paths* and
> *commands*, never secret contents.

---

## 1. Production host & SSH access

| What | Value |
|---|---|
| Droplet public IPv4 | `134.209.94.115` |
| Droplet hostname | `dynopay-prod-ams3` (does NOT resolve via DNS from the pod — use the IP) |
| SSH user | `root` |
| SSH private key (secure pod only) | `/root/.ssh/dynopay_prod_ed25519` |
| App / deploy root | `/opt/dynopay` |
| Live container | `dynopay` (Docker), published on `127.0.0.1:8001` |
| Edge | Caddy (systemd service, v2.11.x) → container nginx `:8001` → node backend `:3300` / frontend `:3000` |

Connect (read-only intent):

```bash
ssh -i /root/.ssh/dynopay_prod_ed25519 -o StrictHostKeyChecking=accept-new root@134.209.94.115
```

Dead-ends (do NOT retry):
- `ssh ... dynopay-prod-ams3` → `Could not resolve hostname`. Use the IP.
- `deploy@129.212.213.147` with this key → `Permission denied (publickey)`.

---

## 2. Where the logs live

| Source | Command |
|---|---|
| App logs (backend) on disk | `ls -lah /opt/dynopay/logs/` then `tail -n 200 /opt/dynopay/logs/<file>` |
| Live container stdout/stderr | `docker logs dynopay --tail 300` (add `-f` to follow, `--since 1h`) |
| Container nginx access/error | `docker exec dynopay sh -c 'tail -n 200 /var/log/nginx/error.log'` |
| Caddy edge (TLS/proxy) | `journalctl -u caddy --no-pager -n 300` (add `--since "1 hour ago"`) |
| Container health / image / restarts | `docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'` and `docker inspect -f '{{.State.Health.Status}} restarts={{.RestartCount}}' dynopay` |
| Caddy effective config (admin API) | `curl -s localhost:2019/config/ | python3 -m json.tool | less` |

---

## 3. Useful read-only greps

```bash
# Caddy 502s in the last window (edge sees upstream failures here)
journalctl -u caddy --since "6 hours ago" | grep -c '"status":502'

# Separate REAL routes from scanner noise (see §5). Show non-scanner 502 paths:
journalctl -u caddy --since "6 hours ago" \
  | grep '"status":502' \
  | grep -vE '\.env|@fs|\.php|wp-|/\.git|middleware' \
  | grep -oE '"uri":"[^"]+"' | sort | uniq -c | sort -rn | head

# Per-IP request volume (spot a runaway client/tab — the SafeDeal fetch-loop symptom)
journalctl -u caddy --since "1 hour ago" \
  | grep -oE '"remote_ip":"[0-9.]+"' | sort | uniq -c | sort -rn | head

# SafeDeal API traffic
docker logs dynopay --since 1h 2>&1 | grep -E '/api/safedeal/(wallet|statement|deals)'
```

---

## 4. Backend API log status-icon legend

The backend request logger prefixes lines with a status icon:

| Icon | Meaning |
|---|---|
| ✅ | 2xx success |
| ⚠️ | 4xx client error (bad input, auth, not-found) |
| ❌ | 5xx server error |
| ⏭️ / 🔧 | maintenance / operational skip / special handling |

⚠️ and 🔧 are **not** inherently defects — 4xx is often expected (e.g. `401` on a
SafeDeal call without a token). Review context (path, frequency, one IP vs many)
before treating an icon as an incident.

---

## 5. Scanner-traffic caveat (do NOT mis-count 502s)

A large share of Caddy-visible 502/EOF entries are deliberate drops of hostile
probe traffic (`.env`, `@fs`, PHP, `wp-`, Next middleware-bypass, `/.git`).
Container nginx answers these with `return 444` (connection closed, zero bytes),
and Caddy records the upstream EOF as a 502. **These are not customer-facing
incidents.** Always filter scanner paths (see the grep in §3) and focus on real
routes such as `/api/safedeal/*`, `/dashboard`, `/pay/*`, `/health`.

---

## 6. Known reliability fixes already in production / in the image

- **nginx idle-socket 502** — `nginx.conf` `keepalive_timeout 620s` (outlives
  Caddy's upstream reuse window). Confirmed in the running container.
- **Caddy upstream keepalive 30s + short retry** — in `/etc/caddy/Caddyfile`.
- **Zero-downtime deploy HA (2026-10-06)** — Caddy load-balances `127.0.0.1:8001`
  + `127.0.0.1:8002` with `lb_policy first`, active `/health` checks,
  `lb_try_duration 5s`, `dial_timeout 2s`. The deploy canary now stays up on
  `:8002` (uploads mounted) while `:8001` is recreated, so the edge fails over
  instead of returning 502 during the swap. See `.github/workflows/deploy-droplet.yml`.
- **SafeDeal dashboard fetch loop (2026-10-06)** — `hooks/useToast.ts` now returns
  memoized `showToast`/`hideToast`, breaking the `notify → load → effect`
  re-render loop in `Components/SafeDeal/Home/SafeDealHome.tsx` (was ~75 req/s
  from a single tab). Ships via Save to GitHub → deploy.

---

## 7. Production WRITE safety (Caddyfile et al.) — approval required

Any config write on the droplet must follow this exact order:

```bash
# 1. BACK UP (timestamped) before touching anything
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%s)

# 2. VALIDATE the candidate BEFORE installing it
caddy validate --config /tmp/Caddyfile.new --adapter caddyfile

# 3. Install + re-validate, then GRACEFUL reload (keeps live connections)
cp /tmp/Caddyfile.new /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy           # NEVER `restart` for a config change

# 4. VERIFY after reload
systemctl is-active caddy
for h in dynopay.com safedeal.sh; do curl -s -o /dev/null -w "$h %{http_code}\n" https://$h/health; done

# 5. On any failure: restore the newest backup and reload
cp "$(ls -t /etc/caddy/Caddyfile.bak.* | head -1)" /etc/caddy/Caddyfile && systemctl reload caddy
```

Rules:
- Never `rm -rf`, never edit `/opt/dynopay/.env` values, never recreate the
  container, and never clear/alter production data without explicit user approval.
- Prefer reads. If a write is approved, keep the backup path in the summary so the
  user can revert.
