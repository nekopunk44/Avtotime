# Бэкапы Avtotime

Скрипт: `scripts/backup.sh`. Делает две вещи за запуск:

1. `mongodump --archive --gzip` базы `avtotime` — потоком из контейнера `mongodb`, без остановки сервисов;
2. `tar.gz` тома `uploads` (пользовательские файлы, они же `/app/public` в backend).

Результат кладётся в `backups/<ГГГГ-ММ-ДД_ЧЧММСС>/`:

```
backups/
├── backup.log                  # общий журнал всех запусков
├── 2026-09-01_030000/
│   ├── mongo-avtotime.archive.gz
│   ├── uploads.tar.gz
│   └── MANIFEST.txt
└── 2026-08-31_030000/
    ├── mongo-avtotime.archive.gz
    └── MANIFEST.txt            # uploads.tar.gz уже вычищен ротацией
```

Ротация: 7 последних снимков базы, из них 2 последних хранят ещё и архив файлов
(медиа занимают сотни мегабайт и меняются медленно — 7 копий подряд просто
забьют диск). Меняется переменными `KEEP_DAILY` и `KEEP_UPLOADS`.

---

## Установка на сервере

```bash
cd /root/avtotime
chmod +x scripts/backup.sh

# образ, которым архивируется том uploads (чтобы первый ночной запуск
# не тратил время на скачивание)
docker pull alpine:3.20

# пробный прогон — должен закончиться строкой "done — snapshot ... complete"
./scripts/backup.sh
```

Скрипт должен запускаться от `root` (или от пользователя в группе `docker`):
он обращается к docker-сокету и читает том, созданный контейнером.

### Cron

```bash
crontab -e
```

```cron
# Бэкап Avtotime каждую ночь в 03:20
20 3 * * * /root/avtotime/scripts/backup.sh >> /var/log/avtotime-backup.log 2>&1
```

Проверить, что задание встало: `crontab -l`.
Посмотреть последний результат: `tail -n 30 /root/avtotime/backups/backup.log`.

Повторный запуск, пока предыдущий ещё идёт, блокируется через `flock` —
пересечения двух архиваций не будет.

### Переменные (все со значениями по умолчанию, ничего задавать не обязательно)

| Переменная | По умолчанию | Что делает |
|---|---|---|
| `BACKUP_DIR` | `<проект>/backups` | Куда складывать |
| `MONGO_DB` | `avtotime` | Имя базы |
| `KEEP_DAILY` | `7` | Сколько снимков базы хранить |
| `KEEP_UPLOADS` | `2` | Сколько снимков хранят архив файлов |
| `MIN_FREE_MB` | `2048` | Ниже этого свободного места запуск отменяется |
| `HEALTHCHECK_URL` | — | Пинг dead-man's switch (см. ниже) |

---

## Dead-man's switch — обязательно

Молчащий бэкап хуже отсутствующего: про сломанный cron узнают в тот момент,
когда база уже потеряна. Нужен внешний наблюдатель, который поднимает тревогу
при **отсутствии** сигнала.

