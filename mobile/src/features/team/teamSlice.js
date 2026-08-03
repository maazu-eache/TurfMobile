import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchMyTeams = createAsyncThunk('team/fetchMy', async (_, { rejectWithValue }) => {
  try { return (await api.get('/teams/my/teams')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchOpponentTeams = createAsyncThunk('team/fetchOpponents', async (_, { rejectWithValue }) => {
  try { return (await api.get('/teams/my/opponent-teams')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchFollowingTeams = createAsyncThunk('team/fetchFollowing', async (_, { rejectWithValue }) => {
  try { return (await api.get('/teams/my/following-teams')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const searchGlobalTeams = createAsyncThunk('team/searchGlobal', async (query, { rejectWithValue }) => {
  try { return (await api.get(`/teams/search?q=${encodeURIComponent(query)}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchTeamById = createAsyncThunk('team/fetchById', async (id, { rejectWithValue }) => {
  try { return (await api.get(`/teams/${id}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchTeamStats = createAsyncThunk('team/fetchStats', async (id, { rejectWithValue }) => {
  try { return (await api.get(`/teams/${id}/stats`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const toggleFollowTeam = createAsyncThunk('team/toggleFollow', async (teamId, { rejectWithValue }) => {
  try {
    const res = (await api.post(`/teams/${teamId}/follow`)).data.data;
    return { teamId, ...res };
  }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createTeam = createAsyncThunk('team/create', async (body, { rejectWithValue }) => {
  try {
    const headers = body instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    return (await api.post('/teams', body, { headers })).data.data;
  }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to create team'); }
});

export const joinTeam = createAsyncThunk('team/join', async (code, { rejectWithValue }) => {
  try { return (await api.post(`/teams/join/${code}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const lookupPlayerByMobile = createAsyncThunk('team/lookupPlayer', async (mobile, { rejectWithValue }) => {
  try { return (await api.get(`/players/lookup/${mobile}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Player lookup failed'); }
});

export const addPlayerToTeam = createAsyncThunk('team/addPlayer', async ({ teamId, mobile, name, role, matchId, tournamentId }, { rejectWithValue }) => {
  try { return (await api.post(`/teams/${teamId}/players`, { mobile, name, role, matchId, tournamentId })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to add player'); }
});

export const getLastSquad = createAsyncThunk('team/getLastSquad', async (teamId, { rejectWithValue }) => {
  try { return (await api.get(`/teams/${teamId}/last-squad`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to fetch last squad'); }
});

export const updatePlayerRole = createAsyncThunk('team/updatePlayerRole', async ({ teamId, playerId, role }, { rejectWithValue }) => {
  try { return (await api.put(`/teams/${teamId}/players/${playerId}/role`, { role })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to update player role'); }
});

export const updateTeam = createAsyncThunk('team/update', async ({ teamId, formData }, { rejectWithValue }) => {
  try {
    return (await api.put(`/teams/${teamId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to update team'); }
});

export const deleteTeam = createAsyncThunk('team/delete', async (teamId, { rejectWithValue }) => {
  try { await api.delete(`/teams/${teamId}`); return teamId; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to delete team'); }
});

export const leaveTeam = createAsyncThunk('team/leave', async (teamId, { rejectWithValue }) => {
  try { await api.post(`/teams/${teamId}/leave`); return teamId; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to leave team'); }
});

export const removePlayerFromTeam = createAsyncThunk('team/removePlayer', async ({ teamId, playerId }, { rejectWithValue }) => {
  try { return (await api.delete(`/teams/${teamId}/players/${playerId}`)).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to remove player'); }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const teamSlice = createSlice({
  name: 'team',
  initialState: {
    myTeams: [], opponentTeams: [], followingTeams: [], globalSearchTeams: [],
    selectedTeam: null, teamStats: null,
    isLoading: false, opponentsLoading: false, followingLoading: false, searchLoading: false, statsLoading: false, error: null
  },
  reducers: {
    clearSelectedTeam: (state) => { state.selectedTeam = null; state.teamStats = null; },
  },
  extraReducers: (builder) => {
    builder
      // My Teams
      .addCase(fetchMyTeams.pending, (state) => { state.isLoading = true; })
      .addCase(fetchMyTeams.fulfilled, (state, a) => { state.isLoading = false; state.myTeams = a.payload; })
      .addCase(fetchMyTeams.rejected, (state) => { state.isLoading = false; })

      // Opponent Teams
      .addCase(fetchOpponentTeams.pending, (state) => { state.opponentsLoading = true; })
      .addCase(fetchOpponentTeams.fulfilled, (state, a) => { state.opponentsLoading = false; state.opponentTeams = a.payload; })
      .addCase(fetchOpponentTeams.rejected, (state, a) => { state.opponentsLoading = false; state.error = a.payload; })

      // Following
      .addCase(fetchFollowingTeams.pending, (state) => { state.followingLoading = true; })
      .addCase(fetchFollowingTeams.fulfilled, (state, a) => { state.followingLoading = false; state.followingTeams = a.payload; })
      .addCase(fetchFollowingTeams.rejected, (state) => { state.followingLoading = false; })
      // Search Global
      .addCase(searchGlobalTeams.pending, (state) => { state.searchLoading = true; })
      .addCase(searchGlobalTeams.fulfilled, (state, a) => { state.searchLoading = false; state.globalSearchTeams = a.payload; })
      .addCase(searchGlobalTeams.rejected, (state, a) => { state.searchLoading = false; state.error = a.payload; })

      // Team by ID
      .addCase(fetchTeamById.pending, (state) => { state.isLoading = true; })
      .addCase(fetchTeamById.fulfilled, (state, a) => { state.isLoading = false; state.selectedTeam = a.payload; })
      .addCase(fetchTeamById.rejected, (state) => { state.isLoading = false; })

      // Team Stats
      .addCase(fetchTeamStats.pending, (state) => { state.statsLoading = true; })
      .addCase(fetchTeamStats.fulfilled, (state, a) => { state.statsLoading = false; state.teamStats = a.payload; })
      .addCase(fetchTeamStats.rejected, (state) => { state.statsLoading = false; })

      // Toggle Follow
      .addCase(toggleFollowTeam.fulfilled, (state, a) => {
        const { teamId, isFollowing, followerCount } = a.payload;
        // Update in selectedTeam
        if (state.selectedTeam?._id === teamId) {
          state.selectedTeam.isFollowing = isFollowing;
          state.selectedTeam.followerCount = followerCount;
        }
        // Update in myTeams
        const myIdx = state.myTeams.findIndex(t => t._id === teamId);
        if (myIdx > -1) state.myTeams[myIdx].isFollowing = isFollowing;
        // Update in opponentTeams
        const oppIdx = state.opponentTeams.findIndex(t => t._id === teamId);
        if (oppIdx > -1) state.opponentTeams[oppIdx].isFollowing = isFollowing;
      })

      // Create
      .addCase(createTeam.fulfilled, (state, a) => {
        if (a.payload.players && a.payload.players.length > 0) {
          state.myTeams.unshift(a.payload);
        }
      })

      // Add Player
      .addCase(addPlayerToTeam.fulfilled, (state, a) => {
        if (state.selectedTeam?._id) state.selectedTeam.players.push(a.payload);
      })

      // Update Role
      .addCase(updatePlayerRole.fulfilled, (state, a) => { state.selectedTeam = a.payload; })

      // Update Team
      .addCase(updateTeam.fulfilled, (state, a) => {
        state.selectedTeam = a.payload;
        state.myTeams = state.myTeams.map(t => t._id === a.payload._id ? a.payload : t);
      })

      // Delete
      .addCase(deleteTeam.fulfilled, (state, a) => {
        state.myTeams = state.myTeams.filter(t => t._id !== a.payload);
        state.selectedTeam = null;
      })

      // Leave
      .addCase(leaveTeam.fulfilled, (state, a) => {
        state.myTeams = state.myTeams.filter(t => t._id !== a.payload);
        state.selectedTeam = null;
      })

      // Remove Player
      .addCase(removePlayerFromTeam.fulfilled, (state, a) => { state.selectedTeam = a.payload; });
  },
});

export const { clearSelectedTeam } = teamSlice.actions;
export default teamSlice.reducer;
