#!/bin/sh
set -e
npx prisma migrate deploy
exec node --import tsx server/main.ts
