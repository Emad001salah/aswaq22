#!/bin/sh
set -e

echo "=========================================="
echo " Aswaq Image Worker – Production Boot"
echo "=========================================="
echo "[Boot] NODE_ENV=${NODE_ENV}"
echo "[Boot] REDIS_URL is ${REDIS_URL:+set}"
echo "[Boot] STORAGE_PROVIDER=${STORAGE_PROVIDER}"

exec node --import tsx/esm server/workers/image-resize.worker.ts
