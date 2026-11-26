# syntax=docker/dockerfile:1
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @contentos/web
COPY apps/web apps/web
# Rewrites are resolved at build time; point them at the api service.
ENV API_INTERNAL_URL=http://api:4000
RUN pnpm --filter @contentos/web build

FROM node:22-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
