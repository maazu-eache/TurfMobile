import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';
export const fetchWallet = createAsyncThunk('wallet/fetch', async (_, { rejectWithValue }) => {
  try { return (await api.get('/wallet')).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchTransactions = createAsyncThunk('wallet/transactions', async (p, { rejectWithValue }) => {
  try { return (await api.get('/wallet/transactions', { params: p })).data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
const walletSlice = createSlice({
  name: 'wallet',
  initialState: { wallet: null, transactions: [], isLoading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.fulfilled, (state, a) => { state.wallet = a.payload; })
      .addCase(fetchTransactions.fulfilled, (state, a) => { state.transactions = a.payload?.transactions || []; });
  },
});
export default walletSlice.reducer;
