import { createSlice } from '@reduxjs/toolkit';

const orderSlice = createSlice({
  name: 'orders',
  initialState: { items: [], loading: false },
  reducers: {}
});
export default orderSlice.reducer;
