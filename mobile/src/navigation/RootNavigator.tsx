import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useLockStore } from '../store/lockStore';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import { usePushNotifications } from '../notifications/push';
import AnimatedSplash from '../components/AnimatedSplash';
import BiometricLock from '../components/BiometricLock';

const MIN_SPLASH_MS = 1700;

export default function RootNavigator() {
  const { user, loading, initialize } = useAuthStore();
  const [minElapsed, setMinElapsed] = useState(false);

  const lockHydrate = useLockStore((s) => s.hydrate);
  const lock = useLockStore((s) => s.lock);
  const lockEnabled = useLockStore((s) => s.enabled);
  const unlocked = useLockStore((s) => s.unlocked);

  useEffect(() => {
    initialize();
    lockHydrate();
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Re-lock whenever the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lock();
    });
    return () => sub.remove();
  }, [lock]);

  usePushNotifications(Boolean(user));

  if (loading || !minElapsed) {
    return <AnimatedSplash />;
  }

  if (user && lockEnabled && !unlocked) {
    return <BiometricLock />;
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}
