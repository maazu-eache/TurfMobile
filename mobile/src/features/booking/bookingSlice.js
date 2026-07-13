import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const createBooking = createAsyncThunk('booking/create', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/bookings', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Booking failed');
  }
});

export const fetchMyBookings = createAsyncThunk('booking/fetchMy', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/bookings/my', { params });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const cancelBooking = createAsyncThunk('booking/cancel', async ({ id, reason }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/bookings/${id}/cancel`, { reason });
    return { id, status: res.data.data.status || 'cancelled' };
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const rescheduleBooking = createAsyncThunk('booking/reschedule', async ({ id, newSlots }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/bookings/${id}/reschedule`, { newSlots });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const uploadPaymentScreenshot = createAsyncThunk('booking/uploadScreenshot', async ({ bookingId, formData }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/bookings/${bookingId}/payment-screenshot`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const bookingSlice = createSlice({
  name: 'booking',
  initialState: {
    bookings: [],
    currentBooking: null,
    paymentDetails: null,
    isLoading: false,
    error: null,
    success: null,
  },
  reducers: {
    clearBookingState: (state) => {
      state.currentBooking = null;
      state.paymentDetails = null;
      state.error = null;
      state.success = null;
    },
    setPaymentDetails: (state, action) => {
      state.paymentDetails = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBooking.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentBooking = action.payload.booking;
        state.paymentDetails = action.payload.qrPaymentDetails;
        state.success = 'Booking created! Complete payment.';
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.bookings = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.bookings = state.bookings.map((b) =>
          b._id === action.payload.id ? { ...b, status: action.payload.status } : b
        );
      })
      .addCase(rescheduleBooking.fulfilled, (state, action) => {
        state.bookings = state.bookings.map((b) =>
          b._id === action.payload._id ? action.payload : b
        );
      })
      .addCase(uploadPaymentScreenshot.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(uploadPaymentScreenshot.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(uploadPaymentScreenshot.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearBookingState, setPaymentDetails } = bookingSlice.actions;
export default bookingSlice.reducer;
