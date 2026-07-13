import { createSlice } from '@reduxjs/toolkit';
const userSlice = createSlice({
  name: 'user',
  initialState: { profile: null, isLoading: false },
  reducers: {
    setProfile: (state, a) => { state.profile = a.payload; },
    clearProfile: (state) => { state.profile = null; },
  },
});
export const { setProfile, clearProfile } = userSlice.actions;
export default userSlice.reducer;
