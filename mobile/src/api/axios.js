import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// Top-level imports removed to prevent circular dependencies with Redux store

export const PROD_URL = 'https://turfbackend-pn8j.onrender.com';

// export const PROD_URL = __DEV__
//   ? (Platform.OS === 'ios' ? 'http://127.0.0.1:5001' : 'http://10.0.2.2:5001')
//   : 'https://turfbackend-pn8j.onrender.com';

// Default BASE_URL to live backend for testing & production sync
// export const PROD_URL = 'https://turfbackend-pn8j.onrender.com';

export const BASE_URL = PROD_URL;


  const API_URL = `${BASE_URL}/api`;

export const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  
  // Normalize backslashes (important for live servers hosted on windows or certain DB paths)
  path = path.replace(/\\/g, '/');

  // Fix mangled Cloudinary URLs returned by backend's path.relative bug (e.g. /../../https:/res.cloudinary.com/...)
  const httpIdx = path.indexOf('http:/');
  const httpsIdx = path.indexOf('https:/');
  if (httpIdx !== -1 || httpsIdx !== -1) {
    const idx = httpsIdx !== -1 ? httpsIdx : httpIdx;
    let extractedUrl = path.substring(idx);
    // Restore the double slash that path.relative collapses
    extractedUrl = extractedUrl.replace('http:/', 'http://').replace('https:/', 'https://');
    // If there's another slash missing right after, e.g., 'https://res.cloudinary.com' it might need it, but replace works for the protocol.
    // Wait, path.relative collapsing 'https://a.com' makes it 'https:/a.com'. 
    // replace('https:/', 'https://') turns it into 'https://a.com' which is correct.
    return extractedUrl;
  }

  // If local device path (from image picker) or data URI
  if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('data:')) {
    return path;
  }

  // If already absolute HTTP(S) URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Replace legacy localhost / 10.0.2.2 URLs with active BASE_URL host
    if (path.includes('localhost') || path.includes('10.0.2.2') || path.includes('127.0.0.1')) {
      const idx = path.indexOf('/uploads/');
      if (idx !== -1) {
        return `${BASE_URL}${path.substring(idx)}`;
      }
    }
    return path;
  }
  
  // Fix previously uploaded absolute local paths (e.g. /Users/.../uploads/...)
  const uploadsIndex = path.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    path = path.substring(uploadsIndex);
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
