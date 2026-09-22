# SVG Performance private preview.
# Laptop / simple VPS: SQLite (file:./dev.db) with a volume for prisma/*.db and uploads/.
# Hosted Postgres: pass DATABASE_URL=postgresql://… at runtime. The start command
# generates the Postgres Prisma client and runs db push.
# Do not put live Stripe keys in the image. Pass TEST keys at runtime if you need checkout.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# npm run build runs prisma-prepare (SQLite unless DATABASE_URL is postgresql://).
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/content ./content
EXPOSE 3000
CMD ["sh", "-c", "node scripts/prisma-prepare.mjs --deploy && npm start"]
