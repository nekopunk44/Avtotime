import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingPush } from './src/notifications/push';

// Keep the native splash until the animated JS splash is mounted.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <NavigationContainer ref={navigationRef} onReady={consumePendingPush}>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}
