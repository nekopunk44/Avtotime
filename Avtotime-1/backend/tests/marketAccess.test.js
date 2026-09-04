import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import MarketCarListing from "../models/marketCarListing.model.js";

const app = createApp();

const signUp = async (overrides = {}) => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Seller",
    userName: "seller",
    email: "seller@example.com",
    password: "correct-horse-battery",
    ...overrides,
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token, userName: response.body.userName };
};

let nextId = 1;
const listing = (author, overrides = {}) =>
  MarketCarListing.create({
    id: nextId++,
    image: "https://example.com/car.jpg",
    title: "Test car",
    author,
    ...overrides,
  });

const authed = (token) => (url) => request(app).get(url).set("Authorization", `Bearer ${token}`);

let owner;
let stranger;

beforeEach(async () => {
  nextId = 1;
  owner = await signUp();
  stranger = await signUp({ userName: "stranger", email: "stranger@example.com" });
});

describe("what the public car list may show", () => {
  const titles = (body) => (Array.isArray(body) ? body : body?.listings || body?.items || []).map((l) => l.title);

  it("shows approved listings and hides pending and rejected ones", async () => {
    await listing(owner.id, { title: "approved car", moderationStatus: "approved" });
    await listing(owner.id, { title: "pending car", moderationStatus: "pending" });
    await listing(owner.id, { title: "rejected car", moderationStatus: "rejected" });

    const response = await authed(stranger.token)("/api/market/cars");

    expect(response.status).toBe(200);
    const shown = titles(response.body);
    expect(shown).toContain("approved car");
    // An unreviewed or refused listing reaching the public list is the whole
    // point of having moderation at all.
    expect(shown).not.toContain("pending car");
    expect(shown).not.toContain("rejected car");
  });

  it("hides listings whose paid period has run out", async () => {
    await listing(owner.id, { title: "live car", expiresAt: new Date(Date.now() + 86_400_000) });
    await listing(owner.id, { title: "expired car", expiresAt: new Date(Date.now() - 86_400_000) });
    await listing(owner.id, { title: "endless car", expiresAt: null });

    const response = await authed(stranger.token)("/api/market/cars");

    const shown = titles(response.body);
    expect(shown).toEqual(expect.arrayContaining(["live car", "endless car"]));
    expect(shown).not.toContain("expired car");
  });

  it("lets an author see their own pending and rejected listings under ?mine", async () => {
    await listing(owner.id, { title: "my pending", moderationStatus: "pending" });
    await listing(stranger.id, { title: "not mine", moderationStatus: "approved" });

    const response = await authed(owner.token)("/api/market/cars?mine=true");

    const shown = titles(response.body);
    // Otherwise an author cannot tell a listing under review from a lost one.
    expect(shown).toContain("my pending");
    expect(shown).not.toContain("not mine");
  });
});

describe("a listing may only be changed by its author", () => {
  it("refuses to delete somebody else's listing", async () => {
    const created = await listing(owner.id, { title: "owner car" });

    const response = await request(app)
      .delete(`/api/market/cars/${created._id}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    expect(response.status).toBe(404);
    expect(await MarketCarListing.countDocuments({ _id: created._id })).toBe(1);
  });

  it("refuses to edit somebody else's listing", async () => {
    const created = await listing(owner.id, { title: "owner car" });

    const response = await request(app)
      .patch(`/api/market/cars/${created._id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .field("title", "hijacked");

    expect(response.status).toBe(404);
    expect((await MarketCarListing.findById(created._id).lean()).title).toBe("owner car");
  });

  it("lets the author delete their own listing", async () => {
    const created = await listing(owner.id, { title: "owner car" });

    const response = await request(app)
      .delete(`/api/market/cars/${created._id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(200);
    expect(await MarketCarListing.countDocuments({ _id: created._id })).toBe(0);
  });
});

describe("admin routes are closed to ordinary users", () => {
  const adminRoutes = [
    "/api/admin/stats",
    "/api/admin/market/pending",
    "/api/admin/market/appeals",
    "/api/admin/users",
  ];

  it.each(adminRoutes)("refuses %s to a signed-in non-admin", async (url) => {
    const response = await authed(owner.token)(url);

    expect(response.status).toBe(403);
  });

  it.each(adminRoutes)("refuses %s without a token at all", async (url) => {
    const response = await request(app).get(url);

    expect(response.status).toBe(401);
  });

  it("approving a listing is not something a stranger can do", async () => {
    const created = await listing(owner.id, { moderationStatus: "pending" });

    const response = await request(app)
      .post(`/api/admin/market/cars/${created._id}/approve`)
      .set("Authorization", `Bearer ${stranger.token}`);

    expect(response.status).toBe(403);
    expect((await MarketCarListing.findById(created._id).lean()).moderationStatus).toBe("pending");
  });
});
