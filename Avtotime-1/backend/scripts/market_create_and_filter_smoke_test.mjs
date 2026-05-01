import mongoose from "mongoose";
import User from "../models/user.model.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:8011";
const PASSWORD = process.env.TEST_PASSWORD || "123456";

const json = (value) => (value === undefined ? undefined : JSON.stringify(value));

const getCookieHeader = (res) => {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = setCookies.length ? setCookies : [res.headers.get("set-cookie")].filter(Boolean);
  return raw.map((c) => c.split(";")[0]).join("; ");
};

const request = async ({ method, path, body, cookie, headers }) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(headers || {}),
      ...(cookie ? { cookie } : {}),
      Origin: "http://localhost:5173",
    },
    body,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { res, data };
};

const signIn = async (identifier) => {
  const { res, data } = await request({
    method: "POST",
    path: "/api/auth/signin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  });

  if (!res.ok) return null;
  const cookie = getCookieHeader(res);
  if (!cookie) return null;
  return { user: data, cookie, created: false };
};

const signUp = async ({ userName, email }) => {
  const { res, data } = await request({
    method: "POST",
    path: "/api/auth/signup",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Smoke Test", userName, email, password: PASSWORD }),
  });

  if (!res.ok) throw new Error(`signup failed: ${res.status} ${json(data)}`);
  const cookie = getCookieHeader(res);
  if (!cookie) throw new Error("no cookie after signup");
  return { user: data, cookie, created: true };
};

const ensureAuth = async () => {
  const existing = await signIn("pepe");
  if (existing) return existing;

  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return signUp({
    userName: `smoke_${suffix}`,
    email: `smoke_${suffix}@example.com`,
  });
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function main() {
  const auth = await ensureAuth();

  const dbUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/avtotime";
  await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });

  const createdIds = [];

  try {
    // Create car
    {
      const form = new FormData();
      form.append("offerType", "Продажа");
      form.append("brand", "BMW");
      form.append("model", "X5");
      form.append("year", "2020");
      form.append("mileage", "50000");
      form.append("fuel", "Бензин");
      form.append("body", "Кроссовер");
      form.append("drive", "Полный");
      form.append("gearbox", "Автомат");
      form.append("engineVolume", "3.0");
      form.append("seats", "5");
      form.append("registration", "Moldova");
      form.append("region", "Chisinau");
      form.append("price", "10000");
      form.append("currency", "$");
      form.append("title", "Smoke Car Listing");
      form.append("description", "Smoke description");
      form.append("image", "https://example.com/smoke-car.jpg");

      const { res, data } = await request({
        method: "POST",
        path: "/api/market/cars",
        cookie: auth.cookie,
        body: form,
      });

      assert(res.ok, `create car failed: ${res.status} ${json(data)}`);
      assert(data?.brand === "BMW", "car brand not saved");
      assert(data?.region === "Chisinau", "car region not saved");
      assert(typeof data?.type === "string" && data.type, "car type not saved");
      assert(typeof data?._id === "string" || data?._id, "car _id missing");
      createdIds.push({ model: MarketCarListing, id: data._id });

      const { res: filterRes, data: filterData } = await request({
        method: "GET",
        path: `/api/market/filter?type=cars&category=${encodeURIComponent("Продажа")}&location=${encodeURIComponent("Chisinau")}`,
        cookie: auth.cookie,
      });

      assert(filterRes.ok, `filter cars failed: ${filterRes.status} ${json(filterData)}`);
      assert(Array.isArray(filterData), "filter cars response is not an array");
      assert(filterData.some((x) => x?._id === data._id || x?.id === data.id), "created car not returned by filter");
    }

    // Create car service
    {
      const form = new FormData();
      form.append("category", "Диагностика");
      form.append("title", "Smoke Service");
      form.append("location", "Chisinau");
      form.append("price", "1500");
      form.append("unit", "/час");
      form.append("image", "https://example.com/smoke-service.jpg");

      const { res, data } = await request({
        method: "POST",
        path: "/api/market/car-services",
        cookie: auth.cookie,
        body: form,
      });

      assert(res.ok, `create car service failed: ${res.status} ${json(data)}`);
      assert(data?.category === "Диагностика", "car-service category not saved");
      assert(data?.location === "Chisinau", "car-service location not saved");
      createdIds.push({ model: MarketCarServiceListing, id: data._id });
    }

    // Create auto-tuning
    {
      const form = new FormData();
      form.append("title", "Smoke Tuning");
      form.append("category", "ECU");
      form.append("location", "Chisinau");
      form.append("price", "5000");
      form.append("badge", "TOP");
      form.append("tags", JSON.stringify(["ecu", "chip"]));
      form.append("image", "https://example.com/smoke-tuning.jpg");

      const { res, data } = await request({
        method: "POST",
        path: "/api/market/auto-tuning",
        cookie: auth.cookie,
        body: form,
      });

      assert(res.ok, `create auto-tuning failed: ${res.status} ${json(data)}`);
      assert(data?.location === "Chisinau", "auto-tuning location not saved");
      assert(Array.isArray(data?.tags) && data.tags.length === 2, "auto-tuning tags not saved");
      createdIds.push({ model: MarketAutoTuningListing, id: data._id });
    }

    // Create dry-cleaning
    {
      const form = new FormData();
      form.append("title", "Smoke Dry Cleaning");
      form.append("category", "Химчистка салона");
      form.append("location", "Chisinau");
      form.append("price", "2500");
      form.append("badge", "FAST");
      form.append("tags", JSON.stringify(["salon", "ozone"]));
      form.append("image", "https://example.com/smoke-dry.jpg");

      const { res, data } = await request({
        method: "POST",
        path: "/api/market/dry-cleaning",
        cookie: auth.cookie,
        body: form,
      });

      assert(res.ok, `create dry-cleaning failed: ${res.status} ${json(data)}`);
      assert(data?.category === "Химчистка салона", "dry-cleaning category not saved");
      assert(Array.isArray(data?.tags) && data.tags.length === 2, "dry-cleaning tags not saved");
      createdIds.push({ model: MarketDryCleaningListing, id: data._id });
    }

    console.log("OK market create + filter payloads");
  } finally {
    for (const entry of createdIds) {
      // eslint-disable-next-line no-await-in-loop
      await entry.model.deleteOne({ _id: entry.id }).catch(() => {});
    }

    if (auth.created && auth.user?._id) {
      await User.deleteOne({ _id: auth.user._id }).catch(() => {});
    }

    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("FAIL", err?.message || err);
  process.exitCode = 1;
});

