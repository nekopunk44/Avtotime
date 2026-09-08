// Нативные модули, которые тянет цепочка импортов стора.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../hooks/useSocket', () => ({ disconnectSocket: jest.fn() }));
jest.mock('../notifications/push', () => ({ unregisterPushNotifications: jest.fn(async () => {}) }));
jest.mock('../api/auth', () => ({
  getMe: jest.fn(async () => ({ _id: 'u1', userName: 'tester' })),
  signOut: jest.fn(async () => {}),
}));

import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { signOut } from '../api/auth';
import { disconnectSocket } from '../hooks/useSocket';
import { unregisterPushNotifications } from '../notifications/push';

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: true });
  jest.clearAllMocks();
});

describe('authStore.initialize', () => {
  it('без токена просто выходит из загрузки', async () => {
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState()).toMatchObject({ user: null, loading: false });
  });

  it('с токеном подтягивает профиль', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('jwt');
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().user).toMatchObject({ userName: 'tester' });
  });

  it('при протухшем токене чистит хранилище, а не падает', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stale');
    const { getMe } = jest.requireMock('../api/auth');
    getMe.mockRejectedValueOnce(new Error('401'));

    await useAuthStore.getState().initialize();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(useAuthStore.getState()).toMatchObject({ user: null, loading: false });
  });
});

describe('authStore.logout', () => {
  it('снимает пуш-токен ДО разлогина — потом auth уже не действует', async () => {
    const order: string[] = [];
    (unregisterPushNotifications as jest.Mock).mockImplementation(async () => { order.push('push'); });
    (signOut as jest.Mock).mockImplementation(async () => { order.push('signout'); });

    useAuthStore.setState({ user: { _id: 'u1' } as never });
    await useAuthStore.getState().logout();

    expect(order).toEqual(['push', 'signout']);
    expect(disconnectSocket).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
