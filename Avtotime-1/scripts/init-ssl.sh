#!/bin/bash
# First-time SSL certificate setup via Let's Encrypt (Certbot webroot).
#
# Usage:
#   bash scripts/init-ssl.sh yourdomain.com admin@yourdomain.com
#
# Run this ONCE on a fresh server before `docker compose up -d`.
# After that, Certbot auto-renews every 12 h inside its container.

set -e

DOMAIN=${1:?Usage: $0 <domain> <email>}
EMAIL=${2:?Usage: $0 <domain> <email>}

# ── 1. Patch nginx.conf with the real domain ──────────────────────────────
echo "→ Setting domain to $DOMAIN in nginx/nginx.conf"
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.conf

# ── 1.5. Build frontend ────────────────────────────────────────────────────
echo "→ Copying ticket images to frontend/public"
mkdir -p ./frontend/public/tickets
if [ -d "../../frontend_market/public/tickets" ]; then
  cp -r ../../frontend_market/public/tickets/. ./frontend/public/tickets/
elif [ -d "../frontend_market/public/tickets" ]; then
  cp -r ../frontend_market/public/tickets/. ./frontend/public/tickets/
fi

echo "→ Building frontend"
docker build -t avtotime-frontend-builder \
  --build-arg VITE_API_URL="https://$DOMAIN" \
  ./frontend
docker create --name frontend-extract avtotime-frontend-builder
mkdir -p ./frontend/dist
docker cp frontend-extract:/app/dist/. ./frontend/dist/
docker rm frontend-extract

# ── 2. Create dummy self-signed cert so nginx can start before real cert ──
echo "→ Creating temporary self-signed certificate"
docker compose run --rm --entrypoint "openssl req -x509 -nodes -newkey rsa:2048 \
  -days 1 \
  -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
  -out    /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  -subj   '/CN=localhost'" \
  certbot

# ── 3. Start nginx (needs certs to exist to load config) ──────────────────
echo "→ Starting nginx"
docker compose up -d nginx

# ── 4. Get the real certificate ───────────────────────────────────────────
echo "→ Requesting Let's Encrypt certificate for $DOMAIN"
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN"

# ── 5. Reload nginx to pick up the real cert ──────────────────────────────
echo "→ Reloading nginx"
docker compose exec nginx nginx -s reload

# ── 6. Start remaining services ───────────────────────────────────────────
echo "→ Starting all services"
docker compose up -d

echo ""
echo "✓ Done! https://$DOMAIN is live."
echo "  Certbot will auto-renew every 12 h."
