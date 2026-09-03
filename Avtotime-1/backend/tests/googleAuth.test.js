import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import User from "../models/user.model.js";

const app = createApp();
const CLIENT_ID = "test-client-id.apps.googleusercontent.com";

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The handler validates the credential by calling Google's tokeninfo endpoint;
// the stub decides what "Google" answers, which is the entire point — these
// tests are about what WE do with that answer.
const googleAnswers = (tokenInfo, ok = true) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => tokenInfo })),
  );
};

const googleToken = (overrides = {}) => ({
  aud: CLIENT_ID,
  sub: "google-sub-1",
  email: "victim@example.com",
  email_verified: "true",
  name: "G User",
  ...overrides,
});

const signInWithGoogle = () =>
  request(app).post("/api/auth/google").send({ credential: "stubbed-jwt" });

describe("google sign-in", () => {
  it("creates an account for a verified google email", async () => {
    googleAnswers(googleToken());

    const response = await signInWithGoogle();

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    const user = await User.findOne({ email: "victim@example.com" }).lean();
    expect(user.googleId).toBe("google-sub-1");
  });

  it("refuses an UNVERIFIED google email outright", async () => {
    googleAnswers(googleToken({ email_verified: "false" }));

    const response = await signInWithGoogle();

    expect(response.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  it("does not hand an existing password account to an unverified google email", async () => {
    // The takeover this guards against: the victim has an ordinary account;
    // the attacker creates a Google account with the victim's address without
    // ever proving they own it.
    await request(app).post("/api/auth/signup").send({
      name: "Victim",
      userName: "victim",
      email: "victim@example.com",
      password: "correct-horse-battery",
    });
    googleAnswers(googleToken({ email_verified: "false", sub: "attacker-sub" }));

    const response = await signInWithGoogle();

    expect(response.status).toBe(403);
    const user = await User.findOne({ email: "victim@example.com" }).lean();
    expect(user.googleId).toBeFalsy();
    expect(response.body.token).toBeUndefined();
  });

  it("links google to an existing account only for a verified email", async () => {
    await request(app).post("/api/auth/signup").send({
      name: "Owner",
      userName: "owner",
      email: "victim@example.com",
      password: "correct-horse-battery",
    });
    googleAnswers(googleToken());

    const response = await signInWithGoogle();

    expect(response.status).toBe(200);
    const user = await User.findOne({ email: "victim@example.com" }).lean();
    expect(user.googleId).toBe("google-sub-1");
  });

  it("rejects a token issued for a different application", async () => {
    googleAnswers(googleToken({ aud: "somebody-elses-client-id" }));

    const response = await signInWithGoogle();

    expect(response.status).toBe(401);
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects a token google itself refuses", async () => {
    googleAnswers({}, false);

    const response = await signInWithGoogle();

    expect(response.status).toBe(401);
  });
});
