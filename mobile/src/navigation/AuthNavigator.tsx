import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

function HeaderBack() {
  const navigation = useNavigation<any>();
  if (!navigation.canGoBack()) return null;
  return (
    <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} activeOpacity={0.7} style={{ paddingRight: 6, paddingVertical: 4 }}>
      <Ionicons name="chevron-back" size={26} color={colors.text} />
    </TouchableOpacity>
  );
}

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerLeft: () => <HeaderBack />,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: true, title: 'Восстановление пароля', headerBackTitle: 'Назад' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ headerShown: true, title: 'Политика', headerBackTitle: 'Назад' }}
      />
    </Stack.Navigator>
  );
}
