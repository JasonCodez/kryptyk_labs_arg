#!/bin/sh
set -e

# Optionally run migrations and seed. Controlled by env vars:
# RUN_MIGRATIONS=true
# RUN_SEED=true

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running Prisma migrations (deploy)..."
  npx prisma migrate deploy
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "Running seed script..."
  npm run seed
fi

# Start Next.js production server
exec node ./.next/start
