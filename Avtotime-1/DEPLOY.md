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
| `Avtotime-1/nginx/nginx.conf` | `/root/avtotime/nginx/nginx.conf` | `docker compose up -d --no-deps --force-recreate nginx` (без `--no-deps` пересоздаётся и база: nginx зависит от backend, а тот от mongodb/redis) |
| `Avtotime-1/scripts/backup.sh` | `/root/avtotime/scripts/backup.sh` | вручную + строка в cron |
| `.env.production` | `/root/avtotime/.env.production` | только вручную, в git его нет |

**Применено 3 сентября 2026.** Все пять контейнеров пересозданы, mongodb, redis и
backend поднимают healthcheck, сертификат на месте, лог mongodb сократился с
2.1 ГБ до сотен килобайт. Предыдущие версии лежат рядом как `docker-compose.yml.prev`
и `nginx/nginx.conf.prev`.

Порядок ниже — для следующего раза. Перед выкладкой файл стоит залить под именем
`*.new` и проверить **на сервере**, не подменяя рабочий: `docker compose -f
docker-compose.yml.new config -q`, а nginx — в одноразовом контейнере, смонтировав
настоящий том с сертификатами:

```bash
docker run --rm -v /root/avtotime/nginx/nginx.conf.new:/etc/nginx/nginx.conf:ro   -v avtotime_letsencrypt:/etc/letsencrypt:ro -v avtotime_certbot_www:/var/www/certbot:ro   -v /root/avtotime/frontend/dist:/var/www/frontend:ro -v avtotime_uploads:/var/www/uploads:ro   nginx:1.27-alpine nginx -t
```

> **Сначала бэкап.** `docker compose up -d` пересоздаёт mongodb, если у него менялись
> `command`, `mem_limit`, `healthcheck` или `logging`.

```bash
ssh root@89.167.85.110 'set -e
  cd /root/avtotime
  ./scripts/backup.sh                       # см. установку ниже
  cp docker-compose.yml docker-compose.yml.prev
  cp nginx/nginx.conf   nginx/nginx.conf.prev
  mv docker-compose.yml.new docker-compose.yml
  mv nginx/nginx.conf.new   nginx/nginx.conf
  docker compose up -d
  docker compose ps'
```

Проверить снаружи: `curl -sf https://avtotime.org/api/health && curl -sfo /dev/null -w '%{http_code}
' https://avtotime.org/`

Откат (одна команда, старые файлы лежат рядом):

```bash
ssh root@89.167.85.110 'cd /root/avtotime
  mv docker-compose.yml.prev docker-compose.yml
  mv nginx/nginx.conf.prev   nginx/nginx.conf
  docker compose up -d --force-recreate'
```

Простой при применении — порядка минуты: mongodb поднимается заново, а backend
ждёт его healthcheck (`start_period: 40s`).

### Установка бэкапа

```bash
ssh root@89.167.85.110 'set -e
  cd /root/avtotime
  mv scripts/backup.sh.new scripts/backup.sh && chmod +x scripts/backup.sh
  ./scripts/backup.sh
  ( crontab -l 2>/dev/null || true; echo "20 3 * * * /root/avtotime/scripts/backup.sh >> /var/log/avtotime-backup.log 2>&1" ) | crontab -
  crontab -l'
```

`|| true` обязателен: при пустом crontab `crontab -l` завершается ненулевым
кодом, и под `set -e` подоболочка умирает раньше `echo` — строка молча не
ставится, а остальная цепочка обрывается.

Скрипт проверен на этом сервере в урезанном окружении (`env -i PATH=/usr/bin:/bin`),
как его запустит cron: дамп базы и архив uploads на 362 МБ снимаются за ~35 секунд.
Отдельно проверено, что бэкап несуществующей базы **отклоняется** с кодом 1, а не
кладёт на диск правдоподобный пустой архив.

---

## Лимиты ресурсов

Машина: **4 CPU, 7.7 ГБ RAM**, диск 75 ГБ (36 ГБ свободно). Суммарное потребление
всех контейнеров в покое — около 350 МБ, так что лимиты ниже задают потолок, а не
режут по живому:

| Сервис | `mem_limit` | Дополнительно |
|---|---|---|
| mongodb | 2 GB | `--wiredTigerCacheSizeGB 1.0` — иначе mongod считает кэш от памяти **хоста**, а не контейнера; `stop_grace_period: 60s` на чекпоинт WiredTiger |
| redis | 1 GB | `--maxmemory 384mb --maxmemory-policy allkeys-lru`; запас над maxmemory нужен под `fork()` при RDB/AOF |
| backend | 3 GB | `NODE_OPTIONS=--max-old-space-size=768`; наследуется **каждым** процессом — primary, воркеры и процесс HEALTHCHECK, поэтому бюджет считается как `mem_limit / (CLUSTER_WORKERS + 2)` |
| nginx | 256 MB | — |

`CLUSTER_WORKERS` задаётся в `.env.production` (сейчас `1`) и намеренно **не**
переопределяется в compose: `environment` перебивает `env_file`, и значение в
compose молча проигнорировало бы серверную настройку. При его повышении
`--max-old-space-size` надо пересчитать.

Логи всех контейнеров ограничены (`json-file`, 10 MB × 3 файла на сервис). Без
этого лог одного mongodb вырос до **2.1 ГБ** — он пересоздастся вместе с
контейнером, и место освободится само.

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
