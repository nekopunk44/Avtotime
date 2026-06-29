import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type AppTabParamList = {
  Feed: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { on: string; off: string }> = {
            Feed:    { on: 'home',    off: 'home-outline' },
            Profile: { on: 'person',  off: 'person-outline' },
          };
          const icon = icons[route.name];
          return <Ionicons name={(focused ? icon.on : icon.off) as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#aaa',
        headerShown: true,
      })}
    >
      <Tab.Screen name="Feed" options={{ title: 'Лента' }} component={FeedScreen} />
      <Tab.Screen name="Profile" options={{ title: 'Профиль' }} component={ProfileScreen} />
    </Tab.Navigator>
  );
}
