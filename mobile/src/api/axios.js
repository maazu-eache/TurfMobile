import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { store } from '../store';
import { logout, setTokens } from '../features/auth/authSlice';

// export const PROD_URL = 'https://roughturf-backend-50044029462.development.catalystappsail.in';

// Default BASE_URL to live backend for testing & production sync
export const PROD_URL = __DEV__
  ? (Platform.OS === 'ios' ? 'http://localhost:5001' : 'http://10.0.2.2:5001')
  : 'https://roughturf-backend-50044029462.development.catalystappsail.in';

export const BASE_URL = PROD_URL;


  const API_URL = `${BASE_URL}/api`;

export const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  
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
        processQueue(refreshError, null);
        store.dispatch(logout());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
