import jwt from 'jsonwebtoken'

const genToken = (userId, tokenVersion = 0) => {
    // Long-lived so mobile users stay signed in; the token is refreshed on
    // each session load (sliding session) and revocable via tokenVersion.
    const expiresIn = process.env.JWT_EXPIRES_IN || '90d'
    return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn })
}

export default genToken
