# syntax=docker/dockerfile:1

# ── Full dependency set (incl. dev) - used only to build and to migrate ──────────
FROM node:26-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# ── Production-only dependencies - what the serving image actually needs ─────────
FROM node:26-bookworm-slim AS prod-deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Build the Next.js app ────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
# The committed schema targets Postgres, so `prisma generate` emits a Postgres
# client. Next 16 instantiates the Prisma client while collecting page data, and
# the adapter is chosen from the URL scheme - so this MUST be a postgres:// URL or
# the libsql adapter loads against a postgres client and the build fails. No DB
# connection is made at build time (the pg pool is lazy); the value is a dummy.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Raise V8 heap cap so `next build` fits on small instances (t3.micro + swap);
# V8's heap limit is independent of OS memory/swap, so it must be lifted explicitly.
ENV NODE_OPTIONS=--max-old-space-size=3072
COPY prisma ./prisma
COPY prisma.config.ts next.config.ts postcss.config.mjs eslint.config.mjs tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run prisma:generate
# SESSION_SECRET is required for the app module to load while `next build` collects
# page data, but no session is ever issued at build time. Pass it inline to this one
# RUN so it is not baked into an image layer (and does not trip the ENV-secret lint).
RUN SESSION_SECRET=build-time-placeholder-not-used-at-runtime npm run build

# ── Migrator - one-shot image that applies migrations, then exits ────────────────
# Keeps the full toolchain (Prisma CLI + TS config loader) so `migrate deploy`
# works exactly as it does today. Run this ONCE per deploy (CI step / ECS task /
# compose one-shot) - never per serving replica, to avoid concurrent migrations.
FROM node:26-bookworm-slim AS migrator
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts package.json package-lock.json ./
CMD ["npm", "run", "db:migrate:deploy"]

# ── Runner - slim serving image (production deps only, never migrates) ────────────
FROM node:26-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app /data \
  && chown -R nextjs:nodejs /app /data

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000

# Serve only - never migrate. The slim image intentionally omits the dev
# toolchain, so migrations run from the `migrator` image as a one-shot per
# deploy (CI step / ECS task / compose one-shot). This removes the multi-replica
# `migrate deploy` race entirely.
CMD ["npm", "run", "start"]
