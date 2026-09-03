import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import Post from "../models/post.model.js";

const app = createApp();

// Restated here on purpose rather than imported from the controller: an
// independent list also catches someone shortening the controller's own
// SECRET_FIELDS array. Every one of these is `select: false` on the schema or
// otherwise never belongs in a response body.
const SECRET_KEYS = [
  "password",
  "resetOtp",
  "otpExpires",
  "emailVerifyToken",
  "emailVerifyExpires",
  "expoPushTokens",
  "stripeCustomerId",
  "tokenVersion",
];

/**
 * Walks the whole decoded response and returns the JSON path of every secret
 * key it finds. Returning paths rather than a boolean means a failure names the
 * exact leak, e.g. `$[0].comments[0].author.password`.
 */
const findSecrets = (value, path = "$") => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSecrets(item, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      SECRET_KEYS.includes(key) ? [`${path}.${key}`] : findSecrets(child, `${path}.${key}`),
    );
  }
  return [];
};

const signUp = async (overrides = {}) => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Person",
    userName: "person",
    email: "person@example.com",
    password: "correct-horse-battery",
    ...overrides,
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token, userName: response.body.userName };
};

const authed = (token) => (url) => request(app).get(url).set("Authorization", `Bearer ${token}`);

let author;
let viewer;
let post;

beforeEach(async () => {
  author = await signUp({ userName: "author", email: "author@example.com" });
  viewer = await signUp({ userName: "viewer", email: "viewer@example.com" });

  // Built through the model, not the upload endpoint: the leak this file guards
  // lives in the read path, and going through /upload would drag in multer and
  // the email-verification gate for no extra coverage.
  post = await Post.create({
    author: author.id,
    mediaType: "image",
    media: "https://example.com/photo.jpg",
    caption: "First car",
    likes: [viewer.id],
    comments: [{ author: viewer.id, message: "Nice" }],
  });

  await request(app)
    .post(`/api/user/follow/${author.id}`)
    .set("Authorization", `Bearer ${viewer.token}`);
});

describe("no endpoint leaks user secrets", () => {
  it("keeps comment authors clean in the feed", async () => {
    const response = await authed(viewer.token)("/api/post/getAll");

    expect(response.status).toBe(200);
    const posts = Array.isArray(response.body) ? response.body : response.body?.posts;
    // Guard against a vacuous pass: an empty feed would satisfy any scan.
    expect(posts?.length).toBeGreaterThan(0);
    expect(posts[0].comments?.length).toBeGreaterThan(0);
    expect(findSecrets(response.body)).toEqual([]);
  });

  it("keeps a single post clean", async () => {
    const response = await authed(viewer.token)(`/api/post/get/${post._id}`);

    expect(response.status).toBe(200);
    expect(findSecrets(response.body)).toEqual([]);
  });

  it("keeps another user's profile clean", async () => {
    const response = await authed(viewer.token)(`/api/user/getProfile/${author.userName}`);

    expect(response.status).toBe(200);
    expect(response.body?.userName).toBe("author");
    expect(findSecrets(response.body)).toEqual([]);
  });

  it("keeps follower and following lists clean", async () => {
    const followers = await authed(viewer.token)(`/api/user/${author.id}/followers`);
    const following = await authed(author.token)(`/api/user/${viewer.id}/following`);

    expect(followers.status).toBe(200);
    expect(following.status).toBe(200);
    expect(findSecrets(followers.body)).toEqual([]);
    expect(findSecrets(following.body)).toEqual([]);
  });

  it("keeps suggested users clean", async () => {
    const response = await authed(viewer.token)("/api/user/suggested");

    expect(response.status).toBe(200);
    expect(findSecrets(response.body)).toEqual([]);
  });

  it("keeps the caller's own session clean", async () => {
    // The owner may see their own account, but the bcrypt hash and the push
    // tokens are never part of that.
    const response = await authed(viewer.token)("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body?.userName).toBe("viewer");
    expect(findSecrets(response.body)).toEqual([]);
  });
});

describe("the scanner itself", () => {
  // Without this, a broken findSecrets would make every test above pass silently.
  it("reports the path of a planted secret", () => {
    const planted = { posts: [{ comments: [{ author: { userName: "x", password: "$2b$10$…" } }] }] };

    expect(findSecrets(planted)).toEqual(["$.posts[0].comments[0].author.password"]);
  });
});
