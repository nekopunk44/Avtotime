import "./config/bootstrapEnv.js"
import cluster from "node:cluster"
import connectDb from "./config/db.js"
import { createApp } from "./app.js"
import { createSocketServer, initializeSocketInfrastructure } from "./socket.js"
import { startMarketModerationWorker } from "./moderation/marketModerationWorker.js"
import { startPlanExpirationCron } from "./services/planExpirationCron.js"
import { ensureDevSeed } from "./services/devSeed.js"
import { shouldRunBackgroundJobs } from "./config/workerRoles.js"
import { initErrorReporting, reportError, flushErrors } from "./services/errorReporter.js"

const port = process.env.PORT || 8000

const app = createApp()
const { server } = createSocketServer(app)

// Exiting on these is deliberate: a worker in an unknown state is worse than a
// restarted one, and cluster.js re-forks it. The point of reporting first is
// that the crash leaves a trace — the flush is what stops the most valuable
// event of all from dying in the buffer.
const exitAfterReporting = (kind) => async (cause) => {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    reportError(error, { fatal: true, kind })
    await flushErrors(2000)
    process.exit(1)
}

process.on('unhandledRejection', exitAfterReporting('unhandledRejection'))
process.on('uncaughtException', exitAfterReporting('uncaughtException'))

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET) {
            console.error('FATAL: JWT_SECRET is not set. Refusing to start.')
            process.exit(1)
        }

        // Before connectDb: a failure there is exactly the kind of thing that
        // should be reported rather than only printed.
        await initErrorReporting()

        await connectDb()
        await initializeSocketInfrastructure()

        // Load test data only in development (unless SKIP_DEV_SEED is set)
        if (process.env.NODE_ENV !== 'production' && process.env.SKIP_DEV_SEED !== 'true') {
            await ensureDevSeed()
        }

        // One process only, to avoid redundant DB polling when clustered. The
        // role is assigned by the primary (cluster.js) rather than derived from
        // the worker id: ids are never reused, so `id === 1` stopped being true
        // the first time that worker crashed and the jobs silently never ran
        // again. Unclustered dev runs have no primary, so they always run them.
        if (!cluster.isWorker || shouldRunBackgroundJobs()) {
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

// Importing this module starts a real server. Anything that only needs the
// Express app (tests, tooling) must import createApp() from ./app.js instead.
startServer()
