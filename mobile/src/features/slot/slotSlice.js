import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchSlots = createAsyncThunk('slot/fetchByDate', async ({ turfId, date }, { rejectWithValue }) => {
  try { return (await api.get(`/slots/${turfId}/${date}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const slotSlice = createSlice({
  name: 'slot',
  initialState: { slots: [], selectedSlot: null, isLoading: false, error: null },
  reducers: {
    selectSlot: (state, a) => { state.selectedSlot = a.payload; },
    clearSlots: (state) => { state.slots = []; state.selectedSlot = null; },
    updateSlotStatus: (state, a) => {
      const { slotIds, status } = a.payload;
      state.slots = state.slots.map(s => 
        slotIds.includes(s._id) ? { ...s, status } : s
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSlots.pending, (state) => { state.isLoading = true; })
      .addCase(fetchSlots.fulfilled, (state, a) => { state.isLoading = false; state.slots = a.payload; })
      .addCase(fetchSlots.rejected, (state, a) => { state.isLoading = false; state.error = a.payload; });
  },
});
export const { selectSlot, clearSlots, updateSlotStatus } = slotSlice.actions;
export default slotSlice.reducer;
