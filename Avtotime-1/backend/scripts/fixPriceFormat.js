/**
 * Старые цены записаны слитно: «EUR10 000». Код валюты приклеивался к сумме,
 * потому что форматирование ждало знака вроде «€».
 *
 * Запуск: node scripts/fixPriceFormat.js
 *
 * Идемпотентен: строка, уже приведённая к виду «10 000 €», не трогается.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

const SYMBOLS = { EUR: "€", USD: "$", RUB: "₽", MDL: "L", UAH: "₴" };

/** «EUR10 000» → «10 000 €». Уже правильные строки возвращаются как есть. */
export const normalizePrice = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  const match = raw.match(/^([A-Za-z]{3}|[€$₽₴])\s*([\d\s.,]+)$/);
  if (!match) return raw;
  const [, currency, amount] = match;
  const symbol = SYMBOLS[currency.toUpperCase()] || currency;
  return `${amount.trim()} ${symbol}`;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGODB_URI);

  for (const [name, Model] of [["авто", MarketCarListing], ["запчасти", MarketPartListing]]) {
    const rows = await Model.find({}).select("price").lean();
    let changed = 0;
    for (const row of rows) {
      const next = normalizePrice(row.price);
      if (next === row.price) continue;
      await Model.updateOne({ _id: row._id }, { price: next });
      changed += 1;
      console.log(`${name}: ${row.price} → ${next}`);
    }
    console.log(`${name}: исправлено ${changed} из ${rows.length}`);
  }

  await mongoose.disconnect();
};

// Запускаемся только при прямом вызове: тесты берут отсюда normalizePrice и
// не должны из-за импорта лезть в базу.
const calledDirectly = process.argv[1] && process.argv[1].endsWith("fixPriceFormat.js");
if (calledDirectly) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("ошибка:", error.message);
      process.exit(1);
    });
}
