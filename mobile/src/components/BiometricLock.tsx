import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authenticateBiometric, BiometricInfo, getBiometricInfo } from '../utils/biometric';
import { useLockStore } from '../store/lockStore';
import { useAuthStore } from '../store/authStore';

export default function BiometricLock() {
  const unlock = useLockStore((s) => s.unlock);
  const logout = useAuthStore((s) => s.logout);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<BiometricInfo>({ label: 'биометрию', icon: 'lock-open-outline' });

  const tryUnlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await authenticateBiometric('Разблокируйте Avtotime');
    setBusy(false);
    if (ok) unlock();
    else setFailed(true);
  }, [busy, unlock]);

  // Auto-prompt once when the lock appears, and resolve which biometric to show.
  useEffect(() => {
    getBiometricInfo().then(setInfo);
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <View style={styles.iconWrap}>
        <Ionicons name={info.icon} size={30} color="#fff" />
      </View>
      <Text style={styles.title}>Приложение заблокировано</Text>
      <Text style={styles.subtitle}>
        {failed ? 'Не удалось подтвердить. Попробуйте ещё раз.' : `Подтвердите вход через ${info.label}`}
      </Text>

      <TouchableOpacity style={styles.btn} onPress={tryUnlock} activeOpacity={0.85} disabled={busy}>
        <Ionicons name={info.icon} size={20} color="#111" />
        <Text style={styles.btnText}>Разблокировать</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  logo: { width: 190, height: 190 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 18 },
  subtitle: { color: '#aaa', fontSize: 14, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 24, height: 48, marginTop: 28 },
  btnText: { color: '#111', fontSize: 15, fontWeight: '900' },
  logout: { marginTop: 18, padding: 8 },
  logoutText: { color: '#888', fontSize: 14, fontWeight: '700' },
});
