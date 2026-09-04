import { beforeEach, describe, expect, it } from "vitest";

// The module reads its TTL once, at load time, and vitest.config.js pins it to 0
// (caching off) for every other suite — so it has to be raised before the import.
process.env.MARKET_LIST_CACHE_TTL_MS = "5000";
const { getCachedMarketList, setCachedMarketList, invalidateMarketListCache } = await import(
  "../services/marketListCache.js"
);

// Chosen so the offsets below land inside / outside one 60s bucket predictably,
// rather than depending on when the test happens to run.
const BASE_MS = 1_700_000_000_000;

const payload = (label) => [{ title: label }];

beforeEach(async () => {
  await invalidateMarketListCache();
});

describe("cache key survives a moving date bound", () => {
  // The regression: the key was built with JSON.stringify, so a `new Date()`
  // inside the Mongo filter serialised down to the millisecond. Every request
  // produced a brand new key — 0% hit rate, plus a one-shot Redis key per
  // request quietly filling the cache.
  it("reuses one entry for two requests milliseconds apart", async () => {
    const first = { status: "approved", expiresAt: { $gt: new Date(BASE_MS) } };
    const second = { status: "approved", expiresAt: { $gt: new Date(BASE_MS + 5_000) } };

    await setCachedMarketList("cars", first, payload("cached"));

    expect(await getCachedMarketList("cars", second)).toEqual(payload("cached"));
  });

  it("still lets the entry go once the bound moves into the next bucket", async () => {
    const first = { expiresAt: { $gt: new Date(BASE_MS) } };
    const later = { expiresAt: { $gt: new Date(BASE_MS + 60_000) } };

    await setCachedMarketList("cars", first, payload("cached"));

    // Otherwise an expired listing could keep being served indefinitely.
    expect(await getCachedMarketList("cars", later)).toBeNull();
  });
});

describe("different filters must not collide", () => {
  // RegExp collapses to `{}` under JSON.stringify, so a search for one brand
  // used to be served the results of another.
  it("keeps two regex filters apart", async () => {
    await setCachedMarketList("cars", { brand: /bmw/i }, payload("bmw"));

    expect(await getCachedMarketList("cars", { brand: /audi/i })).toBeNull();
    expect(await getCachedMarketList("cars", { brand: /bmw/i })).toEqual(payload("bmw"));
  });

  it("keeps the same source with different flags apart", async () => {
    await setCachedMarketList("cars", { brand: /bmw/i }, payload("case-insensitive"));

    expect(await getCachedMarketList("cars", { brand: /bmw/ })).toBeNull();
  });

  it("does not leak one scope's results into another", async () => {
    await setCachedMarketList("cars", { page: 1 }, payload("cars"));

    expect(await getCachedMarketList("parts", { page: 1 })).toBeNull();
  });

  it("treats different pages as different entries", async () => {
    await setCachedMarketList("cars", { page: 1 }, payload("page one"));

    expect(await getCachedMarketList("cars", { page: 2 })).toBeNull();
  });
});

describe("equivalent filters share an entry", () => {
  it("ignores the order the filter object was built in", async () => {
    await setCachedMarketList("cars", { brand: "bmw", year: 2020 }, payload("cached"));

    // Two call sites assembling the same filter in a different order would
    // otherwise each pay for their own miss.
    expect(await getCachedMarketList("cars", { year: 2020, brand: "bmw" })).toEqual(payload("cached"));
  });
});
