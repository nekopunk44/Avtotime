import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { getMe, signOut, User } from '../api/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),

  logout: async () => {
    await signOut();
    set({ user: null });
  },

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        const user = await getMe();
        set({ user, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ user: null, loading: false });
    }
  },
}));
