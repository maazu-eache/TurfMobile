import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchTurfs = createAsyncThunk('turf/fetchTurfs', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/turfs', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch turfs');
  }
});

export const fetchTurfById = createAsyncThunk('turf/fetchTurfById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/turfs/${id}`);
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch turf details');
  }
});

// Create a new Turf (Owner)
export const createTurf = createAsyncThunk('turf/createTurf', async (formData, { rejectWithValue }) => {
  try {
    const response = await api.post('/turfs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create turf');
  }
});

export const updateTurf = createAsyncThunk('turf/updateTurf', async ({ id, formData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/turfs/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update turf');
  }
});

export const fetchNearbyTurfs = createAsyncThunk('turf/fetchNearby', async ({ lat, lng, radius }, { rejectWithValue }) => {
  try {
    const res = await api.get('/turfs', { params: { lat, lng, radius } });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const turfSlice = createSlice({
  name: 'turf',
  initialState: {
    turfs: [],
    selectedTurf: null,
    pagination: null,
    isLoading: false,
    error: null,
    searchQuery: '',
    filters: {},
    favourites: [],
  },
  reducers: {
    setSearchQuery: (state, action) => { state.searchQuery = action.payload; },
    setFilters: (state, action) => { state.filters = action.payload; },
    clearSelectedTurf: (state) => { state.selectedTurf = null; },
    toggleFavourite: (state, action) => {
      const id = action.payload;
      const idx = state.favourites.indexOf(id);
      if (idx > -1) state.favourites.splice(idx, 1);
      else state.favourites.push(id);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTurfs.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchTurfs.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.meta.arg.page > 1) {
          const existingIds = new Set(state.turfs.map(t => t._id));
          const newItems = (action.payload.data || []).filter(t => !existingIds.has(t._id));
          state.turfs = [...state.turfs, ...newItems];
        } else {
          state.turfs = action.payload.data || [];
        }
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchTurfs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchTurfById.pending, (state) => { state.isLoading = true; })
      .addCase(fetchTurfById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedTurf = action.payload;
      })
      .addCase(fetchTurfById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create Turf
      .addCase(createTurf.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTurf.fulfilled, (state, action) => {
        state.isLoading = false;
        // Prepend new turf to the list if it's there
        state.turfs.unshift(action.payload);
      })
      .addCase(createTurf.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase('auth/verifyOTP/fulfilled', (state, action) => {
        if (action.payload?.user?.favourites) {
          // ensure we only store the IDs (in case they were populated somehow, though usually they are just IDs on login)
          state.favourites = action.payload.user.favourites.map(f => typeof f === 'string' ? f : f._id || f);
        }
      });
  },
});

export const { setSearchQuery, setFilters, clearSelectedTurf, toggleFavourite } = turfSlice.actions;
export default turfSlice.reducer;
