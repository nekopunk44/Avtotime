import { randomInt, randomBytes, createHash } from 'crypto'
import sendMail, { sendVerificationMail } from '../config/Mail.js'
import genToken from '../config/token.js'
import User from '../models/user.model.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getAuthCookieName } from '../config/authCookie.js'
import { getPlanLimits, serializePlanLimits, getEffectivePlan } from '../config/planLimits.js'
import { invalidateAuthSession } from '../services/authSessionCache.js'

const generateVerifyToken = () => {
    const token = randomBytes(32).toString('hex')
    const hash = createHash('sha256').update(token).digest('hex')
    return { token, hash }
}

// `select: false` only hides fields from queries — a document built by
// User.create() or fetched with an explicit `+field` projection still carries
// them, so every secret has to be stripped before the document is serialised.
const SECRET_FIELDS = [
    'password',
    'resetOtp',
    'otpExpires',
    'emailVerifyToken',
    'emailVerifyExpires',
    'expoPushTokens',
    'stripeCustomerId',
    'tokenVersion',
]

const toSafeUser = (user) => {
    const safeUser = user.toObject()
    for (const field of SECRET_FIELDS) delete safeUser[field]
    return safeUser
}

const buildSessionUser = async (token) => {
    if (!token) {
        return null
    }

    const verifyToken = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(verifyToken.userId)
        // tokenVersion is select:false in the schema but is compared with the
        // JWT below, so it has to be requested explicitly.
        .select('-password +tokenVersion')
        .populate([
            { path: 'following', select: 'name userName profileImage bio profession' },
            { path: 'followers', select: 'name userName profileImage bio profession' },
        ])

    if (!user) {
        return null
    }

    const tokenVersionInJwt = verifyToken.tokenVersion ?? 0
    if ((user.tokenVersion ?? 0) !== tokenVersionInJwt) {
        return null
    }

    if (user.isBanned) {
        return null
    }

    const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt)
    const planLimits = serializePlanLimits(getPlanLimits(effectivePlan))

    const userObj = user.toObject()
    userObj.effectivePlan = effectivePlan
    userObj.planLimits = planLimits

    return userObj
}

const setAuthCookie = (res, token) => {
    const isProd = process.env.NODE_ENV === 'production'
    const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'None' : 'Lax')
    const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd

    res.cookie(getAuthCookieName(), token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure,
        sameSite,
    })
}

export const signUp = async (req, res) => {
    try {
        const { password } = req.body
        const name = String(req.body.name ?? '').trim().slice(0, 80)
        const email = req.body.email?.trim().toLowerCase()
        const userName = req.body.userName?.trim()

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Введите корректный email' })
        }
        if (!userName || !/^[a-zA-Z0-9_.]{3,30}$/.test(userName)) {
            return res.status(400).json({ message: 'Username: 3-30 символов, только латиница, цифры, точка и _' })
        }
        if (!name) {
            return res.status(400).json({ message: 'Введите имя' })
        }

        const findByEmail = await User.findOne({ email })
        if (findByEmail) {
            return res.status(400).json({ message: 'Этот email уже зарегистрирован!' })
        }

        const findByUserName = await User.findOne({ userName })
        if (findByUserName) {
            return res.status(400).json({ message: 'Этот username уже занят!' })
        }

        if (!password || password.length < 8) {
            return res.status(400).json({ message: 'Пароль должен быть не короче 8 символов' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await User.create({
            name,
            userName,
            email,
            password: hashedPassword,
        })

        // If email is not configured (local dev) — auto-verify so nothing is blocked
        if (!process.env.RESEND_API_KEY) {
            user.isEmailVerified = true
            await user.save()
        } else {
            const { token: verifyToken, hash } = generateVerifyToken()
            user.emailVerifyToken = hash
            user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
            await user.save()

            const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
            await sendVerificationMail(email, `${clientUrl}/verify-email?token=${verifyToken}`).catch(() => {})
        }

        const token = genToken(user._id, user.tokenVersion ?? 0)
        setAuthCookie(res, token)

        return res.status(201).json({ ...toSafeUser(user), token })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка регистрации: ${error}` })
    }
}

export const signIn = async (req, res) => {
    try {
        const { password } = req.body
        const identifier = req.body.identifier?.trim() || req.body.userName?.trim() || req.body.email?.trim()

        // password and tokenVersion are select:false — both are needed here.
        const user = await User.findOne({
            $or: [
                { userName: identifier },
                { email: identifier },
                { email: identifier?.toLowerCase() }
            ]
        }).select('+password +tokenVersion')

        if (!user) {
            return res.status(400).json({ message: 'Неверный логин или пароль' })
        }

        if (typeof user.password !== 'string' || !user.password) {
            return res.status(400).json({
                message: user.googleId
                    ? 'Этот аккаунт создан через Google. В Expo Go Google-вход недоступен; задайте пароль через восстановление пароля.'
                    : 'Для этого аккаунта пароль не задан. Восстановите пароль по email.'
            })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: 'Неверный логин или пароль' })
        }

        const token = genToken(user._id, user.tokenVersion ?? 0)
        setAuthCookie(res, token)

        return res.status(200).json({ ...toSafeUser(user), token })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка входа: ${error}` })
    }
}

