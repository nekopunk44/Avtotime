import React from 'react';
import { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import LoopsScreen from '../screens/LoopsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ChatScreen from '../screens/ChatScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import EditPostScreen from '../screens/EditPostScreen';
import PostCommentsScreen from '../screens/PostCommentsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MarketScreen from '../screens/MarketScreen';
import MarketSearchScreen from '../screens/MarketSearchScreen';
import MarketListingDetailsScreen from '../screens/MarketListingDetailsScreen';
import CreateMarketListingScreen from '../screens/CreateMarketListingScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import CompareScreen from '../screens/CompareScreen';
import MarketAnalyticsScreen from '../screens/MarketAnalyticsScreen';
import CarRequestScreen from '../screens/CarRequestScreen';
import HelpRequestsScreen from '../screens/HelpRequestsScreen';
import EcoTipsScreen from '../screens/EcoTipsScreen';
import KidsGamesScreen from '../screens/KidsGamesScreen';
import ColoringScreen from '../screens/ColoringScreen';
import CarJumpGameScreen from '../screens/CarJumpGameScreen';
import RoadFighterGameScreen from '../screens/RoadFighterGameScreen';
import PuzzleGameScreen from '../screens/PuzzleGameScreen';
import Game2048Screen from '../screens/Game2048Screen';
import SnakeGameScreen from '../screens/SnakeGameScreen';
import TetrisGameScreen from '../screens/TetrisGameScreen';
import SudokuGameScreen from '../screens/SudokuGameScreen';
import BillingScreen from '../screens/BillingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminUserDetailsScreen from '../screens/AdminUserDetailsScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import EditMarketListingScreen from '../screens/EditMarketListingScreen';
import MarketReviewsScreen from '../screens/MarketReviewsScreen';
import MyReviewsScreen from '../screens/MyReviewsScreen';
import UserReviewsScreen from '../screens/UserReviewsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import FollowListScreen from '../screens/FollowListScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import { MarketCategoryId, MarketListing } from '../api/market';
import { Post } from '../api/posts';
import DrivingCoursesScreen from '../screens/DrivingCoursesScreen';
import DrivingQuizScreen from '../screens/DrivingQuizScreen';
import DrivingResultsScreen from '../screens/DrivingResultsScreen';
import { DrivingMode } from '../api/driving';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import { Story } from '../api/stories';
import { useBadgeSync } from '../hooks/useBadgeSync';
import { useBadgeStore } from '../store/badgeStore';

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<AppTabParamList> | undefined;
  Chat: { userId: string; name: string; userName: string };
  UserProfile: { userId: string };
  CreatePost: undefined;
  EditPost: { post: Post };
  PostComments: { postId: string };
  EditProfile: undefined;
  MarketSearch: undefined;
  MarketListingDetails: { listing: MarketListing; categoryId: MarketCategoryId };
  CreateMarketListing: undefined;
  Favorites: undefined;
  Compare: undefined;
  MarketAnalytics: undefined;
  CarRequest: undefined;
  HelpRequests: undefined;
  EcoTips: undefined;
  KidsGames: undefined;
  Coloring: undefined;
  CarJumpGame: undefined;
  RoadFighterGame: undefined;
  PuzzleGame: undefined;
  Game2048: undefined;
  SnakeGame: undefined;
  TetrisGame: undefined;
  SudokuGame: undefined;
  Billing: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
  EmailVerification: undefined;
  Admin: undefined;
  AdminUserDetails: { userId: string };
  MyListings: undefined;
  EditMarketListing: { listing: MarketListing; categoryId: MarketCategoryId };
  MarketReviews: { listing: MarketListing; categoryId: MarketCategoryId };
  MyReviews: undefined;
  UserReviews: { userId: string; title?: string };
  NotificationSettings: undefined;
  FollowList: { userId: string; mode: 'followers' | 'following'; title: string };
  SavedPosts: undefined;
  DrivingQuiz: { mode: DrivingMode; ticketNumber?: number };
  DrivingResults: { mode?: DrivingMode } | undefined;
  StoryViewer: { story: Story };
};

