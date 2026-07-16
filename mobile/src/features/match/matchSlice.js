import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// Fetch live match state (REST fallback for Socket)
export const undoBall = createAsyncThunk('match/undoBall', async (matchId, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/matches/${matchId}/ball`);
    return res.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to undo ball');
  }
});

export const setInitialPlayers = createAsyncThunk('match/setPlayers', async ({ matchId, striker, nonStriker, bowler }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/matches/${matchId}/set-players`, { striker, nonStriker, bowler });
    return res.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to set players');
  }
});

export const fetchLiveState = createAsyncThunk('match/fetchLive', async (matchId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/matches/${matchId}/live`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchScorecard = createAsyncThunk('match/fetchScorecard', async (matchId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/matches/${matchId}/scorecard`);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const scoreBall = createAsyncThunk('match/scoreBall', async ({ matchId, ballData }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/matches/${matchId}/ball`, ballData);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchMatches = createAsyncThunk('match/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/matches', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch matches');
  }
});

export const createMatch = createAsyncThunk('match/create', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/matches', data);
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchMyMatches = createAsyncThunk('match/fetchMyMatches', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/matches/my-matches', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch my matches');
  }
});

export const addMatchScorer = createAsyncThunk('match/addScorer', async ({ matchId, mobile }, { rejectWithValue }) => {
  try {
    const res = await api.post(`/matches/${matchId}/add-scorer`, { mobile });
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to add scorer');
  }
});

const matchSlice = createSlice({
  name: 'match',
  initialState: {
    matches: [],
    myMatches: [],
    currentMatch: null,
    liveState: null,
    scorecard: null,
    ballHistory: [],
    isLoading: false,
    error: null,
    isConnected: false,
  },
  reducers: {
    setLiveState: (state, action) => {
      state.liveState = action.payload;
    },
    addBallToHistory: (state, action) => {
      state.ballHistory = [action.payload, ...state.ballHistory].slice(0, 100);
    },
    setSocketConnected: (state, action) => {
      state.isConnected = action.payload;
    },
    resetMatch: (state) => {
      state.currentMatch = null;
      state.liveState = null;
      state.scorecard = null;
      state.ballHistory = [];
    },
    updateLiveMatchScore: (state, action) => {
      const { matchId, score, battingTeam, match } = action.payload;
      const updateList = (list) => {
        const index = list.findIndex(m => m._id === matchId);
        if (index !== -1) {
          const m = list[index];
          if (battingTeam === m.teamA?._id || battingTeam?._id === m.teamA?._id) {
            m.teamAScore = { ...m.teamAScore, ...score };
          } else if (battingTeam === m.teamB?._id || battingTeam?._id === m.teamB?._id) {
            m.teamBScore = { ...m.teamBScore, ...score };
          }
          if (match) {
            m.status = match.status;
          }
        }
      };
      updateList(state.myMatches);
      updateList(state.matches);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMatches.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMatches.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.meta.arg.page > 1) {
          // avoid duplicates if necessary, or just append
          const existingIds = new Set(state.matches.map(m => m._id));
          const newItems = (action.payload.data || []).filter(m => !existingIds.has(m._id));
          state.matches = [...state.matches, ...newItems];
        } else {
          state.matches = action.payload.data || [];
        }
      })
      .addCase(fetchMatches.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchMyMatches.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMyMatches.fulfilled, (state, action) => {
        state.isLoading = false;
        state.myMatches = action.payload.data || [];
      })
      .addCase(fetchMyMatches.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(addMatchScorer.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(addMatchScorer.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(addMatchScorer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchLiveState.fulfilled, (state, action) => {
        state.liveState = action.payload;
      })
      .addCase(fetchScorecard.fulfilled, (state, action) => {
        state.scorecard = action.payload;
      })
      .addCase(createMatch.fulfilled, (state, action) => {
        state.currentMatch = action.payload;
      })
      .addCase(setInitialPlayers.fulfilled, (state, action) => {
        state.liveState = action.payload;
      })
      .addCase(scoreBall.fulfilled, (state, action) => {
        state.liveState = action.payload;
        if (action.payload.ballEvent) {
          state.ballHistory = [action.payload.ballEvent, ...state.ballHistory].slice(0, 100);
        }
      })
      .addCase(undoBall.fulfilled, (state, action) => {
        state.liveState = action.payload;
      });
  },
});

export const { setLiveState, addBallToHistory, setSocketConnected, resetMatch, updateLiveMatchScore } = matchSlice.actions;
export default matchSlice.reducer;
