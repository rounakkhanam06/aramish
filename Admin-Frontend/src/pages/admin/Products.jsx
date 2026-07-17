import React from 'react';
import { Edit, Trash2, Plus, Search, Filter, MoreVertical } from 'lucide-react';
import OptimizedImage from '../../components/common/OptimizedImage';

const Products = () => {
  const products = [
    { id: 1, name: 'Apple iPhone 15', category: 'Electronics', price: '₹69,999', stock: 45, status: 'In Stock', image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=100' },
    { id: 2, name: 'Sony WH-1000XM5', category: 'Electronics', price: '₹29,990', stock: 12, status: 'Low Stock', image: 'https://images.unsplash.com/photo-1670057037305-64d84711833d?w=100' },
    { id: 3, name: 'Samsung Galaxy Watch 6', category: 'Electronics', price: '₹18,499', stock: 0, status: 'Out of Stock', image: 'https://images.unsplash.com/photo-1695213601569-8088019316d3?w=100' },
    { id: 4, name: 'Nike Air Max Pulse', category: 'Fashion', price: '₹12,995', stock: 89, status: 'In Stock', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100' },
    { id: 5, name: 'Logitech MX Master 3S', category: 'Electronics', price: '₹9,495', stock: 24, status: 'In Stock', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=100' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-emerald-100 text-emerald-700';
      case 'Low Stock': return 'bg-orange-100 text-orange-700';
      case 'Out of Stock': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your inventory, pricing, and stock levels.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus size={18} /> Add New Product
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search products by name, SKU..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter size={18} /> Filters
          </button>
          <select className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 outline-none cursor-pointer">
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Fashion</option>
            <option>Home & Kitchen</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative">
                        <OptimizedImage src={product.image} alt={product.name} type="product" className="absolute inset-0 p-1" objectFit="contain" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase">SKU: SH-902{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{product.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-800">{product.price}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{product.stock} units</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${getStatusColor(product.status)}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                        <Edit size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <Trash2 size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <p className="text-sm text-slate-500">Showing 1 to 5 of 100 entries</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-500 hover:bg-white disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 border border-blue-600 bg-blue-600 text-white rounded text-sm">1</button>
            <button className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-500 hover:bg-white">2</button>
            <button className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-500 hover:bg-white">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Products;
