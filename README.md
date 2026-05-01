# Avtotime

Социальная платформа для автомобилистов: маркетплейс объявлений, подготовка к экзамену ПДД и живое общение в реальном времени.

## Структура проекта

```
Avtotime/
├── Avtotime-1/          # Основное приложение (backend + frontend + docker)
└── frontend_market/     # Маркетплейс (отдельный фронтенд)
```

## Стек

**Backend** — Node.js 20, Express 5, MongoDB, Redis, Socket.IO  
**Frontend** — React 19, Redux Toolkit, Vite, Tailwind CSS 4  
**Деплой** — Docker Compose, Nginx, Let's Encrypt

## Возможности

- Маркетплейс объявлений о продаже автомобилей
- Социальная сеть: посты, истории, чат в реальном времени
- Подготовка к ПДД: вопросы, практика, экзамен, марафон
- Платежи через Stripe, загрузка изображений через Cloudinary
- AI-модерация контента (NSFW)

## Быстрый старт

```bash
cd Avtotime-1/backend
cp .env.example .env
npm install && npm run dev
```

```bash
cd Avtotime-1/frontend
npm install && npm run dev
```

Подробная инструкция — в [Avtotime-1/README.md](Avtotime-1/README.md)  
Деплой на сервер — в [Avtotime-1/DEPLOY.md](Avtotime-1/DEPLOY.md)
