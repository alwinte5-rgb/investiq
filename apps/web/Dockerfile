# InvestIQ web (Next.js). Build context = repo ROOT.
# In Railway: set this service's "Dockerfile Path" to apps/web/Dockerfile.
FROM node:20-bookworm-slim

WORKDIR /app
COPY . .

# Deterministic install (postinstall in packages/db runs prisma generate).
RUN npm ci --no-audit --no-fund

# Next.js needs the Clerk publishable key (and API base URL) at BUILD time,
# because it statically prerenders pages wrapped in ClerkProvider. Railway
# passes service variables as build args when declared as ARG.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run -w @investiq/web build

EXPOSE 3000
CMD ["npm", "run", "-w", "@investiq/web", "start"]
