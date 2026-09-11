import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'https://avtotime.org';

const client = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Пустой 304 — не данные, а ошибка для axios: HTTP-кэш платформы отвечает
 * условным запросом, сервер подтверждает «не изменилось», и экран остаётся ни
 * с чем (так падал экран тарифов). Сервер теперь отдаёт no-store, но клиент не
 * должен зависеть от версии бэкенда: перезапрашиваем в обход кэша.
 */
client.interceptors.response.use(undefined, async (error) => {
  const config = error.config as (typeof error.config & { _retriedNoCache?: boolean }) | undefined;
  if (error.response?.status === 304 && config && !config._retriedNoCache) {
    config._retriedNoCache = true;
    config.headers = { ...config.headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
    config.params = { ...(config.params || {}), _: Date.now() };
    return client.request(config);
  }
  return Promise.reject(error);
});

export default client;
