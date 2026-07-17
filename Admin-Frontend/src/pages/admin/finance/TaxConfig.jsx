import React, { useState } from 'react';
import { 
  ShieldCheck, Search, Plus, Trash2, 
  Edit2, Info, AlertCircle, FileText,
  DollarSign, CheckCircle2, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const MOCK_TAX_SLABS = [
  { id: 1, category: 'Fashion', gst: '12%', hsn: '4202', status: 'Active' },
  { id: 2, category: 'Electronics', gst: '18%', hsn: '8518', status: 'Active' },
  { id: 3, category: 'Beauty', gst: '18%', hsn: '3304', status: 'Active' },
  { id: 4, category: 'Home Decor', gst: '12%', hsn: '9403', status: 'Active' },
  { id: 5, category: 'Essential Goods', gst: '5%', hsn: '1001', status: 'Active' },
];

const TaxConfig = () => {
  const [slabs, setSlabs] = useState(MOCK_TAX_SLABS);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Tax & Compliance</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Configure GST slabs, HSN codes and category-wise tax rules.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all">
          <Plus size={16} />
          Add Tax Slab
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Tax Overview */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Category Tax Matrix</h3>
                  <div className="relative w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                     <input type="text" placeholder="Search category..." className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-[11px] font-bold outline-none" />
                  </div>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <th className="px-6 py-4">Category</th>
                           <th className="px-6 py-4">GST Rate</th>
                           <th className="px-6 py-4">HSN Code</th>
                           <th className="px-6 py-4">Status</th>
                           <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 text-sm">
                        {slabs.map((slab) => (
                           <tr key={slab.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-5 font-bold text-slate-900">{slab.category}</td>
                              <td className="px-6 py-5 font-black text-blue-600 font-roboto">{slab.gst}</td>
                              <td className="px-6 py-5 font-bold text-slate-400 font-roboto">{slab.hsn}</td>
                              <td className="px-6 py-5">
                                 <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-green-100">
                                    {slab.status}
                                 </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                 <button className="p-2 text-slate-300 hover:text-blue-500 transition-all">
                                    <Edit2 size={16} />
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Configuration Sidebar */}
         <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-green-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Global Settings</h3>
               </div>
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Inclusive Pricing</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Display prices with tax</p>
                     </div>
                     <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                     </div>
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Platform GSTIN</label>
                     <input type="text" defaultValue="07AAAAA0000A1Z5" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-10">
                  <FileText size={100} />
               </div>
               <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Legal Note</p>
                  <p className="text-xs opacity-80 mt-4 leading-relaxed font-medium italic">
                     "Tax changes are applied instantly. Ensure HSN codes match the latest government notifications to avoid compliance issues."
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default TaxConfig;
