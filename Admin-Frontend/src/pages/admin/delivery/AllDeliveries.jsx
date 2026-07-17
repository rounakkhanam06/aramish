import React, { useState } from 'react';
import { 
  Truck, User, Star, MapPin, 
  Phone, Mail, CheckCircle2, XCircle,
  Clock, Search, Filter, MoreVertical,
  Plus, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_PARTNERS = [
  { id: 'DP001', name: 'Amit Kumar', zone: 'South Delhi', phone: '+91 98765 43210', status: 'Active', rating: 4.8, orders: 1245, vehicle: 'Electric Bike' },
  { id: 'DP002', name: 'Suresh Raina', zone: 'Gurgaon', phone: '+91 98765 43211', status: 'Active', rating: 4.5, orders: 850, vehicle: 'Scooter' },
  { id: 'DP003', name: 'Vikram Batra', zone: 'Noida', phone: '+91 98765 43212', status: 'Busy', rating: 4.9, orders: 2100, vehicle: 'Bike' },
  { id: 'DP004', name: 'Pankaj Singh', zone: 'West Delhi', phone: '+91 98765 43213', status: 'Inactive', rating: 4.2, orders: 420, vehicle: 'Scooter' },
  { id: 'DP005', name: 'Rohit Sharma', zone: 'Faridabad', phone: '+91 98765 43214', status: 'Active', rating: 4.7, orders: 1560, vehicle: 'Electric Bike' },
];

const DeliveryPartners = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Logistics Partners</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage platform delivery fleet, active zones, and agent performance.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">
          <Plus size={16} />
          Onboard Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Fleet', value: '145', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active Now', value: '82', icon: Activity, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Avg Delivery', value: '32 Min', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Zones Covered', value: '12', icon: MapPin, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
              {stat.icon && React.createElement(stat.icon, { size: 22 })}
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <div className="flex gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search by Agent Name, Phone or Zone..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="px-6 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Agent Details</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Zone / Area</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {MOCK_PARTNERS.map((partner, i) => (
                <tr key={partner.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 border border-slate-100">
                          {partner.name.charAt(0)}
                       </div>
                       <div>
                          <p className="font-bold text-slate-900 font-montserrat leading-tight">{partner.name}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{partner.vehicle}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[11px] font-bold text-slate-600">
                     <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-300" /> {partner.phone}</p>
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase tracking-tighter bg-slate-50 px-2 py-1 rounded-lg w-fit border border-slate-100">
                        <MapPin size={10} className="text-blue-500" />
                        {partner.zone}
                     </div>
                  </td>
                  <td className="px-6 py-5 font-black text-slate-900 font-roboto">{partner.orders.toLocaleString()}</td>
                  <td className="px-6 py-5">
                     <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg w-fit text-xs font-black">
                        <Star size={12} fill="currentColor" />
                        {partner.rating}
                     </div>
                  </td>
                  <td className="px-6 py-5">
                     <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                       partner.status === 'Active' ? 'bg-green-50 text-green-600' : 
                       partner.status === 'Busy' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                     }`}>
                        {partner.status}
                     </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-all">
                       <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Activity = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>;

export default DeliveryPartners;
