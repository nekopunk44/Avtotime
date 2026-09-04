import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Stripe is replaced wholesale: these tests are about our own ordering and
// authorisation rules, not about Stripe's API. `retrieve` is reassigned per test
// to describe whatever the payment intent looks like from Stripe's side.
const retrieve = vi.fn();
vi.mock("stripe", () => ({
  default: class StripeStub {
    constructor() {
      this.paymentIntents = { retrieve };
    }
  },
}));

const { createApp } = await import("../app.js");
const { default: User } = await import("../models/user.model.js");
const { default: Payment } = await import("../models/payment.model.js");

const app = createApp();

// csrfOriginCheck guards this route and rejects a request with no Origin.
const ORIGIN = "http://localhost:5173";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_stub";
});

const signUp = async (overrides = {}) => {
  const response = await request(app).post("/api/auth/signup").send({
    name: "Payer",
    userName: "payer",
    email: "payer@example.com",
    password: "correct-horse-battery",
    ...overrides,
  });
  expect(response.status).toBe(201);
  return { id: response.body._id, token: response.body.token };
};

const pendingPayment = (userId, intentId) =>
  Payment.create({
    user: userId,
    plan: "pro",
    amount: 2900,
    currency: "eur",
    status: "pending",
    stripePaymentIntentId: intentId,
  });

const succeededIntent = (userId, plan = "pro") => ({
  id: "pi_test",
  status: "succeeded",
  metadata: { userId: String(userId), plan },
});

const confirm = (token, paymentIntentId) =>
  request(app)
    .post("/api/payment/confirm")
    .set("Authorization", `Bearer ${token}`)
    .set("Origin", ORIGIN)
    .send({ paymentIntentId });

let buyer;

beforeEach(async () => {
  retrieve.mockReset();
  buyer = await signUp();
});

describe("confirming a payment", () => {
  it("activates the plan and settles the payment row", async () => {
    await pendingPayment(buyer.id, "pi_test");
    retrieve.mockResolvedValue(succeededIntent(buyer.id));

    const response = await confirm(buyer.token, "pi_test");

    expect(response.status).toBe(200);
    expect(response.body.plan).toBe("pro");

    const user = await User.findById(buyer.id).lean();
    expect(user.plan).toBe("pro");
    expect(new Date(user.planExpiresAt).getTime()).toBeGreaterThan(Date.now());

    const payment = await Payment.findOne({ stripePaymentIntentId: "pi_test" }).lean();
    expect(payment.status).toBe("succeeded");
  });

  it("is idempotent: a repeat call does not extend the period", async () => {
    await pendingPayment(buyer.id, "pi_test");
    retrieve.mockResolvedValue(succeededIntent(buyer.id));

    const first = await confirm(buyer.token, "pi_test");
    const second = await confirm(buyer.token, "pi_test");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Stripe charges once; a double-confirm must not buy a second month.
    expect(second.body.planExpiresAt).toBe(first.body.planExpiresAt);
    expect(await Payment.countDocuments({ status: "succeeded" })).toBe(1);
  });

  it("refuses a payment intent minted for somebody else", async () => {
    const stranger = await signUp({ userName: "stranger", email: "stranger@example.com" });
    await pendingPayment(buyer.id, "pi_test");
    // The row belongs to the buyer, but Stripe says the intent is the stranger's.
    retrieve.mockResolvedValue(succeededIntent(stranger.id));

    const response = await confirm(buyer.token, "pi_test");

    expect(response.status).toBe(403);
    expect((await User.findById(buyer.id).lean()).plan).not.toBe("pro");
  });

  it("refuses to confirm another user's payment row", async () => {
    const stranger = await signUp({ userName: "stranger", email: "stranger@example.com" });
    await pendingPayment(stranger.id, "pi_test");
    retrieve.mockResolvedValue(succeededIntent(stranger.id));

    const response = await confirm(buyer.token, "pi_test");

    // Looked up by (intent, user) together, so it is not even found.
    expect(response.status).toBe(404);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("refuses an intent Stripe has not marked succeeded", async () => {
    await pendingPayment(buyer.id, "pi_test");
    retrieve.mockResolvedValue({ ...succeededIntent(buyer.id), status: "requires_payment_method" });

    const response = await confirm(buyer.token, "pi_test");

    expect(response.status).toBe(400);
    expect((await User.findById(buyer.id).lean()).plan).not.toBe("pro");
    expect((await Payment.findOne({ stripePaymentIntentId: "pi_test" }).lean()).status).toBe("pending");
  });

  it("refuses a plan name Stripe does not price", async () => {
    await pendingPayment(buyer.id, "pi_test");
    retrieve.mockResolvedValue(succeededIntent(buyer.id, "enterprise"));

    const response = await confirm(buyer.token, "pi_test");

    expect(response.status).toBe(400);
    expect((await User.findById(buyer.id).lean()).plan).not.toBe("enterprise");
  });

  it("requires an Origin header", async () => {
    await pendingPayment(buyer.id, "pi_test");
    retrieve.mockResolvedValue(succeededIntent(buyer.id));

    const response = await request(app)
      .post("/api/payment/confirm")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ paymentIntentId: "pi_test" });

    expect(response.status).toBe(403);
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe("self-service plan changes", () => {
  const setPlan = (token, plan) =>
    request(app).patch("/api/user/plan").set("Authorization", `Bearer ${token}`).send({ plan });

  it("refuses to hand out a paid plan for free", async () => {
    const response = await setPlan(buyer.token, "pro");

    // Without this the whole billing system is one PATCH away from bypassed.
    expect(response.status).toBe(403);
    expect((await User.findById(buyer.id).lean()).plan).not.toBe("pro");
  });

  it("allows downgrading to free", async () => {
    await User.updateOne(
      { _id: buyer.id },
      { plan: "pro", planExpiresAt: new Date(Date.now() + 86_400_000) },
    );

    const response = await setPlan(buyer.token, "free");

    expect(response.status).toBe(200);
    const user = await User.findById(buyer.id).lean();
    expect(user.plan).toBe("free");
    expect(user.planExpiresAt).toBeNull();
  });
});
