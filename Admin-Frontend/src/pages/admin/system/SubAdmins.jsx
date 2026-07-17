import React, { useState } from 'react';
import { 
  ShieldCheck, UserPlus, Search, Filter, 
  MoreVertical, CheckCircle2, XCircle, Trash2, 
  User, Key, Lock, Shield, Eye, Edit2, 
  Activity, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_ADMINS = [
  { id: 1, name: 'Prachi Gupta', email: 'prachi@admin.com', role: 'Super Admin', lastLogin: '2 mins ago', status: 'Active' },
  { id: 2, name: 'John Miller', email: 'john@cocia.com', role: 'Catalog Manager', lastLogin: '2 hours ago', status: 'Active' },
  { id: 3, name: 'Sarah Lee', email: 'sarah@support.com', role: 'Support Agent', lastLogin: '1 day ago', status: 'Active' },
  { id: 4, name: 'Michael Chen', email: 'mike@finance.com', role: 'Finance Manager', lastLogin: '3 days ago', status: 'Paused' },
];

const SubAdmins = () => {
  const [admins, setAdmins] = useState(MOCK_ADMINS);
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Sub-Admin & RBAC</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage platform team members and their granular access permissions.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all"
        >
          <UserPlus size={16} />
          Create Admin
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {[
           { label: 'Total Admins', value: '08', icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-50' },
           { label: 'Roles Defined', value: '04', icon: Key, color: 'text-green-500', bg: 'bg-green-50' },
           { label: 'Active Sessions', value: '03', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50' },
           { label: 'Security Alerts', value: '00', icon: Lock, color: 'text-slate-400', bg: 'bg-slate-50' },
         ].map((stat, i) => (
           <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
                 <stat.icon size={22} />
              </div>
              <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
                 <p className="text-xl font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
              </div>
           </div>
         ))}
      </div>

      {/* Admin List Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
           <div className="relative max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
              <input type="text" placeholder="Search by name or email..." className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold outline-none" />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Admin Member</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {admins.map((admin) => (
                <tr key={admin.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center font-black border border-slate-100">
                          {admin.name.charAt(0)}
                       </div>
                       <div>
                          <p className="font-black text-slate-900 font-montserrat uppercase tracking-tight leading-tight">{admin.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{admin.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-100">
                      {admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                      <Clock size={12} className="text-slate-300" />
                      {admin.lastLogin}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${admin.status === 'Active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all">
                        <Shield size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Admin Slide-over */}
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
                <h2 className="text-xl font-black text-slate-900 font-montserrat uppercase">New Admin Member</h2>
                <button onClick={() => setIsAdding(false)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                  <XCircle size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Full Name</label>
                  <input type="text" placeholder="Enter name" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Email Address</label>
                  <input type="email" placeholder="example@cocia.com" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Assign Role</label>
                  <select className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none appearance-none">
                    <option>Super Admin (Full Access)</option>
                    <option>Catalog Manager</option>
                    <option>Support Agent</option>
                    <option>Finance Manager</option>
                  </select>
                </div>
                
                <div className="p-6 bg-blue-50 rounded-2xl space-y-4">
                   <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Role Permissions</h4>
                   <div className="space-y-3">
                      {['Catalog Access', 'Order Management', 'Finance & Payouts', 'User Moderation', 'System Settings'].map((perm, i) => (
                        <div key={i} className="flex items-center gap-3">
                           <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
                              <CheckCircle2 size={10} className="text-white" />
                           </div>
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{perm}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex gap-3">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest">Discard</button>
                <button className="flex-1 py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">Create Account</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubAdmins;
