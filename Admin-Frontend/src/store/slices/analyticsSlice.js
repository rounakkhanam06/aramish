import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  data: {},
  loading: false,
  error: null
};

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setAnalyticsData: (state, action) => {
      state.data = action.payload;
    }
  }
});

export const { setAnalyticsData } = analyticsSlice.actions;
export default analyticsSlice.reducer;
