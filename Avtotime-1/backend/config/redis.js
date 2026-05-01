let socketAdapterInitPromise = null;
let sharedRedisClientPromise = null;

const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

const shouldUseRedisSockets = () =>
  truthy(process.env.REDIS_SOCKET_ADAPTER_ENABLED ?? "true") &&
  typeof process.env.REDIS_URL === "string" &&
  process.env.REDIS_URL.trim().length > 0;

const canUseRedis = () =>
  typeof process.env.REDIS_URL === "string" && process.env.REDIS_URL.trim().length > 0;

export const getSharedRedisClient = async () => {
  if (!canUseRedis()) return null;
  if (sharedRedisClientPromise) return sharedRedisClientPromise;

  sharedRedisClientPromise = (async () => {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL.trim() });
      client.on("error", (error) => {
        console.error("[redis] shared client error:", error?.message || error);
      });
      await client.connect();
      console.log("[redis] shared client connected");
      return client;
    } catch (error) {
      sharedRedisClientPromise = null;
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
    try {
      const [{ createAdapter }, { createClient }] = await Promise.all([
        import("@socket.io/redis-adapter"),
        import("redis"),
      ]);

      const redisUrl = process.env.REDIS_URL.trim();
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (error) => {
        console.error("[redis] pub client error:", error?.message || error);
      });
      subClient.on("error", (error) => {
        console.error("[redis] sub client error:", error?.message || error);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));

      console.log("[socket] Redis adapter enabled");
      return { enabled: true, pubClient, subClient };
    } catch (error) {
      socketAdapterInitPromise = null;
      console.error("[socket] Redis adapter init failed:", error?.message || error);
      return { enabled: false, reason: "init_failed", error };
    }
  })();

  return socketAdapterInitPromise;
};
