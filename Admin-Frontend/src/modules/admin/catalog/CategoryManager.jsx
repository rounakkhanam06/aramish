import React, { useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, ChevronRight, 
  Layers, Package, Grid, Filter, MoreVertical,
  CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OptimizedImage from '../../../components/common/OptimizedImage';

const CategoryManager = () => {
  const [categories, setCategories] = useState([
    { id: 1, name: 'Electronics', slug: 'electronics', count: 124, status: 'Active', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop' },
    { id: 2, name: 'Fashion', slug: 'fashion', count: 856, status: 'Active', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&fit=crop' },
    { id: 3, name: 'Home & Kitchen', slug: 'home-kitchen', count: 432, status: 'Active', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=400&fit=crop' },
    { id: 4, name: 'Beauty', slug: 'beauty', count: 215, status: 'Active', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop' },
    { id: 5, name: 'Toys', slug: 'toys', count: 167, status: 'Draft', image: 'https://images.unsplash.com/photo-1532330393533-443990a51d10?w=400&h=400&fit=crop' },
    { id: 6, name: 'Stationery', slug: 'stationery', count: 0, status: 'Inactive', image: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400&h=400&fit=crop' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex justify-between items-center max-w-5xl">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-montserrat uppercase">Category Manager</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-raleway">Manage platform hierarchy</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={14} />
          New Category
        </button>
      </div>

      {/* Stats Quick View - More Compact Width */}
      <div className="grid grid-cols-3 gap-4 max-w-3xl">
        {[
          { label: 'Total', value: categories.length, icon: Grid, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active', value: categories.filter(c => c.status === 'Active').length, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Drafts', value: categories.filter(c => c.status !== 'Active').length, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-lg font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters - Compact Width */}
      <div className="flex gap-3 items-center max-w-xl">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
          <input 
            type="text" 
            placeholder="Search catalog..."
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-5 text-[12px] font-bold focus:ring-2 focus:ring-blue-50 transition-all outline-none text-slate-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
          <Filter size={14} />
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm animate-pulse flex flex-col h-[180px]">
              <div className="h-20 bg-slate-200"></div>
              <div className="p-3 flex-1 flex flex-col gap-2.5">
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="h-3 bg-slate-200 rounded w-1/3 mt-2"></div>
                <div className="mt-auto flex gap-1.5 pt-2 border-t border-slate-50">
                  <div className="h-6 flex-1 bg-slate-200 rounded-lg"></div>
                  <div className="h-6 w-6 bg-slate-200 rounded-lg"></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <AnimatePresence>
            {filteredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.02 }}
                className="group bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                <div className="relative h-20 overflow-hidden bg-slate-50">
                  <OptimizedImage 
                    src={category.image} 
                    alt={category.name}
                    type="category"
                    className="w-full h-full group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  <div className="absolute top-2 right-2">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest shadow-sm ${
                      category.status === 'Active' ? 'bg-green-500 text-white' : 
                      category.status === 'Draft' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                    }`}>
                      {category.status}
                    </span>
                  </div>
                </div>
                
                <div className="p-3 flex-1 flex flex-col gap-2.5">
                  <div>
                    <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-tight font-montserrat line-clamp-1 leading-tight">{category.name}</h3>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5 font-roboto leading-none">/{category.slug}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Package size={10} className="text-blue-500" />
                    <span className="text-[9px] font-bold text-slate-500 font-raleway leading-none">{category.count} Products</span>
                  </div>

                  <div className="pt-2 border-t border-slate-50 flex gap-1.5">
                    <button className="flex-1 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-1">
                      <Edit2 size={10} />
                      Manage
                    </button>
                    <button className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="group border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center p-4 gap-2 hover:border-blue-500 hover:bg-blue-50/20 transition-all min-h-[160px]"
          >
            <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm">
              <Plus size={20} />
            </div>
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-400 group-hover:text-blue-600 uppercase tracking-widest font-montserrat">New Category</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
