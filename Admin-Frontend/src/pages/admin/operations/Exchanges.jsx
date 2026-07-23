import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Search, CheckCircle2, XCircle, Clock,
  Package, User, Calendar, AlertCircle, X, Truck,
  ArrowRight, Eye, ChevronLeft, ChevronDown, Copy,
  ExternalLink, RotateCcw, ArrowLeftRight, ShieldAlert,
  BarChart3, TrendingUp, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import OptimizedImage from '../../../components/common/OptimizedImage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_COLORS = {
  'Requested':             'bg-blue-50 text-blue-700 border-blue-200',
  'Approved':              'bg-green-50 text-green-700 border-green-200',
  'Rejected':              'bg-red-50 text-red-700 border-red-200',
  'Pickup Scheduled':      'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Old Item Picked Up':    'bg-purple-50 text-purple-700 border-purple-200',
  'Replacement Dispatched':'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Completed':             'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelled':             'bg-slate-50 text-slate-600 border-slate-200',
  'Failed':                'bg-red-50 text-red-700 border-red-200',
  'Manual Review':         'bg-amber-50 text-amber-700 border-amber-200',
};

const TABS = ['All', 'Requested', 'Approved', 'Pickup Scheduled', 'Old Item Picked Up', 'Replacement Dispatched', 'Completed', 'Rejected', 'Failed', 'Manual Review', 'Cancelled'];

const getToken = () => localStorage.getItem('adminToken');

// ── AWB Copy Button ────────────────────────────────────────────────────────────
const AWBField = ({ label, awb, trackingUrl }) => {
  const copy = () => { navigator.clipboard.writeText(awb); toast.success('Copied!'); };
  if (!awb) return null;
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
        <p className="text-xs font-black text-slate-800 font-mono">{awb}</p>
      </div>
      <div className="flex gap-1.5">
        <button onClick={copy} className="p-1.5 rounded-md hover:bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors" title="Copy AWB"><Copy size={12} /></button>
        {trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-md hover:bg-white border border-slate-200 text-slate-500 hover:text-blue-600 transition-colors" title="Track"><ExternalLink size={12} /></a>
        )}
      </div>
    </div>
  );
};

