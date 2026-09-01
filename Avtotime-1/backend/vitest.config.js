import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.js"],
    // A single MongoMemoryServer is shared by the whole run, so test files must
    // not execute in parallel against it (the afterEach cleanup wipes shared
    // collections). Vitest 4 replaced `poolOptions.forks.singleFork` with these
    // top-level flags: one forked child, files executed one after another.
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    globalSetup: ["./tests/globalSetup.js"],
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30_000,
    // First run may have to download the mongod binary.
    hookTimeout: 300_000,
    teardownTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-key-for-tests-only",
      CLOUDINARY_CLOUD_NAME: "",
      CLOUDINARY_API_KEY: "",
      CLOUDINARY_API_SECRET: "",
      RESEND_API_KEY: "",
      REDIS_URL: "",
      MARKET_LIST_CACHE_TTL_MS: "0",
      SKIP_DEV_SEED: "true",
      RATE_LIMIT_PER_MINUTE: "100000",
      AUTH_RATE_LIMIT_PER_15_MIN: "100000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["**/*.js"],
      exclude: [
        "tests/**",
        "scripts/**",
        "public/**",
        "vitest.config.js",
        "cluster.js",
        "node_modules/**",
      ],
      // Raised once meaningful suites land.
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
