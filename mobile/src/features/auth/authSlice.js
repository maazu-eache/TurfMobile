import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const registerWithPassword = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', userData);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const loginWithPassword = createAsyncThunk('auth/login', async ({ identifier, password, fcmToken }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/login', { identifier, password, fcmToken });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const forgotPassword = createAsyncThunk('auth/forgotPassword', async (email, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to send reset OTP');
  }
});

export const verifyResetOtp = createAsyncThunk('auth/verifyResetOtp', async ({ email, otp }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/verify-reset-otp', { email, otp });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Invalid or expired OTP');
  }
});

export const resetPassword = createAsyncThunk('auth/resetPassword', async ({ email, otp, newPassword }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/reset-password', { email, otp, newPassword });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to reset password');
  }
});

export const changePassword = createAsyncThunk('auth/changePassword', async ({ currentPassword, newPassword }, { rejectWithValue }) => {
  try {
    const res = await api.put('/auth/change-password', { currentPassword, newPassword });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to change password');
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

export const logout = createAsyncThunk('auth/logout', async (_, { dispatch, getState }) => {
  try {
    const { refreshToken } = getState().auth;
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch (err) {
    console.log('Backend logout failed', err);
  } finally {
    dispatch(logoutLocal());
  }
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
    isGuest: false,
  },
  reducers: {
    setTokens: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    logoutLocal: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isGuest = true; // Stay in guest mode to skip onboarding
    },
    clearError: (state) => { state.error = null; },
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
        const idx = state.user.favourites.findIndex(f => f && (f._id || f) === id);
        if (idx > -1) state.user.favourites.splice(idx, 1);
        else state.user.favourites.push(id);
      }
    },
    setUserFavouriteStatus: (state, action) => {
      if (state.user) {
        if (!state.user.favourites) state.user.favourites = [];
        const { id, isFavourite } = action.payload;
        const idx = state.user.favourites.findIndex(f => f && (f._id || f) === id);
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
      .addCase('persist/REHYDRATE', (state) => {
        if (state) {
          state.isLoading = false;
          state.error = null;
        }
      })
      // Register
      .addCase(registerWithPassword.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(registerWithPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(registerWithPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Login
      .addCase(loginWithPassword.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(loginWithPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(loginWithPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
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

export const { setTokens, logoutLocal, clearError, setGuestMode, updateUserRole, updateUser, toggleUserFavourite, setUserFavouriteStatus } = authSlice.actions;
export default authSlice.reducer;
