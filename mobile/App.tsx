import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { consumePendingPush } from './src/notifications/push';

export default function App() {
  return (
    <NavigationContainer ref={navigationRef} onReady={consumePendingPush}>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}
