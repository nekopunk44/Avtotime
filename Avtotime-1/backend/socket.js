import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { getAllowedOrigins } from "./config/origins.js";
import { getAuthCookieName } from "./config/authCookie.js";
import { initializeSocketRedisAdapter } from "./config/redis.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

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

const onlineSocketsByUser = new Map(); // userId -> Set(socketId)
let onlineUsersEmitTimer = null;

const addOnlineSocket = (userId, socketId) => {
  const set = onlineSocketsByUser.get(userId) || new Set();
  set.add(socketId);
  onlineSocketsByUser.set(userId, set);
};

const removeOnlineSocket = (userId, socketId) => {
  const set = onlineSocketsByUser.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineSocketsByUser.delete(userId);
};

const emitOnlineUsers = () => {
  if (onlineUsersEmitTimer) return;

  const debounceMs = Math.max(0, Number(process.env.ONLINE_USERS_EMIT_DEBOUNCE_MS || 250));
  onlineUsersEmitTimer = setTimeout(() => {
    onlineUsersEmitTimer = null;
    const onlineUsers = Array.from(onlineSocketsByUser.keys());
    io.emit("getOnlineUsers", onlineUsers);
    io.emit("onlineUsersCount", onlineUsers.length);
  }, debounceMs);
  onlineUsersEmitTimer.unref?.();
};

io.use((socket, next) => {
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
    socket.data.userId = payload.userId;
    return next();
  } catch (err) {
    return next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[socket] connected user=${String(userId)} sid=${socket.id}`);
  }

  socket.join(String(userId));
  addOnlineSocket(String(userId), socket.id);
  emitOnlineUsers();

  socket.on("disconnect", () => {
    removeOnlineSocket(String(userId), socket.id);
    emitOnlineUsers();

    if (process.env.NODE_ENV !== "production") {
      console.log(`[socket] disconnected user=${String(userId)} sid=${socket.id}`);
    }
  });
});

// Periodically purge stale entries for connections that dropped without a clean disconnect
const STALE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const staleCleanupTimer = setInterval(() => {
  let changed = false;
  for (const [uid, socketIds] of onlineSocketsByUser.entries()) {
    for (const sid of socketIds) {
      if (!io.sockets.sockets.has(sid)) {
        socketIds.delete(sid);
        changed = true;
      }
    }
    if (socketIds.size === 0) onlineSocketsByUser.delete(uid);
  }
  if (changed) emitOnlineUsers();
}, STALE_CLEANUP_INTERVAL_MS);
staleCleanupTimer.unref();

const initializeSocketInfrastructure = async () => {
  await initializeSocketRedisAdapter(io);
};

export { app, io, server, initializeSocketInfrastructure };
