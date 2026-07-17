import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Download, CheckCircle2, XCircle, Clock, 
  Trash2, Edit2, Percent, Tag, Calendar, Copy,
  ArrowUpRight, Users, DollarSign, RefreshCw, ToggleLeft, ToggleRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../../utils/toast';
import ConfirmModal from '../../../components/ConfirmModal';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingCoupon, setEditingCoupon] = useState(null);
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState('Percentage');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [usageLimit, setUsageLimit] = useState('1000');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [expiry, setExpiry] = useState('');

  // Confirm Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  const triggerConfirm = (title, message, action) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const fetchCoupons = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('adminToken');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${apiBase}/admin/promotions/coupons`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setCoupons(data.coupons || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load coupons from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    if (!code || !value || !expiry) {
      toast.info('Please fill in code, value and expiry date');
      return;
    }

    if (Number(value) < 0) {
      toast.info('Discount value cannot be negative!');
      return;
    }

    if (type === 'Percentage' && Number(value) > 100) {
      toast.info('Percentage discount cannot exceed 100%!');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedExpiry = new Date(expiry);
    selectedExpiry.setHours(0, 0, 0, 0);

    if (selectedExpiry < today) {
      toast.info('Expiry date cannot be in the past!');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const url = editingCoupon 
        ? `${apiBase}/admin/promotions/coupons/${editingCoupon._id}`
        : `${apiBase}/admin/promotions/coupons`;
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          type,
          value,
          minOrder,
          usageLimit,
          perUserLimit,
          expiry
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingCoupon ? 'Coupon updated successfully' : 'Coupon published successfully');
        setIsAdding(false);
        setEditingCoupon(null);
        // Reset Form
        setCode('');
        setType('Percentage');
        setValue('');
        setMinOrder('');
        setUsageLimit('1000');
        setPerUserLimit('1');
        setExpiry('');
        fetchCoupons();
      } else {
        toast.error(data.message || 'Failed to save coupon');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleDeleteCoupon = (id) => {
    triggerConfirm(
      'Delete Coupon',
      'Are you sure you want to permanently delete this coupon? Users will no longer be able to use it.',
      async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/promotions/coupons/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            toast.success('Coupon deleted successfully');
            fetchCoupons();
          } else {
            toast.error(data.message || 'Failed to delete coupon');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/promotions/coupons/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Coupon ${nextStatus === 'Active' ? 'Activated' : 'Paused'}`);
        fetchCoupons();
      } else {
        toast.error(data.message || 'Failed to update coupon status');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleExport = () => {
    if (coupons.length === 0) {
      toast.error('No coupons to export');
      return;
    }
    const headers = ['Code', 'Type', 'Value', 'Min. Order', 'Expiry', 'Usage Limit', 'Status', 'Usage Count'];
    const rows = coupons.map(c => [
      c.code,
      c.type,
      c.type === 'Percentage' ? `${c.value}%` : `INR ${c.value}`,
      c.minOrder || 0,
      new Date(c.expiry).toLocaleDateString(),
      c.usageLimit || 1,
      c.status,
      c.usage || 0
    ]);
    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `coupons_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Coupons list exported successfully!');
  };

  const handleCopyCode = (couponCode) => {
    navigator.clipboard.writeText(couponCode);
    toast.info(`Copied "${couponCode}" to clipboard!`);
  };

  // Stats
  const activeCount = coupons.filter(c => c.status === 'Active').length;
  const totalUsage = coupons.reduce((sum, c) => sum + (c.usage || 0), 0);
  const totalSavedValue = coupons.reduce((sum, c) => {
    // Estimating standard saving (mock formula)
    const factor = c.type === 'Percentage' ? 120 : c.value;
    return sum + ((c.usage || 0) * factor);
  }, 0);
  const avgUsage = coupons.length ? Math.round(totalUsage / coupons.length) : 0;

  // Search filtering
  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatusBadge = ({ status }) => {
    const styles = {
      'Active': 'bg-green-50 text-green-600 border-green-100',
      'Expiring': 'bg-amber-50 text-amber-600 border-amber-100',
      'Paused': 'bg-slate-50 text-slate-400 border-slate-100',
      'Expired': 'bg-red-50 text-red-600 border-red-100'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${styles[status] || styles['Paused']}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Coupon Manager</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Create and manage promotional discounts and marketing offers.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#0B132B] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Create Coupon
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Coupons', value: String(activeCount).padStart(2, '0'), icon: Tag, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Total Redeemed', value: totalUsage.toLocaleString(), icon: Users, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Est. Revenue Saved', value: `₹${totalSavedValue.toLocaleString()}`, icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Avg Usage / Code', value: String(avgUsage), icon: ArrowUpRight, color: 'text-indigo-500', bg: 'bg-indigo-50' },
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

      {/* Table & Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <div className="flex gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0B132B] transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search by coupon code..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold focus:ring-4 focus:ring-orange-50 transition-all outline-none text-slate-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Coupon Info</th>
                <th className="px-6 py-4">Value</th>
                <th className="px-6 py-4">Min. Order</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4">Usage</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400 font-medium">
                    Loading promotional coupons...
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400 font-medium">
                    No coupons found. Click "Create Coupon" to add one!
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => (
                  <tr key={coupon._id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-orange-50 text-[#0B132B] rounded-xl flex items-center justify-center font-black shadow-inner">
                            <Tag size={18} />
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <p className="font-black text-slate-900 font-montserrat leading-tight uppercase tracking-widest">{coupon.code}</p>
                               <button 
                                 onClick={() => handleCopyCode(coupon.code)}
                                 className="text-slate-400 hover:text-[#0B132B] transition-colors p-1 rounded hover:bg-slate-100/80 active:scale-95 transition-all"
                                 title="Copy Code"
                               >
                                 <Copy size={12} />
                               </button>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{coupon.type}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-black text-[#0B132B] font-roboto text-base">
                      {coupon.type === 'Percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-700">₹{coupon.minOrder || 0}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                        <Calendar size={12} className="text-slate-300" />
                        {new Date(coupon.expiry).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded text-[9.5px] font-black border border-slate-100 w-fit">
                          Global: {coupon.usage || 0} / {coupon.usageLimit || '∞'}
                        </span>
                        <span className="text-[9.5px] font-black text-slate-450 uppercase tracking-tight">
                          Per User: {coupon.perUserLimit || 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={coupon.status} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleToggleStatus(coupon._id, coupon.status)}
                          className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-all"
                          title={coupon.status === 'Active' ? 'Pause Coupon' : 'Activate Coupon'}
                        >
                          {coupon.status === 'Active' ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            setEditingCoupon(coupon);
                            setCode(coupon.code);
                            setType(coupon.type);
                            setValue(coupon.value);
                            setMinOrder(coupon.minOrder || '');
                            setUsageLimit(String(coupon.usageLimit || 1000));
                            setPerUserLimit(String(coupon.perUserLimit || 1));
                            setExpiry(new Date(coupon.expiry).toISOString().split('T')[0]);
                            setIsAdding(true);
                          }}
                          className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all"
                          title="Edit Coupon"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCoupon(coupon._id)}
                          className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                          title="Delete Coupon"
                        >
                          <Trash2 size={16} />
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

      {/* Add Coupon Modal Placeholder */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-md bg-white h-[calc(100vh-2rem)] rounded-[32px] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-slate-900 font-montserrat uppercase">{editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}</h2>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingCoupon(null);
                    setCode('');
                    setType('Percentage');
                    setValue('');
                    setMinOrder('');
                    setUsageLimit('1000');
                    setPerUserLimit('1');
                    setExpiry('');
                  }} 
                  className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveCoupon} className="flex-1 flex flex-col justify-between min-h-0">
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-6 flex-1 pr-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Coupon Code</label>
                    <input 
                      type="text" 
                      placeholder="e.g. SUMMER2026" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-orange-50 transition-all outline-none uppercase" 
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Discount Type</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-orange-50 outline-none appearance-none cursor-pointer"
                        value={type}
                        onChange={e => setType(e.target.value)}
                      >
                        <option value="Percentage">Percentage (%)</option>
                        <option value="Fixed Amount">Fixed Amount (₹)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Value</label>
                      <input 
                        type="number" 
                        placeholder={type === 'Percentage' ? 'e.g. 15' : 'e.g. 250'} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black outline-none" 
                        value={value}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || Number(val) >= 0) setValue(val);
                        }}
                        required
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Min. Order Requirement (₹)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 500" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none" 
                      value={minOrder}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || Number(val) >= 0) setMinOrder(val);
                      }}
                      min="0"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Global Usage Limit</label>
                      <input 
                        type="number" 
                        placeholder="1000" 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none" 
                        value={usageLimit}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || Number(val) >= 0) setUsageLimit(val);
                        }}
                        min="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Usage Limit per User</label>
                      <input 
                        type="number" 
                        placeholder="1" 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none" 
                        value={perUserLimit}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || Number(val) >= 0) setPerUserLimit(val);
                        }}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Expiry Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold outline-none" 
                      value={expiry}
                      onChange={e => setExpiry(e.target.value)}
                      min={todayStr}
                      required
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAdding(false);
                      setEditingCoupon(null);
                      setCode('');
                      setType('Percentage');
                      setValue('');
                      setMinOrder('');
                      setUsageLimit('1000');
                      setPerUserLimit('1');
                      setExpiry('');
                    }} 
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-4 bg-[#0B132B] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all">
                    {editingCoupon ? 'Save Changes' : 'Publish Coupon'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
};

export default Coupons;