// ── Timeline ──────────────────────────────────────────────────────────────────
const Timeline = ({ entries }) => {
  if (!entries || entries.length === 0) return <p className="text-xs text-slate-400 italic">No timeline entries</p>;
  return (
    <div className="space-y-2">
      {[...entries].reverse().map((e, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800">{e.status}</p>
            {e.remarks && <p className="text-[11px] text-slate-500">{e.remarks}</p>}
            <p className="text-[10px] text-slate-400">{new Date(e.timestamp).toLocaleString('en-IN')} · {e.actor}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Exchanges = () => {
  const [exchanges, setExchanges] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showStats, setShowStats] = useState(false);

  // Address edit state variables
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');

  const fetchExchanges = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (activeTab !== 'All') params.append('status', activeTab);
      const res = await fetch(`${API_BASE}/exchanges/admin/all?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExchanges(data.exchanges || []);
        setTotalPages(Math.ceil((data.total || 0) / 20));
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || 'Failed to fetch exchanges');
      }
    } catch (err) {
      toast.error('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  const fetchStats = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/exchanges/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch {}
  };

  useEffect(() => { fetchExchanges(); }, [fetchExchanges]);
  useEffect(() => { setPage(1); }, [activeTab]);

  const fetchDetail = async (id) => {
    const token = getToken();
    if (!token) return;
    try {
      setDetailLoading(true);
      const res = await fetch(`${API_BASE}/exchanges/admin/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedExchange(data.exchange);
        setAdminNotes(data.exchange.adminNotes || '');
        setRejectionReason(data.exchange.rejectionReason || '');

        // Populate address fields
        const addr = data.exchange.orderId?.deliveryAddress || {};
        setEditName(addr.name || '');
        setEditPhone(addr.phone || '');
        setEditPincode(addr.pincode || '');

        const fullAddress = addr.address || '';
        const parts = fullAddress.split(',');
        if (parts.length >= 3) {
          setEditAddress(parts.slice(0, parts.length - 2).join(',').trim());
          setEditCity(parts[parts.length - 2].trim());
          const statePin = parts[parts.length - 1].trim();
          const statePinParts = statePin.split('-');
          setEditState(statePinParts[0].trim());
        } else {
          setEditAddress(fullAddress);
          setEditCity('');
          setEditState('');
        }
      } else {
        toast.error(data.message || 'Failed to load exchange');
      }
    } catch (err) {
      toast.error('Could not fetch exchange details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleManage = (item) => {
    setIsEditingAddress(false);
    setManageOpen(true);
    setSelectedExchange(item);
    fetchDetail(item._id);
  };

  const handleAddressUpdate = async () => {
    if (!selectedExchange) return;
    if (!editName.trim() || !editAddress.trim() || !editPincode.trim() || !editPhone.trim() || !editCity.trim() || !editState.trim()) {
      toast.error('All address fields are required');
      return;
    }
    if (!/^\d{6}$/.test(editPincode.trim())) {
      toast.error('Pincode must be exactly 6 digits');
      return;
    }
    if (!/^\d{10}$/.test(editPhone.trim())) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    const token = getToken();
    if (!token) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch(`${API_BASE}/exchanges/admin/${selectedExchange._id}/address`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim(),
          pincode: editPincode.trim(),
          phone: editPhone.trim(),
          city: editCity.trim(),
          state: editState.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Address updated successfully');
        setIsEditingAddress(false);
        fetchDetail(selectedExchange._id);
      } else {
        toast.error(data.message || 'Address update failed');
      }
    } catch (err) {
      toast.error('Could not update address');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRetryShipment = async (leg) => {
    if (!selectedExchange) return;
    const token = getToken();
    if (!token) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch(`${API_BASE}/exchanges/admin/${selectedExchange._id}/retry-shipment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leg })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Shipment retry successful for ${leg} leg`);
        fetchDetail(selectedExchange._id);
        fetchExchanges();
      } else {
        toast.error(data.message || `Retry failed for ${leg} leg`);
        fetchDetail(selectedExchange._id);
      }
    } catch (err) {
      toast.error('Could not retry shipment');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedExchange) return;
    if (newStatus === 'Rejected' && !rejectionReason.trim()) {
      toast.error('Rejection reason is required'); return;
    }
    if (newStatus === 'Cancelled' && !adminNotes.trim()) {
      toast.error('Admin notes are required when cancelling'); return;
    }
    const token = getToken();
    if (!token) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch(`${API_BASE}/exchanges/admin/${selectedExchange._id}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, adminNotes: adminNotes.trim(), rejectionReason: rejectionReason.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Exchange status updated to ${newStatus}`);
        setSelectedExchange(data.exchange);
        fetchExchanges();
      } else {
        toast.error(data.message || 'Status update failed');
      }
    } catch (err) {
      toast.error('Could not update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  const statusBadge = (status) => (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );

  // Action buttons for different exchange states
  const renderActions = (ex) => {
    if (!ex) return null;
    const s = ex.status;
    const btn = (label, status, style = 'primary') => (
      <button
        key={status}
        onClick={() => handleStatusUpdate(status)}
        disabled={updatingStatus}
        className={`px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 ${
          style === 'danger' ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' :
          style === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' :
          style === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
          'bg-[#0B132B] text-white hover:bg-[#1a2340]'
        }`}
      >{updatingStatus ? 'Updating...' : label}</button>
    );

    if (s === 'Requested') return [btn('Approve', 'Approved', 'success'), btn('Reject', 'Rejected', 'danger')];
    if (s === 'Approved') return [btn('Mark Pickup Scheduled', 'Pickup Scheduled'), btn('Cancel', 'Cancelled', 'warning'), btn('Mark Failed', 'Failed', 'danger')];
    if (s === 'Pickup Scheduled') return [btn('Mark Old Item Picked Up', 'Old Item Picked Up'), btn('Manual Review', 'Manual Review', 'warning'), btn('Failed', 'Failed', 'danger')];
    if (s === 'Old Item Picked Up') return [btn('Mark Replacement Dispatched', 'Replacement Dispatched'), btn('Manual Review', 'Manual Review', 'warning')];
    if (s === 'Replacement Dispatched') return [btn('Mark Completed', 'Completed', 'success'), btn('Manual Review', 'Manual Review', 'warning'), btn('Failed', 'Failed', 'danger')];
    if (s === 'Manual Review') return [btn('Approve Again', 'Approved', 'success'), btn('Cancel', 'Cancelled', 'warning'), btn('Mark Failed', 'Failed', 'danger'), btn('Mark Completed', 'Completed', 'success')];
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Exchanges</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage product exchange requests and shipment coordination.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowStats(!showStats); fetchStats(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 transition-colors">
            <BarChart3 size={14} /> Stats
          </button>
          <button onClick={fetchExchanges} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B132B] text-white text-xs font-black hover:opacity-90 transition-opacity">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Panel */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total', value: stats.total, icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Success Rate', value: `${stats.successRate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Failure Rate', value: `${stats.failureRate}%`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
                <div className={`${stat.bg} p-2 rounded-xl`}><stat.icon size={18} className={stat.color} /></div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-black text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${activeTab === tab ? 'bg-[#0B132B] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw size={28} className="animate-spin mb-3" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading exchanges...</p>
          </div>
        ) : exchanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ArrowLeftRight size={28} className="mb-3 opacity-30" />
            <p className="font-bold uppercase tracking-widest text-[10px]">No exchanges found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {exchanges.map((item) => (
              <div key={item._id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group">
                {/* Original → Requested */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
                    {item.originalItem?.image
                      ? <OptimizedImage src={item.originalItem.image} alt="" type="product" className="w-full h-full object-cover" />
                      : <Package size={16} className="m-auto text-slate-400 mt-2.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{item.originalItem?.name || '—'}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span>{item.originalItem?.size} / {item.originalItem?.color}</span>
                      <ArrowRight size={10} />
                      <span className="text-blue-600 font-bold">{item.requestedVariant?.size} / {item.requestedVariant?.color}</span>
                    </div>
                  </div>
                </div>
                {/* Customer */}
                <div className="hidden md:block w-36 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{item.userId?.name || '—'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.userId?.email || '—'}</p>
                </div>
                {/* Reason */}
                <p className="hidden lg:block text-[10px] text-slate-500 w-28 truncate">{item.reason}</p>
                {/* Status */}
                <div className="flex-shrink-0">{statusBadge(item.status)}</div>
                {/* Date */}
                <p className="hidden md:block text-[10px] text-slate-400 w-20 text-right">
                  {new Date(item.createdAt).toLocaleDateString('en-IN')}
                </p>
                {/* Manage */}
                <button onClick={() => handleManage(item)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-[10px] font-black text-[#0B132B] border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                  <Eye size={11} /> Manage
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1.5 text-xs font-black text-slate-600 disabled:opacity-40">
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-slate-500 font-bold">Page {page} of {totalPages} · {total} total</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1.5 text-xs font-black text-slate-600 disabled:opacity-40">
              Next <ChevronLeft size={14} className="rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* ── Manage Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {manageOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setManageOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 overflow-y-auto shadow-2xl">

              {detailLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={24} className="animate-spin text-slate-400" />
                </div>
              ) : selectedExchange ? (
                <div>
                  {/* Drawer Header */}
                  <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Exchange Detail</h2>
                      <p className="text-[10px] text-slate-400 font-mono">#{selectedExchange._id?.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(selectedExchange.status)}
                      <button onClick={() => setManageOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={16} /></button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Item Swap */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Exchange</p>
                      <div className="flex items-center gap-4">
                        {/* Original */}
                        <div className="flex-1 text-center">
                          <div className="w-16 h-16 mx-auto bg-white rounded-xl overflow-hidden border border-slate-200 mb-2">
                            {selectedExchange.originalItem?.image
                              ? <OptimizedImage src={selectedExchange.originalItem.image} alt="" type="product" className="w-full h-full object-contain" />
                              : <Package size={20} className="m-auto text-slate-300 mt-3" />}
                          </div>
                          <p className="text-[10px] font-bold text-slate-700 line-clamp-2">{selectedExchange.originalItem?.name}</p>
                          <p className="text-[10px] text-slate-500">{selectedExchange.originalItem?.size} / {selectedExchange.originalItem?.color}</p>
                          <p className="text-[10px] text-slate-400">₹{selectedExchange.originalItem?.price}</p>
                        </div>
                        <ArrowRight size={20} className="text-slate-400 flex-shrink-0" />
                        {/* Replacement */}
                        <div className="flex-1 text-center">
                          <div className="w-16 h-16 mx-auto bg-white rounded-xl overflow-hidden border border-blue-200 mb-2">
                            {selectedExchange.requestedVariant?.image
                              ? <OptimizedImage src={selectedExchange.requestedVariant.image} alt="" type="product" className="w-full h-full object-contain" />
                              : <Package size={20} className="m-auto text-blue-200 mt-3" />}
                          </div>
                          <p className="text-[10px] font-bold text-blue-700 line-clamp-2">{selectedExchange.originalItem?.name}</p>
                          <p className="text-[10px] text-blue-600 font-bold">{selectedExchange.requestedVariant?.size} / {selectedExchange.requestedVariant?.color}</p>
                          <p className="text-[10px] text-slate-400">₹{selectedExchange.originalItem?.price} (fixed)</p>
                        </div>
                      </div>
                    </div>

                    {/* Reason + Customer */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Reason</p>
                        <p className="text-xs font-bold text-slate-800">{selectedExchange.reason}</p>
                        {selectedExchange.comments && <p className="text-[11px] text-slate-500 mt-1">{selectedExchange.comments}</p>}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Customer Address</p>
                          <button
                            onClick={() => setIsEditingAddress(!isEditingAddress)}
                            className="text-[9px] font-bold text-blue-600 hover:underline"
                          >
                            {isEditingAddress ? 'Cancel' : 'Edit'}
                          </button>
                        </div>
                        {isEditingAddress ? (
                          <div className="space-y-1.5 mt-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              placeholder="Name"
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <input
                              type="text"
                              value={editPhone}
                              onChange={e => setEditPhone(e.target.value)}
                              placeholder="Phone"
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <input
                              type="text"
                              value={editAddress}
                              onChange={e => setEditAddress(e.target.value)}
                              placeholder="Street Address"
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            <div className="grid grid-cols-3 gap-1">
                              <input
                                type="text"
                                value={editCity}
                                onChange={e => setEditCity(e.target.value)}
                                placeholder="City"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                              <input
                                type="text"
                                value={editState}
                                onChange={e => setEditState(e.target.value)}
                                placeholder="State"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                              <input
                                type="text"
                                value={editPincode}
                                onChange={e => setEditPincode(e.target.value)}
                                placeholder="Pincode"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                              />
                            </div>
                            <button
                              onClick={handleAddressUpdate}
                              disabled={updatingStatus}
                              className="w-full bg-[#0B132B] text-white text-[10px] py-1 rounded font-bold hover:opacity-90 disabled:opacity-50"
                            >
                              Save Address
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-slate-800">{selectedExchange.orderId?.deliveryAddress?.name || selectedExchange.userId?.name || '—'}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{selectedExchange.orderId?.deliveryAddress?.phone || selectedExchange.userId?.phone || '—'}</p>
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{selectedExchange.orderId?.deliveryAddress?.address || 'No Address'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{selectedExchange.orderId?.deliveryAddress?.pincode}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* User uploaded images */}
                    {selectedExchange.images?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Customer Photos</p>
                        <div className="flex gap-2 flex-wrap">
                          {selectedExchange.images.map((img, idx) => (
                            <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border border-slate-100">
                              <OptimizedImage src={img} alt={`proof-${idx}`} type="default" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shipments */}
                    <div className="space-y-3">
                      {/* Reverse */}
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center gap-2 mb-3">
                          <RotateCcw size={14} className="text-amber-600" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Reverse Pickup (Old Item)</p>
                          {selectedExchange.reverse?.failed && <span className="text-[9px] bg-red-100 text-red-600 font-black uppercase px-1.5 py-0.5 rounded-full border border-red-200">Failed</span>}
                        </div>
                        <AWBField label="Reverse AWB" awb={selectedExchange.reverse?.awb} trackingUrl={selectedExchange.reverse?.trackingUrl} />
                        {selectedExchange.reverse?.status && <p className="text-[10px] text-amber-600 mt-1.5 font-bold">Status: {selectedExchange.reverse.status}</p>}
                        {!selectedExchange.reverse?.awb && <p className="text-[10px] text-amber-500 italic">Shipment not yet created</p>}
                        {selectedExchange.reverse?.failed && (
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200/50">
                            <span className="text-[10px] text-red-600 font-medium">Failed attempt</span>
                            <button
                              onClick={() => handleRetryShipment('reverse')}
                              disabled={updatingStatus}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9px] px-2 py-1 rounded disabled:opacity-50"
                            >
                              {updatingStatus ? 'Retrying...' : 'Retry Reverse Pickup'}
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Forward */}
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Truck size={14} className="text-blue-600" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Forward Delivery (Replacement)</p>
                          {selectedExchange.forward?.failed && <span className="text-[9px] bg-red-100 text-red-600 font-black uppercase px-1.5 py-0.5 rounded-full border border-red-200">Failed</span>}
                        </div>
                        <AWBField label="Forward AWB" awb={selectedExchange.forward?.awb} trackingUrl={selectedExchange.forward?.trackingUrl} />
                        {selectedExchange.forward?.status && <p className="text-[10px] text-blue-600 mt-1.5 font-bold">Status: {selectedExchange.forward.status}</p>}
                        {!selectedExchange.forward?.awb && <p className="text-[10px] text-blue-500 italic">Shipment not yet created</p>}
                        {selectedExchange.forward?.failed && (
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200/50">
                            <span className="text-[10px] text-red-600 font-medium">Failed attempt</span>
                            <button
                              onClick={() => handleRetryShipment('forward')}
                              disabled={updatingStatus}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] px-2 py-1 rounded disabled:opacity-50"
                            >
                              {updatingStatus ? 'Retrying...' : 'Retry Forward Delivery'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shipment Errors if any */}
                    {selectedExchange.shipmentErrors && selectedExchange.shipmentErrors.length > 0 && (
                      <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-2">Shipment Error History ({selectedExchange.retryCount}/3 retries)</p>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {selectedExchange.shipmentErrors.map((err, i) => (
                            <div key={i} className="text-[11px] text-red-700 border-b border-red-100 pb-1.5 last:border-0 last:pb-0">
                              <span className="font-bold uppercase">[{err.leg}]</span> {err.error}
                              <p className="text-[9px] text-red-400 font-mono mt-0.5">{new Date(err.timestamp).toLocaleString('en-IN')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Status Timeline</p>
                      <Timeline entries={selectedExchange.timeline} />
                    </div>

                    {/* Rejection reason if rejected */}
                    {selectedExchange.rejectionReason && (
                      <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                        <p className="text-[10px] text-red-500 font-bold uppercase">Rejection Reason</p>
                        <p className="text-xs text-red-700 font-bold mt-0.5">{selectedExchange.rejectionReason}</p>
                      </div>
                    )}

                    {/* Admin Notes Input */}
                    {!['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(selectedExchange.status) && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Notes</label>
                          <textarea
                            value={adminNotes}
                            onChange={e => setAdminNotes(e.target.value)}
                            rows={2}
                            className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                            placeholder="Optional notes..."
                          />
                        </div>
                        {selectedExchange.status === 'Requested' && (
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rejection Reason <span className="text-red-500">*</span></label>
                            <input
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                              placeholder="Required when rejecting..."
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {renderActions(selectedExchange)}
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Exchanges;
