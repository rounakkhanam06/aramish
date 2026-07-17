import React, { useState, useEffect, useCallback } from 'react';
import { 
  RotateCcw, Search, MoreVertical, 
  CheckCircle2, XCircle, Clock, 
  DollarSign, Package, User, Calendar,
  AlertCircle, ChevronRight, X, Truck,
  ArrowRight, RefreshCw, Ban, Eye,
  ChevronLeft, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import OptimizedImage from '../../../components/common/OptimizedImage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ requestedCount: 0, approvedCount: 0, refundedTodayAmount: 0, avgResolutionDays: '0' });
  
  // Manage modal
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [editRefundAmount, setEditRefundAmount] = useState('');

  const tabs = ['All', 'Requested', 'Approved', 'Rejected', 'Pick-up Scheduled', 'Received', 'Refunded'];

  const getToken = () => localStorage.getItem('adminToken');

  const fetchReturns = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (activeTab !== 'All') params.append('status', activeTab);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`${API_BASE}/returns/admin/all?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReturns(data.returns || []);
        setTotalPages(data.pages || 1);
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
      } else {
        toast.error(data.message || 'Failed to fetch returns');
      }
    } catch (err) {
      console.error('Fetch returns error:', err);
      toast.error('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, search]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  // Reset page when tab or search changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  const fetchReturnDetail = async (id) => {
    const token = getToken();
    if (!token) return;
    try {
      setDetailLoading(true);
      const res = await fetch(`${API_BASE}/returns/admin/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedReturn(data.returnRequest);
        setAdminNotes(data.returnRequest.adminNotes || '');
        setEditRefundAmount(data.returnRequest.refundAmount?.toString() || '');
      } else {
        toast.error(data.message || 'Failed to fetch return details');
      }
    } catch (err) {
      toast.error('Could not fetch return details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleManage = (returnItem) => {
    const id = returnItem._id;
    setManageOpen(true);
    fetchReturnDetail(id);
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedReturn) return;
    const token = getToken();
    if (!token) return;

    // Confirmation for important actions
    if (newStatus === 'Refunded' && !window.confirm('Process refund? This will restore stock and credit the customer wallet.')) return;
    if (newStatus === 'Rejected' && !window.confirm('Reject this return request?')) return;

    try {
      setUpdatingStatus(true);
      const body = { status: newStatus };
      if (adminNotes.trim()) body.adminNotes = adminNotes.trim();
      if (editRefundAmount && newStatus === 'Refunded') body.refundAmount = parseFloat(editRefundAmount);

      const res = await fetch(`${API_BASE}/returns/admin/${selectedReturn._id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Status updated to ${newStatus}`);
        setSelectedReturn(data.returnRequest);
        fetchReturns(); // Refresh list
      } else {
        toast.error(data.message || 'Failed to update status');
      }
    } catch (err) {
      toast.error('Error updating status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const closeManage = () => {
    setManageOpen(false);
    setSelectedReturn(null);
    setAdminNotes('');
    setEditRefundAmount('');
  };

  // Helper to get user info from return (handles both populated and aggregated formats)
  const getUserName = (item) => {
    if (item.userName) return item.userName;
    if (item.userId?.name) return item.userId.name;
    return 'Unknown';
  };

  const getOrderId = (item) => {
    const id = item.orderId?._id || item.orderId;
    if (!id) return 'N/A';
    return typeof id === 'string' ? id.substring(id.length - 8).toUpperCase() : id.toString().substring(id.toString().length - 8).toUpperCase();
  };

  const getReturnId = (item) => {
    const id = item._id;
    return id.substring(id.length - 6).toUpperCase();
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const StatusBadge = ({ status }) => {
    const styles = {
      'Requested': 'bg-amber-50 text-amber-600 border-amber-100',
      'Approved': 'bg-blue-50 text-blue-600 border-blue-100',
      'Rejected': 'bg-red-50 text-red-600 border-red-100',
      'Pick-up Scheduled': 'bg-indigo-50 text-indigo-600 border-indigo-100',
      'Received': 'bg-purple-50 text-purple-600 border-purple-100',
      'Refunded': 'bg-green-50 text-green-600 border-green-100',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status] || 'bg-slate-50 text-slate-400'}`}>
        {status}
      </span>
    );
  };

  // Determine which actions are available for a given status
  const getAvailableActions = (status) => {
    const map = {
      'Requested': [
        { label: 'Approve', status: 'Approved', icon: CheckCircle2, color: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-100' },
        { label: 'Reject', status: 'Rejected', icon: Ban, color: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100' }
      ],
      'Approved': [
        { label: 'Schedule Pickup', status: 'Pick-up Scheduled', icon: Truck, color: 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-100' }
      ],
      'Pick-up Scheduled': [
        { label: 'Mark Received', status: 'Received', icon: Package, color: 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-100' }
      ],
      'Received': [
        { label: 'Process Refund', status: 'Refunded', icon: DollarSign, color: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-100' }
      ]
    };
    return map[status] || [];
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Returns & Refunds</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage product returns, inspection status and refund processing.</p>
        </div>
        <button 
          onClick={fetchReturns}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Requests', value: stats.requestedCount.toString(), icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved', value: stats.approvedCount.toString(), icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Refunded Today', value: `₹${stats.refundedTodayAmount.toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Avg Resolution', value: `${stats.avgResolutionDays} Days`, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
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
        <div className="p-6 border-b border-slate-50 space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search by user name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="animate-spin text-blue-500" size={28} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading returns...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RotateCcw className="text-slate-200" size={40} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No return requests found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Return ID</th>
                    <th className="px-6 py-4">Order & Item</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Refund Amount</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {returns.map((item) => (
                    <tr key={item._id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="text-xs font-black text-blue-600 font-roboto">RET-{getReturnId(item)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">
                            {item.items?.[0]?.name || 'N/A'}
                            {item.items?.length > 1 && <span className="text-slate-400 text-xs ml-1">+{item.items.length - 1} more</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Order #{getOrderId(item)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center text-[10px] font-black uppercase">
                            {getUserName(item).substring(0, 1)}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{getUserName(item)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-600 font-medium text-xs">
                          <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                          {item.reason}
                        </div>
                      </td>
                      <td className="px-6 py-5 font-black text-slate-900 font-roboto">₹{item.refundAmount?.toLocaleString()}</td>
                      <td className="px-6 py-5 text-xs text-slate-500 font-medium">{formatDate(item.createdAt)}</td>
                      <td className="px-6 py-5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleManage(item)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Page {page} of {totalPages} • {total} total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={16} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={16} className="text-slate-500" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== MANAGE MODAL ==================== */}
      <AnimatePresence>
        {manageOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-end"
            onClick={closeManage}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading || !selectedReturn ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <RefreshCw className="animate-spin text-blue-500" size={28} />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading details...</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Modal Header */}
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 font-montserrat uppercase tracking-tight">
                        Return RET-{getReturnId(selectedReturn)}
                      </h2>
                      <div className="mt-1.5">
                        <StatusBadge status={selectedReturn.status} />
                      </div>
                    </div>
                    <button onClick={closeManage} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all">
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {/* Customer */}
                    <div className="bg-slate-50 p-5 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-blue-500" />
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Customer</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-sm font-black uppercase">
                          {(selectedReturn.userId?.name || 'G').substring(0, 1)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{selectedReturn.userId?.name || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{selectedReturn.userId?.email || ''} • {selectedReturn.userId?.phone || ''}</p>
                        </div>
                      </div>
                    </div>

                    {/* Order Info */}
                    <div className="bg-slate-50 p-5 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-indigo-500" />
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Order Info</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order ID</p>
                          <p className="font-bold text-slate-900 font-roboto mt-0.5">
                            #{(selectedReturn.orderId?._id || selectedReturn.orderId || '').toString().substring(String(selectedReturn.orderId?._id || selectedReturn.orderId || '').length - 8).toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Total</p>
                          <p className="font-bold text-slate-900 font-roboto mt-0.5">₹{(selectedReturn.orderId?.total || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
                          <p className="font-bold text-slate-900 mt-0.5">{selectedReturn.orderId?.paymentMethod || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Status</p>
                          <p className="font-bold text-slate-900 mt-0.5">{selectedReturn.orderId?.status || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Return Items */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Returned Items ({selectedReturn.items?.length})</p>
                      <div className="space-y-2">
                        {selectedReturn.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                            {item.image && (
                              <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 overflow-hidden flex-shrink-0">
                                <OptimizedImage src={item.image} alt={item.name} type="product" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Qty: {item.quantity} • ₹{item.price?.toLocaleString()}</p>
                            </div>
                            <p className="text-sm font-black text-blue-600 font-roboto">₹{(item.price * item.quantity).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="bg-amber-50 p-5 rounded-2xl space-y-2 border border-amber-100">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-500" />
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Return Reason</p>
                      </div>
                      <p className="text-sm font-bold text-amber-800">{selectedReturn.reason}</p>
                      {selectedReturn.reasonDetails && (
                        <p className="text-xs text-amber-600 font-medium leading-relaxed">{selectedReturn.reasonDetails}</p>
                      )}
                    </div>

                    {/* User uploaded images */}
                    {selectedReturn.images?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Customer Photos</p>
                        <div className="flex gap-2 flex-wrap">
                          {selectedReturn.images.map((img, idx) => (
                            <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border border-slate-100">
                              <OptimizedImage src={img} alt={`proof-${idx}`} type="default" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Refund Amount */}
                    <div className="bg-green-50 p-5 rounded-2xl border border-green-100 space-y-3">
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-green-600" />
                        <p className="text-[10px] font-black text-green-800 uppercase tracking-widest">Refund Amount</p>
                      </div>
                      {selectedReturn.status === 'Received' ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-green-700">₹</span>
                          <input
                            type="number"
                            value={editRefundAmount}
                            onChange={(e) => setEditRefundAmount(e.target.value)}
                            className="flex-1 bg-white border border-green-200 rounded-xl px-4 py-2.5 text-lg font-black text-green-800 font-roboto focus:outline-none focus:ring-2 focus:ring-green-200"
                          />
                        </div>
                      ) : (
                        <p className="text-2xl font-black text-green-800 font-roboto">₹{selectedReturn.refundAmount?.toLocaleString()}</p>
                      )}
                      <p className="text-[10px] text-green-600 font-medium">Method: {selectedReturn.refundMethod === 'Wallet' ? 'Wallet Credit' : 'Original Payment'}</p>
                    </div>

                    {/* Shiprocket Logistics Details */}
                    {selectedReturn.shiprocketReturnOrderId && (
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex items-center gap-2">
                          <Truck size={16} className="text-slate-600" />
                          <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Shiprocket reverse logistics</p>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <div>
                            <span className="text-slate-400 font-medium">Return Order ID:</span>
                            <p className="font-bold text-slate-800 mt-0.5">{selectedReturn.shiprocketReturnOrderId}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium">Shipment ID:</span>
                            <p className="font-bold text-slate-800 mt-0.5">{selectedReturn.shiprocketReturnShipmentId}</p>
                          </div>
                          {selectedReturn.awbCode && (
                            <>
                              <div>
                                <span className="text-slate-400 font-medium">AWB Code:</span>
                                <p className="font-bold text-slate-800 mt-0.5 font-roboto">{selectedReturn.awbCode}</p>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium">Courier Name:</span>
                                <p className="font-bold text-slate-800 mt-0.5">{selectedReturn.courierName || 'Assigned'}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Admin Notes */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Admin Notes</p>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add internal notes about this return..."
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 transition-all resize-none"
                      />
                    </div>

                    {/* Timestamps */}
                    <div className="flex gap-4 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        <span>Created: {formatDate(selectedReturn.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>Updated: {formatDate(selectedReturn.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer — Actions */}
                  <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 space-y-3">
                    {getAvailableActions(selectedReturn.status).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {getAvailableActions(selectedReturn.status).map((action) => (
                          <button
                            key={action.status}
                            onClick={() => handleStatusUpdate(action.status)}
                            disabled={updatingStatus}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${action.color}`}
                          >
                            <action.icon size={16} />
                            {updatingStatus ? 'Updating...' : action.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {selectedReturn.status === 'Refunded' ? '✓ This return has been fully processed' : 
                           selectedReturn.status === 'Rejected' ? '✕ This return was rejected' : 'No actions available'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Returns;