export const signOut = async (req, res) => {
    try {
        const isProd = process.env.NODE_ENV === 'production'
        const sameSite = process.env.COOKIE_SAMESITE || (isProd ? 'None' : 'Lax')
        const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd
        // Clear both current cookie name and legacy `token` to prevent "stuck" sessions when config changes.
        const names = new Set([getAuthCookieName(), 'token'])
        for (const name of names) {
            res.clearCookie(name, {
                httpOnly: true,
                secure,
                sameSite,
            })
        }
        if (req.userId) await invalidateAuthSession(req.userId).catch(() => {})
        return res.status(200).json({ message: 'Вы вышли' })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка выхода: ${error}` })
    }
}

export const getSession = async (req, res) => {
    try {
        // Web sends the JWT as a cookie; the mobile client sends
        // Authorization: Bearer — accept both so /auth/me works everywhere.
        const bearer = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : null
        const token = req.cookies?.[getAuthCookieName()] || bearer
        if (!token) {
            return res.status(200).json(null)
        }

        const userObj = await buildSessionUser(token)
        return res.status(200).json(userObj)
    } catch (error) {
        return res.status(200).json(null)
    }
}

export const sendOtp = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase()
        if (!email) {
            return res.status(400).json({ message: 'Введите email' })
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: 'Пользователь не найден' })
        }

        const otp = randomInt(100000, 999999).toString()
        user.resetOtp = await bcrypt.hash(otp, 10)
        user.otpExpires = Date.now() + 5 * 60 * 1000
        user.isOtpVerified = false

        await user.save()
        try {
            await sendMail(email, otp)
        } catch (mailError) {
            console.error('Password reset email failed:', mailError)
            user.resetOtp = undefined
            user.otpExpires = undefined
            user.isOtpVerified = false
            await user.save().catch(() => {})
            return res.status(503).json({
                message: 'Не удалось отправить код: почтовый сервер сейчас недоступен. Попробуйте позже.'
            })
        }

        return res.status(200).json({ message: 'Код отправлен на email' })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка отправки кода: ${error}` })
    }
}

export const verifyOtp = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase()
        const { otp } = req.body
        const user = await User.findOne({ email }).select('+resetOtp +otpExpires')

        if (!user || !user.resetOtp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Код недействителен или просрочен' })
        }

        const isValidOtp = await bcrypt.compare(otp, user.resetOtp)
        if (!isValidOtp) {
            return res.status(400).json({ message: 'Код недействителен или просрочен' })
        }

        user.isOtpVerified = true
        user.resetOtp = undefined
        // Verified OTP is only good for 10 minutes — reuse otpExpires as the
        // reset-password window so a stale verification can't be used later.
        user.otpExpires = Date.now() + 10 * 60 * 1000

        await user.save()
        return res.status(200).json({ message: 'OTP verified' })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка проверки OTP: ${error}` })
    }
}

export const resetPassword = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase()
        const { password } = req.body

        if (!password || password.length < 8) {
            return res.status(400).json({ message: 'Пароль должен быть не короче 8 символов' })
        }

        const user = await User.findOne({ email }).select('+otpExpires +tokenVersion')
        if (!user || !user.isOtpVerified || !user.otpExpires || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Сначала подтвердите OTP-код' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        user.password = hashedPassword
        user.isOtpVerified = false
        user.tokenVersion = (user.tokenVersion || 0) + 1
        await user.save()
        await invalidateAuthSession(String(user._id)).catch(() => {})

        return res.status(200).json({ message: 'Пароль успешно изменён' })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка смены пароля: ${error}` })
    }
}

