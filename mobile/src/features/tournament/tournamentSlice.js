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
  reducers: { clearSelectedTournament: (state) => { state.selectedTournament = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTournaments.fulfilled, (state, a) => {
        if (a.meta.arg.page > 1) {
          const existingIds = new Set(state.tournaments.map(t => t._id));
          const newItems = (a.payload.data || []).filter(t => !existingIds.has(t._id));
          state.tournaments = [...state.tournaments, ...newItems];
        } else {
          state.tournaments = a.payload.data || [];
        }
      })
      .addCase(fetchTournamentById.fulfilled, (state, a) => { state.selectedTournament = a.payload; })
      .addCase(createTournament.fulfilled, (state, a) => { state.tournaments.unshift(a.payload); });
  },
});
export const { clearSelectedTournament } = tournamentSlice.actions;
export default tournamentSlice.reducer;
