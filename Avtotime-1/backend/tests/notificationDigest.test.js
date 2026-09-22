import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Почта подменена: ничего не уходит наружу, а вызов можно разглядывать.
const sendViaResend = vi.fn(async () => ({}));
vi.mock("../config/Mail.js", () => ({ sendViaResend }));

const { runNotificationDigestOnce, buildDigestEmail } = await import(
  "../services/notificationDigestCron.js"
);
const { default: User } = await import("../models/user.model.js");
const { default: Notification } = await import("../models/notification.model.js");

const savedKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  sendViaResend.mockClear();
  // Без ключа прогон честно выходит сразу — и все проверки стали бы пустыми.
  process.env.RESEND_API_KEY = "re_test_key";
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = savedKey;
});

const makeUser = (digestFrequency, overrides = {}) =>
  User.create({
    name: "Reader",
    userName: `reader_${digestFrequency}`,
    email: `${digestFrequency}@example.com`,
    password: "hashed-placeholder",
    notificationPreferences: { emailNotifications: true, digestFrequency },
    ...overrides,
  });

const makeNotification = (recipient, title, minutesAgo = 5) =>
  Notification.create({
    recipient: recipient._id,
    actor: recipient._id,
    type: "system",
    title,
    description: `Описание: ${title}`,
    createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
  });

describe("email-дайджест уведомлений", () => {
  it("собирает несланные уведомления в одно письмо и помечает их", async () => {
    const user = await makeUser("daily");
    await makeNotification(user, "Первое событие");
    await makeNotification(user, "Второе событие");

    const result = await runNotificationDigestOnce();

    expect(result.sent).toBe(1);
    expect(sendViaResend).toHaveBeenCalledTimes(1);
    const call = sendViaResend.mock.calls[0][0];
    expect(call.to).toBe("daily@example.com");
    expect(call.subject).toContain("2 события");
    expect(call.html).toContain("Первое событие");
    expect(call.html).toContain("Второе событие");

    const remaining = await Notification.countDocuments({
      recipient: user._id,
      emailSent: { $ne: true },
    });
    expect(remaining).toBe(0);
  });

  it("до срока повторное письмо не уходит", async () => {
    const user = await makeUser("daily");
    await makeNotification(user, "Событие до дайджеста");

    await runNotificationDigestOnce();
    sendViaResend.mockClear();

    await makeNotification(user, "Событие после дайджеста");
    // Прошёл всего час — суточный срок не наступил.
    const hourLater = new Date(Date.now() + 60 * 60 * 1000);
    const result = await runNotificationDigestOnce(hourLater);

    expect(result.sent).toBe(0);
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("после срока письмо уходит снова", async () => {
    const user = await makeUser("daily");
    await makeNotification(user, "Старое событие");
    await runNotificationDigestOnce();
    sendViaResend.mockClear();

    // Свежее событие происходит ПОСЛЕ первого дайджеста.
    await makeNotification(user, "Свежее событие", -120);
    const dayLater = new Date(Date.now() + 25 * 60 * 60 * 1000);
    const result = await runNotificationDigestOnce(dayLater);

    expect(result.sent).toBe(1);
    expect(sendViaResend.mock.calls[0][0].html).toContain("Свежее событие");
    expect(sendViaResend.mock.calls[0][0].html).not.toContain("Старое событие");
  });

  it("пустой период не рождает письмо, но срок передвигает", async () => {
    const user = await makeUser("weekly");

    const result = await runNotificationDigestOnce();
    expect(result.sent).toBe(0);
    expect(result.stamped).toBe(1);

    const fresh = await User.findById(user._id).select("notificationDigestLastAt").lean();
    expect(fresh.notificationDigestLastAt).toBeTruthy();
  });

  it("мгновенный и выключенный режимы дайджест не трогает", async () => {
    const instant = await makeUser("instant");
    const never = await makeUser("never");
    await makeNotification(instant, "Мгновенное");
    await makeNotification(never, "Никогдашнее");

    const result = await runNotificationDigestOnce();

    expect(result.sent).toBe(0);
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("хвост за пределами лимита сворачивается в счётчик", () => {
    const notifications = Array.from({ length: 23 }, (_, i) => ({
      title: `Событие ${i + 1}`,
      description: "",
    }));
    const { subject, html } = buildDigestEmail(notifications, "за день");

    expect(subject).toContain("23 события");
    expect(html).toContain("Событие 20");
    expect(html).not.toContain("Событие 21");
    expect(html).toContain("ещё 3 события");
  });
});
