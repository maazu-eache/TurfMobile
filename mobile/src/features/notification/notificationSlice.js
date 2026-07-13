import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';
export const fetchNotifications = createAsyncThunk('notification/fetch', async (p, { rejectWithValue }) => {
  try { return (await api.get('/notifications', { params: p })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const markAllRead = createAsyncThunk('notification/markAll', async (_, { rejectWithValue }) => {
  try { await api.put('/notifications/read-all'); return true; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
const notificationSlice = createSlice({
  name: 'notification',
  initialState: { notifications: [], unreadCount: 0, isLoading: false },
  reducers: {
    addNotification: (state, a) => { state.notifications.unshift(a.payload); state.unreadCount += 1; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, a) => {
        state.notifications = a.payload?.notifications || [];
        state.unreadCount = a.payload?.unreadCount || 0;
      })
      .addCase(markAllRead.fulfilled, (state) => { state.unreadCount = 0; });
  },
});
export const { addNotification } = notificationSlice.actions;
export default notificationSlice.reducer;
