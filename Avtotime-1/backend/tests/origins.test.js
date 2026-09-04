import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedOrigins } from "../config/origins.js";

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_ORIGINS: process.env.CLIENT_ORIGINS,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
};

const setEnv = (values) => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

afterEach(() => {
  setEnv(saved);
  vi.restoreAllMocks();
});

const allows = (origin) =>
  getAllowedOrigins().some((a) => (a instanceof RegExp ? a.test(origin) : a === origin));

describe("production trusts only what it was configured with", () => {
  it("does not trust localhost once NODE_ENV is production", () => {
    setEnv({ NODE_ENV: "production", CLIENT_ORIGINS: "https://avtotime.org" });

    expect(allows("https://avtotime.org")).toBe(true);
    // The auth cookie is SameSite=None in production, so csrfOriginCheck is the
    // only thing between a hostile page and a state-changing request.
    expect(allows("http://localhost:5173")).toBe(false);
    expect(allows("http://localhost:8000")).toBe(false);
  });

  it("accepts several configured origins and ignores stray whitespace", () => {
    setEnv({
      NODE_ENV: "production",
      CLIENT_ORIGINS: " https://avtotime.org , https://m.avtotime.org ",
    });

    expect(allows("https://avtotime.org")).toBe(true);
    expect(allows("https://m.avtotime.org")).toBe(true);
    expect(allows("https://evil.example")).toBe(false);
  });

  it("normalises a trailing slash so the same origin is not missed", () => {
    setEnv({ NODE_ENV: "production", CLIENT_ORIGINS: "https://avtotime.org/" });

    expect(allows("https://avtotime.org")).toBe(true);
  });

  it("falls back to FRONTEND_ORIGIN when CLIENT_ORIGINS is absent", () => {
    setEnv({ NODE_ENV: "production", CLIENT_ORIGINS: undefined, FRONTEND_ORIGIN: "https://avtotime.org" });

    expect(allows("https://avtotime.org")).toBe(true);
    expect(allows("http://localhost:5173")).toBe(false);
  });

  it("shouts when production is left unconfigured instead of failing quietly", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setEnv({ NODE_ENV: "production", CLIENT_ORIGINS: undefined, FRONTEND_ORIGIN: undefined });

    getAllowedOrigins();

    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toMatch(/CLIENT_ORIGINS/);
  });
});

describe("development keeps its conveniences", () => {
  it("trusts localhost ports outside production", () => {
    setEnv({ NODE_ENV: "development", CLIENT_ORIGINS: undefined, FRONTEND_ORIGIN: undefined });

    expect(allows("http://localhost:5173")).toBe(true);
    expect(allows("http://localhost:3000")).toBe(true);
    expect(allows("http://localhost:9999")).toBe(false);
  });

  it("adds configured origins alongside the localhost defaults", () => {
    setEnv({ NODE_ENV: "development", CLIENT_ORIGINS: "https://staging.avtotime.org" });

    expect(allows("http://localhost:5173")).toBe(true);
    expect(allows("https://staging.avtotime.org")).toBe(true);
  });
});
