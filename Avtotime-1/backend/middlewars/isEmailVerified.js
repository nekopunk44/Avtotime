import User from '../models/user.model.js'

const isEmailVerified = async (req, res, next) => {
    const user = await User.findById(req.userId).select('isEmailVerified').lean()
    if (!user?.isEmailVerified) {
        return res.status(403).json({ message: 'Сначала подтвердите email-адрес' })
    }
    next()
}

export default isEmailVerified
