import jwt from "jsonwebtoken";
import fs from "node:fs";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import { applyUserPlanToListings } from "./applyUserPlanToListings.js";

/**
 * Подписки через сторы: Google Play Billing и Apple IAP.
 *
 * Правила обоих сторов запрещают продавать цифровые подписки в приложении
 * мимо их биллинга, поэтому Stripe остаётся вебу, а мобилка ходит сюда.
 * Принцип один для обеих платформ: клиент приносит токен покупки, сервер
 * СВОИМ запросом к стору выясняет состояние подписки и только по ответу
 * стора выдаёт тариф. Ничему, что приходит от клиента или из вебхука,
 * содержательно не верим — это лишь повод спросить стор.
 */

// Идентификаторы продуктов, заведённых в консолях сторов. Ключи стабильные:
// строка уходит и в Google Play Console, и в App Store Connect.
export const PRODUCT_TO_PLAN = {
  avtotime_pro_monthly: "pro",
  avtotime_business_monthly: "business",
};

const PLAN_AMOUNTS = { pro: 2900, business: 7900 };

// ── Конфигурация ────────────────────────────────────────────────────────────

const readGoogleServiceAccount = () => {
  const inline = process.env.GOOGLE_PLAY_SA_KEY;
  if (inline?.trim()) return JSON.parse(inline);
  const file = process.env.GOOGLE_PLAY_SA_KEY_FILE;
  if (file?.trim() && fs.existsSync(file.trim())) {
    return JSON.parse(fs.readFileSync(file.trim(), "utf8"));
  }
  return null;
};

export const isGoogleConfigured = () =>
  Boolean(process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim()) && readGoogleServiceAccount() !== null;

export const isAppleConfigured = () => Boolean(process.env.APP_STORE_SHARED_SECRET?.trim());

// ── Google: OAuth сервисного аккаунта без сторонних SDK ─────────────────────
// googleapis тянет мегабайты зависимостей ради одного запроса; JWT RS256 у нас
// уже есть через jsonwebtoken, остальное — обычный fetch.

let googleToken = null; // { value, expiresAt }

const getGoogleAccessToken = async () => {
  if (googleToken && googleToken.expiresAt > Date.now() + 60_000) return googleToken.value;

  const sa = readGoogleServiceAccount();
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
    },
    sa.private_key,
    { algorithm: "RS256", expiresIn: "1h" },
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Google OAuth: ${response.status} ${await response.text().catch(() => "")}`);
  }
  const data = await response.json();
  googleToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return googleToken.value;
};

/**
 * Состояние подписки Google по purchaseToken — subscriptionsv2, единственный
 * актуальный способ узнать продукт, срок и статус разом.
 */
export const verifyGoogleSubscription = async (purchaseToken) => {
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME.trim();
  const accessToken = await getGoogleAccessToken();

  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}` +
      `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google subscriptionsv2: ${response.status} ${body.slice(0, 200)}`);
  }
  const data = await response.json();

  const line = data.lineItems?.[0];
  const active = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(
    data.subscriptionState,
  );

  return {
    productId: line?.productId || null,
    expiresAt: line?.expiryTime ? new Date(line.expiryTime) : null,
    active,
    state: data.subscriptionState || "UNKNOWN",
    acknowledged: data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  };
};

/**
 * Подтверждение покупки Google. Обязательный шаг: неподтверждённую в течение
 * трёх дней покупку Google сам возвращает пользователю.
 */
export const acknowledgeGoogleSubscription = async (productId, purchaseToken) => {
  const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME.trim();
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}` +
      `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    },
  );
  // 400 «already acknowledged» — штатный повтор, не ошибка.
  if (!response.ok && response.status !== 400) {
    throw new Error(`Google acknowledge: ${response.status}`);
  }
};

// ── Apple: verifyReceipt с shared secret ────────────────────────────────────
// App Store Server API требует ключ p8 и связку JWT-параметров; verifyReceipt
// просит один shared secret и покрывает и покупку, и продления через
// latest_receipt_info — для старта это осознанно меньший порог входа.

const APPLE_PROD_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

const callAppleVerify = async (url, receipt) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receipt,
      password: process.env.APP_STORE_SHARED_SECRET.trim(),
      "exclude-old-transactions": true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Apple verifyReceipt: HTTP ${response.status}`);
  return response.json();
};

export const verifyAppleReceipt = async (receipt) => {
  let data = await callAppleVerify(APPLE_PROD_URL, receipt);
  // 21007 — «это sandbox-чек»: Apple требует ходить сначала в прод и
  // откатываться, именно так проходит их ревью тестовыми покупками.
  if (data.status === 21007) data = await callAppleVerify(APPLE_SANDBOX_URL, receipt);
  if (data.status !== 0) throw new Error(`Apple verifyReceipt: status ${data.status}`);

  const infos = (data.latest_receipt_info || []).filter((t) => PRODUCT_TO_PLAN[t.product_id]);
  if (!infos.length) return { productId: null, expiresAt: null, active: false, originalTransactionId: null };

  const latest = infos.reduce((a, b) =>
    Number(a.expires_date_ms || 0) > Number(b.expires_date_ms || 0) ? a : b,
  );
  const expiresAt = latest.expires_date_ms ? new Date(Number(latest.expires_date_ms)) : null;

  return {
    productId: latest.product_id,
    expiresAt,
    active: Boolean(expiresAt && expiresAt.getTime() > Date.now()),
    originalTransactionId: latest.original_transaction_id || latest.transaction_id,
    latestReceipt: data.latest_receipt || receipt,
  };
};

// ── Общая активация ─────────────────────────────────────────────────────────

/**
 * Выдаёт тариф по подтверждённому стором состоянию подписки. Идемпотентна и
 * повторно-входима: тот же transactionId продлевает срок, а не плодит записи —
 * этим же путём обрабатываются и продления из вебхуков.
 */
export const activateStorePlan = async ({
  userId,
  provider,
  productId,
  transactionId,
  expiresAt,
  latestReceipt = null,
}) => {
  const plan = PRODUCT_TO_PLAN[productId];
  if (!plan) throw Object.assign(new Error(`Неизвестный продукт: ${productId}`), { status: 400 });
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    throw Object.assign(new Error("Подписка не активна по данным стора"), { status: 400 });
  }

  const payment = await Payment.findOneAndUpdate(
    { provider, storeTransactionId: transactionId },
    {
      $set: {
        status: "succeeded",
        storeProductId: productId,
        storeExpiresAt: expiresAt,
        periodEnd: expiresAt,
        ...(latestReceipt ? { latestReceipt } : {}),
      },
      $setOnInsert: {
        user: userId,
        plan,
        amount: PLAN_AMOUNTS[plan],
        currency: "eur",
        provider,
        storeTransactionId: transactionId,
        periodStart: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  // Владелец записи — авторитет: вебхук не знает пользователя, берём из записи.
  const ownerId = payment.user;

  await User.updateOne(
    { _id: ownerId },
    {
      plan,
      planActivatedAt: payment.periodStart || new Date(),
      planExpiresAt: expiresAt,
      planExpiryWarnedThreshold: null,
    },
  );
  await applyUserPlanToListings(ownerId, plan).catch(() => {});

  return { plan, userId: String(ownerId), expiresAt };
};
