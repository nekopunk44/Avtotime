import jwt from 'jsonwebtoken'

const genToken = (userId, tokenVersion = 0) => {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
    return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn })
}

export default genToken
