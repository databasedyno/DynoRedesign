# Lessons / footguns (pod-specific)

## 2026-06 — Backend is ts-node WITHOUT a file watcher
- Backend TS edits are NOT live until `sudo supervisorctl restart backend`. After a fork, the running
  process may still be the PREVIOUS session's code even though the files changed.
- INCIDENT: probing "gated" routes against the stale process (old code had no step-up gate) hit the
  real controllers and wrote to the PROD DB: a team invite for x@y.z (tbl_team_member id 34) + 2
  tbl_team_activity rows. Cleaned up by id-guarded DELETE in a transaction (0 leftovers).
- RULE: restart backend FIRST, confirm the new behaviour on a read-only call, and make every probe of a
  mutating endpoint self-defusing (bogus ids / states the controller rejects before any write).
  See backend/scripts/stepup_gate_smoke.sh step 11 for the pattern.

## 2026-09-14 — Mandatory 2FA / trusted devices
- The app wraps everything in `<SWRConfig provider={localStorageProvider}>`. The GLOBAL `mutate(key)` from "swr" targets the default cache and silently does nothing here — always use the bound `mutate` returned by `useSWR` (or `useSWRConfig().mutate`).
- `userReducer.name` is only set on login/register events, NOT rehydrated on a hard refresh → don't use it as "is logged in". Decode the token via `useTokenData()` instead.
- New public auth endpoints must be added to the CSRF exemption list in `backend/middleware/csrfMiddleware.ts` or they fail with "CSRF token validation failed".
- `otpRateLimiter`/`strictRateLimiter` bite during repeated QA loops (3-min lockouts) — pace browser runs.
- FirstRunRedirect (once per session) can yank a fresh new-merchant login to /get-started mid-test; set `sessionStorage.gs_autoopen_seen=1` before login when testing dashboard dialogs.
