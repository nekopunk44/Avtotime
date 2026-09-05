import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import Post from "../models/post.model.js";
import Report from "../models/report.model.js";
import User from "../models/user.model.js";

const app = createApp();

const signUp = async (overrides = {}) => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Person",
    userName: "person",
    email: "person@example.com",
    password: "correct-horse-battery",
    ...overrides,
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

const post = (author) =>
  Post.create({
    author,
    mediaType: "image",
    media: "https://example.com/x.jpg",
    caption: "something",
  });

const file = (token, body) =>
  request(app).post("/api/reports").set("Authorization", `Bearer ${token}`).send(body);

let reporter;
let offender;

beforeEach(async () => {
  reporter = await signUp({ userName: "reporter", email: "reporter@example.com" });
  offender = await signUp({ userName: "offender", email: "offender@example.com" });
});

describe("filing a report", () => {
  it("records the report and who is responsible for the content", async () => {
    const target = await post(offender.id);

    const response = await file(reporter.token, {
      targetType: "post",
      targetId: String(target._id),
      reason: "harassment",
      comment: "оскорбления в подписи",
    });

    expect(response.status).toBe(201);
    const stored = await Report.findOne().lean();
    expect(stored.status).toBe("open");
    expect(String(stored.targetAuthor)).toBe(String(offender.id));
  });

  it("keeps naming the author after the content is deleted", async () => {
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });

    // The usual sequence: content is reported, the author deletes it, and the
    // moderator is left holding the complaint.
    await Post.deleteOne({ _id: target._id });

    const stored = await Report.findOne().lean();
    expect(String(stored.targetAuthor)).toBe(String(offender.id));
  });

  it("refuses a second report of the same thing by the same person", async () => {
    const target = await post(offender.id);
    const body = { targetType: "post", targetId: String(target._id), reason: "spam" };

    expect((await file(reporter.token, body)).status).toBe(201);
    const second = await file(reporter.token, body);

    expect(second.status).toBe(409);
    // Otherwise one person can bury the queue under one post.
    expect(await Report.countDocuments()).toBe(1);
  });

  it("still lets a different person report the same thing", async () => {
    const target = await post(offender.id);
    const third = await signUp({ userName: "third", email: "third@example.com" });
    const body = { targetType: "post", targetId: String(target._id), reason: "spam" };

    await file(reporter.token, body);
    const response = await file(third.token, body);

    expect(response.status).toBe(201);
    // Volume against one target is the signal that matters most.
    expect(await Report.countDocuments({ targetId: target._id })).toBe(2);
  });

  it("refuses a target that does not exist", async () => {
    const response = await file(reporter.token, {
      targetType: "post",
      targetId: "507f1f77bcf86cd799439011",
      reason: "spam",
    });

    expect(response.status).toBe(404);
    expect(await Report.countDocuments()).toBe(0);
  });

  it("refuses an unknown reason or target type", async () => {
    const target = await post(offender.id);

    const badReason = await file(reporter.token, {
      targetType: "post",
      targetId: String(target._id),
      reason: "because-i-said-so",
    });
    const badType = await file(reporter.token, {
      targetType: "spaceship",
      targetId: String(target._id),
      reason: "spam",
    });

    expect(badReason.status).toBe(400);
    expect(badType.status).toBe(400);
    expect(await Report.countDocuments()).toBe(0);
  });

  it("refuses a report against yourself", async () => {
    const response = await file(reporter.token, {
      targetType: "user",
      targetId: String(reporter.id),
      reason: "spam",
    });

    expect(response.status).toBe(400);
  });

  it("is closed to anonymous callers", async () => {
    const target = await post(offender.id);

    const response = await request(app)
      .post("/api/reports")
      .send({ targetType: "post", targetId: String(target._id), reason: "spam" });

    expect(response.status).toBe(401);
  });
});

describe("the moderation queue", () => {
  const queue = (token) => request(app).get("/api/reports/queue").set("Authorization", `Bearer ${token}`);
  const resolve = (token, id, body) =>
    request(app).patch(`/api/reports/${id}/resolve`).set("Authorization", `Bearer ${token}`).send(body);

  const makeAdmin = async (overrides = {}) => {
    const admin = await signUp({ userName: "moder", email: "moder@example.com", ...overrides });
    await User.updateOne({ _id: admin.id }, { isAdmin: true });
    return admin;
  };

  it("is closed to ordinary users", async () => {
    expect((await queue(reporter.token)).status).toBe(403);
  });

  it("shows the moderator open reports, oldest first", async () => {
    const admin = await makeAdmin();
    const older = await post(offender.id);
    const newer = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(older._id), reason: "spam" });
    await file(reporter.token, { targetType: "post", targetId: String(newer._id), reason: "hate" });

    const response = await queue(admin.token);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    // Oldest first: newest-first is how the oldest complaint never gets seen,
    // and "acted on within 24 hours" is the requirement.
    expect(response.body.reports[0].reason).toBe("spam");
    expect(response.body.reports[0].targetAuthor.userName).toBe("offender");
  });

  it("removes a report from the queue once it is resolved", async () => {
    const admin = await makeAdmin();
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });
    const stored = await Report.findOne().lean();

    const resolved = await resolve(admin.token, stored._id, { status: "actioned", note: "удалено" });

    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe("actioned");
    expect((await queue(admin.token)).body.total).toBe(0);
  });

  it("refuses to resolve the same report twice", async () => {
    const admin = await makeAdmin();
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });
    const stored = await Report.findOne().lean();

    await resolve(admin.token, stored._id, { status: "dismissed" });
    const second = await resolve(admin.token, stored._id, { status: "actioned" });

    // Two moderators opening the queue at once must not both "decide" it.
    expect(second.status).toBe(404);
    expect((await Report.findById(stored._id).lean()).status).toBe("dismissed");
  });

  it("refuses a decision that is not actioned or dismissed", async () => {
    const admin = await makeAdmin();
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });
    const stored = await Report.findOne().lean();

    const response = await resolve(admin.token, stored._id, { status: "open" });

    expect(response.status).toBe(400);
  });

  it("tells the reporter their report was looked at", async () => {
    const admin = await makeAdmin();
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });
    const stored = await Report.findOne().lean();

    await resolve(admin.token, stored._id, { status: "actioned" });

    const { default: Notification } = await import("../models/notification.model.js");
    await vi.waitFor(async () => {
      const notification = await Notification.findOne({ recipient: reporter.id }).lean();
      expect(notification?.relatedType).toBe("report");
    });
  });

  it("cannot be resolved by an ordinary user", async () => {
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });
    const stored = await Report.findOne().lean();

    const response = await resolve(reporter.token, stored._id, { status: "dismissed" });

    expect(response.status).toBe(403);
    expect((await Report.findById(stored._id).lean()).status).toBe("open");
  });
});

describe("reports a user filed", () => {
  it("are listed back to them without exposing the moderator's notes", async () => {
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });

    const response = await request(app)
      .get("/api/reports/mine")
      .set("Authorization", `Bearer ${reporter.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].reason).toBe("spam");
    expect(response.body[0].resolutionNote).toBeUndefined();
  });

  it("does not show one user the reports of another", async () => {
    const target = await post(offender.id);
    await file(reporter.token, { targetType: "post", targetId: String(target._id), reason: "spam" });

    const response = await request(app)
      .get("/api/reports/mine")
      .set("Authorization", `Bearer ${offender.token}`);

    expect(response.body).toHaveLength(0);
  });
});
