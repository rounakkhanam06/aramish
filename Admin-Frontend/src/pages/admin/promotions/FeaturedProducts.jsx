import React, { useState } from 'react';
import { 
  Star, TrendingUp, Search, Plus, 
  Trash2, GripVertical, ShoppingBag, CheckCircle2,
  AlertCircle, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OptimizedImage from '../../../components/common/OptimizedImage';

const MOCK_FEATURED = [
  { id: 1, name: 'Premium Leather Satchel', category: 'Fashion', price: '₹4,500', img: 'https://via.placeholder.com/80' },
  { id: 2, name: 'Wireless Earbuds Pro', category: 'Electronics', price: '₹8,900', img: 'https://via.placeholder.com/80' },
];

const MOCK_TRENDING = [
  { id: 3, name: 'Biotique Face Wash', category: 'Beauty', price: '₹250', img: 'https://via.placeholder.com/80' },
  { id: 4, name: 'Summer Floral Dress', category: 'Fashion', price: '₹2,100', img: 'https://via.placeholder.com/80' },
];

const FeaturedProducts = () => {
  const [featured, setFeatured] = useState(MOCK_FEATURED);
  const [trending, setTrending] = useState(MOCK_TRENDING);
  const [activeTab, setActiveTab] = useState('Featured');

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Curation Hub</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage featured and trending products across the main storefront.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all">
          <Plus size={16} />
          Add to Collection
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Featured Products */}
         <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-amber-50 text-amber-500 rounded-lg shadow-inner">
                  <Star size={18} fill="currentColor" />
               </div>
               <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Featured Selection</h3>
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-50 flex gap-4">
                  <div className="relative flex-1">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                     <input type="text" placeholder="Search product..." className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-[11px] font-bold outline-none" />
                  </div>
               </div>
               <div className="divide-y divide-slate-50">
                  {featured.map((item) => (
                    <div key={item.id} className="p-4 flex items-center gap-4 group hover:bg-slate-50/50 transition-colors">
                       <GripVertical size={16} className="text-slate-200 cursor-grab active:cursor-grabbing" />
                       <div className="w-14 h-14 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                          <OptimizedImage src={item.img} alt={item.name} type="product" className="w-full h-full" />
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-black text-slate-900 font-montserrat leading-tight truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.category} • {item.price}</p>
                       </div>
                       <button className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                       </button>
                    </div>
                  ))}
               </div>
               <div className="p-4 bg-slate-50/50 flex justify-center border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Drag products to change home display order</p>
               </div>
            </div>
         </div>

         {/* Trending Products */}
         <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-red-50 text-red-500 rounded-lg shadow-inner">
                  <TrendingUp size={18} />
               </div>
               <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Trending Now</h3>
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-50 flex gap-4">
                  <div className="relative flex-1">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                     <input type="text" placeholder="Search product..." className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-[11px] font-bold outline-none" />
                  </div>
               </div>
               <div className="divide-y divide-slate-50">
                  {trending.map((item) => (
                    <div key={item.id} className="p-4 flex items-center gap-4 group hover:bg-slate-50/50 transition-colors">
                       <GripVertical size={16} className="text-slate-200 cursor-grab active:cursor-grabbing" />
                       <div className="w-14 h-14 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                          <OptimizedImage src={item.img} alt={item.name} type="product" className="w-full h-full" />
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-black text-slate-900 font-montserrat leading-tight truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{item.category} • {item.price}</p>
                       </div>
                       <button className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                       </button>
                    </div>
                  ))}
               </div>
               <div className="p-4 bg-slate-50/50 flex justify-center border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Limited to top 10 products for visibility</p>
               </div>
            </div>
         </div>
      </div>

      {/* Preview Section */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden flex items-center justify-between">
         <div className="absolute -right-20 -bottom-20 opacity-10">
            <LayoutGrid size={300} />
         </div>
         <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-2xl">
               <CheckCircle2 size={32} />
            </div>
            <div>
               <h3 className="text-2xl font-black font-montserrat uppercase tracking-tight">Live Preview Ready</h3>
               <p className="text-xs opacity-60 mt-2 font-medium max-w-md leading-relaxed">
                  Your changes to featured and trending products are saved as drafts. Click publish to push them live to the mobile and web storefronts.
               </p>
            </div>
         </div>
         <button className="relative z-10 px-8 py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
            Publish Changes
         </button>
      </div>
    </div>
  );
};

export default FeaturedProducts;
