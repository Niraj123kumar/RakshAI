/**
 * GigShield Mobile — API Configuration
 *
 * FIX: Replaces the hardcoded developer LAN IP (http://10.106.0.75:8000)
 *      with an environment-aware config.
 *
 * Usage in any screen:
 *   import { API_BASE, getAuthHeaders } from '../config'
 *   const res = await axios.get(`${API_BASE}/dashboard/worker`, { headers: getAuthHeaders(token) })
 */

import Constants from 'expo-constants'

// Priority order:
//   1. EXPO_PUBLIC_API_URL from app.config.js / .env (for CI/staging/prod builds)
//   2. expoConfig.extra.apiUrl set in app.config.js
//   3. Development fallback (localhost — works for Expo Go on same machine)
const _extra = Constants.expoConfig?.extra || {}

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  _extra.apiUrl ||
  'http://localhost:8000'

/**
 * Build Authorization headers for authenticated requests.
 * @param {string} token - JWT access token from login response
 */
export function getAuthHeaders(token) {
  if (!token) return { 'Content-Type': 'application/json' }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}
