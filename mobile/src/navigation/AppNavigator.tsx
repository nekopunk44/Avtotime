import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import MessagesScreen from '../screens/MessagesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ChatScreen from '../screens/ChatScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CreatePostScreen from '../screens/CreatePostScreen';

export type AppStackParamList = {
  Tabs: undefined;
  Chat: { userId: string; name: string; userName: string };
  UserProfile: { userId: string };
  CreatePost: undefined;
};

type AppTabParamList = {
  Feed: undefined;
  Search: undefined;
  Messages: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

const TAB_ICONS: Record<string, { on: string; off: string }> = {
  Feed:          { on: 'home',                    off: 'home-outline' },
  Search:        { on: 'search',                  off: 'search-outline' },
  Messages:      { on: 'chatbubbles',             off: 'chatbubbles-outline' },
  Notifications: { on: 'notifications',           off: 'notifications-outline' },
  Profile:       { on: 'person',                  off: 'person-outline' },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icon = TAB_ICONS[route.name];
          return <Ionicons name={(focused ? icon.on : icon.off) as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#aaa',
        tabBarShowLabel: false,
        headerShown: true,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Лента' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Поиск' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Сообщения' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: '' }} />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: 'Новая публикация', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
