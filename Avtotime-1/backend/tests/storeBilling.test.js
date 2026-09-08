import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";

const app = createApp();

// Ключ сервисного аккаунта: настоящий RSA нужен, потому что сервис реально
// подписывает JWT для Google OAuth. Генерируется один раз на файл.
import { generateKeyPairSync } from "node:crypto";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA_KEY = JSON.stringify({
  client_email: "svc@test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});

const savedEnv = {};
const setEnv = (values) => {
  for (const [k, v] of Object.entries(values)) {
    if (!(k in savedEnv)) savedEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
});

const signUp = async () => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Buyer",
    userName: "buyer",
    email: "buyer@example.com",
    password: "correct-horse-battery",
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

const inMonth = () => new Date(Date.now() + 30 * 24 * 3600 * 1000);

/** Маршрутизирующая подмена fetch: решает по URL, кем прикинуться. */
const stubStores = (handlers) => {
  const calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      calls.push({ url: String(url), init });
      for (const [match, respond] of handlers) {
        if (String(url).includes(match)) {
          const body = typeof respond === "function" ? respond(String(url), init) : respond;
          return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
        }
      }
      throw new Error(`нет обработчика для ${url}`);
    }),
  );
  return calls;
};

let buyer;

beforeEach(async () => {
  buyer = await signUp();
});

const verify = (token, body) =>
  request(app).post("/api/payment/store/verify").set("Authorization", `Bearer ${token}`).send(body);

describe("конфигурация сторов", () => {
  it("честно говорит, что не настроено, и не пускает покупку", async () => {
    setEnv({ GOOGLE_PLAY_PACKAGE_NAME: undefined, GOOGLE_PLAY_SA_KEY: undefined, APP_STORE_SHARED_SECRET: undefined });

    const config = await request(app)
      .get("/api/payment/store/config")
      .set("Authorization", `Bearer ${buyer.token}`);
    expect(config.body).toEqual({ google: false, apple: false });

    const response = await verify(buyer.token, { platform: "google", purchaseToken: "t" });
    expect(response.status).toBe(503);
  });
});

describe("покупка через Google Play", () => {
  const googleEnv = () =>
    setEnv({ GOOGLE_PLAY_PACKAGE_NAME: "org.avtotime.app", GOOGLE_PLAY_SA_KEY: SA_KEY });

  const googleHandlers = (subscription) => [
    ["oauth2.googleapis.com/token", { access_token: "at", expires_in: 3600 }],
    ["subscriptionsv2/tokens", subscription],
    [":acknowledge", {}],
  ];

  it("активирует тариф по данным Google, а не клиента", async () => {
    googleEnv();
    const calls = stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        lineItems: [{ productId: "avtotime_pro_monthly", expiryTime: inMonth().toISOString() }],
      }),
    );

    const response = await verify(buyer.token, { platform: "google", purchaseToken: "tok-1" });

    expect(response.status).toBe(200);
    expect(response.body.effectivePlan).toBe("pro");
    const user = await User.findById(buyer.id).lean();
    expect(user.plan).toBe("pro");
    // Неподтверждённую покупку Google вернёт через три дня — ack обязателен.
    expect(calls.some((c) => c.url.includes(":acknowledge"))).toBe(true);
    const payment = await Payment.findOne({ provider: "google" }).lean();
    expect(payment.storeTransactionId).toBe("tok-1");
    expect(payment.status).toBe("succeeded");
  });

  it("повторная проверка того же токена продлевает срок, а не плодит записи", async () => {
    googleEnv();
    stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        lineItems: [{ productId: "avtotime_pro_monthly", expiryTime: inMonth().toISOString() }],
      }),
    );
    await verify(buyer.token, { platform: "google", purchaseToken: "tok-1" });

    const later = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        lineItems: [{ productId: "avtotime_pro_monthly", expiryTime: later.toISOString() }],
      }),
    );
    const second = await verify(buyer.token, { platform: "google", purchaseToken: "tok-1" });

    expect(second.status).toBe(200);
    expect(await Payment.countDocuments({ provider: "google" })).toBe(1);
    const user = await User.findById(buyer.id).lean();
    expect(new Date(user.planExpiresAt).getTime()).toBe(later.getTime());
  });

  it("истёкшую или отменённую подписку не активирует", async () => {
    googleEnv();
    stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
        lineItems: [{ productId: "avtotime_pro_monthly", expiryTime: new Date(Date.now() - 1000).toISOString() }],
      }),
    );

    const response = await verify(buyer.token, { platform: "google", purchaseToken: "dead" });

    expect(response.status).toBe(400);
    expect((await User.findById(buyer.id).lean()).plan).not.toBe("pro");
  });

  it("неизвестный продукт стора не превращается в тариф", async () => {
    googleEnv();
    stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [{ productId: "somebody_elses_product", expiryTime: inMonth().toISOString() }],
      }),
    );

    const response = await verify(buyer.token, { platform: "google", purchaseToken: "t" });
    expect(response.status).toBe(400);
  });

  it("вебхук продления обновляет срок по нашему запросу к Google", async () => {
    googleEnv();
    stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        lineItems: [{ productId: "avtotime_pro_monthly", expiryTime: inMonth().toISOString() }],
      }),
    );
    await verify(buyer.token, { platform: "google", purchaseToken: "tok-rtdn" });

    const renewed = new Date(Date.now() + 61 * 24 * 3600 * 1000);
    stubStores(
      googleHandlers({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        lineItems: [{ productId: "avtotime_pro_monthly", expiryTime: renewed.toISOString() }],
      }),
    );
    const envelope = {
      message: {
        data: Buffer.from(
          JSON.stringify({ subscriptionNotification: { purchaseToken: "tok-rtdn", notificationType: 2 } }),
        ).toString("base64"),
      },
    };
    const response = await request(app).post("/api/payment/store/google-notify").send(envelope);

    expect(response.status).toBe(200);
    const user = await User.findById(buyer.id).lean();
    expect(new Date(user.planExpiresAt).getTime()).toBe(renewed.getTime());
  });

  it("вебхук с неизвестным токеном ничего не трогает и отвечает 200", async () => {
    googleEnv();
    const calls = stubStores(googleHandlers({}));
    const envelope = {
      message: {
        data: Buffer.from(
          JSON.stringify({ subscriptionNotification: { purchaseToken: "never-seen" } }),
        ).toString("base64"),
      },
    };

    const response = await request(app).post("/api/payment/store/google-notify").send(envelope);

    // 200 — иначе Pub/Sub ретраит вечно; но к Google мы даже не ходили.
    expect(response.status).toBe(200);
    expect(calls.filter((c) => c.url.includes("subscriptionsv2"))).toHaveLength(0);
  });
});

