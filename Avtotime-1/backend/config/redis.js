let socketAdapterInitPromise = null;
let sharedRedisClientPromise = null;

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

const shouldUseRedisSockets = () =>
  truthy(process.env.REDIS_SOCKET_ADAPTER_ENABLED ?? "true") &&
  typeof process.env.REDIS_URL === "string" &&
  process.env.REDIS_URL.trim().length > 0;

const canUseRedis = () =>
  typeof process.env.REDIS_URL === "string" && process.env.REDIS_URL.trim().length > 0;

const CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 3000;
const RETRY_COOLDOWN_MS = Number(process.env.REDIS_RETRY_COOLDOWN_MS) || 30_000;

// Set after a failed attempt so a dead Redis is not re-dialled by every single
// request. Until it passes, callers get null immediately and fall back.
let unavailableUntil = 0;

const closeQuietly = (client) => {
  try {
    if (typeof client?.destroy === "function") client.destroy();
    else client?.disconnect?.();
  } catch {
    // already gone
  }
};

/**
 * `connect()` bounded by a timeout.
 *
 * node-redis keeps retrying a refused connection and never settles the promise
 * it handed back, so every `await client.connect()` in this file is a potential
 * deadlock rather than a potential error.
 */
const connectWithTimeout = (client, what) =>
  Promise.race([
    client.connect(),
    new Promise((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`${what}: connect timed out after ${CONNECT_TIMEOUT_MS}ms`)),
        CONNECT_TIMEOUT_MS,
      ).unref?.();
    }),
  ]);

/**
 * Resolves to a connected client, or to null — but always resolves.
 *
 * That guarantee is the whole point. node-redis retries a refused connection
 * forever and `connect()` never settles, so awaiting it directly meant that a
 * Redis outage hung every caller instead of failing: `isAuth` awaits the session
 * cache on each authenticated request, and /api/health does not, so the app
 * would stop answering while still looking healthy to docker.
 */
export const getSharedRedisClient = async () => {
  if (!canUseRedis()) return null;
  if (sharedRedisClientPromise) return sharedRedisClientPromise;
  if (Date.now() < unavailableUntil) return null;

  sharedRedisClientPromise = (async () => {
    let client;
    try {
      const { createClient } = await import("redis");
      client = createClient({
        url: process.env.REDIS_URL.trim(),
        // Reject commands issued while the socket is down instead of queueing
        // them: a cache miss costs one DB query, a queued command that never
        // drains costs the whole request.
        disableOfflineQueue: true,
        socket: { connectTimeout: CONNECT_TIMEOUT_MS },
      });
      client.on("error", (error) => {
        console.error("[redis] shared client error:", error?.message || error);
      });
      // Once the client gives up for good, drop the memo so a later call can
      // dial a recovered Redis instead of holding a dead handle forever.
      client.on("end", () => {
        if (sharedRedisClientPromise) {
          sharedRedisClientPromise = null;
          unavailableUntil = Date.now() + RETRY_COOLDOWN_MS;
        }
      });

      await connectWithTimeout(client, "shared client");

      console.log("[redis] shared client connected");
      return client;
    } catch (error) {
      closeQuietly(client);
      sharedRedisClientPromise = null;
      unavailableUntil = Date.now() + RETRY_COOLDOWN_MS;
      console.error("[redis] shared client init failed:", error?.message || error);
      return null;
    }
  })();

  return sharedRedisClientPromise;
};

export const initializeSocketRedisAdapter = async (io) => {
  if (!io) return { enabled: false, reason: "missing_io" };
  if (!shouldUseRedisSockets()) return { enabled: false, reason: "disabled" };
  if (socketAdapterInitPromise) return socketAdapterInitPromise;

  socketAdapterInitPromise = (async () => {
    // Declared outside the try so the catch below can close whatever was
    // already opened when the connect timed out.
    let pubClient;
    let subClient;
    try {
      const [{ createAdapter }, { createClient }] = await Promise.all([
        import("@socket.io/redis-adapter"),
        import("redis"),
      ]);

      const redisUrl = process.env.REDIS_URL.trim();
      pubClient = createClient({ url: redisUrl, socket: { connectTimeout: CONNECT_TIMEOUT_MS } });
      subClient = pubClient.duplicate();

      pubClient.on("error", (error) => {
        console.error("[redis] pub client error:", error?.message || error);
      });
      subClient.on("error", (error) => {
        console.error("[redis] sub client error:", error?.message || error);
      });

      // Bounded, because index.js awaits this before server.listen(): an
      // unreachable Redis used to mean the backend never started listening at
      // all, so docker health-checked it dead and restarted it forever. Without
      // the adapter each worker only broadcasts to its own sockets — degraded
      // realtime, but a running app.
      await Promise.all([
        connectWithTimeout(pubClient, "socket pub"),
        connectWithTimeout(subClient, "socket sub"),
      ]);
      io.adapter(createAdapter(pubClient, subClient));

      console.log("[socket] Redis adapter enabled");
      return { enabled: true, pubClient, subClient };
    } catch (error) {
      closeQuietly(pubClient);
      closeQuietly(subClient);
      socketAdapterInitPromise = null;
      console.error("[socket] Redis adapter init failed:", error?.message || error);
      return { enabled: false, reason: "init_failed", error };
    }
  })();

  return socketAdapterInitPromise;
};
