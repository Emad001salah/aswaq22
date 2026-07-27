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

# Copy all built assets and app code from builder in a single layer
COPY --from=builder /app /app

# Create non-root user for security
RUN chmod +x /app/scripts/start-prod.sh /app/scripts/start-worker.sh 2>/dev/null || true
RUN groupadd -r aswaq 2>/dev/null || true; useradd -r -g aswaq aswaq 2>/dev/null || true
RUN mkdir -p /app/uploads /app/logs && chown -R aswaq:aswaq /app
USER aswaq

EXPOSE 3000

# Health check for Docker / Kubernetes
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["./scripts/start-prod.sh"]

