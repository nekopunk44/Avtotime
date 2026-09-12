import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import GeoPlace from "../models/geoPlace.model.js";
import { distanceKm } from "../services/geocode.js";

const app = createApp();

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Driver",
    userName: "driver",
    email: "driver@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

let user;

beforeEach(async () => {
  user = await signUp();
  // Справочник заполнен заранее: тест проверяет счёт расстояний, а не поход
  // во внешний геокодер.
  await GeoPlace.create([
    { key: "рига", lat: 56.9496, lng: 24.1052 },
    { key: "юрмала", lat: 56.968, lng: 23.7703 },
    { key: "даугавпилс", lat: 55.8747, lng: 26.5364 },
    { key: "неизвестное место", lat: null, lng: null },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("расстояния до мест", () => {
  it("считает километры от точки и не ходит в сеть за известными городами", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await request(app)
      .post("/api/market/distances")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ lat: 56.9496, lng: 24.1052, places: ["Рига", "Юрмала", "Даугавпилс"] });

    expect(response.status).toBe(200);
    const { distances } = response.body;
    expect(distances["рига"]).toBe(0);
    // Юрмала примерно в 20 км от Риги, Даугавпилс — примерно в 200.
    expect(distances["юрмала"]).toBeGreaterThan(10);
    expect(distances["юрмала"]).toBeLessThan(35);
    expect(distances["даугавпилс"]).toBeGreaterThan(150);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("место без координат отдаётся как null, а не как ноль километров", async () => {
    const response = await request(app)
      .post("/api/market/distances")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ lat: 56.9496, lng: 24.1052, places: ["Неизвестное место"] });

    expect(response.status).toBe(200);
    expect(response.body.distances["неизвестное место"]).toBeNull();
  });

  it("без координат точки отсчёта отвечает отказом, а не пустотой", async () => {
    const response = await request(app)
      .post("/api/market/distances")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ places: ["Рига"] });

    expect(response.status).toBe(400);
  });

  it("требует авторизации", async () => {
    const response = await request(app).post("/api/market/distances").send({ lat: 1, lng: 1, places: [] });
    expect(response.status).toBe(401);
  });
});

describe("формула расстояния", () => {
  it("считает по дуге, а не по разнице координат", () => {
    // Рига — Вильнюс, примерно 265 км по прямой.
    const km = distanceKm({ lat: 56.9496, lng: 24.1052 }, { lat: 54.6872, lng: 25.2797 });
    expect(km).toBeGreaterThan(240);
    expect(km).toBeLessThan(290);
  });
});
