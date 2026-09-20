/**
 * Показательные публикации и вертикальные ролики: лента и Loops открывались
 * пустыми, и посмотреть на вёрстку карточек было не на чем.
 *
 * Запуск: node scripts/seedFeed.js
 *
 * Идемпотентен: запись узнаётся по подписи, повторный запуск ничего не
 * удваивает. Автор — витринная учётная запись avtotime_demo (её заводит
 * seedMarketListings.js) и «Клуб Avtotime» для второго голоса в комментариях:
 * разговор с самим собой выглядит подделкой.
 *
 * Ролики сделаны из тех же фотографий: горизонтальный кадр обрамляется
 * размытой заливкой до 9:16 и медленно наезжает — иначе снимок пришлось бы
 * жёстко резать. Команда, которой они собраны (ffmpeg в разовом контейнере,
 * тома с загрузками смонтированы):
 *
 *   docker run --rm -v avtotime_uploads:/w -w /w linuxserver/ffmpeg \
 *     -y -loop 1 -i seed-post-road.jpg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
 *     -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:4,setsar=1[bg];\
 *                      [0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,\
 *                      zoompan=z='min(zoom+0.0006,1.12)':d=225:s=1080x1920:fps=25,format=yuv420p[v]" \
 *     -map "[v]" -map 1:a -t 9 -c:v libx264 -preset veryfast -crf 25 -c:a aac -b:a 64k \
 *     -shortest -movflags +faststart seed-loop-road.mp4
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Loop from "../models/loop.model.js";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

// Медиа лежит на нашем домене: внешние ссылки в данных живут ровно до того
// дня, когда чужой хостинг их уберёт.
const BASE = process.env.PUBLIC_ASSET_BASE || "https://avtotime.org/api/public";

const buildPosts = (demoId, clubId) => [
  {
    caption:
      "Утренний выезд в горы: пустая дорога, прохладный воздух и полный бак. Лучшее время, чтобы проверить машину перед сезоном.",
    mediaType: "image",
    media: `${BASE}/seed-post-road.jpg`,
    mediaList: [`${BASE}/seed-post-road.jpg`, `${BASE}/seed-post-classic.jpg`],
    author: demoId,
    likes: [clubId],
    comments: [{ author: clubId, message: "Где это снято? Отличный серпантин" }],
  },
  {
    caption:
      "Подняли на подъёмник перед продажей: проверили подвеску, тормоза и следы сварки. Такой отчёт прикладываем к каждому объявлению.",
    mediaType: "image",
    media: `${BASE}/seed-service-lift.jpg`,
    mediaList: [],
    author: demoId,
    likes: [clubId],
    comments: [
      { author: clubId, message: "Полезно. Сколько стоит такая проверка?" },
      { author: demoId, message: "Для наших объявлений — бесплатно, для остальных 40 €" },
    ],
  },
  {
    caption:
      "Три кадра одной машины: снаружи, сбоку и салон. По опыту — объявления с несколькими фото открывают вдвое чаще.",
    mediaType: "image",
    media: `${BASE}/seed-car-x5blue-1.jpg`,
    mediaList: [
      `${BASE}/seed-car-x5blue-1.jpg`,
      `${BASE}/seed-car-x5blue-2.jpg`,
      `${BASE}/seed-car-x5blue-3.jpg`,
    ],
    author: demoId,
    likes: [],
    comments: [{ author: clubId, message: "Синий цвет отлично вышел на солнце" }],
  },
  {
    caption:
      "Зима близко: проверьте протектор и давление заранее. Резину меняем при устойчивых +7 и ниже, а не по первому снегу.",
    mediaType: "image",
    media: `${BASE}/seed-post-winter.jpg`,
    mediaList: [],
    author: clubId,
    likes: [demoId],
    comments: [{ author: demoId, message: "И проверьте аккумулятор — на морозе он сдаётся первым" }],
  },
];

const buildLoops = (demoId, clubId) => [
  {
    caption: "Дорога в горы на рассвете 🏔️ #поездка",
    media: `${BASE}/seed-loop-road.mp4`,
    author: demoId,
    likes: [clubId],
    comments: [{ author: clubId, message: "Красота! Какой перевал?" }],
  },
  {
    caption: "BMW X5 xDrive40i перед выдачей клиенту",
    media: `${BASE}/seed-loop-x5.mp4`,
    author: demoId,
    likes: [clubId],
    comments: [{ author: clubId, message: "Такой же ищу, но в чёрном" }],
  },
  {
    caption: "Мойка перед фотосъёмкой объявления 🚿",
    media: `${BASE}/seed-loop-wash.mp4`,
    author: clubId,
    likes: [demoId],
    comments: [{ author: demoId, message: "Чистая машина продаётся быстрее — проверено" }],
  },
];

const ensureClub = async () => {
  const existing = await User.findOne({ userName: "avtotime_club" }).select("_id").lean();
  if (existing) return existing._id;

  // Пароль случайный и никому не выдаётся: учётная запись существует ради
  // авторства, входить в неё незачем.
  const created = await User.create({
    name: "Клуб Avtotime",
    userName: "avtotime_club",
    email: "club@avtotime.org",
    password: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
    isEmailVerified: true,
    bio: "Сообщество водителей Avtotime: поездки, разбор машин и советы.",
  });
  console.log("создан пользователь avtotime_club");
  return created._id;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGODB_URI);

  const demo = await User.findOne({ userName: "avtotime_demo" }).select("_id").lean();
  if (!demo) throw new Error("нет учётной записи avtotime_demo — сперва запустите seedMarketListings.js");
  const clubId = await ensureClub();

  for (const post of buildPosts(demo._id, clubId)) {
    const exists = await Post.findOne({ caption: post.caption }).select("_id").lean();
    if (exists) {
      console.log("уже есть пост:", post.caption.slice(0, 40));
      continue;
    }
    await Post.create(post);
    console.log("создан пост:", post.caption.slice(0, 40));
  }

  for (const loop of buildLoops(demo._id, clubId)) {
    const exists = await Loop.findOne({ caption: loop.caption }).select("_id").lean();
    if (exists) {
      console.log("уже есть ролик:", loop.caption.slice(0, 40));
      continue;
    }
    await Loop.create(loop);
    console.log("создан ролик:", loop.caption.slice(0, 40));
  }

  console.log("постов всего:", await Post.countDocuments(), "| роликов:", await Loop.countDocuments());
  await mongoose.disconnect();
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ошибка:", error.message);
    process.exit(1);
  });
