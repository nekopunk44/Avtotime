import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { sendViaResend } from "../config/Mail.js";
import { escapeHtml } from "../utils/html.js";

/**
 * Email-дайджесты уведомлений.
 *
 * Настройки давно предлагали «Ежедневно» и «Еженедельно», но собирал и слал
 * письма никто: значение хранилось — и всё. Выбор дайджеста на деле означал
 * «никаких писем», потому что мгновенная отправка проверяет строго 'instant'.
 *
 * Крон ходит раз в час. Для каждого пользователя с включённой почтой и
 * дайджестной частотой смотрит, наступил ли срок (сутки или неделя от
 * прошлой отправки), собирает уведомления, не ушедшие письмом, и шлёт их
 * одним письмом. Пустой период письма не создаёт, но срок передвигает —
 * иначе первое же событие после тихой недели уехало бы «дайджестом» из
 * одного пункта в случайный час.
 *
 * Метка прошлой отправки лежит в отдельном поле notificationDigestLastAt,
 * НЕ внутри notificationPreferences: настройки сохраняются целым объектом,
 * и метка внутри него стиралась бы каждым сохранением экрана настроек.
 */

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 час
const PERIOD_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};
// В письмо кладём не больше стольких событий — остальное сворачивается в счётчик.
const MAX_ITEMS = 20;

let timer = null;
let running = false;

const pluralEvents = (n) => {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return "событий";
  if (d > 1 && d < 5) return "события";
  if (d === 1) return "событие";
  return "событий";
};

export const buildDigestEmail = (notifications, periodLabel) => {
  const total = notifications.length;
  const shown = notifications.slice(0, MAX_ITEMS);
  const rest = total - shown.length;

  const items = shown
    .map(
      (item) => `
        <li style="margin:0 0 14px 0">
          <div style="font-weight:700;color:#111">${escapeHtml(item.title || "")}</div>
          <div style="color:#555;font-size:14px">${escapeHtml(item.description || "")}</div>
        </li>`,
    )
    .join("");

  return {
    subject: `Дайджест Avtotime: ${total} ${pluralEvents(total)} ${periodLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#111">Пока вас не было</h2>
        <ul style="list-style:none;padding:0;margin:20px 0">${items}</ul>
        ${rest > 0 ? `<p style="color:#888;font-size:13px">И ещё ${rest} ${pluralEvents(rest)} — все они в приложении.</p>` : ""}
        <a href="${escapeHtml(process.env.CLIENT_URL || "https://avtotime.org")}"
           style="display:inline-block;margin:8px 0;padding:10px 22px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Открыть Avtotime</a>
      </div>
    `,
  };
};

/** Один проход по всем дайджестным пользователям. Возвращает счётчики для логов и тестов. */
export const runNotificationDigestOnce = async (now = new Date()) => {
  // Без ключа почта не уйдёт — незачем и собирать.
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  if (running) return { skipped: true };
  running = true;

  let sent = 0;
  let stamped = 0;

  try {
    const users = await User.find({
      email: { $nin: [null, ""] },
      "notificationPreferences.emailNotifications": true,
      "notificationPreferences.digestFrequency": { $in: ["daily", "weekly"] },
    })
      .select("_id email notificationPreferences notificationDigestLastAt")
      .lean();

    for (const user of users) {
      const period = PERIOD_MS[user.notificationPreferences.digestFrequency];
      const last = user.notificationDigestLastAt ? new Date(user.notificationDigestLastAt).getTime() : 0;

      // Срок ещё не подошёл — пользователь подождёт своего часа.
      if (last && now.getTime() - last < period) continue;

      // Всё, что накопилось с прошлого письма. Только первый прогон (метки
      // ещё нет) ограничен глубиной периода — не раскапывать древнюю историю.
      const since = new Date(last || now.getTime() - period);

      try {
        const unsent = await Notification.find({
          recipient: user._id,
          emailSent: { $ne: true },
          createdAt: { $gt: since },
        })
          .sort({ createdAt: -1 })
          .limit(200)
          .select("_id title description")
          .lean();

        if (unsent.length > 0) {
          const periodLabel = user.notificationPreferences.digestFrequency === "weekly" ? "за неделю" : "за день";
          const { subject, html } = buildDigestEmail(unsent, periodLabel);
          await sendViaResend({ to: user.email, subject, html });
          await Notification.updateMany(
            { _id: { $in: unsent.map((item) => item._id) } },
            { emailSent: true },
          );
          sent += 1;
        }

        // Срок двигается и при пустом периоде: ритм отправки не должен зависеть
        // от того, было ли в нём что-то.
        await User.updateOne({ _id: user._id }, { notificationDigestLastAt: now });
        stamped += 1;
      } catch (err) {
        console.error(`notificationDigestCron: user ${user._id} failed:`, err?.message || err);
      }
    }
  } finally {
    running = false;
  }

  return { sent, stamped };
};

export const startNotificationDigestCron = (intervalMs = DEFAULT_INTERVAL_MS) => {
  if (timer) return;
  timer = setInterval(() => {
    runNotificationDigestOnce().catch((err) =>
      console.error("notificationDigestCron failed:", err?.message || err),
    );
  }, intervalMs);
  // Пусть процесс может выйти, не дожидаясь таймера.
  timer.unref?.();
};

export const stopNotificationDigestCron = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
