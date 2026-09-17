import React from 'react';
import { Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';
import FloatingTabBar from './FloatingTabBar';
import ModeSwitcher from '../components/ModeSwitcher';
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
import MarketListingDetailsScreen from '../screens/MarketListingDetailsScreen';
import CreateMarketListingScreen from '../screens/CreateMarketListingScreen';
import CompareScreen from '../screens/CompareScreen';
import MarketAnalyticsScreen from '../screens/MarketAnalyticsScreen';
import MarketServicesScreen from '../screens/MarketServicesScreen';
import CarRequestScreen from '../screens/CarRequestScreen';
import HelpRequestsScreen from '../screens/HelpRequestsScreen';
import EcoTipsScreen from '../screens/EcoTipsScreen';
import KidsGamesScreen from '../screens/KidsGamesScreen';
import ColoringScreen from '../screens/ColoringScreen';
import ColoringCanvasScreen from '../screens/ColoringCanvasScreen';
import { ColoringTemplate } from '../api/kidsGames';
import CarJumpGameScreen from '../screens/CarJumpGameScreen';
import RoadFighterGameScreen from '../screens/RoadFighterGameScreen';
import PuzzleGameScreen from '../screens/PuzzleGameScreen';
import Game2048Screen from '../screens/Game2048Screen';
import SnakeGameScreen from '../screens/SnakeGameScreen';
import TetrisGameScreen from '../screens/TetrisGameScreen';
import SudokuGameScreen from '../screens/SudokuGameScreen';
import BillingScreen from '../screens/BillingScreen';
import PaymentHistoryScreen from '../screens/PaymentHistoryScreen';
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
import DrivingTicketsScreen from '../screens/DrivingTicketsScreen';
import { DrivingMode } from '../api/driving';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import { Story } from '../api/stories';
import { useBadgeSync } from '../hooks/useBadgeSync';
import { useBadgeStore } from '../store/badgeStore';

export type AppStackParamList = {
  SocialTabs: NavigatorScreenParams<SocialTabParamList> | undefined;
  MarketTabs: NavigatorScreenParams<MarketTabParamList> | undefined;
  Notifications: undefined;
  Chat: { userId: string; name: string; userName: string };
  UserProfile: { userId: string };
  CreatePost: undefined;
  EditPost: { post: Post };
  PostComments: { postId: string };
  EditProfile: undefined;
  MarketListingDetails: {
    listing: MarketListing;
    categoryId: MarketCategoryId;
    /** Где на экране лежала карточка — из неё разворачивается экран. */
    origin?: { x: number; y: number; width: number; height: number };
  };
  CreateMarketListing: undefined;
  MarketAnalytics: undefined;
  MarketServices: undefined;
  CarRequest: undefined;
  HelpRequests: undefined;
  EcoTips: undefined;
  KidsGames: undefined;
  Coloring: undefined;
  ColoringCanvas: { template: ColoringTemplate };
  CarJumpGame: undefined;
  RoadFighterGame: undefined;
  PuzzleGame: undefined;
  Game2048: undefined;
  SnakeGame: undefined;
  TetrisGame: undefined;
  SudokuGame: undefined;
  Billing: undefined;
  PaymentHistory: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
  EmailVerification: undefined;
  Admin: undefined;
  AdminUserDetails: { userId: string };
  EditMarketListing: { listing: MarketListing; categoryId: MarketCategoryId };
  MarketReviews: { listing: MarketListing; categoryId: MarketCategoryId };
  MyReviews: undefined;
  UserReviews: { userId: string; title?: string };
  NotificationSettings: undefined;
  FollowList: { userId: string; mode: 'followers' | 'following'; title: string };
  SavedPosts: undefined;
  DrivingQuiz: { mode: DrivingMode; ticketNumber?: number };
  DrivingResults: { mode?: DrivingMode } | undefined;
  DrivingTickets: undefined;
  StoryViewer: { story: Story };
};

export type SocialTabParamList = {
  Feed: undefined;
  Loops: { loopId?: string } | undefined;
  Search: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type MarketTabParamList = {
  Market: undefined;
  Compare: undefined;
  MyListings: undefined;
  Driving: undefined;
  Profile: undefined;
};

// Kept for screens that still reference the old union (e.g. Loops route params)
export type AppTabParamList = SocialTabParamList & MarketTabParamList;

const Stack = createNativeStackNavigator<AppStackParamList>();
const SocialTab = createBottomTabNavigator<SocialTabParamList>();
const MarketTab = createBottomTabNavigator<MarketTabParamList>();

function HeaderBell() {
  const navigation = useNavigation<any>();
  const unread = useBadgeStore((s) => s.unreadNotifications);
  return (
    <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={23} color={colors.text} />
      {unread > 0 ? <View style={styles.bellDot} /> : null}
    </TouchableOpacity>
  );
}

// Global chevron back button ("<") shown on every pushed screen.
function HeaderBack() {
  const navigation = useNavigation<any>();
  if (!navigation.canGoBack()) return null;
  return (
    <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()} hitSlop={12} activeOpacity={0.7}>
      <Ionicons name="chevron-back" size={26} color={colors.text} />
    </TouchableOpacity>
  );
}

const makeTabOptions = (current: 'social' | 'market') => () => ({
  // The floating tab bar (custom `tabBar` below) handles icons/animation.
  // Keep scene content clear of the floating bar.
  sceneStyle: { backgroundColor: colors.bg, paddingBottom: 90 },
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitle: () => <ModeSwitcher current={current} />,
  headerTitleAlign: 'center' as const,
  headerRight: () => <HeaderBell />,
});

// Один экран личности — два разных профиля: в соцсети про контент и людей,
// в маркете про объявления и рейтинг продавца.
const SocialProfileScreen = (props: any) => <ProfileScreen {...props} mode="social" />;
const MarketProfileScreen = (props: any) => <ProfileScreen {...props} mode="market" />;

// Переход между вкладками соцсети — направленный, с глубиной: экраны живут
// на одной ленте (progress: -1 слева, 0 в фокусе, 1 справа), уходящий
// сдвигается в сторону движения, слегка уменьшаясь и гаснет, входящий
// доезжает и распрямляется навстречу. Направление даёт сама навигация.
const socialTabTransition = {
  transitionSpec: {
    animation: 'timing' as const,
    config: { duration: 260, easing: Easing.out(Easing.cubic) },
  },
  sceneStyleInterpolator: ({ current }: { current: { progress: any } }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        // Гаснет рано: две сцены почти не накладываются в середине пути.
        inputRange: [-1, -0.3, 0, 0.3, 1],
        outputRange: [0, 0.05, 1, 0.05, 0],
      }),
      transform: [
        { translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-36, 0, 36] }) },
        { scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.97, 1, 0.97] }) },
      ],
    },
  }),
};

