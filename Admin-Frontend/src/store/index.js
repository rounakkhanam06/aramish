import { configureStore } from '@reduxjs/toolkit';
import adminReducer from './slices/adminSlice';
import vendorReducer from './slices/vendorSlice';
import productReducer from './slices/productSlice';
import orderReducer from './slices/orderSlice';
import financeReducer from './slices/financeSlice';
import analyticsReducer from './slices/analyticsSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    admin: adminReducer,
    vendor: vendorReducer,
    products: productReducer,
    orders: orderReducer,
    finance: financeReducer,
    analytics: analyticsReducer,
    notifications: notificationReducer,
  },
});
