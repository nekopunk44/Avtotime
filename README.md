# Avtotime

```
// монорепозиторий из четырёх кодовых баз вокруг одного домена
// маркетплейс + соцсеть + тренажёр ПДД
```

Один Express-API обслуживает три клиента: веб-соцсеть на React, отдельный веб-маркет на TypeScript
и мобильное приложение на Expo/React Native.

**398 файлов исходников × 82 264 строки × 129 коммитов × один автор**
Разработка: 01.05.2026 → 15.08.2026. Продакшн-домен `avtotime.org` зашит в клиентах
(`mobile/src/api/client.ts`, `.github/workflows/build.yml`).

`Node 20` · `Express 5` · `MongoDB / Mongoose 9` · `Redis` · `Socket.IO` · `React 19` · `TypeScript` · `Expo SDK 55` · `Docker Compose` · `Nginx`

---

## // скриншоты

> **TODO.** Положить четыре файла в `docs/screens/` под этими именами и снять комментарий с таблицы:
> `web-market.png` (витрина маркета с быстрым поиском), `web-social.png` (лента и сообщения),
> `mobile-social.png`, `mobile-market.png`.

<!--
| Веб-маркет | Веб-соцсеть |
|---|---|
| <img src="docs/screens/web-market.png" width="420"> | <img src="docs/screens/web-social.png" width="420"> |

| Мобильная лента | Мобильный маркет |
|---|---|
| <img src="docs/screens/mobile-social.png" width="220"> | <img src="docs/screens/mobile-market.png" width="220"> |
-->

---

## // что внутри

**Маркетплейс** — 8 типов объявлений (авто, запчасти, автосервисы, тюнинг, химчистка,
консультации экспертов, эко-советы, запросы помощи) + детские активности и игры.
Фильтры, поиск, избранное, сравнение, отзывы, аналитика по объявлению,
выбор локации на карте (`shared/LocationPickerMapModal.tsx`, maplibre + leaflet),
3D-просмотр модели авто (`home/CarModel3D.tsx`, three.js + r3f), модерация с апелляцией.

**Соцсеть** — посты, комментарии, реакции, сторис, короткие видео (loops), подписки,
личные сообщения и уведомления в реальном времени через Socket.IO.

**Тренажёр ПДД** — 339 вопросов, режимы «практика», «экзамен» и «марафон», статистика результатов.

**Платежи** — три тарифа `free / pro / business` через Stripe (PaymentIntents + webhook),
детект региона по IP (`geoip-lite`) в `payment.controllers.js:13`.

**Мобильное** — то же самое плюс биометрический вход (`expo-local-authentication`),
push-уведомления (`expo-notifications`), 7 игр на React Native, видеоплеер `expo-video`.

---

## // из чего состоит

Монорепо **без workspaces** — четыре независимо собираемые части, общий бэкенд.

| Часть | Что это | Стек | Файлов | Строк |
|---|---|---:|---:|---:|
| `Avtotime-1/backend` | REST API + Socket.IO + фоновые воркеры | Node 20, Express 5 (ESM), Mongoose 9, Redis, Stripe | 112 | 15 817 |
| `Avtotime-1/frontend` | SPA соцсети: посты, сторис, короткие видео (loops), чат | React 19, Redux Toolkit, react-router 7, Vite 7, Tailwind 4 | 78 | 9 818 |
| `frontend_market` | SPA маркетплейса — **самая большая часть** | React 19 + **TypeScript 5.8**, Vite 6, Tailwind 4, three.js, maplibre | 95 | **32 459** |
| `mobile` | Клиент под Android/iOS | Expo SDK 55, RN 0.83, **TS strict**, React Navigation 7, Zustand | 112 | 23 901 |

Считаются `.js/.jsx/.ts/.tsx/.mjs` под контролем git, без `node_modules` и `dist`.
Всего в репозитории 1 124 файла (остальное — ассеты, билеты ПДД, конфиги, платформенные каталоги).

