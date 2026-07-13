import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const sendOTP = createAsyncThunk('auth/sendOTP', async ({ email, name, mobile, isLogin }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/send-otp', { email, name, mobile, isLogin });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to send OTP');
  }
});

export const verifyOTP = createAsyncThunk('auth/verifyOTP', async ({ email, otp, role, fcmToken }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/verify-otp', { email, otp, role, fcmToken });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'OTP verification failed');
  }
});

export const payOwnerFee = createAsyncThunk('auth/payOwnerFee', async (_, { rejectWithValue }) => {
  try {
    const res = await api.post('/users/pay-owner-fee');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Payment failed');
  }
});

export const refreshTokenThunk = createAsyncThunk('auth/refreshToken', async (_, { getState, rejectWithValue }) => {
  try {
    const { refreshToken } = getState().auth;
    const res = await api.post('/auth/refresh-token', { refreshToken });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Token refresh failed');
  }
});

export const logoutThunk = createAsyncThunk('auth/logout', async (_, { getState }) => {
  try {
    const { refreshToken } = getState().auth;
    await api.post('/auth/logout', { refreshToken });
  } catch { /* silent */ }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    otpSent: false,
    email: null,
    isGuest: false,
  },
  reducers: {
    setTokens: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.otpSent = false;
      state.email = null;
      state.isGuest = true; // Stay in guest mode to skip onboarding
    },
    clearError: (state) => { state.error = null; },
    setOtpSent: (state, action) => { state.otpSent = action.payload; },
    setGuestMode: (state, action) => { state.isGuest = action.payload; },
    updateUserRole: (state, action) => { 
      if (state.user) {
        state.user.roles = [...new Set([...(state.user.roles || [state.user.role]), action.payload])];
      }
    },
    updateUser: (state, action) => {
      state.user = action.payload;
    },
    toggleUserFavourite: (state, action) => {
      if (state.user) {
        if (!state.user.favourites) state.user.favourites = [];
        const id = action.payload;
        const idx = state.user.favourites.findIndex(f => (f._id || f) === id);
        if (idx > -1) state.user.favourites.splice(idx, 1);
        else state.user.favourites.push(id);
      }
    },
    setUserFavouriteStatus: (state, action) => {
      if (state.user) {
        if (!state.user.favourites) state.user.favourites = [];
        const { id, isFavourite } = action.payload;
        const idx = state.user.favourites.findIndex(f => (f._id || f) === id);
        if (isFavourite && idx === -1) {
          state.user.favourites.push(id);
        } else if (!isFavourite && idx > -1) {
          state.user.favourites.splice(idx, 1);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendOTP.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(sendOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.otpSent = true;
        state.email = action.meta.arg.email;
      })
      .addCase(sendOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(verifyOTP.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.otpSent = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.isGuest = true; // Stay in guest mode to skip onboarding
      })
      // payOwnerFee
      .addCase(payOwnerFee.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(payOwnerFee.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload; // Updates user with hasPaidOwnerFee = true and role = 'owner'
        state.currentRole = 'owner';
      })
      .addCase(payOwnerFee.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { setTokens, logout, clearError, setOtpSent, setGuestMode, updateUserRole, updateUser, toggleUserFavourite, setUserFavouriteStatus } = authSlice.actions;
export default authSlice.reducer;
