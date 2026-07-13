import nodemailer from 'nodemailer';

const MAIL_TIMEOUT_MS = 5000;

const transporter = nodemailer.createTransport({
    service: "Gmail",
    port: 465,
    secure: true,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});

const sendMail = async (to, otp) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to,
        subject: "Сбросить ваш пароль",
        html: `<p>Ваш код для сброса пароля: <b>${otp}</b>. Истекает через 5 минут.</p>`,
    });
};

export const sendVerificationMail = async (to, verifyUrl) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to,
        subject: "Подтвердите ваш email - Avtotime",
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#111">Добро пожаловать в Avtotime!</h2>
                <p>Нажмите кнопку ниже, чтобы подтвердить ваш email-адрес и получить полный доступ к платформе.</p>
                <a href="${verifyUrl}"
                   style="display:inline-block;margin:20px 0;padding:12px 28px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">
                    Подтвердить email
                </a>
                <p style="color:#888;font-size:13px">Ссылка действительна 24 часа. Если вы не регистрировались - просто проигнорируйте это письмо.</p>
            </div>
        `,
    });
};

export default sendMail;