### Цифры по частям

```
backend   × 166 маршрутов в 16 роутерах + 3 в index.js
            (Stripe-webhook до express.json, /api/health, GET /)
          × 25 моделей Mongoose, 35 объявленных индексов в 18 моделях
          × 18 контроллеров, 11 middleware, 12 сервисных модулей
          × 5 типов Socket.IO-событий, 55 ключей в .env.example

frontend  × 20 страниц, 8 слайсов Redux Toolkit, авторизация по httpOnly-cookie

market    × 28 страниц, 70 .tsx, свой API-слой marketAPI.ts на 845 строк
          × 24 игры на React/Canvas/SVG (9 174 строки) — шахматы, шашки,
            солитёр, судоку, тетрис, сапёр, 2048, арканоид, понг и др.

mobile    × 56 экранов, 20 модулей API-клиента, 3 стора Zustand
          × 7 игр портированы на RN, биометрия, push через Expo/FCM
          × Bearer-токен в SecureStore, EAS-профили dev / preview / production
```

---

## // архитектура

```
   web-соцсеть        web-маркет          mobile (Expo)
   React 19 / RTK     React 19 / TS       RN 0.83 / Zustand
   cookie httpOnly    cookie httpOnly     Bearer + SecureStore
        │                  │                    │
        └──────────────────┼────────────────────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │    nginx    │  TLS, limit_req, gzip, статика
                    └──────┬──────┘
                           │ upstream backend
        ┌──────────────────▼──────────────────┐
        │  Express 5  ·  node:cluster         │
        │  routes → controllers → models      │
        │  Socket.IO в том же процессе        │
        │  worker#1: модерация + план-крон    │
        └───┬───────┬───────┬────────┬────────┘
            │       │       │        │
        MongoDB   Redis   Stripe  Cloudinary
                    │
              ├ @socket.io/redis-adapter (сокеты между репликами)
              └ shared-клиент для кэша
```

**Backend** — `routes → controllers → models`, префикс `/api`.
HTTP-сервер и Socket.IO поднимаются в одном процессе (`socket.js` экспортирует `app/server/io`),
`cluster.js` форкает воркеров по `availableParallelism()`.
Фоновые задачи (модерация объявлений, крон истечения тарифов) стартуют **только на воркере id=1** —
чтобы N процессов не долбили одну и ту же коллекцию (`index.js:149`).

Presence онлайн-пользователей живёт в `Map` в памяти процесса, межинстансная доставка событий —
через Redis-адаптер Socket.IO. Хендшейк сокета проверяет JWT из cookie или заголовка `Authorization`,
клиент кладётся в комнату по `userId` (`socket.js:65-96`).

---

## // что здесь инженерно интересного

### 1. Очередь асинхронной модерации с атомарным захватом задач

`Avtotime-1/backend/moderation/marketModerationWorker.js` — 306 строк.

Объявление публикуется сразу, проверка идёт фоном. Задачи забираются атомарно, чтобы
несколько воркеров кластера не взяли один документ:

```js
const canClaimFilter = () => ({
  moderationStatus: "pending",
  $or: [
    { moderationLock: { $exists: false } },
    { moderationLock: null },
    { moderationLock: { $lte: new Date(Date.now() - 5 * 60 * 1000) } },
  ],
});

const claimOne = async (model, extraFilter = {}) =>
  model.findOneAndUpdate(
    { ...canClaimFilter(), ...extraFilter },
    { $set: { moderationLock: now() }, $inc: { moderationAttempts: 1 } },
    { sort: { createdAt: 1 }, new: true },
  );
```

× Лок протухает через 5 минут — упавший воркер не подвешивает документ навсегда.
× `moderationAttempts` растёт при каждом захвате; при заданном `AI_MODERATION_MAX_ATTEMPTS`
  `handleMaxAttempts` закрывает задачу настраиваемым действием `approve`/`reject`,
  а не крутит её вечно.
