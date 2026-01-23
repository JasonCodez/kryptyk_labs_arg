# Multi-stage Dockerfile for production Next.js app with Prisma (MySQL)

# 1) Install deps & build
FROM node:18-alpine AS builder
WORKDIR /app

# Install OS deps required by some packages (eg. sharp, prisma) and cleanup
RUN apk add --no-cache libc6-compat bash

# Copy package files and install
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Generate Prisma client and build Next app
RUN npx prisma generate
RUN npm run build

# 2) Production image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install runtime deps
RUN apk add --no-cache libc6-compat

# Copy built app files and node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Optional startup script (runs migrations/seeds when enabled)
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 3000

# Use the start script which may optionally run migrations/seeds
CMD ["/usr/local/bin/start.sh"]
