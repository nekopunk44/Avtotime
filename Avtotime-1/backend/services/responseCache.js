import { getSharedRedisClient } from "../config/redis.js";

// Simple O(1) LRU using Map's insertion-order property
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

const MAX_LOCAL_ENTRIES = Number(process.env.RESPONSE_CACHE_MAX_ENTRIES || 5000);
const responseCache = new LRUCache(MAX_LOCAL_ENTRIES);
const CACHE_TTL_MS = Math.max(0, Number(process.env.RESPONSE_CACHE_TTL_MS || 10000));
const CACHE_TTL_SECONDS = Math.max(1, Math.ceil(CACHE_TTL_MS / 1000));

const buildRedisKey = (namespace, key) => `response-cache:${namespace}:${key}`;

export const getCachedResponse = async (namespace, key) => {
  if (CACHE_TTL_MS <= 0) return null;

  const localKey = `${namespace}:${key}`;
  const cached = responseCache.get(localKey);
  if (cached) {
    if (cached.expiresAt <= Date.now()) {
      responseCache.delete(localKey);
    } else {
      return cached.value;
    }
  }

  try {
    const redis = await getSharedRedisClient();
    if (!redis) return null;

    const redisValue = await redis.get(buildRedisKey(namespace, key));
    if (!redisValue) return null;

    const parsed = JSON.parse(redisValue);
    responseCache.set(localKey, {
      value: parsed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedResponse = async (namespace, key, value) => {
  if (CACHE_TTL_MS <= 0) return value;

  const localKey = `${namespace}:${key}`;
  responseCache.set(localKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  try {
    const redis = await getSharedRedisClient();
    if (redis) {
      await redis.set(buildRedisKey(namespace, key), JSON.stringify(value), {
        EX: CACHE_TTL_SECONDS,
      });
    }
  } catch {
    // local cache is enough as fallback
  }

  return value;
};

export const invalidateCachedResponse = async (namespace, keyPrefix = "") => {
  const localPrefix = `${namespace}:${keyPrefix}`;
  for (const key of responseCache.keys()) {
    if (key.startsWith(localPrefix)) {
      responseCache.delete(key);
    }
  }

  try {
    const redis = await getSharedRedisClient();
    if (!redis) return;

    const pattern = buildRedisKey(namespace, `${keyPrefix}*`);
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // ignore
  }
};
