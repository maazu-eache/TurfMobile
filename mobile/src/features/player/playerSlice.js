import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchMyPlayer = createAsyncThunk('player/fetchMe', async (_, { rejectWithValue }) => {
  try { return (await api.get('/players/me')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updatePlayerProfile = createAsyncThunk('player/update', async (data, { rejectWithValue }) => {
  try {
    return (await api.put('/players/me', data)).data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchPlayerById = createAsyncThunk('player/fetchById', async (payload, { rejectWithValue }) => {
  try {
    const id = typeof payload === 'string' ? payload : payload.id;
    const trackView = typeof payload === 'object' && payload.trackView;
    const res = await api.get(`/players/${id}`, {
      params: trackView ? { trackView: 'true' } : {}
    });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch player');
  }
});

export const fetchRankings = createAsyncThunk('player/rankings', async (params, { rejectWithValue }) => {
  try { return (await api.get('/players', { params })).data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const followPlayer = createAsyncThunk('player/follow', async (id, { rejectWithValue }) => {
  try { return (await api.post(`/players/${id}/follow`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to follow player'); }
});

const playerSlice = createSlice({
  name: 'player',
  initialState: { myProfile: null, viewedPlayer: null, rankings: [], isLoading: false, error: null },
  reducers: { clearViewedPlayer: (state) => { state.viewedPlayer = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyPlayer.fulfilled, (state, a) => { 
        console.log("FETCH_MY_PLAYER PAYLOAD:", JSON.stringify(a.payload?.batting)); 
        state.myProfile = a.payload; 
      })
      .addCase(updatePlayerProfile.fulfilled, (state, a) => { state.myProfile = a.payload; })
      .addCase(fetchPlayerById.fulfilled, (state, a) => { state.viewedPlayer = a.payload; })
      .addCase(fetchRankings.fulfilled, (state, a) => { state.rankings = a.payload.data; })
      .addCase(followPlayer.fulfilled, (state, a) => {
        const targetId = a.meta.arg;
        if (state.myProfile) {
          if (!state.myProfile.following) state.myProfile.following = [];
          if (a.payload.following) {
            if (!state.myProfile.following.includes(targetId)) {
              state.myProfile.following.push(targetId);
            }
          } else {
            state.myProfile.following = state.myProfile.following.filter(id => id !== targetId);
          }
        }
        if (state.viewedPlayer && state.viewedPlayer._id === targetId) {
          if (!state.viewedPlayer.followers) state.viewedPlayer.followers = [];
          if (state.myProfile) {
            const myPlayerId = state.myProfile._id;
            if (a.payload.following) {
              if (!state.viewedPlayer.followers.includes(myPlayerId)) {
                state.viewedPlayer.followers.push(myPlayerId);
              }
            } else {
              state.viewedPlayer.followers = state.viewedPlayer.followers.filter(id => id !== myPlayerId);
            }
          }
        }
      });
  },
});
export const { clearViewedPlayer } = playerSlice.actions;
export default playerSlice.reducer;
