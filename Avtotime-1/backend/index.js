import "./config/bootstrapEnv.js"
import express from "express"
import connectDb from "./config/db.js"
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
import paymentRouter from "./routes/payment.routes.js"
import { stripeWebhook } from "./controllers/payment.controllers.js"
import { startMarketModerationWorker } from "./moderation/marketModerationWorker.js"
import { startPlanExpirationCron } from "./services/planExpirationCron.js"
import cluster from "node:cluster"
import {app, server, initializeSocketInfrastructure} from './socket.js'
import { ensureDevSeed } from "./services/devSeed.js"
import { getAllowedOrigins } from "./config/origins.js"
import { apiLimiter } from "./middlewars/rateLimiters.js"
import { notFoundHandler, errorHandler } from "./middlewars/errorHandlers.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const port=process.env.PORT || 8000

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

app.use(cors({
    origin: getAllowedOrigins(),
    credentials: true, 
}))
app.use("/api", apiLimiter)

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
app.use('/api/payment', paymentRouter)

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        ok: true,
        uptime: process.uptime(),
        env: process.env.NODE_ENV || "unknown",
        timestamp: new Date().toISOString(),
    })
})

app.get("/", (req, res)=> {
    res.send('hello')
})

// Global error handlers — prevent unhandled rejections from crashing workers silently
process.on('unhandledRejection', (reason) => {
    console.error('[fatal] Unhandled promise rejection:', reason)
    process.exit(1)
})

process.on('uncaughtException', (error) => {
    console.error('[fatal] Uncaught exception:', error)
    process.exit(1)
})

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET) {
            console.error('FATAL: JWT_SECRET is not set. Refusing to start.')
            process.exit(1)
        }

        await connectDb()
        await initializeSocketInfrastructure()

        // Load test data only in development (unless SKIP_DEV_SEED is set)
        if (process.env.NODE_ENV !== 'production' && process.env.SKIP_DEV_SEED !== 'true') {
            await ensureDevSeed()
        }

        // Run the background moderation worker only on one process to avoid
        // redundant DB polling when clustered. Worker id 1 is the first forked
        // worker; falls back to always-run in non-clustered (dev) mode.
        if (!cluster.isWorker || cluster.worker?.id === 1) {
            startMarketModerationWorker()
            startPlanExpirationCron()
        }

        server.on('error', (err) => {
            if (err?.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Stop the other process or change PORT in .env.`)
                process.exit(1)
            }
            console.error('Server error:', err?.message || err)
            process.exit(1)
        })

        // Tune for reverse proxies / keep-alive (helps stability under concurrency).
        server.keepAliveTimeout = 65_000
        server.headersTimeout = 70_000

        server.listen(port, () => {
            console.log(`server started on port ${port}`)
        })

        // Graceful shutdown — finish in-flight requests before exiting
        const shutdown = (signal) => {
            console.log(`[shutdown] ${signal} received, draining connections...`)
            server.close(() => {
                console.log('[shutdown] HTTP server closed, exiting.')
                process.exit(0)
            })
            // Force exit if drain takes too long
            setTimeout(() => {
                console.error('[shutdown] Drain timeout, forcing exit.')
                process.exit(1)
            }, 30_000).unref()
        }

        process.on('SIGTERM', () => shutdown('SIGTERM'))
        process.on('SIGINT',  () => shutdown('SIGINT'))

    } catch (error) {
        console.error('Server startup failed:', error?.message || error)
        process.exit(1)
    }
}

app.use(notFoundHandler)
app.use(errorHandler)

startServer()
