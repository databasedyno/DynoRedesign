# Deploying DynoPay to DigitalOcean App Platform (`onboarding` branch)

This guide deploys the app as a **single container** built from the repo-root
`Dockerfile`. That image runs nginx (public port) which reverse-proxies:

| Path | Goes to |
|------|---------|
| `/api/auth/*` | Next.js (NextAuth) on :3000 |
| `/api/*` | Express backend on :3300 |
| `/health`, `/images/*`, `/videos/*`, `/api/docs` | Express backend |
| everything else | Next.js frontend on :3000 |

So you get one DO app, one domain, no extra routing config.

> ⚠️ **Before anything else — rotate every secret you pasted in chat.** Treat the
> DigitalOcean token, DB password, Redis URL, Binance keys, Google private key,
> Flutterwave keys, `CYPHER_KEY`, `ACCESS_TOKEN_SECRET`, SSH password, Telegram/Telnyx
> tokens, etc. as compromised. Generate fresh values and use those below.

---

## 1. Prerequisites
- The `onboarding` branch is pushed to your GitHub repo ✅ (you confirmed this).
- A DigitalOcean account with **billing enabled**.
- (Optional, for CLI deploys) [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/) authenticated: `doctl auth init`.

---

## 2. Create the app

### Option A — DigitalOcean UI (recommended, easiest)
1. **Apps → Create App → GitHub** → authorize → pick your repo.
2. **Branch:** select `onboarding`. **Autodeploy:** on.
3. DO auto-detects the root `Dockerfile`. Confirm the component is a **Web Service**, **HTTP port = `8001`**.
4. **Resources:** choose **≥ 1 GB RAM** (e.g. `apps-s-1vcpu-1gb`). The build compiles both Next.js and the TypeScript backend, so smaller instances can OOM during build — bump to 2 GB if the build fails.
5. **Health check:** HTTP path `/health`, initial delay `90s`.
6. **Environment variables:** add all the keys from [`.do/app.yaml`](./.do/app.yaml) (see §3). Mark secrets as **Encrypted**.
7. **Create Resources** → wait for build + deploy.

### Option B — CLI from the spec
1. Edit `.do/app.yaml`: set `services[0].github.repo` to `your-org/your-repo` and `region` to your choice.
2. `doctl apps create --spec .do/app.yaml`
3. Open the app in the dashboard and fill in every `REPLACE_ME` env value (so real secrets never live in git).

---

## 3. Environment variables

The full, categorized list with correct **scope** and **secret/non-secret** flags is in
[`.do/app.yaml`](./.do/app.yaml). Key points:

### 3a. BUILD-TIME vars (must be set *before* the build)
Next.js inlines these into the client bundle at build time:

| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_BASE_URL` | Your DO app URL, e.g. `https://dynopay-xxxxx.ondigitalocean.app/` (or custom domain). |
| `NEXT_PUBLIC_SERVER_URL` | Same app URL. ⚠️ see note below. |
| `NEXT_PUBLIC_API_DOCS_URL` | `<app-url>/api/docs`. ⚠️ see note below. |
| `NEXT_PUBLIC_CYPHER_KEY` | secret |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` | Google OAuth (frontend) |
| `NEXTAUTH_URL` | Your app URL |
| `NEXTAUTH_SECRET` | secret — generate with `openssl rand -base64 32` |

> ⚠️ **Dockerfile gap:** the root `Dockerfile` declares build `ARG`s only for
> `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CYPHER_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
> `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.
> If your frontend actually reads `NEXT_PUBLIC_SERVER_URL` / `NEXT_PUBLIC_API_DOCS_URL`
> in the browser, add matching `ARG`/`ENV` lines for them in `Dockerfile` (frontend
> build stage) or they won't be inlined. (Tell me and I'll patch the Dockerfile.)

### 3b. RUN-TIME vars
Everything else (DB, Redis, blockchain/Tatum, Binance, Flutterwave, email/SMS, KMS,
wallet addresses, sweep/fee config). Mark all credentials as **Encrypted/SECRET**.

### 3c. App-URL vars to point at DO
Set these to your DO app domain (or custom domain) — not the old Railway/Emergent URLs:
`SERVER_URL`, `FRONTEND_URL`, `CHECKOUT_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXTAUTH_URL`.
(You can deploy once to learn the `*.ondigitalocean.app` URL, set these, then redeploy —
or attach your custom domain first under **Settings → Domains** and use that.)

---

## 4. Database & Redis
- Point `HOST` / `DB_PORT` / `DB_NAME` / `USER_NAME` / `PASSWORD` at your Postgres
  (keep your managed DB, or migrate to a DO Managed Postgres cluster).
- `DB_SSL_REJECT_UNAUTHORIZED=false` is already set for proxied/managed DBs with
  self-signed chains.
- `REDIS_PUBLIC_URL` must include credentials (`redis://default:PASS@host:port`).
- If you use DO Managed Databases, add the app as a **Trusted Source** so it can connect.

---

## 5. Outbound SSH tunnel / Binance proxy
The backend dials a SOCKS5 proxy at `127.0.0.1:1080` (`BINANCE_PROXY_URL`) via an SSH
tunnel (`SSH_TUNNEL_*`). The container must be able to reach `SSH_TUNNEL_HOST:22`
outbound. App Platform allows outbound traffic by default, so this should work — verify
in logs after first boot that the tunnel connects and Binance calls succeed.

---

## 6. Post-deploy checklist
- [ ] App is **Healthy** (DO health check on `/health` passes).
- [ ] Visit the app URL → landing page loads; `/api/docs` reachable.
- [ ] `GET <app-url>/health` → 200.
- [ ] Backend logs show `PostgreSQL Connection has been established` and table sync lines.
- [ ] Rotate/confirm all secrets are the **new** rotated values (not the leaked ones).
- [ ] Attach custom domain (**Settings → Domains**) and update the URL env vars + redeploy.
- [ ] Re-point any webhooks (Tatum `TATUM_WEBHOOK_SECRET` endpoint, Flutterwave, merchant
      webhooks) to the new DO domain.

---

## 7. Troubleshooting
- **Build OOM / killed:** increase instance size to 2 GB+ for the build.
- **Frontend shows old/wrong API URL:** a `NEXT_PUBLIC_*` was missing at *build* time —
  set it as BUILD_TIME and trigger a fresh build (Deploy → "Force Rebuild and Deploy").
- **502 right after deploy:** `start-period` not elapsed yet (backend boot + DB sync takes
  ~30–90s). The health check `initial_delay_seconds: 90` covers this.
- **`relation ... does not exist`:** first boot runs Sequelize `sync`; ensure the DB user
  has create-table privileges.
- **Port mismatch:** keep `http_port: 8001` and `PORT=8001` in sync (nginx listens on `$PORT`).

---

*Note:* Emergent does not deploy to DigitalOcean directly — this is a self-serve DO
deployment. The `.do/app.yaml` + this guide are the artifacts to drive it.