function SocialTabs() {
  const unreadMessages = useBadgeStore((s) => s.unreadMessages);
  return (
    <SocialTab.Navigator
      screenOptions={() => ({ ...makeTabOptions('social')(), ...socialTabTransition })}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <SocialTab.Screen name="Feed" component={FeedScreen} />
      <SocialTab.Screen
        name="Loops"
        component={LoopsScreen}
        options={{ headerShown: false }}
      />
      <SocialTab.Screen name="Search" component={SearchScreen} />
      <SocialTab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarBadge: unreadMessages || undefined }}
      />
      <SocialTab.Screen name="Profile" component={SocialProfileScreen} />
    </SocialTab.Navigator>
  );
}

function MarketTabs() {
  return (
    <MarketTab.Navigator
      screenOptions={makeTabOptions('market')}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <MarketTab.Screen name="Market" component={MarketScreen} />
      <MarketTab.Screen name="Compare" component={CompareScreen} />
      <MarketTab.Screen name="MyListings" component={MyListingsScreen} />
      <MarketTab.Screen name="Driving" component={DrivingCoursesScreen} />
      <MarketTab.Screen name="Profile" component={MarketProfileScreen} />
    </MarketTab.Navigator>
  );
}

export default function AppNavigator() {
  useBadgeSync();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerLeft: () => <HeaderBack />,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SocialTabs" component={SocialTabs} options={{ headerShown: false, animation: 'fade', animationDuration: 200 }} />
      <Stack.Screen name="MarketTabs" component={MarketTabs} options={{ headerShown: false, animation: 'fade', animationDuration: 200 }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        // Мягкое появление вместо резкого въезда: содержимое экрана
        // всплывает само, и переход читается одним движением.
        // «Профиль» — заглушка на время загрузки: как только придут данные,
        // экран ставит в шапку ник пользователя.
        options={{ title: 'Профиль', animation: 'fade_from_bottom', animationDuration: 260 }}
      />
      <Stack.Screen name="PostComments" component={PostCommentsScreen} options={{ title: 'Комментарии' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Редактировать профиль' }} />
      <Stack.Screen
        name="MarketListingDetails"
        component={MarketListingDetailsScreen}
        // Без бокового въезда: экран разворачивается из карточки сам.
        options={{ title: 'Объявление', animation: 'fade', animationDuration: 160 }}
      />
      <Stack.Screen name="CreateMarketListing" component={CreateMarketListingScreen} options={{ title: 'Новое объявление' }} />
      <Stack.Screen name="MarketAnalytics" component={MarketAnalyticsScreen} options={{ title: 'Аналитика' }} />
      <Stack.Screen name="MarketServices" component={MarketServicesScreen} options={{ title: 'Сервисы' }} />
      <Stack.Screen name="CarRequest" component={CarRequestScreen} options={{ title: 'Подбор авто' }} />
      <Stack.Screen name="HelpRequests" component={HelpRequestsScreen} options={{ title: 'Помощь другим' }} />
      <Stack.Screen name="EcoTips" component={EcoTipsScreen} options={{ title: 'Эко советы' }} />
      <Stack.Screen name="KidsGames" component={KidsGamesScreen} options={{ title: 'Детям и игры' }} />
      <Stack.Screen name="Coloring" component={ColoringScreen} options={{ title: 'Раскраски' }} />
      <Stack.Screen name="ColoringCanvas" component={ColoringCanvasScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CarJumpGame" component={CarJumpGameScreen} options={{ title: 'Car Jump' }} />
      <Stack.Screen name="RoadFighterGame" component={RoadFighterGameScreen} options={{ title: 'Road Fighter' }} />
      <Stack.Screen name="PuzzleGame" component={PuzzleGameScreen} options={{ title: 'Пазлы' }} />
      <Stack.Screen name="Game2048" component={Game2048Screen} options={{ title: '2048' }} />
      <Stack.Screen name="SnakeGame" component={SnakeGameScreen} options={{ title: 'Змейка' }} />
      <Stack.Screen name="TetrisGame" component={TetrisGameScreen} options={{ title: 'Тетрис' }} />
      <Stack.Screen name="SudokuGame" component={SudokuGameScreen} options={{ title: 'Судоку' }} />
      <Stack.Screen name="Billing" component={BillingScreen} options={{ title: 'Тарифы' }} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ title: 'История платежей' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Политика' }} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} options={{ title: 'Email' }} />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Админ' }} />
      <Stack.Screen name="AdminUserDetails" component={AdminUserDetailsScreen} options={{ title: 'Пользователь' }} />
      <Stack.Screen name="DrivingQuiz" component={DrivingQuizScreen} options={{ title: 'Автокурсы' }} />
      <Stack.Screen name="DrivingResults" component={DrivingResultsScreen} options={{ title: 'Результаты' }} />
      <Stack.Screen name="DrivingTickets" component={DrivingTicketsScreen} options={{ title: 'Все билеты' }} />
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
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerBack: { paddingRight: 6, paddingVertical: 4 },
  bell: { marginRight: 14, padding: 4 },
  bellDot: { position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: colors.bg },
});
