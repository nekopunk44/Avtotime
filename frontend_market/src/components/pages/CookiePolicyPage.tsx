import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
    <div className="text-gray-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

export const CookiePolicyPage: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Политика использования файлов Cookie</h1>
        <p className="text-sm text-gray-400 mb-10">Последнее обновление: 1 июня 2026 г.</p>

        <Section title="1. Что такое cookie-файлы">
          <p>Cookie-файлы — это небольшие текстовые файлы, которые сохраняются на вашем устройстве при посещении сайта. Они помогают платформе запомнить ваши настройки, поддерживать сессию входа и улучшать работу сервиса.</p>
        </Section>

        <Section title="2. Какие cookie мы используем">
          <p><strong>Обязательные cookie</strong> — необходимы для работы платформы. Они обеспечивают авторизацию, безопасность и базовые функции. Без них платформа не может корректно работать.</p>
          <p><strong>Функциональные cookie</strong> — запоминают ваши предпочтения: язык, регион, настройки фильтров. Улучшают удобство использования.</p>
          <p><strong>Аналитические cookie</strong> — собирают анонимную статистику посещений (количество пользователей, популярные страницы). Помогают нам улучшать платформу.</p>
          <p><strong>Сессионные cookie</strong> — хранят данные о текущей сессии входа в аккаунт. Удаляются при закрытии браузера.</p>
        </Section>

        <Section title="3. Срок хранения">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Сессионные cookie:</strong> удаляются при закрытии вкладки или браузера;</li>
            <li><strong>Постоянные cookie:</strong> хранятся до 1 года или до ручного удаления;</li>
            <li><strong>Аналитические cookie:</strong> хранятся до 13 месяцев.</li>
          </ul>
        </Section>

        <Section title="4. Сторонние cookie">
          <p>Отдельные функции платформы могут использовать сервисы третьих сторон (платёжные системы, карты). Эти сервисы могут устанавливать собственные cookie. Мы не контролируем cookie третьих сторон — рекомендуем ознакомиться с их политиками конфиденциальности.</p>
        </Section>

        <Section title="5. Управление cookie">
          <p>Вы можете управлять cookie-файлами через настройки браузера: разрешить, заблокировать или удалить их. Обратите внимание, что отключение обязательных cookie может нарушить работу платформы.</p>
          <p>Инструкции для популярных браузеров:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Chrome:</strong> Настройки → Конфиденциальность и безопасность → Файлы cookie;</li>
            <li><strong>Firefox:</strong> Настройки → Приватность и защита;</li>
            <li><strong>Safari:</strong> Настройки → Конфиденциальность;</li>
            <li><strong>Edge:</strong> Настройки → Файлы cookie и разрешения сайта.</li>
          </ul>
        </Section>

        <Section title="6. Изменения политики">
          <p>Мы можем обновлять настоящую Политику при изменении используемых технологий. Дата последнего обновления указана в верхней части страницы.</p>
        </Section>

        <Section title="7. Контакты">
          <p>По вопросам использования cookie пишите нам: <span className="text-blue-600">support@avtotime.org</span></p>
        </Section>
      </div>
    </div>
  );
};
