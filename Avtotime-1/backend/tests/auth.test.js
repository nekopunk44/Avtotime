import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import User from "../models/user.model.js";

const app = createApp();

const credentials = (overrides = {}) => ({
  name: "Test User",
  userName: "testuser",
  email: "test@example.com",
  password: "correct-horse-battery",
  ...overrides,
});

const signUp = (overrides) => request(app).post("/api/auth/signup").send(credentials(overrides));

describe("signup", () => {
  it("creates an account and never returns the password hash", async () => {
    const response = await signUp();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ userName: "testuser", email: "test@example.com" });
    expect(response.body.password).toBeUndefined();
    expect(response.body.resetOtp).toBeUndefined();
    expect(response.body.emailVerifyToken).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    await signUp();
    const response = await signUp({ userName: "other" });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(1);
  });

  it("rejects a duplicate username", async () => {
    await signUp();
    const response = await signUp({ email: "other@example.com" });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(1);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const response = await signUp({ password: "short" });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects a malformed email", async () => {
    const response = await signUp({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });
});

describe("signin", () => {
  // Regression guard: `password` and `tokenVersion` are `select: false` on the
  // schema. A signIn query without an explicit `+password` projection makes
  // every login fail with "password is not set" — this test is the tripwire.
  it("accepts the correct password and issues a token", async () => {
    await signUp();

    const response = await request(app)
      .post("/api/auth/signin")
      .send({ identifier: "testuser", password: "correct-horse-battery" });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.length).toBeGreaterThan(20);
    expect(response.body.password).toBeUndefined();
    expect(response.headers["set-cookie"]?.join(" ")).toMatch(/HttpOnly/i);
  });

  it("works when signing in by email too", async () => {
    await signUp();

    const response = await request(app)
      .post("/api/auth/signin")
      .send({ identifier: "test@example.com", password: "correct-horse-battery" });

    expect(response.status).toBe(200);
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    await signUp();

    const wrongPassword = await request(app)
      .post("/api/auth/signin")
      .send({ identifier: "testuser", password: "wrong-password" });
    const unknownUser = await request(app)
      .post("/api/auth/signin")
      .send({ identifier: "nobody", password: "correct-horse-battery" });

    // Identical responses: otherwise the endpoint tells an attacker which
    // accounts exist.
    expect(wrongPassword.status).toBe(400);
    expect(unknownUser.status).toBe(400);
    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
  });
});

describe("session", () => {
  it("returns the signed-in user for a valid bearer token", async () => {
    const created = await signUp();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${created.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body?.userName).toBe("testuser");
  });

  it("rejects a token minted before the password changed", async () => {
    const created = await signUp();
    const staleToken = created.body.token;

    // Bumping tokenVersion is how the app revokes every existing session.
    await User.updateOne({ _id: created.body._id }, { $inc: { tokenVersion: 1 } });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${staleToken}`);

    expect(response.status).toBe(401);
  });
});

describe("profile privacy", () => {
  it("never exposes secrets of another user", async () => {
    const owner = await signUp();
    const viewer = await signUp({
      userName: "viewer",
      email: "viewer@example.com",
    });

    const response = await request(app)
      .get("/api/user/getProfile/testuser")
      .set("Authorization", `Bearer ${viewer.body.token}`);

    expect(response.status).toBe(200);
    for (const secret of [
      "password",
      "resetOtp",
      "otpExpires",
      "emailVerifyToken",
      "emailVerifyExpires",
      "expoPushTokens",
      "stripeCustomerId",
    ]) {
      expect(response.body[secret], `${secret} must not leak`).toBeUndefined();
    }
    expect(owner.body._id).toBeTruthy();
  });
});
