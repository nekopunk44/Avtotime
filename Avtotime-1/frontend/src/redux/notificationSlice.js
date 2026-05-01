import { createSlice } from "@reduxjs/toolkit";

const notificationSlice = createSlice({
  name: "notification",
  initialState: {
    items: [],
    unreadCount: 0,
  },
  reducers: {
    setNotifications: (state, action) => {
      state.items = Array.isArray(action.payload) ? action.payload : [];
    },
    setUnreadCount: (state, action) => {
      state.unreadCount = Number(action.payload) || 0;
    },
    prependNotification: (state, action) => {
      const next = action.payload;
      if (!next) return;

      const id = next?._id || next?.notificationId;
      if (id && state.items.some((n) => (n?._id || n?.notificationId) === id)) {
        return;
      }

      state.items.unshift(next);
      state.items = state.items.slice(0, 50);

      const isRead = Boolean(next?.isRead);
      if (!isRead) state.unreadCount += 1;
    },
    markAsReadLocal: (state, action) => {
      const id = action.payload;
      const target = state.items.find((n) => (n?._id || n?.notificationId) === id);
      if (!target || target.isRead) return;
      target.isRead = true;
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    markAllAsReadLocal: (state) => {
      let changed = 0;
      for (const n of state.items) {
        if (n && !n.isRead) {
          n.isRead = true;
          changed += 1;
        }
      }
      state.unreadCount = Math.max(0, state.unreadCount - changed);
    },
    clearNotifications: (state) => {
      state.items = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  setNotifications,
  setUnreadCount,
  prependNotification,
  markAsReadLocal,
  markAllAsReadLocal,
  clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;

