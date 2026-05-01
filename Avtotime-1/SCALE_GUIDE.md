# Scaling Guide

## What Changed

- `Redis` added for shared Socket.IO state between backend instances
- `nginx` tuned for higher connection counts and websocket proxying
- backend can enable the Redis Socket.IO adapter with `REDIS_URL`

## Install Backend Deps

From `Avtotime-1/backend`:

```powershell
npm install
```

This is required because backend now expects:

- `redis`
- `@socket.io/redis-adapter`

## Run In Production With Multiple Backend Instances

Example:

```powershell
docker compose up --build -d --scale backend=4
```

Notes:

- `docker-compose.yml` now starts `mongodb`, `redis`, `backend`, `nginx`, `certbot`
- `nginx` proxies API and `socket.io` traffic to the `backend` upstream
- Socket.IO presence/events are shared through Redis, so multiple backend instances can serve the same users

## Required Env

In production, make sure backend has:

```env
REDIS_URL=redis://redis:6379/0
REDIS_SOCKET_ADAPTER_ENABLED=true
TRUST_PROXY=1
```

Optional shared cache tuning:

```env
MARKET_LIST_CACHE_TTL_MS=5000
RESPONSE_CACHE_TTL_MS=10000
```

When `REDIS_URL` is set, market list cache entries are shared across backend replicas.

## Important Remaining Limits

This is a necessary step, but not the final one for `10k+` concurrent users.
You should still plan for:

- CDN for static/media delivery
- Redis-backed HTTP caching for hottest API responses
- DB profiling and indexes for social/feed endpoints
- separate workers for heavy background jobs
- load testing with several API routes and websocket traffic, not one endpoint only
