# ── deps stage: install production dependencies ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
# Skip devDeps (autocannon) and optionalDeps (TensorFlow/sharp/nsfwjs)
RUN npm ci --omit=dev --omit=optional

# ── runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# dumb-init: proper PID-1 signal handling (graceful shutdown)
RUN apk add --no-cache dumb-init

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Ensure uploads directory exists
RUN mkdir -p public

# Drop root privileges
USER node

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "cluster.js"]
