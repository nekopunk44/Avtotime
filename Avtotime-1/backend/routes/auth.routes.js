import express from 'express'
import { getSession, signIn, signUp, signOut, sendOtp, verifyOtp, resetPassword, verifyEmail, resendVerification, signInWithGoogle } from '../controllers/auth.controllers.js'
import { authLimiter } from '../middlewars/rateLimiters.js'
import isAuth from '../middlewars/isAuth.js'

const authRouter = express.Router()

authRouter.post('/signup', authLimiter, signUp)
authRouter.post('/signin', authLimiter, signIn)
authRouter.post('/google', authLimiter, signInWithGoogle)
authRouter.get('/session', getSession)
authRouter.post('/sendOtp', authLimiter, sendOtp)
authRouter.post('/verifyOtp', authLimiter, verifyOtp)
authRouter.post('/resetPassword', authLimiter, resetPassword)
authRouter.get('/signout', signOut)
authRouter.post('/verify-email', authLimiter, verifyEmail)
authRouter.post('/resend-verification', isAuth, authLimiter, resendVerification)

export default authRouter
