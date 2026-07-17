import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  transactions: [],
  payouts: [],
  loading: false,
  error: null
};

const financeSlice = createSlice({
  name: 'finance',
  initialState,
  reducers: {
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    }
  }
});

export const { setTransactions } = financeSlice.actions;
export default financeSlice.reducer;
