# ops/ — one-off test & operations scripts (NOT part of the app build)

Moved here from the repo root during Phase 1 repo hygiene (2026-06).
Nothing in `pages/`, `Components/`, or the Next build imports anything in this folder.

- Root-level backend test scripts (`*_test.py`, `backend_test*.js/ts`, `test_*.js/ts/py`) —
  historical testing-agent and session scripts, kept for reference.
- `archive/i18n-scripts/` — one-off i18n key patch scripts. The ONLY supported i18n key
  mechanism is now `scripts/check-i18n.mjs`; do not resurrect these.
- Some scripts required `pg` / `ioredis` / `jsonwebtoken` from the FRONTEND package —
  those deps were pruned from the frontend (Phase 1, FP1-2). If you need to run one,
  point requires at `backend/node_modules/*` (backend still ships them) or install ad hoc.
