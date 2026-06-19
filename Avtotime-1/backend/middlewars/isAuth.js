import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import { getAuthCookieName } from '../config/authCookie.js'
import { getCachedAuthSession, setCachedAuthSession } from '../services/authSessionCache.js'

const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.[getAuthCookieName()]
        if (!token) {
            return res.status(401).json({ message: 'token is not found' })
        }

        const verifyToken = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = verifyToken.userId

        const tokenVersionInJwt = verifyToken.tokenVersion ?? 0

        // Try Redis cache first to avoid DB query on every request
        const cached = await getCachedAuthSession(req.userId)
        if (cached) {
            if ((cached.tokenVersion ?? 0) !== tokenVersionInJwt) {
                return res.status(401).json({ message: 'Сессия устарела, войдите снова' })
            }
            if (cached.isBanned) {
                const reason = cached.banReason ? ` Причина: ${cached.banReason}` : ''
                return res.status(403).json({ message: `Ваш аккаунт заблокирован.${reason}` })
            }
            return next()
        }

        // Cache miss — query DB and populate cache
        const user = await User.findById(req.userId).select('tokenVersion lastSeenAt isBanned banReason')
        if (!user) {
            return res.status(401).json({ message: 'Пользователь не найден' })
        }
        if ((user.tokenVersion ?? 0) !== tokenVersionInJwt) {
            return res.status(401).json({ message: 'Сессия устарела, войдите снова' })
        }
        if (user.isBanned) {
            const reason = user.banReason ? ` Причина: ${user.banReason}` : ''
            return res.status(403).json({ message: `Ваш аккаунт заблокирован.${reason}` })
        }

        // Cache auth data so subsequent requests skip the DB
        await setCachedAuthSession(req.userId, {
            tokenVersion: user.tokenVersion ?? 0,
            isBanned: user.isBanned ?? false,
            banReason: user.banReason ?? null,
        })

        // Throttled activity tracking (once per 5 min, fire-and-forget)
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
        if (!user.lastSeenAt || user.lastSeenAt < fiveMinutesAgo) {
            User.updateOne({ _id: req.userId }, { $set: { lastSeenAt: now } }).catch(() => {})
        }

        next()
    } catch (error) {
        return res.status(401).json({ message: `Is auth error ${error?.message || error}` })
    }
}

export default isAuth
