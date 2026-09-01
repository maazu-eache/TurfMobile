import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// Top-level imports removed to prevent circular dependencies with Redux store

export const PROD_URL = 'https://api.scoreverse.in';

// export const PROD_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5002' : 'http://localhost:5002';


export const BASE_URL = PROD_URL;


  const API_URL = `${BASE_URL}/api`;

export const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  
  // Normalize backslashes
  path = path.replace(/\\/g, '/');

  // Fix mangled HTTP URLs (e.g. /../../https:/res.cloudinary.com/...)
  const httpIdx = path.indexOf('http:/');
  const httpsIdx = path.indexOf('https:/');
  if (httpIdx !== -1 || httpsIdx !== -1) {
    const idx = httpsIdx !== -1 ? httpsIdx : httpIdx;
    let extractedUrl = path.substring(idx);
    // Restore protocol properly
    if (extractedUrl.startsWith('https:/') && !extractedUrl.startsWith('https://')) {
      extractedUrl = extractedUrl.replace('https:/', 'https://');
    } else if (extractedUrl.startsWith('http:/') && !extractedUrl.startsWith('http://')) {
      extractedUrl = extractedUrl.replace('http:/', 'http://');
    }
    path = extractedUrl;
  }

  // If local device path
  if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('data:')) {
    return path;
  }

  // If Cloudinary URL, ensure it's HTTPS (Android blocks cleartext HTTP) and return directly
  if (path.includes('cloudinary.com')) {
    if (path.startsWith('http://')) {
      return path.replace('http://', 'https://');
    }
    return path;
  }

  // Force all /uploads/ paths to use the current BASE_URL (for local/self-hosted images)
  const uploadsIndex = path.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    const cleanPath = path.substring(uploadsIndex);
    return `${BASE_URL}${cleanPath}`;
  }

  // If already absolute HTTP(S) URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor — attach access token
api.interceptors.request.use(
  async (config) => {
    const { store } = require('../store');
    const state = store.getState();
    const token = state.auth?.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — auto refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 403 &&
      (String(error.response?.data?.message || '').toLowerCase().includes('suspended') ||
       String(error.response?.data?.message || '').toLowerCase().includes('deactivated'))
    ) {
      const { store } = require('../store');
      const { logoutLocal, setGuestMode } = require('../features/auth/authSlice');
      const { showCustomAlert } = require('../components/CustomAlert');
      store.dispatch(logoutLocal());
      store.dispatch(setGuestMode(true));
      showCustomAlert('Account Suspended', 'Your account has been suspended by the administrator. You can browse in guest mode.');
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept login, register, refresh-token or logout requests to avoid infinite recursion
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh-token') ||
        originalRequest.url?.includes('/auth/logout')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { store } = require('../store');
        const { setTokens } = require('../features/auth/authSlice');
        const state = store.getState();
        const refreshToken = state.auth?.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        store.dispatch(setTokens({ accessToken, refreshToken: newRefreshToken }));
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const { store } = require('../store');
        const { logoutLocal } = require('../features/auth/authSlice');
        processQueue(refreshError, null);
        store.dispatch(logoutLocal());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
