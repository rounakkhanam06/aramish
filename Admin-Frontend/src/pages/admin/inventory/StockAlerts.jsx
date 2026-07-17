import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, Filter, MoreVertical, 
  RefreshCcw, Package, AlertCircle, TrendingDown,
  ShoppingBag, ChevronRight, CheckCircle2, XCircle, Edit3
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import OptimizedImage from '../../../components/common/OptimizedImage';
import { getImageUrl } from '../../../utils/imageHelper';

const StockAlerts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingStock, setEditingStock] = useState(null);
  const [stockValue, setStockValue] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/products?t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load products from server');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProducts();
      toast.success('Stock alerts refreshed successfully!');
    } catch (err) {
      toast.error('Failed to refresh stock alerts.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSaveStock = async (id, newStock) => {
    if (newStock < 0) {
      toast.error('Stock cannot be negative!');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stock: newStock })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Stock updated successfully');
        fetchProducts();
      } else {
        toast.error(data.message || 'Failed to update stock');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  // Map all products to alert items structure
  const alertItems = products.map(p => {
    let status = 'In Stock';
    if ((p.stock ?? 0) === 0) {
      status = 'Out of Stock';
    } else if ((p.stock ?? 0) <= 3) {
      status = 'Critical';
    } else if ((p.stock ?? 0) <= 10) {
      status = 'Low';
    }
    return {
      id: p._id,
      name: p.name,
      category: p.category,
      stock: p.stock ?? 0,
      threshold: 10,
      status: status,
      image: p.images && p.images[0] ? p.images[0] : '',
      vendor: p.brandName || 'Generic'
    };
  });

  // Calculate stats dynamically (based on low stock levels)
  const outOfStockCount = alertItems.filter(item => item.stock === 0).length;
  const criticalCount = alertItems.filter(item => item.stock > 0 && item.stock <= 3).length;
  const lowStockCount = alertItems.filter(item => item.stock > 3 && item.stock <= 10).length;

  // Filter based on search input
  const filteredAlerts = alertItems.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase()) ||
    item.vendor.toLowerCase().includes(search.toLowerCase())
  );

  const StatusBadge = ({ status }) => {
    const styles = {
      'Critical': 'bg-rose-50 text-rose-600 border-rose-100',
      'Low': 'bg-amber-50 text-amber-600 border-amber-100',
      'Out of Stock': 'bg-red-50 text-red-600 border-red-100',
      'In Stock': 'bg-green-50 text-green-600 border-green-100',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${styles[status]}`}>
        {status}
      </span>
    );
  };


  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Inventory Alerts</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Monitor low-stock items and prevent out-of-stock situations.</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-6 py-3 bg-[#0B132B] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {[
           { label: 'Out of Stock', value: String(outOfStockCount).padStart(2, '0'), icon: AlertCircle, color: 'text-[#0B132B]', bg: 'bg-red-50' },
           { label: 'Critical Level', value: String(criticalCount).padStart(2, '0'), icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
           { label: 'Low Stock Items', value: String(lowStockCount).padStart(2, '0'), icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-50' },
         ].map((stat, i) => (
           <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
              <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                 <stat.icon size={28} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                 <p className="text-2xl font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
              </div>
           </div>
         ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
           <div className="relative w-full max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0B132B]" size={18} />
              <input 
                type="text" 
                placeholder="Search by product or brand..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold outline-none" 
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Brand / Vendor</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Threshold</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 font-medium">
                    Loading inventory products...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 font-medium">
                    No low-stock alerts found! All items are adequately stocked.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#0B132B] border border-orange-100 overflow-hidden shrink-0">
                            <OptimizedImage src={item.image} alt={item.name} type="product" className="w-full h-full" />
                          </div>
                         <div>
                            <p className="font-black text-slate-900 font-montserrat uppercase tracking-tight leading-tight">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{item.category}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-600">{item.vendor}</td>
                    <td className="px-6 py-5">
                      {editingStock === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={stockValue}
                            onChange={e => setStockValue(e.target.value)}
                            className="w-20 border border-orange-200 rounded-lg py-1.5 px-2.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-100"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              handleSaveStock(item.id, Number(stockValue));
                              setEditingStock(null);
                            }}
                            className="p-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-all"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => setEditingStock(null)}
                            className="p-1 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-all"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-2 cursor-pointer group/stock"
                          onClick={() => {
                            setEditingStock(item.id);
                            setStockValue(item.stock);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full ${item.stock === 0 ? 'bg-red-500' : item.stock <= 3 ? 'bg-red-500' : item.stock <= 10 ? 'bg-amber-500' : 'bg-green-500'}`} />
                          <span className="font-black text-slate-900 font-roboto">{item.stock} Units</span>
                          <Edit3 size={12} className="text-slate-300 opacity-0 group-hover/stock:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-400 font-roboto">{item.threshold} Units</td>
                    <td className="px-6 py-5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                         <button 
                          onClick={() => {
                            setEditingStock(item.id);
                            setStockValue(Number(item.stock) + 10);
                          }}
                          className="px-4 py-2 bg-[#0B132B] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-orange-100"
                         >
                            Restock (+10)
                         </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockAlerts;

