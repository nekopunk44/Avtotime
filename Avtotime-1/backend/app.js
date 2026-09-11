import express from "express"
import cookieParser from "cookie-parser"
import cors from 'cors'
import helmet from "helmet"
import compression from "compression"
import mongoSanitize from "express-mongo-sanitize"
import hpp from "hpp"
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeReqQueryWritable } from "./middlewars/express5Compat.js"
import authRouter from "./routes/auth.routes.js"
import userRouter from "./routes/user.routes.js"
import postRouter from "./routes/post.routes.js"
import loopRouter from "./routes/loop.routes.js"
import storyRouter from "./routes/story.routes.js"
import messageRouter from "./routes/message.routes.js"
import marketRouter from "./routes/market.routes.js"
import favoriteRouter from "./routes/favorite.routes.js"
import notificationRouter from "./routes/notification.routes.js"
import reviewRouter from "./routes/review.routes.js"
import drivingCourseRouter from "./routes/drivingCourse.routes.js"
import gamesRouter from "./routes/games.routes.js"
import carRequestRouter from "./routes/carRequest.routes.js"
import coloringRouter from "./routes/coloring.routes.js"
import adminRouter from "./routes/admin.routes.js"
import reportRouter from "./routes/report.routes.js"
import paymentRouter from "./routes/payment.routes.js"
import { stripeWebhook } from "./controllers/payment.controllers.js"
import { getAllowedOrigins } from "./config/origins.js"
import { apiLimiter } from "./middlewars/rateLimiters.js"
import { rejectForgedOrigin } from "./middlewars/csrfOrigin.js"
import { notFoundHandler, errorHandler } from "./middlewars/errorHandlers.js"
import { requestId } from "./middlewars/requestId.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds the Express application.
 *
 * Pure factory: it never listens on a port, never connects to MongoDB and never
 * creates the socket.io server — those belong to index.js. That separation is
 * what makes the app importable from tests.
 */
export function createApp() {
    const app = express()

    const trustProxyEnv = process.env.TRUST_PROXY;
    const trustProxyValue = trustProxyEnv ?? (process.env.NODE_ENV === 'production' ? '1' : null);
    if (trustProxyValue !== null && trustProxyValue !== 'false' && trustProxyValue !== '0') {
        const parsed = Number(trustProxyValue);
        app.set('trust proxy', Number.isFinite(parsed) && !isNaN(parsed) ? parsed : trustProxyValue);
    }

    app.disable("x-powered-by")
    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
                formAction: ["'self'"],
                baseUri: ["'self'"],
            },
        },
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }))
    app.use(compression())

    // Stripe webhook needs raw body — must come before express.json()
    app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

    app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));
    app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || "2mb" }))
    app.use(cookieParser())

    // Express v5 exposes `req.query` as a getter; `express-mongo-sanitize` expects it to be writable.
    app.use(makeReqQueryWritable)
    app.use(mongoSanitize())
    app.use(hpp())

    // Before anything that can fail, so every log line and every error response
    // can be tied back to one request.
    app.use(requestId)

    app.use(cors({
        origin: getAllowedOrigins(),
        credentials: true,
    }))
    app.use("/api", apiLimiter)
    // CSRF floor for every mutating route — see middlewars/csrfOrigin.js.
    app.use("/api", rejectForgedOrigin)

    // API-ответы не кэшируются. Express по умолчанию вешает ETag, и клиент с
    // HTTP-кэшем (okhttp в мобильном приложении) присылает If-None-Match и
    // получает 304 с ПУСТЫМ телом — для axios это ошибка, экран остаётся без
    // данных. Персональные ответы (тариф, профиль, лента) кэшировать нечего:
    // приложение перечитывает их при каждом открытии экрана.
    app.set('etag', false)
    app.use('/api', (req, res, next) => {
        // Статика под /api/public — единственное, что кэшировать полезно.
        if (!req.path.startsWith('/public')) res.set('Cache-Control', 'no-store')
        next()
    })

    // Serve local static assets from backend/public under the API origin
    app.use("/api/public", express.static(path.join(__dirname, "public")));

    app.use('/api/auth', authRouter)
    app.use('/api/user', userRouter)
    app.use('/api/post', postRouter)
    app.use('/api/loop', loopRouter)
    app.use('/api/story', storyRouter)
    app.use('/api/message', messageRouter)
    app.use('/api/market', marketRouter)
    app.use('/api/favorites', favoriteRouter)
    app.use('/api/notifications', notificationRouter)
    app.use('/api/reviews', reviewRouter)
    app.use('/api/driving-courses', drivingCourseRouter)
    app.use('/api/games', gamesRouter)
    app.use('/api/car-request', carRequestRouter)
    app.use('/api/coloring', coloringRouter)
    app.use('/api/admin', adminRouter)
    app.use('/api/reports', reportRouter)
    app.use('/api/payment', paymentRouter)

    app.get("/api/health", (_req, res) => {
        res.status(200).json({
            ok: true,
            uptime: process.uptime(),
            env: process.env.NODE_ENV || "unknown",
            timestamp: new Date().toISOString(),
        })
    })

    app.get("/", (req, res) => {
        res.send('hello')
    })

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app
}

export default createApp