× Ошибка не теряется: `releaseLockWithError` пишет текст в `moderationLastError` и снимает лок.
× `MODEL_CONFIGS` описывает **8 коллекций объявлений** (cars, parts, car-services, auto-tuning,
  consultations, dry-cleaning, eco-tips, help-requests) — у каждой свой `buildInput`,
  собирающий текст и список картинок из разных полей.
× Тик раз в 15 с, батч по 5 на модель; `enqueueMarketModerationById` через `setImmediate`
  проверяет только что созданное объявление, не дожидаясь тика.
× При `rejected` автору уходит уведомление с причинами.

### 2. Двухпровайдерная AI-модерация с офлайн-фолбэком

`services/aiModeration.js` (157 строк) + `services/localModeration.js` (265 строк).

Провайдер выбирается явно (`AI_MODERATION_PROVIDER`) или автоматически: есть `OPENAI_API_KEY` →
`omni-moderation-latest`, нет → полностью локальный путь.

Локальный путь: ленивая загрузка `@tensorflow/tfjs-node`, при падении нативного бинаря —
фолбэк на чистый `@tensorflow/tfjs` + декодер `sharp`. Модель `nsfwjs` лежит рядом
(`moderation/models/nsfwjs`, качается `npm run download:nsfw-model`). Плюс текстовые эвристики:
ссылки, телефоны (7+ цифр с любыми разделителями), банворды из env.
Картинки грузятся через `fetch` с `AbortController`-таймаутом, поддержан разбор `data:`-URL.

Все ML-пакеты — в `optionalDependencies`: бэкенд ставится и работает без них,
модерация просто выключается флагом `AI_MODERATION_ENABLED`.

### 3. Двухуровневый кэш ответов

`services/responseCache.js` (110 строк), `services/marketListCache.js` (112 строк).

Уровень 1 — LRU на `Map` в памяти процесса, O(1) на порядке вставки:

```js
set(key, value) {
  if (this.map.has(key)) this.map.delete(key);
  else if (this.map.size >= this.maxSize) this.map.delete(this.map.keys().next().value);
  this.map.set(key, value);
}
```

Уровень 2 — Redis, общий на все реплики (`EX` в секундах против TTL в мс локально).
Инвалидация по префиксу идёт через `scanIterator({ MATCH: pattern, COUNT: 100 })` с батчевым `DEL` —
не `KEYS *`, который блокирует Redis. Любая ошибка Redis проглатывается: локального кэша достаточно,
запрос не падает.

### 4. Идемпотентная активация тарифа по двум каналам

`controllers/payment.controllers.js` — активировать план могут **два независимых пути**:
клиентский `confirmPayment` и Stripe-webhook при ретраях. Оба используют один приём — CAS через
`findOneAndUpdate` с фильтром по статусу:

```js
// клиентский confirm
Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: 'succeeded' } }, ...)

// webhook (комментарий в коде: idempotency on Stripe webhook retries)
Payment.findOneAndUpdate({ stripePaymentIntentId: pi.id, status: { $ne: 'succeeded' } }, ...)
```

Кто не выиграл гонку — получает `null` и просто возвращает текущее состояние плана, а не вторую подписку.

Сопутствующее:
× Сырое тело для вебхука смонтировано **до** `express.json()` (`index.js:67`), иначе подпись не сойдётся.
× Подпись проверяется через `stripe.webhooks.constructEvent`.
× `pi.metadata.userId` сверяется с `req.userId` — чужой PaymentIntent не подтвердить.
× После активации `applyUserPlanToListings` перекладывает лимиты нового плана на уже созданные объявления.
× События пишутся в JSON-аудит-лог.

### 5. Тарифы, пронизывающие всю выдачу

`config/planLimits.js` — три плана (`free` / `pro` / `business`), и это не бейджик, а параметры выдачи:
количество объявлений, число фото, длина описания, срок жизни объявления, приоритет в каталоге,
видимость телефона, аналитика, видео.

