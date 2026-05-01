import React from "react";
import { useNavigate } from "react-router-dom";

const EFFECTIVE_DATE = "23 апреля 2026";
const CONTACT_EMAIL = "avtotimereal@gmail.com";

export default function PrivacyPolicy({ inModal = false, onClose }) {
  const navigate = useNavigate();

  return (
    <div
      className={`privacy-policy ${inModal ? "bg-white px-6 py-6" : "min-h-screen bg-white px-6 py-10"}`}
      data-modal={inModal ? "true" : "false"}
    >
      <div className="mx-auto w-full max-w-[920px]">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-black text-gray-900">Политика конфиденциальности (персональных данных)</h1>
            <p className="mt-2 text-[13px] text-gray-500">Дата вступления в силу: {EFFECTIVE_DATE}</p>
          </div>
          <button
            onClick={() => (inModal ? onClose?.() : navigate(-1))}
            className="privacy-policy-nav rounded-2xl border border-gray-200 px-4 py-2 text-[14px] font-bold text-gray-700 hover:bg-gray-50"
          >
            Назад
          </button>
        </div>

        <div className="space-y-6 text-[15px] leading-7 text-gray-800">
          <p>
            Эта Политика объясняет, какие данные мы собираем при использовании Avtotime (лента, сообщения, маркетплейс и
            другие разделы), зачем они нужны, кому и когда могут быть переданы, как долго мы их храним и какие права есть
            у пользователя.
          </p>

          <div className="rounded-2xl bg-gray-50 p-5 text-[14px] leading-6 text-gray-700">
            <div className="font-bold text-gray-900">Важно</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Если вы работаете с пользователями из ЕС/ЕЭЗ, добавьте блоки про GDPR (правовое основание/ДПА и т.д.).</li>
              <li>Если используются сторонние сервисы (Cloudinary, Stripe и др.), убедитесь, что это отражено в разделе 5.</li>
            </ul>
          </div>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">1. Какие данные мы собираем</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Данные аккаунта: имя, username, email, пароль (хранится в виде хеша), фото профиля.</li>
              <li>Контент: посты, комментарии, сообщения, изображения/видео, объявления и их описания.</li>
              <li>Данные объявлений: марка/модель/год и другие параметры, регион/локация, цена и пр.</li>
              <li>Технические данные: IP-адрес, тип устройства/браузера, данные журналов, cookies (если используются).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">2. Зачем мы используем данные</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Создание и управление аккаунтом, вход в систему, подтверждение email.</li>
              <li>Работа основных функций платформы (лента, сообщения, маркетплейс, уведомления).</li>
              <li>Модерация контента и предотвращение злоупотреблений/спама.</li>
              <li>Улучшение качества сервиса, аналитика и диагностика ошибок.</li>
              <li>Связь с вами по вопросам безопасности и работы аккаунта.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">3. Правовые основания</h2>
            <p>
              Мы обрабатываем данные в объёме, необходимом для исполнения договора (предоставления сервиса), выполнения
              юридических обязанностей, защиты законных интересов (безопасность/антифрод) и на основании вашего согласия
              там, где оно требуется.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">4. Хранение и безопасность</h2>
            <p>
              Мы храним данные столько, сколько нужно для целей, описанных в этой Политике, либо в сроки, требуемые
              законом. Мы применяем разумные технические и организационные меры защиты, но ни один способ передачи/хранения
              данных не гарантирует абсолютную безопасность.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">5. Передача третьим лицам</h2>
            <p>
              Мы можем привлекать сторонние сервисы (например, почтовый провайдер для отправки писем подтверждения,
              хостинг/хранение медиафайлов, платёжные сервисы) для обеспечения работы платформы. Такие сервисы получают
              доступ только в объёме, необходимом для оказания услуг.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">6. Cookies</h2>
            <p>
              Мы можем использовать cookies и похожие технологии для аутентификации, безопасности и улучшения работы
              платформы. Вы можете ограничить использование cookies в настройках браузера, но некоторые функции могут
              работать некорректно.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">7. Ваши права</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Запросить доступ к данным и получить их копию.</li>
              <li>Исправить неточные данные.</li>
              <li>Удалить аккаунт и связанные данные (если это допускается законом).</li>
              <li>Ограничить обработку или возразить против обработки в отдельных случаях.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">8. Контакты для обращений</h2>
            <p>
              По вопросам конфиденциальности и обработки данных свяжитесь с нами:{" "}
              <a className="font-bold text-black underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">9. Изменения политики</h2>
            <p>
              Мы можем обновлять эту Политику. Актуальная версия всегда доступна на этой странице. Если изменения будут
              существенными, мы постараемся уведомить вас через приложение.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-[18px] font-black text-gray-900">10. Возрастные ограничения</h2>
            <p>
              Сервис не предназначен для использования детьми, если это запрещено законами вашей страны. Если вы считаете,
              что ребёнок предоставил нам данные, напишите на контактный email.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
