# Pod setup — ONE command (read this first on a new pod)

`/app` is restored **from git only** on every new pod. Everything gitignored is gone:
`.env.local`, `backend/.env`, `backend/dynopay.json`, `node_modules` (948MB + 542MB), `.next-dev`.
That is what used to cause the multi-minute manual setup every session.

**⚠️ NEVER create `/app/.env` or `/app/.next` (root level).** Emergent's commit tool stages with
`git add -A ':(exclude).env' ':(exclude).next/*' …` and git 2.39 exits 1 ("paths are ignored:
.env .next") when an IGNORED entry literally named `.env`/`.next` exists at the repo root →
every checkpoint and Save-to-GitHub commit aborts before `git commit` (proven in
/var/log/e1_agent.log, 2026-09-16). The frontend env is `/app/.env.local` (Next.js loads it
natively); dev builds go to `/app/.next-dev` via `NEXT_DIST_DIR` (set by scripts/start-frontend.sh,
which also self-heals a stray `.env`/`.next`). Nested files (`backend/.env`) are unaffected.

## The whole setup, one line

```bash
bash /app/scripts/pod-bootstrap.sh --pass '<vault passphrase from the user>'
```

It does, in order, and prints a pass/fail report:
1. detects this pod's preview URL from `/etc/supervisor/conf.d/*.conf` (`APP_URL=`)
2. restores `/app/.env.local` + `/app/backend/.env` (+ `dynopay.json` if sealed) from `env.vault.enc`
   (legacy vaults containing `app/.env` are renamed to `.env.local` on extraction)
3. rewrites every URL key to THIS pod (`NEXTAUTH_URL`, `NEXT_PUBLIC_SERVER_URL`,
   `NEXT_PUBLIC_CREATOR_BASE_URL`, `SERVER_URL`, `FRONTEND_URL`, `CHECKOUT_URL`,
   `NEXT_PUBLIC_BASE_URL`, and appends the preview host to `CORS_ALLOWED_ORIGINS`)
4. forces `FRONTEND_MODE=dev`, `INTERNAL_API_URL=http://localhost:8001`,
   and **SAFE MODE** (`ENABLE_BACKGROUND_JOBS=false`, `WORKER_ROLE=secondary`)
5. installs deps root → backend (serialised via `flock`, skipped if present)
6. restarts backend + frontend, waits for `/health` (db+redis) and `:3000` 200

## No passphrase from the user?

Deps and services now self-heal on their own — `scripts/start-frontend.sh` and
`backend/server.py` run `yarn install` themselves when `node_modules` is missing
instead of crash-looping. So the pod boots itself; you only need the passphrase
to restore credentials. Ask the user for it (they saved it), or fall back to the
old way: have them paste creds, write both `.env` files, then re-seal:

```bash
bash /app/scripts/env-vault.sh seal '<passphrase>'   # commits as env.vault.enc
bash /app/scripts/env-vault.sh list '<passphrase>'   # inspect without writing
```

## Save to GitHub / git hooks (read before touching `.husky/pre-commit`)
- Save to GitHub runs `git commit` in the pod → Husky pre-commit runs. It MUST stay
  fast (<2s) and fail-safe: only the secrets guard blocks (exit 2 from
  `scripts/check-secrets.mjs`); everything else is warn-only with a hard `timeout`.
- NEVER put `tsc` or `yarn install` back in the hook (13s + 41s, minutes on a cold
  pod → the platform commit silently never happens). Type-checking = CI
  (`.github/workflows/preflight.yml`) or `yarn preflight`.
- Pushes that change `.github/workflows/*.yml` need the GitHub token to have the
  `workflow` scope; if such a push is rejected, push via a PAT or reconnect GitHub.
- Preview hostnames in tracked docs/tests/reports use the placeholder
  `preview-host.invalid` so forks don't rewrite ~300 files on every new pod.

## Vault facts
- `env.vault.enc` is tracked in git = it survives forks. AES-256-CBC, PBKDF2 300k
  iterations, random salt. Ciphertext is base64 → the pre-commit secrets guard
  cannot false-positive on it.
- Lose the passphrase → the vault is unrecoverable (re-seal from a fresh paste).
- Re-seal after ANY credential change so the next pod gets the new values.

## Speed notes
- Frontend prewarms `/`, `/auth/login`, `/dashboard`, `/pay` in the background right
  after `next dev` is ready, so the first human click isn't a 15-35s compile.
- First install on a cold pod is ~1-2 min (root) + ~40s (backend). The yarn cache
  lives outside `/app` and is always empty on a new pod — nothing to reuse.
- Never run the two yarn installs in parallel (shared cache corruption). All
  install paths now take `/tmp/dynopay-yarn-install.lock`.
