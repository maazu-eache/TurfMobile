import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchMyPlayer = createAsyncThunk('player/fetchMe', async (_, { rejectWithValue }) => {
  try { return (await api.get('/players/me')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updatePlayerProfile = createAsyncThunk('player/update', async (data, { rejectWithValue }) => {
  try { return (await api.put('/players/me', data)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchPlayerById = createAsyncThunk('player/fetchById', async (payload, { rejectWithValue }) => {
  try {
    const id = typeof payload === 'string' ? payload : payload.id;
    const trackView = typeof payload === 'object' && payload.trackView;
    const res = await api.get(`/players/${id}`, { params: trackView ? { trackView: 'true' } : {} });
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to fetch player'); }
});

export const fetchRankings = createAsyncThunk('player/rankings', async (params, { rejectWithValue }) => {
  try { return (await api.get('/players', { params })).data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchGlobalLeaderboard = createAsyncThunk('player/globalLeaderboard', async (params, { rejectWithValue }) => {
  try { return (await api.get('/players/leaderboard/global', { params })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to fetch leaderboard'); }
});

export const followPlayer = createAsyncThunk('player/follow', async (id, { rejectWithValue }) => {
  try { return (await api.post(`/players/${id}/follow`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to follow player'); }
});

export const fetchMatchHistory = createAsyncThunk('player/matchHistory', async ({ playerId, ballType } = {}, { rejectWithValue }) => {
  try {
    const params = ballType && ballType !== 'Overall' ? { ballType } : {};
    const res = await api.get(`/players/${playerId}/match-history`, { params });
    return res.data.data.history;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchPlayerAchievements = createAsyncThunk('player/achievements', async (id, { rejectWithValue }) => {
  try { return (await api.get(`/players/${id}/achievements`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchPlayerBallTypes = createAsyncThunk('player/ballTypes', async (id, { rejectWithValue }) => {
  try { return (await api.get(`/players/${id}/ball-types`)).data.data.ballTypes; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const playerSlice = createSlice({
  name: 'player',
  initialState: {
    myProfile: null,
    viewedPlayer: null,
    rankings: [],
    globalLeaderboard: {
      batters: [],
      bowlers: [],
      fielders: [],
      category: 'batters',
      ballType: 'All',
    },
    matchHistory: [],
    achievements: [],
    availableBallTypes: [],
    isLoading: false,
    error: null,
  },
  reducers: { clearViewedPlayer: (state) => { state.viewedPlayer = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyPlayer.fulfilled, (state, a) => { state.myProfile = a.payload; })
      .addCase(updatePlayerProfile.fulfilled, (state, a) => { state.myProfile = a.payload; })
      .addCase(fetchPlayerById.fulfilled, (state, a) => { state.viewedPlayer = a.payload; })
      .addCase(fetchRankings.fulfilled, (state, a) => {
        if (a.meta.arg.page > 1) {
          const existingIds = new Set(state.rankings.map(t => t._id));
          const newItems = (a.payload.data || []).filter(t => !existingIds.has(t._id));
          state.rankings = [...state.rankings, ...newItems];
        } else {
          state.rankings = a.payload.data || [];
        }
      })
      .addCase(fetchMatchHistory.fulfilled, (state, a) => { state.matchHistory = a.payload || []; })
      .addCase(fetchPlayerAchievements.fulfilled, (state, a) => { state.achievements = a.payload || []; })
      .addCase(fetchPlayerBallTypes.fulfilled, (state, a) => { state.availableBallTypes = a.payload || []; })
      .addCase(fetchGlobalLeaderboard.pending, (state) => { state.isLoading = true; })
      .addCase(fetchGlobalLeaderboard.fulfilled, (state, action) => {
        state.isLoading = false;
        const { category, players, ballType } = action.payload;
        state.globalLeaderboard.category = category;
        state.globalLeaderboard.ballType = ballType;
        if (category === 'batters') state.globalLeaderboard.batters = players;
        else if (category === 'bowlers') state.globalLeaderboard.bowlers = players;
        else if (category === 'fielders') state.globalLeaderboard.fielders = players;
      })
      .addCase(fetchGlobalLeaderboard.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(followPlayer.fulfilled, (state, a) => {
        const targetId = a.meta.arg;
        if (state.myProfile) {
          if (!state.myProfile.following) state.myProfile.following = [];
          if (a.payload.following) {
            if (!state.myProfile.following.includes(targetId)) state.myProfile.following.push(targetId);
          } else {
            state.myProfile.following = state.myProfile.following.filter(id => id !== targetId);
          }
        }
        if (state.viewedPlayer && state.viewedPlayer._id === targetId) {
          if (!state.viewedPlayer.followers) state.viewedPlayer.followers = [];
          if (state.myProfile) {
            const myPlayerId = state.myProfile._id;
            if (a.payload.following) {
              if (!state.viewedPlayer.followers.includes(myPlayerId)) state.viewedPlayer.followers.push(myPlayerId);
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
