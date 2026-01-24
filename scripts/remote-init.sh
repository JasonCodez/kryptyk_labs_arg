#!/usr/bin/env bash
set -euo pipefail
# remote-init.sh
# Usage: run this from the repository root on the host that can reach the DB.
# Ensure `DATABASE_URL` is exported in the environment before running.
# Example:
#   export DATABASE_URL='mysql://dbu002169:password%21@db5019455640.hosting-data.io:3306/dbs15223426'
#   ./scripts/remote-init.sh

echo "== remote-init: starting =="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed or not on PATH. Aborting." >&2
  exit 1
fi

echo "Installing dependencies (npm ci)..."
npm ci

echo "Generating Prisma client..."
npx prisma generate

echo "Running Prisma migrate dev --name init (creates migration and applies it)..."
npx prisma migrate dev --name init

echo "Running seed script..."
npm run seed

echo "== remote-init: completed =="
