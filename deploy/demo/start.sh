#!/bin/sh
# Starts a loopback-only PostgreSQL and the practice server. Data lives under /tmp and is discarded on
# every restart, so the demo never accumulates visitors' worlds.
set -eu
PGDATA=/tmp/pgdata
rm -rf "$PGDATA"
initdb -D "$PGDATA" -U torchline --auth=trust --encoding=UTF8 >/dev/null
pg_ctl -D "$PGDATA" -l /tmp/postgres.log -w start \
  -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp -c fsync=off -c shared_buffers=32MB -c max_connections=30"
createdb -h 127.0.0.1 -U torchline torchline

secret() { node -p "require('node:crypto').randomBytes(32).toString('hex')"; }
export DATABASE_URL=postgresql://torchline@127.0.0.1:5432/torchline
# The host terminates HTTPS in front of the container. Render names the public origin in
# RENDER_EXTERNAL_URL; any other host must set PUBLIC_BASE_URL explicitly.
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-${RENDER_EXTERNAL_URL:?set PUBLIC_BASE_URL to the public HTTPS origin}}"
export PUBLIC_BASE_URL
SESSION_SECRET=$(secret)
TOKEN_ENCRYPTION_KEY=$(secret)
BOT_SETUP_SECRET=$(secret)
export SESSION_SECRET TOKEN_ENCRYPTION_KEY BOT_SETUP_SECRET

node scripts/migrate.ts
exec node apps/server/src/main.ts
