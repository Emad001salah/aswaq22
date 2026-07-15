# ─────────────────────────────────────────────────────────
# Stage 1: Builder
# Installs ALL deps, compiles TypeScript, runs Prisma generate
# ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install system deps for native bindings (sharp, bcrypt)
RUN apt-get update && apt-get install -y python3 make g++ libvips-dev && rm -rf /var/lib/apt/lists/*

# Copy manifests first (layer-cache optimization)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --legacy-peer-deps

# Generate Prisma client BEFORE copying src (cache invalidation control)
RUN npx prisma generate

# Copy source
COPY . .

# Build frontend bundle
RUN npm run build

# ─────────────────────────────────────────────────────────
# Stage 2: Production Runtime
# Only production deps + built artifacts – no dev bloat
# ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# System deps required at runtime
RUN apt-get update && apt-get install -y libvips wget && rm -rf /var/lib/apt/lists/*

# Copy only production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/server       ./server
COPY --from=builder /app/src          ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts/start-prod.sh /app/scripts/start-prod.sh

# Create non-root user for security
RUN chmod +x /app/scripts/start-prod.sh
RUN groupadd -r aswaq && useradd -r -g aswaq aswaq
RUN mkdir -p uploads logs && chown -R aswaq:aswaq uploads logs
USER aswaq

EXPOSE 3000

# Health check for Docker / Kubernetes
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["./scripts/start-prod.sh"]

