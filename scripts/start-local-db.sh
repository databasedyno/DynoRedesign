#!/bin/bash
# Runs the local isolated PostgreSQL (preview pod only) in the foreground so
# supervisor can own/restart it. Redis is started daemonized (stable enough).
set -e

# Ensure redis is up (idempotent)
redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1 || \
  redis-server --daemonize yes --bind 127.0.0.1 --port 6379

# If a pg_ctlcluster-managed instance is already online, stop it so this
# foreground process becomes the single owner (avoids lock/port conflicts).
if pg_lsclusters -h 2>/dev/null | grep -q "online"; then
  pg_ctlcluster 15 main stop >/dev/null 2>&1 || true
  sleep 2
fi

exec setpriv --reuid=postgres --regid=postgres --init-groups \
  /usr/lib/postgresql/15/bin/postgres \
  -D /var/lib/postgresql/15/main \
  -c config_file=/etc/postgresql/15/main/postgresql.conf
