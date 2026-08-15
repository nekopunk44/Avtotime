import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { getAuthCookieName } from '../config/authCookie.js';
import { createNotification } from './notification.controllers.js';

const transporter = nodemailer.createTransport({
    service: "Gmail",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});

// User-supplied values go into HTML emails — escape them to prevent HTML
// injection into what the admin (and the user) reads.
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const sendCarRequest = async (req, res) => {
    try {
        const marca = escapeHtml(req.body.marca).slice(0, 80);
        const model = escapeHtml(req.body.model).slice(0, 80);
        const year = escapeHtml(req.body.year).slice(0, 20);
        const region = escapeHtml(req.body.region).slice(0, 80);
        const email = String(req.body.email ?? '').trim();

        // Валидация данных
        if (!marca || !model || !year || !email || !region) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны'
            });
        }

        // Email для проверки валидности
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Некорректный email' 
            });
        }

        // Формируем HTML письмо для администратора
        const adminEmailContent = `
            <h2>Новая заявка на поиск автомобиля</h2>
            <p><strong>Марка:</strong> ${marca}</p>
            <p><strong>Модель:</strong> ${model}</p>
            <p><strong>Год:</strong> ${year}</p>
            <p><strong>Регион:</strong> ${region}</p>
            <p><strong>Email пользователя:</strong> ${escapeHtml(email)}</p>
            <p><strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        `;

        // Письмо для администратора
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: 'avtotimereal@gmail.com',
            subject: `Новая заявка на автомобиль - ${marca} ${model}`,
            html: adminEmailContent
        });

        // Письмо подтверждения для пользователя
        const userEmailContent = `
            <h2>Спасибо за вашу заявку!</h2>
            <p>Мы получили вашу заявку на поиск следующего автомобиля:</p>
            <p><strong>Марка:</strong> ${marca}</p>
            <p><strong>Модель:</strong> ${model}</p>
            <p><strong>Год:</strong> ${year}</p>
            <p><strong>Регион:</strong> ${region}</p>
            <p>Мы сообщим вам как только этот автомобиль появится на нашем сайте.</p>
            <p>С уважением,<br/>Команда AutoTime</p>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: 'Ваша заявка на поиск автомобиля получена',
            html: userEmailContent
        });

        // Если пользователь авторизован, добавляем уведомление в раздел уведомлений.
        // Токен берём и из cookie (web), и из Authorization: Bearer (мобильный клиент).
        // Роут публичный, поэтому это best-effort (без ошибки для гостя).
        try {
            const bearer = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null;
            const token = req.cookies?.[getAuthCookieName()] || bearer;
            if (token) {
                const verified = jwt.verify(token, process.env.JWT_SECRET);
                const userId = verified?.userId;
                if (userId) {
                    await createNotification({
                        recipient: userId,
                        actor: userId,
                        type: 'system',
                        title: 'Заявка отправлена',
                        description: `Заявка на ${marca} ${model} (${year}) успешно отправлена. Проверьте вашу почту.`,
                    });
                }
            }
        } catch {
            // ignore
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Заявка успешно отправлена. Проверьте вашу почту.' 
        });

    } catch (error) {
        console.error('Ошибка при отправке заявки:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Ошибка при отправке заявки. Попробуйте позже.' 
        });
    }
};
