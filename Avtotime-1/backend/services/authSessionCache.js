import { getSharedRedisClient } from "../config/redis.js";

const AUTH_CACHE_TTL_SECONDS = Number(process.env.AUTH_CACHE_TTL_SECONDS || 60);

const redisKey = (userId) => `auth-session:${userId}`;

export const getCachedAuthSession = async (userId) => {
  try {
    const redis = await getSharedRedisClient();
    if (!redis) return null;
    const data = await redis.get(redisKey(userId));
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const setCachedAuthSession = async (userId, data) => {
  try {
    const redis = await getSharedRedisClient();
    if (!redis) return;
    await redis.set(redisKey(userId), JSON.stringify(data), { EX: AUTH_CACHE_TTL_SECONDS });
  } catch {
    // continue without cache
  }
};

export const invalidateAuthSession = async (userId) => {
  try {
    const redis = await getSharedRedisClient();
    if (!redis) return;
    await redis.del(redisKey(userId));
  } catch {
    // ignore
  }
};
