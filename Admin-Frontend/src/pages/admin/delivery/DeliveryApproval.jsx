import React from 'react';
import { 
  UserCheck, ShieldCheck, FileText, CheckCircle2, 
  XCircle, Clock, Search, Filter, Mail, Phone,
  MapPin, AlertCircle, Trash2, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_APPLICATIONS = [
  { id: 'APP001', name: 'Rajesh Tyagi', zone: 'East Delhi', date: '2026-05-09', vehicle: 'Own Bike', license: 'DL-8C-4587', status: 'Pending' },
  { id: 'APP002', name: 'Manish Pandey', zone: 'South Delhi', date: '2026-05-09', vehicle: 'Scooter', license: 'DL-4S-2144', status: 'Reviewing' },
  { id: 'APP003', name: 'Kunal Gahlot', zone: 'Noida Sec 62', date: '2026-05-08', vehicle: 'Electric Bike', license: 'UP-16-9852', status: 'Pending' },
];

const DeliveryOnboarding = () => {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Fleet Onboarding</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Review and approve new delivery agent applications for platform logistics.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
            <ShieldCheck size={16} />
            Policy Guide
          </button>
        </div>
      </div>

      {/* Verification Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Pending Review', value: '18', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Background Check', value: '12', icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Approved Today', value: '5', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
            <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-montserrat px-1">Recent Applications</h3>
        
        <AnimatePresence>
          {MOCK_APPLICATIONS.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-8 group"
            >
              {/* Agent Profile */}
              <div className="flex items-center gap-5 flex-1 min-w-[250px]">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-400 border border-slate-100 shadow-inner group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                  {app.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 font-montserrat">{app.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {app.id} • Applied {app.date}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100">{app.vehicle}</span>
                    <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100">{app.license}</span>
                  </div>
                </div>
              </div>

              {/* Status & Zone */}
              <div className="flex flex-col items-center md:items-start gap-2 flex-1">
                 <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-600 uppercase tracking-tighter bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <MapPin size={12} className="text-blue-500" />
                    Preferred Zone: <span className="text-slate-900 ml-1">{app.zone}</span>
                 </div>
                 <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${app.status === 'Pending' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{app.status}</span>
                 </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pr-2">
                 <button className="flex items-center gap-2 px-5 py-3 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                    <Eye size={16} />
                    View Docs
                 </button>
                 <button className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm">
                    <XCircle size={16} />
                    Reject
                 </button>
                 <button className="flex items-center gap-2 px-5 py-3 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-green-100">
                    <CheckCircle2 size={16} />
                    Approve
                 </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="bg-slate-50 rounded-3xl p-8 border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 mb-4">
              <AlertCircle size={24} />
           </div>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No more pending applications</p>
           <p className="text-[10px] text-slate-400 font-medium mt-1">Check back later for new delivery fleet candidates.</p>
        </div>
      </div>
    </div>
  );
};

export default DeliveryOnboarding;
