import { getSharedRedisClient } from "../config/redis.js";

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (entry === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
  }
  delete(key) { return this.map.delete(key); }
  keys() { return this.map.keys(); }
  get size() { return this.map.size; }
}

const MAX_LOCAL_ENTRIES = Number(process.env.MARKET_LIST_CACHE_MAX_ENTRIES || 2000);
const marketListCache = new LRUCache(MAX_LOCAL_ENTRIES);

const CACHE_TTL_MS = Math.max(0, Number(process.env.MARKET_LIST_CACHE_TTL_MS || 5000));
const CACHE_TTL_SECONDS = Math.max(1, Math.ceil(CACHE_TTL_MS / 1000));

// One minute: coarse enough that a moving `expiresAt > now` bound reuses the
// same key, fine enough that an expired listing cannot linger for long.
const KEY_TIME_BUCKET_MS = 60000;

// JSON.stringify is not a safe key builder for Mongo filters: `new Date()`
// serializes down to the millisecond (a brand new key on every request — 0%
// hit rate plus one-shot Redis garbage), and RegExp collapses to `{}` so
// different filters would collide on one key. Normalize instead: sort object
// keys, bucket dates, keep regex source and flags.
const stableSerialize = (value) => {
  if (value === null) return "null";
  if (value === undefined) return "undef";

  const type = typeof value;
  if (type === "string") return JSON.stringify(value);
  if (type === "number" || type === "boolean") return String(value);
  if (type === "bigint") return `${value}n`;
  if (type === "function" || type === "symbol") return "fn";

  if (value instanceof Date) return `D:${Math.floor(value.getTime() / KEY_TIME_BUCKET_MS)}`;
  if (value instanceof RegExp) return `R:${value.source}/${value.flags}`;
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  // ObjectId & friends: the hex string fully describes the value
  if (typeof value.toHexString === "function") return `O:${value.toHexString()}`;

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
};

const buildKey = (scope, keyParts) => `${scope}::${stableSerialize(keyParts)}`;

const getRedisCacheKey = (scope, keyParts) => `market-list:${buildKey(scope, keyParts)}`;

export const getCachedMarketList = async (scope, keyParts) => {
  if (CACHE_TTL_MS <= 0) return null;

  const key = buildKey(scope, keyParts);
  const cached = marketListCache.get(key);
  if (cached) {
    if (cached.expiresAt <= Date.now()) {
      marketListCache.delete(key);
    } else {
      return cached.value;
    }
  }

  try {
    const redis = await getSharedRedisClient();
    if (redis) {
      const redisValue = await redis.get(getRedisCacheKey(scope, keyParts));
      if (redisValue) {
        const parsed = JSON.parse(redisValue);
        marketListCache.set(key, {
          value: parsed,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return parsed;
      }
    }
  } catch {
    // fall through to local cache
  }
  return null;
};

export const setCachedMarketList = async (scope, keyParts, value) => {
  if (CACHE_TTL_MS <= 0) return value;

  const key = buildKey(scope, keyParts);
  marketListCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  try {
    const redis = await getSharedRedisClient();
    if (redis) {
      await redis.set(getRedisCacheKey(scope, keyParts), JSON.stringify(value), {
        EX: CACHE_TTL_SECONDS,
      });
    }
  } catch {
    // local cache still works
  }

  return value;
};

export const invalidateMarketListCache = async (scopePrefix = "") => {
  for (const key of marketListCache.keys()) {
    if (!scopePrefix || key.startsWith(`${scopePrefix}::`)) {
      marketListCache.delete(key);
    }
  }

  try {
    const redis = await getSharedRedisClient();
    if (!redis) return;

    const pattern = scopePrefix ? `market-list:${scopePrefix}::*` : "market-list:*";
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // ignore cache invalidation failures in Redis
  }
};
