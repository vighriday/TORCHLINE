# Hosted practice demo: the production app image plus a private loopback PostgreSQL inside the
# same container. Simulation only; no Twitch credentials exist here. Used by render.yaml.
# Every container start creates a fresh practice database and fresh secrets.
FROM node:24.22.1-bookworm-slim AS base
WORKDIR /app
RUN npm install --global pnpm@12.4.2

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/twitch/package.json packages/twitch/package.json
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24.22.1-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates postgresql-common \
  && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
  && apt-get install -y --no-install-recommends postgresql-17 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 WORLD_MODE=simulation LIVEWIRE_ENABLED=true \
    TRUST_PROXY_HOPS=1 PATH=/usr/lib/postgresql/17/bin:$PATH
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=dependencies --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /app/apps/server/src ./apps/server/src
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /app/packages/contracts/src ./packages/contracts/src
COPY --from=build --chown=node:node /app/packages/engine/src ./packages/engine/src
COPY --from=build --chown=node:node /app/packages/storage/src ./packages/storage/src
COPY --from=build --chown=node:node /app/packages/storage/migrations ./packages/storage/migrations
COPY --from=build --chown=node:node /app/packages/twitch/src ./packages/twitch/src
COPY --chown=node:node scripts/migrate.ts ./scripts/migrate.ts
COPY --chown=node:node deploy/demo/start.sh ./start.sh
# Run as the image's unprivileged node user; PostgreSQL refuses to run as root anyway.
USER node
EXPOSE 3000
CMD ["sh", "start.sh"]
