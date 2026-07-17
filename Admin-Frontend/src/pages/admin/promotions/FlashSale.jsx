import React, { useState } from 'react';
import { 
  Zap, Plus, Search, Filter, MoreVertical, 
  Download, CheckCircle2, XCircle, Clock, 
  Trash2, Edit2, ShoppingBag, Calendar,
  ArrowUpRight, Users, Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_SALES = [
  { id: 1, name: 'Midnight Madness', start: '2026-05-15 00:00', end: '2026-05-15 04:00', products: 15, discount: 'Flat 50%', status: 'Scheduled' },
  { id: 2, name: 'Lunch Hour Deal', start: '2026-05-11 12:00', end: '2026-05-11 14:00', products: 8, discount: 'Up to 70%', status: 'Live' },
  { id: 3, name: 'Flash Friday', start: '2026-05-09 18:00', end: '2026-05-09 23:59', products: 45, discount: 'Min 40%', status: 'Completed' },
];

const FlashSale = () => {
  const [sales, setSales] = useState(MOCK_SALES);
  const [isAdding, setIsAdding] = useState(false);

  const StatusBadge = ({ status }) => {
    const styles = {
      'Live': 'bg-red-50 text-red-600 border-red-100 animate-pulse',
      'Scheduled': 'bg-blue-50 text-blue-600 border-blue-100',
      'Completed': 'bg-slate-50 text-slate-400 border-slate-100',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Flash Sales</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Configure high-velocity limited time discount events.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Zap size={16} fill="white" />
            Launch New Sale
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Sales', value: '01', icon: Timer, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Participating Items', value: '68', icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Projected Traffic', value: '4.2k', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Sale Alert if Live */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden flex items-center justify-between">
         <div className="absolute -right-10 -bottom-10 opacity-10">
            <Zap size={200} />
         </div>
         <div className="relative z-10">
            <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
               <h3 className="text-xl font-black font-montserrat uppercase tracking-tight">Lunch Hour Deal is Live</h3>
            </div>
            <p className="text-xs opacity-60 mt-2 font-medium">Ends in <span className="text-red-400 font-bold">01:42:15</span> • 458 users browsing currently</p>
         </div>
         <button className="relative z-10 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            Monitor Live
         </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Event Name</th>
                <th className="px-6 py-4">Timing</th>
                <th className="px-6 py-4">Impact</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {sales.map((sale, i) => (
                <tr key={sale.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div>
                       <p className="font-black text-slate-900 font-montserrat leading-tight uppercase tracking-tight">{sale.name}</p>
                       <p className="text-[10px] text-red-500 font-black mt-1 uppercase tracking-widest">{sale.discount}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-slate-700 text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {sale.start}
                       </div>
                       <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          {sale.end}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black border border-slate-100">
                      {sale.products} SKUs Included
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={sale.status} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Placeholder */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-md bg-white h-full rounded-[32px] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-slate-900 font-montserrat uppercase">Configure Flash Sale</h2>
                <button onClick={() => setIsAdding(false)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                  <XCircle size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Event Name</label>
                  <input type="text" placeholder="e.g. Early Bird Special" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none uppercase" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Start Time</label>
                    <input type="datetime-local" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">End Time</label>
                    <input type="datetime-local" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Global Discount Type</label>
                  <select className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 outline-none appearance-none">
                    <option>Flat Discount (%)</option>
                    <option>Up to (%)</option>
                    <option>Fixed Amount Off (₹)</option>
                  </select>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Products</label>
                      <button className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">+ Add Manually</button>
                   </div>
                   <div className="p-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-3">
                      <ShoppingBag size={32} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">No products selected yet.<br/>Drag and drop items here.</p>
                   </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex gap-3">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest">Discard</button>
                <button className="flex-1 py-4 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100 hover:scale-105 active:scale-95 transition-all">Schedule Sale</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlashSale;
