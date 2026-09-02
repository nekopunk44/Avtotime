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
  (контейнер nginx сам перечитывает их раз в 6 ч, поэтому продлённый сертификат
  подхватывается без ручного перезапуска)

---

## ⚠️ Что автодеплой НЕ обновляет

CI синхронизирует только каталог `Avtotime-1/backend/`. Файлы ниже живут на
сервере отдельно и меняются **вручную** — сознательно, чтобы правка инфраструктуры
не уезжала в прод вместе с обычным коммитом кода:

| Файл в репозитории | Куда на сервере | Чем применяется |
|---|---|---|
| `Avtotime-1/docker-compose.yml` | `/root/avtotime/docker-compose.yml` | `docker compose up -d` (пересоздаст затронутые сервисы) |
| `Avtotime-1/nginx/nginx.conf` | `/root/avtotime/nginx/nginx.conf` | `docker compose up -d --force-recreate nginx` |
| `Avtotime-1/scripts/backup.sh` | `/root/avtotime/scripts/backup.sh` | вручную + строка в cron |
| `.env.production` | `/root/avtotime/.env.production` | только вручную, в git его нет |

Порядок применения новых лимитов и healthcheck'ов (делать **после** первого
успешного бэкапа, потому что mongodb будет пересоздан):

```bash
scp Avtotime-1/docker-compose.yml root@<host>:/root/avtotime/
scp Avtotime-1/nginx/nginx.conf   root@<host>:/root/avtotime/nginx/
scp Avtotime-1/scripts/backup.sh  root@<host>:/root/avtotime/scripts/
ssh root@<host> 'cd /root/avtotime && ./scripts/backup.sh && docker compose up -d && docker compose ps'
```

---

## Лимиты ресурсов

Сервер рассчитан на 2 ГБ RAM, лимиты проставлены в `docker-compose.yml`:

| Сервис | `mem_limit` | Дополнительно |
|---|---|---|
| mongodb | 700 MB | `--wiredTigerCacheSizeGB 0.4` — иначе mongod считает кэш от памяти хоста |
| redis | 200 MB | `--maxmemory 150mb --maxmemory-policy allkeys-lru` |
| backend | 800 MB | `NODE_OPTIONS=--max-old-space-size=350`, `CLUSTER_WORKERS=2` |
| nginx | 128 MB | — |

Логи всех контейнеров ограничены (`json-file`, 10 MB × 3 файла на сервис) —
без этого access_log nginx забивал диск.

Проверить фактическое потребление: `docker stats --no-stream`.

---

## Бэкапы

Настраиваются отдельно и **обязательны** — см. [BACKUP.md](BACKUP.md).

Коротко:

```bash
chmod +x scripts/backup.sh
docker pull alpine:3.20
./scripts/backup.sh                     # пробный прогон

crontab -e
# 20 3 * * * HEALTHCHECK_URL=https://hc-ping.com/<uuid> /root/avtotime/scripts/backup.sh >> /var/log/avtotime-backup.log 2>&1
```

`HEALTHCHECK_URL` (dead-man's switch на healthchecks.io) — не опция: без него
о сломанном cron станет известно только при попытке восстановиться.
Инструкция по восстановлению базы и файлов — там же, в `BACKUP.md`.
