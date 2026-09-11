import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import Post from "../models/post.model.js";

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

let author;
let viewer;

beforeEach(async () => {
  author = await signUp({ userName: "author", email: "author@example.com" });
  viewer = await signUp({ userName: "viewer", email: "viewer@example.com" });
});

const createPost = (caption, likes = []) =>
  Post.create({
    author: author.id,
    mediaType: "image",
    media: "https://example.com/photo.jpg",
    caption,
    likes,
  });

describe("GET /api/post/liked", () => {
  it("returns only the posts the caller liked", async () => {
    await createPost("liked one", [viewer.id]);
    await createPost("liked two", [viewer.id, author.id]);
    await createPost("not liked", [author.id]);

    const response = await request(app)
      .get("/api/post/liked")
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.posts.map((post) => post.caption).sort()).toEqual(["liked one", "liked two"]);
  });

  it("is empty for a user who liked nothing", async () => {
    await createPost("someone else's favourite", [author.id]);

    const response = await request(app)
      .get("/api/post/liked")
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.posts).toEqual([]);
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/post/liked");
    expect(response.status).toBe(401);
  });
});

describe("API responses are not cacheable", () => {
  // Пустой 304 на условный запрос ронял экран тарифов: axios считает 304
  // ошибкой, а тела в нём нет. Без ETag клиент не сможет его получить.
  it("sends no-store and no validator on a GET", async () => {
    const response = await request(app)
      .get("/api/post/liked")
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.etag).toBeUndefined();
  });

  it("never answers 304 to a conditional request", async () => {
    const first = await request(app)
      .get("/api/payment/geo")
      .set("If-None-Match", 'W/"anything"');

    expect(first.status).toBe(200);
    expect(first.body).toHaveProperty("isCis");
  });
});
