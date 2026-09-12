import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import { catalogBrands, catalogModels } from "../config/vehicleCatalog.js";
import { invalidateCachedResponse } from "../services/responseCache.js";

const app = createApp();

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Seller",
    userName: "seller",
    email: "seller@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

let user;

beforeEach(async () => {
  user = await signUp();
  // Списки марок кэшируются между запросами; в жизни кэш сбрасывает создание
  // объявления, здесь объявления заводятся напрямую моделью.
  await invalidateCachedResponse("market-meta");
});

const authed = (url) => request(app).get(url).set("Authorization", `Bearer ${user.token}`);

describe("справочник марок и моделей", () => {
  it("подсказывает марки, когда объявлений ещё нет", async () => {
    const response = await authed("/api/market/brands");

    expect(response.status).toBe(200);
    expect(response.body).toContain("BMW");
    expect(response.body).toContain("Toyota");
    expect(response.body.length).toBeGreaterThan(50);
  });

  it("отдаёт модели выбранной марки", async () => {
    const response = await authed("/api/market/models?brand=BMW");

    expect(response.status).toBe(200);
    expect(response.body.models).toContain("X5");
    expect(response.body.models).toContain("3 Series");
    // Модели чужой марки в выдачу не попадают.
    expect(response.body.models).not.toContain("Octavia");
  });

  it("без марки отдаёт модели всех марок — искать можно по одному названию", async () => {
    const response = await authed("/api/market/models");

    expect(response.status).toBe(200);
    expect(response.body.models).toContain("X5");
    expect(response.body.models).toContain("Octavia");
  });

  it("не подсказывает служебные «Другая марка» и «Другая модель»", async () => {
    const brands = await authed("/api/market/brands");
    const models = await authed("/api/market/models?brand=BMW");

    expect(brands.body).not.toContain("Другая марка");
    expect(models.body.models).not.toContain("Другая модель");
  });

  it("марку из объявления добавляет к справочнику, а не заменяет им", async () => {
    await MarketCarListing.create({
      id: 1,
      image: "https://example.com/car.jpg",
      title: "Редкая машина",
      author: user.id,
      moderationStatus: "approved",
      brand: "Копейка",
    });

    const response = await authed("/api/market/brands");

    expect(response.body).toContain("Копейка");
    expect(response.body).toContain("BMW");
  });

  it("одна марка собирает модели из разных видов транспорта", () => {
    // Mercedes-Benz есть и среди легковых, и среди грузовых, и среди автобусов.
    const models = catalogModels("Mercedes-Benz");
    expect(models).toContain("E-Class");
    expect(models).toContain("Actros");
    expect(models).toContain("Sprinter");
    expect(catalogBrands()).toContain("Mercedes-Benz");
  });
});
