import { describe, expect, it } from "vitest";
import { normalizePrice } from "../scripts/fixPriceFormat.js";

describe("запись цены", () => {
  it("отрывает код валюты от суммы и переводит его в знак", () => {
    expect(normalizePrice("EUR10 000")).toBe("10 000 €");
    expect(normalizePrice("USD7 500")).toBe("7 500 $");
    expect(normalizePrice("MDL120 000")).toBe("120 000 L");
  });

  it("уже правильную запись не трогает", () => {
    expect(normalizePrice("34 900 €")).toBe("34 900 €");
    expect(normalizePrice("Цена по запросу")).toBe("Цена по запросу");
    expect(normalizePrice("")).toBe("");
  });

  it("знак валюты впереди тоже переносит назад", () => {
    expect(normalizePrice("€10 000")).toBe("10 000 €");
    expect(normalizePrice("$1 200")).toBe("1 200 $");
  });
});
