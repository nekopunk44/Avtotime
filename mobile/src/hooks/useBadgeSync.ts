import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useBadgeStore } from '../store/badgeStore';
import { useSocketEvent } from './useSocket';

// Keeps the tab-bar unread badges in sync. Mounted inside the authenticated
// navigator, so socket listeners only attach while the user is logged in.
export function useBadgeSync() {
  const refresh = useBadgeStore((s) => s.refresh);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useSocketEvent('newMessage', () => refresh(), [refresh]);
  useSocketEvent('notification', () => refresh(), [refresh]);
  useSocketEvent('messagesRead', () => refresh(), [refresh]);
}
