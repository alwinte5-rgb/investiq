# InvestIQ API (Fastify + Prisma). Build context = repo ROOT.
# In Railway: set this service's "Dockerfile Path" to apps/api/Dockerfile
# and leave the Root Directory as the repo root.
FROM node:20-bookworm-slim

# Prisma needs openssl at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole monorepo.
COPY . .

# Deterministic install. The packages/db postinstall runs `prisma generate`.
RUN npm ci --no-audit --no-fund

# NODE_ENV is provided by Railway at runtime (keeps devDeps installed at build).
EXPOSE 4000

# Apply pending migrations on release, then start (tsx runs TypeScript directly).
CMD ["sh", "-c", "npm run -w @investiq/db migrate:deploy && npm run -w @investiq/api start"]
