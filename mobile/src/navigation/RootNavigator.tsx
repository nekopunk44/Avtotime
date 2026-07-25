import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import { usePushNotifications } from '../notifications/push';
import AnimatedSplash from '../components/AnimatedSplash';

const MIN_SPLASH_MS = 1700;

export default function RootNavigator() {
  const { user, loading, initialize } = useAuthStore();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    initialize();
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  usePushNotifications(Boolean(user));

  if (loading || !minElapsed) {
    return <AnimatedSplash />;
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}
