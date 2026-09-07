# ── deps stage: install production dependencies ────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
# devDeps (vitest, autocannon) are skipped; optionalDeps are NOT — they are the
# local moderation stack (tfjs, nsfwjs, sharp). tfjs-node has no musl build and
# fails here, which npm tolerates for optionals by design; the runtime then
# falls back to pure tfjs + sharp (services/localModeration.js), which is what
# actually runs on this image.
RUN npm ci --omit=dev --legacy-peer-deps
# tfjs-node ships a glibc libtensorflow (~250 MB) that cannot load on musl —
# on this image it only bloats the layers and costs a doomed import attempt at
# runtime before the tfjs+sharp fallback kicks in. The moderation deps that
# actually run here (tfjs, nsfwjs, sharp) are regular dependencies: as
# optionals, npm silently SKIPPED nsfwjs because its engines field pins an
# exact node version — that is how the stack went missing from production.
RUN rm -rf node_modules/@tensorflow/tfjs-node

# ── runtime stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# dumb-init: proper PID-1 signal handling (graceful shutdown)
RUN apk add --no-cache dumb-init

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Bake the NSFW model into the image: the worker must not depend on GitHub
# being reachable at runtime, and a missing model would burn through the
# moderation retry budget before anyone noticed.
RUN node scripts/download_nsfw_model.js

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
