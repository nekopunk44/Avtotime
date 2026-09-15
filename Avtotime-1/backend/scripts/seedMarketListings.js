/**
 * Стартовые объявления маркета: по несколько штук на каждую категорию, чтобы
 * разделы не открывались пустыми.
 *
 * Запуск: node scripts/seedMarketListings.js
 *
 * Идемпотентен: запись с таким же заголовком (у консультантов — именем) не
 * создаётся повторно, поэтому скрипт можно гонять сколько угодно раз.
 *
 * Фотографии лежат в нашей же публичной статике и взяты со Викисклада. Там,
 * где лицензия требует указания автора, кредит уходит в конец описания —
 * условие лицензии, а не украшение.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import MarketCarServiceListing from "../models/marketCarServiceListing.model.js";
import MarketAutoTuningListing from "../models/marketAutoTuningListing.model.js";
import MarketConsultationExpert from "../models/marketConsultationExpert.model.js";
import MarketDryCleaningListing from "../models/marketDryCleaningListing.model.js";
import User from "../models/user.model.js";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

const BASE = process.env.PUBLIC_ASSET_BASE || "https://avtotime.org/api/public";
const img = (name) => `${BASE}/${name}.jpg`;

const credit = (author, license) => `Фото: ${author}, ${license} / Wikimedia Commons.`;

const CARS = [
  {
    title: "Toyota RAV4 Hybrid 2021",
    price: "24 900 €",
    image: img("seed-car-rav4"),
    brand: "Toyota",
    model: "RAV4",
    year: "2021",
    mileage: "68 000 км",
    fuel: "Гибрид",
    transmission: "Автомат",
    bodyType: "Кроссовер",
    driveType: "Полный",
    engineVolume: "2.5",
    seats: "5",
    location: "Кишинев",
    region: "Кишинев",
    type: "cars",
    description:
      "Гибридный кроссовер в максимальной комплектации: подогрев сидений и руля, адаптивный круиз, камеры кругового обзора. Обслуживался у дилера, вся история в сервисной книжке.",
  },
  {
    title: "BMW X5 xDrive30d",
    price: "29 500 €",
    image: img("seed-car-bmw"),
    brand: "BMW",
    model: "X5",
    year: "2018",
    mileage: "142 000 км",
    fuel: "Дизель",
    transmission: "Автомат",
    bodyType: "Внедорожник",
    driveType: "Полный",
    engineVolume: "3.0",
    seats: "5",
    location: "Бельцы",
    region: "Бельцы",
    type: "cars",
    description:
      "Дизельный X5 в чёрном цвете, пневмоподвеска, панорамная крыша, кожаный салон. Комплект зимних колёс на дисках в подарок.",
  },
  {
    title: "Volkswagen Golf Sportsvan 1.6 TDI",
    price: "12 700 €",
    image: img("seed-car-golf"),
    brand: "Volkswagen",
    model: "Golf",
    year: "2019",
    mileage: "96 000 км",
    fuel: "Дизель",
    transmission: "Механика",
    bodyType: "Универсал",
    driveType: "Передний",
    engineVolume: "1.6",
    seats: "5",
    location: "Кагул",
    region: "Кагул",
    type: "cars",
    description: `Экономичный семейный универсал: расход около 4,5 литра на сотне, просторный багажник, свежее ТО. ${credit("Navigator84", "CC BY-SA 4.0")}`,
  },
];

const PARTS = [
  {
    title: "Тормозные диски передние, комплект",
    price: "85 €",
    image: img("seed-part-brake"),
    brand: "Volkswagen",
    model: "Golf",
    year: "2015",
    partGroup: "Тормозная система",
    partCategory: "Тормозные диски",
    location: "Кишинев",
    region: "Кишинев",
    type: "parts",
    description: `Вентилируемые диски 288 мм под Golf и Octavia, новые, в упаковке. Подберём колодки к комплекту. ${credit("Johann H. Addicks", "CC BY-SA 3.0")}`,
  },
  {
    title: "Аккумулятор 74 Ач, 680 A",
    price: "95 €",
    image: img("seed-part-battery"),
    brand: "Bosch",
    model: "S4",
    partGroup: "Электрика",
    partCategory: "Аккумуляторы",
    location: "Кишинев",
    region: "Кишинев",
    type: "parts",
    description: `Свежая дата выпуска, гарантия два года. Бесплатно проверим генератор при установке и заберём старый аккумулятор. ${credit("Azorbli", "CC BY-SA 4.0")}`,
  },
  {
    title: "Свечи зажигания иридиевые, 4 шт.",
    price: "38 €",
    image: img("seed-part-plug"),
    brand: "NGK",
    model: "Laser Iridium",
    partGroup: "Двигатель",
    partCategory: "Система зажигания",
    location: "Бельцы",
    region: "Бельцы",
    type: "parts",
    description:
      "Оригинальные иридиевые свечи под большинство бензиновых моторов 1.4–2.0. Ресурс до 60 тысяч километров, ровный холостой ход и уверенный запуск зимой.",
  },
];

const SERVICES = [
  {
    title: "Замена масла и фильтров за час",
    category: "Техобслуживание",
    price: "25",
    pricePrefix: "от",
    unit: "€",
    location: "Кишинев",
    image: img("seed-service-lift"),
    serviceQuality: 4.8,
    reviews: 64,
  },
  {
    title: "Компьютерная диагностика двигателя",
    category: "Диагностика",
    price: "20",
    pricePrefix: "от",
    unit: "€",
    location: "Кишинев",
    image: img("seed-service-showroom"),
    serviceQuality: 4.6,
    reviews: 38,
  },
];

const TUNING = [
  {
    title: "Литые диски R18, комплект",
    category: "Диски и шины",
    price: "480",
    location: "Кишинев",
    image: img("seed-tuning-wheel"),
    rating: 4.9,
    reviews: 21,
    tags: ["R18", "5x112", "Лёгкий сплав"],
  },
  {
    title: "Аэродинамический обвес и занижение",
    category: "Внешний тюнинг",
    price: "1 200",
    location: "Бельцы",
    image: img("seed-tuning-porsche"),
    rating: 4.7,
    reviews: 12,
    tags: ["Обвес", "Пружины", "Установка"],
  },
];

const CLEANING = [
  {
    title: "Химчистка салона целиком",
    category: "Химчистка",
    price: "70",
    location: "Кишинев",
    image: img("seed-clean-myjnia"),
    rating: 4.8,
    reviews: 45,
    tags: ["Салон", "Потолок", "Багажник"],
  },
  {
    title: "Мойка кузова с полировкой воском",
    category: "Мойка",
    price: "18",
    location: "Кишинев",
    image: img("seed-clean-wash"),
    rating: 4.6,
    reviews: 88,
    tags: ["Кузов", "Воск", "Сушка"],
  },
];

const EXPERTS = [
  {
    name: "Андрей Павел",
    avatar: img("seed-service-showroom"),
    hourlyRate: 25,
    location: "Кишинев",
    specialties: ["Подбор авто", "Проверка перед покупкой"],
    experience: 9,
    rating: 4.9,
    reviewsCount: 57,
    tags: ["Диагностика", "Торг с продавцом"],
    isVerified: true,
  },
  {
    name: "Мария Стойка",
    avatar: img("seed-car-golf"),
    hourlyRate: 20,
    location: "Бельцы",
    specialties: ["Оформление сделки", "Страхование"],
    experience: 6,
    rating: 4.7,
    reviewsCount: 31,
    tags: ["Документы", "Растаможка"],
    isVerified: true,
  },
];

let counter = 0;
const nextId = () => Date.now() + (counter += 1);

const seed = async (Model, rows, { key = "title", extra = {} } = {}) => {
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const exists = await Model.findOne({ [key]: row[key] }).select("_id").lean();
    if (exists) {
      skipped += 1;
      continue;
    }
    await Model.create({ id: nextId(), ...row, ...extra });
    created += 1;
  }

  return { created, skipped };
};

const run = async () => {
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error("MONGODB_URL не задан");

  await mongoose.connect(url);

  const author =
    (await User.findOne({ isAdmin: true }).select("_id name").lean())
    || (await User.findOne().sort({ createdAt: 1 }).select("_id name").lean());

  if (!author) throw new Error("В базе нет ни одного пользователя — некого назначить автором");

  // Объявления наши, проверять их у модерации нечего, но происхождение видно
  // по провайдеру.
  const base = {
    author: author._id,
    seller: author.name || "Avtotime",
    moderationStatus: "approved",
    moderationProvider: "seed",
    moderationCheckedAt: new Date(),
  };
  const shortBase = {
    author: author._id,
    moderationStatus: "approved",
    moderationProvider: "seed",
    moderationCheckedAt: new Date(),
  };

  const result = {
    cars: await seed(MarketCarListing, CARS, { extra: base }),
    parts: await seed(MarketPartListing, PARTS, { extra: base }),
    services: await seed(MarketCarServiceListing, SERVICES, { extra: shortBase }),
    tuning: await seed(MarketAutoTuningListing, TUNING, { extra: shortBase }),
    cleaning: await seed(MarketDryCleaningListing, CLEANING, { extra: shortBase }),
    experts: await seed(MarketConsultationExpert, EXPERTS, { key: "name", extra: shortBase }),
  };

  console.log(JSON.stringify(result));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("seedMarketListings:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
