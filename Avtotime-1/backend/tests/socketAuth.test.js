import request from "supertest";
import { io as ioClient } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createSocketServer, disconnectUserSockets, stopSocketInfrastructure } from "../socket.js";
import User from "../models/user.model.js";

// A real socket server on an ephemeral port and a real client: the handshake
// middleware is the subject, and nothing short of an actual connection
// exercises it honestly.
const app = createApp();
let httpServer;
let baseUrl;

beforeAll(async () => {
  ({ server: httpServer } = createSocketServer(app));
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

afterAll(async () => {
  stopSocketInfrastructure?.();
  await new Promise((resolve) => httpServer.close(resolve));
});

const signUp = async (overrides = {}) => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Socket User",
    userName: "sockuser",
    email: "sock@example.com",
    password: "correct-horse-battery",
    ...overrides,
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

/** Resolves with the outcome instead of relying on test-runner timeouts. */
const tryConnect = (token) =>
  new Promise((resolve) => {
    const socket = ioClient(baseUrl, {
      transports: ["websocket"],
      auth: { token: `Bearer ${token}` },
      reconnection: false,
      timeout: 5000,
    });
    socket.on("connect", () => resolve({ connected: true, socket }));
    socket.on("connect_error", (error) => {
      socket.close();
      resolve({ connected: false, message: error?.message });
    });
  });

describe("the socket handshake honours session revocation", () => {
  it("accepts a live token", async () => {
    const user = await signUp();

    const result = await tryConnect(user.token);

    expect(result.connected).toBe(true);
    result.socket.close();
  });

  it("rejects a token with no signature at all", async () => {
    const result = await tryConnect("not-a-jwt");

    expect(result.connected).toBe(false);
    expect(result.message).toBe("unauthorized");
  });

  it("rejects a token minted before the password changed", async () => {
    const user = await signUp({ userName: "stale", email: "stale@example.com" });
    // The revocation mechanism the HTTP path already honours.
    await User.updateOne({ _id: user.id }, { $inc: { tokenVersion: 1 } });

    const result = await tryConnect(user.token);

    // Before the fix this connected fine: the handshake stopped at jwt.verify,
    // so a stolen token kept its realtime channel after the password change.
    expect(result.connected).toBe(false);
    expect(result.message).toBe("unauthorized");
  });

  it("rejects a banned user's token", async () => {
    const user = await signUp({ userName: "banned", email: "banned@example.com" });
    await User.updateOne({ _id: user.id }, { isBanned: true, banReason: "spam" });

    const result = await tryConnect(user.token);

    expect(result.connected).toBe(false);
  });

  it("kicks an already-connected socket when the session is revoked", async () => {
    const user = await signUp({ userName: "kicked", email: "kicked@example.com" });
    const { connected, socket } = await tryConnect(user.token);
    expect(connected).toBe(true);

    const dropped = new Promise((resolve) => socket.on("disconnect", (why) => resolve(why)));
    // What changePassword / logoutAll / banUser now call: handshake checks only
    // stop NEW connections, this ends the existing ones.
    disconnectUserSockets(user.id);

    const why = await dropped;
    expect(why).toBe("io server disconnect");
  });
});
