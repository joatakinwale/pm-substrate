# ═══════════════════════════════════════════
# Stevie Social — Next.js Frontend Dockerfile
# Multi-stage: dev (docker compose) + prod (DigitalOcean)
# ═══════════════════════════════════════════

# ── Base ──────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# ── Dependencies ──────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Dev target (used by docker-compose) ───
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
# Source is mounted via docker-compose volume, no COPY needed
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Production build ──────────────────────
FROM base AS builder

# Build args for env vars needed at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_ORG_SLUG=stevie-social
ARG NEXT_PUBLIC_SITE_URL=https://stevie.social
ARG NEXT_PUBLIC_AURINKO_CLIENT_ID
ARG NEXT_PUBLIC_SSE_PUBSUB_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_ORG_SLUG=$NEXT_PUBLIC_ORG_SLUG
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_AURINKO_CLIENT_ID=$NEXT_PUBLIC_AURINKO_CLIENT_ID
ENV NEXT_PUBLIC_SSE_PUBSUB_URL=$NEXT_PUBLIC_SSE_PUBSUB_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Increase Node memory for large builds
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ── Production runner ─────────────────────
FROM base AS prod
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
