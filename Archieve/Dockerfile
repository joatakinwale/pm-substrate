# =============================================================================
# pm-substrate Dockerfile
#
# Multi-stage build: install all workspace deps + build TypeScript, then
# copy only the compiled output + runtime node_modules into the final image.
#
# The image exposes port 4000 and runs packages/substrate-http-demo/dist/server.js.
#
# Required env at runtime:
#   PM_DATABASE_URL   Postgres connection string
#   PORT              (optional, default 4000)
# =============================================================================

# ── Stage 1: builder ──────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Install workspace dependencies (leverage Docker cache layer).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json                 ./packages/types/
COPY packages/events/package.json                ./packages/events/
COPY packages/graph/package.json                 ./packages/graph/
COPY packages/profile-registry/package.json      ./packages/profile-registry/
COPY packages/projections/package.json           ./packages/projections/
COPY packages/registry/package.json              ./packages/registry/
COPY packages/workflow/package.json              ./packages/workflow/
COPY packages/substrate-http/package.json        ./packages/substrate-http/
COPY packages/substrate-http-demo/package.json   ./packages/substrate-http-demo/
COPY packages/capability-wedding-budget/package.json ./packages/capability-wedding-budget/
COPY packages/capability-wedding-contracts/package.json ./packages/capability-wedding-contracts/
COPY packages/capability-audit/package.json      ./packages/capability-audit/
COPY packages/profile-wedding/package.json       ./packages/profile-wedding/
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile

# Copy source and build.
COPY packages/ ./packages/
RUN pnpm build

# ── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# pnpm for production install
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Install runtime deps plus tsx for migration/seed entrypoints.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json                 ./packages/types/
COPY packages/events/package.json                ./packages/events/
COPY packages/graph/package.json                 ./packages/graph/
COPY packages/profile-registry/package.json      ./packages/profile-registry/
COPY packages/projections/package.json           ./packages/projections/
COPY packages/registry/package.json              ./packages/registry/
COPY packages/workflow/package.json              ./packages/workflow/
COPY packages/substrate-http/package.json        ./packages/substrate-http/
COPY packages/substrate-http-demo/package.json   ./packages/substrate-http-demo/
COPY packages/capability-wedding-budget/package.json ./packages/capability-wedding-budget/
COPY packages/capability-wedding-contracts/package.json ./packages/capability-wedding-contracts/
COPY packages/capability-audit/package.json      ./packages/capability-audit/
COPY packages/profile-wedding/package.json       ./packages/profile-wedding/
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile

# Copy compiled dist from builder.
COPY --from=builder /app/packages/types/dist             ./packages/types/dist
COPY --from=builder /app/packages/events/dist            ./packages/events/dist
COPY --from=builder /app/packages/graph/dist             ./packages/graph/dist
COPY --from=builder /app/packages/profile-registry/dist  ./packages/profile-registry/dist
COPY --from=builder /app/packages/projections/dist       ./packages/projections/dist
COPY --from=builder /app/packages/registry/dist          ./packages/registry/dist
COPY --from=builder /app/packages/workflow/dist          ./packages/workflow/dist
COPY --from=builder /app/packages/substrate-http/dist        ./packages/substrate-http/dist
COPY --from=builder /app/packages/substrate-http-demo/dist   ./packages/substrate-http-demo/dist
COPY --from=builder /app/packages/capability-wedding-budget/dist   ./packages/capability-wedding-budget/dist
COPY --from=builder /app/packages/capability-wedding-contracts/dist ./packages/capability-wedding-contracts/dist
COPY --from=builder /app/packages/capability-audit/dist  ./packages/capability-audit/dist
COPY --from=builder /app/packages/profile-wedding/dist   ./packages/profile-wedding/dist

# Migrations (needed by the migrate-substrate init container — same image, different CMD).
COPY db/ ./db/
COPY scripts/ ./scripts/

# Non-root user.
RUN adduser -D -u 10001 pmuser && chown -R pmuser:pmuser /app
USER pmuser

EXPOSE 4000

CMD ["node", "packages/substrate-http-demo/dist/server.js"]
