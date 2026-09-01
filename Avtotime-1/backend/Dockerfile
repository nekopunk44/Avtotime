# ── deps stage: install production dependencies ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
# Skip devDeps (autocannon) and optionalDeps (TensorFlow/sharp/nsfwjs)
RUN npm ci --omit=dev --omit=optional --legacy-peer-deps

# ── runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# dumb-init: proper PID-1 signal handling (graceful shutdown)
RUN apk add --no-cache dumb-init

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Ensure uploads directory exists and is writable by the runtime user.
# (A named volume mounted at /app/public inherits this ownership on first init.)
RUN mkdir -p public && chown -R node:node public

# Drop root privileges
USER node

EXPOSE 8000

# Reports readiness to compose (`depends_on: condition: service_healthy`) and
# lets docker surface a wedged worker pool. Node 20 has a global fetch, so no
# curl/wget package is needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "cluster.js"]
