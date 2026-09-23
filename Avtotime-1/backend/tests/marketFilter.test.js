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
  return { id: response.body._id, token: response.body.token };
};

let nextId = 1;
const car = (author, overrides = {}) =>
  MarketCarListing.create({
    id: nextId++,
    image: "https://example.com/car.jpg",
    title: "Car",
    author,
    moderationStatus: "approved",
    ...overrides,
  });

let seller;

beforeEach(async () => {
  nextId = 1;
  seller = await signUp();
});

const titles = (body) =>
  (Array.isArray(body) ? body : body?.listings || body?.items || []).map((item) => item.title);

// Шторка фильтров в приложении разрешает выбрать несколько значений сразу и
// шлёт их одной строкой через запятую — сервер обязан понять их все.
describe("фильтр принимает несколько значений в одном поле", () => {
  it("отдаёт машины с любым из выбранных приводов", async () => {
    await car(seller.id, { title: "front", driveType: "Передний" });
    await car(seller.id, { title: "rear", driveType: "Задний" });
    await car(seller.id, { title: "awd", driveType: "Полный" });

    const response = await request(app)
      .get("/api/market/filter?type=cars&driveType=Передний,Полный")
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    const shown = titles(response.body);
    expect(shown.sort()).toEqual(["awd", "front"]);
  });

  it("одно значение по-прежнему сужает выдачу до него", async () => {
    await car(seller.id, { title: "front", driveType: "Передний" });
    await car(seller.id, { title: "rear", driveType: "Задний" });

    const response = await request(app)
      .get("/api/market/filter?type=cars&driveType=Задний")
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    expect(titles(response.body)).toEqual(["rear"]);
  });

  it("город смотрящего отдаётся отдельной ручкой и требует авторизации", async () => {
    const anonymous = await request(app).get("/api/market/geo");
    expect(anonymous.status).toBe(401);

    const response = await request(app)
      .get("/api/market/geo")
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    // Локальный IP города не даёт — важно, что форма ответа постоянна и
    // приложению не приходится гадать, что пришло.
    expect(response.body).toHaveProperty("city");
    expect(response.body).toHaveProperty("region");
    expect(response.body).toHaveProperty("lat");
    expect(response.body).toHaveProperty("lng");
  });

  it("несколько видов топлива объединяются, а не пересекаются", async () => {
    await car(seller.id, { title: "petrol", fuel: "Бензин" });
    await car(seller.id, { title: "diesel", fuel: "Дизель" });
    await car(seller.id, { title: "electric", fuel: "Электро" });

    const response = await request(app)
      .get("/api/market/filter?type=cars&fuel=Бензин,Электро")
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    expect(titles(response.body).sort()).toEqual(["electric", "petrol"]);
  });
});

describe("что несёт урезанная выдача фильтра", () => {
  it("кадры объявления доезжают до карточки", async () => {
    await car(seller.id, {
      title: "с галереей",
      images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    });

    const response = await request(app)
      .get("/api/market/filter?type=cars")
      .set("Authorization", `Bearer ${seller.token}`);

    expect(response.status).toBe(200);
    const rows = Array.isArray(response.body) ? response.body : response.body?.listings || [];
    const found = rows.find((row) => row.title === "с галереей");
    // Без images в проекции карточка видела один кадр, и листать было нечего.
    expect(found?.images).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  });
});
