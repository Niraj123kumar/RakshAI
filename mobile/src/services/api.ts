/**
 * api.ts — Axios client for RakshAI backend
 *
 * Base URL priority:
 *   1. EXPO_PUBLIC_API_URL environment variable (CI / staging)
 *   2. http://localhost:8000  (local dev — works for Expo Go on same machine)
 *
 * NOTE: Backend has NO /api prefix. Routes are /auth/*, /policy/*, etc.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  // Backend /auth/login only requires { phone } — no password field.
  // Password field was silently ignored before; now we only send phone.
  login: (data: { phone: string }) => api.post('/auth/login', data),
  register: (data: object) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const policyAPI = {
  current: () => api.get('/policy/current'),
  upgrade: (newPlan: string) => api.post('/policy/upgrade', { new_plan: newPlan }),
  pause: () => api.post('/policy/pause'),
  resume: () => api.post('/policy/resume'),
};

export const payoutAPI = {
  history: () => api.get('/payouts/history'),
};

export default api;
