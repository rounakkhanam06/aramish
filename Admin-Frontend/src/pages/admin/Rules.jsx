import React, { useState } from 'react';
import { 
  Key, Percent, Plus, Edit2, Trash2, 
  CheckCircle2, Info, Layers, Save, X,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_RULES = [
  { id: 1, category: 'Fashion', rate: 10, type: 'Percentage', status: 'Active', minSale: '₹0' },
  { id: 2, category: 'Electronics', rate: 8, type: 'Percentage', status: 'Active', minSale: '₹10,000' },
  { id: 3, category: 'Beauty', rate: 12, type: 'Percentage', status: 'Active', minSale: '₹0' },
  { id: 4, category: 'Home Decor', rate: 15, type: 'Percentage', status: 'Draft', minSale: '₹500' },
  { id: 5, category: 'Toys', rate: 5, type: 'Fixed Fee', status: 'Active', minSale: '₹0' },
];

const CommissionRules = () => {
  const [rules, setRules] = useState(INITIAL_RULES);
  const [isAdding, setIsAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-montserrat uppercase">Commission Policy</h1>
          <p className="text-slate-500 text-[11px] font-medium mt-0.5 font-raleway">Define and manage revenue sharing rules for various product categories.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={14} />
          Create Rule
        </button>
      </div>

      {/* Info Warning */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
           <AlertCircle size={16} />
        </div>
        <div>
           <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Policy Impact Notice</p>
           <p className="text-[10px] text-amber-600 font-medium mt-0.5 leading-tight">
             Any changes to commission rates will take effect on **new orders only**. Active subscriptions or past transactions will not be retroactively updated.
           </p>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence>
          {rules.map((rule, i) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                 <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center font-black shadow-inner">
                    <Layers size={20} />
                 </div>
                 <div className="flex gap-1.5">
                    <button className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                       <Edit2 size={12} />
                    </button>
                    <button className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                       <Trash2 size={12} />
                    </button>
                 </div>
              </div>

              <div>
                 <h3 className="text-[13px] font-black text-slate-900 font-montserrat uppercase tracking-tight">{rule.category}</h3>
                 <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-black text-blue-600 font-roboto">{rule.rate}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                       {rule.type === 'Percentage' ? '%' : 'FIXED'}
                    </span>
                 </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5">
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>Threshold</span>
                    <span className="text-slate-900">{rule.minSale}</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>Status</span>
                    <span className={`px-2 py-0.5 rounded-lg ${rule.status === 'Active' ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-400'}`}>
                       {rule.status}
                    </span>
                 </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Global Rule Card */}
        <div className="bg-slate-900 rounded-2xl p-5 flex flex-col justify-between text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-5 opacity-10">
              <ShieldCheck size={80} />
           </div>
           <div>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Global Policy</p>
              <h3 className="text-lg font-black mt-1 font-montserrat">Base Rate: 10%</h3>
              <p className="text-[10px] opacity-60 mt-2 leading-tight font-medium">
                Applied to all categories without specific custom rules.
              </p>
           </div>
           <button className="mt-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
              Update Base
           </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-center pt-6">
         <button 
           onClick={handleSave}
           className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:scale-105 shadow-blue-200'}`}
         >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Policy Published!' : 'Apply Global Changes'}
         </button>
      </div>
    </div>
  );
};

export default CommissionRules;
