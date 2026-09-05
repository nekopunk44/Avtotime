import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import User from "../models/user.model.js";

describe("app factory", () => {
  it("serves GET /api/health without a database or socket server", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, env: "test" });
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("answers 404 through the shared error handler for unknown routes", async () => {
    const response = await request(createApp()).get("/api/definitely-not-a-route");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Not Found");
    // Every response carries the id, so a user reporting a dead link can quote
    // something that finds the request in the logs.
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });
});

describe("test database", () => {
  it("is an in-memory instance, not the developer's database", () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toBe("avtotime_test");
    expect(["127.0.0.1", "localhost"]).toContain(mongoose.connection.host);
  });

  it("persists and reads back a document", async () => {
    const created = await User.create({
      name: "Smoke Test",
      userName: `smoke_${Date.now()}`,
      email: `smoke_${Date.now()}@example.com`,
    });

    const found = await User.findById(created._id).lean();

    expect(found).not.toBeNull();
    expect(found.name).toBe("Smoke Test");
    expect(await User.countDocuments()).toBe(1);
  });

  it("starts each test with empty collections", async () => {
    expect(await User.countDocuments()).toBe(0);
  });
});
