#!/usr/bin/env bash
#
# Включает авторизацию MongoDB + Redis и single-node replica set (rs0).
# Запускается владельцем на сервере ОДИН раз:
#   cd /root/avtotime && bash scripts/enable_db_auth.sh
#
# Идемпотентен: уже сделанные шаги пропускает. Секреты генерируются здесь и
# никогда не печатаются — они попадают только в /root/avtotime/.env (пароль
# Redis для интерполяции compose) и /root/avtotime/.env.production (URL с
# креденшалами для бэкенда и бэкапа).
#
# Откат: docker-compose.yml.pre-auth и строки *_URL в .env.production.bak.
set -euo pipefail

cd /root/avtotime
say() { printf '\n== %s\n' "$*"; }

# ── 0. Свежий бэкап до любых перемен ────────────────────────────────────────
say "бэкап перед изменением"
./scripts/backup.sh

# ── 1. Секреты ──────────────────────────────────────────────────────────────
say "секреты"
if [ ! -f mongo-keyfile ]; then
  openssl rand -base64 756 > mongo-keyfile
  # mongod отказывается читать keyfile с широкими правами; в контейнере он
  # работает от uid 999.
  chmod 400 mongo-keyfile
  chown 999:999 mongo-keyfile
  echo "keyfile создан"
else
  echo "keyfile уже есть"
fi

if ! grep -q '^REDIS_PASSWORD=' .env 2>/dev/null; then
  printf 'REDIS_PASSWORD=%s\n' "$(openssl rand -hex 24)" >> .env
  echo "пароль redis сгенерирован (-> .env)"
fi
REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' .env | tail -1 | cut -d= -f2-)"

if ! grep -q '^MONGODB_URL=mongodb://avtotime:' .env.production 2>/dev/null; then
  MONGO_PASSWORD="$(openssl rand -hex 24)"
  cp .env.production .env.production.bak
  # Старые незапароленные URL (если были) убираем, новые дописываем.
  sed -i '/^MONGODB_URL=/d;/^REDIS_URL=/d' .env.production
  {
    printf 'MONGODB_URL=mongodb://avtotime:%s@mongodb:27017/avtotime?authSource=admin&replicaSet=rs0\n' "$MONGO_PASSWORD"
    printf 'REDIS_URL=redis://:%s@redis:6379/0\n' "$REDIS_PASSWORD"
  } >> .env.production
  echo "URL с креденшалами записаны в .env.production"
else
  MONGO_PASSWORD="$(grep '^MONGODB_URL=' .env.production | sed -E 's|^MONGODB_URL=mongodb://avtotime:([^@]+)@.*|\1|')"
  echo ".env.production уже содержит авторизованные URL"
fi

# ── 2. Новый compose ────────────────────────────────────────────────────────
say "docker-compose.yml"
if [ -f docker-compose.yml.new ]; then
  cp docker-compose.yml docker-compose.yml.pre-auth
  mv docker-compose.yml.new docker-compose.yml
  echo "подменён (прежний -> docker-compose.yml.pre-auth)"
else
  echo "docker-compose.yml.new не найден — считаю, что уже подменён"
fi
docker compose config -q

# ── 3. Поднять mongod с auth+replSet и инициализировать ─────────────────────
# Localhost exception: пока в admin нет ни одного пользователя, подключение
# изнутри контейнера может выполнить rs.initiate() и создать первого
# пользователя. Поэтому порядок жёсткий: сначала initiate, затем createUser.
say "mongodb"
docker compose up -d mongodb
for i in $(seq 1 30); do
  state="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q mongodb)" 2>/dev/null || echo starting)"
  [ "$state" = healthy ] && break
  sleep 3
done
echo "mongodb: $state"

if docker compose exec -T mongodb mongosh --quiet --eval 'rs.status().ok' >/dev/null 2>&1; then
  echo "replica set уже инициализирован"
else
  docker compose exec -T mongodb mongosh --quiet --eval 'rs.initiate()'
  sleep 3
fi

# Проверка «есть ли пользователи» через system.users здесь не работает: под
# включённым auth её саму не на что авторизовать, и однажды это заставило
# скрипт молча ПРОПУСТИТЬ создание пользователя. Поэтому: сначала пробуем
# войти готовыми креденшалами (идемпотентный повторный запуск), а создаём —
# от __system, чей пароль по определению равен содержимому keyfile. Это
# штатный путь: localhost exception после rs.initiate уже не действует.
if docker compose exec -T mongodb mongosh "mongodb://avtotime:$MONGO_PASSWORD@localhost:27017/admin?authSource=admin" --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
  echo "пользователь avtotime уже существует и пароль подходит"
else
  docker compose exec -T mongodb sh -c "
    KEYPW=\$(tr -d '[:space:]' < /etc/mongo-keyfile)
    mongosh --quiet -u __system -p \"\$KEYPW\" --authenticationDatabase local admin --eval '
      try {
        db.createUser({
          user: \"avtotime\",
          pwd: \"$MONGO_PASSWORD\",
          roles: [
            { role: \"readWrite\", db: \"avtotime\" },
            { role: \"backup\", db: \"admin\" },
            { role: \"clusterMonitor\", db: \"admin\" }
          ]
        });
        print(\"пользователь avtotime создан\");
      } catch (e) {
        if (String(e).includes(\"already exists\")) print(\"пользователь уже был\");
        else throw e;
      }'"
fi

# ── 4. Остальной стек с новыми URL ──────────────────────────────────────────
say "перезапуск остального стека"
docker compose up -d

# ── 5. Проверки ─────────────────────────────────────────────────────────────
say "проверки"
sleep 20
docker compose ps --format '{{.Service}}\t{{.Status}}'

echo
echo "- авторизованное подключение к mongo:"
docker compose exec -T backend node -e "
const m = require('mongoose');
m.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 8000 })
  .then(async () => { const n = await m.connection.db.collection('users').countDocuments(); console.log('  ok, пользователей в БД:', n); process.exit(0); })
  .catch((e) => { console.log('  FAIL:', e.message); process.exit(1); });
"
echo "- неавторизованное ДОЛЖНО отбиваться:"
docker compose exec -T mongodb mongosh --quiet --eval 'db.getSiblingDB("avtotime").users.countDocuments()' >/dev/null 2>&1 \
  && echo "  ПЛОХО: пустили без пароля!" || echo "  ok, отказ без пароля"

echo "- транзакции (replica set):"
docker compose exec -T mongodb mongosh --quiet --eval 'rs.status().set' 2>/dev/null | tail -1 || true

echo
for i in $(seq 1 30); do
  curl -fsS --max-time 5 http://127.0.0.1/api/health >/dev/null 2>&1 && { echo "api: здоров"; break; }
  curl -fsS --max-time 5 https://avtotime.org/api/health >/dev/null 2>&1 && { echo "api: здоров"; break; }
  sleep 3
done

echo
echo "Готово. Если что-то не так: mv docker-compose.yml.pre-auth docker-compose.yml,"
echo "вернуть строки *_URL из .env.production.bak и docker compose up -d."
