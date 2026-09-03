import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Needs a real Redis: the store talks to it with SCRIPT LOAD / EVALSHA, which
// no stub reproduces honestly. CI provides one; locally the block is skipped
// rather than silently passing.
const redisUrl = process.env.TEST_REDIS_URL?.trim();
const describeWithRedis = redisUrl ? describe : describe.skip;

describeWithRedis("rate limit counters are shared, not per worker", () => {
  let createRateLimiter;
  let getSharedRedisClient;
  let prefix;

  beforeAll(async () => {
    // Must be set before the first import: the module decides between the Redis
    // and the memory store at load time.
    process.env.REDIS_URL = redisUrl;
    ({ createRateLimiter } = await import("../middlewars/rateLimiters.js"));
    ({ getSharedRedisClient } = await import("../config/redis.js"));
    // Fresh namespace per run, so counters left over from an earlier run inside
    // the still-open 60s window cannot decide the result.
    prefix = `test:${process.pid}:${Date.now()}:`;
  });

  afterAll(async () => {
    const client = await getSharedRedisClient();
    await client?.quit?.().catch?.(() => {});
  });

  const worker = (limit) => {
    const app = express();
    app.use(createRateLimiter({ prefix, windowMs: 60_000, limit }));
    app.get("/ping", (_req, res) => res.json({ ok: true }));
    return app;
  };

  const hit = async (app, times) => {
    const codes = [];
    for (let i = 0; i < times; i += 1) {
      codes.push((await request(app).get("/ping")).status);
    }
    return codes;
  };

  it("spends one budget across two independent instances", async () => {
    const workerA = worker(4);
    const workerB = worker(4);

    const codes = [...(await hit(workerA, 3)), ...(await hit(workerB, 3))];

    // Four allowed in total — not four each. On the in-memory store this came
    // back all-200, because every cluster worker counted on its own and the
    // real ceiling was (workers × limit).
    expect(codes).toEqual([200, 200, 200, 200, 429, 429]);
  });

  it("keeps separate prefixes from spending each other's budget", async () => {
    const api = express();
    api.use(createRateLimiter({ prefix: `${prefix}api:`, windowMs: 60_000, limit: 2 }));
    api.get("/ping", (_req, res) => res.json({ ok: true }));

    const auth = express();
    auth.use(createRateLimiter({ prefix: `${prefix}auth:`, windowMs: 60_000, limit: 2 }));
    auth.get("/ping", (_req, res) => res.json({ ok: true }));

    // Exhaust the API budget; the auth budget must be untouched, otherwise
    // ordinary browsing would lock a user out of logging in.
    expect(await hit(api, 3)).toEqual([200, 200, 429]);
    expect(await hit(auth, 2)).toEqual([200, 200]);
  });
});
