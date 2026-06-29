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

export default client;
