import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import User from "../models/user.model.js";

const app = createApp();

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Person",
    userName: "person",
    email: "person@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

describe("the CSRF floor on mutating routes", () => {
  it("refuses a mutating request arriving from a foreign origin", async () => {
    const user = await signUp();

    // What a CSRF actually looks like: the victim's browser, the victim's
    // cookie, the attacker's page as Origin.
    const response = await request(app)
      .patch("/api/user/changePassword")
      .set("Authorization", `Bearer ${user.token}`)
      .set("Origin", "https://evil.example")
      .send({ currentPassword: "correct-horse-battery", newPassword: "attacker-password" });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/origin/i);
  });

  it("refuses the sandboxed-iframe origin 'null'", async () => {
    const response = await request(app)
      .post("/api/auth/signin")
      .set("Origin", "null")
      .send({ identifier: "person", password: "whatever" });

    expect(response.status).toBe(403);
  });

  it("blocks login CSRF: signing the victim into the attacker's account", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .set("Origin", "https://evil.example")
      .send({ name: "A", userName: "attacker", email: "a@evil.example", password: "attacker-pass" });

    expect(response.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  it("passes a mutating request from an allowed origin", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .set("Origin", "http://localhost:5173")
      .send({ name: "P", userName: "person", email: "person@example.com", password: "correct-horse-battery" });

    expect(response.status).toBe(201);
  });

  it("passes a mutating request with no Origin at all — mobile and webhooks", async () => {
    // Mobile apps and Stripe's webhook calls carry no Origin and no browser
    // cookie jar; they are not a CSRF surface and must not be locked out.
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "P", userName: "person", email: "person@example.com", password: "correct-horse-battery" });

    expect(response.status).toBe(201);
  });

  it("leaves reads alone regardless of origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil.example");

    // A GET changes nothing; CORS already stops the page from reading it.
    expect(response.status).toBe(200);
  });
});