× `serializePlanLimits` явно превращает `Infinity` в `null`: `JSON.stringify` сделал бы это молча,
  здесь контракт API зафиксирован в коде, а не в поведении рантайма.
× `getEffectivePlan(plan, planExpiresAt)` вычисляет план на лету и возвращает `free`, если срок вышел.
  Выдача корректна даже если крон не отработал — просрочка не требует записи в БД.
× `middlewars/checkPlanLimits.js` режет на входе, `services/planExpirationCron.js` (173 строки)
  досрочно предупреждает о конце срока (`planExpiryWarnedThreshold`).

### 6. Готовность к горизонтальному масштабированию

× `cluster.js` — форк по числу ядер, авто-респавн по `exit`.
× `config/redis.js` — `initializeSocketRedisAdapter` с pub/sub-клиентами и мемоизацией промиса.
× `index.js` — `keepAliveTimeout 65s` / `headersTimeout 70s` (правильные значения под reverse proxy),
  `SIGTERM`/`SIGINT` → `server.close()` с дренажом и форс-выходом через 30 с.
× `Avtotime-1/SCALE_GUIDE.md` описывает `docker compose up --scale backend=4`.

### 7. Шифрование чувствительных полей на стороне приложения

`services/crypto/fieldEncryption.js` — AES-256-GCM, формат `enc:v1:<iv>:<tag>:<ciphertext>`.
Версионированный префикс оставляет дверь для ротации схемы. Ключ парсится из base64 / hex / utf8
с обязательной проверкой ровно на 32 байта. Повторное шифрование уже зашифрованной строки — no-op,
так что бэкфилл идемпотентен. В production включается автоматически при наличии `APP_ENC_KEY`.

### 8. Многоуровневый резолв картинок к вопросам ПДД

`controllers/drivingCourse.controllers.js:18-64` — локальный диск (перебор шаблонов имён
`question{N}` / `{N}` × 4 расширений) → детерминированный URL Cloudinary
`driving-questions/ticket{N}_q{M}.webp` → без картинки. Сами вопросы тоже с фолбэком:
`services/drivingQuestionFallback.js` подставляет их из JSON, если коллекция пуста.
Для неавторизованной выдачи `correctAnswerNumber` и `explanation` вырезаются на сервере.

База: **339 вопросов** в `all_tickets_parsed.json`, распарсенных собственным
`scripts/parse_tickets.js` (269 строк) из исходного текста билетов.

### 9. Свой письменный аудит мобильного приложения

`docs/mobile-audit.md` — 20 разделов, 21 пронумерованный дефект и 60+ пунктов списком,
с приоритетами (🔴/🟠) и ссылками вида `MarketScreen.tsx:83`. Главный вывод написан честно:
«самая серьёзная проблема — не визуал, а то, что экран фильтров по большей части не работает».

Документ закоммичен **до** правок и по времени видно, что он работал как чеклист:
`3d26458` и `7287160` (аудит, 09:16 и 09:22) → `069585c` `85de756` `7ef85e6` (09:31–09:34)
→ `196a558` (09:38) → `4d13d50` (12:04).

---

## // безопасность

| Механизм | Где |
|---|---|
| helmet с кастомным CSP | `index.js:52` |
| Два rate-лимитера: общий на `/api`, жёсткий на авторизацию | `middlewars/rateLimiters.js`, `index.js:82` |
| `express-mongo-sanitize` + `hpp` | `index.js:75-76` |
| Проверка Origin для мутирующих запросов | `middlewars/csrfOrigin.js` |
| JWT-хендшейк Socket.IO (cookie или Bearer) | `socket.js:65-96` |
| AES-256-GCM для полей | `services/crypto/fieldEncryption.js` |
| Отказ стартовать без `JWT_SECRET` | `index.js:132` |
| Лимиты тела запроса (`2mb` по умолчанию), `client_max_body_size 10m` в nginx | `index.js:69`, `nginx/nginx.conf:18` |

