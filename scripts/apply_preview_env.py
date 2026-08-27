#!/usr/bin/env python3
"""Rewrite DynoPay .env files for THIS preview pod + enforce SAFE MODE.

Mirrors scripts/pod-bootstrap.sh step 3, but works on env files that were
written directly from a pasted credential blob (no vault).
"""
import sys

URL = sys.argv[1].rstrip('/')


def patch(path, set_keys, add_keys=None, cors_key=None, forced=None):
    add_keys = add_keys or {}
    forced = forced or {}
    lines = open(path).read().splitlines()
    out, seen, changed = [], set(), []
    for line in lines:
        if '=' in line and not line.lstrip().startswith('#'):
            key = line.split('=', 1)[0].strip()
            if key in set_keys or key in add_keys:
                new = f"{key}={URL}"
                if line != new:
                    changed.append(key)
                line = new
                seen.add(key)
            elif key in forced:
                new = f"{key}={forced[key]}"
                if line != new:
                    changed.append(key)
                line = new
                seen.add(key)
            elif cors_key and key == cors_key:
                val = line.split('=', 1)[1].strip()
                parts = [p.strip() for p in val.split(',')
                         if p.strip() and 'preview.emergent' not in p]
                parts.append(URL)
                new = f"{cors_key}=" + ','.join(parts)
                if line != new:
                    changed.append(key)
                line = new
                seen.add(key)
        out.append(line)
    # append any add_keys / forced keys that were missing
    for key in list(add_keys) + list(forced):
        if key not in seen:
            val = URL if key in add_keys else forced[key]
            out.append(f"{key}={val}")
            changed.append(key + ' (added)')
    open(path, 'w').write('\n'.join(out) + '\n')
    print(f"  {path}: {', '.join(changed) if changed else 'already correct'}")


# root /app/.env  (Next.js frontend)
patch('/app/.env',
      set_keys={'NEXTAUTH_URL', 'NEXT_PUBLIC_BASE_URL', 'SERVER_URL',
                'FRONTEND_URL', 'CHECKOUT_URL'},
      add_keys={'NEXT_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_CREATOR_BASE_URL'},
      cors_key='CORS_ALLOWED_ORIGINS',
      forced={'FRONTEND_MODE': 'dev', 'INTERNAL_API_URL': 'http://localhost:8001',
              'ENABLE_BACKGROUND_JOBS': 'false', 'WORKER_ROLE': 'secondary'})

# backend /app/backend/.env  (Node.js backend)
patch('/app/backend/.env',
      set_keys={'SERVER_URL', 'FRONTEND_URL', 'CHECKOUT_URL', 'NEXTAUTH_URL',
                'NEXT_PUBLIC_BASE_URL'},
      cors_key='CORS_ALLOWED_ORIGINS',
      forced={'ENABLE_BACKGROUND_JOBS': 'false', 'WORKER_ROLE': 'secondary'})
