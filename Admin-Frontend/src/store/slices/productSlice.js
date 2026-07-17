import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  allProducts: [
    { id: 'P101', name: 'Ultra Smartwatch', price: 2999, stock: 150, vendorId: 'V101', category: 'Electronics', status: 'Approved', sales: 120 },
    { id: 'P102', name: 'Leather Messenger Bag', price: 4500, stock: 45, vendorId: 'V102', category: 'Fashion', status: 'Approved', sales: 85 },
    { id: 'P103', name: 'Wireless Earbuds Pro', price: 1999, stock: 200, vendorId: 'V101', category: 'Electronics', status: 'Pending', sales: 0 }
  ],
  categories: ['Electronics', 'Fashion', 'Home & Kitchen', 'Beauty', 'Toys'],
  banners: [
    { id: 'B1', title: 'Summer Sale', image: null, position: 'Home-Top', status: 'Active' }
  ],
  loading: false,
  error: null
};

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    addProduct: (state, action) => {
      state.allProducts.push({ ...action.payload, status: 'Pending', sales: 0 });
    },
    updateProduct: (state, action) => {
      const index = state.allProducts.findIndex(p => p.id === action.payload.id);
      if (index !== -1) state.allProducts[index] = { ...state.allProducts[index], ...action.payload };
    },
    approveProduct: (state, action) => {
      const product = state.allProducts.find(p => p.id === action.payload);
      if (product) product.status = 'Approved';
    },
    deleteProduct: (state, action) => {
      state.allProducts = state.allProducts.filter(p => p.id !== action.payload);
    }
  }
});

export const { addProduct, updateProduct, approveProduct, deleteProduct } = productSlice.actions;
export default productSlice.reducer;
