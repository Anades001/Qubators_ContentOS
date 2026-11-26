# syntax=docker/dockerfile:1
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && apt-get clean \
  && corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/
COPY packages/storage/package.json packages/storage/
RUN pnpm install --frozen-lockfile --filter @contentos/api... --filter @contentos/db

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @contentos/api build

# One-shot: apply migrations (and seed on first boot when SEED_ON_START=true).
FROM deps AS migrate
COPY packages/db packages/db
CMD ["sh", "-c", "pnpm --filter @contentos/db migrate:deploy && if [ \"$SEED_ON_START\" = \"true\" ]; then pnpm --filter @contentos/db seed; fi"]

FROM build AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
