// Transactional email via Resend (https://resend.com).
// Configure on the server (.env.production):
//   RESEND_API_KEY=re_...            (secret — never commit)
//   RESEND_FROM=Avtotime <noreply@avtotime.org>   (domain must be verified in Resend)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Avtotime <noreply@avtotime.org>';
const MAIL_TIMEOUT_MS = 8000;

export const sendViaResend = async ({ to, subject, html }) => {
    if (!RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
        signal: AbortSignal.timeout(MAIL_TIMEOUT_MS),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Resend error ${response.status}: ${body.slice(0, 200)}`);
    }

    return response.json().catch(() => ({}));
};

const sendMail = async (to, otp) => {
    await sendViaResend({
        to,
        subject: 'Сброс пароля — Avtotime',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#111">Сброс пароля</h2>
                <p>Ваш код для сброса пароля:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#111">${otp}</p>
                <p style="color:#888;font-size:13px">Код действителен 5 минут. Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>
            </div>
        `,
    });
};

export const sendVerificationMail = async (to, verifyUrl) => {
    await sendViaResend({
        to,
        subject: 'Подтвердите ваш email — Avtotime',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#111">Добро пожаловать в Avtotime!</h2>
                <p>Нажмите кнопку ниже, чтобы подтвердить ваш email-адрес и получить полный доступ к платформе.</p>
                <a href="${verifyUrl}"
                   style="display:inline-block;margin:20px 0;padding:12px 28px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">
                    Подтвердить email
                </a>
                <p style="color:#888;font-size:13px">Ссылка действительна 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.</p>
            </div>
        `,
    });
};

export default sendMail;
