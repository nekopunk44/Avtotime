import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestId } from "../middlewars/requestId.js";
import { errorHandler, notFoundHandler } from "../middlewars/errorHandlers.js";
import { createApp } from "../app.js";

const savedEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = savedEnv;
  vi.restoreAllMocks();
});

// A throwaway app: the handlers are the subject, and mounting the whole API
// would drag in the database for no extra coverage.
const appThatThrows = (error) => {
  const app = express();
  app.use(requestId);
  app.get("/boom", () => {
    throw error;
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

describe("request id", () => {
  it("generates one and echoes it back", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps an id supplied by the proxy so one request is traceable end to end", async () => {
    const response = await request(createApp())
      .get("/api/health")
      .set("X-Request-Id", "edge-7f3a_01");

    expect(response.headers["x-request-id"]).toBe("edge-7f3a_01");
  });

  it("refuses a malformed id instead of writing it into logs", async () => {
    // The value is echoed in a header and logged, so newlines and unbounded
    // length are not acceptable input.
    const response = await request(createApp())
      .get("/api/health")
      .set("X-Request-Id", "a".repeat(200));

    expect(response.headers["x-request-id"]).not.toBe("a".repeat(200));
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("carries the id into the error response so a user can quote it", async () => {
    const response = await request(appThatThrows(new Error("kaboom")))
      .get("/boom")
      .set("X-Request-Id", "trace-42");

    expect(response.body.requestId).toBe("trace-42");
  });
});

describe("what a server fault leaves behind", () => {
  let logged;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs a 500 in production, where it used to log nothing at all", async () => {
    process.env.NODE_ENV = "production";

    await request(appThatThrows(new Error("connection string leaked here"))).get("/boom");

    expect(logged).toHaveBeenCalled();
    const entry = JSON.parse(logged.mock.calls[0][0]);
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("connection string leaked here");
    expect(entry.stack).toBeTruthy();
    expect(entry.path).toBe("/boom");
    expect(entry.status).toBe(500);
  });

  it("does not put that message in the production response", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(appThatThrows(new Error("connection string leaked here")))
      .get("/boom");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Server Error");
    expect(JSON.stringify(response.body)).not.toContain("connection string");
  });

  it("keeps the message outside production so debugging is not made harder", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(appThatThrows(new Error("useful detail"))).get("/boom");

    expect(response.body.message).toBe("useful detail");
  });

  it("does not report a 4xx as a server fault", async () => {
    const clientError = Object.assign(new Error("bad input"), { status: 400 });

    const response = await request(appThatThrows(clientError)).get("/boom");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("bad input");
    // A client mistake must not page anyone.
    expect(logged).not.toHaveBeenCalled();
  });

  it("logs one line per error, so the json-file driver keeps the stack together", async () => {
    process.env.NODE_ENV = "production";

    await request(appThatThrows(new Error("multi\nline"))).get("/boom");

    const [line] = logged.mock.calls[0];
    expect(typeof line).toBe("string");
    expect(line.split("\n")).toHaveLength(1);
  });
});
