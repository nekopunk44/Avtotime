import mongoose from "mongoose";
import MarketCarListing from "../models/marketCarListing.model.js";
import User from "../models/user.model.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:8011";
const PASSWORD = process.env.TEST_PASSWORD || "123456";

const DB_NAME = process.env.MONGO_DB_NAME || "avtotime";
const DB_PORT = Number(process.env.MONGO_MEMORY_PORT) || 27018;
const MONGO_URL =
  (process.env.MONGODB_URL && process.env.MONGODB_URL.trim()) ||
  process.env.MONGO_URL ||
  `mongodb://127.0.0.1:${DB_PORT}/${DB_NAME}`;

const json = (value) => (value === undefined ? undefined : JSON.stringify(value));

const getCookieHeader = (res) => {
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = setCookies.length ? setCookies : [res.headers.get("set-cookie")].filter(Boolean);
  return raw.map((c) => c.split(";")[0]).join("; ");
};

const request = async ({ method, path, body, cookie }) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      Origin: "http://localhost:5173",
    },
    body: body ? json(body) : undefined,
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
    body: { identifier, password: PASSWORD },
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
    body: { name: "Smoke Test", userName, email, password: PASSWORD },
  });

  if (!res.ok) {
    throw new Error(`signup failed (${userName}): ${res.status} ${json(data)}`);
  }

  const cookie = getCookieHeader(res);
  if (!cookie) throw new Error(`no auth cookie received for signup ${userName}`);
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

  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });

  const now = Date.now();
  const approvedId = now + 101;
  const pendingId = now + 202;

  const baseDoc = {
    image: "https://example.com/smoke.jpg",
    images: ["https://example.com/smoke.jpg"],
    price: "$10 000",
    title: "Smoke test listing",
    location: "Chisinau",
    region: "Chisinau",
    registrationPlace: "Chisinau",
    author: auth.user?._id,
    type: "sell",
    brand: "BMW",
    model: "X5",
    year: "2020",
  };

  const created = await MarketCarListing.create([
    { ...baseDoc, id: approvedId, title: "Smoke Approved", moderationStatus: "approved" },
    { ...baseDoc, id: pendingId, title: "Smoke Pending", moderationStatus: "pending" },
  ]);

  try {
    const { res: filterRes, data: filterData } = await request({
      method: "GET",
      path: `/api/market/filter?type=cars&location=${encodeURIComponent("Chisinau")}`,
      cookie: auth.cookie,
    });

    assert(filterRes.ok, `filter failed: ${filterRes.status} ${json(filterData)}`);
    assert(Array.isArray(filterData), "filter response is not an array");

    const ids = new Set(filterData.map((x) => x?.id));
    assert(ids.has(approvedId), "filter did not return approved listing");
    assert(!ids.has(pendingId), "filter returned pending listing (moderation filter broken)");

    const { res: searchRes, data: searchData } = await request({
      method: "GET",
      path: `/api/market/search?type=cars&q=${encodeURIComponent("Smoke")}&location=${encodeURIComponent("Chisinau")}`,
      cookie: auth.cookie,
    });

    assert(searchRes.ok, `search failed: ${searchRes.status} ${json(searchData)}`);
    assert(Array.isArray(searchData), "search response is not an array");

    const searchIds = new Set(searchData.map((x) => x?.id));
    assert(searchIds.has(approvedId), "search did not return approved listing");
    assert(!searchIds.has(pendingId), "search returned pending listing (moderation filter broken)");

    console.log("OK market filter/search moderation + location");
  } finally {
    const idsToDelete = created.map((doc) => doc._id);
    await MarketCarListing.deleteMany({ _id: { $in: idsToDelete } });

    if (auth.created && auth.user?._id) {
      await User.deleteOne({ _id: auth.user._id });
    }
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("FAIL", err?.message || err);
  process.exitCode = 1;
});