---

## // инфраструктура и деплой

**`Avtotime-1/docker-compose.yml` — 5 сервисов:**

| Сервис | Образ | Роль |
|---|---|---|
| `mongodb` | `mongo:7-jammy` | БД, том `mongo_data`, наружу не торчит (`expose`) |
| `redis` | `redis:7-alpine` | кэш + адаптер сокетов, AOF + snapshot |
| `backend` | сборка из `./backend/Dockerfile` | API, `expose 8000`, том `uploads` |
| `nginx` | `nginx:1.27-alpine` | единственный сервис с портами 80/443 |
| `certbot` | `certbot/certbot` | `certbot renew` в цикле каждые 12 ч |

**Nginx** (`Avtotime-1/nginx/nginx.conf`, 126 строк):
× TLS, редирект 80 → 443, ACME-челлендж на 80;
× две зоны `limit_req`: `api` 10 r/s (burst 30) и `auth` 1 r/s (burst 5) отдельно
  на `signin|signup|sendOtp`;
× отдельный `location /socket.io/` с upgrade-заголовками;
× gzip, `immutable`-кэш для статики, `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
× раздаёт собранный `./frontend/dist` и том `uploads`.

**CI — 2 workflow GitHub Actions:**

| Workflow | Триггер | Что делает |
|---|---|---|
| `build.yml` | push / PR в `main` | ставит зависимости обоих вебов, собирает соцсеть, `node --check index.js` на бэкенде |
| `deploy-backend.yml` | push в `Avtotime-1/backend/**` + ручной запуск | `rsync` по SSH на сервер, затем `docker compose up -d --build backend` |

У деплоя есть `concurrency: deploy-backend` — два деплоя одновременно не пойдут.
`rsync` идёт с `--omit-dir-times --no-perms`, потому что deploy-пользователь имеет ACL на проект,
но не владеет root-созданными файлами (объяснение прямо в workflow).

Мобильное собирается через **EAS**: профили `development` (dev-client, APK),
`preview` (internal APK), `production` (app-bundle, `autoIncrement`).

---

## // запуск локально

```bash
git clone https://github.com/nekopunk44/Avtotime.git && cd Avtotime
```

**1. Backend** — `http://localhost:8000`

```bash
cd Avtotime-1/backend
cp .env.example .env      # 55 ключей; минимум — MONGODB_URL и JWT_SECRET
npm install
npm run dev
```

Без установленной Mongo можно поднять API на `mongodb-memory-server`: выставьте `MONGO_IN_MEMORY=true`
либо пустой `MONGODB_URL` (`config/db.js:137-150`). Без `JWT_SECRET` процесс осознанно откажется стартовать.

**2. Веб-соцсеть** — Vite dev-сервер, `/api` проксируется на `localhost:8000`

```bash
cd Avtotime-1/frontend
npm install && npm run dev
npm run lint     # eslint
```

**3. Веб-маркет** — `http://localhost:5173`

```bash
cd frontend_market
npm install && npm run dev
npm run lint     # tsc --noEmit
```

**4. Мобильное**

```bash
cd mobile
npm install
npx expo start          # или npm run android / npm run ios
```

По умолчанию клиент смотрит на прод — правьте базовый URL в `mobile/src/api/client.ts`.

**Опционально** (всё из `Avtotime-1/backend`):

```bash
npm run download:nsfw-model   # локальная NSFW-модель для офлайн-модерации
npm run upload:all-tickets    # залить 339 вопросов ПДД в Mongo
npm run smoke:market-filter   # smoke по живому API
npm run load:test             # autocannon: 100 соединений / 20 с по /api/market/cars
```

---

## // окружение

`Avtotime-1/backend/.env.example` — 55 ключей. Группы:

```
база / сеть      MONGODB_URL(_FILE), MONGO_MAX_POOL_SIZE, MONGO_MIN_POOL_SIZE,
                 PORT, NODE_ENV, CLIENT_ORIGINS, CLIENT_URL
redis / кэш      REDIS_URL, REDIS_SOCKET_ADAPTER_ENABLED,
                 RESPONSE_CACHE_TTL_MS/_MAX_ENTRIES,
                 MARKET_LIST_CACHE_TTL_MS/_MAX_ENTRIES, AUTH_CACHE_TTL_SECONDS
безопасность     JWT_SECRET(_FILE), JWT_EXPIRES_IN, COOKIE_SAMESITE, COOKIE_SECURE,
                 APP_ENC_KEY(_FILE), FIELD_ENCRYPTION_ENABLED
внешние сервисы  STRIPE_SECRET_KEY / _PUBLISHABLE_KEY / _WEBHOOK_SECRET,
                 CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET,
                 GOOGLE_CLIENT_ID, EMAIL, EMAIL_PASS
модерация (20)   AI_MODERATION_ENABLED, AI_MODERATION_PROVIDER, OPENAI_API_KEY,
                 OPENAI_MODERATION_MODEL, AI_MODERATION_WORKER_INTERVAL_MS,
                 AI_MODERATION_BATCH_PER_MODEL, AI_MODERATION_MAX_ATTEMPTS(_ACTION),
                 AI_MODERATION_NSFW_*_THRESHOLD, AI_MODERATION_BANNED_WORDS …
dev              MONGO_MEMORY_PERSIST / _DB_PATH / _PORT
```

Секреты умеют читаться из файла (`*_FILE`) — под docker secrets.
Не в `.env.example`, но читаются кодом: `CLUSTER_WORKERS` (`cluster.js`),
`TRUST_PROXY`, `MONGO_IN_MEMORY`, `JSON_BODY_LIMIT`. Продакшн-набор — `.env.production.example`.

---

## // статус

Проект работает и задеплоен, но это pet-проект одного человека, а не продукт с командой.
Честно о слабых местах:

× **Автотестов нет — ни unit, ни интеграционных.** Есть три скрипта:
  `scripts/market_filter_smoke_test.mjs` и `scripts/market_create_and_filter_smoke_test.mjs`
  (smoke по живому API) и `scripts/load/run_load_test.mjs` — autocannon, 100 соединений / 20 с
  по `/api/market/cars`. Это не замена тестам, и я это не выдаю за покрытие.
× **CI не проверяет корректность.** `build.yml` — это сборка фронта и `node --check` на бэкенде,
  то есть проверка синтаксиса. Линтера на бэкенде нет.
× **Деплоем покрыт только бэкенд.** Фронты и мобильное катятся руками / через EAS.
× **Модерация по умолчанию выключена**: в `.env.example` стоит `AI_MODERATION_ENABLED=false`.
  Код готов, но в дефолтной конфигурации не работает.
× Хвост истории коммитов — почти целиком UI-полировка мобильного приложения;
  оно новее остальных частей и обкатано меньше.

Что сделано осознанно и работает:
кластеризация, graceful shutdown, Redis-адаптер сокетов, идемпотентные платежи,
двухуровневый кэш, rate limiting на двух уровнях (nginx + Express), собственный аудит с исправлениями.

---

## // документация в репозитории

| Файл | О чём |
|---|---|
| `Avtotime-1/README.md` | детали по бэкенду и веб-соцсети |
| `Avtotime-1/DEPLOY.md` | развёртывание на сервер, TLS, certbot |
| `Avtotime-1/SCALE_GUIDE.md` | масштабирование до N реплик |
| `INFRASTRUCTURE.md` | обзор инфраструктуры |
| `docs/mobile-audit.md` | аудит мобильного приложения на 40+ пунктов |
| `Avtotime-1/PRIVACY_POLICY.md` | политика конфиденциальности |

---

## // лицензия

[MIT](LICENSE)

```
// Владислав Бредихин · github.com/nekopunk44
```