1. Завести бесплатную проверку на [healthchecks.io](https://healthchecks.io),
   период — 1 день, grace — 2 часа.
2. Скопировать её URL вида `https://hc-ping.com/<uuid>`.
3. Прописать в cron:

```cron
20 3 * * * HEALTHCHECK_URL=https://hc-ping.com/<uuid> /root/avtotime/scripts/backup.sh >> /var/log/avtotime-backup.log 2>&1
```

Скрипт сам дёргает `<url>/start` в начале, `<url>` при успехе и `<url>/fail`
при любой ошибке. Если сервер выключен, cron удалён или диск переполнен —
сигнала не будет и healthchecks.io пришлёт письмо. Без этого пункта бэкап
считать ненастроенным.

---

## Восстановление

### База целиком

```bash
cd /root/avtotime
SNAP=backups/2026-09-01_030000

# 1. Остановить backend, чтобы никто не писал во время наката
docker compose stop backend

# 2. Залить архив в mongod (--drop удаляет коллекции перед восстановлением)
docker compose exec -T mongodb \
  mongorestore --archive --gzip --drop --nsInclude='avtotime.*' \
  < "$SNAP/mongo-avtotime.archive.gz"

# 3. Поднять backend
docker compose start backend
```

### Одна коллекция

```bash
docker compose exec -T mongodb \
  mongorestore --archive --gzip --drop \
  --nsInclude='avtotime.users' \
  < backups/2026-09-01_030000/mongo-avtotime.archive.gz
```

### Проверка архива без наката

```bash
gzip -t backups/2026-09-01_030000/mongo-avtotime.archive.gz && echo OK
```

### Файлы (том uploads)

```bash
cd /root/avtotime
SNAP=backups/2026-09-01_030000
VOL=$(docker inspect -f \
  '{{range .Mounts}}{{if eq .Destination "/app/public"}}{{.Name}}{{end}}{{end}}' \
  "$(docker compose ps -q backend)")

docker compose stop backend nginx
docker run --rm -v "$VOL":/data -v "$PWD/$SNAP":/backup:ro alpine:3.20 \
  sh -c 'rm -rf /data/* && tar -xzf /backup/uploads.tar.gz -C /data'
docker compose start backend nginx
```

Права внутри тома должны остаться за `node` (uid 1000) — иначе multer не
сможет писать новые загрузки:

```bash
docker compose exec -u root backend chown -R node:node /app/public
```

### Восстановление на чистый сервер

1. Пройти `DEPLOY.md` до шага «Запустить» включительно (сервисы поднимутся с пустой базой).
2. Скопировать каталог снимка на сервер (`scp -r`).
3. Выполнить два блока выше: сначала база, потом файлы.

---

## Выгрузка за пределы сервера

Пока она не включена, все копии лежат на том же диске, что и база: это спасает
от `--drop` не туда, от неудачной миграции и от случайного `docker compose down
-v`, но **не** от потери самого сервера.

Шаг встроен в скрипт и включается одной переменной — `RCLONE_REMOTE`. Порядок:

```bash
# 1. Поставить rclone
curl -fsSL https://rclone.org/install.sh | bash

# 2. Настроить remote (Backblaze B2 дешевле всего: ~$0.06 за ГБ в месяц)
rclone config      # создать remote с именем, например, b2

# 3. Прописать назначение в окружение крона
crontab -e
# заменить строку на:
# 20 3 * * * RCLONE_REMOTE=b2:avtotime-backups /root/avtotime/scripts/backup.sh >> /var/log/avtotime-backup.log 2>&1
```

Поведение проверено на сервере:

* переменная не задана — прогон успешен, в логе отмечено, что копии остались
  только на этом диске;
* переменная задана, а `rclone` не установлен — прогон завершается с кодом 1,
  но **локальный снимок сохраняется**: неудачная выгрузка не повод его терять;
* выгрузка не удалась — то же самое плюс пинг `/fail`, потому что «выгружено» и
  «лежит только на машине, которая может умереть» — разные утверждения.

Шаг стоит после того, как снимок признан полным, поэтому сбой сети никогда не
уничтожает уже снятую копию.

### Сторож (dead-man's switch)

`HEALTHCHECK_URL` — URL проверки на healthchecks.io (бесплатно). Скрипт пингует
`/start` в начале, базовый URL при успехе и `/fail` при любом отказе, включая
неполный снимок без тома `uploads`. Без него о том, что бэкап перестал
выполняться, узнать неоткуда: тишина в логе выглядит ровно как тишина.

---

## Чего здесь нет

**Снапшотов диска у провайдера.** Логический дамп не заменяет снимок машины:
он не вернёт сам сервер, если тот потерян. Включается в панели Hetzner.

