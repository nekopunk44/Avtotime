import { create } from 'zustand';
import { isLockEnabled, persistLockEnabled } from '../utils/biometric';

interface LockState {
  enabled: boolean;
  unlocked: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  unlock: () => void;
  lock: () => void;
}

// Tracks the biometric app-lock. When enabled, the app is locked on launch and
// whenever it returns from the background until the user passes biometric auth.
export const useLockStore = create<LockState>((set) => ({
  enabled: false,
  unlocked: true,
  hydrated: false,
  hydrate: async () => {
    const enabled = await isLockEnabled();
    set({ enabled, unlocked: !enabled, hydrated: true });
  },
  setEnabled: async (enabled) => {
    await persistLockEnabled(enabled);
    // Toggling happens right after a successful auth, so treat as unlocked.
    set({ enabled, unlocked: true });
  },
  unlock: () => set({ unlocked: true }),
  lock: () => set((s) => (s.enabled ? { unlocked: false } : s)),
}));
