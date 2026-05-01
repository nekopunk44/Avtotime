# Avtotime

Социальная платформа для автомобилистов: маркетплейс объявлений, подготовка к ПДД и живое общение.

## Возможности

- **Маркетплейс** — публикация и поиск объявлений о продаже автомобилей с фильтрами
- **Социальная сеть** — посты, комментарии, реакции, истории, подписки, личные сообщения
- **Подготовка к ПДД** — база вопросов, режимы практики / экзамена / марафона, статистика
- **Реальное время** — чат и уведомления через Socket.IO
- **Платежи** — подписки и планы размещения через Stripe
- **AI-модерация** — автоматическая проверка текста и изображений (NSFW)
- **Email** — верификация почты, сброс пароля по OTP

## Стек

| Слой | Технологии |
|---|---|
| Backend | Node.js 20+, Express 5, MongoDB, Redis, Socket.IO |
| Frontend | React 19, Redux Toolkit, Vite, Tailwind CSS 4 |
| Деплой | Docker Compose, Nginx, Let's Encrypt (Certbot) |
| Сервисы | Cloudinary, Stripe, Gmail (SMTP) |

## Быстрый старт (разработка)

### Требования

- Node.js >= 20
- npm >= 10

### Backend

```bash
cd backend
cp .env.example .env        # заполни нужные переменные
npm install
npm run dev
```

> Без `MONGODB_URL` бэкенд автоматически поднимает `mongodb-memory-server`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Фронтенд запустится на `http://localhost:5173`, бэкенд — на `http://localhost:8000`.

### Тестовый пользователь (опционально)

```bash
cd backend
npm run seed:dev-user
```

Параметры управляются через переменные окружения `DEV_SEED_USERNAME`, `DEV_SEED_EMAIL`, `DEV_SEED_PASSWORD`.

## Деплой на сервер

Полная инструкция — в [DEPLOY.md](DEPLOY.md).

Краткий порядок:

```bash
# 1. Клонируй репозиторий на сервер
# 2. Скопируй и заполни переменные окружения
cp .env.production.example .env.production

# 3. Собери фронтенд
cd frontend && npm ci && npm run build && cd ..

# 4. Получи SSL-сертификат и запусти
bash scripts/init-ssl.sh yourdomain.com your@email.com
docker compose up -d
```

## Переменные окружения

| Файл | Назначение |
|---|---|
| `backend/.env.example` | Все переменные бэкенда с описанием |
| `.env.production.example` | Шаблон для production-деплоя |

Скопируй нужный файл, убери суффикс `.example` и заполни значения.

## Масштабирование

Горизонтальное масштабирование (несколько инстансов бэкенда + Redis) описано в [SCALE_GUIDE.md](SCALE_GUIDE.md).

## Лицензия

[ISC](https://opensource.org/licenses/ISC)
