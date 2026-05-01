import { getSharedRedisClient } from "../config/redis.js";

const marketListCache = new Map();

const CACHE_TTL_MS = Math.max(0, Number(process.env.MARKET_LIST_CACHE_TTL_MS || 5000));
const CACHE_TTL_SECONDS = Math.max(1, Math.ceil(CACHE_TTL_MS / 1000));

const buildKey = (scope, filter) => `${scope}::${JSON.stringify(filter)}`;

const getRedisCacheKey = (scope, filter) => `market-list:${buildKey(scope, filter)}`;

export const getCachedMarketList = async (scope, filter) => {
  if (CACHE_TTL_MS <= 0) return null;

  const key = buildKey(scope, filter);
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
      const redisValue = await redis.get(getRedisCacheKey(scope, filter));
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

export const setCachedMarketList = async (scope, filter, value) => {
  if (CACHE_TTL_MS <= 0) return value;

  const key = buildKey(scope, filter);
  marketListCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  try {
    const redis = await getSharedRedisClient();
    if (redis) {
      await redis.set(getRedisCacheKey(scope, filter), JSON.stringify(value), {
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