describe("покупка через App Store", () => {
  const appleEnv = () => setEnv({ APP_STORE_SHARED_SECRET: "shhh" });

  it("активирует тариф по чеку и переживает sandbox-редирект 21007", async () => {
    appleEnv();
    let firstCall = true;
    stubStores([
      [
        "buy.itunes.apple.com/verifyReceipt",
        () => {
          if (firstCall) {
            firstCall = false;
            return { status: 21007 };
          }
          throw new Error("прод дважды");
        },
      ],
      [
        "sandbox.itunes.apple.com/verifyReceipt",
        {
          status: 0,
          latest_receipt: "fresh-receipt",
          latest_receipt_info: [
            {
              product_id: "avtotime_business_monthly",
              expires_date_ms: String(inMonth().getTime()),
              original_transaction_id: "orig-1",
            },
          ],
        },
      ],
    ]);

    const response = await verify(buyer.token, { platform: "apple", receipt: "base64receipt" });

    expect(response.status).toBe(200);
    expect(response.body.effectivePlan).toBe("business");
    const payment = await Payment.findOne({ provider: "apple" }).select("+latestReceipt").lean();
    expect(payment.storeTransactionId).toBe("orig-1");
    // Чек сохранён — вебхук продления перепроверяет ИМ, а не содержимым уведомления.
    expect(payment.latestReceipt).toBe("fresh-receipt");
  });

  it("вебхук Apple продлевает срок через перепроверку сохранённого чека", async () => {
    appleEnv();
    stubStores([
      [
        "verifyReceipt",
        {
          status: 0,
          latest_receipt: "receipt-v1",
          latest_receipt_info: [
            {
              product_id: "avtotime_pro_monthly",
              expires_date_ms: String(inMonth().getTime()),
              original_transaction_id: "orig-2",
            },
          ],
        },
      ],
    ]);
    await verify(buyer.token, { platform: "apple", receipt: "r0" });

    const renewed = Date.now() + 62 * 24 * 3600 * 1000;
    stubStores([
      [
        "verifyReceipt",
        {
          status: 0,
          latest_receipt: "receipt-v2",
          latest_receipt_info: [
            {
              product_id: "avtotime_pro_monthly",
              expires_date_ms: String(renewed),
              original_transaction_id: "orig-2",
            },
          ],
        },
      ],
    ]);
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const signedTransactionInfo = `h.${b64({ originalTransactionId: "orig-2" })}.s`;
    const signedPayload = `h.${b64({ data: { signedTransactionInfo } })}.s`;

    const response = await request(app).post("/api/payment/store/apple-notify").send({ signedPayload });

    expect(response.status).toBe(200);
    const user = await User.findById(buyer.id).lean();
    expect(new Date(user.planExpiresAt).getTime()).toBe(renewed);
  });

  it("подделанное уведомление о неизвестной покупке ничего не даёт", async () => {
    appleEnv();
    const calls = stubStores([["verifyReceipt", { status: 0, latest_receipt_info: [] }]]);
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const signedPayload = `h.${b64({ data: { signedTransactionInfo: `h.${b64({ originalTransactionId: "fake" })}.s` } })}.s`;

    const response = await request(app).post("/api/payment/store/apple-notify").send({ signedPayload });

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});
