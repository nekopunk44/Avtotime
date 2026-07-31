import React, { useEffect, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useLockStore } from '../store/lockStore';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import { usePushNotifications } from '../notifications/push';
import AnimatedSplash from '../components/AnimatedSplash';
import BiometricLock from '../components/BiometricLock';

const MIN_SPLASH_MS = 1700;

// Opaque shade shown while the app is not active (Control Center, app switcher,
// notification shade). Keeps content out of the OS snapshot without forcing a
// re-auth for these transient interruptions — only a real background re-locks.
function PrivacyCover() {
  return (
    <View style={styles.cover}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.coverLogo} resizeMode="contain" />
    </View>
  );
}

export default function RootNavigator() {
  const { user, loading, initialize } = useAuthStore();
  const [minElapsed, setMinElapsed] = useState(false);
  const [appActive, setAppActive] = useState(true);

  const lockHydrate = useLockStore((s) => s.hydrate);
  const lockHydrated = useLockStore((s) => s.hydrated);
  const lock = useLockStore((s) => s.lock);
  const lockEnabled = useLockStore((s) => s.enabled);
  const unlocked = useLockStore((s) => s.unlocked);

  useEffect(() => {
    initialize();
    lockHydrate();
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Only a real background re-locks (requires biometric on return). Transient
  // `inactive` states (Control Center, notification shade, the system biometric
  // dialog) just show the privacy cover — they must not force a re-auth.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state === 'background') lock();
    });
    return () => sub.remove();
  }, [lock]);

  usePushNotifications(Boolean(user));

  if (loading || !minElapsed || !lockHydrated) {
    return <AnimatedSplash />;
  }

  if (user && lockEnabled && !unlocked) {
    return <BiometricLock />;
  }

  return (
    <>
      {user ? <AppNavigator /> : <AuthNavigator />}
      {user && lockEnabled && !appActive ? <PrivacyCover /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center' },
  coverLogo: { width: 180, height: 180 },
});
