# Pod setup — ONE command (read this first on a new pod)

> ⚠️ **THIS REPO IS NOT EMPTY.** `/app` is a large, fully-built production app
> (**DynoPay** — Next.js frontend at repo root + Node/TS backend in `backend/`,
> 2,100+ tracked files). On a **fresh pod there is a brief restore window** where
> `/app` may contain only `.git` and file reads (e.g. `cat test_result.md`) come
> back empty while the git working-tree is still materialising. **DO NOT conclude
> the project is empty / new** — wait a few seconds and re-list `/app`, or wait for
> the `.emergent/markers/.restore-complete` marker, then re-read. The primary
> handoff is `.emergent/summary.txt`.
>
> KNOWN PLATFORM ISSUE (needs support/platform fix): `.emergent/markers/.restore-complete`
> is currently **git-tracked**, which can present a stale "restore already complete"
> signal and expose the empty-window race to a forked/continuation agent. The fix is
> to **untrack** that marker so it's generated at restore-time only — this is a git
> operation the in-pod agent is not permitted to perform; raise it with Emergent
> support (include the `job_id` from `.emergent/emergent.yml`).


`/app` is restored **from git only** on every new pod. Everything gitignored is gone:
`.env`, `backend/.env`, `backend/dynopay.json`, `node_modules` (948MB + 542MB), `.next`.
That is what used to cause the multi-minute manual setup every session.

## The whole setup, one line

```bash
bash /app/scripts/pod-bootstrap.sh --pass '<vault passphrase from the user>'
```

It does, in order, and prints a pass/fail report:
1. detects this pod's preview URL from `/etc/supervisor/conf.d/*.conf` (`APP_URL=`)
2. restores `/app/.env` + `/app/backend/.env` (+ `dynopay.json` if sealed) from `env.vault.enc`
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
