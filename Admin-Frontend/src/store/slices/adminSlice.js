import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  pendingVendors: [
    { id: 'V1', name: 'Elite Electronics', owner: 'John Doe', email: 'john@elite.com', status: 'Pending', joined: '2026-05-01' },
    { id: 'V2', name: 'Fashion Hub', owner: 'Jane Smith', email: 'jane@fashion.com', status: 'Pending', joined: '2026-05-03' }
  ],
  allVendors: [
    { id: 'V101', name: 'Global Tech', owner: 'Alex Wong', email: 'alex@global.com', status: 'Approved', joined: '2026-01-15', revenue: 450000 },
    { id: 'V102', name: 'Urban Style', owner: 'Sarah Lee', email: 'sarah@urban.com', status: 'Approved', joined: '2026-02-20', revenue: 230000 }
  ],
  systemStats: {
    totalRevenue: 1250000,
    totalOrders: 4520,
    activeVendors: 125,
    platformCommission: 187500
  },
  payoutRequests: [
    { id: 'P1', vendorId: 'V101', amount: 50000, status: 'Pending', date: '2026-05-05' }
  ],
  loading: false,
  error: null
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    approveVendor: (state, action) => {
      const vendorId = action.payload;
      const vendor = state.pendingVendors.find(v => v.id === vendorId);
      if (vendor) {
        vendor.status = 'Approved';
        state.allVendors.push(vendor);
        state.pendingVendors = state.pendingVendors.filter(v => v.id !== vendorId);
      }
    },
    rejectVendor: (state, action) => {
      state.pendingVendors = state.pendingVendors.filter(v => v.id === action.payload);
    },
    updateSystemStats: (state, action) => {
      state.systemStats = { ...state.systemStats, ...action.payload };
    }
  }
});

export const { approveVendor, rejectVendor, updateSystemStats } = adminSlice.actions;
export default adminSlice.reducer;
