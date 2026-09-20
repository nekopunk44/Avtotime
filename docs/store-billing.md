# Подписки через сторы (Google Play / App Store)

Код готов с обеих сторон: приложение открывает диалог стора, сервер сам
перепроверяет покупку у Google или Apple и только по её ответу выдаёт тариф.
Не хватает **учётных данных**: пока их нет, `/api/payment/store/config`
отвечает `{ google: false, apple: false }`, и приложение честно уводит на
веб-страницу оплаты.

Что уже работает:

| Часть | Где | Состояние |
| --- | --- | --- |
| Диалог покупки, offerToken, восстановление | `mobile/src/billing/storePurchase.ts` | готово |
| Проверка покупки на сервере | `Avtotime-1/backend/services/storeBilling.js` | готово |
| Выдача тарифа, идемпотентность | `controllers/storeBilling.controllers.js` | готово |
| Уведомления о продлениях (RTDN, App Store) | те же контроллеры | готово |

Идентификаторы продуктов — единственный источник правды на сервере
(`PRODUCT_TO_PLAN`), приложение получает их в `/payment/store/config`:

```
avtotime_pro_monthly       → pro       29 €/мес
avtotime_business_monthly  → business  79 €/мес
```

---

## Google Play

1. **Play Console → Монетизация → Подписки.** Создать две подписки с
   идентификаторами `avtotime_pro_monthly` и `avtotime_business_monthly`,
   у каждой — базовый план с ежемесячной оплатой, цены 29 € и 79 €.
   Подписки должны быть **активны**, иначе `fetchProducts` вернёт пусто.
2. Приложение (`org.avtotime.app`) должно быть загружено хотя бы на
   **внутреннее тестирование**: до первой публикации покупки недоступны даже
   в отладочной сборке.
3. **Google Cloud → IAM → Сервисные аккаунты.** Создать аккаунт, выпустить
   JSON-ключ. В Play Console → Пользователи и разрешения пригласить этот
   аккаунт и выдать право «Просматривать финансовые данные» и «Управлять
   заказами и подписками».
4. Переменные окружения бэкенда (`/root/avtotime/backend/.env`):

   ```
   GOOGLE_PLAY_PACKAGE_NAME=org.avtotime.app
   GOOGLE_PLAY_SA_KEY={"type":"service_account", ... }   # JSON одной строкой
   # либо путь к файлу внутри контейнера:
   # GOOGLE_PLAY_SA_KEY_FILE=/app/secrets/play-sa.json
   ```

5. Перезапустить бэкенд (`docker compose up -d --no-deps backend`) и убедиться,
   что `/api/payment/store/config` отвечает `google: true`.
6. **Продления без участия приложения:** Play Console → Монетизация →
   Уведомления в реальном времени, тема Pub/Sub с push-подпиской на
   `https://avtotime.org/api/payment/store/google/notify`.

## App Store

1. **App Store Connect → Подписки.** Те же идентификаторы продуктов и цены.
2. Общий секрет приложения (App-Specific Shared Secret) → переменная
   `APP_STORE_SHARED_SECRET`.
3. Уведомления сервера (Server Notifications V2) →
   `https://avtotime.org/api/payment/store/apple/notify`.

## Сборка приложения

Нативная часть живёт в `react-native-iap` (+ `react-native-nitro-modules`) —
в Expo Go и в сборках, сделанных до их появления, её нет: приложение это
замечает и предлагает браузер. Нужна новая сборка dev-клиента или релиза:

```bash
cd mobile
npx expo run:android          # локальный dev-клиент
# или eas build -p android --profile production
```

Разрешение `com.android.vending.BILLING` уже прописано в `app.json`.

## Проверка

1. Тестовый аккаунт добавить в Play Console → Настройки → Лицензионное
   тестирование: покупки будут проходить без списания.
2. В приложении: Настройки → тариф → «Оформить подписку». Должен открыться
   диалог Google Play, а после оплаты тариф смениться сразу — сервер выдаёт
   его по ответу стора, а не по слову приложения.
3. «Восстановить покупки» на экране тарифов прогоняет ту же проверку — это
   обязательный сценарий для Apple.
