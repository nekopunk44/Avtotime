import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import { getAuthCookieName } from '../config/authCookie.js'
import { checkSession } from '../services/sessionGuard.js'

const isAuth = async (req, res, next) => {
    try {
        // Support Bearer token for mobile clients
        let token = req.cookies?.[getAuthCookieName()]
        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.slice(7)
        }
        if (!token) {
            return res.status(401).json({ message: 'token is not found' })
        }

        const verifyToken = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = verifyToken.userId

        // Shared with the socket handshake (services/sessionGuard.js), so the
        // two entrances cannot drift apart again: same cache, same rules.
        const session = await checkSession(req.userId, verifyToken.tokenVersion ?? 0)
        if (!session.ok) {
            if (session.reason === 'banned') {
                const reason = session.banReason ? ` Причина: ${session.banReason}` : ''
                return res.status(403).json({ message: `Ваш аккаунт заблокирован.${reason}` })
            }
            if (session.reason === 'missing') {
                return res.status(401).json({ message: 'Пользователь не найден' })
            }
            return res.status(401).json({ message: 'Сессия устарела, войдите снова' })
        }

        // Throttled activity tracking (once per 5 min, fire-and-forget). Only
        // when the guard actually read the document: a cache hit carries no
        // lastSeenAt, and that skip is the same behaviour as before.
        if (!session.fromCache) {
            const now = new Date()
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
            if (!session.lastSeenAt || session.lastSeenAt < fiveMinutesAgo) {
                User.updateOne({ _id: req.userId }, { $set: { lastSeenAt: now } }).catch(() => {})
            }
        }

        next()
    } catch (error) {
        return res.status(401).json({ message: `Is auth error ${error?.message || error}` })
    }
}

export default isAuth
