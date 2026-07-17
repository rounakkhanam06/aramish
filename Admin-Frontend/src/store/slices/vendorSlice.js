import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentVendor: {
    id: 'V101',
    name: 'Global Tech',
    owner: 'Alex Wong',
    status: 'Approved',
    logo: null,
    rating: 4.8,
    joined: '2026-01-15',
    commissionRate: 15
  },
  earnings: {
    totalRevenue: 450000,
    withdrawable: 75000,
    pending: 12000,
    payoutHistory: [
      { id: 'TX1', amount: 50000, status: 'Completed', date: '2026-04-15' }
    ]
  },
  inventory: {
    totalProducts: 45,
    outOfStock: 2,
    pendingApproval: 3
  },
  loading: false,
  error: null
};

const vendorSlice = createSlice({
  name: 'vendor',
  initialState,
  reducers: {
    updateVendorProfile: (state, action) => {
      state.currentVendor = { ...state.currentVendor, ...action.payload };
    },
    addPayoutRequest: (state, action) => {
      state.earnings.payoutHistory.unshift({
        id: `TX${Date.now()}`,
        amount: action.payload,
        status: 'Pending',
        date: new Date().toISOString().split('T')[0]
      });
      state.earnings.withdrawable -= action.payload;
    }
  }
});

export const { updateVendorProfile, addPayoutRequest } = vendorSlice.actions;
export default vendorSlice.reducer;
