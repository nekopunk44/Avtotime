import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replaced so nothing leaves the machine and so the call can be inspected and,
// crucially, made to hang.
const sendViaResend = vi.fn();
vi.mock("../config/Mail.js", () => ({ sendViaResend }));

const { escapeHtml } = await import("../utils/html.js");
const { createNotification } = await import("../controllers/notification.controllers.js");
const { default: User } = await import("../models/user.model.js");
const { default: Notification } = await import("../models/notification.model.js");

const savedKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  sendViaResend.mockReset();
  // sendEmailNotification bails out early without a key, which would make every
  // assertion below vacuous.
  process.env.RESEND_API_KEY = "re_test_key";
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = savedKey;
});

const recipientWithEmail = () =>
  User.create({
    name: "Recipient",
    userName: "recipient",
    email: "recipient@example.com",
    password: "hashed-placeholder",
    notificationPreferences: { emailNotifications: true, digestFrequency: "instant" },
  });

const notify = (recipient, overrides = {}) =>
  createNotification({
    recipient: recipient._id,
    actor: recipient._id,
    type: "system",
    title: "Title",
    description: "Description",
    ...overrides,
  });

describe("escapeHtml", () => {
  it("neutralises the characters that carry markup", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("escapes the ampersand first so entities are not double-broken", () => {
    // A naive order turns "&" into "&amp;" after "<" became "&lt;", producing
    // "&amp;lt;" and a visibly broken email.
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("renders nullish values as an empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("the notification email", () => {
  it("escapes user-supplied text instead of interpolating it raw", async () => {
    const recipient = await recipientWithEmail();
    sendViaResend.mockResolvedValue(true);

    await notify(recipient, {
      title: '<img src=x onerror="steal()">',
      description: "<b>bold</b>",
    });
    // The send is deliberately not awaited by the controller, so give the
    // microtask that dispatches it a turn.
    await vi.waitFor(() => expect(sendViaResend).toHaveBeenCalled());

    const { html } = sendViaResend.mock.calls[0][0];
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;img src=x");
  });

  it("does not hold the request while the mail provider is slow", async () => {
    const recipient = await recipientWithEmail();
    // Never resolves: if createNotification awaited this, the test would time out.
    sendViaResend.mockReturnValue(new Promise(() => {}));

    const created = await notify(recipient);

    expect(created).toBeTruthy();
    expect(await Notification.countDocuments()).toBe(1);
  });

  it("records the outcome once the provider answers", async () => {
    const recipient = await recipientWithEmail();
    sendViaResend.mockResolvedValue(true);

    await notify(recipient);

    await vi.waitFor(async () => {
      const stored = await Notification.findOne().lean();
      expect(stored.emailSent).toBe(true);
    });
  });

  it("sends nothing when the recipient has email notifications off", async () => {
    const recipient = await User.create({
      name: "Quiet",
      userName: "quiet",
      email: "quiet@example.com",
      password: "hashed-placeholder",
      notificationPreferences: { emailNotifications: false, digestFrequency: "instant" },
    });

    await notify(recipient);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sendViaResend).not.toHaveBeenCalled();
  });
});
