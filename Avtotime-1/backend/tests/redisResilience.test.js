import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Port picked to be closed. The point is an *unreachable* Redis, which is the
// case that used to hang rather than fail.
const DEAD_REDIS = "redis://127.0.0.1:6399";

let getSharedRedisClient;
let initializeSocketRedisAdapter;
const savedRedisUrl = process.env.REDIS_URL;
const savedTimeout = process.env.REDIS_CONNECT_TIMEOUT_MS;

// vitest gives each file a fresh module registry but the SAME process, so an
// env var set here would otherwise follow every later test file into a dead
// Redis and slow it down for no reason.
afterAll(() => {
  process.env.REDIS_URL = savedRedisUrl ?? "";
  if (savedTimeout === undefined) delete process.env.REDIS_CONNECT_TIMEOUT_MS;
  else process.env.REDIS_CONNECT_TIMEOUT_MS = savedTimeout;
});

beforeAll(async () => {
  process.env.REDIS_URL = DEAD_REDIS;
  // Read when the module loads, so it has to be set before the import.
  process.env.REDIS_CONNECT_TIMEOUT_MS = "500";
  ({ getSharedRedisClient, initializeSocketRedisAdapter } = await import("../config/redis.js"));
});

describe("an unreachable Redis degrades instead of hanging", () => {
  // The bug this guards: node-redis retries a refused connection forever and
  // never settles the promise from connect(). isAuth awaits the session cache on
  // every authenticated request, so the app stopped answering while /api/health
  // — which touches no cache — kept reporting it healthy to docker.
  it("resolves the shared client to null rather than never resolving", async () => {
    const started = Date.now();
    const client = await getSharedRedisClient();

    expect(client).toBeNull();
    // The bug was an unbounded wait, so any finite bound proves the point. Kept
    // well clear of the 500ms connect timeout so a loaded CI runner cannot turn
    // this into a flake.
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("answers immediately on the next call instead of re-dialling a dead server", async () => {
    await getSharedRedisClient();

    const started = Date.now();
    expect(await getSharedRedisClient()).toBeNull();
    // Without the cooldown this would re-dial and cost another connect timeout
    // (500ms here), so the bound only has to sit clearly below that.
    expect(Date.now() - started).toBeLessThan(300);
  });

  it("gives up on the socket adapter so the server still reaches listen()", async () => {
    const started = Date.now();
    // index.js awaits this before server.listen(); hanging here meant the
    // backend never started at all.
    const result = await initializeSocketRedisAdapter({ adapter: () => {} });

    expect(result.enabled).toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});
