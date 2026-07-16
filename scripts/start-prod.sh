#!/bin/sh
set -e

echo "======================================"
echo " Aswaq API – Production Boot Sequence"
echo "======================================"
echo "[Boot] NODE_ENV=${NODE_ENV}"
echo "[Boot] DATABASE_URL is ${DATABASE_URL:+set}"
echo "[Boot] DIRECT_URL  is ${DIRECT_URL:+set}"

# ── 1. Run Prisma migrations (non-fatal: app can still start with existing schema) ──
echo "[Boot] Running Prisma database migrations..."
if ./node_modules/.bin/prisma migrate deploy 2>&1; then
  echo "[Boot] ✅ Prisma migrations completed successfully."
else
  echo "[Boot] ⚠️  Prisma migrate deploy failed or had warnings. The server will still start."
  echo "[Boot]     If tables are missing, this is a real problem. Check the output above."
fi

# ── 2. Start the Node.js server ──
echo "[Boot] Starting Node.js application server..."
exec node --import tsx server/main.ts
