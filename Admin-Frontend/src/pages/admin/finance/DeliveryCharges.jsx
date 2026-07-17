import React, { useState } from 'react';
import { 
  Truck, Search, Plus, MapPin, 
  Trash2, Edit2, DollarSign, CheckCircle2,
  AlertCircle, ChevronRight, Package, Layout
} from 'lucide-react';
import { motion } from 'framer-motion';

const MOCK_ZONES = [
  { id: 1, name: 'Metro Cities', area: 'Delhi, Mumbai, Bangalore...', baseFee: '₹49', freeAbove: '₹999', status: 'Active' },
  { id: 2, name: 'Tier 2 Cities', area: 'Jaipur, Lucknow, Pune...', baseFee: '₹79', freeAbove: '₹1,499', status: 'Active' },
  { id: 3, name: 'Rest of India', area: 'All other locations', baseFee: '₹120', freeAbove: '₹2,499', status: 'Active' },
];

const DeliveryCharges = () => {
  const [zones, setZones] = useState(MOCK_ZONES);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Logistics Pricing</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage zone-based delivery fees, free shipping thresholds and COD charges.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all">
          <Plus size={16} />
          Add Pricing Zone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Zone Matrix */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-50">
                  <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Zone Matrix</h3>
               </div>
               <div className="divide-y divide-slate-50">
                  {zones.map((zone) => (
                    <div key={zone.id} className="p-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                       <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner flex-shrink-0">
                             <MapPin size={24} />
                          </div>
                          <div>
                             <h4 className="font-black text-slate-900 font-montserrat uppercase tracking-tight">{zone.name}</h4>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{zone.area}</p>
                             <div className="flex gap-4 mt-3">
                                <div className="px-3 py-1 bg-white border border-slate-100 rounded-lg">
                                   <p className="text-[8px] font-black text-slate-400 uppercase">Base Fee</p>
                                   <p className="text-xs font-black text-slate-900 font-roboto">{zone.baseFee}</p>
                                </div>
                                <div className="px-3 py-1 bg-white border border-slate-100 rounded-lg">
                                   <p className="text-[8px] font-black text-slate-400 uppercase">Free Above</p>
                                   <p className="text-xs font-black text-green-500 font-roboto">{zone.freeAbove}</p>
                                </div>
                             </div>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button className="p-2 text-slate-300 hover:text-blue-500 transition-all">
                             <Edit2 size={16} />
                          </button>
                          <button className="p-2 text-slate-300 hover:text-red-500 transition-all">
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Surcharges Sidebar */}
         <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3">
                  <DollarSign size={18} className="text-amber-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Additional Surcharges</h3>
               </div>
               <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">COD Handling Fee</label>
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400">₹</span>
                        <input type="number" defaultValue="40" className="bg-transparent border-none p-0 text-sm font-black text-slate-900 outline-none w-full" />
                     </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Express Surcharge</label>
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400">₹</span>
                        <input type="number" defaultValue="99" className="bg-transparent border-none p-0 text-sm font-black text-slate-900 outline-none w-full" />
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-blue-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-blue-100">
               <div className="absolute -right-4 -bottom-4 opacity-10">
                  <Truck size={120} />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3">
                     <Package size={20} />
                     <h4 className="text-lg font-black font-montserrat uppercase tracking-tight">Free Delivery</h4>
                  </div>
                  <p className="text-xs opacity-80 mt-4 leading-relaxed font-medium">
                     "Setting a lower free shipping threshold can increase average order value by up to 22%."
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default DeliveryCharges;
