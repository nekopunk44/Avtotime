import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'
import { getAuthCookieName } from '../config/authCookie.js'

const isAuth = async (req, res, next)=>{
    try{
        const token = req.cookies?.[getAuthCookieName()]
        if(!token){
            return res.status(401).json({message: 'token is not found'})
        }

        const verifyToken = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = verifyToken.userId

        // tokenVersion check: invalidates all tokens issued before logoutAll
        const tokenVersionInJwt = verifyToken.tokenVersion ?? 0
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

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

        // Best-effort activity tracking (throttled to once per 5 min)
        try {
            if (!user.lastSeenAt || user.lastSeenAt < fiveMinutesAgo) {
                await User.updateOne({ _id: req.userId }, { $set: { lastSeenAt: now } })
            }
        } catch {
            // ignore
        }
        next()

    } catch (error) {
        return res.status(401).json({message: `Is auth error ${error?.message || error}`})
    }
}

export default isAuth