export type AppTabParamList = {
  Feed: undefined;
  Search: undefined;
  Loops: { loopId?: string } | undefined;
  Market: undefined;
  Driving: undefined;
  Messages: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

const TAB_ICONS: Record<string, { on: string; off: string }> = {
  Feed:          { on: 'home',                    off: 'home-outline' },
  Search:        { on: 'search',                  off: 'search-outline' },
  Loops:         { on: 'play-circle',             off: 'play-circle-outline' },
  Market:        { on: 'car-sport',               off: 'car-sport-outline' },
  Driving:       { on: 'school',                  off: 'school-outline' },
  Messages:      { on: 'chatbubbles',             off: 'chatbubbles-outline' },
  Notifications: { on: 'notifications',           off: 'notifications-outline' },
  Profile:       { on: 'person',                  off: 'person-outline' },
};

function TabNavigator() {
  useBadgeSync();
  const unreadMessages = useBadgeStore((s) => s.unreadMessages);
  const unreadNotifications = useBadgeStore((s) => s.unreadNotifications);

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
      <Tab.Screen
        name="Loops"
        component={LoopsScreen}
        options={{
          title: 'Видео',
          headerShown: false,
          tabBarStyle: { backgroundColor: '#000', borderTopColor: '#111' },
        }}
      />
      <Tab.Screen name="Market" component={MarketScreen} options={{ title: 'Маркет' }} />
      <Tab.Screen name="Driving" component={DrivingCoursesScreen} options={{ title: 'Курсы' }} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: 'Сообщения', tabBarBadge: unreadMessages || undefined }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Уведомления', tabBarBadge: unreadNotifications || undefined }}
      />
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
      <Stack.Screen name="PostComments" component={PostCommentsScreen} options={{ title: 'Комментарии' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Редактировать профиль' }} />
      <Stack.Screen name="MarketSearch" component={MarketSearchScreen} options={{ title: 'Поиск маркета' }} />
      <Stack.Screen name="MarketListingDetails" component={MarketListingDetailsScreen} options={{ title: 'Объявление' }} />
      <Stack.Screen name="CreateMarketListing" component={CreateMarketListingScreen} options={{ title: 'Новое объявление' }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Избранное' }} />
      <Stack.Screen name="Compare" component={CompareScreen} options={{ title: 'Сравнение' }} />
      <Stack.Screen name="MarketAnalytics" component={MarketAnalyticsScreen} options={{ title: 'Аналитика' }} />
      <Stack.Screen name="CarRequest" component={CarRequestScreen} options={{ title: 'Подбор авто' }} />
      <Stack.Screen name="HelpRequests" component={HelpRequestsScreen} options={{ title: 'Помощь другим' }} />
      <Stack.Screen name="EcoTips" component={EcoTipsScreen} options={{ title: 'Эко советы' }} />
      <Stack.Screen name="KidsGames" component={KidsGamesScreen} options={{ title: 'Детям и игры' }} />
      <Stack.Screen name="Coloring" component={ColoringScreen} options={{ title: 'Раскраски' }} />
      <Stack.Screen name="CarJumpGame" component={CarJumpGameScreen} options={{ title: 'Car Jump' }} />
      <Stack.Screen name="RoadFighterGame" component={RoadFighterGameScreen} options={{ title: 'Road Fighter' }} />
      <Stack.Screen name="PuzzleGame" component={PuzzleGameScreen} options={{ title: 'Пазлы' }} />
      <Stack.Screen name="Game2048" component={Game2048Screen} options={{ title: '2048' }} />
      <Stack.Screen name="SnakeGame" component={SnakeGameScreen} options={{ title: 'Змейка' }} />
      <Stack.Screen name="TetrisGame" component={TetrisGameScreen} options={{ title: 'Тетрис' }} />
      <Stack.Screen name="SudokuGame" component={SudokuGameScreen} options={{ title: 'Судоку' }} />
      <Stack.Screen name="Billing" component={BillingScreen} options={{ title: 'Тарифы' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Политика' }} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} options={{ title: 'Email' }} />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Админ' }} />
      <Stack.Screen name="AdminUserDetails" component={AdminUserDetailsScreen} options={{ title: 'Пользователь' }} />
      <Stack.Screen name="MyListings" component={MyListingsScreen} options={{ title: 'Мои объявления' }} />
      <Stack.Screen name="DrivingQuiz" component={DrivingQuizScreen} options={{ title: 'Автокурсы' }} />
      <Stack.Screen name="DrivingResults" component={DrivingResultsScreen} options={{ title: 'Результаты' }} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditMarketListing" component={EditMarketListingScreen} options={{ title: 'Редактировать' }} />
      <Stack.Screen name="MarketReviews" component={MarketReviewsScreen} options={{ title: 'Отзывы' }} />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} options={{ title: 'Отзывы обо мне' }} />
      <Stack.Screen name="UserReviews" component={UserReviewsScreen} options={{ title: 'Отзывы' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Уведомления' }} />
      <Stack.Screen name="FollowList" component={FollowListScreen} options={{ title: 'Люди' }} />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} options={{ title: 'Сохранённые' }} />
      <Stack.Screen name="EditPost" component={EditPostScreen} options={{ title: 'Редактировать' }} />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: 'Новая публикация', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
