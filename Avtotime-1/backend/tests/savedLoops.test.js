import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import Loop from "../models/loop.model.js";

const app = createApp();

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Viewer",
    userName: "viewer",
    email: "viewer@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

let viewer;
let loop;

beforeEach(async () => {
  viewer = await signUp();
  loop = await Loop.create({
    author: viewer.id,
    media: "https://example.com/loop.mp4",
    caption: "Тестовый ролик",
  });
});

const toggle = () =>
  request(app).get(`/api/loop/save/${loop._id}`).set("Authorization", `Bearer ${viewer.token}`);

describe("закладки на ролики", () => {
  it("сохраняет и снимает одним и тем же вызовом", async () => {
    const saved = await toggle();
    expect(saved.status).toBe(200);
    expect(saved.body.savedLoops.map(String)).toContain(String(loop._id));

    const removed = await toggle();
    expect(removed.status).toBe(200);
    expect(removed.body.savedLoops.map(String)).not.toContain(String(loop._id));
  });

  it("профиль владельца отдаёт сохранённые ролики целиком", async () => {
    await toggle();

    const me = await request(app)
      .get("/api/user/current")
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(me.status).toBe(200);
    const savedLoops = me.body.savedLoops || [];
    expect(savedLoops).toHaveLength(1);
    // Популяция: в профиль приходит сам ролик, а не голый идентификатор.
    expect(savedLoops[0].media).toBe("https://example.com/loop.mp4");
  });
});

describe("понравившиеся ролики", () => {
  it("лайкнутый ролик приходит в списке понравившихся", async () => {
    const liked = await request(app)
      .get(`/api/loop/like/${loop._id}`)
      .set("Authorization", `Bearer ${viewer.token}`);
    expect(liked.status).toBe(200);

    const list = await request(app)
      .get("/api/loop/liked")
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(list.status).toBe(200);
    expect(list.body.map((item) => String(item._id))).toContain(String(loop._id));
  });

  it("чужие лайки в список не попадают", async () => {
    const list = await request(app)
      .get("/api/loop/liked")
      .set("Authorization", `Bearer ${viewer.token}`);

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });
});
