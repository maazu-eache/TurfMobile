import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';
export const fetchOwnerProfile = createAsyncThunk('owner/fetchMe', async (_, { rejectWithValue }) => {
  try { return (await api.get('/owners/me')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchOwnerDashboard = createAsyncThunk('owner/dashboard', async (_, { rejectWithValue }) => {
  try { return (await api.get('/owners/dashboard')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchOwnerAnalytics = createAsyncThunk('owner/analytics', async (params, { rejectWithValue }) => {
  try {
    const queryParams = typeof params === 'string' ? { range: params } : params;
    return (await api.get('/owners/analytics', { params: queryParams })).data.data;
  }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const confirmBookingPayment = createAsyncThunk('owner/confirmPayment', async (bookingId, { rejectWithValue }) => {
  try { return (await api.put(`/bookings/${bookingId}/confirm`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const rejectBookingPayment = createAsyncThunk('owner/rejectPayment', async ({ bookingId, reason }, { rejectWithValue }) => {
  try { return (await api.put(`/bookings/${bookingId}/reject`, { reason })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const approveCancellation = createAsyncThunk('owner/approveCancellation', async (bookingId, { rejectWithValue }) => {
  try { return (await api.put(`/bookings/${bookingId}/approve-cancellation`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
const ownerSlice = createSlice({
  name: 'owner',
  initialState: { profile: null, dashboard: null, isLoading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOwnerProfile.fulfilled, (state, a) => { state.profile = a.payload; })
      .addCase(fetchOwnerDashboard.fulfilled, (state, a) => { state.dashboard = a.payload; })
      .addCase(fetchOwnerAnalytics.pending, (state) => { state.isLoading = true; })
      .addCase(fetchOwnerAnalytics.fulfilled, (state, a) => { state.analytics = a.payload; state.isLoading = false; })
      .addCase(fetchOwnerAnalytics.rejected, (state) => { state.isLoading = false; });
  },
});
export default ownerSlice.reducer;
