import { create } from 'zustand';
import { getUnreadCount } from '../api/notifications';
import { getConversations } from '../api/messages';

interface BadgeState {
  unreadMessages: number;
  unreadNotifications: number;
  setUnreadMessages: (n: number) => void;
  setUnreadNotifications: (n: number) => void;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useBadgeStore = create<BadgeState>((set) => ({
  unreadMessages: 0,
  unreadNotifications: 0,
  setUnreadMessages: (n) => set({ unreadMessages: n }),
  setUnreadNotifications: (n) => set({ unreadNotifications: n }),
  refresh: async () => {
    const [notif, chats] = await Promise.allSettled([getUnreadCount(), getConversations()]);
    if (notif.status === 'fulfilled') {
      set({ unreadNotifications: notif.value });
    }
    if (chats.status === 'fulfilled') {
      const total = chats.value.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
      set({ unreadMessages: total });
    }
  },
  reset: () => set({ unreadMessages: 0, unreadNotifications: 0 }),
}));
