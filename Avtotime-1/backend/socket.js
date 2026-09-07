import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { getAllowedOrigins } from "./config/origins.js";
import { getAuthCookieName } from "./config/authCookie.js";
import { checkSession } from "./services/sessionGuard.js";
import { initializeSocketRedisAdapter } from "./config/redis.js";

const parseCookies = (cookieHeader = "") => {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) return acc;
      const key = part.slice(0, eqIndex).trim();
      const value = decodeURIComponent(part.slice(eqIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
};

// Controllers import the `io` binding directly and call `io.to(...).emit(...)`.
// Until createSocketServer() runs (tests, one-off scripts) the binding points at
// this sink so those emits are silently dropped instead of throwing.
const createNoopIo = () => {
  const noop = () => {};
  const room = { emit: noop };
  return {
    emit: noop,
    to: () => room,
    in: () => room,
    sockets: { sockets: new Map() },
    adapter: noop,
  };
};

// `io` and `server` are exported as live bindings: importers see the real
// instances as soon as createSocketServer() assigns them.
let io = createNoopIo();
let server = null;
let staleCleanupTimer = null;

let onlineUsersEmitTimer = null;

/**
 * Кто онлайн — по fetchSockets() адаптера, а не по локальной карте.
 *
 * Карта в памяти воркера видела только СВОИ подключения: при двух воркерах
 * каждый рассылал свою половину списка, и пользователи в интерфейсе мигали.
 * С redis-адаптером fetchSockets() возвращает сокеты всех воркеров (data
 * сериализуется и приезжает вместе с ними), а без Redis — локальные, то есть
 * ровно то же, что давала карта. Заодно исчезает чистка устаревших записей:
 * адаптер и есть источник истины о живых подключениях.
 */
const emitOnlineUsers = () => {
  if (onlineUsersEmitTimer) return;

  const debounceMs = Math.max(0, Number(process.env.ONLINE_USERS_EMIT_DEBOUNCE_MS || 250));
  onlineUsersEmitTimer = setTimeout(async () => {
    onlineUsersEmitTimer = null;
    try {
      const sockets = await io.fetchSockets();
      const onlineUsers = [...new Set(
        sockets.map((s) => (s.data?.userId ? String(s.data.userId) : null)).filter(Boolean),
      )];
      io.emit("getOnlineUsers", onlineUsers);
      io.emit("onlineUsersCount", onlineUsers.length);
    } catch (error) {
      // Пропущенный такт списка онлайна не стоит падения воркера; следующее
      // подключение или отключение поставит новый таймер.
      console.error("[socket] online users emit failed:", error?.message || error);
    }
  }, debounceMs);
  onlineUsersEmitTimer.unref?.();
};

const registerSocketHandlers = (ioServer) => {
  ioServer.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.request.headers.cookie);
      let token = cookies[getAuthCookieName()];
      // Support Bearer token for mobile clients
      if (!token) {
        const auth = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        if (auth?.startsWith("Bearer ")) token = auth.slice(7);
        else if (auth) token = auth;
      }
      if (!token) return next(new Error("unauthorized"));

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // jwt.verify alone is not authentication here: the HTTP path also checks
      // tokenVersion and the ban flag, and without the same check a password
      // change or a ban closed the REST API but left the old token a perfectly
      // working realtime channel.
      const session = await checkSession(payload.userId, payload.tokenVersion ?? 0);
      if (!session.ok) return next(new Error("unauthorized"));

      socket.data.userId = payload.userId;
      return next();
    } catch (err) {
      return next(new Error("unauthorized"));
    }
  });

  ioServer.on("connection", (socket) => {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[socket] connected user=${String(userId)} sid=${socket.id}`);
    }

    socket.join(String(userId));
    emitOnlineUsers();

    socket.on("disconnect", () => {
      emitOnlineUsers();

      if (process.env.NODE_ENV !== "production") {
        console.log(`[socket] disconnected user=${String(userId)} sid=${socket.id}`);
      }
    });
  });

  // Редкий страховочный пересчёт: адаптер сам источник истины, но обрыв
  // соединения без disconnect-события на другом воркере иначе оставил бы
  // клиентам устаревший список до следующего события.
  if (staleCleanupTimer) clearInterval(staleCleanupTimer);
  staleCleanupTimer = setInterval(() => emitOnlineUsers(), 5 * 60 * 1000);
  staleCleanupTimer.unref();
};

/**
 * Wraps an Express app in an http server and attaches socket.io to it.
 * Returns the pair; the module-level `io`/`server` bindings are updated too so
 * existing `import { io } from "../socket.js"` call sites keep working.
 */
export function createSocketServer(app) {
  const httpServer = http.createServer(app);

  const ioServer = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
    // No polling: the app runs as a Node cluster without sticky sessions, so a
    // polling session started on one worker breaks as soon as the next request
    // is round-robined to another ("Session ID unknown" + reconnect loop).
    // nginx already proxies Upgrade for websockets.
    transports: ["websocket"],
  });

  registerSocketHandlers(ioServer);

  server = httpServer;
  io = ioServer;

  return { server: httpServer, io: ioServer };
}

/** Current socket.io instance (a no-op sink until createSocketServer() runs). */
export function getIO() {
  return io;
}

export const initializeSocketInfrastructure = async () => {
  await initializeSocketRedisAdapter(io);
};

/**
 * Kicks every live socket a user has. Handshake-time checks only stop NEW
 * connections; the ones opened before a ban or a password change stay up until
 * something ends them — this is that something. With the redis adapter the
 * disconnect propagates to sockets on other workers too.
 */
export const disconnectUserSockets = (userId) => {
  try {
    io.in(String(userId)).disconnectSockets(true);
  } catch {
    // noop io (tests, pre-boot) has no disconnectSockets — nothing to kick.
  }
};

/** Closes the io server and the cleanup timer — for tests and shutdown. */
export const stopSocketInfrastructure = () => {
  if (staleCleanupTimer) {
    clearInterval(staleCleanupTimer);
    staleCleanupTimer = null;
  }
  try {
    io?.close?.();
  } catch {
    // already closed or noop io
  }
};

export { io, server };
