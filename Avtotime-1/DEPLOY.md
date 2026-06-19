# Деплой Avtotime

## Что нужно до начала

- VPS с Ubuntu 22.04 (минимум 1 GB RAM, рекомендуется 2 GB)
- Домен, DNS-запись A которого указывает на IP сервера
- Аккаунт на [Cloudinary](https://cloudinary.com) (бесплатный тариф)
- Gmail-аккаунт с App Password (для сброса пароля пользователей)

---

## Шаг 1 — Установить Docker на сервере

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Проверить:
```bash
docker --version
docker compose version
```

---

## Шаг 2 — Загрузить файлы проекта на сервер

```bash
# Вариант A: через git
git clone <url-репозитория> avtotime
cd avtotime

# Вариант B: через scp (с локального компьютера)
scp -r ./Avtotime-1 user@your-server-ip:~/avtotime
```

---

## Шаг 3 — Заполнить настройки

```bash
nano .env.production
```

Обязательно заполнить:

| Переменная | Что указать |
|---|---|
| `CLIENT_ORIGINS` | `https://yourdomain.com` |
| `JWT_SECRET` | Результат команды ниже |
| `EMAIL` + `EMAIL_PASS` | Gmail + App Password |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Из Cloudinary Dashboard |
| `ADMIN_USERNAMES` | Username первого администратора |

Сгенерировать JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Шаг 4 — Запустить

```bash
bash scripts/init-ssl.sh yourdomain.com your@email.com
```

Скрипт автоматически:
1. Получает SSL-сертификат от Let's Encrypt
2. Запускает все сервисы (база данных, backend, nginx)

После этого сайт доступен по `https://yourdomain.com`.

---

## Обновление проекта

```bash
git pull

# Пересобрать фронтенд после изменений в frontend_market
DOMAIN=yourdomain.com   # укажи свой домен

FRONTEND_SRC=""
[ -d "../frontend_market" ] && FRONTEND_SRC="../frontend_market"
[ -d "../../frontend_market" ] && FRONTEND_SRC="../../frontend_market"

docker build -t avtotime-frontend-builder \
  --build-arg VITE_API_URL="https://$DOMAIN" \
  "$FRONTEND_SRC"
docker rm frontend-extract 2>/dev/null || true
docker create --name frontend-extract avtotime-frontend-builder
docker cp frontend-extract:/app/dist/. ./frontend/dist/
docker rm frontend-extract

# Перезапустить backend (если менялся backend/)
docker compose up -d --build backend
```

---

## Полезные команды

```bash
# Статус сервисов
docker compose ps

# Логи backend
docker compose logs -f backend

# Логи nginx
docker compose logs -f nginx

# Перезапуск одного сервиса
docker compose restart backend

# Остановить всё
docker compose down
```

---

## Структура данных

- База данных хранится в Docker volume `mongo_data` — не удаляется при перезапуске
- Загруженные пользователями файлы — в volume `uploads`
- SSL-сертификаты — в volume `letsencrypt`, обновляются автоматически каждые 12 ч
