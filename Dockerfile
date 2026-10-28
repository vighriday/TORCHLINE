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
ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/vighriday/TORCHLINE" \
      org.opencontainers.image.revision=$SOURCE_REVISION
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
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
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/src/main.ts"]
