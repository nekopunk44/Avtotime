# Avtotime — мобильное приложение

React Native (Expo SDK 55) клиент для avtotime.org. Полный паритет с веб-приложением:
лента, истории (фото и видео), короткие видео (Loops), маркет, избранное, сравнение,
аналитика, автокурсы, детские игры, сообщения, отзывы, админ-панель, тарифы, пуш-уведомления.

Бэкенд: `../Avtotime-1/backend`, продакшн — `https://avtotime.org` (задаётся в `src/api/client.ts`).

## Разработка

```bash
npm install
npm start          # Metro + QR-код для Expo Go
npm run android    # запуск на Android-устройстве/эмуляторе
```

Проверка типов: `npx tsc --noEmit`

> ⚠️ Пуш-уведомления и Google-вход не работают в Expo Go на Android (ограничение Expo SDK 53+).
> Для их проверки нужен development build (см. ниже).

## Сборка (EAS)

Профили описаны в `eas.json`. Перед первой сборкой:

```bash
npm install -g eas-cli
eas login                 # вход в аккаунт Expo (нужен один раз)
eas init                  # создаёт projectId и прописывает его в app.json → extra.eas.projectId
```

`eas init` обязателен для пуш-уведомлений: без `projectId` регистрация push-токена
пропускается (см. `src/notifications/push.ts`).

Сборки:

```bash
eas build --profile preview --platform android      # APK для установки на телефон
eas build --profile development --platform android  # dev build с developmentClient
eas build --profile production --platform android   # AAB для Google Play
```

## Что нужно на бэкенде

Пуш-уведомления требуют развёрнутого бэкенда с эндпоинтами:
`POST /api/notifications/push-token` и `DELETE /api/notifications/push-token`
(реализованы в `../Avtotime-1/backend`). Токены хранятся в `User.expoPushTokens`,
отправка — через Expo Push API (`services/expoPush.js`).
