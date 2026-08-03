import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchTournaments = createAsyncThunk('tournament/fetchAll', async (p, { rejectWithValue }) => {
  try { return (await api.get('/tournaments', { params: p })).data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchTournamentById = createAsyncThunk('tournament/fetchById', async (id, { rejectWithValue }) => {
  try { return (await api.get(`/tournaments/${id}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const createTournament = createAsyncThunk('tournament/create', async (formData, { rejectWithValue }) => {
  try { return (await api.post('/tournaments', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const tournamentSlice = createSlice({
  name: 'tournament',
  initialState: { tournaments: [], selectedTournament: null, isLoading: false, error: null },
  reducers: { 
    clearSelectedTournament: (state) => { state.selectedTournament = null; },
    toggleTournamentFollow: (state, action) => {
      const { tournamentId, userId } = action.payload;
      const tournament = state.tournaments.find(t => t._id === tournamentId);
      if (tournament) {
        if (!tournament.followers) tournament.followers = [];
        const idx = tournament.followers.indexOf(userId);
        if (idx >= 0) tournament.followers.splice(idx, 1);
        else tournament.followers.push(userId);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTournaments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTournaments.fulfilled, (state, a) => {
        state.isLoading = false;
        if (a.meta.arg?.page > 1) {
          const existingIds = new Set(state.tournaments.map(t => t._id));
          const newItems = (a.payload.data || []).filter(t => !existingIds.has(t._id));
          state.tournaments = [...state.tournaments, ...newItems];
        } else {
          state.tournaments = a.payload.data || [];
        }
      })
      .addCase(fetchTournaments.rejected, (state, a) => {
        state.isLoading = false;
        state.error = a.payload;
      })
      .addCase(fetchTournamentById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTournamentById.fulfilled, (state, a) => {
        state.isLoading = false;
        state.selectedTournament = a.payload;
      })
      .addCase(fetchTournamentById.rejected, (state, a) => {
        state.isLoading = false;
        state.error = a.payload;
      })
      .addCase(createTournament.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTournament.fulfilled, (state, a) => {
        state.isLoading = false;
        state.tournaments.unshift(a.payload);
      })
      .addCase(createTournament.rejected, (state, a) => {
        state.isLoading = false;
        state.error = a.payload;
      });
  },
});
export const { clearSelectedTournament, toggleTournamentFollow } = tournamentSlice.actions;
export default tournamentSlice.reducer;
