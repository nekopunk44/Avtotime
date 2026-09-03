import { createRequire } from "node:module";
import rateLimit from "express-rate-limit";
import { getSharedRedisClient } from "../config/redis.js";

const require = createRequire(import.meta.url);

// Limits are resolved once, when this module is first imported — i.e. before any
// app instance is built. Anything that needs different ceilings (the test suite
// raises them via vitest.config.js `test.env`) must set the variables before the
// first import of this file.
const readLimit = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const API_RATE_LIMIT_PER_MINUTE = readLimit("RATE_LIMIT_PER_MINUTE", 600);
export const AUTH_RATE_LIMIT_PER_15_MIN = readLimit("AUTH_RATE_LIMIT_PER_15_MIN", 20);

const hasRedis = () =>
  typeof process.env.REDIS_URL === "string" && process.env.REDIS_URL.trim().length > 0;

// Loaded only when REDIS_URL is set, so a pruned install still boots. Left null
// on failure, which silently keeps the built-in memory store.
let RedisStore = null;
if (hasRedis()) {
  try {
    ({ RedisStore } = require("rate-limit-redis"));
  } catch (error) {
    console.error("[rate-limit] rate-limit-redis not loadable:", error?.message || error);
  }
}

// Single instance rather than a cluster, so this is the plain spread form the
// store expects. getSharedRedisClient memoises its connection, so the await
// costs a round trip only on the very first request.
const sendCommand = async (...args) => {
  const client = await getSharedRedisClient();
  if (!client) throw new Error("Redis is not available");
  return client.sendCommand(args);
};

/**
 * Counters in Redis instead of process memory.
 *
 * The app runs under `cluster.js` with one worker per core, and the default
 * store keeps a separate counter inside each worker. With N workers the real
 * ceiling was N× the configured one, and which counter a request hit depended
 * on how the OS balanced the accept queue — so the limit was neither the
 * configured number nor reproducible.
 *
 * Distinct prefixes matter: on a shared one, ordinary browsing would burn
 * through the login attempt budget.
 */
const storeFor = (prefix) => {
  if (!RedisStore) return undefined;
  try {
    const store = new RedisStore({ prefix, sendCommand });

    // `init` starts the LUA script loads, parks their promises on the store as
    // plain properties, and awaits both — so with Redis unreachable there are
    // three rejections and nobody awaits any of them. index.js turns an
    // unhandled rejection into process.exit(1), so without this the limiter
    // would kill the very API it protects, worker after worker.
    //
    // Adopting them changes nothing else: `increment` still rejects, and
    // `passOnStoreError` turns that into an unlimited request.
    const swallow = (promise, message) =>
      promise?.catch?.((error) => {
        if (message) console.error(`[rate-limit] ${prefix} ${message}:`, error?.message || error);
      });

    const init = store.init?.bind(store);
    if (init) {
      store.init = (options) => {
        const started = init(options);
        swallow(store.incrementScriptSha);
        swallow(store.getScriptSha);
        return (
          swallow(started, "Redis store unusable, this limiter stays open until restart") ?? started
        );
      };
    }

    return store;
  } catch (error) {
    console.error("[rate-limit] store init failed, using memory:", error?.message || error);
    return undefined;
  }
};

const shared = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  // A Redis blip must not take the API down with it: on a store error let the
  // request through unlimited rather than answering 500. Losing the ceiling for
  // a few seconds is cheaper than an outage.
  passOnStoreError: true,
};

/**
 * Exported so a test can build two limiters over one prefix and check that they
 * share a counter — which is the whole point of moving off the memory store,
 * and cannot be observed through the two singletons below.
 */
export const createRateLimiter = ({ prefix, windowMs, limit, message }) =>
  rateLimit({
    ...shared,
    windowMs,
    limit,
    ...(message ? { message } : {}),
    store: storeFor(prefix),
  });

export const apiLimiter = createRateLimiter({
  prefix: "rl:api:",
  windowMs: 60 * 1000,
  limit: API_RATE_LIMIT_PER_MINUTE,
});

export const authLimiter = createRateLimiter({
  prefix: "rl:auth:",
  windowMs: 15 * 60 * 1000,
  limit: AUTH_RATE_LIMIT_PER_15_MIN,
  message: { message: "Too many auth attempts, try again later." },
});