export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body
        if (!token) return res.status(400).json({ message: 'Токен не указан' })

        const hash = createHash('sha256').update(token).digest('hex')
        const user = await User.findOne({ emailVerifyToken: hash }).select('+emailVerifyToken +emailVerifyExpires')

        if (!user) {
            return res.status(400).json({ message: 'Ссылка недействительна или истекла' })
        }

        if (user.isEmailVerified) {
            return res.status(200).json({ message: 'Email уже подтверждён' })
        }

        const expiresAt = user.emailVerifyExpires instanceof Date ? user.emailVerifyExpires.getTime() : 0
        if (!expiresAt || expiresAt <= Date.now()) {
            return res.status(400).json({ message: 'Ссылка недействительна или истекла' })
        }

        user.isEmailVerified = true
        // Keep token hash so repeated clicks (or React strict-mode double calls) are idempotent.
        // We clear only the expiry to prevent "expired" UI after a successful verification.
        user.emailVerifyExpires = null
        await user.save()

        return res.status(200).json({ message: 'Email успешно подтверждён' })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка подтверждения: ${error}` })
    }
}

export const signInWithGoogle = async (req, res) => {
    try {
        const { credential } = req.body
        if (!credential) return res.status(400).json({ message: 'Google credential не указан' })

        const clientId = process.env.GOOGLE_CLIENT_ID
        if (!clientId) return res.status(503).json({ message: 'Google OAuth не настроен на сервере' })

        const tokenInfoRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
            { signal: AbortSignal.timeout(10_000) }
        )
        if (!tokenInfoRes.ok) {
            return res.status(401).json({ message: 'Недействительный Google токен' })
        }
        const tokenInfo = await tokenInfoRes.json()

        if (tokenInfo.aud !== clientId) {
            return res.status(401).json({ message: 'Недействительный Google токен' })
        }
        if (tokenInfo.error) {
            return res.status(401).json({ message: 'Google токен отклонён' })
        }

        const { sub: googleId, email, name, picture } = tokenInfo
        if (!googleId || !email) {
            return res.status(400).json({ message: 'Не удалось получить данные из Google аккаунта' })
        }

        let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] }).select('+tokenVersion')

        if (!user) {
            // Генерируем уникальный username из email
            let base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
            if (base.length < 3) base = `user${Date.now().toString().slice(-6)}`
            let userName = base
            let counter = 0
            while (await User.exists({ userName })) {
                counter++
                userName = `${base}${counter}`
            }

            user = await User.create({
                name: name || base,
                userName,
                email: email.toLowerCase(),
                googleId,
                profileImage: picture || undefined,
                isEmailVerified: true,
            })
        } else {
            let changed = false
            if (!user.googleId) { user.googleId = googleId; changed = true }
            if (!user.isEmailVerified) { user.isEmailVerified = true; changed = true }
            if (!user.profileImage && picture) { user.profileImage = picture; changed = true }
            if (changed) await user.save()
        }

        if (user.isBanned) {
            const reason = user.banReason ? ` Причина: ${user.banReason}` : ''
            return res.status(403).json({ message: `Ваш аккаунт заблокирован.${reason}` })
        }

        const token = genToken(user._id, user.tokenVersion ?? 0)
        setAuthCookie(res, token)
        return res.status(200).json({ ...toSafeUser(user), token })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка Google-аутентификации: ${error?.message || error}` })
    }
}

export const resendVerification = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
        if (user.isEmailVerified) return res.status(400).json({ message: 'Email уже подтверждён' })

        const { token, hash } = generateVerifyToken()
        user.emailVerifyToken = hash
        user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await user.save()

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
        try {
            await sendVerificationMail(user.email, `${clientUrl}/verify-email?token=${token}`)
        } catch (mailErr) {
            console.error('Verification mail error:', mailErr?.message)
            return res.status(200).json({ message: 'Ссылка сохранена, но письмо не удалось отправить. Проверьте настройки почты.' })
        }

        return res.status(200).json({ message: 'Письмо отправлено' })
    } catch (error) {
        return res.status(500).json({ message: `Ошибка: ${error}` })
    }
}
