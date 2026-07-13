import { createNavigationContainerRef } from '@react-navigation/native';
import type { AppStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();
