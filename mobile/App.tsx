import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import ModeTransition from './src/components/ModeTransition';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingPush } from './src/notifications/push';
import { colors } from './src/theme';

// Dark navigation theme so there's no white flash between screens.
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
    notification: colors.danger,
  },
};

// Keep the native splash until the animated JS splash is mounted.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={consumePendingPush}>
      <StatusBar style="light" />
      <RootNavigator />
      {/* Кинопереход Соцсеть <-> Маркет; живёт поверх всех экранов. */}
      <ModeTransition />
    </NavigationContainer>
  );
}
