import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import User from "../models/user.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import { collectRequestFiles } from "../controllers/market.controllers.js";

const app = createApp();

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Master",
    userName: "master",
    email: "master@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  // Публиковать можно только с подтверждённой почтой.
  await User.updateOne({ _id: response.body._id }, { isEmailVerified: true });
  return response.body.token;
};

const photo = Buffer.from("fake-jpeg-bytes");

let token;

beforeEach(async () => {
  token = await signUp();
});

describe("услуги принимают несколько кадров", () => {
  it("сохраняет все загруженные фото, обложка — первая", async () => {
    const response = await request(app)
      .post("/api/market/car-services")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Замена масла")
      .field("category", "Ремонт и обслуживание")
      .field("location", "Кишинёв")
      .field("price", "40")
      .attach("images", photo, "one.jpg")
      .attach("images", photo, "two.jpg")
      .attach("images", photo, "three.jpg");

    expect(response.status).toBe(201);
    expect(response.body.images).toHaveLength(3);
    expect(response.body.image).toBe(response.body.images[0]);

    const saved = await MarketCarServiceListing.findOne({ title: "Замена масла" }).lean();
    expect(saved.images).toHaveLength(3);
  });

  it("одиночное поле image по-прежнему принимается: так шлёт веб", async () => {
    const response = await request(app)
      .post("/api/market/car-services")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Диагностика")
      .field("category", "Ремонт и обслуживание")
      .field("location", "Бельцы")
      .field("price", "25")
      .attach("image", photo, "single.jpg");

    expect(response.status).toBe(201);
    expect(response.body.images).toHaveLength(1);
    expect(response.body.image).toBeTruthy();
  });

  it("объявление без единого кадра не создаётся", async () => {
    const response = await request(app)
      .post("/api/market/car-services")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Без фото")
      .field("category", "Ремонт и обслуживание")
      .field("location", "Кишинёв")
      .field("price", "10");

    expect(response.status).toBe(400);
  });
});

describe("сбор файлов запроса", () => {
  it("понимает и массив, и поля, и одиночный файл", () => {
    expect(collectRequestFiles({ files: [{ path: "a" }, { path: "b" }] })).toHaveLength(2);
    expect(collectRequestFiles({ files: { images: [{ path: "a" }], image: [{ path: "b" }] } })).toHaveLength(2);
    expect(collectRequestFiles({ file: { path: "a" } })).toHaveLength(1);
    expect(collectRequestFiles({})).toHaveLength(0);
  });
});
